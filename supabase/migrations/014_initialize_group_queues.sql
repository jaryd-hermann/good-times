-- Migration: Initialize question queues for existing groups
-- This migration calls the initialize-group-queue Edge Function for all existing groups
-- that don't have a queue initialized yet (no prompts in last 7 days)

-- Note: This migration requires the initialize-group-queue Edge Function to be deployed
-- The actual queue initialization happens via Edge Function call, not SQL

-- Create a function to check if a group needs queue initialization
CREATE OR REPLACE FUNCTION needs_queue_initialization(group_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  prompt_count INTEGER;
BEGIN
  -- Check if group has any prompts in the last 7 days
  SELECT COUNT(*) INTO prompt_count
  FROM daily_prompts
  WHERE group_id = group_uuid
    AND date >= CURRENT_DATE - INTERVAL '7 days'
    AND user_id IS NULL; -- Only count general prompts, not birthday-specific
  
  -- Return true if no prompts found (needs initialization)
  RETURN prompt_count = 0;
END;
$$ LANGUAGE plpgsql;

-- Add a comment explaining the migration
COMMENT ON FUNCTION needs_queue_initialization IS 
  'Checks if a group needs queue initialization. Returns true if group has no prompts in last 7 days.';

-- Note: The actual queue initialization should be done via:
-- 1. Manual call to initialize-group-queue Edge Function for each group
-- 2. Or via a script that iterates through groups and calls the function
-- 
-- Example script (run separately, not in migration):
-- 
-- DO $$
-- DECLARE
--   group_record RECORD;
-- BEGIN
--   FOR group_record IN 
--     SELECT id, type, created_by, created_at 
--     FROM groups
--     WHERE needs_queue_initialization(id)
--   LOOP
--     -- Call Edge Function (requires HTTP extension or external script)
--     -- This is better done via a Node.js/TypeScript script or Edge Function
--     RAISE NOTICE 'Group % needs queue initialization', group_record.id;
--   END LOOP;
-- END $$;

-- Since we can't easily call Edge Functions from SQL migrations,
-- we'll create a helper view to identify groups that need initialization
CREATE OR REPLACE VIEW groups_needing_queue_init AS
SELECT 
  g.id,
  g.name,
  g.type,
  g.created_at,
  COUNT(dp.id) as prompt_count_last_7_days
FROM groups g
LEFT JOIN daily_prompts dp ON dp.group_id = g.id 
  AND dp.date >= CURRENT_DATE - INTERVAL '7 days'
  AND dp.user_id IS NULL
GROUP BY g.id, g.name, g.type, g.created_at
HAVING COUNT(dp.id) = 0;

COMMENT ON VIEW groups_needing_queue_init IS 
  'Groups that need queue initialization (no prompts in last 7 days). Use this view to identify groups that need initialize-group-queue Edge Function called.';

