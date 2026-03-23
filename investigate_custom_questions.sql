-- Investigation queries for custom questions debugging
-- Run these queries to understand the custom question flow

-- ============================================================================
-- 1. When was the last custom question asked in any group?
-- ============================================================================
-- This finds the most recent date when a custom question was actually asked
-- (date_asked is set and not null, meaning it was scheduled)
SELECT 
  MAX(date_asked) as last_custom_question_asked_date,
  COUNT(*) FILTER (WHERE date_asked IS NOT NULL) as total_questions_asked,
  COUNT(*) FILTER (WHERE date_asked IS NOT NULL AND date_asked >= CURRENT_DATE - INTERVAL '28 days') as questions_asked_last_28_days
FROM custom_questions
WHERE date_asked IS NOT NULL;

-- More detailed view: last 10 custom questions asked
SELECT 
  cq.id,
  cq.group_id,
  g.name as group_name,
  cq.user_id,
  u.name as user_name,
  cq.question,
  cq.date_assigned,
  cq.date_asked,
  cq.created_at,
  cq.prompt_id
FROM custom_questions cq
LEFT JOIN groups g ON cq.group_id = g.id
LEFT JOIN users u ON cq.user_id = u.id
WHERE cq.date_asked IS NOT NULL
ORDER BY cq.date_asked DESC
LIMIT 10;

-- ============================================================================
-- 2. How many Tuesday and Thursdays in the past 28 days did someone in a group 
--    get the banner prompt to ask a custom question?
-- ============================================================================
-- NOTE: The code assigns opportunities on Monday and Thursday, but you asked about
-- Tuesday and Thursday. This query checks for Tuesday/Thursday as requested.
-- The banner is shown when date_assigned equals today and date_asked is null
-- This counts unique Tuesday/Thursday dates in the past 28 days where opportunities exist

WITH date_series AS (
  SELECT generate_series(
    CURRENT_DATE - INTERVAL '28 days',
    CURRENT_DATE,
    '1 day'::interval
  )::date AS check_date
),
tuesday_thursdays AS (
  SELECT 
    check_date,
    EXTRACT(DOW FROM check_date) as day_of_week,
    CASE 
      WHEN EXTRACT(DOW FROM check_date) = 2 THEN 'Tuesday'
      WHEN EXTRACT(DOW FROM check_date) = 4 THEN 'Thursday'
      ELSE NULL
    END as day_name
  FROM date_series
  WHERE EXTRACT(DOW FROM check_date) IN (2, 4) -- 2 = Tuesday, 4 = Thursday
),
opportunities_by_date AS (
  SELECT DISTINCT
    date_assigned,
    COUNT(DISTINCT group_id) as groups_with_opportunity,
    COUNT(DISTINCT user_id) as users_with_opportunity,
    COUNT(*) as total_opportunities
  FROM custom_questions
  WHERE date_assigned >= CURRENT_DATE - INTERVAL '28 days'
    AND date_assigned <= CURRENT_DATE
    AND date_asked IS NULL  -- Still pending (banner would show)
  GROUP BY date_assigned
)
SELECT 
  COUNT(DISTINCT tt.check_date) as tuesday_thursday_days_with_banner,
  COUNT(DISTINCT obd.date_assigned) as unique_dates_with_opportunities,
  SUM(obd.groups_with_opportunity) as total_group_opportunities,
  SUM(obd.users_with_opportunity) as total_user_opportunities,
  SUM(obd.total_opportunities) as total_pending_opportunities
FROM tuesday_thursdays tt
LEFT JOIN opportunities_by_date obd ON tt.check_date = obd.date_assigned
WHERE obd.date_assigned IS NOT NULL;

-- Detailed breakdown by day
WITH date_series AS (
  SELECT generate_series(
    CURRENT_DATE - INTERVAL '28 days',
    CURRENT_DATE,
    '1 day'::interval
  )::date AS check_date
),
tuesday_thursdays AS (
  SELECT 
    check_date,
    CASE 
      WHEN EXTRACT(DOW FROM check_date) = 2 THEN 'Tuesday'
      WHEN EXTRACT(DOW FROM check_date) = 4 THEN 'Thursday'
    END as day_name
  FROM date_series
  WHERE EXTRACT(DOW FROM check_date) IN (2, 4)
)
SELECT 
  tt.check_date,
  tt.day_name,
  COUNT(DISTINCT cq.group_id) as groups_with_banner,
  COUNT(DISTINCT cq.user_id) as users_with_banner,
  COUNT(*) as total_banner_opportunities
