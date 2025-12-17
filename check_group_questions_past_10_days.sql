-- Query to see a group's questions from the past 10 days
SELECT 
  dp.date,
  dp.prompt_id,
  p.question,
  p.category,
  p.description,
  dp.created_at
FROM daily_prompts dp
JOIN prompts p ON dp.prompt_id = p.id
WHERE dp.group_id = 'cd36520c-03fa-4e18-9442-cde27e7cfa64'
  AND dp.date >= CURRENT_DATE - INTERVAL '10 days'
ORDER BY dp.date DESC;

