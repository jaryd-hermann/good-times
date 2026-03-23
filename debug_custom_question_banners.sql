-- ============================================================================
-- DEBUGGING: Why Custom Question Banners Stopped Showing
-- ============================================================================
-- This file contains diagnostic queries to identify why banners stopped appearing
-- Run these queries in order to diagnose the issue

-- ============================================================================
-- CRITICAL CHECK 1: Is the cron job configured?
-- ============================================================================
-- Check if pg_cron jobs exist for custom question assignment
-- NOTE: Edge Functions typically can't be called directly from pg_cron
-- They need to be scheduled via Supabase Dashboard or external service
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job
WHERE command LIKE '%assign-custom-question%' 
   OR jobname LIKE '%custom%question%'
   OR command LIKE '%custom-question-opportunity%';

-- If no results, the cron job is NOT configured in pg_cron
-- You need to check:
-- 1. Supabase Dashboard > Edge Functions > assign-custom-question-opportunity > Schedule
-- 2. External cron service (GitHub Actions, Vercel Cron, etc.)
-- 3. The function should run on Monday and Thursday at 12:01 AM UTC

-- ============================================================================
-- CRITICAL CHECK 2: Are groups marked as eligible?
-- ============================================================================
-- The assignment function only processes groups where is_eligible_for_custom_questions = true
SELECT 
  'Total Groups' as metric,
  COUNT(*) as count
FROM groups

UNION ALL

SELECT 
  'Groups with Tracking Record' as metric,
  COUNT(*) as count
FROM group_activity_tracking

UNION ALL

SELECT 
  'Groups Marked Eligible' as metric,
  COUNT(*) as count
FROM group_activity_tracking
WHERE is_eligible_for_custom_questions = true

UNION ALL

SELECT 
  'Groups with 3+ Members' as metric,
  COUNT(DISTINCT g.id) as count
FROM groups g
INNER JOIN group_members gm ON g.id = gm.group_id
GROUP BY g.id
HAVING COUNT(DISTINCT gm.user_id) >= 3;

-- Detailed view: Groups that should be eligible but aren't
SELECT 
  g.id,
  g.name,
  COUNT(DISTINCT gm.user_id) as member_count,
  gat.is_eligible_for_custom_questions,
  gat.updated_at as tracking_last_updated,
  CASE 
    WHEN COUNT(DISTINCT gm.user_id) >= 3 AND (gat.is_eligible_for_custom_questions IS NULL OR gat.is_eligible_for_custom_questions = false)
    THEN '⚠️ SHOULD BE ELIGIBLE'
    WHEN COUNT(DISTINCT gm.user_id) >= 3 AND gat.is_eligible_for_custom_questions = true
    THEN '✅ Eligible'
    ELSE '❌ Not Eligible (< 3 members)'
  END as status
FROM groups g
LEFT JOIN group_activity_tracking gat ON g.id = gat.group_id
LEFT JOIN group_members gm ON g.id = gm.group_id
GROUP BY g.id, g.name, gat.is_eligible_for_custom_questions, gat.updated_at
ORDER BY status DESC, gat.updated_at DESC NULLS LAST;

