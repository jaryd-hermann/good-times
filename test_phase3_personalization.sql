-- Phase 3 Testing Queries
-- Test group vibe profiles, scoring functions, and suggestion system

-- ============================================================================
-- 1. VERIFY MATERIALIZED VIEW EXISTS AND HAS DATA
-- ============================================================================

-- Check if view exists and has data
SELECT 
  COUNT(*) as total_groups_profiled,
  COUNT(CASE WHEN total_prompts_asked > 0 THEN 1 END) as groups_with_prompts,
  COUNT(CASE WHEN total_entries > 0 THEN 1 END) as groups_with_entries,
  COUNT(CASE WHEN swipe_yes_rate IS NOT NULL THEN 1 END) as groups_with_swipe_data,
  COUNT(CASE WHEN active_deck_profiles IS NOT NULL THEN 1 END) as groups_with_deck_data
FROM group_vibe_profiles;

-- View sample profile data
SELECT 
  group_id,
  group_type,
  total_prompts_asked,
  total_entries,
  member_count,
  ROUND(avg_completion_rate::numeric, 3) as completion_rate,
  ROUND(avg_preferred_depth::numeric, 2) as preferred_depth,
  ROUND(avg_vulnerability_comfort::numeric, 2) as vulnerability_comfort,
  ROUND(swipe_yes_rate::numeric, 3) as swipe_yes_rate,
  ROUND(swipe_preferred_depth::numeric, 2) as swipe_depth,
  ROUND(avg_comments_per_entry::numeric, 2) as avg_comments
FROM group_vibe_profiles
ORDER BY total_entries DESC
LIMIT 10;

-- ============================================================================
-- 2. TEST CALCULATE_QUESTION_FIT_SCORE() FUNCTION
-- ============================================================================

-- Test with a specific group and question
-- Replace with actual group_id and prompt_id from your database
SELECT 
  p.id as prompt_id,
  p.question,
  p.category,
  p.depth_level,
  p.vulnerability_score,
  calculate_question_fit_score(
    'YOUR_GROUP_ID_HERE'::UUID,  -- Replace with actual group_id
    p.id
  ) as fit_score
FROM prompts p
WHERE p.is_default = true
  AND p.category = 'Friends'  -- or 'Family'
ORDER BY fit_score DESC
LIMIT 10;

-- Test score range (should all be between 0 and 1)
SELECT 
  COUNT(*) as total_tests,
  MIN(score) as min_score,
  MAX(score) as max_score,
  AVG(score) as avg_score,
  COUNT(CASE WHEN score < 0 OR score > 1 THEN 1 END) as invalid_scores
FROM (
  SELECT 
    calculate_question_fit_score(g.id, p.id) as score
  FROM groups g
  CROSS JOIN prompts p
  WHERE p.is_default = true
  LIMIT 100  -- Limit to avoid too many calculations
) score_tests;

-- ============================================================================
-- 3. TEST SUGGEST_QUESTIONS_FOR_GROUP() FUNCTION
-- ============================================================================

-- DIAGNOSTIC: Check if group exists and what prompts are available
-- Replace YOUR_GROUP_ID_HERE with actual group_id
SELECT 
  'Group exists' as check_type,
  id,
  name,
  type
FROM groups
WHERE id = 'YOUR_GROUP_ID_HERE'::UUID;

-- DIAGNOSTIC: Check group profile
SELECT 
  'Group profile' as check_type,
  group_id,
  total_prompts_asked,
  total_entries,
  group_type
FROM group_vibe_profiles
WHERE group_id = 'YOUR_GROUP_ID_HERE'::UUID;

-- DIAGNOSTIC: Check available prompts
SELECT 
  'Available prompts' as check_type,
  COUNT(*) as total,
  COUNT(CASE WHEN is_default = true THEN 1 END) as is_default_true,
  COUNT(CASE WHEN is_default IS NULL THEN 1 END) as is_default_null,
  COUNT(CASE WHEN is_training = false THEN 1 END) as is_training_false,
  COUNT(CASE WHEN is_training IS NULL THEN 1 END) as is_training_null,
  COUNT(CASE WHEN category = 'Friends' THEN 1 END) as friends_count,
  COUNT(CASE WHEN category = 'Family' THEN 1 END) as family_count
FROM prompts;

-- DIAGNOSTIC: Test the exact query the function would run (for new group)
-- Replace 'Friends' with 'Family' if testing a family group
-- This simulates what happens for a new group
SELECT 
  'Test query (new group)' as check_type,
  COUNT(*) as matching_prompts
