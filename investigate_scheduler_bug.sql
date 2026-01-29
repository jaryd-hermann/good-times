-- INVESTIGATION: Let's see what's ACTUALLY happening
-- This will show us the real data to understand the bug

-- 1. Check what prompts actually look like - do they have interests?
SELECT 
  id,
  question,
  category,
  interests,
  array_length(interests, 1) as interest_count
FROM prompts
WHERE category = 'Standard'
ORDER BY array_length(interests, 1) DESC NULLS LAST
LIMIT 20;

-- 2. Check today's scheduled prompts and their interests vs group interests
SELECT 
  dp.group_id,
  g.name as group_name,
  p.id as prompt_id,
  LEFT(p.question, 60) as question_preview,
  p.interests as prompt_interests,
  array_length(p.interests, 1) as prompt_interest_count,
  (
    SELECT array_agg(i.name)
    FROM group_interests gi
    INNER JOIN interests i ON i.id = gi.interest_id
    WHERE gi.group_id = dp.group_id
  ) as group_explicit_interests,
  (
    SELECT COUNT(*)
    FROM group_interests gi
    WHERE gi.group_id = dp.group_id
  ) as group_interest_count,
  dp.is_discovery,
  dp.discovery_interest
FROM daily_prompts dp
INNER JOIN prompts p ON p.id = dp.prompt_id
INNER JOIN groups g ON g.id = dp.group_id
WHERE dp.date = CURRENT_DATE
  AND dp.user_id IS NULL
ORDER BY g.name;

-- 3. For a specific problematic group, show what happened
-- Replace 'GROUP_ID_HERE' with an actual group ID that got wrong question
/*
WITH group_interests_list AS (
  SELECT array_agg(i.name) as interests
  FROM group_interests gi
  INNER JOIN interests i ON i.id = gi.interest_id
  WHERE gi.group_id = 'GROUP_ID_HERE'
),
todays_prompt AS (
  SELECT 
    dp.*,
    p.interests as prompt_interests,
    p.question
  FROM daily_prompts dp
  INNER JOIN prompts p ON p.id = dp.prompt_id
  WHERE dp.group_id = 'GROUP_ID_HERE'
    AND dp.date = CURRENT_DATE
    AND dp.user_id IS NULL
  LIMIT 1
)
SELECT 
  (SELECT interests FROM group_interests_list) as group_interests,
  prompt_interests,
  question,
  CASE 
    WHEN prompt_interests IS NULL OR array_length(prompt_interests, 1) = 0 THEN 'NULL/EMPTY'
    WHEN (SELECT interests FROM group_interests_list) @> prompt_interests THEN 'MATCH'
    ELSE 'MISMATCH'
  END as status
FROM todays_prompt;
*/
