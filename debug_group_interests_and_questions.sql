-- Query to map group's explicit interests and past 10 days of questions with interests
-- Group ID: 4d129d3e-b14c-4d9b-88b7-43ec67d98ca2

-- Query 1: JSON summary format
WITH group_explicit_interests AS (
  -- Get all explicit interests for this group
  SELECT 
    i.id as interest_id,
    i.name as interest_name
  FROM group_interests gi
  INNER JOIN interests i ON i.id = gi.interest_id
  WHERE gi.group_id = '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2'
),
recent_daily_prompts AS (
  -- Get daily prompts for the past 10 days
  SELECT 
    dp.id,
    dp.date,
    dp.prompt_id,
    dp.is_discovery,
    dp.discovery_interest,
    p.question,
    p.interests as prompt_interests,
    p.category
  FROM daily_prompts dp
  INNER JOIN prompts p ON p.id = dp.prompt_id
  WHERE dp.group_id = '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2'
    AND dp.date >= CURRENT_DATE - INTERVAL '10 days'
    AND dp.user_id IS NULL  -- Only general prompts, not user-specific
  ORDER BY dp.date DESC
)
SELECT 
  -- Group explicit interests summary
  (SELECT json_agg(json_build_object('interest_id', interest_id, 'interest_name', interest_name))
   FROM group_explicit_interests) as explicit_interests,
  
  -- Recent questions with details
  json_agg(
    json_build_object(
      'date', date,
      'prompt_id', prompt_id,
      'question', question,
      'category', category,
      'is_discovery', COALESCE(is_discovery, false),
      'discovery_interest', discovery_interest,
      'prompt_interests', prompt_interests,
      'matches_explicit_interests', (
        SELECT array_agg(interest_name)
        FROM group_explicit_interests gei
        WHERE prompt_interests @> ARRAY[gei.interest_name]::text[]
      )
    )
    ORDER BY date DESC
  ) as recent_questions
FROM recent_daily_prompts;

-- Query 2: Detailed breakdown view (run separately)
WITH group_explicit_interests AS (
  SELECT 
    i.id as interest_id,
    i.name as interest_name
  FROM group_interests gi
  INNER JOIN interests i ON i.id = gi.interest_id
  WHERE gi.group_id = '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2'
),
recent_daily_prompts AS (
  SELECT 
    dp.id,
    dp.date,
    dp.prompt_id,
    dp.is_discovery,
    dp.discovery_interest,
    p.question,
    p.interests as prompt_interests,
    p.category
  FROM daily_prompts dp
  INNER JOIN prompts p ON p.id = dp.prompt_id
  WHERE dp.group_id = '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2'
    AND dp.date >= CURRENT_DATE - INTERVAL '10 days'
    AND dp.user_id IS NULL
),
combined_results AS (
  SELECT 
    '=== GROUP EXPLICIT INTERESTS ===' as section,
    1 as sort_order,
    NULL::date as date,
    NULL::uuid as prompt_id,
    NULL::text as question,
    NULL::text as category,
    NULL::boolean as is_discovery,
    NULL::text as discovery_interest,
    NULL::text[] as prompt_interests,
    json_agg(json_build_object('interest_id', interest_id, 'interest_name', interest_name))::json as details
  FROM group_explicit_interests

  UNION ALL

  SELECT 
    '=== RECENT QUESTIONS (PAST 10 DAYS) ===' as section,
    2 as sort_order,
    NULL::date as date,
    NULL::uuid as prompt_id,
    NULL::text as question,
    NULL::text as category,
    NULL::boolean as is_discovery,
    NULL::text as discovery_interest,
    NULL::text[] as prompt_interests,
    NULL::json as details

  UNION ALL

  SELECT 
    'Question' as section,
    3 as sort_order,
    rdp.date as date,
    rdp.prompt_id as prompt_id,
    LEFT(rdp.question, 100) as question,  -- Truncate for readability
    rdp.category as category,
    rdp.is_discovery as is_discovery,
    rdp.discovery_interest as discovery_interest,
    rdp.prompt_interests as prompt_interests,
    json_build_object(
      'full_question', rdp.question,
      'prompt_interests_array', rdp.prompt_interests,
      'matches_explicit_interests', (
        SELECT array_agg(gei.interest_name)
        FROM group_explicit_interests gei
        WHERE rdp.prompt_interests @> ARRAY[gei.interest_name]::text[]
      ),
      'has_unmatched_interests', (
        SELECT COUNT(*) > 0
        FROM unnest(rdp.prompt_interests) AS interest
        WHERE interest NOT IN (SELECT interest_name FROM group_explicit_interests)
      )
    )::json as details
  FROM recent_daily_prompts rdp
)
SELECT 
  section,
  date,
  prompt_id,
  question,
  category,
  is_discovery,
  discovery_interest,
  prompt_interests,
  details
FROM combined_results
ORDER BY 
  sort_order,
  date DESC NULLS LAST;
