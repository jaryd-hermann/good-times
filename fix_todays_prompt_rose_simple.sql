-- Fix today's prompt_name_usage to use only "Rose" for group 8dd82cfd-7328-4deb-96c0-d729f7fc8e68
-- This ensures consistency across all places in the app

-- Step 1: Check what we currently have for today
SELECT 
  pnu.*,
  p.question,
  CASE 
    WHEN p.question LIKE '%{member_name}%' OR p.question LIKE '%member_name%' THEN 'member_name'
    WHEN p.question LIKE '%{memorial_name}%' OR p.question LIKE '%memorial_name%' OR p.category = 'Remembering' THEN 'memorial_name'
    ELSE 'unknown'
  END as expected_variable_type
FROM prompt_name_usage pnu
JOIN prompts p ON pnu.prompt_id = p.id
WHERE pnu.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND pnu.date_used = CURRENT_DATE
ORDER BY pnu.created_at ASC;

-- Step 2: Delete ALL records for today (we'll recreate with Rose)
DELETE FROM prompt_name_usage
WHERE group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND date_used = CURRENT_DATE;

-- Step 3: Get today's prompt and create Rose record
DO $$
DECLARE
    today_prompt_id UUID;
    today_variable_type TEXT;
    today_question TEXT;
BEGIN
    -- Get today's prompt_id
    SELECT dp.prompt_id, p.question INTO today_prompt_id, today_question
    FROM daily_prompts dp
    JOIN prompts p ON dp.prompt_id = p.id
    WHERE dp.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
      AND dp.date = CURRENT_DATE
    LIMIT 1;
    
    IF today_prompt_id IS NULL THEN
        RAISE EXCEPTION 'No daily_prompt found for today for this group';
    END IF;
    
    -- Determine variable_type based on prompt question
    IF today_question LIKE '%{member_name}%' OR today_question LIKE '%member_name%' THEN
        today_variable_type := 'member_name';
    ELSIF today_question LIKE '%{memorial_name}%' OR today_question LIKE '%memorial_name%' THEN
        today_variable_type := 'memorial_name';
    ELSE
        -- Check if it's a Remembering category prompt
        SELECT 
            CASE 
                WHEN category = 'Remembering' THEN 'memorial_name'
                ELSE NULL
            END INTO today_variable_type
        FROM prompts
        WHERE id = today_prompt_id;
        
        IF today_variable_type IS NULL THEN
            RAISE EXCEPTION 'Prompt does not have member_name or memorial_name variables';
        END IF;
    END IF;
    
    -- Insert Rose record
    INSERT INTO prompt_name_usage (
        group_id,
        prompt_id,
        variable_type,
        name_used,
        date_used
    ) VALUES (
        '8dd82cfd-7328-4deb-96c0-d729f7fc8e68',
        today_prompt_id,
        today_variable_type,
        'Rose',
        CURRENT_DATE
    ) ON CONFLICT (group_id, prompt_id, variable_type, date_used) DO UPDATE
    SET name_used = 'Rose';
    
    RAISE NOTICE 'Created/Updated prompt_name_usage record: prompt_id=%, variable_type=%, name_used=Rose', today_prompt_id, today_variable_type;
END $$;

-- Step 4: Verify the fix - should show only ONE record with "Rose" for today
SELECT 
  pnu.*,
  p.question
FROM prompt_name_usage pnu
JOIN prompts p ON pnu.prompt_id = p.id
WHERE pnu.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND pnu.date_used = CURRENT_DATE;

