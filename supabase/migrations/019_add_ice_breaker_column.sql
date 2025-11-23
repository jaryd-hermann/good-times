-- Migration: Add ice breaker question logic
-- This migration adds support for ice breaker questions in group initialization

-- Add ice_breaker column to prompts table
-- TRUE = question is suitable for ice breaker (lighter, more accessible)
-- FALSE = regular question (default)
ALTER TABLE prompts 
ADD COLUMN IF NOT EXISTS ice_breaker BOOLEAN DEFAULT FALSE;

-- Add index for ice_breaker queries (used in group initialization)
CREATE INDEX IF NOT EXISTS idx_prompts_ice_breaker ON prompts(ice_breaker) WHERE ice_breaker = TRUE;

-- Add index for ice_breaker + category queries (common query pattern for initialization)
CREATE INDEX IF NOT EXISTS idx_prompts_ice_breaker_category ON prompts(ice_breaker, category) WHERE ice_breaker = TRUE;

-- Add ice_breaker_queue_completed_date column to groups table
-- Tracks when the initial 15-day ice-breaker queue ends
-- NULL = ice-breaker queue not yet initialized
-- DATE = date after the last prompt in the initial ice-breaker queue
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS ice_breaker_queue_completed_date DATE;

-- Add index for ice_breaker_queue_completed_date queries
CREATE INDEX IF NOT EXISTS idx_groups_ice_breaker_completed ON groups(ice_breaker_queue_completed_date);

-- Add comment explaining the columns
COMMENT ON COLUMN prompts.ice_breaker IS 'TRUE if question is suitable for ice breaker (lighter, more accessible questions for new groups). FALSE for regular questions.';
COMMENT ON COLUMN groups.ice_breaker_queue_completed_date IS 'Date after the last prompt in the initial 15-day ice-breaker queue. NULL means ice-breaker queue not yet initialized. After this date, normal question generation logic applies.';