-- ============================================================================
-- CRITICAL CHECK 3: Has the assignment function been running?
-- ============================================================================
-- Check if opportunities were created on expected Monday/Thursday dates
WITH date_series AS (
  SELECT generate_series(
    CURRENT_DATE - INTERVAL '60 days',
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
  WHERE EXTRACT(DOW FROM check_date) IN (1, 4)
),
actual_assignments AS (
  SELECT 
    date_assigned,
    COUNT(*) as opportunities_created,
    COUNT(DISTINCT group_id) as groups_assigned,
    COUNT(DISTINCT user_id) as users_assigned
  FROM custom_questions
  WHERE date_assigned >= CURRENT_DATE - INTERVAL '60 days'
  GROUP BY date_assigned
)
SELECT 
  ed.check_date,
  ed.day_name,
  COALESCE(aa.opportunities_created, 0) as opportunities_created,
  COALESCE(aa.groups_assigned, 0) as groups_assigned,
  COALESCE(aa.users_assigned, 0) as users_assigned,
  CASE 
    WHEN aa.date_assigned IS NULL THEN '❌ MISSING - Function did not run'
    WHEN aa.opportunities_created = 0 THEN '⚠️ Ran but created 0 opportunities'
    ELSE '✅ Assigned'
  END as status
FROM expected_dates ed
LEFT JOIN actual_assignments aa ON ed.check_date = aa.date_assigned
ORDER BY ed.check_date DESC;

-- ============================================================================
-- CRITICAL CHECK 4: Eligible groups that should have gotten opportunities
-- ============================================================================
-- Compare eligible groups vs groups that actually received opportunities
WITH eligible_groups AS (
  SELECT DISTINCT group_id
  FROM group_activity_tracking
  WHERE is_eligible_for_custom_questions = true
),
recent_opportunities AS (
  SELECT DISTINCT group_id
  FROM custom_questions
  WHERE date_assigned >= CURRENT_DATE - INTERVAL '28 days'
)
SELECT 
  eg.group_id,
  g.name as group_name,
  gat.eligible_since,
  gat.updated_at as tracking_updated_at,
  COUNT(DISTINCT gm.user_id) as member_count,
  CASE WHEN ro.group_id IS NOT NULL THEN '✅ Has Opportunities' ELSE '❌ NO OPPORTUNITIES' END as status,
  (SELECT COUNT(*) FROM custom_questions cq WHERE cq.group_id = eg.group_id AND cq.date_assigned >= CURRENT_DATE - INTERVAL '28 days') as opportunities_last_28_days,
  (SELECT MAX(date_assigned) FROM custom_questions cq WHERE cq.group_id = eg.group_id) as last_opportunity_date
FROM eligible_groups eg
LEFT JOIN groups g ON eg.group_id = g.id
LEFT JOIN group_activity_tracking gat ON eg.group_id = gat.group_id
LEFT JOIN group_members gm ON eg.group_id = gm.group_id
LEFT JOIN recent_opportunities ro ON eg.group_id = ro.group_id
GROUP BY eg.group_id, g.name, gat.eligible_since, gat.updated_at, ro.group_id
ORDER BY status DESC, opportunities_last_28_days DESC, last_opportunity_date DESC NULLS LAST;

-- ============================================================================
-- CRITICAL CHECK 5: Pending opportunities that should show banners
-- ============================================================================
-- Opportunities assigned for today or past dates that haven't been completed
SELECT 
  cq.id,
  cq.group_id,
  g.name as group_name,
  cq.user_id,
  u.name as user_name,
  cq.date_assigned,
  CASE 
    WHEN cq.date_assigned = CURRENT_DATE AND cq.date_asked IS NULL THEN '✅ SHOULD SHOW BANNER TODAY'
    WHEN cq.date_assigned < CURRENT_DATE AND cq.date_asked IS NULL THEN '⚠️ EXPIRED (past date, no banner)'
    WHEN cq.date_assigned > CURRENT_DATE THEN '⏳ Future assignment'
    ELSE '✅ Completed'
  END as banner_status,
  cq.question,
  CASE 
    WHEN cq.question IS NULL OR cq.question = '' THEN 'Not Created'
    ELSE 'Created'
  END as question_status
FROM custom_questions cq
LEFT JOIN groups g ON cq.group_id = g.id
LEFT JOIN users u ON cq.user_id = u.id
WHERE cq.date_assigned <= CURRENT_DATE
  AND cq.date_asked IS NULL
ORDER BY cq.date_assigned DESC;

-- ============================================================================
-- DIAGNOSTIC SUMMARY
-- ============================================================================
-- Run this to get a quick overview of the system health
SELECT 
  '=== CUSTOM QUESTION SYSTEM DIAGNOSTIC ===' as section,
  '' as value

UNION ALL

SELECT 
  'Eligible Groups' as section,
  COUNT(*)::text as value
FROM group_activity_tracking
WHERE is_eligible_for_custom_questions = true

UNION ALL

SELECT 
  'Groups with 3+ Members' as section,
  COUNT(DISTINCT g.id)::text as value
FROM groups g
INNER JOIN group_members gm ON g.id = gm.group_id
GROUP BY g.id
HAVING COUNT(DISTINCT gm.user_id) >= 3

UNION ALL

SELECT 
  'Opportunities Last 28 Days' as section,
  COUNT(*)::text as value
FROM custom_questions
WHERE date_assigned >= CURRENT_DATE - INTERVAL '28 days'

UNION ALL

SELECT 
  'Pending Opportunities (should show banner)' as section,
  COUNT(*)::text as value
FROM custom_questions
WHERE date_assigned <= CURRENT_DATE
  AND date_asked IS NULL

UNION ALL

SELECT 
  'Last Opportunity Date' as section,
  COALESCE(MAX(date_assigned)::text, 'None') as value
FROM custom_questions

UNION ALL

SELECT 
  'Last Monday/Thursday Assignment' as section,
  COALESCE(
    (SELECT MAX(date_assigned)::text 
     FROM custom_questions 
     WHERE EXTRACT(DOW FROM date_assigned::date) IN (1, 4)
     AND date_assigned >= CURRENT_DATE - INTERVAL '60 days'),
    'None'
  ) as value;

-- ============================================================================
-- ACTION ITEMS BASED ON FINDINGS
-- ============================================================================
-- After running the above queries, check:

-- 1. If no cron job exists:
--    → Set up scheduling in Supabase Dashboard:
--       Edge Functions > assign-custom-question-opportunity > Schedule
--       Schedule: "0 1 * * 1,4" (Monday and Thursday at 12:01 AM UTC)
--    OR use external cron service

-- 2. If groups aren't marked eligible:
--    → Run the check-custom-question-eligibility function manually or via cron
--    → This function should run periodically to update eligibility

-- 3. If function ran but created 0 opportunities:
--    → Check function logs for errors
--    → Verify groups have 3+ members
--    → Check for conflicts (users already have opportunities on same date)

-- 4. If opportunities exist but banners don't show:
--    → Check frontend code for banner display logic
--    → Verify date_assigned matches current date
--    → Check if date_asked is null (should be null for pending opportunities)
