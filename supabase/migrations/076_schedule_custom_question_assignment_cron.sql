-- Create cron job for custom question assignment
-- This schedules assign-custom-question-opportunity to run on Monday and Thursday at 12:01 AM UTC

-- First, ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Ensure pg_net extension is enabled (required for HTTP calls from cron)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Ensure app_settings table exists (created in migration 072)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure get_app_setting function exists (created in migration 072)
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

-- Ensure service_role_key is in app_settings (will be updated by script if needed)
INSERT INTO app_settings (key, value)
VALUES ('supabase_service_role_key', 'YOUR_SERVICE_ROLE_KEY')
ON CONFLICT (key) DO NOTHING;

-- Grant permissions
GRANT SELECT ON app_settings TO authenticated;
GRANT SELECT ON app_settings TO service_role;

-- Remove existing job if it exists
SELECT cron.unschedule('assign-custom-question-opportunity') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'assign-custom-question-opportunity'
);

-- Schedule the cron job to run on Monday and Thursday at 12:01 AM UTC
-- Cron expression: 0 1 * * 1,4 means: minute 0, hour 1, any day of month, any month, Monday(1) and Thursday(4)
SELECT cron.schedule(
  'assign-custom-question-opportunity',
  '1 0 * * 1,4', -- Monday and Thursday at 12:01 AM UTC
  $$
  SELECT
    net.http_post(
      url := get_app_setting('supabase_url') || '/functions/v1/assign-custom-question-opportunity',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || get_app_setting('supabase_service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

COMMENT ON EXTENSION pg_cron IS 'Enables scheduled jobs via cron for custom question assignment';
