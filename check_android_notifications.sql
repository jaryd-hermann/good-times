-- Check Android notification tokens and recent notifications
-- This helps verify if Android users are receiving notifications

-- 1. Check all push tokens (Android tokens start with ExponentPushToken, same as iOS)
-- We can't distinguish by token format, but we can check recent notifications
SELECT 
  pt.user_id,
  u.name,
  u.email,
  pt.token,
  LEFT(pt.token, 20) as token_prefix,
  pt.created_at,
  CASE 
    WHEN pt.token LIKE 'ExponentPushToken%' THEN 'Expo Token (iOS/Android)'
    ELSE 'Other'
  END as token_type
FROM push_tokens pt
JOIN users u ON pt.user_id = u.id
ORDER BY pt.created_at DESC
LIMIT 50;

-- 2. Check recent notifications sent (last 7 days)
SELECT 
  n.user_id,
  u.name,
  u.email,
  n.type,
  n.title,
  LEFT(n.body, 50) as body_preview,
  n.created_at,
  n.read
FROM notifications n
JOIN users u ON n.user_id = u.id
WHERE n.type = 'daily_prompt'
  AND n.created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY n.created_at DESC;

-- 3. Check if users have push tokens but no recent notifications (potential Android issue)
SELECT 
  pt.user_id,
  u.name,
  u.email,
  pt.created_at as token_created,
  MAX(n.created_at) as last_notification_sent
FROM push_tokens pt
JOIN users u ON pt.user_id = u.id
LEFT JOIN notifications n ON pt.user_id = n.user_id AND n.type = 'daily_prompt'
GROUP BY pt.user_id, u.name, u.email, pt.created_at
HAVING MAX(n.created_at) IS NULL OR MAX(n.created_at) < CURRENT_DATE - INTERVAL '2 days'
ORDER BY pt.created_at DESC;

-- 4. Check today's notification sending results from function logs
-- (This would need to be checked in Supabase dashboard > Edge Functions > Logs)

