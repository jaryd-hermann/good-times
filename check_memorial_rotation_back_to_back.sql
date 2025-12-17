-- Query to check for back-to-back occurrences of the same memorial_name
-- Group ID: 8dd82cfd-7328-4deb-96c0-d729f7fc8e68

-- 1. Get all Remembering prompts with their memorial usage, ordered by date
WITH remembering_prompts AS (
  SELECT 
    dp.date,
    dp.prompt_id,
    p.question,
    p.category,
    pnu.name_used as memorial_name,
    pnu.created_at as usage_created_at,
    -- Calculate week start (Monday) for each date
    CASE 
      WHEN EXTRACT(DOW FROM dp.date) = 0 THEN dp.date - INTERVAL '6 days' -- Sunday -> previous Monday
      ELSE dp.date - INTERVAL '1 day' * (EXTRACT(DOW FROM dp.date) - 1) -- Other days -> Monday of this week
    END as week_start
  FROM daily_prompts dp
  JOIN prompts p ON dp.prompt_id = p.id
  LEFT JOIN prompt_name_usage pnu ON 
    pnu.group_id = dp.group_id 
    AND pnu.prompt_id = dp.prompt_id 
    AND pnu.variable_type = 'memorial_name'
    AND pnu.date_used = dp.date
  WHERE dp.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
    AND p.category = 'Remembering'
    AND dp.user_id IS NULL -- Only general prompts
  ORDER BY dp.date ASC
),
-- 2. Add previous row data to detect back-to-back occurrences
with_previous AS (
  SELECT 
    date,
    prompt_id,
    question,
    memorial_name,
    week_start,
    LAG(date) OVER (ORDER BY date) as previous_date,
    LAG(memorial_name) OVER (ORDER BY date) as previous_memorial_name,
    LAG(week_start) OVER (ORDER BY date) as previous_week_start,
    -- Calculate days between consecutive Remembering prompts
    date - LAG(date) OVER (ORDER BY date) as days_since_last
  FROM remembering_prompts
)
-- 3. Identify back-to-back occurrences and analyze pattern
SELECT 
  date,
  previous_date,
  days_since_last,
  memorial_name as current_memorial,
  previous_memorial_name as previous_memorial,
  week_start,
  previous_week_start,
  CASE 
    WHEN previous_memorial_name IS NULL THEN 'First Remembering prompt'
    WHEN memorial_name = previous_memorial_name THEN 'BACK-TO-BACK SAME MEMORIAL ⚠️'
    WHEN week_start = previous_week_start THEN 'Same week (should be same memorial)'
    WHEN week_start != previous_week_start THEN 'Different week (should rotate)'
    ELSE 'Unknown'
  END as status,
  CASE 
    WHEN memorial_name = previous_memorial_name 
      AND week_start != previous_week_start THEN 'ERROR: Same memorial across weeks'
    WHEN memorial_name != previous_memorial_name 
      AND week_start = previous_week_start THEN 'ERROR: Different memorials in same week'
    ELSE 'OK'
  END as rotation_check
FROM with_previous
ORDER BY date DESC;

-- 4. Summary: Count back-to-back occurrences (separate query)
WITH remembering_prompts AS (
  SELECT 
    dp.date,
    pnu.name_used as memorial_name,
    CASE 
      WHEN EXTRACT(DOW FROM dp.date) = 0 THEN dp.date - INTERVAL '6 days'
      ELSE dp.date - INTERVAL '1 day' * (EXTRACT(DOW FROM dp.date) - 1)
    END as week_start
  FROM daily_prompts dp
  JOIN prompts p ON dp.prompt_id = p.id
  LEFT JOIN prompt_name_usage pnu ON 
    pnu.group_id = dp.group_id 
    AND pnu.prompt_id = dp.prompt_id 
    AND pnu.variable_type = 'memorial_name'
    AND pnu.date_used = dp.date
  WHERE dp.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
    AND p.category = 'Remembering'
    AND dp.user_id IS NULL
),
with_previous AS (
  SELECT 
    date,
    memorial_name,
    LAG(memorial_name) OVER (ORDER BY date) as previous_memorial_name
  FROM remembering_prompts
)
SELECT 
  COUNT(*) FILTER (WHERE memorial_name = previous_memorial_name AND previous_memorial_name IS NOT NULL) as back_to_back_count,
  COUNT(*) FILTER (WHERE memorial_name != previous_memorial_name AND previous_memorial_name IS NOT NULL) as proper_rotation_count,
  COUNT(*) as total_remembering_prompts,
  COUNT(DISTINCT memorial_name) as unique_memorials_used
