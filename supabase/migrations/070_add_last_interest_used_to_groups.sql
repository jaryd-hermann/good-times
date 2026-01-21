-- Add last_interest_used field to groups table to prevent back-to-back same interest questions
-- This tracks which interest was last used for question scheduling

ALTER TABLE groups
ADD COLUMN IF NOT EXISTS last_interest_used TEXT;

COMMENT ON COLUMN groups.last_interest_used IS 'Tracks the last interest name used for question scheduling to prevent back-to-back same interest questions';