FROM tuesday_thursdays tt
LEFT JOIN custom_questions cq ON tt.check_date = cq.date_assigned AND cq.date_asked IS NULL
GROUP BY tt.check_date, tt.day_name
ORDER BY tt.check_date DESC;

-- ALTERNATIVE: Check for Monday/Thursday (as per the actual code logic)
-- If you meant Monday/Thursday instead of Tuesday/Thursday, use this query:

WITH date_series AS (
  SELECT generate_series(
    CURRENT_DATE - INTERVAL '28 days',
    CURRENT_DATE,
    '1 day'::interval
  )::date AS check_date
),
monday_thursdays AS (
  SELECT 
    check_date,
    CASE 
      WHEN EXTRACT(DOW FROM check_date) = 1 THEN 'Monday'
      WHEN EXTRACT(DOW FROM check_date) = 4 THEN 'Thursday'
    END as day_name
  FROM date_series
  WHERE EXTRACT(DOW FROM check_date) IN (1, 4) -- 1 = Monday, 4 = Thursday
)
SELECT 
  mt.check_date,
  mt.day_name,
  COUNT(DISTINCT cq.group_id) as groups_with_banner,
  COUNT(DISTINCT cq.user_id) as users_with_banner,
  COUNT(*) as total_banner_opportunities
FROM monday_thursdays mt
LEFT JOIN custom_questions cq ON mt.check_date = cq.date_assigned AND cq.date_asked IS NULL
GROUP BY mt.check_date, mt.day_name
ORDER BY mt.check_date DESC;
*/

-- ============================================================================
-- 3. How many custom questions actually got created?
-- ============================================================================
-- A custom question is "created" when:
-- - question is not empty (not '' or NULL)
-- - prompt_id is set (not NULL)
-- This means the user filled in the question and it was saved

SELECT 
  COUNT(*) FILTER (WHERE question IS NOT NULL AND question != '' AND prompt_id IS NOT NULL) as total_created,
  COUNT(*) FILTER (WHERE question IS NOT NULL AND question != '' AND prompt_id IS NOT NULL AND created_at >= CURRENT_DATE - INTERVAL '28 days') as created_last_28_days,
  COUNT(*) FILTER (WHERE question IS NOT NULL AND question != '' AND prompt_id IS NOT NULL AND date_assigned >= CURRENT_DATE - INTERVAL '28 days') as created_from_opportunities_last_28_days,
  COUNT(*) as total_opportunities,
  COUNT(*) FILTER (WHERE date_assigned >= CURRENT_DATE - INTERVAL '28 days') as opportunities_last_28_days
FROM custom_questions;

-- Detailed breakdown: created vs not created
SELECT 
  CASE 
    WHEN question IS NOT NULL AND question != '' AND prompt_id IS NOT NULL THEN 'Created'
    ELSE 'Not Created'
  END as status,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE date_assigned >= CURRENT_DATE - INTERVAL '28 days') as last_28_days
FROM custom_questions
GROUP BY status;

-- Created custom questions with details (last 28 days)
SELECT 
  cq.id,
  cq.group_id,
  g.name as group_name,
  cq.user_id,
  u.name as user_name,
  cq.question,
  cq.date_assigned,
  cq.date_asked,
  cq.created_at,
  cq.prompt_id,
  CASE 
    WHEN cq.date_asked IS NOT NULL THEN 'Scheduled'
    ELSE 'Created but not scheduled'
  END as scheduling_status
FROM custom_questions cq
LEFT JOIN groups g ON cq.group_id = g.id
LEFT JOIN users u ON cq.user_id = u.id
WHERE cq.question IS NOT NULL 
  AND cq.question != ''
  AND cq.prompt_id IS NOT NULL
  AND cq.date_assigned >= CURRENT_DATE - INTERVAL '28 days'
ORDER BY cq.created_at DESC;

-- ============================================================================
-- 4. How many custom questions actually got scheduled?
-- ============================================================================
-- A custom question is "scheduled" when:
-- - date_asked is set (not NULL) - meaning it was assigned a date to be asked
-- - AND it appears in daily_prompts table (meaning it was actually scheduled for that date)
-- OR
-- - It appears in group_prompt_queue (alternative scheduling mechanism)

