-- Migration: Add Cron Jobs for Birthday Cards Feature

-- 1. Create birthday cards daily at 1 AM UTC (7 days before birthdays)
SELECT cron.schedule(
  'create-birthday-cards',
  '0 1 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://ytnnsykbgohiscfgomfe.supabase.co/functions/v1/create-birthday-cards',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0bm5zeWtiZ29oaXNjZmdvbWZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NTAxMjYsImV4cCI6MjA3NzQyNjEyNn0.hsr5uNE-Tmuz8dLoPH7lJI7CaeTJkzQBIDr1-K0lI0g"}'::jsonb
    ) AS request_id;
  $$
);

-- 2. Send birthday card notifications daily at 8 AM UTC (7 days before birthdays)
SELECT cron.schedule(
  'send-birthday-card-notifications',
  '0 8 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://ytnnsykbgohiscfgomfe.supabase.co/functions/v1/send-birthday-card-notifications',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0bm5zeWtiZ29oaXNjZmdvbWZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NTAxMjYsImV4cCI6MjA3NzQyNjEyNn0.hsr5uNE-Tmuz8dLoPH7lJI7CaeTJkzQBIDr1-K0lI0g"}'::jsonb
    ) AS request_id;
  $$
);

-- 3. Send birthday card reminders daily at 8 AM UTC (2 days before birthdays)
SELECT cron.schedule(
  'send-birthday-card-reminders',
  '0 8 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://ytnnsykbgohiscfgomfe.supabase.co/functions/v1/send-birthday-card-reminders',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0bm5zeWtiZ29oaXNjZmdvbWZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NTAxMjYsImV4cCI6MjA3NzQyNjEyNn0.hsr5uNE-Tmuz8dLoPH7lJI7CaeTJkzQBIDr1-K0lI0g"}'::jsonb
    ) AS request_id;
  $$
);

-- 4. Publish birthday cards hourly (12 hours before birthday)
SELECT cron.schedule(
  'publish-birthday-cards',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
      url:='https://ytnnsykbgohiscfgomfe.supabase.co/functions/v1/publish-birthday-cards',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0bm5zeWtiZ29oaXNjZmdvbWZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NTAxMjYsImV4cCI6MjA3NzQyNjEyNn0.hsr5uNE-Tmuz8dLoPH7lJI7CaeTJkzQBIDr1-K0lI0g"}'::jsonb
    ) AS request_id;
  $$
);

-- 5. Send birthday card ready notification daily at 8 AM UTC (on birthday day)
SELECT cron.schedule(
  'send-birthday-card-ready-notification',
  '0 8 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://ytnnsykbgohiscfgomfe.supabase.co/functions/v1/send-birthday-card-ready-notification',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0bm5zeWtiZ29oaXNjZmdvbWZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NTAxMjYsImV4cCI6MjA3NzQyNjEyNn0.hsr5uNE-Tmuz8dLoPH7lJI7CaeTJkzQBIDr1-K0lI0g"}'::jsonb
    ) AS request_id;
  $$
);

