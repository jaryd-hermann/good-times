-- =============================================================================
-- v2_question_schedule_pool_relaxation   (applied to production as migration 20260801162242)
-- =============================================================================
-- Exported from supabase_migrations.schema_migrations so the repo matches the
-- database exactly. ADDITIVE ONLY -- no v1 table is dropped or altered.
--
-- FIX for 100_: the 180-day recency filter yielded ZERO eligible prompts (all 486
-- in prompt_engagement were asked within 180 days), so the pool was dead code and
-- resolve fell straight through to the emergency prompt. Recency was also the wrong
-- signal -- v1 asked prompts PER GROUP, so an ask reached 2 of 48 users. Reach is the
-- real signal, and the pool now relaxes rather than returning empty.
-- Measured after: pool 0 -> 94; seeding 90 days gave 78 distinct prompts.
-- See docs/V2_PLAN.md.
-- =============================================================================

-- Rebuild the evergreen pool as a function so both resolve and seed share one
-- definition, with graceful relaxation when a strict filter would empty it.
--
-- Why relaxation is needed: every one of the 486 prompts in prompt_engagement was
-- asked within the last 180 days, so a hard recency cutoff yields an empty pool.
-- It is also the wrong signal — v1 asked prompts PER GROUP, so a prompt asked to a
-- 2-person group reached 2 of 48 users. Under v2's single global question that is
-- not "the audience has seen this". Reach, not recency, is the real signal.
CREATE OR REPLACE FUNCTION public.v2_evergreen_pool(
  as_of        date,
  recency_days int DEFAULT 180
)
RETURNS TABLE (id uuid, rn bigint)
LANGUAGE plpgsql STABLE AS $$
DECLARE n int;
BEGIN
  -- Tier 1: good engagement, not broadly seen recently, not already scheduled.
  RETURN QUERY
  WITH c AS (SELECT count(*)::numeric AS total FROM public.users),
  elig AS (
    SELECT e.id, e.answer_rate
    FROM public.prompt_engagement e, c
    WHERE NOT EXISTS (SELECT 1 FROM public.question_schedule q WHERE q.prompt_id = e.id)
      AND (
        e.last_asked IS NULL
        OR e.last_asked < as_of - recency_days
        -- reached under a fifth of the user base, so effectively unseen
        OR e.total_asked_people < greatest(c.total * 0.2, 5)
      )
  )
  SELECT elig.id, row_number() OVER (ORDER BY elig.answer_rate DESC, elig.id) - 1
  FROM elig;

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN RETURN; END IF;

  -- Tier 2: relax entirely to "not already scheduled". Repeating a well-liked
  -- question beats serving no question at all.
  RETURN QUERY
  WITH elig AS (
    SELECT e.id, e.answer_rate
    FROM public.prompt_engagement e
    WHERE NOT EXISTS (SELECT 1 FROM public.question_schedule q WHERE q.prompt_id = e.id)
  )
  SELECT elig.id, row_number() OVER (ORDER BY elig.answer_rate DESC, elig.id) - 1
  FROM elig;
END $$;

COMMENT ON FUNCTION public.v2_evergreen_pool(date, int) IS
  'v2: engagement-ranked fallback pool. Relaxes filters rather than returning empty.';

CREATE OR REPLACE FUNCTION public.resolve_question_for_date(d date)
RETURNS uuid LANGUAGE plpgsql STABLE AS $$
DECLARE result uuid; pool_size int;
BEGIN
  SELECT prompt_id INTO result FROM public.question_schedule WHERE date = d;
  IF result IS NOT NULL THEN RETURN result; END IF;

  SELECT count(*) INTO pool_size FROM public.v2_evergreen_pool(d);
  IF pool_size > 0 THEN
    SELECT p.id INTO result FROM public.v2_evergreen_pool(d) p
    WHERE p.rn = (abs(hashtext(d::text)) % pool_size);
  END IF;

  RETURN coalesce(result, public.v2_emergency_prompt_id());
END $$;

CREATE OR REPLACE FUNCTION public.v2_seed_question_schedule(from_date date, to_date date, actor uuid DEFAULT NULL)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE journal_id uuid; inserted int := 0;
BEGIN
  SELECT id INTO journal_id FROM public.prompts WHERE category = 'Journal' ORDER BY created_at LIMIT 1;
  IF journal_id IS NOT NULL THEN
    INSERT INTO public.question_schedule (date, prompt_id, created_by, notes)
    SELECT d::date, journal_id, actor, 'auto: sunday photo dump'
    FROM generate_series(from_date, to_date, '1 day') d
    WHERE extract(dow FROM d) = 0
    ON CONFLICT (date) DO NOTHING;
  END IF;

  WITH targets AS (
    SELECT d::date AS date, row_number() OVER (ORDER BY d) - 1 AS rn
    FROM generate_series(from_date, to_date, '1 day') d
    WHERE NOT EXISTS (SELECT 1 FROM public.question_schedule q WHERE q.date = d::date)
  ), ins AS (
    INSERT INTO public.question_schedule (date, prompt_id, created_by, notes)
    SELECT t.date, p.id, actor, 'auto: seeded by engagement'
    FROM targets t JOIN public.v2_evergreen_pool(from_date) p ON p.rn = t.rn
    ON CONFLICT (date) DO NOTHING RETURNING 1
  ) SELECT count(*) INTO inserted FROM ins;

  RETURN inserted;
END $$;;
