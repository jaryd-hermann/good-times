-- Query to find groups that received questions today with interests NOT in their explicit interest list
-- Run this to see which groups have mismatched questions

WITH todays_prompts AS (
  -- Get all daily prompts scheduled for today
  SELECT 
    dp.id,
    dp.group_id,
    dp.prompt_id,
    dp.date,
    dp.is_discovery,
    dp.discovery_interest,
    p.question,
    p.interests as prompt_interests,
    p.category,
    g.name as group_name
  FROM daily_prompts dp
  INNER JOIN prompts p ON p.id = dp.prompt_id
  INNER JOIN groups g ON g.id = dp.group_id
  WHERE dp.date = CURRENT_DATE
    AND dp.user_id IS NULL -- Only group-level prompts, not user-specific
),
group_explicit_interests AS (
  -- Get all explicit interests for all groups
  SELECT 
    gi.group_id,
    i.name as interest_name,
    array_agg(i.name) OVER (PARTITION BY gi.group_id) as all_group_interests
  FROM group_interests gi
  INNER JOIN interests i ON i.id = gi.interest_id
),
prompt_interest_analysis AS (
  -- Analyze each prompt's interests against group's interests
  SELECT 
    tp.*,
    COALESCE(
      (SELECT array_agg(gei.interest_name) 
       FROM group_explicit_interests gei 
       WHERE gei.group_id = tp.group_id 
         AND tp.prompt_interests @> ARRAY[gei.interest_name]::text[]
      ),
      ARRAY[]::text[]
    ) as matching_interests,
    COALESCE(
      (SELECT array_agg(interest) 
       FROM unnest(tp.prompt_interests) AS interest 
       WHERE interest NOT IN (
         SELECT interest_name 
         FROM group_explicit_interests gei 
         WHERE gei.group_id = tp.group_id
       )
      ),
      ARRAY[]::text[]
    ) as unmatched_interests,
    (SELECT COUNT(*) 
     FROM group_explicit_interests gei 
     WHERE gei.group_id = tp.group_id
    ) as group_explicit_interest_count
  FROM todays_prompts tp
)
SELECT 
  group_id,
  group_name,
  prompt_id,
  question,
  prompt_interests,
  matching_interests,
  unmatched_interests,
  group_explicit_interest_count,
  is_discovery,
  discovery_interest,
  category,
  CASE 
    WHEN array_length(unmatched_interests, 1) > 0 THEN '❌ MISMATCH'
    WHEN array_length(prompt_interests, 1) IS NULL OR array_length(prompt_interests, 1) = 0 THEN '⚠️ NULL/EMPTY INTERESTS'
    WHEN is_discovery = true THEN '🔍 DISCOVERY'
    ELSE '✅ MATCH'
  END as status
FROM prompt_interest_analysis
WHERE 
  -- Show only mismatches, discovery questions, or null-interest questions
  array_length(unmatched_interests, 1) > 0 
  OR array_length(prompt_interests, 1) IS NULL 
  OR array_length(prompt_interests, 1) = 0
  OR is_discovery = true
ORDER BY 
  CASE WHEN array_length(unmatched_interests, 1) > 0 THEN 1 ELSE 2 END,
  group_name,
  question;

-- Summary: Count of mismatches
SELECT 
  '=== SUMMARY ===' as section,
  COUNT(*) FILTER (WHERE array_length(unmatched_interests, 1) > 0) as total_mismatches,
  COUNT(*) FILTER (WHERE is_discovery = true) as total_discovery,
  COUNT(*) FILTER (WHERE array_length(prompt_interests, 1) IS NULL OR array_length(prompt_interests, 1) = 0) as total_null_interests,
  COUNT(*) as total_flagged_prompts
FROM prompt_interest_analysis
WHERE 
  array_length(unmatched_interests, 1) > 0 
  OR array_length(prompt_interests, 1) IS NULL 
  OR array_length(prompt_interests, 1) = 0
  OR is_discovery = true;