-- Method 1: Check via date_asked (when createCustomQuestion sets date_asked)
SELECT 
  COUNT(DISTINCT cq.id) FILTER (WHERE cq.date_asked IS NOT NULL) as scheduled_via_date_asked,
  COUNT(DISTINCT cq.id) FILTER (WHERE cq.date_asked IS NOT NULL AND cq.date_asked >= CURRENT_DATE - INTERVAL '28 days') as scheduled_last_28_days,
  COUNT(DISTINCT cq.id) FILTER (WHERE cq.date_asked IS NOT NULL AND cq.date_asked < CURRENT_DATE) as scheduled_in_past,
  COUNT(DISTINCT cq.id) FILTER (WHERE cq.date_asked IS NOT NULL AND cq.date_asked >= CURRENT_DATE) as scheduled_in_future
FROM custom_questions cq
WHERE cq.question IS NOT NULL 
  AND cq.question != ''
  AND cq.prompt_id IS NOT NULL;

-- Method 2: Check via daily_prompts table (actual scheduling)
SELECT 
  COUNT(DISTINCT dp.prompt_id) as scheduled_in_daily_prompts,
  COUNT(DISTINCT dp.prompt_id) FILTER (WHERE dp.date >= CURRENT_DATE - INTERVAL '28 days') as scheduled_last_28_days,
  COUNT(DISTINCT dp.prompt_id) FILTER (WHERE dp.date < CURRENT_DATE) as already_asked,
  COUNT(DISTINCT dp.prompt_id) FILTER (WHERE dp.date >= CURRENT_DATE) as scheduled_future
FROM daily_prompts dp
INNER JOIN prompts p ON dp.prompt_id = p.id
WHERE p.is_custom = true
  AND p.custom_question_id IS NOT NULL;

-- Method 3: Check via group_prompt_queue (alternative scheduling)
SELECT 
  COUNT(DISTINCT gpq.prompt_id) as in_queue,
  COUNT(DISTINCT gpq.prompt_id) FILTER (WHERE gpq.created_at >= CURRENT_DATE - INTERVAL '28 days') as added_to_queue_last_28_days
FROM group_prompt_queue gpq
INNER JOIN prompts p ON gpq.prompt_id = p.id
WHERE p.is_custom = true
  AND p.custom_question_id IS NOT NULL;

-- Comprehensive view: All custom questions and their scheduling status
SELECT 
  cq.id,
  cq.group_id,
  g.name as group_name,
  cq.user_id,
  u.name as user_name,
  cq.question,
  cq.date_assigned,
  cq.date_asked,
  cq.created_at,
  cq.prompt_id,
  CASE 
    WHEN cq.question IS NULL OR cq.question = '' OR cq.prompt_id IS NULL THEN 'Not Created'
    WHEN cq.date_asked IS NULL THEN 'Created but Not Scheduled'
    WHEN EXISTS (
      SELECT 1 FROM daily_prompts dp 
      WHERE dp.prompt_id = cq.prompt_id 
      AND dp.group_id = cq.group_id
    ) THEN 'Scheduled (in daily_prompts)'
    WHEN EXISTS (
      SELECT 1 FROM group_prompt_queue gpq 
      WHERE gpq.prompt_id = cq.prompt_id 
      AND gpq.group_id = cq.group_id
    ) THEN 'Scheduled (in queue)'
    WHEN cq.date_asked IS NOT NULL THEN 'Scheduled (date_asked set)'
    ELSE 'Unknown Status'
  END as status,
  (SELECT COUNT(*) FROM daily_prompts dp WHERE dp.prompt_id = cq.prompt_id AND dp.group_id = cq.group_id) as times_in_daily_prompts,
  (SELECT COUNT(*) FROM group_prompt_queue gpq WHERE gpq.prompt_id = cq.prompt_id AND gpq.group_id = cq.group_id) as times_in_queue
FROM custom_questions cq
LEFT JOIN groups g ON cq.group_id = g.id
LEFT JOIN users u ON cq.user_id = u.id
WHERE cq.date_assigned >= CURRENT_DATE - INTERVAL '28 days'
ORDER BY cq.date_assigned DESC, cq.created_at DESC;

-- ============================================================================
-- SUMMARY: Quick overview of the entire flow
-- ============================================================================
SELECT 
  'Total Opportunities (date_assigned set)' as metric,
  COUNT(*) as count
