-- Reset push token registration for user
-- User ID: a1b0d815-2c2b-40d6-abba-f37e7f8ee329
-- 
-- This SQL script helps verify the state, but cannot directly trigger
-- the app to re-register. The app needs to call registerForPushNotifications()
-- which happens automatically if AsyncStorage flags are cleared.

-- Check current state
SELECT 
  'Current Push Tokens' as check_type,
  COUNT(*) as count
FROM push_tokens
WHERE user_id = 'a1b0d815-2c2b-40d6-abba-f37e7f8ee329';

-- Verify user exists
SELECT 
  'User Info' as check_type,
  id,
  email,
  name,
  created_at
FROM users
WHERE id = 'a1b0d815-2c2b-40d6-abba-f37e7f8ee329';

-- Note: To actually trigger re-registration, the user needs to:
-- 1. Clear AsyncStorage flag "has_requested_notifications" in the app
-- 2. OR reinstall the app
-- 3. OR navigate to home screen (which will check the flag and register if not set)

