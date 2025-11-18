-- ============================================================================
-- COMPLETE NOTIFICATION SETUP SCRIPT
-- Run this entire script in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- STEP 1: Enable Required Extensions
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- STEP 2: Fix RLS Policies for push_tokens
-- ============================================================================

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can insert own push tokens" ON push_tokens;
DROP POLICY IF EXISTS "Users can view own push tokens" ON push_tokens;
DROP POLICY IF EXISTS "Users can update own push tokens" ON push_tokens;
DROP POLICY IF EXISTS "Users can delete own push tokens" ON push_tokens;

-- Create policies for push_tokens
CREATE POLICY "Users can insert own push tokens" 
ON push_tokens FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own push tokens" 
ON push_tokens FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own push tokens" 
ON push_tokens FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own push tokens" 
ON push_tokens FOR DELETE 
USING (auth.uid() = user_id);

-- Note: Service role (used by Edge Functions) bypasses RLS automatically
-- No policy needed for service role

-- ============================================================================
-- STEP 3: Fix RLS Policies for notifications
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Service role can insert notifications" ON notifications;

-- Create policies for notifications
CREATE POLICY "Users can view own notifications" 
ON notifications FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" 
ON notifications FOR UPDATE 
USING (auth.uid() = user_id);

-- Allow service role to insert (Edge Functions use service role which bypasses RLS)
-- This policy is for clarity/documentation, but service role bypasses RLS anyway
CREATE POLICY "Service role can insert notifications" 
ON notifications FOR INSERT 
WITH CHECK (true);

-- ============================================================================
-- STEP 4: Add Missing Indexes for Performance
-- ============================================================================

-- Index for push_tokens lookups by user_id
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);

-- Index for push_tokens lookups by token (already unique, but index helps)
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(token);

-- Index for notifications lookups by user_id
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- Index for notifications by read status and user
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);

-- Index for notifications by created_at (for sorting)
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================================================
-- STEP 5: Setup Cron Jobs
-- ============================================================================

-- First, unschedule any existing jobs
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

-- ============================================================================
-- IMPORTANT: Update the URLs and Authorization Bearer token below!
-- ============================================================================
-- 
-- To find your values:
-- 1. Project Reference: Found in your Supabase URL (https://[PROJECT_REF].supabase.co)
-- 2. Service Role Key: Supabase Dashboard → Settings → API → service_role key
--    (NOT the anon key - use the service_role key for cron jobs!)
--
-- Replace [YOUR_PROJECT_REF] with your actual project reference
-- Replace [YOUR_SERVICE_ROLE_KEY] with your actual service role key
-- ============================================================================

-- Schedule daily prompt assignment at 12:01 AM UTC
SELECT cron.schedule(
  'schedule-daily-prompts',
  '1 0 * * *',  -- Runs at 12:01 AM UTC daily
  $$
  SELECT
    net.http_post(
      url:='https://[YOUR_PROJECT_REF].supabase.co/functions/v1/schedule-daily-prompts',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer [YOUR_SERVICE_ROLE_KEY]"}'::jsonb
    ) AS request_id;
  $$
);

-- Schedule daily notifications at 9:00 AM UTC
SELECT cron.schedule(
  'send-daily-notifications',
  '0 9 * * *',  -- Runs at 9:00 AM UTC daily
  $$
  SELECT
    net.http_post(
      url:='https://[YOUR_PROJECT_REF].supabase.co/functions/v1/send-daily-notifications',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer [YOUR_SERVICE_ROLE_KEY]"}'::jsonb
    ) AS request_id;
  $$
);

-- ============================================================================
-- STEP 6: Verification Queries (Run these after the script to verify)
-- ============================================================================

-- Check RLS policies were created
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
-- FROM pg_policies 
-- WHERE tablename IN ('push_tokens', 'notifications')
-- ORDER BY tablename, policyname;

-- Check indexes were created
-- SELECT tablename, indexname 
-- FROM pg_indexes 
-- WHERE tablename IN ('push_tokens', 'notifications')
-- ORDER BY tablename, indexname;

-- Check cron jobs are scheduled
-- SELECT jobid, jobname, schedule, active 
-- FROM cron.job 
-- WHERE jobname IN ('schedule-daily-prompts', 'send-daily-notifications');

-- Check if push tokens exist (should be populated when users log in)
-- SELECT COUNT(*) as total_tokens, COUNT(DISTINCT user_id) as unique_users 
-- FROM push_tokens;

-- Check if notifications exist (will be populated when cron jobs run)
-- SELECT COUNT(*) as total_notifications, COUNT(DISTINCT user_id) as users_with_notifications 
-- FROM notifications;

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================

