-- Migration: Add birthday prompt types and dynamic variable support
-- This migration adds support for birthday-specific prompts and dynamic variables in prompts

-- Add birthday_type column to prompts table for birthday-specific prompts
-- Values: NULL (not a birthday prompt), 'your_birthday', 'their_birthday'
ALTER TABLE prompts 
ADD COLUMN IF NOT EXISTS birthday_type TEXT CHECK (birthday_type IN ('your_birthday', 'their_birthday'));

-- Add dynamic_variables column to prompts table
-- This will store JSON array of variable names like ['member_name', 'memorial_name']
ALTER TABLE prompts 
ADD COLUMN IF NOT EXISTS dynamic_variables JSONB DEFAULT '[]'::jsonb;

-- Add index for birthday_type queries
CREATE INDEX IF NOT EXISTS idx_prompts_birthday_type ON prompts(birthday_type) WHERE birthday_type IS NOT NULL;

-- Add index for category + birthday_type queries (common query pattern)
CREATE INDEX IF NOT EXISTS idx_prompts_category_birthday ON prompts(category, birthday_type);

-- Update daily_prompts table to support per-user prompts (for birthday logic)
-- Add user_id column (nullable - NULL means prompt applies to all group members)
ALTER TABLE daily_prompts 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Add index for user-specific prompt queries
CREATE INDEX IF NOT EXISTS idx_daily_prompts_user ON daily_prompts(user_id) WHERE user_id IS NOT NULL;

-- Update unique constraint to allow per-user prompts on same date
-- Remove old unique constraint if it exists
ALTER TABLE daily_prompts 
DROP CONSTRAINT IF EXISTS daily_prompts_group_id_date_key;

-- Add new unique constraint that allows per-user prompts
-- A group can have one general prompt per date, OR multiple user-specific prompts per date
CREATE UNIQUE INDEX IF NOT EXISTS daily_prompts_group_date_user_unique 
ON daily_prompts(group_id, date, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Add comment explaining the structure
COMMENT ON COLUMN prompts.birthday_type IS 'Type of birthday prompt: your_birthday (for the person whose birthday it is) or their_birthday (for others in the group)';
COMMENT ON COLUMN prompts.dynamic_variables IS 'JSON array of variable names that can be replaced in the question text, e.g. ["member_name", "memorial_name"]';
COMMENT ON COLUMN daily_prompts.user_id IS 'If set, this prompt is specific to this user (e.g., birthday prompts). NULL means prompt applies to all group members.';

