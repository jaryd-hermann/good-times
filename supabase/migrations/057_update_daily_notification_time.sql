-- Update daily notification cron job to queue notifications instead of sending immediately
-- Notifications are now queued with scheduled_time set to 8 AM local time for each user
-- The process-notification-queue cron job (runs every 5 minutes) will send them at the right time

-- First, unschedule the existing job
SELECT cron.unschedule('send-daily-notifications');

-- Reschedule to run shortly after prompts are scheduled (at 12:05 AM UTC)
-- This queues notifications with scheduled_time = 8 AM local time for each user
-- The process-notification-queue cron job will send them when scheduled_time arrives
SELECT cron.schedule(
  'send-daily-notifications',
  '5 0 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-daily-notifications',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
    ) AS request_id;
  $$
);

