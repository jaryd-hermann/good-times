-- Fix today's prompt_name_usage to use only "Rose" for group 8dd82cfd-7328-4deb-96c0-d729f7fc8e68
-- This will ensure consistency across all places in the app

-- Step 1: Check what we have for today
SELECT 
  pnu.*,
  p.question,
  dp.date as daily_prompt_date
FROM prompt_name_usage pnu
JOIN prompts p ON pnu.prompt_id = p.id
LEFT JOIN daily_prompts dp ON pnu.group_id = dp.group_id 
  AND pnu.prompt_id = dp.prompt_id
  AND pnu.date_used = dp.date
WHERE pnu.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND pnu.date_used = CURRENT_DATE
ORDER BY pnu.created_at ASC;

-- Step 2: Delete all records for today EXCEPT the one with "Rose"
-- If no "Rose" record exists, we'll create one after
DELETE FROM prompt_name_usage
WHERE group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND date_used = CURRENT_DATE
  AND name_used != 'Rose';

-- Step 3: Get today's prompt_id from daily_prompts to ensure we have the right one
SELECT 
  dp.prompt_id,
  p.question,
  p.dynamic_variables
FROM daily_prompts dp
JOIN prompts p ON dp.prompt_id = p.id
WHERE dp.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND dp.date = CURRENT_DATE;

-- Step 4: If no "Rose" record exists, create one with today's prompt_id
-- First, let's check if we need to create it
DO $$
DECLARE
    today_prompt_id UUID;
    has_rose_record BOOLEAN;
BEGIN
    -- Get today's prompt_id
    SELECT prompt_id INTO today_prompt_id
    FROM daily_prompts
    WHERE group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
      AND date = CURRENT_DATE
    LIMIT 1;
    
    IF today_prompt_id IS NULL THEN
        RAISE NOTICE 'No daily_prompt found for today. Cannot create prompt_name_usage record.';
    ELSE
        -- Check if Rose record exists
        SELECT EXISTS(
            SELECT 1
            FROM prompt_name_usage
            WHERE group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
              AND prompt_id = today_prompt_id
              AND date_used = CURRENT_DATE
              AND name_used = 'Rose'
        ) INTO has_rose_record;
        
        IF NOT has_rose_record THEN
            -- Determine variable_type based on prompt
            -- Check if prompt has member_name or memorial_name variable
            IF EXISTS(
                SELECT 1
                FROM prompts
                WHERE id = today_prompt_id
                  AND (
                    dynamic_variables @> '["member_name"]'::jsonb
                    OR question LIKE '%{member_name}%'
                    OR question LIKE '%member_name%'
                  )
            ) THEN
                -- Insert member_name record
                INSERT INTO prompt_name_usage (
                    group_id,
                    prompt_id,
                    variable_type,
                    name_used,
                    date_used
                ) VALUES (
                    '8dd82cfd-7328-4deb-96c0-d729f7fc8e68',
                    today_prompt_id,
                    'member_name',
                    'Rose',
                    CURRENT_DATE
                ) ON CONFLICT (group_id, prompt_id, variable_type, date_used) DO NOTHING;
                RAISE NOTICE 'Created member_name record for Rose';
            ELSIF EXISTS(
                SELECT 1
                FROM prompts
                WHERE id = today_prompt_id
                  AND (
                    dynamic_variables @> '["memorial_name"]'::jsonb
                    OR question LIKE '%{memorial_name}%'
                    OR question LIKE '%memorial_name%'
                    OR category = 'Remembering'
                  )
            ) THEN
                -- Insert memorial_name record
                INSERT INTO prompt_name_usage (
                    group_id,
                    prompt_id,
                    variable_type,
                    name_used,
                    date_used
                ) VALUES (
                    '8dd82cfd-7328-4deb-96c0-d729f7fc8e68',
                    today_prompt_id,
                    'memorial_name',
                    'Rose',
                    CURRENT_DATE
                ) ON CONFLICT (group_id, prompt_id, variable_type, date_used) DO NOTHING;
                RAISE NOTICE 'Created memorial_name record for Rose';
            ELSE
                RAISE NOTICE 'Prompt does not have member_name or memorial_name variables. No record created.';
            END IF;
        ELSE
            RAISE NOTICE 'Rose record already exists for today';
        END IF;
    END IF;
END $$;

-- Step 5: Verify the fix - should show only one record with "Rose" for today
SELECT 
  pnu.*,
  p.question,
  dp.date as daily_prompt_date
FROM prompt_name_usage pnu
JOIN prompts p ON pnu.prompt_id = p.id
LEFT JOIN daily_prompts dp ON pnu.group_id = dp.group_id 
  AND pnu.prompt_id = dp.prompt_id
  AND pnu.date_used = dp.date
WHERE pnu.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND pnu.date_used = CURRENT_DATE
ORDER BY pnu.created_at ASC;

