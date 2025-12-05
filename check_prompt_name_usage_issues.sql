-- SQL Queries to investigate prompt_name_usage issues

-- 1. Check all duplicate records (same prompt+date but different names)
SELECT 
  group_id,
  prompt_id,
  variable_type,
  date_used,
  COUNT(*) as duplicate_count,
  STRING_AGG(name_used, ', ' ORDER BY created_at) as all_names_used,
  STRING_AGG(created_at::text, ', ' ORDER BY created_at) as created_times
FROM prompt_name_usage
WHERE group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
GROUP BY group_id, prompt_id, variable_type, date_used
HAVING COUNT(*) > 1
ORDER BY date_used DESC, prompt_id;

-- 2. Check if prompt_name_usage records exist for dates that don't have daily_prompts
SELECT 
  pnu.group_id,
  pnu.prompt_id,
  pnu.date_used,
  pnu.variable_type,
  pnu.name_used,
  pnu.created_at,
  CASE WHEN dp.id IS NULL THEN 'NO DAILY_PROMPT' ELSE 'HAS DAILY_PROMPT' END as has_daily_prompt
FROM prompt_name_usage pnu
LEFT JOIN daily_prompts dp ON pnu.group_id = dp.group_id 
  AND pnu.prompt_id = dp.prompt_id
  AND pnu.date_used = dp.date
WHERE pnu.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
ORDER BY pnu.date_used DESC, pnu.created_at DESC;

-- 3. Check the current unique constraint definition
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'prompt_name_usage'::regclass
  AND contype = 'u';

-- 4. See all records for the problematic prompts
SELECT 
  pnu.*,
  p.question,
  dp.date as daily_prompt_date,
  CASE WHEN dp.id IS NULL THEN 'ORPHANED' ELSE 'VALID' END as status
FROM prompt_name_usage pnu
JOIN prompts p ON pnu.prompt_id = p.id
LEFT JOIN daily_prompts dp ON pnu.group_id = dp.group_id 
  AND pnu.prompt_id = dp.prompt_id
  AND pnu.date_used = dp.date
WHERE pnu.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND pnu.prompt_id IN (
    '2fba026f-f53f-4763-b317-b00d0c44c518',
    'f4f37290-f842-4d58-95ff-25bf3c2b07b4'
  )
ORDER BY pnu.date_used DESC, pnu.created_at ASC;

