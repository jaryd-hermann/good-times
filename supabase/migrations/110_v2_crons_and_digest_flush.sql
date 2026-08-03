-- =============================================================================
-- v2_crons_and_digest_flush   (applied to production as migration 20260801165641)
-- =============================================================================
-- Exported from supabase_migrations.schema_migrations so the repo matches the
-- database exactly. ADDITIVE ONLY -- no v1 table is dropped or altered.
--
-- v2-flush-digests runs every 2 minutes; a digest emits after 10 minutes of quiet
-- OR 5 events, so an active thread yields one push rather than one per event.
-- See docs/V2_PLAN.md.
-- =============================================================================

-- Flush ready digests into notification_queue.
-- A digest is ready after 10 minutes of quiet OR once it hits 5 events, so a
-- burst of activity produces one push rather than one per event.
CREATE OR REPLACE FUNCTION public.v2_flush_digests()
RETURNS int LANGUAGE plpgsql AS $$
DECLARE r RECORD; n int := 0; title text; body text; names text[]; gname text;
BEGIN
  FOR r IN
    SELECT * FROM public.notification_digest
    WHERE flushed_at IS NULL
      AND (last_event_at < now() - interval '10 minutes' OR event_count >= 5)
    LIMIT 200
  LOOP
    SELECT coalesce(name,'your group') INTO gname FROM public.groups WHERE id = r.group_id;
    SELECT array_agg(coalesce(u.name,'Someone')) INTO names
    FROM public.users u WHERE u.id = ANY(r.actor_ids);

    title := CASE
      WHEN array_length(names,1) = 1 THEN names[1]
      WHEN array_length(names,1) = 2 THEN names[1] || ' and ' || names[2]
      ELSE names[1] || ' and ' || (array_length(names,1) - 1) || ' others'
    END;

    body := CASE r.type
      WHEN 'new_answer'     THEN 'answered today''s question in ' || gname
      WHEN 'thread_message' THEN 'posted in ' || gname
      WHEN 'reaction'       THEN 'reacted to you in ' || gname
      ELSE 'were active in ' || gname
    END;

    INSERT INTO public.notification_queue (user_id, type, title, body, data)
    VALUES (r.user_id, r.type, title, body,
      jsonb_build_object('type', r.type, 'group_id', r.group_id,
                         'thread_date', r.thread_date, 'count', r.event_count));

    UPDATE public.notification_digest SET flushed_at = now() WHERE id = r.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

COMMENT ON FUNCTION public.v2_flush_digests() IS
  'v2: composes coalesced digests into pushes. 10-minute quiet window or 5 events.';

-- Crons. Named v2_* so they are easy to find and drop.
SELECT cron.schedule('v2-flush-digests', '*/2 * * * *', $cron$ SELECT public.v2_flush_digests(); $cron$);
SELECT cron.schedule('v2-emit-birthdays', '5 0 * * *', $cron$ SELECT public.v2_emit_birthday_messages(CURRENT_DATE); $cron$);
SELECT cron.schedule('v2-refresh-engagement', '20 0 * * *', $cron$ SELECT public.v2_refresh_prompt_engagement(); $cron$);
SELECT cron.schedule('v2-autofill-schedule', '30 0 * * *',
  $cron$ SELECT public.v2_seed_question_schedule(CURRENT_DATE, CURRENT_DATE + 60, NULL); $cron$);;
