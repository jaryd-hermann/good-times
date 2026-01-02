-- Add interest cycle tracking to groups table
-- This tracks which interest we're currently on in the cycle for personalized Standard questions

ALTER TABLE groups
ADD COLUMN IF NOT EXISTS interest_cycle_position INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS interest_cycle_interests TEXT[] DEFAULT ARRAY[]::TEXT[];

-- interest_cycle_position: Current position in the cycle (0 = first interest, -1 = null break)
-- interest_cycle_interests: Array of interest names in weight order for the current cycle

COMMENT ON COLUMN groups.interest_cycle_position IS 'Current position in the interest cycle for Standard question selection. 0+ = interest index, -1 = null break';
COMMENT ON COLUMN groups.interest_cycle_interests IS 'Array of interest names in weight order for the current cycle';

