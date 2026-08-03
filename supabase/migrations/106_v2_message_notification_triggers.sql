-- =============================================================================
-- v2_message_notification_triggers   (applied to production as migration 20260801162739)
-- =============================================================================
-- Exported from supabase_migrations.schema_migrations so the repo matches the
-- database exactly. ADDITIVE ONLY -- no v1 table is dropped or altered.
--
-- Verified by a rollback-wrapped functional test: two chat messages coalesced into
-- ONE digest row (event_count=2), a directed reply went instant, a reaction
-- digested, and suppress_notify produced zero notifications.
-- See docs/V2_PLAN.md.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.v2_on_message_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  member RECORD; target uuid; actor text; gname text;
BEGIN
  IF NEW.suppress_notify THEN RETURN NEW; END IF;
  SELECT coalesce(name,'Someone') INTO actor FROM public.users WHERE id = NEW.user_id;
  SELECT coalesce(name,'your group') INTO gname FROM public.groups WHERE id = NEW.group_id;

  IF NEW.reply_to_message_id IS NOT NULL THEN
    SELECT user_id INTO target FROM public.messages WHERE id = NEW.reply_to_message_id;
    IF target IS NOT NULL AND target <> NEW.user_id THEN
      PERFORM public.v2_notify_now(target, 'reply_to_you',
        actor || ' replied to you',
        coalesce(left(NEW.text, 120), 'Open the conversation'),
        jsonb_build_object('type','reply_to_you','group_id',NEW.group_id,
                           'thread_date',NEW.thread_date,'message_id',NEW.id));
    END IF;
  END IF;

  IF NEW.mentions IS NOT NULL AND array_length(NEW.mentions,1) > 0 THEN
    FOREACH target IN ARRAY NEW.mentions LOOP
      IF target <> NEW.user_id THEN
        PERFORM public.v2_notify_now(target, 'mention',
          actor || ' mentioned you in ' || gname, 'Open the conversation',
          jsonb_build_object('type','mention','group_id',NEW.group_id,
                             'thread_date',NEW.thread_date,'message_id',NEW.id));
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

DROP TRIGGER IF EXISTS v2_messages_notify ON public.messages;
CREATE TRIGGER v2_messages_notify AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.v2_on_message_insert();

CREATE OR REPLACE FUNCTION public.v2_on_reaction_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE m RECORD;
BEGIN
  SELECT group_id, thread_date, user_id INTO m FROM public.messages WHERE id = NEW.message_id;
  IF m.user_id IS NOT NULL AND m.user_id <> NEW.user_id THEN
    PERFORM public.v2_digest_add(m.user_id, m.group_id, m.thread_date, 'reaction', NEW.user_id);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'v2_on_reaction_insert failed: %', SQLERRM;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS v2_reactions_notify ON public.message_reactions;
CREATE TRIGGER v2_reactions_notify AFTER INSERT ON public.message_reactions
  FOR EACH ROW EXECUTE FUNCTION public.v2_on_reaction_insert();;
