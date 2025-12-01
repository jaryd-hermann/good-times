-- Check what's actually stored for the entry and prompt
-- Replace ENTRY_ID with the actual entry ID that's showing "Gumbo"

-- Step 1: Find entries for this group from today
SELECT 
  e.id as entry_id,
  e.date,
  e.prompt_id,
  p.question as prompt_question,
  p.dynamic_variables,
  p.category
FROM entries e
JOIN prompts p ON e.prompt_id = p.id
WHERE e.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND e.date = CURRENT_DATE
ORDER BY e.created_at DESC
LIMIT 5;

-- Step 2: Check prompt_name_usage for today
SELECT 
  pnu.*,
  p.question as prompt_question
FROM prompt_name_usage pnu
JOIN prompts p ON pnu.prompt_id = p.id
WHERE pnu.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND pnu.variable_type = 'memorial_name'
  AND pnu.date_used = CURRENT_DATE
ORDER BY pnu.created_at DESC;

-- Step 3: Check if prompt question already has names in it (shouldn't happen)
SELECT 
  p.id,
  p.question,
  p.category
FROM prompts p
WHERE p.question ILIKE '%Gumbo%' OR p.question ILIKE '%Amelia%'
LIMIT 10;

