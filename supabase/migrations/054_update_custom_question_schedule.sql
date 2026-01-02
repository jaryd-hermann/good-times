-- Update custom question assignment schedule to run twice per week (Monday and Thursday)
-- This increases cadence from 1 opportunity per week to 2 opportunities per week

-- Unschedule the old cron job (runs only on Monday)
SELECT cron.unschedule('assign-custom-question-opportunity');

-- Reschedule to run on both Monday and Thursday at 12:01 AM UTC
-- Cron format: minute hour day-of-month month day-of-week
-- 1 = Monday, 4 = Thursday
SELECT cron.schedule(
  'assign-custom-question-opportunity',
  '1 0 * * 1,4',
  $$
  SELECT
    net.http_post(
      url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/assign-custom-question-opportunity',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
    ) AS request_id;
  $$
);

-- Note: The function logic has been updated to:
-- 1. Assign opportunities on Monday and Thursday (instead of random day)
-- 2. Remove the 7-day waiting period requirement (groups eligible immediately with 3+ members)

