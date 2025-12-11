-- Phase 4: Automation & Integration Testing
-- Test queries for the automation functions

-- ============================================================================
-- TEST 1: Test populate_personalized_queue() function
-- ============================================================================

-- Run the queue population function
SELECT * FROM populate_personalized_queue();

-- Check results: See which groups got prompts added
SELECT 
  g.name as group_name,
  g.type as group_type,
  COUNT(gpq.id) as prompts_in_queue,
  MAX(gpq.position) as max_position
FROM groups g
LEFT JOIN group_prompt_queue gpq ON gpq.group_id = g.id
WHERE g.id IN (
  SELECT result_group_id FROM populate_personalized_queue()
)
GROUP BY g.id, g.name, g.type
ORDER BY prompts_in_queue DESC;

-- ============================================================================
-- TEST 2: Test run_daily_personalization_tasks() function
-- ============================================================================

-- Run daily tasks (refresh profiles + update metrics)
SELECT * FROM run_daily_personalization_tasks();

-- Verify profiles were refreshed
-- Note: Materialized views don't have a last_updated column
-- The refresh happens when refresh_group_vibe_profiles() is called
SELECT 
  group_id,
  total_prompts_asked,
  total_entries,
  group_type,
  member_count,
  avg_completion_rate
FROM group_vibe_profiles
ORDER BY total_prompts_asked DESC
LIMIT 10;

-- Verify global metrics were updated
SELECT 
  id,
  question,
  total_asked_count,
  total_answered_count,
  global_completion_rate,
  popularity_score
FROM prompts
WHERE total_asked_count > 0
ORDER BY popularity_score DESC NULLS LAST
LIMIT 10;

-- ============================================================================
-- TEST 3: Test run_weekly_queue_population() function
-- ============================================================================

-- Run weekly queue population
SELECT * FROM run_weekly_queue_population();

-- ============================================================================
-- TEST 4: Verify queue population logic
-- ============================================================================

-- Check that prompts added to queue match group type
SELECT 
  g.name as group_name,
  g.type as group_type,
  p.question,
  p.category,
  gpq.position,
  gpq.created_at
FROM group_prompt_queue gpq
JOIN groups g ON g.id = gpq.group_id
JOIN prompts p ON p.id = gpq.prompt_id
WHERE gpq.created_at >= CURRENT_DATE - INTERVAL '1 day'
ORDER BY g.name, gpq.position;

-- Verify no duplicates in queue (same prompt_id for same group)
SELECT 
  group_id,
  prompt_id,
  COUNT(*) as duplicate_count
FROM group_prompt_queue
GROUP BY group_id, prompt_id
HAVING COUNT(*) > 1;

-- Verify prompts aren't duplicated from recent daily_prompts
SELECT 
  gpq.group_id,
  gpq.prompt_id,
  p.question,
  MAX(dp.date) as last_asked_date
FROM group_prompt_queue gpq
JOIN prompts p ON p.id = gpq.prompt_id
LEFT JOIN daily_prompts dp ON dp.group_id = gpq.group_id AND dp.prompt_id = gpq.prompt_id
WHERE gpq.created_at >= CURRENT_DATE - INTERVAL '1 day'
GROUP BY gpq.group_id, gpq.prompt_id, p.question
HAVING MAX(dp.date) >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY last_asked_date DESC;

-- ============================================================================
-- TEST 5: Performance testing
-- ============================================================================

-- Time the profile refresh
\timing on
SELECT refresh_group_vibe_profiles();
\timing off

-- Time the global metrics update
\timing on
SELECT update_question_global_metrics();
\timing off

-- Time the queue population (for a subset of groups)
\timing on
SELECT * FROM populate_personalized_queue();
\timing off

-- ============================================================================
-- TEST 6: Edge cases
-- ============================================================================

-- Test with a new group (should use global popularity)
SELECT 
  s.prompt_id,
  s.fit_score,
  s.question,
  s.category
FROM suggest_questions_for_group(
  'YOUR_NEW_GROUP_ID_HERE'::UUID,  -- Replace with actual new group ID
  5,
  ARRAY[]::UUID[]
) s
ORDER BY s.fit_score DESC;

-- Test with a group that has many prompts already asked
SELECT 
  g.id,
  g.name,
  COUNT(DISTINCT dp.prompt_id) as prompts_asked_count,
  COUNT(DISTINCT gpq.prompt_id) as prompts_in_queue
FROM groups g
LEFT JOIN daily_prompts dp ON dp.group_id = g.id
LEFT JOIN group_prompt_queue gpq ON gpq.group_id = g.id
GROUP BY g.id, g.name
HAVING COUNT(DISTINCT dp.prompt_id) > 50
ORDER BY prompts_asked_count DESC
LIMIT 5;

