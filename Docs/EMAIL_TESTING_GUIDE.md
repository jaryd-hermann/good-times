# Email Onboarding Testing Guide

## Quick Verification

Run the test script to verify everything is set up:

```bash
npm run test-email-onboarding
```

Or check a specific user's emails:

```bash
npm run test-email-onboarding <user_id>
```

## Manual Verification Steps

### 1. Check Database Tables

```sql
-- Verify tables exist
SELECT COUNT(*) FROM email_logs;
SELECT COUNT(*) FROM onboarding_email_schedule;

-- Check indexes
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('email_logs', 'onboarding_email_schedule');
```

### 2. Check Database Functions

```sql
-- Verify function exists
SELECT proname FROM pg_proc 
WHERE proname = 'schedule_onboarding_emails';

-- Test function (with a test UUID - will create schedule entries)
SELECT schedule_onboarding_emails('00000000-0000-0000-0000-000000000000');
```

### 3. Check Database Trigger

```sql
-- Verify trigger exists
SELECT tgname, tgrelid::regclass 
FROM pg_trigger 
WHERE tgname = 'trigger_welcome_email_on_registration';
```

### 4. Check Cron Job

```sql
-- Verify cron job exists
SELECT * FROM cron.job 
WHERE jobname = 'process-onboarding-emails';

-- Check cron job history
SELECT * FROM cron.job_run_details 
WHERE jobid = (
  SELECT jobid FROM cron.job 
  WHERE jobname = 'process-onboarding-emails'
)
ORDER BY start_time DESC 
LIMIT 10;
```

### 5. Check Edge Function

Verify the Edge Function is deployed in your Supabase dashboard:
- Go to Edge Functions
- Look for `process-onboarding-emails`
- Should show as "Active"

## Testing the Full Flow

### Step 1: Create a Test User

Create a new user account (or use an existing test account).

### Step 2: Join/Create a Group

When the user joins their first group, the trigger should:
1. ✅ Send welcome email immediately
2. ✅ Schedule 6 follow-up emails

### Step 3: Verify Welcome Email

```sql
-- Check if welcome email was logged
SELECT * FROM email_logs 
WHERE user_id = 'your-user-id' 
AND email_type = 'welcome'
ORDER BY sent_at DESC 
LIMIT 1;
```

### Step 4: Verify Scheduled Emails

```sql
-- Check scheduled follow-up emails
SELECT 
  email_type,
  scheduled_for,
  sent,
  sent_at,
  CASE 
    WHEN scheduled_for <= NOW() AND NOT sent THEN 'DUE NOW'
    WHEN sent THEN 'SENT'
    ELSE 'PENDING'
  END as status
FROM onboarding_email_schedule
WHERE user_id = 'your-user-id'
ORDER BY scheduled_for;
```

### Step 5: Manually Trigger Email Processor

Instead of waiting for the cron job, you can manually trigger it:

```bash
# Using curl
curl -X POST \
  https://ytnnsykbgohiscfgomfe.supabase.co/functions/v1/process-onboarding-emails \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"

# Or via Supabase Dashboard
# Go to Edge Functions → process-onboarding-emails → Invoke
```

### Step 6: Verify Emails Were Sent

```sql
-- Check all emails sent to user
SELECT 
  email_type,
  sent_at,
  resend_id
FROM email_logs
WHERE user_id = 'your-user-id'
ORDER BY sent_at;
```

## Expected Behavior

### Timeline

- **Day 0 (Join)**: Welcome email sent immediately
- **Day 1**: onboarding_day_2 scheduled
- **Day 2**: onboarding_day_3 scheduled
- **Day 3**: onboarding_day_4 scheduled
- **Day 4**: onboarding_day_5 scheduled
- **Day 5**: onboarding_day_6 scheduled
- **Day 6**: onboarding_day_7 scheduled

### Email Schedule

Each follow-up email is scheduled for:
- `joined_at + INTERVAL 'N days'` where N = 1-6

The cron job runs every hour and processes any emails where:
- `scheduled_for <= NOW()`
- `sent = false`

## Troubleshooting

### Welcome Email Not Sent

1. Check trigger exists:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'trigger_welcome_email_on_registration';
   ```

2. Check if user already had a group membership:
   ```sql
   SELECT COUNT(*) FROM group_members WHERE user_id = 'your-user-id';
   ```
   (Trigger only fires on first group join)

3. Check Edge Function logs in Supabase dashboard

### Follow-up Emails Not Scheduled

1. Check if `schedule_onboarding_emails()` was called:
   ```sql
   SELECT * FROM onboarding_email_schedule 
   WHERE user_id = 'your-user-id';
   ```

2. Verify function exists and is callable

3. Check trigger includes the scheduling call (migration 013)

### Cron Job Not Running

1. Verify cron job exists:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'process-onboarding-emails';
   ```

2. Check cron job history for errors:
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-onboarding-emails')
   ORDER BY start_time DESC LIMIT 5;
   ```

3. Verify Edge Function URL is correct in cron job

4. Check Edge Function logs for errors

### Emails Scheduled But Not Sent

1. Check if emails are due:
   ```sql
   SELECT * FROM onboarding_email_schedule 
   WHERE scheduled_for <= NOW() 
   AND sent = false;
   ```

2. Manually trigger processor to test

3. Check Edge Function logs for errors

4. Verify Resend API key is set in Edge Function secrets

## Monitoring Queries

### Check Email Stats

```sql
-- Total emails sent by type
SELECT 
  email_type,
  COUNT(*) as total_sent,
  COUNT(DISTINCT user_id) as unique_users
FROM email_logs
GROUP BY email_type
ORDER BY total_sent DESC;
```

### Check Pending Emails

```sql
-- All pending emails across all users
SELECT 
  user_id,
  email_type,
  scheduled_for,
  EXTRACT(EPOCH FROM (NOW() - scheduled_for))/3600 as hours_overdue
FROM onboarding_email_schedule
WHERE sent = false
AND scheduled_for <= NOW()
ORDER BY scheduled_for;
```

### Check User Progress

```sql
-- See a user's complete email journey
SELECT 
  'scheduled' as type,
  email_type,
  scheduled_for as timestamp,
  sent
FROM onboarding_email_schedule
WHERE user_id = 'your-user-id'

UNION ALL

SELECT 
  'sent' as type,
  email_type,
  sent_at as timestamp,
  true as sent
FROM email_logs
WHERE user_id = 'your-user-id'

ORDER BY timestamp;
```

## Production Checklist

Before going live, verify:

- [ ] All migrations run successfully
- [ ] Edge Function deployed and active
- [ ] Cron job exists and is scheduled
- [ ] Resend API key set in Edge Function secrets
- [ ] Test user receives welcome email
- [ ] Test user's follow-up emails are scheduled
- [ ] Cron job processes emails correctly
- [ ] Email templates render correctly in email clients
- [ ] Email logs are being recorded
- [ ] No errors in Edge Function logs

