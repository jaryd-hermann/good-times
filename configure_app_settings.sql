-- Configure app_settings for onboarding email cron job
-- Run this in Supabase Dashboard → SQL Editor

-- Step 1: Check current values
SELECT key, value FROM app_settings WHERE key IN ('supabase_url', 'supabase_anon_key');

-- Step 2: Update with your actual values
-- Replace 'YOUR_PROJECT_REF' with your actual Supabase project reference
-- Replace 'YOUR_ANON_KEY' with your actual Supabase anon key
-- You can find these in: Supabase Dashboard → Settings → API

UPDATE app_settings 
SET value = 'https://YOUR_PROJECT_REF.supabase.co'
WHERE key = 'supabase_url';

UPDATE app_settings 
SET value = 'YOUR_ANON_KEY'
WHERE key = 'supabase_anon_key';

-- Step 3: Verify the update
SELECT 
  key,
  CASE 
    WHEN key = 'supabase_url' AND value LIKE '%YOUR_PROJECT_REF%' THEN '❌ STILL NOT CONFIGURED'
    WHEN key = 'supabase_anon_key' AND value = 'YOUR_ANON_KEY' THEN '❌ STILL NOT CONFIGURED'
    ELSE '✅ CONFIGURED'
  END as status,
  -- Show first/last few characters for security
  CASE 
    WHEN key = 'supabase_url' THEN value
    WHEN key = 'supabase_anon_key' THEN LEFT(value, 10) || '...' || RIGHT(value, 10)
    ELSE value
  END as value_preview
FROM app_settings
WHERE key IN ('supabase_url', 'supabase_anon_key');
