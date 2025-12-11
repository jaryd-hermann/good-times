-- Schedule automated personalization jobs
-- This enables the personalization system to run on autopilot

-- ============================================================================
-- 1. DAILY PERSONALIZATION TASKS
-- ============================================================================
-- Runs daily after schedule-daily-prompts completes
-- Refreshes group profiles and updates global metrics

-- Note: This uses pg_cron to call a SQL function directly
-- Schedule: Daily at 12:05 AM UTC (5 minutes after schedule-daily-prompts at 12:01 AM)
SELECT cron.schedule(
  'run-daily-personalization-tasks',
  '5 0 * * *',  -- 12:05 AM UTC daily
  $$
  SELECT run_daily_personalization_tasks();
  $$
);

-- ============================================================================
-- 2. WEEKLY QUEUE POPULATION
-- ============================================================================
-- Runs weekly to populate personalized questions into group queues
-- Schedule: Sunday at 11:00 PM UTC (before Monday's scheduling)

SELECT cron.schedule(
  'populate-personalized-queue-weekly',
  '0 23 * * 0',  -- 11:00 PM UTC every Sunday
  $$
  SELECT populate_personalized_queue();
  $$
);

-- ============================================================================
-- 3. VERIFICATION QUERIES
-- ============================================================================

-- Check scheduled jobs
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job
WHERE jobname IN ('run-daily-personalization-tasks', 'populate-personalized-queue-weekly');

-- ============================================================================
-- 4. COMMENTS
-- ============================================================================

COMMENT ON FUNCTION run_daily_personalization_tasks IS 
  'Runs daily personalization maintenance: refreshes profiles and updates global metrics. Scheduled via pg_cron.';

COMMENT ON FUNCTION populate_personalized_queue IS 
  'Populates group queues with personalized questions. Should be called weekly via pg_cron.';

