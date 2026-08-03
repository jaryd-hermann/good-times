-- =============================================================================
-- v2_question_schedule   (applied to production as migration 20260801162154)
-- =============================================================================
-- Exported from supabase_migrations.schema_migrations so the repo matches the
-- database exactly. ADDITIVE ONLY -- no v1 table is dropped or altered.
-- See docs/V2_PLAN.md.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.question_schedule (
  date       date PRIMARY KEY,
  prompt_id  uuid NOT NULL REFERENCES public.prompts(id) ON DELETE RESTRICT,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  notes      text
);
CREATE INDEX IF NOT EXISTS idx_question_schedule_prompt ON public.question_schedule (prompt_id);
COMMENT ON TABLE public.question_schedule IS 'v2: one global question per calendar date. Hand-curated via the admin portal.';

DROP MATERIALIZED VIEW IF EXISTS public.prompt_engagement CASCADE;
CREATE MATERIALIZED VIEW public.prompt_engagement AS
SELECT p.id, p.question, p.category,
  sum(s.answers_count)::numeric / nullif(sum(s.group_size_at_time), 0) AS answer_rate,
  sum(s.answers_count)::bigint AS total_answers,
  sum(s.group_size_at_time)::bigint AS total_asked_people,
  count(*)::bigint AS times_asked,
  max(s.date) AS last_asked
FROM public.prompts p
JOIN public.prompt_usage_stats s ON s.prompt_id = p.id
WHERE p.category = 'Standard'
GROUP BY p.id, p.question, p.category
HAVING count(*) >= 3;
CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_engagement_id ON public.prompt_engagement (id);
CREATE INDEX IF NOT EXISTS idx_prompt_engagement_rate ON public.prompt_engagement (answer_rate DESC NULLS LAST);
COMMENT ON MATERIALIZED VIEW public.prompt_engagement IS 'v2: measured answer rate per prompt (answers / people asked), min 3 asks. Refresh nightly.';

CREATE OR REPLACE FUNCTION public.v2_emergency_prompt_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT id FROM public.prompts WHERE category = 'Standard'
  ORDER BY coalesce(total_answered_count, 0) DESC, created_at ASC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.resolve_question_for_date(d date)
RETURNS uuid LANGUAGE plpgsql STABLE AS $$
DECLARE result uuid; pool_size int;
BEGIN
  SELECT prompt_id INTO result FROM public.question_schedule WHERE date = d;
  IF result IS NOT NULL THEN RETURN result; END IF;
  WITH pool AS (
    SELECT e.id, row_number() OVER (ORDER BY e.answer_rate DESC, e.id) - 1 AS rn
    FROM public.prompt_engagement e
    WHERE (e.last_asked IS NULL OR e.last_asked < d - 180)
      AND NOT EXISTS (SELECT 1 FROM public.question_schedule q WHERE q.prompt_id = e.id)
  ) SELECT count(*) INTO pool_size FROM pool;
  IF pool_size > 0 THEN
    WITH pool AS (
      SELECT e.id, row_number() OVER (ORDER BY e.answer_rate DESC, e.id) - 1 AS rn
      FROM public.prompt_engagement e
      WHERE (e.last_asked IS NULL OR e.last_asked < d - 180)
        AND NOT EXISTS (SELECT 1 FROM public.question_schedule q WHERE q.prompt_id = e.id)
    ) SELECT id INTO result FROM pool WHERE rn = (abs(hashtext(d::text)) % pool_size);
  END IF;
  RETURN coalesce(result, public.v2_emergency_prompt_id());
END $$;
COMMENT ON FUNCTION public.resolve_question_for_date(date) IS 'v2: resolves the global question for a date. Schedule -> evergreen pool -> emergency. Never returns null.';

CREATE OR REPLACE FUNCTION public.v2_unscheduled_dates(days_ahead int DEFAULT 7)
RETURNS TABLE (date date) LANGUAGE sql STABLE AS $$
  SELECT d::date FROM generate_series(CURRENT_DATE, CURRENT_DATE + days_ahead, '1 day') d
  WHERE NOT EXISTS (SELECT 1 FROM public.question_schedule q WHERE q.date = d::date)
  ORDER BY 1;
$$;

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
  ), pool AS (
    SELECT e.id, row_number() OVER (ORDER BY e.answer_rate DESC, e.id) - 1 AS rn
    FROM public.prompt_engagement e
    WHERE (e.last_asked IS NULL OR e.last_asked < from_date - 180)
      AND NOT EXISTS (SELECT 1 FROM public.question_schedule q WHERE q.prompt_id = e.id)
  ), ins AS (
    INSERT INTO public.question_schedule (date, prompt_id, created_by, notes)
    SELECT t.date, p.id, actor, 'auto: seeded by engagement'
    FROM targets t JOIN pool p ON p.rn = t.rn
    ON CONFLICT (date) DO NOTHING RETURNING 1
  ) SELECT count(*) INTO inserted FROM ins;
  RETURN inserted;
END $$;
COMMENT ON FUNCTION public.v2_seed_question_schedule(date, date, uuid) IS 'v2: fills unscheduled dates from the engagement-ranked evergreen pool. Never overwrites.';;
