-- Delete the "Gumbo" record for group 8dd82cfd-7328-4deb-96c0-d729f7fc8e68
-- Keep only the "Amelia" record

-- Step 1: Check which record is which (to verify before deleting)
SELECT 
  pnu.id,
  pnu.name_used,
  pnu.created_at,
  pnu.prompt_id,
  pnu.date_used
FROM prompt_name_usage pnu
WHERE pnu.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND pnu.prompt_id = '7320e5d3-bbbd-45a3-bc14-008b543ccd77'
  AND pnu.variable_type = 'memorial_name'
  AND pnu.date_used = '2025-12-01'
ORDER BY pnu.created_at ASC;

-- Step 2: Delete the "Gumbo" record (keeping "Amelia")
-- Delete by name_used to be safe
DELETE FROM prompt_name_usage
WHERE group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND prompt_id = '7320e5d3-bbbd-45a3-bc14-008b543ccd77'
  AND variable_type = 'memorial_name'
  AND date_used = '2025-12-01'
  AND name_used = 'Gumbo'
RETURNING 
  id,
  name_used as deleted_name,
  created_at;

-- Step 3: Verify only "Amelia" remains
SELECT 
  pnu.id,
  pnu.name_used,
  pnu.created_at,
  p.question as prompt_question
FROM prompt_name_usage pnu
JOIN prompts p ON pnu.prompt_id = p.id
WHERE pnu.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND pnu.prompt_id = '7320e5d3-bbbd-45a3-bc14-008b543ccd77'
  AND pnu.variable_type = 'memorial_name'
  AND pnu.date_used = '2025-12-01';

