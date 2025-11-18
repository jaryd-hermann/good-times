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

DO $$
DECLARE
  group_record RECORD;
  today_date DATE := CURRENT_DATE;
  day_index INTEGER;
  group_offset INTEGER;
  selected_prompt_id UUID;
BEGIN
  FOR group_record IN SELECT id, type FROM groups LOOP
    IF NOT EXISTS (
      SELECT 1 FROM daily_prompts 
      WHERE group_id = group_record.id 
      AND date = today_date
      AND user_id IS NULL
    ) THEN
      group_offset := length(group_record.id::text);
      day_index := (today_date - '2020-01-01'::date)::integer + group_offset;
      
      SELECT id INTO selected_prompt_id
      FROM prompts
      WHERE birthday_type IS NULL
        AND (group_record.type = 'friends' OR category != 'Edgy/NSFW')
      ORDER BY id
      LIMIT 1
      OFFSET (day_index % (
        SELECT COUNT(*) FROM prompts 
        WHERE birthday_type IS NULL 
        AND (group_record.type = 'friends' OR category != 'Edgy/NSFW')
      ));
      
      IF selected_prompt_id IS NOT NULL THEN
        INSERT INTO daily_prompts (group_id, prompt_id, date, user_id)
        SELECT group_record.id, selected_prompt_id, today_date, NULL
        WHERE NOT EXISTS (
          SELECT 1 FROM daily_prompts 
          WHERE group_id = group_record.id 
          AND date = today_date 
          AND user_id IS NULL
        );
      END IF;
    END IF;
  END LOOP;
END $$;

