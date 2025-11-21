-- Query to see all scheduled prompts for a specific group
-- Replace 'YOUR_GROUP_ID' with the actual group ID

SELECT 
  dp.date,
  dp.prompt_id,
  p.category,
  p.question,
  p.description,
  dp.created_at as scheduled_at
FROM daily_prompts dp
JOIN prompts p ON dp.prompt_id = p.id
WHERE dp.group_id = 'YOUR_GROUP_ID'  -- Replace with your group ID
  AND dp.user_id IS NULL  -- Only general prompts (excludes birthday-specific prompts)
ORDER BY dp.date ASC;

-- Alternative: See prompts for a specific date range
-- SELECT 
--   dp.date,
--   p.category,
--   p.question,
--   dp.created_at as scheduled_at
-- FROM daily_prompts dp
-- JOIN prompts p ON dp.prompt_id = p.id
-- WHERE dp.group_id = 'YOUR_GROUP_ID'
--   AND dp.user_id IS NULL
--   AND dp.date >= CURRENT_DATE - INTERVAL '7 days'
--   AND dp.date <= CURRENT_DATE + INTERVAL '7 days'
-- ORDER BY dp.date ASC;

-- Check for duplicates (prompts appearing multiple times)
-- SELECT 
--   dp.prompt_id,
--   p.question,
--   COUNT(*) as occurrence_count,
--   STRING_AGG(dp.date::text, ', ' ORDER BY dp.date) as dates
-- FROM daily_prompts dp
-- JOIN prompts p ON dp.prompt_id = p.id
-- WHERE dp.group_id = 'YOUR_GROUP_ID'
--   AND dp.user_id IS NULL
-- GROUP BY dp.prompt_id, p.question
-- HAVING COUNT(*) > 1
-- ORDER BY occurrence_count DESC;

