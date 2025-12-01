-- Check the group's ice breaker status and creation date
SELECT 
  id,
  name,
  type,
  created_at,
  ice_breaker_queue_completed_date,
  CASE 
    WHEN ice_breaker_queue_completed_date IS NULL THEN 'Not initialized'
    WHEN ice_breaker_queue_completed_date > CURRENT_DATE THEN 'Still in ice breaker period'
    ELSE 'Ice breaker period completed'
  END as ice_breaker_status
FROM groups
WHERE id = '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2';

-- Check what date the ice breaker period should have ended
SELECT 
  created_at,
  ice_breaker_queue_completed_date,
  created_at::date + INTERVAL '7 days' as expected_completion_date,
  CURRENT_DATE as today
FROM groups
WHERE id = '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2';

