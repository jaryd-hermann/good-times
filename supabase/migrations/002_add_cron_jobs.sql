-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily prompt assignment at 12:01 AM UTC
SELECT cron.schedule(
  'schedule-daily-prompts',
  '1 0 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/schedule-daily-prompts',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
    ) AS request_id;
  $$
);

-- Schedule daily notifications at 9:00 AM UTC (adjust based on user timezones)
-- Note: This sends at 9 AM UTC. For local time support, you'll need to run multiple cron jobs
-- or use a more sophisticated scheduling system
SELECT cron.schedule(
  'send-daily-notifications',
  '0 9 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-daily-notifications',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
    ) AS request_id;
  $$
);

-- Process notification queue every 5 minutes
SELECT cron.schedule(
  'process-notification-queue',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
      url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-notification-queue',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
    ) AS request_id;
  $$
);

-- Check custom question eligibility daily at 1 AM UTC
SELECT cron.schedule(
  'check-custom-question-eligibility',
  '0 1 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/check-custom-question-eligibility',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
    ) AS request_id;
  $$
);

-- Assign custom question opportunities every Monday at 12:01 AM UTC
SELECT cron.schedule(
  'assign-custom-question-opportunity',
  '1 0 * * 1',
  $$
  SELECT
    net.http_post(
      url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/assign-custom-question-opportunity',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
    ) AS request_id;
  $$
);

-- Send custom question notifications (8 AM and 4 PM user local time)
-- Note: This should be called multiple times per day or use a more sophisticated scheduling system
-- For now, scheduling at 8 AM and 4 PM UTC (adjust based on your user base timezones)
SELECT cron.schedule(
  'send-custom-question-notifications-8am',
  '0 8 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-custom-question-notifications',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
    ) AS request_id;
  $$
);

SELECT cron.schedule(
  'send-custom-question-notifications-4pm',
  '0 16 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-custom-question-notifications',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
    ) AS request_id;
  $$
);

-- Process skipped custom questions daily at 11:59 PM UTC
SELECT cron.schedule(
  'process-skipped-custom-questions',
  '59 23 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-skipped-custom-questions',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
    ) AS request_id;
  $$
);
