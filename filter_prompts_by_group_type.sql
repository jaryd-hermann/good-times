-- SQL Script: Filter prompts by group type
-- This script removes prompts from queues and daily_prompts that don't match the group type
-- Run this script to clean up existing data from today onwards

-- 1. Remove Family category prompts from Friends groups' queues
DELETE FROM group_prompt_queue
WHERE prompt_id IN (
  SELECT p.id 
  FROM prompts p
  WHERE p.category = 'Family'
)
AND group_id IN (
  SELECT id 
  FROM groups 
  WHERE type = 'friends'
);

-- 2. Remove Friends category prompts from Family groups' queues
DELETE FROM group_prompt_queue
WHERE prompt_id IN (
  SELECT p.id 
  FROM prompts p
  WHERE p.category = 'Friends'
)
AND group_id IN (
  SELECT id 
  FROM groups 
  WHERE type = 'family'
);

-- 3. Remove Family category prompts from Friends groups' daily_prompts (from today onwards)
DELETE FROM daily_prompts
WHERE date >= CURRENT_DATE
AND prompt_id IN (
  SELECT p.id 
  FROM prompts p
  WHERE p.category = 'Family'
)
AND group_id IN (
  SELECT id 
  FROM groups 
  WHERE type = 'friends'
);

-- 4. Remove Friends category prompts from Family groups' daily_prompts (from today onwards)
DELETE FROM daily_prompts
WHERE date >= CURRENT_DATE
AND prompt_id IN (
  SELECT p.id 
  FROM prompts p
  WHERE p.category = 'Friends'
)
AND group_id IN (
  SELECT id 
  FROM groups 
  WHERE type = 'family'
);

-- Summary query to verify the cleanup
SELECT 
  g.type as group_type,
  p.category as prompt_category,
  COUNT(*) as count
FROM daily_prompts dp
JOIN groups g ON dp.group_id = g.id
JOIN prompts p ON dp.prompt_id = p.id
WHERE dp.date >= CURRENT_DATE
AND (
  (g.type = 'family' AND p.category = 'Friends') OR
  (g.type = 'friends' AND p.category = 'Family')
)
GROUP BY g.type, p.category;

-- This should return 0 rows if cleanup was successful

