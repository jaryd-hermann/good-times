# Notification Setup Checklist

## Current Status Assessment

Based on code review, here's what needs to be verified and configured for notifications to work in TestFlight and production:

---

## ✅ What's Already Configured

### App Code
- ✅ `lib/notifications.ts` - Push notification registration functions exist
- ✅ `app/index.tsx` - Imports notification functions (but may not be calling them)
- ✅ `app/(main)/home.tsx` - Registers push tokens on first visit (lines 103-122)
- ✅ `expo-notifications` package installed (`^0.32.12`)
- ✅ Database tables exist: `push_tokens` and `notifications`
- ✅ Edge Functions exist: `schedule-daily-prompts` and `send-daily-notifications`

---

## ❌ What Needs to Be Verified/Configured

### 1. **Push Token Registration** ⚠️ CRITICAL

**Issue**: Push tokens are only registered in `home.tsx` after user reaches home screen. If user never reaches home, tokens won't be registered.

**Check**:
```sql
-- Run in Supabase SQL Editor
SELECT COUNT(*) FROM push_tokens;
```

**If empty**:
- Users need to log in and reach the home screen
- Check app logs for: `"[home] push notifications registered"`
- Verify notification permissions are granted in iOS Settings

**Fix**: Ensure `registerForPushNotifications()` is called after successful authentication in `app/index.tsx` (around line 200+).

---

### 2. **RLS Policies for push_tokens** ⚠️ CRITICAL

**Issue**: `push_tokens` table has RLS enabled but no policies defined in migration.

**Check**:
```sql
-- Run in Supabase SQL Editor
SELECT * FROM pg_policies WHERE tablename = 'push_tokens';
```

**If no policies exist**, add these:

```sql
-- Allow users to insert their own push tokens
CREATE POLICY "Users can insert own push tokens" 
ON push_tokens FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Allow users to view their own push tokens
CREATE POLICY "Users can view own push tokens" 
ON push_tokens FOR SELECT 
USING (auth.uid() = user_id);

-- Allow users to update their own push tokens
CREATE POLICY "Users can update own push tokens" 
ON push_tokens FOR UPDATE 
USING (auth.uid() = user_id);

-- Allow service role to manage all push tokens (for Edge Functions)
CREATE POLICY "Service role can manage all push tokens" 
ON push_tokens FOR ALL 
USING (auth.role() = 'service_role');
```

---

### 3. **RLS Policies for notifications** ⚠️ CRITICAL

**Issue**: `notifications` table has RLS enabled but no policies defined.

**Check**:
```sql
SELECT * FROM pg_policies WHERE tablename = 'notifications';
```

**If no policies exist**, add these:

```sql
-- Allow users to view their own notifications
CREATE POLICY "Users can view own notifications" 
ON notifications FOR SELECT 
USING (auth.uid() = user_id);

-- Allow service role to insert notifications (for Edge Functions)
CREATE POLICY "Service role can insert notifications" 
ON notifications FOR INSERT 
WITH CHECK (auth.role() = 'service_role');

-- Allow users to update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" 
ON notifications FOR UPDATE 
USING (auth.uid() = user_id);
```

---

### 4. **Edge Functions Deployment** ⚠️ CRITICAL

**Check if deployed**:
```bash
# Run in terminal
supabase functions list
```

**If not deployed**, deploy them:
```bash
supabase functions deploy schedule-daily-prompts
supabase functions deploy send-daily-notifications
```

**Verify deployment**:
- Check Supabase Dashboard → Edge Functions
- Both functions should be listed and active

---

### 5. **Cron Jobs Configuration** ⚠️ CRITICAL

**Current Status**: Migration `011_setup_cron_and_populate_prompts.sql` has hardcoded URLs that may need updating.

**Check**:
```sql
-- Run in Supabase SQL Editor
SELECT * FROM cron.job 
WHERE jobname IN ('schedule-daily-prompts', 'send-daily-notifications');
```

**Verify URLs are correct**:
- Should point to: `https://[YOUR_PROJECT_REF].supabase.co/functions/v1/[function-name]`
- Authorization header should use **Service Role Key** (NOT anon key)

**If URLs are wrong**, update them:
```sql
-- Unschedule existing jobs
SELECT cron.unschedule('schedule-daily-prompts');
SELECT cron.unschedule('send-daily-notifications');

-- Get your project details from Supabase Dashboard:
-- Project Reference: Found in URL (https://[REF].supabase.co)
-- Service Role Key: Settings → API → service_role key

-- Reschedule with correct URLs
SELECT cron.schedule(
  'schedule-daily-prompts',
  '1 0 * * *',  -- 12:01 AM UTC daily
  $$
  SELECT
    net.http_post(
      url:='https://[YOUR_PROJECT_REF].supabase.co/functions/v1/schedule-daily-prompts',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer [YOUR_SERVICE_ROLE_KEY]"}'::jsonb
    ) AS request_id;
  $$
);

SELECT cron.schedule(
  'send-daily-notifications',
  '0 9 * * *',  -- 9:00 AM UTC daily
  $$
  SELECT
    net.http_post(
      url:='https://[YOUR_PROJECT_REF].supabase.co/functions/v1/send-daily-notifications',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer [YOUR_SERVICE_ROLE_KEY]"}'::jsonb
    ) AS request_id;
  $$
);
```

