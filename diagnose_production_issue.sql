-- Comprehensive diagnostic query for group 8dd82cfd-7328-4deb-96c0-d729f7fc8e68
-- Check what should be showing vs what's actually stored

-- Step 1: Check prompt_name_usage for today (2025-12-01)
-- This shows which memorial name is recorded for today's prompt
SELECT 
  pnu.id,
  pnu.group_id,
  pnu.prompt_id,
  pnu.date_used,
  pnu.name_used,
  pnu.created_at,
  p.question as prompt_question,
  p.category,
  p.dynamic_variables
FROM prompt_name_usage pnu
JOIN prompts p ON pnu.prompt_id = p.id
WHERE pnu.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND pnu.variable_type = 'memorial_name'
  AND pnu.date_used = '2025-12-01'
ORDER BY pnu.created_at ASC;

-- Step 2: Check daily_prompts for today
-- This shows which prompt is scheduled for today
SELECT 
  dp.id,
  dp.group_id,
  dp.prompt_id,
  dp.date,
  dp.created_at,
  p.question as prompt_question,
  p.category,
  p.dynamic_variables
FROM daily_prompts dp
JOIN prompts p ON dp.prompt_id = p.id
WHERE dp.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND dp.date = '2025-12-01';

-- Step 3: Check what getDailyPrompt would return
-- Simulate what getDailyPrompt does: check existing usage, then calculate
WITH existing_usage AS (
  SELECT name_used
  FROM prompt_name_usage
  WHERE group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
    AND prompt_id = (SELECT prompt_id FROM daily_prompts WHERE group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68' AND date = '2025-12-01')
    AND variable_type = 'memorial_name'
    AND date_used = '2025-12-01'
  ORDER BY created_at ASC
  LIMIT 1
),
memorials_list AS (
  SELECT name, id
  FROM memorials
  WHERE group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  ORDER BY id ASC
)
SELECT 
  'Expected memorial name' as check_type,
  COALESCE(
    (SELECT name_used FROM existing_usage),
    (SELECT name FROM memorials_list ORDER BY id ASC LIMIT 1)
  ) as expected_name,
  (SELECT COUNT(*) FROM existing_usage) as usage_records_count,
  (SELECT COUNT(*) FROM memorials_list) as total_memorials;

-- Step 4: Check all entries for today to see what prompt_id they used
SELECT 
  e.id as entry_id,
  e.date,
  e.prompt_id,
  e.created_at as entry_created_at,
  p.question as prompt_question,
  p.category,
  p.dynamic_variables
FROM entries e
JOIN prompts p ON e.prompt_id = p.id
WHERE e.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND e.date = '2025-12-01'
ORDER BY e.created_at DESC;

-- Step 5: Check for ANY duplicates in prompt_name_usage for this group/date
SELECT 
  prompt_id,
  date_used,
  COUNT(*) as duplicate_count,
  STRING_AGG(DISTINCT name_used, ', ') as names_found,
  STRING_AGG(DISTINCT id::text, ', ') as record_ids
FROM prompt_name_usage
WHERE group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND variable_type = 'memorial_name'
  AND date_used = '2025-12-01'
GROUP BY prompt_id, date_used
HAVING COUNT(*) > 1;

