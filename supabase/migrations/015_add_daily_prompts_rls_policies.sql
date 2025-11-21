-- Add RLS policies for daily_prompts table
-- These policies were missing, preventing users from reading prompts

-- Users can view daily_prompts for groups they're members of
CREATE POLICY "Users can view daily_prompts in their groups" 
ON daily_prompts FOR SELECT 
USING (
  group_id IN (
    SELECT group_id 
    FROM group_members 
    WHERE user_id = auth.uid()
  )
);

-- Edge Functions can insert daily_prompts (via service role, but policy needed for completeness)
-- Note: Service role bypasses RLS, but this policy ensures consistency
CREATE POLICY "Service can insert daily_prompts" 
ON daily_prompts FOR INSERT 
WITH CHECK (true);

-- Edge Functions can update daily_prompts
CREATE POLICY "Service can update daily_prompts" 
ON daily_prompts FOR UPDATE 
USING (true)
WITH CHECK (true);

-- Edge Functions can delete daily_prompts
CREATE POLICY "Service can delete daily_prompts" 
ON daily_prompts FOR DELETE 
USING (true);