FROM with_previous;

-- 5. Check all memorials for this group
SELECT 
  m.id,
  m.name,
  m.created_at,
  ROW_NUMBER() OVER (ORDER BY m.created_at) as memorial_order
FROM memorials m
WHERE m.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
ORDER BY m.created_at;

-- 6. Check if there are multiple Remembering prompts in the same week (shouldn't happen)
WITH remembering_prompts AS (
  SELECT 
    dp.date,
    pnu.name_used as memorial_name,
    CASE 
      WHEN EXTRACT(DOW FROM dp.date) = 0 THEN dp.date - INTERVAL '6 days'
      ELSE dp.date - INTERVAL '1 day' * (EXTRACT(DOW FROM dp.date) - 1)
    END as week_start
  FROM daily_prompts dp
  JOIN prompts p ON dp.prompt_id = p.id
  LEFT JOIN prompt_name_usage pnu ON 
    pnu.group_id = dp.group_id 
    AND pnu.prompt_id = dp.prompt_id 
    AND pnu.variable_type = 'memorial_name'
    AND pnu.date_used = dp.date
  WHERE dp.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
    AND p.category = 'Remembering'
    AND dp.user_id IS NULL
)
SELECT 
  week_start,
  COUNT(*) as prompts_in_week,
  COUNT(DISTINCT memorial_name) as unique_memorials_in_week,
  STRING_AGG(DISTINCT memorial_name, ', ' ORDER BY memorial_name) as memorials_used,
  STRING_AGG(date::text, ', ' ORDER BY date) as dates_in_week
FROM remembering_prompts
GROUP BY week_start
HAVING COUNT(*) > 1 OR COUNT(DISTINCT memorial_name) > 1
ORDER BY week_start DESC;

-- 7. Show the expected rotation pattern based on memorial order
WITH memorial_order AS (
  SELECT 
    m.name,
    ROW_NUMBER() OVER (ORDER BY m.created_at) - 1 as index
  FROM memorials m
  WHERE m.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
),
remembering_prompts AS (
  SELECT 
    dp.date,
    pnu.name_used as memorial_name,
    CASE 
      WHEN EXTRACT(DOW FROM dp.date) = 0 THEN dp.date - INTERVAL '6 days'
      ELSE dp.date - INTERVAL '1 day' * (EXTRACT(DOW FROM dp.date) - 1)
    END as week_start
  FROM daily_prompts dp
  JOIN prompts p ON dp.prompt_id = p.id
  LEFT JOIN prompt_name_usage pnu ON 
    pnu.group_id = dp.group_id 
    AND pnu.prompt_id = dp.prompt_id 
    AND pnu.variable_type = 'memorial_name'
    AND pnu.date_used = dp.date
  WHERE dp.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
    AND p.category = 'Remembering'
    AND dp.user_id IS NULL
),
prompt_sequence AS (
  SELECT 
    rp.date,
    rp.memorial_name,
    rp.week_start,
    ROW_NUMBER() OVER (ORDER BY rp.date) - 1 as sequence_number,
    mo.index as memorial_index
  FROM remembering_prompts rp
  LEFT JOIN memorial_order mo ON mo.name = rp.memorial_name
  ORDER BY rp.date
)
SELECT 
  date,
  memorial_name,
  sequence_number,
  memorial_index,
  CASE 
    WHEN memorial_index IS NULL THEN 'Memorial not found in order'
    WHEN sequence_number = 0 THEN 'First prompt'
    WHEN (sequence_number % (SELECT COUNT(*) FROM memorial_order)) = memorial_index THEN 'Expected rotation ✓'
    ELSE 'Unexpected memorial ⚠️'
  END as rotation_analysis
FROM prompt_sequence
ORDER BY date DESC;

