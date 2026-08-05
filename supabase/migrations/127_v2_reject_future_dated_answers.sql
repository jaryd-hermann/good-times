-- =============================================================================
-- An answer can never belong to a day that has not happened yet
-- (applied via MCP as v2_reject_future_dated_answers)
-- =============================================================================
-- One answer was filed under 2026-08-05 while its author's local date was still
-- 2026-08-04 — created 23:01 New York, which is 03:01 UTC. It is the ONLY
-- future-dated answer in the table; every other date mismatch is a NEGATIVE
-- offset, i.e. a legitimate backfill through the day picker.
--
-- answers.date is NOT NULL with no column default, so nothing server-side invents
-- it — the client supplied tomorrow. Rather than guess at which client state did
-- that, refuse the write: a future-dated answer is never correct, it hides the
-- real question from the person who wrote it, and it fans out to every group
-- under the wrong day.
--
-- One day of slack against the user's own timezone, so someone in Auckland
-- writing a perfectly valid answer is not rejected.
--
-- Verified in a rolled-back transaction: backfill (-3 days) accepted, tomorrow
-- (+1, the tz slack) accepted, +5 days refused.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.v2_reject_future_answer()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE v_local_date date;
BEGIN
  BEGIN
    SELECT (now() AT TIME ZONE coalesce(u.timezone, 'UTC'))::date
      INTO v_local_date
    FROM public.users u WHERE u.id = NEW.user_id;
  EXCEPTION WHEN OTHERS THEN
    v_local_date := (now() AT TIME ZONE 'UTC')::date;
  END;

  IF v_local_date IS NOT NULL AND NEW.date > v_local_date + 1 THEN
    RAISE EXCEPTION 'answer date % is in the future (user local date %)',
      NEW.date, v_local_date;
  END IF;

  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS v2_answers_reject_future ON public.answers;
CREATE TRIGGER v2_answers_reject_future
  BEFORE INSERT OR UPDATE OF date ON public.answers
  FOR EACH ROW EXECUTE FUNCTION public.v2_reject_future_answer();
