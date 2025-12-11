-- Fix memorial questions for group 8dd82cfd-7328-4deb-96c0-d729f7fc8e68
-- Remove all memorial questions scheduled for this week (keep only the first one)

-- Get current week start (Monday)
WITH week_start AS (
  SELECT date_trunc('week', CURRENT_DATE)::date AS start_date
),
-- Get all memorial questions scheduled this week
memorial_questions_this_week AS (
  SELECT 
    dp.id,
    dp.date,
    dp.prompt_id,
    p.category,
    ROW_NUMBER() OVER (ORDER BY dp.date ASC) as rn
  FROM daily_prompts dp
  JOIN prompts p ON dp.prompt_id = p.id
  CROSS JOIN week_start ws
  WHERE dp.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
    AND p.category = 'Remembering'
    AND dp.date >= ws.start_date
    AND dp.date <= CURRENT_DATE
    AND dp.user_id IS NULL -- Only general prompts
)
-- Delete all except the first one (keep the earliest)
DELETE FROM daily_prompts
WHERE id IN (
  SELECT id 
  FROM memorial_questions_this_week 
  WHERE rn > 1
);

-- Show what's left
SELECT 
  dp.date,
  p.question,
  pnu.name_used as memorial_name
FROM daily_prompts dp
JOIN prompts p ON dp.prompt_id = p.id
LEFT JOIN prompt_name_usage pnu ON 
  pnu.group_id = dp.group_id 
  AND pnu.prompt_id = dp.prompt_id 
  AND pnu.variable_type = 'memorial_name'
  AND pnu.date_used = dp.date
WHERE dp.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND p.category = 'Remembering'
  AND dp.date >= date_trunc('week', CURRENT_DATE)::date
  AND dp.date <= CURRENT_DATE
ORDER BY dp.date ASC;