FROM custom_questions
WHERE date_assigned >= CURRENT_DATE - INTERVAL '28 days'

UNION ALL

SELECT 
  'Opportunities Still Pending (banner showing)' as metric,
  COUNT(*) as count
FROM custom_questions
WHERE date_assigned >= CURRENT_DATE - INTERVAL '28 days'
  AND date_assigned <= CURRENT_DATE
  AND date_asked IS NULL

UNION ALL

SELECT 
  'Custom Questions Created (question filled)' as metric,
  COUNT(*) as count
FROM custom_questions
WHERE date_assigned >= CURRENT_DATE - INTERVAL '28 days'
  AND question IS NOT NULL 
  AND question != ''
  AND prompt_id IS NOT NULL

UNION ALL

SELECT 
  'Custom Questions Scheduled (date_asked set)' as metric,
  COUNT(*) as count
FROM custom_questions
WHERE date_assigned >= CURRENT_DATE - INTERVAL '28 days'
  AND question IS NOT NULL 
  AND question != ''
  AND prompt_id IS NOT NULL
  AND date_asked IS NOT NULL

UNION ALL

SELECT 
  'Custom Questions in daily_prompts' as metric,
  COUNT(DISTINCT dp.prompt_id) as count
FROM daily_prompts dp
INNER JOIN prompts p ON dp.prompt_id = p.id
INNER JOIN custom_questions cq ON p.custom_question_id = cq.id
WHERE cq.date_assigned >= CURRENT_DATE - INTERVAL '28 days'
  AND p.is_custom = true

ORDER BY metric;

-- ============================================================================
-- DEBUGGING: Why banners stopped showing
-- ============================================================================

-- Check 1: Are groups marked as eligible?
SELECT 
  COUNT(*) as total_groups,
  COUNT(*) FILTER (WHERE gat.is_eligible_for_custom_questions = true) as eligible_groups,
  COUNT(*) FILTER (WHERE gat.is_eligible_for_custom_questions = false) as not_eligible_groups,
  COUNT(*) FILTER (WHERE gat.is_eligible_for_custom_questions IS NULL) as null_eligibility,
  COUNT(*) FILTER (WHERE gat.group_id IS NULL) as groups_without_tracking
FROM groups g
LEFT JOIN group_activity_tracking gat ON g.id = gat.group_id;

-- Check 2: Eligible groups with member counts
SELECT 
  gat.group_id,
  g.name as group_name,
  gat.is_eligible_for_custom_questions,
  gat.eligible_since,
  gat.updated_at as tracking_updated_at,
  COUNT(DISTINCT gm.user_id) as member_count
FROM group_activity_tracking gat
LEFT JOIN groups g ON gat.group_id = g.id
LEFT JOIN group_members gm ON gat.group_id = gm.group_id
WHERE gat.is_eligible_for_custom_questions = true
GROUP BY gat.group_id, g.name, gat.is_eligible_for_custom_questions, gat.eligible_since, gat.updated_at
ORDER BY gat.updated_at DESC;

-- Check 3: Recent custom question opportunities (last 60 days)
-- This shows if the assignment function has been running
SELECT 
  date_assigned,
  EXTRACT(DOW FROM date_assigned::date) as day_of_week,
  CASE 
    WHEN EXTRACT(DOW FROM date_assigned::date) = 1 THEN 'Monday'
    WHEN EXTRACT(DOW FROM date_assigned::date) = 4 THEN 'Thursday'
    ELSE 'Other'
  END as day_name,
  COUNT(DISTINCT group_id) as groups_with_opportunity,
  COUNT(DISTINCT user_id) as users_with_opportunity,
  COUNT(*) as total_opportunities,
  COUNT(*) FILTER (WHERE date_asked IS NULL) as still_pending,
  COUNT(*) FILTER (WHERE date_asked IS NOT NULL) as completed
FROM custom_questions
WHERE date_assigned >= CURRENT_DATE - INTERVAL '60 days'
GROUP BY date_assigned
ORDER BY date_assigned DESC;

