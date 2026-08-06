-- 128: message editing, reactor identities, and "X is in!" join events.
--
-- Covers four product asks plus one latent bug found on the way:
--   1. edit your own chat message in place (keeps its slot in the timeline)
--   2. reaction pills carry WHO reacted, not just a count
--   6. a member joining a group posts an inline system event
--   +  v2_on_message_insert announced EVERY system message as a birthday

-- ---------------------------------------------------------------------------
-- 1. Editing
-- ---------------------------------------------------------------------------

-- A dedicated column rather than reusing messages.updated_at: updated_at is a
-- generic "row changed" stamp that any future backfill or admin fix would move,
-- and "edited" is a claim we make to other people in the chat. It should only
-- ever be set by someone actually editing.
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- SECURITY DEFINER with an explicit author check, because RLS is off on this
-- database — a direct PostgREST .update() would let any client edit anyone's
-- message. The ownership test IS the access control here.
CREATE OR REPLACE FUNCTION public.v2_edit_message(
  p_message_id uuid,
  p_user_id uuid,
  p_text text DEFAULT NULL,
  p_media_urls text[] DEFAULT NULL,
  p_media_types text[] DEFAULT NULL,
  p_mentions uuid[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.messages;
BEGIN
  SELECT * INTO v_row FROM public.messages WHERE id = p_message_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_row.user_id IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_author');
  END IF;

  -- Chat only. An answer is edited through the composer, which also has to
  -- re-run transcription and fan out to answer_shares; routing it through here
  -- would silently skip both.
  IF v_row.kind <> 'chat' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_editable');
  END IF;

  -- Editing a message to nothing would leave an empty bubble that cannot be
  -- tapped to fix. Deleting is a separate action we do not offer yet.
  IF coalesce(btrim(p_text), '') = ''
     AND coalesce(array_length(p_media_urls, 1), 0) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty');
  END IF;

  -- created_at and reply_to_message_id are deliberately untouched: the ask is
  -- that an edit keeps its place and its reply context, not that it re-sends.
  UPDATE public.messages
     SET text        = p_text,
         media_urls  = p_media_urls,
         media_types = p_media_types,
         mentions    = coalesce(p_mentions, '{}'::uuid[]),
         edited_at   = now()
   WHERE id = p_message_id;

  RETURN jsonb_build_object('ok', true);
END $$;

GRANT EXECUTE ON FUNCTION public.v2_edit_message(uuid, uuid, text, text[], text[], uuid[])
  TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Latent bug: every system message announced itself as a birthday
-- ---------------------------------------------------------------------------
-- The system branch hard-coded birthday copy, so the join events added below
-- would have pushed "Jonty's birthday" to the whole group. Gate on the event.
CREATE OR REPLACE FUNCTION public.v2_on_message_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  member RECORD; target uuid; actor text; gname text; actor_avatar text;
BEGIN
  IF NEW.suppress_notify THEN RETURN NEW; END IF;
  SELECT coalesce(name,'Someone'), avatar_url INTO actor, actor_avatar
  FROM public.users WHERE id = NEW.user_id;
  SELECT coalesce(name,'your group') INTO gname FROM public.groups WHERE id = NEW.group_id;

  -- Addressed to one person: always delivered, muted or not.
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

  -- Named explicitly: always delivered, muted or not.
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
    ELSIF NEW.kind = 'system' AND NEW.system_payload->>'event' = 'birthday' THEN
      -- Ambient group event, so it stays muted.
      IF NOT public.v2_group_muted(member.user_id, NEW.group_id) THEN
        PERFORM public.v2_notify_now(member.user_id, 'birthday',
          coalesce(NEW.system_payload->>'name','Someone') || '''s birthday',
          'Say something in ' || gname,
          jsonb_build_object('type','birthday','group_id',NEW.group_id,'thread_date',NEW.thread_date));
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'v2_on_message_insert failed for message %: %', NEW.id, SQLERRM;
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
-- 6. "X is in!" — a join posts an inline system event
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.v2_emit_member_joined_message()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_name text; v_tz text; v_date date;
BEGIN
  -- Creating a group inserts its founder, and "Jaryd is in!" as the first line
  -- of your own new group reads like a bug. AFTER INSERT, so the count includes
  -- the row that fired this.
  IF (SELECT count(*) FROM public.group_members WHERE group_id = NEW.group_id) <= 1 THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(name,'Someone'), coalesce(timezone,'America/New_York')
    INTO v_name, v_tz
  FROM public.users WHERE id = NEW.user_id;

  -- The joiner's local date, not CURRENT_DATE. Threads are keyed by local day,
  -- so a 9pm ET join would otherwise land in tomorrow's thread — a day nobody
  -- is looking at yet.
  v_date := (now() AT TIME ZONE v_tz)::date;

  -- suppress_notify: queue_member_joined_notification already sends the
  -- "X joined your group" push. Without this the group gets two.
  INSERT INTO public.messages
    (group_id, thread_date, kind, system_payload, suppress_notify, created_at)
  VALUES (
    NEW.group_id, v_date, 'system',
    jsonb_build_object('event','member_joined','user_id',NEW.user_id,'name',v_name),
    true,
    coalesce(NEW.joined_at, now()));

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block a join over a decoration.
  RAISE WARNING 'v2_emit_member_joined_message failed for %/%: %',
    NEW.group_id, NEW.user_id, SQLERRM;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS v2_member_joined_message ON public.group_members;
CREATE TRIGGER v2_member_joined_message
AFTER INSERT ON public.group_members
FOR EACH ROW EXECUTE FUNCTION public.v2_emit_member_joined_message();

-- ---------------------------------------------------------------------------
-- 2. Reactor identities + the edited flag on the thread payload
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.v2_get_thread(p_group_id uuid, p_date date, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_locked boolean; v_prompt_id uuid; v_question text;
  v_group jsonb; v_messages jsonb; v_last_read timestamptz;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.group_members
                 WHERE group_id = p_group_id AND user_id = p_user_id) THEN
    RETURN jsonb_build_object('error','not_a_member');
  END IF;

  v_locked := public.v2_is_locked(p_user_id, p_date);
  v_prompt_id := public.v2_question_for_thread(p_group_id, p_date);
  SELECT question INTO v_question FROM public.prompts WHERE id = v_prompt_id;

  SELECT tr.last_read_at INTO v_last_read FROM public.thread_reads tr
  WHERE tr.user_id = p_user_id AND tr.group_id = p_group_id AND tr.thread_date = p_date;

  SELECT jsonb_build_object(
    'id', gr.id, 'name', gr.name,
    'member_count', (SELECT count(*) FROM public.group_members gm WHERE gm.group_id = gr.id),
    'answered_count', (SELECT count(*) FROM public.messages m
                       WHERE m.group_id = gr.id AND m.thread_date = p_date AND m.kind='answer'),
    'is_admin', EXISTS (SELECT 1 FROM public.group_members gm
                        WHERE gm.group_id = gr.id AND gm.user_id = p_user_id AND gm.role = 'admin'),
    'members', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                  'id', u.id, 'name', u.name, 'avatar_url', u.avatar_url,
                  'answered', EXISTS (SELECT 1 FROM public.messages mm
                                      WHERE mm.group_id = gr.id AND mm.thread_date = p_date
                                        AND mm.kind='answer' AND mm.user_id = u.id))), '[]'::jsonb)
                FROM public.group_members gm JOIN public.users u ON u.id = gm.user_id
                WHERE gm.group_id = gr.id))
  INTO v_group FROM public.groups gr WHERE gr.id = p_group_id;

  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at), '[]'::jsonb)
  INTO v_messages FROM (
    SELECT
      m.id, m.kind, m.created_at, m.thread_date, m.system_payload,
      (m.edited_at IS NOT NULL) AS edited,
      jsonb_build_object('id', u.id, 'name', u.name, 'avatar_url', u.avatar_url) AS author,
      CASE WHEN v_locked THEN NULL ELSE m.text END AS text,
      CASE WHEN v_locked THEN NULL ELSE m.media_urls END AS media_urls,
      CASE WHEN v_locked THEN NULL ELSE m.media_types END AS media_types,
      CASE WHEN v_locked THEN true ELSE false END AS redacted,
      CASE WHEN m.answer_id IS NOT NULL AND NOT v_locked THEN
        (SELECT jsonb_build_object('id', a.id, 'mode', a.mode,
                  'text_content', a.text_content, 'transcript', a.transcript,
                  'media_urls', a.media_urls, 'media_types', a.media_types,
                  'captions', a.captions, 'media_days', a.media_days,
                  'share_count', (SELECT count(*) FROM public.answer_shares s WHERE s.answer_id = a.id))
         FROM public.answers a WHERE a.id = m.answer_id)
      WHEN m.answer_id IS NOT NULL THEN jsonb_build_object('redacted', true)
      ELSE NULL END AS answer,
      CASE WHEN m.reply_to_message_id IS NOT NULL THEN
        (SELECT jsonb_build_object('id', rm.id,
                  'author', coalesce(ru.name,'Someone'),
                  'excerpt', coalesce(
                      nullif(left(coalesce(rm.text, ra.text_content, ''), 80), ''),
                      CASE
                        WHEN coalesce(rm.media_types, ra.media_types) @> ARRAY['video'] THEN 'Video'
                        WHEN coalesce(rm.media_types, ra.media_types) @> ARRAY['audio'] THEN 'Voice note'
                        WHEN coalesce(array_length(rm.media_urls,1), array_length(ra.media_urls,1)) > 0 THEN 'Photo'
                        ELSE ''
                      END),
                    'reply_media', (coalesce(rm.media_urls, ra.media_urls))[1],
                    'reply_media_type', (coalesce(rm.media_types, ra.media_types))[1])
         FROM public.messages rm
         LEFT JOIN public.users ru ON ru.id = rm.user_id
         LEFT JOIN public.answers ra ON ra.id = rm.answer_id
         WHERE rm.id = m.reply_to_message_id)
      ELSE NULL END AS reply_to,
      -- 'users' is new: a count alone loses the part people actually care about,
      -- which is WHO. Ordered by when they reacted so the pill is stable.
      (SELECT coalesce(jsonb_agg(r ORDER BY r.count DESC, r.emoji), '[]'::jsonb) FROM (
         SELECT mr.emoji, count(*) AS count,
                bool_or(mr.user_id = p_user_id) AS mine,
                jsonb_agg(jsonb_build_object(
                    'id', ru.id, 'name', ru.name, 'avatar_url', ru.avatar_url)
                  ORDER BY mr.created_at) AS users
         FROM public.message_reactions mr
         LEFT JOIN public.users ru ON ru.id = mr.user_id
         WHERE mr.message_id = m.id GROUP BY mr.emoji) r
      ) AS reactions
    FROM public.messages m
    LEFT JOIN public.users u ON u.id = m.user_id
    WHERE m.group_id = p_group_id AND m.thread_date = p_date
  ) x;

  RETURN jsonb_build_object(
    'group', v_group, 'date', p_date,
    'question', jsonb_build_object('prompt_id', v_prompt_id, 'text', v_question),
    'locked', v_locked, 'last_read_at', v_last_read, 'messages', v_messages);
END $$;
