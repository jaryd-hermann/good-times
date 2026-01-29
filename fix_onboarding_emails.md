# Fixing Onboarding Emails

## Problem
- Email schedules are being created (✅ trigger works)
- But emails are NOT being sent (0 entries in email_logs)
- Generic Resend email received (not from our system)

## Root Cause
The cron job requires `app_settings` to be configured with your actual Supabase URL and anon key, but the migration inserts placeholder values.

## Solution

### Step 1: Configure app_settings
Run this SQL query, replacing with your actual values:

```sql
UPDATE app_settings 
SET value = 'https://YOUR_ACTUAL_PROJECT_REF.supabase.co'
WHERE key = 'supabase_url';

UPDATE app_settings 
SET value = 'YOUR_ACTUAL_ANON_KEY'
WHERE key = 'supabase_anon_key';
```

### Step 2: Verify cron job is active
Run the diagnostic query (`diagnose_onboarding_emails.sql`) to check:
- `app_settings` are configured (not placeholders)
- Cron job exists and is `active = TRUE`

### Step 3: Manually trigger to test
You can manually trigger the function to test if it works:

```sql
-- Option 1: Call via SQL (if pg_net is working)
SELECT net.http_post(
  url := (SELECT value FROM app_settings WHERE key = 'supabase_url') || '/functions/v1/process-onboarding-emails',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (SELECT value FROM app_settings WHERE key = 'supabase_anon_key')
  ),
  body := '{}'::jsonb
) AS request_id;
```

Or call it directly via Supabase Dashboard → Edge Functions → `process-onboarding-emails` → Invoke

### Step 4: About the generic Resend email
The generic "Welcome to Good Times" email you received is likely from:
- Resend's automatic welcome email feature (if enabled in Resend dashboard)
- NOT from our `send-email` function (which would have created an entry in `email_logs`)

To disable Resend's automatic welcome emails:
1. Go to Resend Dashboard
2. Settings → Domains
3. Disable "Send welcome email" or similar feature

## Expected Behavior After Fix
1. Cron job runs every 15 minutes
2. Finds emails where `scheduled_for <= NOW()` and `sent = FALSE`
3. Calls `send-email` function for each
4. `send-email` generates custom HTML and sends via Resend
5. Updates `onboarding_email_schedule.sent = TRUE`
6. Inserts entry into `email_logs` with `resend_id`

## Debugging
- Check `diagnose_onboarding_emails.sql` results
- Check Supabase Edge Function logs for `process-onboarding-emails` and `send-email`
- Check Resend dashboard for sent emails
