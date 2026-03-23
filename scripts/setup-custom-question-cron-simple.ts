#!/usr/bin/env tsx
/**
 * Simplified script that generates the SQL you need to run
 * This is easier since Supabase client doesn't support direct SQL execution
 * 
 * Usage: tsx scripts/setup-custom-question-cron-simple.ts
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://ytnnsykbgohiscfgomfe.supabase.co"
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required")
  process.exit(1)
}

console.log("=".repeat(70))
console.log("Custom Question Assignment - Cron Setup SQL")
console.log("=".repeat(70))
console.log("\nCopy and paste this SQL into Supabase Dashboard → SQL Editor:\n")
console.log("-".repeat(70))

const sql = `
-- Ensure extensions are enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Ensure app_settings table exists
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure get_app_setting function exists
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

-- Update app_settings with your values
INSERT INTO app_settings (key, value)
VALUES 
  ('supabase_url', '${SUPABASE_URL}'),
  ('supabase_service_role_key', '${SUPABASE_SERVICE_ROLE_KEY}')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- Grant permissions
GRANT SELECT ON app_settings TO authenticated;
GRANT SELECT ON app_settings TO service_role;

-- Remove existing job if it exists
SELECT cron.unschedule('assign-custom-question-opportunity') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'assign-custom-question-opportunity'
);

-- Schedule the cron job (Monday and Thursday at 12:01 AM UTC)
SELECT cron.schedule(
  'assign-custom-question-opportunity',
  '1 0 * * 1,4', -- Monday(1) and Thursday(4) at 00:01 UTC
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

-- Verify the job was created
SELECT 
  jobid,
  schedule,
  jobname,
  active,
  CASE 
    WHEN schedule = '1 0 * * 1,4' THEN '✅ Correct schedule'
    ELSE '⚠️  Unexpected schedule'
  END as status
FROM cron.job
WHERE jobname = 'assign-custom-question-opportunity';
`

console.log(sql)
console.log("-".repeat(70))
console.log("\n✅ After running this SQL:")
console.log("   - Cron job will run every Monday and Thursday at 12:01 AM UTC")
console.log("   - It will automatically call assign-custom-question-opportunity")
console.log("   - Opportunities will be created for eligible groups")
console.log("\n🔍 To verify it's working:")
console.log("   - Check Supabase Dashboard → Edge Functions → Logs")
console.log("   - Look for executions on Monday/Thursday mornings (UTC)")
console.log("   - Or run: SELECT * FROM cron.job WHERE jobname = 'assign-custom-question-opportunity';")
console.log("=".repeat(70))
