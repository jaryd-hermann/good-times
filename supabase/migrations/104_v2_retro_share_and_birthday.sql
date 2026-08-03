-- =============================================================================
-- v2_retro_share_and_birthday   (applied to production as migration 20260801162706)
-- =============================================================================
-- Exported from supabase_migrations.schema_migrations so the repo matches the
-- database exactly. ADDITIVE ONLY -- no v1 table is dropped or altered.
--
-- Includes the birthday data cleanup: 11 of 45 birthdays were the silent
-- about.tsx picker default (1969-03-15 / -14) and would have fired fake birthday
-- banners across 14 of 26 groups every March. Those are set to NULL here.
-- See docs/V2_PLAN.md.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.v2_retro_share_answers(p_user_id uuid, p_group_id uuid)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE n int := 0;
BEGIN
  WITH unshared AS (
    SELECT a.id, a.date, a.created_at, a.mentions
    FROM public.answers a
    WHERE a.user_id = p_user_id
      AND NOT EXISTS (SELECT 1 FROM public.answer_shares s WHERE s.answer_id = a.id)
  ), ins_share AS (
    INSERT INTO public.answer_shares (answer_id, group_id, shared_at)
    SELECT id, p_group_id, now() FROM unshared
    ON CONFLICT (answer_id, group_id) DO NOTHING
    RETURNING answer_id
  )
  INSERT INTO public.messages (group_id, thread_date, kind, user_id, answer_id,
                               mentions, suppress_notify, created_at)
  SELECT p_group_id, u.date, 'answer', p_user_id, u.id, u.mentions, true, u.created_at
  FROM unshared u JOIN ins_share s ON s.answer_id = u.id
  ON CONFLICT (answer_id, group_id) WHERE answer_id IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.v2_group_join_retro_share()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.v2_retro_share_answers(NEW.user_id, NEW.group_id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'v2 retro-share failed for user % group %: %', NEW.user_id, NEW.group_id, SQLERRM;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS v2_on_group_join_retro_share ON public.group_members;
CREATE TRIGGER v2_on_group_join_retro_share
  AFTER INSERT ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.v2_group_join_retro_share();

UPDATE public.users SET birthday = NULL
WHERE birthday IN (DATE '1969-03-15', DATE '1969-03-14');

CREATE OR REPLACE FUNCTION public.v2_emit_birthday_messages(d date DEFAULT CURRENT_DATE)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE n int := 0;
BEGIN
  WITH ins AS (
    INSERT INTO public.messages (group_id, thread_date, kind, system_payload, created_at)
    SELECT gm.group_id, d, 'system',
           jsonb_build_object('event','birthday','user_id',u.id,'name',coalesce(u.name,'Someone')),
           now()
    FROM public.group_members gm
    JOIN public.users u ON u.id = gm.user_id
    WHERE u.birthday IS NOT NULL
      AND to_char(u.birthday,'MM-DD') = to_char(d,'MM-DD')
      AND NOT EXISTS (
        SELECT 1 FROM public.messages m
        WHERE m.group_id = gm.group_id AND m.thread_date = d AND m.kind = 'system'
          AND m.system_payload->>'event' = 'birthday'
          AND m.system_payload->>'user_id' = u.id::text)
    RETURNING 1
  ) SELECT count(*) INTO n FROM ins;
  RETURN n;
END $$;;
