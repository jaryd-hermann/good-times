-- Check all prompts for this group to find the problematic one
-- This will show prompts with {memorial_name} in the question text

-- Check today's prompt
SELECT 
  dp.id as daily_prompt_id,
  dp.date,
  dp.prompt_id,
  p.question,
  p.category,
  p.dynamic_variables,
  p.ice_breaker,
  CASE 
    WHEN p.question LIKE '%{memorial_name}%' OR p.question LIKE '%memorial_name%' THEN 'HAS MEMORIAL_NAME'
    ELSE 'OK'
  END as has_memorial_var
FROM daily_prompts dp
JOIN prompts p ON dp.prompt_id = p.id
WHERE dp.group_id = '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2'
ORDER BY dp.date DESC
LIMIT 10;

-- Check specifically for prompts with memorial_name variable
SELECT 
  dp.id as daily_prompt_id,
  dp.date,
  dp.prompt_id,
  p.question,
  p.category,
  p.dynamic_variables,
  p.dynamic_variables::text as dynamic_vars_text
FROM daily_prompts dp
JOIN prompts p ON dp.prompt_id = p.id
WHERE dp.group_id = '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2'
  AND (
    p.question LIKE '%{memorial_name}%' 
    OR p.question LIKE '%memorial_name%'
    OR (p.dynamic_variables IS NOT NULL AND p.dynamic_variables::text LIKE '%memorial_name%')
  )
ORDER BY dp.date DESC
LIMIT 5;