FROM prompts p
WHERE (p.is_default = true OR p.is_default IS NULL)
  AND p.category = 'Friends'  -- Change to 'Family' if needed
  AND (p.is_training IS NULL OR p.is_training = false);

-- DIAGNOSTIC: Show sample prompts that should match
SELECT 
  'Sample matching prompts' as check_type,
  p.id,
  p.question,
  p.category,
  p.is_default,
  p.is_training,
  p.popularity_score
FROM prompts p
WHERE (p.is_default = true OR p.is_default IS NULL)
  AND p.category = 'Friends'  -- Change to 'Family' if needed
  AND (p.is_training IS NULL OR p.is_training = false)
ORDER BY COALESCE(p.popularity_score, 0.5) DESC
LIMIT 5;

-- Get suggestions for a specific group
-- Replace with actual group_id
SELECT 
  prompt_id,
  ROUND(fit_score::numeric, 4) as fit_score,
  question,
  category,
  depth_level,
  vulnerability_score,
  ROUND(popularity_score::numeric, 3) as popularity
FROM suggest_questions_for_group(
  'YOUR_GROUP_ID_HERE'::UUID,  -- Replace with actual group_id
  20,  -- limit
  ARRAY[]::UUID[]  -- exclude list
)
ORDER BY fit_score DESC;

-- Test with exclusion list (exclude already-asked questions)
SELECT 
  prompt_id,
  ROUND(fit_score::numeric, 4) as fit_score,
  question,
  category
FROM suggest_questions_for_group(
  'YOUR_GROUP_ID_HERE'::UUID,  -- Replace with actual group_id
  10,
  -- Exclude questions already asked to this group
  ARRAY(
    SELECT prompt_id 
    FROM daily_prompts 
    WHERE group_id = 'YOUR_GROUP_ID_HERE'::UUID
    LIMIT 10
  )::UUID[]
)
ORDER BY fit_score DESC;

-- ============================================================================
-- 4. TEST WITH GROUPS THAT HAVE ONLY SWIPE DATA
-- ============================================================================

-- Find groups with swipe data but few/no entries
SELECT 
  g.id as group_id,
  g.type as group_type,
  COUNT(DISTINCT qs.prompt_id) as swipe_count,
  COUNT(DISTINCT e.id) as entry_count,
  COUNT(DISTINCT CASE WHEN qs.response = 'yes' THEN qs.prompt_id END) as yes_swipes
FROM groups g
LEFT JOIN group_question_swipes qs ON qs.group_id = g.id
LEFT JOIN entries e ON e.group_id = g.id
GROUP BY g.id, g.type
HAVING COUNT(DISTINCT qs.prompt_id) > 0 
  AND COUNT(DISTINCT e.id) < 5  -- Few entries
ORDER BY swipe_count DESC
LIMIT 5;

-- Test suggestions for swipe-only group
-- Replace with a group_id from above query
SELECT 
  prompt_id,
  ROUND(fit_score::numeric, 4) as fit_score,
  question,
  category,
  depth_level,
  vulnerability_score
FROM suggest_questions_for_group(
  'SWIPE_ONLY_GROUP_ID_HERE'::UUID,  -- Replace with swipe-only group
  10,
  ARRAY[]::UUID[]
)
ORDER BY fit_score DESC;

-- ============================================================================
-- 5. TEST WITH GROUPS THAT HAVE ONLY DECK SELECTIONS
-- ============================================================================

-- Find groups with active decks but few/no entries
SELECT 
  g.id as group_id,
  g.type as group_type,
  COUNT(DISTINCT gad.deck_id) as active_deck_count,
  COUNT(DISTINCT e.id) as entry_count
FROM groups g
JOIN group_active_decks gad ON gad.group_id = g.id AND gad.status = 'active'
LEFT JOIN entries e ON e.group_id = g.id
GROUP BY g.id, g.type
HAVING COUNT(DISTINCT e.id) < 5  -- Few entries
ORDER BY active_deck_count DESC
LIMIT 5;

-- Test suggestions for deck-only group
-- Replace with a group_id from above query
SELECT 
  prompt_id,
  ROUND(fit_score::numeric, 4) as fit_score,
  question,
  category,
  depth_level,
  vulnerability_score
FROM suggest_questions_for_group(
  'DECK_ONLY_GROUP_ID_HERE'::UUID,  -- Replace with deck-only group
  10,
  ARRAY[]::UUID[]
)
ORDER BY fit_score DESC;

-- ============================================================================
-- 6. TEST WITH GROUPS THAT HAVE BOTH SWIPE + ANSWER DATA
-- ============================================================================

