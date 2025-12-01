-- Check if user has push tokens enabled
-- User ID: a1b0d815-2c2b-40d6-abba-f37e7f8ee329

-- Simple check: does user have any push tokens?
SELECT 
  COUNT(*) as token_count,
  CASE 
    WHEN COUNT(*) > 0 THEN 'Push tokens enabled'
    ELSE 'No push tokens found'
  END as status
FROM push_tokens
WHERE user_id = 'a1b0d815-2c2b-40d6-abba-f37e7f8ee329';

-- Detailed view: show all push tokens for this user
SELECT 
  id,
  user_id,
  token,
  created_at,
  -- Show how old the token is
  NOW() - created_at as token_age
FROM push_tokens
WHERE user_id = 'a1b0d815-2c2b-40d6-abba-f37e7f8ee329'
ORDER BY created_at DESC;

-- Also check user info for context
SELECT 
  u.id,
  u.email,
  u.name,
  u.created_at as user_created_at,
  COUNT(pt.id) as push_token_count
FROM users u
LEFT JOIN push_tokens pt ON pt.user_id = u.id
WHERE u.id = 'a1b0d815-2c2b-40d6-abba-f37e7f8ee329'
GROUP BY u.id, u.email, u.name, u.created_at;

