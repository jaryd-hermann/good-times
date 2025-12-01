-- Migration: Add dynamic variable tracking and new question categories
-- This migration adds support for tracking which names have been used for dynamic variables
-- and adds new question categories with restrictions

-- Table to track which names have been used for dynamic variables in prompts
CREATE TABLE IF NOT EXISTS prompt_name_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  variable_type TEXT NOT NULL CHECK (variable_type IN ('memorial_name', 'member_name')),
  name_used TEXT NOT NULL,
  date_used DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, prompt_id, variable_type, name_used, date_used)
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_prompt_name_usage_group_date ON prompt_name_usage(group_id, date_used);
CREATE INDEX IF NOT EXISTS idx_prompt_name_usage_prompt_variable ON prompt_name_usage(prompt_id, variable_type);

-- Enable RLS
ALTER TABLE prompt_name_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Group members can view usage history
CREATE POLICY "Group members can view name usage"
  ON prompt_name_usage FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = prompt_name_usage.group_id
      AND group_members.user_id = auth.uid()
    )
  );

-- RLS Policy: Group members can insert usage records
CREATE POLICY "Group members can insert name usage"
  ON prompt_name_usage FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = prompt_name_usage.group_id
      AND group_members.user_id = auth.uid()
    )
  );

-- Add constraint to prompts table to ensure Edgy/NSFW category exists
-- Note: This will be enforced at application level, but we document it here

-- Add comment explaining the usage tracking
COMMENT ON TABLE prompt_name_usage IS 'Tracks which names have been used for dynamic variables in prompts to ensure fair rotation';
COMMENT ON COLUMN prompt_name_usage.variable_type IS 'Type of variable: memorial_name or member_name';
COMMENT ON COLUMN prompt_name_usage.name_used IS 'The actual name that was used in the prompt';

-- Note: The new categories "Edgy/NSFW" and "A Bit Deeper" will be added via application code
-- Family groups will be restricted from seeing "Edgy/NSFW" via application logic and RLS policies