-- Find groups with both swipe data and entries
SELECT 
  g.id as group_id,
  g.type as group_type,
  COUNT(DISTINCT qs.prompt_id) as swipe_count,
  COUNT(DISTINCT e.id) as entry_count,
  vp.swipe_preferred_depth,
  vp.avg_preferred_depth,
  vp.swipe_preferred_vulnerability,
  vp.avg_vulnerability_comfort
FROM groups g
JOIN group_vibe_profiles vp ON vp.group_id = g.id
LEFT JOIN group_question_swipes qs ON qs.group_id = g.id
LEFT JOIN entries e ON e.group_id = g.id
GROUP BY g.id, g.type, vp.swipe_preferred_depth, vp.avg_preferred_depth, 
         vp.swipe_preferred_vulnerability, vp.avg_vulnerability_comfort
HAVING COUNT(DISTINCT qs.prompt_id) > 0 
  AND COUNT(DISTINCT e.id) >= 5  -- Has entries
ORDER BY entry_count DESC
LIMIT 5;

-- Compare swipe preferences vs answer preferences
SELECT 
  group_id,
  group_type,
  ROUND(swipe_preferred_depth::numeric, 2) as swipe_depth,
  ROUND(avg_preferred_depth::numeric, 2) as answer_depth,
  ROUND(swipe_preferred_vulnerability::numeric, 2) as swipe_vuln,
  ROUND(avg_vulnerability_comfort::numeric, 2) as answer_vuln,
  ABS(COALESCE(swipe_preferred_depth, 0) - COALESCE(avg_preferred_depth, 0)) as depth_diff,
  ABS(COALESCE(swipe_preferred_vulnerability, 0) - COALESCE(avg_vulnerability_comfort, 0)) as vuln_diff
FROM group_vibe_profiles
WHERE swipe_preferred_depth IS NOT NULL 
  AND avg_preferred_depth IS NOT NULL
ORDER BY depth_diff DESC, vuln_diff DESC
LIMIT 10;

-- ============================================================================
-- 7. TEST WITH ESTABLISHED GROUPS (MANY ENTRIES)
-- ============================================================================

-- Find established groups
SELECT 
  group_id,
  group_type,
  total_prompts_asked,
  total_entries,
  ROUND(avg_completion_rate::numeric, 3) as completion_rate,
  ROUND(avg_preferred_depth::numeric, 2) as preferred_depth,
  ROUND(avg_vulnerability_comfort::numeric, 2) as vulnerability_comfort
FROM group_vibe_profiles
WHERE total_entries >= 20  -- Established group
ORDER BY total_entries DESC
LIMIT 5;

-- Test suggestions for established group
-- Replace with a group_id from above query
SELECT 
  prompt_id,
  ROUND(fit_score::numeric, 4) as fit_score,
  question,
  category,
  depth_level,
  vulnerability_score,
  ROUND(popularity_score::numeric, 3) as popularity
FROM suggest_questions_for_group(
  'ESTABLISHED_GROUP_ID_HERE'::UUID,  -- Replace with established group
  15,
  ARRAY[]::UUID[]
)
ORDER BY fit_score DESC;

-- ============================================================================
-- 8. COMPARE SUGGESTIONS TO ACTUAL ENGAGEMENT (RETROSPECTIVE ANALYSIS)
-- ============================================================================

-- For a specific group, compare suggested questions to questions they actually engaged with
-- Replace with actual group_id
WITH group_suggestions AS (
  SELECT 
    prompt_id,
    fit_score,
    question,
    category
  FROM suggest_questions_for_group(
    'YOUR_GROUP_ID_HERE'::UUID,  -- Replace with actual group_id
    20,
    ARRAY[]::UUID[]
  )
),
group_actual_engagement AS (
  SELECT 
    dp.prompt_id,
    p.question,
    p.category,
    COUNT(DISTINCT e.id) as entry_count,
    COUNT(DISTINCT e.id)::FLOAT / NULLIF(COUNT(DISTINCT gm.user_id), 0) as completion_rate
  FROM daily_prompts dp
  JOIN prompts p ON p.id = dp.prompt_id
  LEFT JOIN entries e ON e.prompt_id = dp.prompt_id AND e.group_id = dp.group_id
  LEFT JOIN group_members gm ON gm.group_id = dp.group_id
  WHERE dp.group_id = 'YOUR_GROUP_ID_HERE'::UUID  -- Replace with actual group_id
  GROUP BY dp.prompt_id, p.question, p.category
)
SELECT 
  COALESCE(gs.prompt_id, gae.prompt_id) as prompt_id,
  COALESCE(gs.question, gae.question) as question,
  COALESCE(gs.category, gae.category) as category,
  ROUND(COALESCE(gs.fit_score, 0)::numeric, 4) as predicted_fit_score,
  COALESCE(gae.entry_count, 0) as actual_entry_count,
  ROUND(COALESCE(gae.completion_rate, 0)::numeric, 3) as actual_completion_rate,
  CASE 
    WHEN gs.prompt_id IS NOT NULL AND gae.prompt_id IS NOT NULL THEN 'Both suggested and asked'
    WHEN gs.prompt_id IS NOT NULL THEN 'Suggested but not asked'
    WHEN gae.prompt_id IS NOT NULL THEN 'Asked but not suggested'
  END as status