---

### 6. **Apple Push Notification Service (APNs) Setup** ⚠️ REQUIRED FOR PRODUCTION

**For TestFlight/Production builds**, you need:

1. **APNs Key** (recommended) or **APNs Certificate**:
   - Go to [Apple Developer Portal](https://developer.apple.com/account/resources/authkeys/list)
   - Create a new Key with "Apple Push Notifications service (APNs)" enabled
   - Download the `.p8` key file (you can only download once!)
   - Note the Key ID and Team ID

2. **Configure in EAS**:
   ```bash
   eas credentials
   # Select iOS → Production → Push Notifications
   # Upload your APNs key (.p8 file)
   # Enter Key ID and Team ID
   ```

3. **Verify Configuration**:
   ```bash
   eas credentials
   # Check that push notification credentials are configured
   ```

**Note**: Development builds use Expo's push notification service automatically. Production builds require APNs configuration.

---

### 7. **Expo Push Notification Service** ✅ (Automatic)

- ✅ Expo automatically handles push notifications for development builds
- ✅ For production, Expo forwards to APNs (requires APNs key setup above)
- ✅ No additional configuration needed in `app.config.ts`

---

## Testing Checklist

### Test Push Token Registration

1. **Install app on device** (TestFlight or development build)
2. **Log in** and navigate to home screen
3. **Grant notification permissions** when prompted
4. **Check Supabase**:
   ```sql
   SELECT * FROM push_tokens ORDER BY created_at DESC LIMIT 5;
   ```
   - Should see your token with your `user_id`

### Test Daily Notifications

1. **Manually trigger** the notification function:
   ```bash
   curl -X POST \
     'https://[YOUR_PROJECT_REF].supabase.co/functions/v1/send-daily-notifications' \
     -H 'Authorization: Bearer [YOUR_SERVICE_ROLE_KEY]' \
     -H 'Content-Type: application/json'
   ```

2. **Check notifications table**:
   ```sql
   SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5;
   ```

3. **Verify notification received** on device

### Test Cron Jobs

1. **Check cron job execution**:
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE jobid IN (
     SELECT jobid FROM cron.job 
     WHERE jobname = 'send-daily-notifications'
   )
   ORDER BY start_time DESC
   LIMIT 10;
   ```

2. **Wait for scheduled time** (9 AM UTC) or manually trigger

---

## Quick Fix Script

Run this SQL in Supabase SQL Editor to fix RLS policies:

```sql
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can insert own push tokens" ON push_tokens;
DROP POLICY IF EXISTS "Users can view own push tokens" ON push_tokens;
DROP POLICY IF EXISTS "Users can update own push tokens" ON push_tokens;
DROP POLICY IF EXISTS "Service role can manage all push tokens" ON push_tokens;

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Service role can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;

-- Create push_tokens policies
CREATE POLICY "Users can insert own push tokens" 
ON push_tokens FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own push tokens" 
ON push_tokens FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own push tokens" 
ON push_tokens FOR UPDATE 
USING (auth.uid() = user_id);

-- Note: Service role bypasses RLS by default, but we can be explicit
-- Service role doesn't need a policy - it bypasses RLS automatically

-- Create notifications policies
CREATE POLICY "Users can view own notifications" 
ON notifications FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert notifications" 
ON notifications FOR INSERT 
WITH CHECK (true);  -- Service role bypasses RLS, but this allows Edge Functions

CREATE POLICY "Users can update own notifications" 
ON notifications FOR UPDATE 
USING (auth.uid() = user_id);
```

---

## Summary

**Immediate Actions Required**:

1. ✅ **Add RLS policies** for `push_tokens` and `notifications` tables (use script above)
2. ✅ **Verify Edge Functions are deployed** (`supabase functions list`)
3. ✅ **Verify cron jobs are configured** with correct URLs and service role key
4. ✅ **Configure APNs key** in EAS for production builds
5. ✅ **Test push token registration** by logging in and checking `push_tokens` table
6. ✅ **Manually trigger** `send-daily-notifications` to test end-to-end flow

**Why notifications table is empty**:
- Notifications are only created when `send-daily-notifications` Edge Function runs
- Function runs at 9 AM UTC daily (or when manually triggered)
- Function requires:
  - Daily prompts to exist (`daily_prompts` table)
  - Push tokens to exist (`push_tokens` table)
  - Proper RLS policies to allow Edge Function to insert

Once all the above is configured, notifications should start working!

