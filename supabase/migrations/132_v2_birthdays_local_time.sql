-- 132: birthdays fire on the birthday person's day, and no thread from the
-- future is ever listed.
--
-- v2_emit_birthday_messages(CURRENT_DATE) ran once at 00:05 UTC and used the
-- UTC date for BOTH the birthday match and thread_date. For a Los Angeles user
-- that fires at 17:05 the day BEFORE their birthday, so the "wish X happy
-- birthday" push went out ~7 hours early — and because the message was stamped
-- with tomorrow's date it materialised a thread for a day that had not started,
-- which surfaced the next question in History early. One cause, two symptoms.

DROP FUNCTION IF EXISTS public.v2_emit_birthday_messages(date);

-- Same shape as v2_queue_daily_question: walk users, compute their local clock,
-- act only at the target local hour. 8am local matches the daily question, so
-- the banner arrives with the rest of someone's morning rather than at whatever
-- moment midnight-UTC happens to be where they live.
CREATE OR REPLACE FUNCTION public.v2_emit_birthday_messages(p_local_hour integer DEFAULT 8)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  u RECORD; n int := 0; c int;
  v_local_date date; v_local_hour int;
BEGIN
  FOR u IN
    SELECT usr.id, usr.timezone, coalesce(usr.name,'Someone') AS nm, usr.birthday
    FROM public.users usr
    WHERE usr.birthday IS NOT NULL
      AND usr.timezone IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.user_id = usr.id)
  LOOP
    v_local_date := NULL; v_local_hour := NULL;
    BEGIN
      v_local_date := (now() AT TIME ZONE u.timezone)::date;
      v_local_hour := EXTRACT(HOUR FROM (now() AT TIME ZONE u.timezone))::int;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'v2_emit_birthday_messages: bad timezone % for user %', u.timezone, u.id;
    END;

    IF v_local_hour IS DISTINCT FROM p_local_hour THEN CONTINUE; END IF;
    -- Their birthday in THEIR calendar, not the server's.
    IF to_char(u.birthday,'MM-DD') IS DISTINCT FROM to_char(v_local_date,'MM-DD') THEN
      CONTINUE;
    END IF;

    INSERT INTO public.messages (group_id, thread_date, kind, system_payload, created_at)
    SELECT gm.group_id, v_local_date, 'system',
           jsonb_build_object('event','birthday','user_id',u.id,'name',u.nm),
           now()
    FROM public.group_members gm
    WHERE gm.user_id = u.id
      AND NOT EXISTS (
        SELECT 1 FROM public.messages m
        WHERE m.group_id = gm.group_id AND m.thread_date = v_local_date
          AND m.kind = 'system'
          AND m.system_payload->>'event' = 'birthday'
          AND m.system_payload->>'user_id' = u.id::text);

    GET DIAGNOSTICS c = ROW_COUNT;
    n := n + c;
  END LOOP;
  RETURN n;
END $$;

-- Every 30 minutes so each timezone gets its own 8am, replacing the single
-- 00:05 UTC run. Same cadence as the other v2 local-hour jobs.
DO $$
DECLARE v_id bigint;
BEGIN
  SELECT jobid INTO v_id FROM cron.job WHERE jobname = 'v2-emit-birthdays';
  IF v_id IS NOT NULL THEN
    PERFORM cron.alter_job(v_id,
      schedule := '*/30 * * * *',
      command  := 'SELECT public.v2_emit_birthday_messages(8);');
  END IF;
END $$;

