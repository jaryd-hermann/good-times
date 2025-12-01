-- Fix RLS policy for prompt_name_usage to allow group members to insert
-- The previous policy only allowed service role, but getDailyPrompt is called from client-side

-- Drop the old policy
DROP POLICY IF EXISTS "System can insert name usage" ON prompt_name_usage;

-- Create new policy that allows group members to insert
CREATE POLICY "Group members can insert name usage"
  ON prompt_name_usage FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = prompt_name_usage.group_id
      AND group_members.user_id = auth.uid()
    )
  );

