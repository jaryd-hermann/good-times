# Notification Setup - Complete Instructions

## ✅ What I've Done For You

### 1. **Created Complete SQL Script**
- File: `setup_notifications_complete.sql`
- Contains all RLS policies, indexes, and cron job setup
- Ready to paste into Supabase SQL Editor (just need to update placeholders)

### 2. **Fixed Edge Functions**
- ✅ Fixed error handling in `send-daily-notifications/index.ts`
- ✅ Fixed error handling in `schedule-daily-prompts/index.ts`
- ✅ Added proper error logging for notification inserts
- ✅ Functions are now production-ready

### 3. **Verified Code**
- ✅ Edge functions use correct environment variables (auto-provided by Supabase)
- ✅ RLS policies will allow Edge Functions to insert notifications
- ✅ Push token registration code is correct in app

---

## 📋 What You Need To Do

### Step 1: Update SQL Script with Your Credentials

1. **Open** `setup_notifications_complete.sql`

2. **Find your Supabase Project Reference**:
   - Go to Supabase Dashboard
   - Look at your project URL: `https://[PROJECT_REF].supabase.co`
   - Copy the `[PROJECT_REF]` part

3. **Find your Service Role Key**:
   - Supabase Dashboard → Settings → API
   - Find the `service_role` key (NOT the `anon` key!)
   - Copy the entire key

4. **Replace placeholders in the SQL script**:
   - Replace `[YOUR_PROJECT_REF]` with your project reference (2 places)
   - Replace `[YOUR_SERVICE_ROLE_KEY]` with your service role key (2 places)

5. **Run the script**:
   - Open Supabase Dashboard → SQL Editor
   - Paste the entire updated script
   - Click "Run"

### Step 2: Deploy Edge Functions

Run these commands in your terminal:

```bash
# Make sure you're in the project directory
cd /Users/jarydhermann/good-times

# Deploy the functions
supabase functions deploy schedule-daily-prompts
supabase functions deploy send-daily-notifications
```

**If you get an error about not being logged in:**
```bash
supabase login
# Follow the prompts to authenticate
```

**If you get an error about project not linked:**
```bash
supabase link --project-ref [YOUR_PROJECT_REF]
```

### Step 3: Verify Setup

Run these queries in Supabase SQL Editor to verify everything is set up:

```sql
-- Check RLS policies exist
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('push_tokens', 'notifications')
ORDER BY tablename, policyname;

-- Check cron jobs are scheduled
SELECT jobid, jobname, schedule, active 
FROM cron.job 
WHERE jobname IN ('schedule-daily-prompts', 'send-daily-notifications');

-- Check Edge Functions are deployed (in Supabase Dashboard)
-- Go to: Edge Functions → You should see both functions listed
```

### Step 4: Test Push Token Registration

1. **Install app** on a device (TestFlight or development build)
2. **Log in** and navigate to home screen
3. **Grant notification permissions** when prompted
4. **Check Supabase**:
   ```sql
   SELECT * FROM push_tokens ORDER BY created_at DESC LIMIT 5;
   ```
   - You should see your token with your `user_id`

### Step 5: Test Notifications (Optional - Manual Test)

You can manually trigger the notification function to test:

```bash
# Replace [YOUR_PROJECT_REF] and [YOUR_SERVICE_ROLE_KEY]
curl -X POST \
  'https://[YOUR_PROJECT_REF].supabase.co/functions/v1/send-daily-notifications' \
  -H 'Authorization: Bearer [YOUR_SERVICE_ROLE_KEY]' \
  -H 'Content-Type: application/json'
```

Then check if notifications were created:
```sql
SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5;
```

---

## 🚨 Critical: APNs Setup for TestFlight/Production

**For production builds (TestFlight/App Store), you MUST configure APNs:**

### Option 1: APNs Key (Recommended)

1. **Create APNs Key**:
   - Go to [Apple Developer Portal](https://developer.apple.com/account/resources/authkeys/list)
   - Click "+" to create new key
   - Name it (e.g., "Good Times Push Notifications")
   - Check "Apple Push Notifications service (APNs)"
   - Click "Continue" → "Register"
   - **Download the `.p8` file** (you can only download once!)
   - Note the **Key ID** and **Team ID** (shown on the page)

2. **Configure in EAS**:
   ```bash
   eas credentials
   # Select: iOS → Production → Push Notifications
   # Choose: "Upload a P8 key"
   # Upload your .p8 file
   # Enter Key ID
   # Enter Team ID
   ```

### Option 2: APNs Certificate (Alternative)

1. Create APNs certificate in Apple Developer Portal
2. Upload via `eas credentials` → iOS → Production → Push Notifications

**Note**: Development builds work automatically with Expo's push service. This is only needed for production builds.

---

## 📊 How It Works

### Daily Flow:

1. **12:01 AM UTC**: Cron job triggers `schedule-daily-prompts`
   - Function selects prompts for each group
   - Saves to `daily_prompts` table

2. **9:00 AM UTC**: Cron job triggers `send-daily-notifications`
   - Function reads `daily_prompts` for today
   - Gets push tokens from `push_tokens` table
   - Sends notifications via Expo Push API
   - Saves notification records to `notifications` table

### When Users Log In:

1. User reaches home screen
2. App requests notification permissions
3. App gets Expo push token
4. App saves token to `push_tokens` table
5. User is now ready to receive notifications

---

## 🔍 Troubleshooting

### Notifications table is empty?
- **Normal** if cron jobs haven't run yet (they run at 12:01 AM and 9:00 AM UTC)
- **Check**: Verify cron jobs are scheduled (Step 3 verification queries)
- **Test**: Manually trigger `send-daily-notifications` function

### Push tokens table is empty?
- Users need to log in and reach home screen
- Users need to grant notification permissions
- **Check**: Install app, log in, grant permissions, then check table

### Cron jobs not running?
- Verify cron jobs are scheduled: `SELECT * FROM cron.job;`
- Check Edge Function logs in Supabase Dashboard
- Verify URLs in cron jobs match your project reference
- Verify Authorization header uses Service Role Key (not anon key)

### Notifications not received?
- Verify push tokens exist: `SELECT * FROM push_tokens;`
- Verify daily prompts exist: `SELECT * FROM daily_prompts WHERE date = CURRENT_DATE;`
- Check Edge Function logs for errors
- For production builds: Verify APNs is configured in EAS

---

## ✅ Checklist

- [X ] Updated SQL script with project reference and service role key
- [X ] Ran SQL script in Supabase SQL Editor
- [X ] Deployed Edge Functions (`schedule-daily-prompts` and `send-daily-notifications`)
- [X ] Verified RLS policies exist (verification query)
- [X ] Verified cron jobs are scheduled (verification query)
- [ ] Tested push token registration (log in, check `push_tokens` table)
- [X ] Configured APNs key in EAS (for production builds only)
- [ ] Tested manual notification trigger (optional)

Once all checkboxes are complete, notifications should work! 🎉

