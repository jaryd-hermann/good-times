-- Migration 013: Add cron job to process notification queue
-- This runs every 5 minutes to process queued notifications

DO $$
BEGIN
  -- Unschedule existing job if it exists
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-notification-queue') THEN
    PERFORM cron.unschedule('process-notification-queue');
  END IF;
END $$;

-- Schedule job to run every 5 minutes
SELECT cron.schedule(
  'process-notification-queue',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url:='https://ytnnsykbgohiscfgomfe.supabase.co/functions/v1/process-notification-queue',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0bm5zeWtiZ29oaXNjZmdvbWZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NTAxMjYsImV4cCI6MjA3NzQyNjEyNn0.hsr5uNE-Tmuz8dLoPH7lJI7CaeTJkzQBIDr1-K0lI0g"}'::jsonb
    ) AS request_id;
  $$
);

