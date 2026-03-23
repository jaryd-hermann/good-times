-- ============================================================================
-- SCHEDULER STATUS CHECK
-- ============================================================================
-- This query identifies exactly when the scheduler stopped working

-- Check 1: All Monday/Thursday dates since last assignment
WITH date_series AS (
  SELECT generate_series(
    '2026-01-05'::date, -- Last known assignment date
    CURRENT_DATE,
    '1 day'::interval
  )::date AS check_date
),
expected_dates AS (
  SELECT 
    check_date,
    EXTRACT(DOW FROM check_date) as day_of_week,
    CASE 
      WHEN EXTRACT(DOW FROM check_date) = 1 THEN 'Monday'
      WHEN EXTRACT(DOW FROM check_date) = 4 THEN 'Thursday'
      ELSE NULL
    END as day_name
  FROM date_series
  WHERE EXTRACT(DOW FROM check_date) IN (1, 4) -- Monday and Thursday
),
actual_assignments AS (
  SELECT 
    date_assigned,
    COUNT(*) as opportunities_created,
    COUNT(DISTINCT group_id) as groups_assigned
  FROM custom_questions
  WHERE date_assigned >= '2026-01-05'::date
  GROUP BY date_assigned
)
SELECT 
  ed.check_date,
  ed.day_name,
  COALESCE(aa.opportunities_created, 0) as opportunities_created,
  COALESCE(aa.groups_assigned, 0) as groups_assigned,
  CASE 
    WHEN aa.date_assigned IS NULL THEN '❌ MISSING - Scheduler did not run'
    WHEN aa.opportunities_created = 0 THEN '⚠️ Ran but created 0 opportunities'
    ELSE '✅ Assigned'
  END as status,
  CASE 
    WHEN aa.date_assigned IS NULL THEN 
      (SELECT COUNT(*) FROM group_activity_tracking WHERE is_eligible_for_custom_questions = true)
    ELSE NULL
  END as eligible_groups_at_time
FROM expected_dates ed
LEFT JOIN actual_assignments aa ON ed.check_date = aa.date_assigned
ORDER BY ed.check_date DESC;

-- Check 2: Verify cron job exists (if using pg_cron)
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') 
    THEN 'pg_cron extension is installed'
    ELSE 'pg_cron extension NOT installed'
  END as cron_status;

-- Check 3: List all cron jobs (if pg_cron is available)
SELECT 
  jobid,
  schedule,
  command,
  jobname,
  active,
  CASE 
    WHEN command LIKE '%assign-custom-question%' OR jobname LIKE '%custom%question%' 
    THEN '✅ Custom Question Job Found'
    ELSE 'Other Job'
  END as is_custom_question_job
FROM cron.job
WHERE EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
ORDER BY is_custom_question_job DESC, jobid;

-- Check 4: Count missing assignments
SELECT 
  COUNT(*) as missing_assignments,
  MIN(check_date) as first_missing_date,
  MAX(check_date) as last_missing_date
FROM (
  SELECT generate_series(
    '2026-01-05'::date,
    CURRENT_DATE,
    '1 day'::interval
  )::date AS check_date
) dates
WHERE EXTRACT(DOW FROM check_date) IN (1, 4) -- Monday and Thursday
  AND NOT EXISTS (
    SELECT 1 FROM custom_questions 
    WHERE date_assigned = dates.check_date
  );

-- Check 5: Today's status
SELECT 
  CURRENT_DATE as today,
  EXTRACT(DOW FROM CURRENT_DATE) as day_of_week,
  CASE 
    WHEN EXTRACT(DOW FROM CURRENT_DATE) = 1 THEN 'Monday - Should have assignments TODAY'
    WHEN EXTRACT(DOW FROM CURRENT_DATE) = 4 THEN 'Thursday - Should have assignments TODAY'
    ELSE 'Not Monday/Thursday - No assignment needed today'
  END as today_status,
  (SELECT COUNT(*) FROM custom_questions WHERE date_assigned = CURRENT_DATE) as opportunities_today,
  (SELECT COUNT(*) FROM group_activity_tracking WHERE is_eligible_for_custom_questions = true) as eligible_groups_today;

-- ============================================================================
-- ACTION REQUIRED
-- ============================================================================
-- Based on the results:
-- 1. If cron job doesn't exist → Set up scheduling (see fix_custom_question_banners.sql)
-- 2. If cron job exists but inactive → Activate it
-- 3. If today is Monday/Thursday and no opportunities → Manually trigger function
-- 4. Consider backfilling missing dates (see below)
