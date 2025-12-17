-- Debug query to check what's happening with the Remembering prompt for this group today
-- Group ID: 8dd82cfd-7328-4deb-96c0-d729f7fc8e68

-- 1. Check today's daily prompt
SELECT 
  dp.id,
  dp.date,
  dp.prompt_id,
  dp.user_id,
  p.question,
  p.category,
  p.description,
  p.dynamic_variables,
  LENGTH(p.question) as question_length,
  CASE 
    WHEN p.question IS NULL THEN 'NULL'
    WHEN p.question = '' THEN 'EMPTY STRING'
    WHEN TRIM(p.question) = '' THEN 'WHITESPACE ONLY'
    WHEN p.question ~ '\{.*memorial_name.*\}' THEN 'HAS MEMORIAL_NAME VARIABLE'
    WHEN p.question ~ '\{.*member_name.*\}' THEN 'HAS MEMBER_NAME VARIABLE'
    ELSE 'NO VARIABLES'
  END as question_status,
  dp.created_at as prompt_scheduled_at
FROM daily_prompts dp
JOIN prompts p ON dp.prompt_id = p.id
WHERE dp.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND dp.date = CURRENT_DATE
ORDER BY dp.user_id NULLS FIRST;

-- 2. Check memorials for this group
SELECT 
  m.id,
  m.name,
  m.user_id,
  m.group_id,
  m.photo_url,
  m.created_at
FROM memorials m
WHERE m.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
ORDER BY m.created_at;

-- 3. Check prompt_name_usage for memorial_name for today
SELECT 
  pnu.id,
  pnu.prompt_id,
  pnu.variable_type,
  pnu.name_used,
  pnu.date_used,
  pnu.created_at,
  p.question
FROM prompt_name_usage pnu
JOIN prompts p ON pnu.prompt_id = p.id
WHERE pnu.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND pnu.variable_type = 'memorial_name'
  AND pnu.date_used = CURRENT_DATE
ORDER BY pnu.created_at;

-- 4. Check if the prompt question is actually empty in the database
SELECT 
  p.id,
  p.question,
  p.category,
  LENGTH(p.question) as length,
  p.question = '' as is_empty_string,
  TRIM(p.question) = '' as is_whitespace_only,
  p.dynamic_variables
FROM daily_prompts dp
JOIN prompts p ON dp.prompt_id = p.id
WHERE dp.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND dp.date = CURRENT_DATE
  AND p.category = 'Remembering';

