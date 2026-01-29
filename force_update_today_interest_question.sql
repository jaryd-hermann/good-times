-- Force update today's question for a group to be an interest-based question
-- Group ID: 4d129d3e-b14c-4d9b-88b7-43ec67d98ca2

-- Step 1: Delete existing daily_prompt for today
DELETE FROM daily_prompts
WHERE group_id = '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2'
  AND date = CURRENT_DATE
  AND user_id IS NULL;

-- Step 2: Insert new interest-based prompt for today
WITH group_explicit_interests AS (
  -- Get all explicit interests for this group
  SELECT 
    i.id as interest_id,
    i.name as interest_name
  FROM group_interests gi
  INNER JOIN interests i ON i.id = gi.interest_id
  WHERE gi.group_id = '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2'
),
asked_prompt_ids AS (
  -- Get all prompts that have been asked by this group
  SELECT DISTINCT prompt_id
  FROM daily_prompts
  WHERE group_id = '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2'
    AND user_id IS NULL
),
available_interest_prompts AS (
  -- Find Standard prompts that match group's interests and haven't been asked
  SELECT DISTINCT p.id as prompt_id, p.question, p.interests
  FROM prompts p
  CROSS JOIN group_explicit_interests gei
  WHERE p.category = 'Standard'
    AND p.interests @> ARRAY[gei.interest_name]::text[]
    AND p.id NOT IN (SELECT prompt_id FROM asked_prompt_ids)
  ORDER BY p.id
  LIMIT 100
),
selected_prompt AS (
  -- Randomly select one prompt from available options
  SELECT prompt_id, question, interests
  FROM available_interest_prompts
  ORDER BY RANDOM()
  LIMIT 1
)
INSERT INTO daily_prompts (group_id, prompt_id, date, user_id, is_discovery, discovery_interest)
SELECT 
  '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2'::uuid as group_id,
  sp.prompt_id,
  CURRENT_DATE as date,
  NULL as user_id,
  false as is_discovery,
  NULL as discovery_interest
FROM selected_prompt sp
RETURNING 
  prompt_id,
  (SELECT question FROM prompts WHERE id = prompt_id) as question,
  (SELECT interests FROM prompts WHERE id = prompt_id) as interests;

-- Alternative: If you want to see what would be selected first, run this query:
/*
WITH group_explicit_interests AS (
  SELECT 
    i.id as interest_id,
    i.name as interest_name
  FROM group_interests gi
  INNER JOIN interests i ON i.id = gi.interest_id
  WHERE gi.group_id = '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2'
),
asked_prompt_ids AS (
  SELECT DISTINCT prompt_id
  FROM daily_prompts
  WHERE group_id = '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2'
    AND user_id IS NULL
)
SELECT 
  p.id as prompt_id,
  p.question,
  p.interests,
  array_agg(gei.interest_name) as matching_group_interests
FROM prompts p
CROSS JOIN group_explicit_interests gei
WHERE p.category = 'Standard'
  AND p.interests @> ARRAY[gei.interest_name]::text[]
  AND p.id NOT IN (SELECT prompt_id FROM asked_prompt_ids)
GROUP BY p.id, p.question, p.interests
ORDER BY RANDOM()
LIMIT 10;
*/
