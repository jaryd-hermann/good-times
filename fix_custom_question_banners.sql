-- ============================================================================
-- FIX SCRIPT: Restore Custom Question Banner Functionality
-- ============================================================================
-- Run these queries to fix the custom question banner issue
-- Execute in order, checking results after each step

-- ============================================================================
-- STEP 1: Update group eligibility (if groups aren't marked eligible)
-- ============================================================================
-- This ensures all groups with 3+ members are marked as eligible
-- You can also call the check-custom-question-eligibility function instead

-- First, let's see what needs fixing:
SELECT 
  g.id,
  g.name,
  COUNT(DISTINCT gm.user_id) as member_count,
  gat.is_eligible_for_custom_questions as currently_eligible
FROM groups g
LEFT JOIN group_members gm ON g.id = gm.group_id
LEFT JOIN group_activity_tracking gat ON g.id = gat.group_id
GROUP BY g.id, g.name, gat.is_eligible_for_custom_questions
HAVING COUNT(DISTINCT gm.user_id) >= 3
  AND (gat.is_eligible_for_custom_questions IS NULL OR gat.is_eligible_for_custom_questions = false)
ORDER BY g.name;

-- Fix: Mark all groups with 3+ members as eligible
-- NOTE: This is a manual fix. Ideally, run the check-custom-question-eligibility function instead
INSERT INTO group_activity_tracking (group_id, is_eligible_for_custom_questions, eligible_since, updated_at)
SELECT 
  g.id,
  true,
  COALESCE(
    (SELECT MIN(gm2.joined_at) FROM group_members gm2 WHERE gm2.group_id = g.id AND gm2.role != 'admin'),
    NOW()
  ),
  NOW()
FROM groups g
WHERE g.id NOT IN (SELECT group_id FROM group_activity_tracking WHERE group_id IS NOT NULL)
  AND (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) >= 3
ON CONFLICT (group_id) 
DO UPDATE SET
  is_eligible_for_custom_questions = CASE 
    WHEN (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = group_activity_tracking.group_id) >= 3 
    THEN true 
    ELSE false 
  END,
  updated_at = NOW();

-- ============================================================================
-- STEP 2: Check for and clean up stale/expired opportunities
-- ============================================================================
-- Opportunities assigned for past dates that were never completed
-- These won't show banners but clutter the data

-- View expired opportunities
SELECT 
  cq.id,
  cq.group_id,
  g.name as group_name,
  cq.date_assigned,
  CURRENT_DATE - cq.date_assigned::date as days_expired,
  cq.question,
  CASE 
    WHEN cq.question IS NULL OR cq.question = '' THEN 'Never Created'
    ELSE 'Created but Not Scheduled'
  END as status
FROM custom_questions cq
LEFT JOIN groups g ON cq.group_id = g.id
WHERE cq.date_assigned < CURRENT_DATE
  AND cq.date_asked IS NULL
ORDER BY cq.date_assigned DESC;

-- Optional: Clean up expired opportunities older than 7 days
-- Uncomment to execute:
/*
DELETE FROM custom_questions
WHERE date_assigned < CURRENT_DATE - INTERVAL '7 days'
  AND date_asked IS NULL
  AND (question IS NULL OR question = '');
*/

-- ============================================================================
-- STEP 3: Verify cron job setup
-- ============================================================================
-- Check if cron jobs are configured (if using pg_cron)
-- NOTE: Edge Functions typically need to be scheduled via Supabase Dashboard

-- Check for pg_cron jobs
SELECT 
  jobid,
  schedule,
  command,
  jobname,
  active
FROM cron.job
WHERE command LIKE '%assign-custom-question%' 
   OR jobname LIKE '%custom%question%'
   OR command LIKE '%custom-question-opportunity%';

-- If no results, you need to set up scheduling:
-- 1. Go to Supabase Dashboard > Edge Functions > assign-custom-question-opportunity
-- 2. Click "Schedule" 
-- 3. Set schedule to: "0 1 * * 1,4" (Monday and Thursday at 12:01 AM UTC)
--    OR use cron expression: "cron(1 0 ? * MON,THU *)" for AWS EventBridge format

-- Also check if eligibility function is scheduled:
SELECT 
  jobid,
  schedule,
  command,
  jobname,
  active
FROM cron.job
WHERE command LIKE '%check-custom-question-eligibility%'
   OR jobname LIKE '%eligibility%';

-- Eligibility function should run daily or weekly to keep groups updated
-- Schedule: "0 2 * * *" (Daily at 12:02 AM UTC) or "0 2 * * 0" (Weekly on Sunday)

-- ============================================================================
-- STEP 4: Manually trigger assignment for today (if it's Monday or Thursday)
-- ============================================================================
-- If today is Monday or Thursday and no opportunities exist, you can manually create them
-- First check what day it is:
SELECT 
  CURRENT_DATE as today,
  EXTRACT(DOW FROM CURRENT_DATE) as day_of_week,
  CASE 
    WHEN EXTRACT(DOW FROM CURRENT_DATE) = 1 THEN 'Monday - Should assign'
    WHEN EXTRACT(DOW FROM CURRENT_DATE) = 4 THEN 'Thursday - Should assign'
    ELSE 'Not Monday/Thursday - Assignment not needed today'
  END as assignment_status,
  (SELECT COUNT(*) FROM custom_questions WHERE date_assigned = CURRENT_DATE) as opportunities_today;

-- If today is Monday or Thursday and opportunities are missing, you can:
-- 1. Call the function manually via Supabase Dashboard > Edge Functions > Invoke
-- 2. Or use the Supabase API:
--    POST https://your-project.supabase.co/functions/v1/assign-custom-question-opportunity
--    Headers: Authorization: Bearer YOUR_SERVICE_ROLE_KEY

-- ============================================================================
-- STEP 5: Create missing opportunities for recent Monday/Thursdays
-- ============================================================================
-- This is a manual backfill - use with caution
-- Only run if you understand the implications

-- First, identify missing dates:
WITH date_series AS (
  SELECT generate_series(
    CURRENT_DATE - INTERVAL '14 days', -- Last 2 weeks
    CURRENT_DATE,
    '1 day'::interval
  )::date AS check_date
),
expected_dates AS (
  SELECT check_date
  FROM date_series
  WHERE EXTRACT(DOW FROM check_date) IN (1, 4) -- Monday and Thursday
),
eligible_groups AS (
  SELECT DISTINCT group_id
  FROM group_activity_tracking
  WHERE is_eligible_for_custom_questions = true
)
SELECT 
  ed.check_date,
  eg.group_id,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM custom_questions cq 
      WHERE cq.group_id = eg.group_id 
      AND cq.date_assigned = ed.check_date
    ) THEN 'Has Opportunity'
    ELSE 'MISSING'
  END as status
FROM expected_dates ed
CROSS JOIN eligible_groups eg
WHERE NOT EXISTS (
  SELECT 1 FROM custom_questions cq 
  WHERE cq.group_id = eg.group_id 
  AND cq.date_assigned = ed.check_date
)
ORDER BY ed.check_date DESC, eg.group_id;

-- NOTE: Don't manually insert opportunities - let the function handle it
-- Instead, ensure the cron job is set up correctly and will run going forward

-- ============================================================================
-- VERIFICATION: After fixes, verify the system is working
-- ============================================================================
SELECT 
  '=== POST-FIX VERIFICATION ===' as check_type,
  '' as value

UNION ALL

SELECT 
  'Eligible Groups' as check_type,
  COUNT(*)::text as value
FROM group_activity_tracking
WHERE is_eligible_for_custom_questions = true

UNION ALL

SELECT 
  'Opportunities Today' as check_type,
  COUNT(*)::text as value
FROM custom_questions
WHERE date_assigned = CURRENT_DATE

UNION ALL

SELECT 
  'Pending Opportunities (should show banner)' as check_type,
  COUNT(*)::text as value
FROM custom_questions
WHERE date_assigned = CURRENT_DATE
  AND date_asked IS NULL

UNION ALL

SELECT 
  'Last Assignment Date' as check_type,
  COALESCE(MAX(date_assigned)::text, 'None') as value
FROM custom_questions
WHERE date_assigned >= CURRENT_DATE - INTERVAL '14 days';

-- ============================================================================
-- ACTION ITEMS SUMMARY
-- ============================================================================
-- After running diagnostics, ensure:

-- ✅ 1. Groups with 3+ members are marked eligible in group_activity_tracking
--    → Run check-custom-question-eligibility function or use STEP 1 above

-- ✅ 2. assign-custom-question-opportunity function is scheduled
--    → Supabase Dashboard > Edge Functions > Schedule
--    → Schedule: Monday and Thursday at 12:01 AM UTC

-- ✅ 3. check-custom-question-eligibility function is scheduled (optional but recommended)
--    → Run daily or weekly to keep eligibility updated

-- ✅ 4. Function logs show successful execution
--    → Check Supabase Dashboard > Edge Functions > Logs

-- ✅ 5. No errors in function execution
--    → Review logs for any errors or warnings
