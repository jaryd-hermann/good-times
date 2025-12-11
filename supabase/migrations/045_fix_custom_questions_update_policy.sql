-- Fix UPDATE policy for custom_questions table
-- The policy was missing WITH CHECK clause, which is required for UPDATE policies
-- This was causing "new row violates row-level policy" errors when updating custom questions
-- 
-- The issue: USING clause checks date_asked IS NULL (existing row), but UPDATE sets date_asked to a date
-- Without WITH CHECK, Supabase uses USING for both, causing the new row (with date_asked set) to fail validation

DROP POLICY IF EXISTS "Users can update their custom questions" ON custom_questions;

CREATE POLICY "Users can update their custom questions" ON custom_questions FOR UPDATE
  USING (
    -- Can only update if: user owns it AND date_asked is currently NULL (not yet completed)
    auth.uid() = user_id AND
    date_asked IS NULL
  )
  WITH CHECK (
    -- After update, must still be owned by user and in their group
    -- Note: We allow date_asked to be set (user is completing the question)
    auth.uid() = user_id AND
    group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );

