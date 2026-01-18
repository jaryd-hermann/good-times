-- Cleanup script: Delete Journal prompts that were incorrectly scheduled on non-Sunday dates
-- Journal prompts MUST ONLY exist on Sundays
-- This script identifies and removes any Journal prompts scheduled for non-Sunday dates

-- First, let's see what we're about to delete
SELECT 
  dp.id,
  dp.group_id,
  g.name as group_name,
  dp.date,
  EXTRACT(DOW FROM dp.date::date) as day_of_week, -- 0 = Sunday, 6 = Saturday
  CASE 
    WHEN EXTRACT(DOW FROM dp.date::date) = 0 THEN 'Sunday ✓'
    ELSE 'NOT Sunday ✗'
  END as day_check,
  p.category,
  p.question,
  (SELECT COUNT(*) FROM entries e WHERE e.group_id = dp.group_id AND e.date = dp.date) as entry_count
FROM daily_prompts dp
JOIN groups g ON dp.group_id = g.id
JOIN prompts p ON dp.prompt_id = p.id
WHERE p.category = 'Journal'
AND dp.user_id IS NULL -- Only general prompts
AND EXTRACT(DOW FROM dp.date::date) != 0 -- NOT Sunday
ORDER BY dp.date DESC;

-- Now delete the invalid Journal prompts
-- CRITICAL: Only delete if there are NO entries for these prompts
-- If entries exist, we should keep the prompt (even though it's invalid) to preserve user data
DELETE FROM daily_prompts
WHERE id IN (
  SELECT dp.id
  FROM daily_prompts dp
  JOIN prompts p ON dp.prompt_id = p.id
  WHERE p.category = 'Journal'
  AND dp.user_id IS NULL
  AND EXTRACT(DOW FROM dp.date::date) != 0 -- NOT Sunday
  AND NOT EXISTS (
    -- Don't delete if entries exist for this prompt
    SELECT 1
    FROM entries e
    WHERE e.group_id = dp.group_id
    AND e.date = dp.date
  )
);

-- Verify cleanup: Check if any invalid Journal prompts remain
SELECT 
  COUNT(*) as remaining_invalid_journal_prompts
FROM daily_prompts dp
JOIN prompts p ON dp.prompt_id = p.id
WHERE p.category = 'Journal'
AND dp.user_id IS NULL
AND EXTRACT(DOW FROM dp.date::date) != 0; -- NOT Sunday

-- If the count is > 0, those prompts have entries and were preserved
-- You may want to manually review those cases
