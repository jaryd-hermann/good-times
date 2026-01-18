-- Backfill Missing Prompts
-- This script will help identify and schedule prompts for missing dates
-- Run this AFTER fixing the schedule-daily-prompts function to backfill missing dates

-- Step 1: Identify missing prompts for the 3 groups
-- This shows which dates need prompts scheduled
SELECT 
  gd.group_id,
  gd.group_name,
  gd.date,
  CASE 
    WHEN EXTRACT(DOW FROM gd.date::date) = 0 THEN 'Sunday (should be Journal)'
    ELSE 'Standard'
  END as expected_type,
  CASE 
    WHEN dp.id IS NOT NULL THEN 'EXISTS'
    ELSE 'MISSING'
  END as status
FROM (
  SELECT 
    g.id as group_id,
    g.name as group_name,
    generate_series(
      '2026-01-10'::date,
      CURRENT_DATE,
      INTERVAL '1 day'
    )::date AS date
  FROM groups g
  WHERE g.id IN (
    '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2',
    '8dd82cfd-7328-4deb-96c0-d729f7fc8e68',
    'cd36520c-03fa-4e18-9442-cde27e7cfa64'
  )
) gd
LEFT JOIN daily_prompts dp ON dp.group_id = gd.group_id 
  AND dp.date = gd.date
  AND dp.user_id IS NULL
WHERE dp.id IS NULL
ORDER BY gd.group_id, gd.date DESC;

-- Step 2: Check if schedule-daily-prompts function has been running
-- Look for recent function invocations (if you have function logs)
-- This would need to be checked in your Supabase dashboard under Edge Functions logs

-- Step 3: Manual backfill (DO NOT RUN YET - needs to be done via schedule-daily-prompts function)
-- The schedule-daily-prompts function should handle this, but if needed, you can manually trigger it
-- for specific dates by calling the function with those dates

-- IMPORTANT: The schedule-daily-prompts function should be scheduled to run daily
-- Check your Supabase cron jobs or scheduled functions to ensure it's running
