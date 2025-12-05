-- Fix prompt_name_usage unique constraint and clean up duplicates
-- Issue: Current constraint allows multiple records for same prompt+date with different names
-- Fix: Change constraint to only allow ONE record per (group_id, prompt_id, variable_type, date_used)

-- Step 1: Drop the old incorrect unique constraint
-- First, find and drop the constraint
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find the constraint name
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'prompt_name_usage'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) LIKE '%name_used%';
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE prompt_name_usage DROP CONSTRAINT ' || quote_ident(constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    ELSE
        RAISE NOTICE 'No constraint found with name_used';
    END IF;
END $$;

-- Step 2: Clean up duplicate records - keep only the earliest (first) record for each (group_id, prompt_id, variable_type, date_used)
-- Delete duplicates, keeping the one with the earliest created_at
DELETE FROM prompt_name_usage pnu1
WHERE EXISTS (
    SELECT 1
    FROM prompt_name_usage pnu2
    WHERE pnu2.group_id = pnu1.group_id
      AND pnu2.prompt_id = pnu1.prompt_id
      AND pnu2.variable_type = pnu1.variable_type
      AND pnu2.date_used = pnu1.date_used
      AND pnu2.created_at < pnu1.created_at
);

-- Step 3: Add the correct unique constraint (without name_used)
-- This ensures only ONE record per (group_id, prompt_id, variable_type, date_used)
ALTER TABLE prompt_name_usage
ADD CONSTRAINT prompt_name_usage_unique_per_date 
UNIQUE (group_id, prompt_id, variable_type, date_used);

-- Step 4: Clean up orphaned records (prompt_name_usage without corresponding daily_prompts)
-- These shouldn't exist, but if they do, remove them
DELETE FROM prompt_name_usage pnu
WHERE NOT EXISTS (
    SELECT 1
    FROM daily_prompts dp
    WHERE dp.group_id = pnu.group_id
      AND dp.prompt_id = pnu.prompt_id
      AND dp.date = pnu.date_used
);

-- Add comment explaining the fix
COMMENT ON CONSTRAINT prompt_name_usage_unique_per_date ON prompt_name_usage IS 
'Ensures only one name_used record per (group_id, prompt_id, variable_type, date_used) combination. The name_used is stored but not part of the uniqueness constraint to prevent duplicates.';

