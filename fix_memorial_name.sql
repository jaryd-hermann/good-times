-- Fix memorial name for group 8dd82cfd-7328-4deb-96c0-d729f7fc8e68
-- The question showed "Amelia" correctly, but after posting it changed to "Gumbo"
-- This query fixes the prompt_name_usage record to use "Amelia"

-- Step 1: Check current state - see what records exist
SELECT 
  pnu.id,
  pnu.group_id,
  pnu.prompt_id,
  pnu.date_used,
  pnu.name_used as current_name,
  p.question as prompt_question,
  p.category,
  pnu.created_at
FROM prompt_name_usage pnu
JOIN prompts p ON pnu.prompt_id = p.id
WHERE pnu.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND pnu.variable_type = 'memorial_name'
  AND pnu.date_used >= CURRENT_DATE - INTERVAL '1 day'  -- Check today and yesterday
ORDER BY pnu.date_used DESC, pnu.created_at DESC;

-- Step 2: DELETE ALL "Gumbo" records for this date (there might be multiple)
-- There's already a correct "Amelia" record, so we just need to remove ALL duplicate "Gumbo" ones
DELETE FROM prompt_name_usage
WHERE group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND variable_type = 'memorial_name'
  AND date_used = '2025-12-01'  -- Use exact date from logs
  AND name_used = 'Gumbo'
RETURNING 
  id,
  prompt_id,
  date_used,
  name_used as deleted_name,
  created_at;

-- Step 3: DELETE ALL "Gumbo" records for this prompt and date (comprehensive cleanup)
-- This ensures we remove ALL duplicates, not just one
DELETE FROM prompt_name_usage
WHERE group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND prompt_id = '7320e5d3-bbbd-45a3-bc14-008b543ccd77'  -- Exact prompt_id from logs
  AND variable_type = 'memorial_name'
  AND date_used = '2025-12-01'  -- Exact date from logs
  AND name_used = 'Gumbo'
RETURNING 
  id,
  prompt_id,
  date_used,
  name_used as deleted_name,
  created_at;

-- Step 4: Verify the fix - check that "Amelia" is now recorded
SELECT 
  pnu.id,
  pnu.group_id,
  pnu.prompt_id,
  pnu.date_used,
  pnu.name_used,
  p.question as prompt_question,
  p.category
FROM prompt_name_usage pnu
JOIN prompts p ON pnu.prompt_id = p.id
WHERE pnu.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND pnu.variable_type = 'memorial_name'
  AND pnu.date_used >= CURRENT_DATE - INTERVAL '1 day'
ORDER BY pnu.date_used DESC, pnu.created_at DESC;