-- Check 4: Missing Monday/Thursday assignments (expected vs actual)
-- This identifies dates where assignments should have happened but didn't
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
    CASE 
      WHEN EXTRACT(DOW FROM check_date) = 1 THEN 'Monday'
      WHEN EXTRACT(DOW FROM check_date) = 4 THEN 'Thursday'
      ELSE NULL
    END as day_name
  FROM date_series
  WHERE EXTRACT(DOW FROM check_date) IN (1, 4) -- Monday and Thursday
),
actual_assignments AS (
  SELECT DISTINCT date_assigned
  FROM custom_questions
  WHERE date_assigned >= CURRENT_DATE - INTERVAL '60 days'
)
SELECT 
  ed.check_date,
  ed.day_name,
  CASE WHEN aa.date_assigned IS NOT NULL THEN 'Assigned' ELSE 'MISSING' END as status,
  (SELECT COUNT(*) FROM custom_questions cq WHERE cq.date_assigned = ed.check_date) as opportunities_created
FROM expected_dates ed
LEFT JOIN actual_assignments aa ON ed.check_date = aa.date_assigned
ORDER BY ed.check_date DESC;

-- Check 5: Groups that should have gotten opportunities but didn't
-- Compare eligible groups vs groups that got opportunities in last 28 days
WITH eligible_groups AS (
  SELECT DISTINCT group_id
  FROM group_activity_tracking
  WHERE is_eligible_for_custom_questions = true
),
groups_with_opportunities AS (
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
  CASE WHEN gwo.group_id IS NOT NULL THEN 'Has Opportunities' ELSE 'NO OPPORTUNITIES' END as status,
  (SELECT COUNT(*) FROM custom_questions cq WHERE cq.group_id = eg.group_id AND cq.date_assigned >= CURRENT_DATE - INTERVAL '28 days') as opportunities_count
FROM eligible_groups eg
LEFT JOIN groups g ON eg.group_id = g.id
LEFT JOIN group_activity_tracking gat ON eg.group_id = gat.group_id
LEFT JOIN group_members gm ON eg.group_id = gm.group_id
LEFT JOIN groups_with_opportunities gwo ON eg.group_id = gwo.group_id
GROUP BY eg.group_id, g.name, gat.eligible_since, gat.updated_at, gwo.group_id
ORDER BY status, opportunities_count DESC;

-- Check 6: Check for cron job execution (if you have function logs)
-- This requires access to Supabase function logs, but here's a query structure:
-- Note: You'll need to check Supabase Dashboard > Edge Functions > Logs for actual execution
SELECT 
  'Check Supabase Dashboard > Edge Functions > assign-custom-question-opportunity > Logs' as instruction,
  'Look for execution logs on Mondays and Thursdays at 12:01 AM UTC' as note;

-- Check 7: Pending opportunities that should show banners today
SELECT 
  cq.id,
  cq.group_id,
  g.name as group_name,
  cq.user_id,
  u.name as user_name,
  cq.date_assigned,
  cq.date_asked,
  cq.question,
  cq.prompt_id,
  CASE 
    WHEN cq.date_assigned = CURRENT_DATE AND cq.date_asked IS NULL THEN 'SHOULD SHOW BANNER'
    WHEN cq.date_assigned < CURRENT_DATE AND cq.date_asked IS NULL THEN 'EXPIRED (past date)'
    ELSE 'Other'
  END as banner_status
FROM custom_questions cq
LEFT JOIN groups g ON cq.group_id = g.id
LEFT JOIN users u ON cq.user_id = u.id
WHERE cq.date_assigned <= CURRENT_DATE
  AND cq.date_asked IS NULL
ORDER BY cq.date_assigned DESC;

-- Check 8: Verify group eligibility logic
-- Groups with 3+ members but not marked eligible
SELECT 
  g.id as group_id,
  g.name as group_name,
  COUNT(DISTINCT gm.user_id) as member_count,
  gat.is_eligible_for_custom_questions,
  gat.updated_at as tracking_updated_at,
  CASE 
    WHEN COUNT(DISTINCT gm.user_id) >= 3 AND (gat.is_eligible_for_custom_questions IS NULL OR gat.is_eligible_for_custom_questions = false) 
    THEN 'SHOULD BE ELIGIBLE'
    ELSE 'OK'
  END as eligibility_status
FROM groups g
LEFT JOIN group_members gm ON g.id = gm.group_id
LEFT JOIN group_activity_tracking gat ON g.id = gat.group_id
GROUP BY g.id, g.name, gat.is_eligible_for_custom_questions, gat.updated_at
HAVING COUNT(DISTINCT gm.user_id) >= 3
ORDER BY eligibility_status DESC, gat.updated_at DESC NULLS LAST;
