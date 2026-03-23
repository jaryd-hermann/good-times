-- ============================================================================
-- BACKFILL MISSING CUSTOM QUESTION ASSIGNMENTS
-- ============================================================================
-- WARNING: This is a manual backfill script. Use with caution.
-- Ideally, fix the scheduler and let it run naturally going forward.
-- Only use this if you need to immediately restore functionality.

-- STEP 1: Identify missing dates and eligible groups
WITH missing_dates AS (
  SELECT generate_series(
    '2026-01-05'::date + INTERVAL '1 day', -- Day after last assignment
    CURRENT_DATE,
    '1 day'::interval
  )::date AS check_date
  WHERE EXTRACT(DOW FROM generate_series) IN (1, 4) -- Monday and Thursday
),
eligible_groups AS (
  SELECT DISTINCT group_id
  FROM group_activity_tracking
  WHERE is_eligible_for_custom_questions = true
),
missing_assignments AS (
  SELECT 
    md.check_date,
    eg.group_id
  FROM missing_dates md
  CROSS JOIN eligible_groups eg
  WHERE NOT EXISTS (
    SELECT 1 FROM custom_questions cq
    WHERE cq.group_id = eg.group_id
    AND cq.date_assigned = md.check_date
  )
)
SELECT 
  check_date,
  COUNT(*) as groups_needing_assignment
FROM missing_assignments
GROUP BY check_date
ORDER BY check_date DESC;

-- STEP 2: View what would be created (DRY RUN)
-- Run this first to see what would be created before actually creating records
WITH missing_dates AS (
  SELECT generate_series(
    '2026-01-05'::date + INTERVAL '1 day',
    CURRENT_DATE,
    '1 day'::interval
  )::date AS check_date
  WHERE EXTRACT(DOW FROM generate_series) IN (1, 4)
),
eligible_groups AS (
  SELECT DISTINCT group_id
  FROM group_activity_tracking
  WHERE is_eligible_for_custom_questions = true
),
groups_needing_assignment AS (
  SELECT 
    md.check_date,
    eg.group_id,
    g.name as group_name,
    (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = eg.group_id) as member_count
  FROM missing_dates md
  CROSS JOIN eligible_groups eg
  LEFT JOIN groups g ON eg.group_id = g.id
  WHERE NOT EXISTS (
    SELECT 1 FROM custom_questions cq
    WHERE cq.group_id = eg.group_id
    AND cq.date_assigned = md.check_date
  )
)
SELECT 
  check_date,
  COUNT(*) as total_assignments_needed,
  STRING_AGG(group_name, ', ' ORDER BY group_name) as groups
FROM groups_needing_assignment
GROUP BY check_date
ORDER BY check_date DESC;

-- ============================================================================
-- MANUAL BACKFILL (USE WITH CAUTION)
-- ============================================================================
-- NOTE: This is a simplified backfill. The actual assignment function has
-- complex logic for user rotation, conflict checking, etc.
-- 
-- RECOMMENDED APPROACH:
-- Instead of manually inserting, call the function for each missing date:
-- 
-- For each missing Monday/Thursday date:
-- 1. Temporarily modify the function to accept a date parameter, OR
-- 2. Manually invoke via Supabase Dashboard/API for each date, OR
-- 3. Wait for next Monday/Thursday and ensure scheduler is fixed
--
-- If you must backfill manually, you'll need to:
-- 1. Select users using rotation logic (prioritize unassigned users)
-- 2. Check for conflicts (users already assigned on that date)
-- 3. Create custom_question_rotation records
-- 4. Create custom_questions records
--
-- This is complex and error-prone. Better to fix the scheduler and let it run.

-- ============================================================================
-- BETTER SOLUTION: Fix the scheduler and manually trigger for today
-- ============================================================================
-- If today is Monday or Thursday:
-- 1. Go to Supabase Dashboard > Edge Functions > assign-custom-question-opportunity
-- 2. Click "Invoke" 
-- 3. This will create opportunities for today
-- 4. Then fix the scheduler so it runs automatically going forward

-- Check if we should manually trigger today:
SELECT 
  CASE 
    WHEN EXTRACT(DOW FROM CURRENT_DATE) IN (1, 4) 
      AND NOT EXISTS (SELECT 1 FROM custom_questions WHERE date_assigned = CURRENT_DATE)
    THEN '✅ MANUALLY TRIGGER FUNCTION FOR TODAY'
    ELSE 'No action needed for today'
  END as action_needed;
