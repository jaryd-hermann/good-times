-- IMPORTANT: This migration documents the need for scheduling schedule-daily-prompts
-- Edge Functions cannot be called directly from pg_cron, so you need to set up
-- an external scheduler (e.g., GitHub Actions, Vercel Cron, or Supabase Scheduled Functions)

-- Option 1: Use Supabase Scheduled Functions (if available in your plan)
-- Set this up in Supabase Dashboard > Edge Functions > schedule-daily-prompts > Schedule
-- Schedule: Daily at 00:01 UTC

-- Option 2: Use external cron service (GitHub Actions, Vercel Cron, etc.)
-- Create a workflow that calls: POST https://your-project.supabase.co/functions/v1/schedule-daily-prompts
-- With Authorization header: Bearer YOUR_SERVICE_ROLE_KEY

-- Option 3: Use pg_cron with pg_net extension (if available)
-- This requires pg_net extension and proper configuration
-- See BACKFILL_INSTRUCTIONS.md for details

-- For now, this migration just documents the requirement
-- The actual scheduling should be set up via Supabase Dashboard or external service
