-- Debug: Why is suggest_questions_for_group returning no rows?
-- Replace YOUR_GROUP_ID_HERE with an actual group_id

-- Step 1: Check if group exists and get its type
SELECT 
  id,
  name,
  type,
  created_at
FROM groups
WHERE id = 'YOUR_GROUP_ID_HERE'::UUID;

-- Step 2: Check if group has a profile
SELECT *
FROM group_vibe_profiles
WHERE group_id = 'YOUR_GROUP_ID_HERE'::UUID;

-- Step 3: Check available prompts (what the function is filtering from)
SELECT 
  COUNT(*) as total_prompts,
  COUNT(CASE WHEN is_default = true THEN 1 END) as is_default_true,
  COUNT(CASE WHEN is_default = false THEN 1 END) as is_default_false,
  COUNT(CASE WHEN is_default IS NULL THEN 1 END) as is_default_null,
  COUNT(CASE WHEN is_training = true THEN 1 END) as is_training_true,
  COUNT(CASE WHEN is_training = false THEN 1 END) as is_training_false,
  COUNT(CASE WHEN is_training IS NULL THEN 1 END) as is_training_null
FROM prompts;

-- Step 4: Check prompts by category (for new groups)
SELECT 
  category,
  COUNT(*) as count,
  COUNT(CASE WHEN is_default = true THEN 1 END) as is_default_count,
  COUNT(CASE WHEN is_training = false OR is_training IS NULL THEN 1 END) as available_count
FROM prompts
GROUP BY category
ORDER BY category;

-- Step 5: Test the exact query the function would run for a new group
-- Replace 'Friends' with 'Family' if testing a family group
SELECT 
  p.id as prompt_id,
  COALESCE(p.popularity_score, 0.5) as fit_score,
  p.question,
  p.category,
  p.depth_level,
  p.vulnerability_score,
  p.popularity_score,
  p.is_default,
  p.is_training
FROM prompts p
WHERE p.is_default = true
  AND p.category = 'Friends'  -- Change to 'Family' if needed
  AND (p.is_training = false OR p.is_training IS NULL)  -- Handle NULL case
ORDER BY 
  COALESCE(p.popularity_score, 0.5) DESC,
  COALESCE(p.global_completion_rate, 0.0) DESC,
  p.total_asked_count DESC
LIMIT 20;

-- Step 6: Test the exact query for an established group
-- Replace with actual group_id
SELECT 
  p.id as prompt_id,
  calculate_question_fit_score('YOUR_GROUP_ID_HERE'::UUID, p.id) as fit_score,
  p.question,
  p.category,
  p.depth_level,
  p.vulnerability_score,
  p.popularity_score,
  p.is_default,
  p.is_training
FROM prompts p
WHERE p.is_default = true
  AND (p.is_training = false OR p.is_training IS NULL)  -- Handle NULL case
ORDER BY 
  calculate_question_fit_score('YOUR_GROUP_ID_HERE'::UUID, p.id) DESC,
  COALESCE(p.popularity_score, 0.5) DESC
LIMIT 20;

