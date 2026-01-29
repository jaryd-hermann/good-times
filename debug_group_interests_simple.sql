-- Simple query to check group interests and recent questions
-- Group ID: 4d129d3e-b14c-4d9b-88b7-43ec67d98ca2

-- 1. Get explicit interests for the group
SELECT 
  'EXPLICIT INTERESTS' as type,
  i.name as interest_name,
  NULL as date,
  NULL as question,
  NULL as prompt_interests
FROM group_interests gi
INNER JOIN interests i ON i.id = gi.interest_id
WHERE gi.group_id = '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2'

UNION ALL

-- 2. Get questions from past 10 days with their interests
SELECT 
  'QUESTION' as type,
  NULL as interest_name,
  dp.date::text as date,
  LEFT(p.question, 80) as question,
  p.interests::text as prompt_interests
FROM daily_prompts dp
INNER JOIN prompts p ON p.id = dp.prompt_id
WHERE dp.group_id = '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2'
  AND dp.date >= CURRENT_DATE - INTERVAL '10 days'
  AND dp.user_id IS NULL
ORDER BY 
  CASE type WHEN 'EXPLICIT INTERESTS' THEN 1 ELSE 2 END,
  date DESC NULLS LAST;

-- Detailed breakdown: Check which questions match group interests
SELECT 
  dp.date,
  dp.prompt_id,
  p.question,
  p.interests as prompt_interests,
  p.category,
  dp.is_discovery,
  dp.discovery_interest,
  -- Check if any prompt interests match group's explicit interests
  (
    SELECT array_agg(gei.interest_name)
    FROM group_interests gi
    INNER JOIN interests i ON i.id = gi.interest_id
    WHERE gi.group_id = '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2'
      AND p.interests @> ARRAY[i.name]::text[]
  ) as matching_group_interests,
  -- Check if prompt has interests NOT in group's explicit interests
  (
    SELECT array_agg(unnested_interest)
    FROM unnest(p.interests) AS unnested_interest
    WHERE unnested_interest NOT IN (
      SELECT i.name
      FROM group_interests gi
      INNER JOIN interests i ON i.id = gi.interest_id
      WHERE gi.group_id = '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2'
    )
  ) as interests_not_in_group
FROM daily_prompts dp
INNER JOIN prompts p ON p.id = dp.prompt_id
WHERE dp.group_id = '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2'
  AND dp.date >= CURRENT_DATE - INTERVAL '10 days'
  AND dp.user_id IS NULL
ORDER BY dp.date DESC;
