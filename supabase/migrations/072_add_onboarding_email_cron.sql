-- Create cron job to process onboarding emails
-- This runs every 15 minutes to check for emails that are due to be sent

-- First, ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Ensure pg_net extension is enabled (required for HTTP calls from cron)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a settings table to store Supabase configuration (since ALTER DATABASE requires superuser)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings (user will need to update these with actual values)
-- These can be updated via: UPDATE app_settings SET value = 'YOUR_VALUE' WHERE key = 'supabase_url';
INSERT INTO app_settings (key, value)
VALUES 
  ('supabase_url', 'https://YOUR_PROJECT_REF.supabase.co'),
  ('supabase_anon_key', 'YOUR_ANON_KEY')
ON CONFLICT (key) DO NOTHING;

-- Grant permissions
GRANT SELECT ON app_settings TO authenticated;
GRANT SELECT ON app_settings TO service_role;

-- Helper function to get setting value
CREATE OR REPLACE FUNCTION get_app_setting(setting_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  setting_value TEXT;
BEGIN
  SELECT value INTO setting_value
  FROM app_settings
  WHERE key = setting_key;
  
  IF setting_value IS NULL THEN
    RAISE EXCEPTION 'Setting % not found. Please update app_settings table.', setting_key;
  END IF;
  
  RETURN setting_value;
END;
$$;

-- Remove existing job if it exists
SELECT cron.unschedule('process-onboarding-emails') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-onboarding-emails'
);

-- Schedule the cron job to run every 15 minutes
-- It calls the process-onboarding-emails Edge Function via HTTP
SELECT cron.schedule(
  'process-onboarding-emails',
  '*/15 * * * *', -- Every 15 minutes
  $$
  SELECT
    net.http_post(
      url := get_app_setting('supabase_url') || '/functions/v1/process-onboarding-emails',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || get_app_setting('supabase_anon_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

COMMENT ON TABLE app_settings IS 'Application settings for cron jobs and other server-side operations';
COMMENT ON FUNCTION get_app_setting IS 'Retrieves a setting value from app_settings table';
COMMENT ON EXTENSION pg_cron IS 'Enables scheduled jobs via cron';
