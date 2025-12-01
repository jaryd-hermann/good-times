-- Replace invalid "Remembering" prompt with a valid friend ice breaker
-- For group: 4d129d3e-b14c-4d9b-88b7-43ec67d98ca2

-- Step 1: First, let's see what we're replacing
SELECT 
  dp.id as daily_prompt_id,
  dp.date,
  p.question as old_question,
  p.category as old_category
FROM daily_prompts dp
JOIN prompts p ON dp.prompt_id = p.id
WHERE dp.group_id = '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2'
  AND p.category = 'Remembering'
ORDER BY dp.date DESC
LIMIT 1;

-- Step 2: Find a valid friend ice breaker (no dynamic variables)
SELECT 
  id as new_prompt_id,
  question as new_question,
  category,
  ice_breaker
FROM prompts
WHERE ice_breaker = true
  AND category = 'Friends'
  AND (dynamic_variables IS NULL OR array_length(dynamic_variables, 1) IS NULL)
ORDER BY created_at ASC
LIMIT 1;

-- Step 3: Replace the invalid prompt
WITH invalid_prompt AS (
  SELECT dp.id, dp.date
  FROM daily_prompts dp
  JOIN prompts p ON dp.prompt_id = p.id
  WHERE dp.group_id = '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2'
    AND p.category = 'Remembering'
  ORDER BY dp.date DESC
  LIMIT 1
),
valid_icebreaker AS (
  SELECT id as prompt_id
  FROM prompts
  WHERE ice_breaker = true
    AND category = 'Friends'
    AND (dynamic_variables IS NULL OR array_length(dynamic_variables, 1) IS NULL)
  ORDER BY created_at ASC
  LIMIT 1
)
UPDATE daily_prompts
SET prompt_id = (SELECT prompt_id FROM valid_icebreaker)
WHERE id = (SELECT id FROM invalid_prompt)
RETURNING 
  id,
  date,
  prompt_id,
  (SELECT question FROM prompts WHERE id = (SELECT prompt_id FROM valid_icebreaker)) as new_question;

