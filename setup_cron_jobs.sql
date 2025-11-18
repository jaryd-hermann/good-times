CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'schedule-daily-prompts') THEN
    PERFORM cron.unschedule('schedule-daily-prompts');
  END IF;
  
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-daily-notifications') THEN
    PERFORM cron.unschedule('send-daily-notifications');
  END IF;
  
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-notification-queue') THEN
    PERFORM cron.unschedule('process-notification-queue');
  END IF;
END $$;

SELECT cron.schedule(
  'schedule-daily-prompts',
  '1 0 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://ytnnsykbgohiscfgomfe.supabase.co/functions/v1/schedule-daily-prompts',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0bm5zeWtiZ29oaXNjZmdvbWZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NTAxMjYsImV4cCI6MjA3NzQyNjEyNn0.hsr5uNE-Tmuz8dLoPH7lJI7CaeTJkzQBIDr1-K0lI0g"}'::jsonb
    ) AS request_id;
  $$
);

SELECT cron.schedule(
  'send-daily-notifications',
  '0 9 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://ytnnsykbgohiscfgomfe.supabase.co/functions/v1/send-daily-notifications',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0bm5zeWtiZ29oaXNjZmdvbWZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NTAxMjYsImV4cCI6MjA3NzQyNjEyNn0.hsr5uNE-Tmuz8dLoPH7lJI7CaeTJkzQBIDr1-K0lI0g"}'::jsonb
    ) AS request_id;
  $$
);

