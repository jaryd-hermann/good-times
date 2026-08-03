-- =============================================================================
-- v2 notifications: richer content + local-time scheduling
-- =============================================================================
-- Additive. No v1 sender, trigger or cron is touched — v1 is the shipped app and
-- its users must keep receiving notifications until cutover.
--
-- Three things here:
--   1. Digest + instant payloads carry the actor's avatar and a real preview.
--   2. The daily question fires at 08:00 in each user's OWN timezone.
--   3. A 14:00-local nudge when nobody in a group has answered yet.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Digest flush: name the actor, quote what they said, carry their avatar.
-- ---------------------------------------------------------------------------
-- Previously: title "Elliot", body "answered today's question in The Boys".
-- The avatar is passed as data.actor_avatar; process-notification-queue maps it
-- to OneSignal's large_icon / ios_attachments so the sender's face is shown.
CREATE OR REPLACE FUNCTION public.v2_flush_digests()
RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE
  r RECORD; n int := 0; title text; body text; names text[]; gname text;
  avatar text; preview text;
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

    -- Only meaningful for a single actor; a group digest shows the app icon.
    SELECT u.avatar_url INTO avatar
    FROM public.users u WHERE u.id = r.actor_ids[1];
    IF array_length(r.actor_ids,1) > 1 THEN avatar := NULL; END IF;

    -- The newest thing said in this thread by one of the actors, so the push
    -- shows the content rather than only announcing that content exists.
    SELECT left(coalesce(m.text, a.text_content, a.transcript, ''), 140)
      INTO preview
    FROM public.messages m
    LEFT JOIN public.answers a ON a.id = m.answer_id
    WHERE m.group_id = r.group_id
      AND m.thread_date = r.thread_date
      AND m.user_id = ANY(r.actor_ids)
      AND NOT m.suppress_notify
    ORDER BY m.created_at DESC
    LIMIT 1;

    title := CASE
      WHEN array_length(names,1) = 1 THEN names[1]
      WHEN array_length(names,1) = 2 THEN names[1] || ' and ' || names[2]
      ELSE names[1] || ' and ' || (array_length(names,1) - 1) || ' others'
    END;

    body := CASE r.type
      WHEN 'new_answer' THEN
        CASE WHEN array_length(names,1) = 1
             THEN 'answered today''s question — see what they said'
             ELSE 'answered today''s question in ' || gname END
      WHEN 'thread_message' THEN
        coalesce(nullif(preview,''), 'posted in ' || gname)
      WHEN 'reaction' THEN 'reacted to you in ' || gname
      ELSE 'were active in ' || gname
    END;

    INSERT INTO public.notification_queue (user_id, type, title, body, data)
    VALUES (r.user_id, r.type, title, body,
      jsonb_build_object('type', r.type, 'group_id', r.group_id,
                         'thread_date', r.thread_date, 'count', r.event_count,
                         'actor_avatar', avatar, 'preview', preview));

    UPDATE public.notification_digest SET flushed_at = now() WHERE id = r.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END $function$;

