-- Quick verification query to check if banners should be showing
-- Run this after the function executes to verify everything is working

-- Check opportunities for today
SELECT 
  'Today''s Opportunities' as check_type,
  COUNT(*)::text as value
FROM custom_questions
WHERE date_assigned = CURRENT_DATE

UNION ALL

SELECT 
  'Pending Banners (should show)' as check_type,
  COUNT(*)::text as value
FROM custom_questions
WHERE date_assigned = CURRENT_DATE
  AND date_asked IS NULL

UNION ALL

SELECT 
  'Groups with Opportunities Today' as check_type,
  COUNT(DISTINCT group_id)::text as value
FROM custom_questions
WHERE date_assigned = CURRENT_DATE

UNION ALL

SELECT 
  'Users with Opportunities Today' as check_type,
  COUNT(DISTINCT user_id)::text as value
FROM custom_questions
WHERE date_assigned = CURRENT_DATE;

-- Detailed view: Which groups should show banners
SELECT 
  cq.id,
  g.name as group_name,
  u.name as user_name,
  cq.date_assigned,
  CASE 
    WHEN cq.date_assigned = CURRENT_DATE AND cq.date_asked IS NULL 
    THEN '✅ SHOULD SHOW BANNER'
    ELSE 'Other'
  END as banner_status
FROM custom_questions cq
LEFT JOIN groups g ON cq.group_id = g.id
LEFT JOIN users u ON cq.user_id = u.id
WHERE cq.date_assigned = CURRENT_DATE
ORDER BY g.name;
