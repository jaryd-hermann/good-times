-- AGGRESSIVE fix for today's prompt_name_usage to use only "Rose"
-- This will force cache invalidation by updating created_at timestamp
-- Group: 8dd82cfd-7328-4deb-96c0-d729f7fc8e68
-- Prompt: 2fba026f-f53f-4763-b317-b00d0c44c518
-- Date: 2025-12-05

-- Step 1: Delete ALL records for today (clean slate)
DELETE FROM prompt_name_usage
WHERE group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND prompt_id = '2fba026f-f53f-4763-b317-b00d0c44c518'
  AND date_used = '2025-12-05';

-- Step 2: Insert Rose record with CURRENT timestamp (forces cache refresh)
INSERT INTO prompt_name_usage (
    group_id,
    prompt_id,
    variable_type,
    name_used,
    date_used,
    created_at
) VALUES (
    '8dd82cfd-7328-4deb-96c0-d729f7fc8e68',
    '2fba026f-f53f-4763-b317-b00d0c44c518',
    'member_name',
    'Rose',
    '2025-12-05',
    NOW() -- Force new timestamp to invalidate caches
) ON CONFLICT (group_id, prompt_id, variable_type, date_used) 
DO UPDATE SET 
    name_used = 'Rose',
    created_at = NOW(); -- Update timestamp to force cache refresh

-- Step 3: Verify - should show ONLY ONE record with Rose
SELECT 
  pnu.*,
  p.question
FROM prompt_name_usage pnu
JOIN prompts p ON pnu.prompt_id = p.id
WHERE pnu.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND pnu.prompt_id = '2fba026f-f53f-4763-b317-b00d0c44c518'
  AND pnu.date_used = '2025-12-05';