-- Belt and braces: never surface a thread dated after the VIEWER's own today,
-- whatever put it there. The birthday cron was one way to create a future
-- thread; this closes the class. It matters because v2_reject_future_answer
-- tolerates +1 day for timezone skew, so a visible tomorrow-thread was
-- genuinely answerable early.
--
-- Only the WHERE clause changes from the previous definition; the body is
-- reproduced in full because a SQL function cannot be patched in place.
CREATE OR REPLACE FUNCTION public.v2_get_history(
  p_user_id uuid, p_group_id uuid DEFAULT NULL::uuid,
  p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date,
  p_unseen_only boolean DEFAULT false,
  p_limit integer DEFAULT 30, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE AS $function$
  SELECT coalesce(jsonb_agg(to_jsonb(h) ORDER BY h.thread_date DESC, h.group_name), '[]'::jsonb)
  FROM (
    SELECT
      m.group_id, gr.name AS group_name, m.thread_date,
      (SELECT p.question FROM public.prompts p
        WHERE p.id = public.v2_question_for_thread(m.group_id, m.thread_date)) AS question,
      count(*) FILTER (WHERE m.kind = 'answer') AS answer_count,
      count(*) FILTER (WHERE m.kind = 'chat')   AS message_count,
      count(*) FILTER (WHERE m.kind = 'answer'
        AND 'video' = ANY(coalesce(
          (SELECT a.media_types FROM public.answers a WHERE a.id = m.answer_id), '{}'))) AS video_count,
      (SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY g.total DESC), '[]'::jsonb) FROM (
         SELECT u.id AS user_id, coalesce(u.name,'Someone') AS name, u.avatar_url,
                (array_agg(mu.url ORDER BY mu.ord))[1:3] AS urls,
                count(*)::int AS total
         FROM public.messages m2
         JOIN public.answers a ON a.id = m2.answer_id
         JOIN public.users u ON u.id = a.user_id
         CROSS JOIN LATERAL unnest(a.media_urls) WITH ORDINALITY AS mu(url, ord)
         WHERE m2.group_id = m.group_id AND m2.thread_date = m.thread_date
           AND m2.kind = 'answer' AND a.media_urls IS NOT NULL
         GROUP BY u.id, u.name, u.avatar_url
       ) g) AS preview_people,
      max(m.created_at) AS last_activity,
      (SELECT jsonb_build_object('author', coalesce(u.name,'Someone'),
                                 'text', left(coalesce(mm.text,''), 90))
         FROM public.messages mm LEFT JOIN public.users u ON u.id = mm.user_id
        WHERE mm.group_id = m.group_id AND mm.thread_date = m.thread_date
        ORDER BY mm.created_at DESC LIMIT 1) AS last_message,
      count(*) FILTER (
        WHERE m.user_id IS DISTINCT FROM p_user_id
          AND m.created_at > coalesce(
            (SELECT tr.last_read_at FROM public.thread_reads tr
             WHERE tr.user_id = p_user_id AND tr.group_id = m.group_id
               AND tr.thread_date = m.thread_date), 'epoch'::timestamptz)) AS unread_count
    FROM public.messages m
    JOIN public.groups gr ON gr.id = m.group_id
    JOIN public.group_members gm ON gm.group_id = m.group_id AND gm.user_id = p_user_id
    WHERE (p_group_id IS NULL OR m.group_id = p_group_id)
      AND (p_from IS NULL OR m.thread_date >= p_from)
      AND (p_to   IS NULL OR m.thread_date <= p_to)
      AND m.thread_date <= (now() AT TIME ZONE coalesce(
            (SELECT usr.timezone FROM public.users usr WHERE usr.id = p_user_id),
            'America/New_York'))::date
    GROUP BY m.group_id, gr.name, m.thread_date
    HAVING NOT p_unseen_only OR count(*) FILTER (
        WHERE m.user_id IS DISTINCT FROM p_user_id
          AND m.created_at > coalesce(
            (SELECT tr.last_read_at FROM public.thread_reads tr
             WHERE tr.user_id = p_user_id AND tr.group_id = m.group_id
               AND tr.thread_date = m.thread_date), 'epoch'::timestamptz)) > 0
    ORDER BY m.thread_date DESC, gr.name
    LIMIT p_limit OFFSET p_offset
  ) h;
$function$;

-- Clean up what the old cron already emitted: birthday banners stamped with a
-- date that has not arrived yet in the birthday person's own timezone. Scoped
-- so it is a no-op on a database that never ran the buggy version, and so the
-- corrected cron is free to re-emit them at the right local hour.
DELETE FROM public.messages m
USING public.users u
WHERE m.kind = 'system'
  AND m.system_payload->>'event' = 'birthday'
  AND u.id = (m.system_payload->>'user_id')::uuid
  AND m.thread_date > (now() AT TIME ZONE coalesce(u.timezone,'America/New_York'))::date;
