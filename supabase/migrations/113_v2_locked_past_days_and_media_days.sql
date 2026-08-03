-- 1. Lock any unanswered day, not just today or later.
--
-- v2_is_locked required `p_date >= CURRENT_DATE`, so opening a past day's thread
-- showed the whole conversation to someone who never answered it. The premise is
-- that you unlock a day by answering it — that holds whenever the day was, and
-- History is full of past days you can reach.
CREATE OR REPLACE FUNCTION public.v2_is_locked(p_user_id uuid, p_date date)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.answers a
    WHERE a.user_id = p_user_id AND a.date = p_date
  );
$$;

-- 2. Remember which day each photo was taken.
--
-- The weekly journal composer reads the day off each photo's EXIF and shows it as
-- a tag, but nothing persisted it, so the tag vanished once posted. Parallel to
-- media_urls, exactly like captions: index i is the day for photo i, NULL where
-- the photo carried no date (screenshots, forwarded images).
ALTER TABLE public.answers ADD COLUMN IF NOT EXISTS media_days text[];

-- 3. Return it from the two RPCs that serve answers.
--
-- Patched by text substitution rather than retyping the bodies: these functions
-- are a few KB each and re-declaring them by hand risks silently dropping a
-- clause. The anchors below are unique within each definition.
DO $patch$
DECLARE
  d text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO d
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'v2_get_today_hub';

  IF position('a.media_days' IN d) = 0 THEN
    d := replace(d, 'a.captions, a.created_at,', 'a.captions, a.media_days, a.created_at,');
    EXECUTE d;
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO d
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'v2_get_thread';

  IF position('media_days' IN d) = 0 THEN
    d := replace(
      d,
      '''captions'', a.captions,',
      '''captions'', a.captions, ''media_days'', a.media_days,'
    );
    EXECUTE d;
  END IF;
END
$patch$;