FROM group_suggestions gs
FULL OUTER JOIN group_actual_engagement gae ON gs.prompt_id = gae.prompt_id
ORDER BY 
  CASE 
    WHEN gs.prompt_id IS NOT NULL AND gae.prompt_id IS NOT NULL THEN 1
    WHEN gs.prompt_id IS NOT NULL THEN 2
    ELSE 3
  END,
  gs.fit_score DESC NULLS LAST;

-- ============================================================================
-- 9. TEST NEW GROUPS (NO DATA YET)
-- ============================================================================

-- Find new groups with no data
SELECT 
  g.id as group_id,
  g.type as group_type,
  COUNT(DISTINCT dp.id) as prompts_asked,
  COUNT(DISTINCT e.id) as entries,
  COUNT(DISTINCT qs.prompt_id) as swipes
FROM groups g
LEFT JOIN daily_prompts dp ON dp.group_id = g.id
LEFT JOIN entries e ON e.group_id = g.id
LEFT JOIN group_question_swipes qs ON qs.group_id = g.id
GROUP BY g.id, g.type
HAVING COUNT(DISTINCT dp.id) = 0 
  AND COUNT(DISTINCT e.id) = 0
  AND COUNT(DISTINCT qs.prompt_id) = 0
LIMIT 5;

-- Test suggestions for new group (should use global popularity)
-- Replace with a group_id from above query
SELECT 
  prompt_id,
  ROUND(fit_score::numeric, 4) as fit_score,
  question,
  category,
  depth_level,
  vulnerability_score,
  ROUND(popularity_score::numeric, 3) as popularity
FROM suggest_questions_for_group(
  'NEW_GROUP_ID_HERE'::UUID,  -- Replace with new group
  10,
  ARRAY[]::UUID[]
)
ORDER BY fit_score DESC, popularity DESC;

-- ============================================================================
-- 10. VERIFY SCORE DISTRIBUTION AND REASONABLENESS
-- ============================================================================

-- Check score distribution across all groups and questions
SELECT 
  CASE 
    WHEN score < 0.2 THEN '0.0-0.2 (Low)'
    WHEN score < 0.4 THEN '0.2-0.4 (Low-Medium)'
    WHEN score < 0.6 THEN '0.4-0.6 (Medium)'
    WHEN score < 0.8 THEN '0.6-0.8 (Medium-High)'
    ELSE '0.8-1.0 (High)'
  END as score_range,
  COUNT(*) as count,
  ROUND(AVG(score)::numeric, 3) as avg_score
FROM (
  SELECT 
    calculate_question_fit_score(g.id, p.id) as score
  FROM groups g
  CROSS JOIN prompts p
  WHERE p.is_default = true
    AND p.category IN ('Friends', 'Family')
  LIMIT 500  -- Sample size
) scores
GROUP BY score_range
ORDER BY score_range;

-- ============================================================================
-- 11. TEST PROFILE REFRESH FUNCTION
-- ============================================================================

-- Test refresh function (should complete without errors)
SELECT refresh_group_vibe_profiles();

-- Verify refresh worked by checking last refresh time
-- (Note: Materialized views don't track refresh time by default, 
--  but you can verify by checking if data is current)
SELECT 
  COUNT(*) as total_profiles,
  MAX(last_engagement_date) as latest_engagement,
  MAX(last_prompt_date) as latest_prompt
FROM group_vibe_profiles;

-- ============================================================================
-- 12. PERFORMANCE TESTING
-- ============================================================================

-- Test query performance for scoring function
EXPLAIN ANALYZE
SELECT 
  calculate_question_fit_score(g.id, p.id) as score
FROM groups g
CROSS JOIN prompts p
WHERE p.is_default = true
LIMIT 10;

-- Test query performance for suggestions
EXPLAIN ANALYZE
SELECT * FROM suggest_questions_for_group(
  (SELECT id FROM groups LIMIT 1),
  20,
  ARRAY[]::UUID[]
);

