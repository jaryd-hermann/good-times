-- 134: user-suggested questions, surfaced in the admin Suggestions tab.
CREATE TABLE IF NOT EXISTS public.suggested_questions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  question    text NOT NULL,
  -- Name and email are COPIED at submission rather than joined at read time. A
  -- suggestion is a record of who sent it THEN; if someone later renames
  -- themselves or deletes their account, the submission should still say where
  -- it came from (ON DELETE SET NULL would otherwise orphan it entirely).
  user_name   text,
  user_email  text,
  status      text NOT NULL DEFAULT 'new'
              CHECK (status IN ('new','accepted','rejected')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS suggested_questions_created_idx
  ON public.suggested_questions (created_at DESC);

COMMENT ON TABLE public.suggested_questions IS
  'User-contributed question ideas. Surfaced in the admin Suggestions tab.';

-- SECURITY DEFINER because RLS is off: a direct client insert would let anyone
-- write any name and email onto a submission. Here the identity is resolved
-- server-side from p_user_id and cannot be forged by the caller.
CREATE OR REPLACE FUNCTION public.v2_suggest_question(
  p_user_id uuid,
  p_question text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_q text; v_name text; v_email text; v_recent int;
BEGIN
  v_q := btrim(coalesce(p_question, ''));

  IF length(v_q) < 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_short');
  END IF;
  IF length(v_q) > 300 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_long');
  END IF;

  SELECT coalesce(name,'Someone'), email INTO v_name, v_email
  FROM public.users WHERE id = p_user_id;
  IF v_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_user');
  END IF;

  -- The same text twice is a double-tap, not two ideas. Reported as ok so the
  -- app still confirms — from the user's side it did send.
  IF EXISTS (SELECT 1 FROM public.suggested_questions
             WHERE user_id = p_user_id AND lower(btrim(question)) = lower(v_q)) THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  SELECT count(*) INTO v_recent FROM public.suggested_questions
   WHERE user_id = p_user_id AND created_at > now() - interval '1 hour';
  IF v_recent >= 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rate_limited');
  END IF;

  INSERT INTO public.suggested_questions (user_id, question, user_name, user_email)
  VALUES (p_user_id, v_q, v_name, v_email);

  RETURN jsonb_build_object('ok', true);
END $$;

GRANT EXECUTE ON FUNCTION public.v2_suggest_question(uuid, text) TO anon, authenticated;

-- The table stays closed to the client. Submissions go through the RPC, and
-- reading them is an admin concern — RLS is off, so a grant here would make
-- every suggestion and submitter email readable with the shipped key.
REVOKE ALL ON public.suggested_questions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suggested_questions TO service_role;
