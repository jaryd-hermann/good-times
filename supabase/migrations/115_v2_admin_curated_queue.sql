-- =============================================================================
-- v2_admin_curated_queue
-- =============================================================================
-- Shifts the global question queue to a HUMAN-CURATED model:
--   * v2_admin_add_question(text, date) creates a prompt and schedules it on a
--     specific date, or on the soonest free weekday when no date is given.
--   * the daily engagement-autofill cron is removed so weekdays are left empty
--     for a curator to fill; empty days still resolve to a read-time fallback
--     via resolve_question_for_date(), so the app never shows nothing.
--   * Sundays stay pinned to the photo dump via a dedicated, narrow cron.
--   * existing future auto-seeded (non-Sunday) rows are cleared so the queue
--     reflects only curated questions going forward.
--
-- ADDITIVE + a targeted cleanup of auto-generated rows only. No user data or v1
-- table is touched. See docs/V2_PLAN.md.
-- =============================================================================

-- ---- add a curated question ------------------------------------------------
-- p_date NULL  -> soonest free, non-Sunday day starting tomorrow (the next slot)
-- p_date given -> that exact date (holidays, themed days, etc.)
-- An 'auto:%' row (fallback/photo-dump seed) counts as free and is overwritten.
CREATE OR REPLACE FUNCTION public.v2_admin_add_question(
  p_question text,
  p_date     date DEFAULT NULL,
  p_actor    uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_q      text := btrim(p_question);
  v_prompt uuid;
  v_date   date;
BEGIN
  IF v_q IS NULL OR length(v_q) < 3 THEN
    RETURN jsonb_build_object('error', 'Question is too short');
  END IF;

  -- Reuse an identical prompt if one already exists, otherwise create it.
  SELECT id INTO v_prompt FROM public.prompts
  WHERE lower(btrim(question)) = lower(v_q) AND category = 'Standard'
  ORDER BY created_at LIMIT 1;

  IF v_prompt IS NULL THEN
    INSERT INTO public.prompts (question, category)
    VALUES (v_q, 'Standard')
    RETURNING id INTO v_prompt;
  END IF;

  IF p_date IS NOT NULL THEN
    IF p_date < CURRENT_DATE THEN
      RETURN jsonb_build_object('error', 'Cannot schedule a date in the past');
    END IF;
    v_date := p_date;
  ELSE
    SELECT d::date INTO v_date
    FROM generate_series(CURRENT_DATE + 1, CURRENT_DATE + 400, '1 day') d
    WHERE extract(dow FROM d) <> 0
      AND NOT EXISTS (
        SELECT 1 FROM public.question_schedule q
        WHERE q.date = d::date AND coalesce(q.notes, '') NOT LIKE 'auto%'
      )
    ORDER BY d
    LIMIT 1;
  END IF;

  INSERT INTO public.question_schedule (date, prompt_id, created_by, notes, updated_at)
  VALUES (v_date, v_prompt, p_actor, 'manual', now())
  ON CONFLICT (date) DO UPDATE
    SET prompt_id  = excluded.prompt_id,
        created_by = excluded.created_by,
        notes      = 'manual',
        updated_at = now();

  RETURN jsonb_build_object('prompt_id', v_prompt, 'date', v_date, 'assigned', true);
END $$;

COMMENT ON FUNCTION public.v2_admin_add_question(text, date, uuid) IS
  'v2: create + schedule a curated question. Explicit date, else the soonest free weekday.';

-- ---- Sunday photo-dump pin (kept; weekday seeding is dropped) ---------------
CREATE OR REPLACE FUNCTION public.v2_pin_sundays(from_date date, to_date date)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE journal_id uuid; inserted int := 0;
BEGIN
  SELECT id INTO journal_id FROM public.prompts
  WHERE category = 'Journal' ORDER BY created_at LIMIT 1;
  IF journal_id IS NULL THEN RETURN 0; END IF;

  WITH ins AS (
    INSERT INTO public.question_schedule (date, prompt_id, notes)
    SELECT d::date, journal_id, 'auto: sunday photo dump'
    FROM generate_series(from_date, to_date, '1 day') d
    WHERE extract(dow FROM d) = 0
    ON CONFLICT (date) DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO inserted FROM ins;
  RETURN inserted;
END $$;

COMMENT ON FUNCTION public.v2_pin_sundays(date, date) IS
  'v2: pins Sundays to the photo-dump Journal prompt. Never overwrites a curated date.';

-- ---- cron changes ----------------------------------------------------------
-- Drop the engagement autofill so weekdays stay empty until curated. Use
-- cron.unschedule() (SECURITY DEFINER) rather than DELETE FROM cron.job, which
-- the SQL-editor role has no privilege on. Guarded so a re-run never errors.
DO $$
BEGIN
  PERFORM cron.unschedule('v2-autofill-schedule');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'v2-autofill-schedule already removed: %', SQLERRM;
END $$;

-- Pin Sundays every night (narrow: touches only Sundays, never weekdays).
SELECT cron.schedule('v2-pin-sundays', '30 0 * * *',
  $cron$ SELECT public.v2_pin_sundays(CURRENT_DATE, CURRENT_DATE + 60); $cron$);

-- ---- clean up previously auto-seeded weekdays ------------------------------
-- Only removes machine-seeded engagement rows from today forward; curated
-- ('manual') rows and Sunday photo-dump pins are left untouched.
DELETE FROM public.question_schedule
WHERE date >= CURRENT_DATE
  AND notes = 'auto: seeded by engagement';
