-- Migration: Add cron job for processing onboarding emails
-- This cron job runs every hour to check for and send scheduled onboarding emails

-- Schedule onboarding email processor to run every hour
SELECT cron.schedule(
  'process-onboarding-emails',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
      url:='https://ytnnsykbgohiscfgomfe.supabase.co/functions/v1/process-onboarding-emails',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
    ) AS request_id;
  $$
);

-- Note: After running this migration, you need to:
-- 1. Replace YOUR_PROJECT_REF with your actual Supabase project reference
-- 2. Replace YOUR_ANON_KEY with your actual Supabase anon key
-- 3. Or set them as database settings:
--    ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';
--    ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'your-anon-key';

