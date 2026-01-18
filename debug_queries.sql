-- Query 1: Questions asked to 3 specific groups for the past 7 days
-- This will help identify why some days show "No entries for this day"
-- UPDATED: Shows ALL dates in past 7 days, including missing prompts

WITH date_range AS (
  SELECT generate_series(
    CURRENT_DATE - INTERVAL '7 days',
    CURRENT_DATE,
    INTERVAL '1 day'
  )::date AS date
),
group_dates AS (
  SELECT 
    g.id as group_id,
    g.name as group_name,
    dr.date
  FROM groups g
  CROSS JOIN date_range dr
  WHERE g.id IN (
    '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2',
    '8dd82cfd-7328-4deb-96c0-d729f7fc8e68',
    'cd36520c-03fa-4e18-9442-cde27e7cfa64'
  )
)
SELECT 
  gd.group_id,
  gd.group_name,
  gd.date,
  CASE 
    WHEN dp.id IS NULL THEN '❌ MISSING PROMPT'
    WHEN dp.user_id IS NULL THEN 'General'
    ELSE u.name || ' (Birthday)'
  END as prompt_type,
  p.id as prompt_id,
  p.question,
  p.category,
  p.is_custom,
  p.custom_question_id,
  COUNT(e.id) as entry_count,
  CASE 
    WHEN dp.id IS NULL THEN 'NO PROMPT SCHEDULED'
    WHEN COUNT(e.id) = 0 THEN 'PROMPT EXISTS BUT NO ENTRIES'
    ELSE 'PROMPT EXISTS WITH ENTRIES'
  END as status
FROM group_dates gd
LEFT JOIN daily_prompts dp ON dp.group_id = gd.group_id 
  AND dp.date = gd.date
  AND dp.user_id IS NULL -- Only general prompts for this query
LEFT JOIN groups g ON gd.group_id = g.id
LEFT JOIN prompts p ON dp.prompt_id = p.id
LEFT JOIN users u ON dp.user_id = u.id
LEFT JOIN entries e ON e.group_id = gd.group_id 
  AND e.date = gd.date
GROUP BY 
  gd.group_id,
  gd.group_name,
  gd.date,
  dp.id,
  dp.user_id,
  u.name,
  p.id,
  p.question,
  p.category,
  p.is_custom,
  p.custom_question_id
ORDER BY 
  gd.group_id,
  gd.date DESC;

-- Query 2: Today's question for specific group
-- This will help identify why different users see different questions
SELECT 
  dp.id as daily_prompt_id,
  dp.group_id,
  g.name as group_name,
  dp.date,
  dp.user_id,
  CASE 
    WHEN dp.user_id IS NULL THEN 'General (applies to all members)'
    ELSE u.name || ' (User-specific birthday prompt)'
  END as prompt_type,
  p.id as prompt_id,
  p.question,
  p.category,
  p.is_custom,
  p.custom_question_id,
  p.is_default,
  p.ice_breaker,
  p.ice_breaker_order,
  dp.created_at as scheduled_at,
  COUNT(e.id) as entry_count,
  STRING_AGG(DISTINCT e.user_id::text, ', ') as users_who_answered
FROM daily_prompts dp
LEFT JOIN groups g ON dp.group_id = g.id
LEFT JOIN prompts p ON dp.prompt_id = p.id
LEFT JOIN users u ON dp.user_id = u.id
LEFT JOIN entries e ON e.group_id = dp.group_id 
  AND e.date = dp.date
  AND (dp.user_id IS NULL OR e.user_id = dp.user_id)
WHERE dp.group_id = 'ce951223-3540-4007-816d-829f260a5f5d'
AND dp.date = CURRENT_DATE
GROUP BY 
  dp.id,
  dp.group_id,
  g.name,
  dp.date,
  dp.user_id,
  u.name,
  p.id,
  p.question,
  p.category,
  p.is_custom,
  p.custom_question_id,
  p.is_default,
  p.ice_breaker,
  p.ice_breaker_order,
  dp.created_at
ORDER BY 
  dp.user_id NULLS FIRST,
  dp.created_at DESC;

-- Additional diagnostic query: Check if Journal prompt exists for non-Sunday dates
-- This will help identify the Journal question issue
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
  COUNT(e.id) as entry_count
FROM daily_prompts dp
JOIN groups g ON dp.group_id = g.id
JOIN prompts p ON dp.prompt_id = p.id
LEFT JOIN entries e ON e.group_id = dp.group_id AND e.date = dp.date
WHERE p.category = 'Journal'
AND dp.user_id IS NULL -- Only general prompts
AND dp.date >= CURRENT_DATE - INTERVAL '14 days'
GROUP BY 
  dp.id,
  dp.group_id,
  g.name,
  dp.date,
  p.category,
  p.question
ORDER BY dp.date DESC;

-- Query 4: Detect DUPLICATE general prompts for the same group/date
-- This identifies the bug where multiple prompts exist, causing different users to see different questions
SELECT 
  dp.group_id,
  g.name as group_name,
  dp.date,
  COUNT(*) as prompt_count,
  STRING_AGG(dp.id::text, ', ') as daily_prompt_ids,
  STRING_AGG(p.id::text, ', ') as prompt_ids,
  STRING_AGG(p.category, ', ') as categories,
  STRING_AGG(p.question, ' | ') as questions,
  EXTRACT(DOW FROM dp.date::date) as day_of_week,
  CASE 
    WHEN EXTRACT(DOW FROM dp.date::date) = 0 THEN 'Sunday'
    ELSE 'NOT Sunday'
  END as day_check,
  MIN(dp.created_at) as first_created,
  MAX(dp.created_at) as last_created
FROM daily_prompts dp
JOIN groups g ON dp.group_id = g.id
JOIN prompts p ON dp.prompt_id = p.id
WHERE dp.user_id IS NULL -- Only general prompts
AND dp.date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY 
  dp.group_id,
  g.name,
  dp.date
HAVING COUNT(*) > 1 -- Only show duplicates
ORDER BY dp.date DESC, prompt_count DESC;
