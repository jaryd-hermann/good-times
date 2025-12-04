-- Set all Friends and Family category questions as swipeable
-- This enables them to appear in the swipe-to-match interface

UPDATE prompts
SET swipeable = TRUE
WHERE category IN ('Friends', 'Family')
  AND swipeable IS DISTINCT FROM TRUE; -- Only update if not already TRUE (avoids unnecessary writes)

-- Verify the update
SELECT 
  category,
  COUNT(*) as total_questions,
  COUNT(*) FILTER (WHERE swipeable = TRUE) as swipeable_count,
  COUNT(*) FILTER (WHERE swipeable = FALSE OR swipeable IS NULL) as non_swipeable_count
FROM prompts
WHERE category IN ('Friends', 'Family')
GROUP BY category;