-- ---------------------------------------------------------------------------
-- 2. Instant notifications carry the actor's avatar too.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.v2_on_message_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  member RECORD; target uuid; actor text; gname text; actor_avatar text;
BEGIN
  IF NEW.suppress_notify THEN RETURN NEW; END IF;
  SELECT coalesce(name,'Someone'), avatar_url INTO actor, actor_avatar
  FROM public.users WHERE id = NEW.user_id;
  SELECT coalesce(name,'your group') INTO gname FROM public.groups WHERE id = NEW.group_id;

  IF NEW.reply_to_message_id IS NOT NULL THEN
    SELECT user_id INTO target FROM public.messages WHERE id = NEW.reply_to_message_id;
    IF target IS NOT NULL AND target <> NEW.user_id THEN
      PERFORM public.v2_notify_now(target, 'reply_to_you',
        actor || ' replied to you',
        coalesce(left(NEW.text, 140), 'Open the conversation'),
        jsonb_build_object('type','reply_to_you','group_id',NEW.group_id,
                           'thread_date',NEW.thread_date,'message_id',NEW.id,
                           'actor_avatar',actor_avatar));
    END IF;
  END IF;

  IF NEW.mentions IS NOT NULL AND array_length(NEW.mentions,1) > 0 THEN
    FOREACH target IN ARRAY NEW.mentions LOOP
      IF target <> NEW.user_id THEN
        PERFORM public.v2_notify_now(target, 'mention',
          actor || ' mentioned you in ' || gname,
          coalesce(left(NEW.text, 140), 'Open the conversation'),
          jsonb_build_object('type','mention','group_id',NEW.group_id,
                             'thread_date',NEW.thread_date,'message_id',NEW.id,
                             'actor_avatar',actor_avatar));
      END IF;
    END LOOP;
  END IF;

  FOR member IN
    SELECT gm.user_id FROM public.group_members gm
    WHERE gm.group_id = NEW.group_id
      AND gm.user_id IS DISTINCT FROM NEW.user_id
  LOOP
    IF NEW.kind = 'answer' THEN
      PERFORM public.v2_digest_add(member.user_id, NEW.group_id, NEW.thread_date, 'new_answer', NEW.user_id);
    ELSIF NEW.kind = 'chat' AND NEW.reply_to_message_id IS NULL THEN
      PERFORM public.v2_digest_add(member.user_id, NEW.group_id, NEW.thread_date, 'thread_message', NEW.user_id);
    ELSIF NEW.kind = 'system' THEN
      PERFORM public.v2_notify_now(member.user_id, 'birthday',
        coalesce(NEW.system_payload->>'name','Someone') || '''s birthday',
        'Say something in ' || gname,
        jsonb_build_object('type','birthday','group_id',NEW.group_id,'thread_date',NEW.thread_date));
    END IF;
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'v2_on_message_insert failed for message %: %', NEW.id, SQLERRM;
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Daily question at 08:00 LOCAL.
-- ---------------------------------------------------------------------------
-- v1 hardcodes "8 AM EST = 13:00 UTC (fixed offset, no DST handling)", so London
-- got it at 2pm and everyone drifted an hour twice a year. Every user has a
-- timezone; this uses it, and the question is looked up for the user's OWN local
-- date rather than the server's.
--
-- Called hourly. The hour comparison is what makes it fire once per user per day;
-- the queue check makes a re-run within the same hour a no-op.
CREATE OR REPLACE FUNCTION public.v2_queue_daily_question(p_local_hour int DEFAULT 8)
RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE u RECORD; n int := 0; v_local_date date; v_local_hour int;
        v_prompt uuid; v_text text;
BEGIN
  FOR u IN
    SELECT usr.id, usr.timezone
    FROM public.users usr
    WHERE usr.timezone IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.user_id = usr.id)
  LOOP
    -- Resolve the local clock first. A bad tz string raises, and one bad row must
    -- not abort the run for everyone else.
    v_local_date := NULL; v_local_hour := NULL;
    BEGIN
      v_local_date := (now() AT TIME ZONE u.timezone)::date;
      v_local_hour := EXTRACT(HOUR FROM (now() AT TIME ZONE u.timezone))::int;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'v2_queue_daily_question: bad timezone % for user %', u.timezone, u.id;
    END;

    IF v_local_hour IS DISTINCT FROM p_local_hour THEN CONTINUE; END IF;

    -- Already answered their own local day.
    IF EXISTS (SELECT 1 FROM public.answers a
               WHERE a.user_id = u.id AND a.date = v_local_date) THEN
      CONTINUE;
    END IF;

    SELECT qs.prompt_id, p.question INTO v_prompt, v_text
    FROM public.question_schedule qs
    JOIN public.prompts p ON p.id = qs.prompt_id
    WHERE qs.date = v_local_date;
    IF v_prompt IS NULL THEN CONTINUE; END IF;

    -- Idempotent: safe to run hourly, and safe to re-run within the hour.
    IF EXISTS (SELECT 1 FROM public.notification_queue nq
               WHERE nq.user_id = u.id AND nq.type = 'v2_daily_question'
                 AND nq.data->>'date' = v_local_date::text) THEN
      CONTINUE;
    END IF;

    PERFORM public.v2_notify_now(u.id, 'v2_daily_question',
      'Today''s question', v_text,
      jsonb_build_object('type','v2_daily_question','prompt_id',v_prompt,
                         'date', v_local_date));
    n := n + 1;
  END LOOP;
  RETURN n;
END $function$;

-- ---------------------------------------------------------------------------
-- 4. 14:00-LOCAL nudge when nobody in the group has answered.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.v2_queue_unanswered_nudge(p_local_hour int DEFAULT 14)
RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE u RECORD; g RECORD; n int := 0; v_local_date date; v_local_hour int;
BEGIN
  FOR u IN
    SELECT usr.id, usr.timezone, coalesce(usr.name,'Hey') AS uname
    FROM public.users usr
    WHERE usr.timezone IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.user_id = usr.id)
  LOOP
    v_local_date := NULL; v_local_hour := NULL;
    BEGIN
      v_local_date := (now() AT TIME ZONE u.timezone)::date;
      v_local_hour := EXTRACT(HOUR FROM (now() AT TIME ZONE u.timezone))::int;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'v2_queue_unanswered_nudge: bad timezone % for user %', u.timezone, u.id;
    END;

    IF v_local_hour IS DISTINCT FROM p_local_hour THEN CONTINUE; END IF;

    FOR g IN
      SELECT gm.group_id
      FROM public.group_members gm
      WHERE gm.user_id = u.id
        -- "Nobody" means nobody: no answer shared into this group today by
        -- anyone. If someone has answered, there is nothing to kick off.
        AND NOT EXISTS (
          SELECT 1 FROM public.answer_shares s
          JOIN public.answers a ON a.id = s.answer_id
          WHERE s.group_id = gm.group_id AND a.date = v_local_date
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.notification_queue nq
          WHERE nq.user_id = u.id AND nq.type = 'v2_first_answer_nudge'
            AND nq.data->>'group_id' = gm.group_id::text
            AND nq.data->>'date' = v_local_date::text
        )
    LOOP
      PERFORM public.v2_notify_now(u.id, 'v2_first_answer_nudge',
        'Nobody has answered yet',
        u.uname || ', be the first to answer today''s question and get your group going!',
        jsonb_build_object('type','v2_first_answer_nudge','group_id',g.group_id,
                           'date', v_local_date));
      n := n + 1;
    END LOOP;
  END LOOP;
  RETURN n;
END $function$;
