# How to Fix Onboarding Emails

## Problem Summary
- ✅ Email schedules are being created (trigger works)
- ❌ Emails are NOT being sent (0 entries in email_logs)
- ⚠️ Generic Resend email received (not from our system)

## Step 1: Configure app_settings

The cron job needs your Supabase URL and anon key to call the Edge Function. These are stored in the `app_settings` table.

### Where to run SQL:
1. Go to **Supabase Dashboard** → Your Project
2. Click **SQL Editor** in the left sidebar
3. Open the file `configure_app_settings.sql` (or copy the SQL below)
4. Replace the placeholders with your actual values
5. Click **Run**

### How to find your values:
- **Supabase URL**: Dashboard → Settings → API → Project URL
  - Looks like: `https://abcdefghijklmnop.supabase.co`
- **Anon Key**: Dashboard → Settings → API → Project API keys → `anon` `public`
  - Long string starting with `eyJ...`

### SQL to run:
```sql
UPDATE app_settings 
SET value = 'https://YOUR_PROJECT_REF.supabase.co'
WHERE key = 'supabase_url';

UPDATE app_settings 
SET value = 'YOUR_ANON_KEY'
WHERE key = 'supabase_anon_key';
```

## Step 2: Verify cron job is working

Run `diagnose_onboarding_emails.sql` in SQL Editor to check:
- ✅ `app_settings` are configured (not placeholders)
- ✅ Cron job exists and is `active = TRUE`
- ✅ Emails are ready to send (`scheduled_for <= NOW()`)

## Step 3: Manually test

After configuring, manually trigger the function to test:

1. Go to **Supabase Dashboard** → Edge Functions
2. Find `process-onboarding-emails`
3. Click **Invoke** button
4. Check the response - should show emails processed

Or run this SQL:
```sql
SELECT net.http_post(
  url := (SELECT value FROM app_settings WHERE key = 'supabase_url') || '/functions/v1/process-onboarding-emails',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (SELECT value FROM app_settings WHERE key = 'supabase_anon_key')
  ),
  body := '{}'::jsonb
) AS request_id;
```

## Step 4: About the generic Resend email

The generic "Welcome to Good Times" email is **NOT** from our `send-email` function because:
- `email_logs` is empty (0 entries)
- Our function would create a log entry if it ran

**Possible sources:**
1. **Resend Domain Verification Email** - When you verify a domain, Resend sometimes sends a test email
2. **Resend API Test** - If someone manually tested the Resend API
3. **Another integration** - Check if you have any other code calling Resend

**To find the source:**
1. Go to **Resend Dashboard** → **Logs** or **Emails**
2. Find the generic email
3. Check the "From" address and API call details
4. Look for any webhooks or automatic triggers

**To prevent it:**
- If it's from domain verification, it's a one-time thing
- If it's from API testing, check your Resend API key usage
- Our custom emails will have `resend_id` logged in `email_logs` once working

## Expected Behavior After Fix

Once `app_settings` are configured:
1. Cron job runs every 15 minutes ✅
2. Finds emails where `scheduled_for <= NOW()` and `sent = FALSE`
3. Calls `send-email` function for each
4. `send-email` generates custom HTML and sends via Resend
5. Updates `onboarding_email_schedule.sent = TRUE`
6. Inserts entry into `email_logs` with `resend_id`

## Troubleshooting

**Check Edge Function logs:**
- Supabase Dashboard → Edge Functions → `process-onboarding-emails` → Logs
- Look for errors about missing settings or failed HTTP calls

**Check cron job execution:**
- Run `diagnose_onboarding_emails.sql` query #4 to see cron execution history
- Look for errors in `return_message`

**Check email_logs:**
- After manual trigger, check if entries appear
- If entries appear but emails don't send, check `send-email` function logs
