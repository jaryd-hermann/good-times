-- Share today's answer into a group you just joined or created.
--
-- Two things were wrong, in opposite directions:
--
-- 1. It only considered answers with NO shares at all. Once you were in one group
--    and had answered, that answer was "shared", so creating a second group shared
--    nothing into it — the new group showed "answer today's question" for a day you
--    had already answered.
--
-- 2. For a genuinely unshared answer it back-filled the user's ENTIRE history into
--    the new group. A group created today should not receive last week's answers.
--
-- The rule is the join date: when you join or create a group, that day's answer (if
-- it exists) appears there, whether or not it is already in other groups. Earlier
-- days are not back-filled — the group only sees answers from the day it existed
-- onward.
CREATE OR REPLACE FUNCTION public.v2_retro_share_answers(p_user_id uuid, p_group_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE n int := 0;
BEGIN
  WITH joinday AS (
    SELECT a.id, a.date, a.created_at, a.mentions
    FROM public.answers a
    WHERE a.user_id = p_user_id
      -- Join date only. Deliberately NOT "every unshared answer".
      AND a.date = CURRENT_DATE
  ), ins_share AS (
    INSERT INTO public.answer_shares (answer_id, group_id, shared_at)
    SELECT id, p_group_id, now() FROM joinday
    ON CONFLICT (answer_id, group_id) DO NOTHING
    RETURNING answer_id
  )
  INSERT INTO public.messages (group_id, thread_date, kind, user_id, answer_id,
                               mentions, suppress_notify, created_at)
  SELECT p_group_id, j.date, 'answer', p_user_id, j.id, j.mentions, true, j.created_at
  FROM joinday j JOIN ins_share s ON s.answer_id = j.id
  ON CONFLICT (answer_id, group_id) WHERE answer_id IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $function$;
