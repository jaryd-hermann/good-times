-- Diagnostic query to understand why prompts aren't being scheduled
-- Run this for the 3 problematic groups

WITH group_prompt_stats AS (
  SELECT 
    g.id as group_id,
    g.name as group_name,
    -- Count total Standard prompts in database
    (SELECT COUNT(*) FROM prompts WHERE category = 'Standard') as total_standard_prompts,
    -- Count Standard prompts asked by this group
    (SELECT COUNT(DISTINCT dp.prompt_id) 
     FROM daily_prompts dp
     JOIN prompts p ON dp.prompt_id = p.id
     WHERE dp.group_id = g.id 
     AND dp.user_id IS NULL
     AND p.category = 'Standard') as standard_prompts_asked,
    -- Count all prompts asked by this group (any category)
    (SELECT COUNT(DISTINCT dp.prompt_id) 
     FROM daily_prompts dp
     WHERE dp.group_id = g.id 
     AND dp.user_id IS NULL) as total_prompts_asked,
    -- Get last Standard prompt asked
    (SELECT dp.prompt_id 
     FROM daily_prompts dp
     JOIN prompts p ON dp.prompt_id = p.id
     WHERE dp.group_id = g.id 
     AND dp.user_id IS NULL
     AND p.category = 'Standard'
     ORDER BY dp.date DESC
     LIMIT 1) as last_standard_prompt_id,
    -- Get last prompt asked (any category)
    (SELECT dp.prompt_id 
     FROM daily_prompts dp
     WHERE dp.group_id = g.id 
     AND dp.user_id IS NULL
     ORDER BY dp.date DESC
     LIMIT 1) as last_prompt_id,
    -- Check if group has completion_date set (might affect scheduling)
    g.completion_date IS NOT NULL as has_completion_date
  FROM groups g
  WHERE g.id IN (
    '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2',
    '8dd82cfd-7328-4deb-96c0-d729f7fc8e68',
    'cd36520c-03fa-4e18-9442-cde27e7cfa64'
  )
)
SELECT 
  group_id,
  group_name,
  total_standard_prompts,
  standard_prompts_asked,
  total_prompts_asked,
  total_standard_prompts - standard_prompts_asked as available_standard_prompts,
  last_standard_prompt_id,
  last_prompt_id,
  has_completion_date,
  CASE 
    WHEN has_completion_date THEN '⚠️ Has completion_date - might be skipped'
    WHEN standard_prompts_asked >= total_standard_prompts THEN '❌ All Standard prompts exhausted'
    WHEN available_standard_prompts = 0 THEN '❌ No available Standard prompts'
    ELSE '✅ Should have available prompts'
  END as status
FROM group_prompt_stats
ORDER BY group_name;

-- Additional query: Check if there are any Standard prompts that haven't been asked
-- for a specific group
SELECT 
  p.id,
  p.question,
  p.category,
  CASE 
    WHEN dp.prompt_id IS NOT NULL THEN 'Already asked'
    ELSE 'Available'
  END as status,
  dp.date as last_asked_date
FROM prompts p
LEFT JOIN (
  SELECT DISTINCT ON (prompt_id) prompt_id, date
  FROM daily_prompts
  WHERE group_id = '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2'  -- One Direction
  AND user_id IS NULL
  ORDER BY prompt_id, date DESC
) dp ON p.id = dp.prompt_id
WHERE p.category = 'Standard'
ORDER BY 
  CASE WHEN dp.prompt_id IS NOT NULL THEN 1 ELSE 0 END,
  p.question
LIMIT 20;  -- Show first 20 to see mix of asked/available
