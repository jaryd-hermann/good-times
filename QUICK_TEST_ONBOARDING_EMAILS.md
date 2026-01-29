# Quick Test: Onboarding Emails

## No Redeploy Needed ✅
You **don't need to redeploy** the functions. The `app_settings` table is in the database, not in the function code. Once you've updated `app_settings` with your Supabase URL and anon key, the cron job will use them automatically.

## Test Methods

### Method 1: Using the Test Script (Recommended)

```bash
# Make sure you have your env vars set
export EXPO_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run the test script with a user_id
tsx test_send_onboarding_emails.ts <user_id>
```

The script will:
1. Invoke `process-onboarding-emails` function
2. Check `email_logs` for that user
3. Check `onboarding_email_schedule` for that user
4. Show you what emails are pending/sent

### Method 2: Using curl (Quick Test)

```bash
# Replace with your actual values
PROJECT_REF="your-project-ref"
ANON_KEY="your-anon-key"

curl -X POST \
  "https://${PROJECT_REF}.supabase.co/functions/v1/process-onboarding-emails" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Method 3: Supabase Dashboard

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Find `process-onboarding-emails`
3. Click **Invoke** button
4. Check the response

### Method 4: SQL Query (Check Results)

After invoking, check if emails were sent:

```sql
-- Check email_logs for a specific user
SELECT * FROM email_logs 
WHERE user_id = 'your-user-id' 
ORDER BY created_at DESC;

-- Check scheduled emails for a user
SELECT 
  email_type,
  scheduled_for,
  sent,
  sent_at,
  CASE 
    WHEN sent = TRUE THEN '✅ SENT'
    WHEN scheduled_for <= NOW() THEN '⏰ READY TO SEND'
    ELSE '⏳ SCHEDULED'
  END as status
FROM onboarding_email_schedule
WHERE user_id = 'your-user-id'
ORDER BY scheduled_for ASC;
```

## What to Expect

### If Everything Works:
1. Function invokes successfully
2. `email_logs` table gets new entries with `resend_id`
3. `onboarding_email_schedule.sent` updates to `TRUE`
4. User receives custom HTML email (not generic)

### If There Are Issues:
1. **Function fails** → Check Supabase Dashboard → Edge Functions → Logs
2. **No email_logs entries** → Function didn't call `send-email` successfully
3. **Generic email received** → That's from Resend, not your system (check Resend Dashboard logs)

## Debugging

### Check Function Logs:
- Supabase Dashboard → Edge Functions → `process-onboarding-emails` → Logs
- Look for errors about `app_settings` or API calls

### Check Resend Logs:
- Resend Dashboard → Logs
- Look for emails sent from `welcome@thegoodtimes.app`
- Check if they have custom HTML or are generic

### Check Cron Job:
```sql
-- Check if cron job is active
SELECT * FROM cron.job WHERE jobname = 'process-onboarding-emails';

-- Check cron execution history
SELECT * FROM cron.job_run_details 
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'process-onboarding-emails')
ORDER BY start_time DESC
LIMIT 10;
```

## Next Steps

Once you confirm emails are sending:
1. ✅ Cron job will run every 15 minutes automatically
2. ✅ New users will get welcome email immediately (via trigger)
3. ✅ Follow-up emails will be sent on schedule (via cron)
