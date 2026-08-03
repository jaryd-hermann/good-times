-- push_tokens: allow each signed-in user to upsert/read/delete only their own rows.
-- Client onboarding/home calls supabase.from("push_tokens").upsert(...) as authenticated.
-- Without INSERT + UPDATE policies (WITH CHECK / USING), PostgREST returns 42501 RLS violation.

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_tokens_select_own" ON push_tokens;
DROP POLICY IF EXISTS "push_tokens_insert_own" ON push_tokens;
DROP POLICY IF EXISTS "push_tokens_update_own" ON push_tokens;
DROP POLICY IF EXISTS "push_tokens_delete_own" ON push_tokens;

CREATE POLICY "push_tokens_select_own"
  ON push_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "push_tokens_insert_own"
  ON push_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_tokens_update_own"
  ON push_tokens
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_tokens_delete_own"
  ON push_tokens
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
