-- Create cron jobs for daily notification system
-- This schedules two functions:
-- 1. send-daily-notifications: Runs daily at midnight UTC to queue notifications for 8am local time
-- 2. process-notification-queue: Runs every 5 minutes to process queued notifications

-- First, ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Ensure pg_net extension is enabled (required for HTTP calls from cron)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Add service_role_key to app_settings if not exists
-- NOTE: User must update this with their actual service role key
INSERT INTO app_settings (key, value)
VALUES ('supabase_service_role_key', 'YOUR_SERVICE_ROLE_KEY')
ON CONFLICT (key) DO NOTHING;

-- Grant permissions
GRANT SELECT ON app_settings TO authenticated;
GRANT SELECT ON app_settings TO service_role;

-- Remove existing jobs if they exist
SELECT cron.unschedule('send-daily-notifications') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'send-daily-notifications'
);

SELECT cron.unschedule('process-notification-queue') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-notification-queue'
);

-- Schedule send-daily-notifications to run daily at 00:05 UTC
-- This runs early enough to queue notifications for 8am local time in all timezones
-- (8am in the latest timezone is around 20:00 UTC the previous day, so midnight UTC covers all)
SELECT cron.schedule(
  'send-daily-notifications',
  '5 0 * * *', -- Daily at 00:05 UTC
  $$
  SELECT
    net.http_post(
      url := get_app_setting('supabase_url') || '/functions/v1/send-daily-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || get_app_setting('supabase_service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Schedule process-notification-queue to run every 5 minutes
-- This processes notifications that are ready to be sent (scheduled_time <= now())
SELECT cron.schedule(
  'process-notification-queue',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url := get_app_setting('supabase_url') || '/functions/v1/process-notification-queue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || get_app_setting('supabase_service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

COMMENT ON EXTENSION pg_cron IS 'Enables scheduled jobs via cron for daily notifications';
