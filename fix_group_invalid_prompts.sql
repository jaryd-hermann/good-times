-- Fix invalid prompts for group 4d129d3e-b14c-4d9b-88b7-43ec67d98ca2
-- Replace non-ice-breaker questions scheduled from TODAY forward (not backward)
-- Only during ice-breaker period (before 2025-12-07)

-- Step 1: Check what we're replacing (from today forward only)
SELECT 
  dp.id as daily_prompt_id,
  dp.date,
  p.question as old_question,
  p.category,
  p.ice_breaker,
  p.dynamic_variables
FROM daily_prompts dp
JOIN prompts p ON dp.prompt_id = p.id
WHERE dp.group_id = '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2'
  AND dp.date >= CURRENT_DATE  -- From today forward only
  AND dp.date < '2025-12-07'  -- Before ice-breaker period ends
  AND (
    p.ice_breaker = false  -- Non-ice-breaker questions
    OR p.category = 'Remembering'  -- Remembering category (shouldn't be there)
  )
ORDER BY dp.date ASC;

-- Step 2: Find available friend ice-breaker questions (no dynamic variables)
SELECT 
  id as prompt_id,
  question,
  category,
  ice_breaker,
  dynamic_variables
FROM prompts
WHERE ice_breaker = true
  AND category = 'Friends'
  AND (dynamic_variables IS NULL OR dynamic_variables = '[]'::jsonb OR jsonb_array_length(dynamic_variables) = 0)
ORDER BY created_at ASC
LIMIT 20;

-- Step 3: Replace invalid prompts with valid friend ice-breaker questions (from today forward only)
WITH invalid_prompts AS (
  SELECT 
    dp.id as daily_prompt_id,
    dp.date,
    ROW_NUMBER() OVER (ORDER BY dp.date ASC) as rn
  FROM daily_prompts dp
  JOIN prompts p ON dp.prompt_id = p.id
  WHERE dp.group_id = '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2'
    AND dp.date >= CURRENT_DATE  -- From today forward only
    AND dp.date < '2025-12-07'  -- Before ice-breaker period ends
    AND (
      p.ice_breaker = false  -- Non-ice-breaker questions
      OR p.category = 'Remembering'  -- Remembering category
    )
),
valid_icebreakers AS (
  SELECT 
    id as prompt_id,
    ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM prompts
  WHERE ice_breaker = true
    AND category = 'Friends'
    AND (dynamic_variables IS NULL OR dynamic_variables = '[]'::jsonb OR jsonb_array_length(dynamic_variables) = 0)
),
matched_prompts AS (
  SELECT 
    ip.daily_prompt_id,
    ip.date,
    vb.prompt_id as new_prompt_id,
    (SELECT question FROM prompts WHERE id = vb.prompt_id) as new_question
  FROM invalid_prompts ip
  JOIN valid_icebreakers vb ON ((ip.rn - 1) % (SELECT COUNT(*) FROM valid_icebreakers)) + 1 = vb.rn
)
UPDATE daily_prompts
SET prompt_id = matched_prompts.new_prompt_id
FROM matched_prompts
WHERE daily_prompts.id = matched_prompts.daily_prompt_id
RETURNING 
  daily_prompts.id,
  daily_prompts.date,
  daily_prompts.prompt_id,
  (SELECT question FROM prompts WHERE id = matched_prompts.new_prompt_id) as new_question;

-- Step 4: Verify the fixes (from today forward)
SELECT 
  dp.id as daily_prompt_id,
  dp.date,
  p.question,
  p.category,
  p.ice_breaker,
  p.dynamic_variables
FROM daily_prompts dp
JOIN prompts p ON dp.prompt_id = p.id
WHERE dp.group_id = '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2'
  AND dp.date >= CURRENT_DATE  -- From today forward only
  AND dp.date < '2025-12-07'
ORDER BY dp.date ASC;

