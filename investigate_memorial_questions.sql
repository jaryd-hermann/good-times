-- Investigate why group 8dd82cfd-7328-4deb-96c0-d729f7fc8e68 got 4 memorial questions this week
-- Groups should get 1-2 memorial questions per week

-- Calculate the start of the current week (Monday)
-- PostgreSQL: Monday is day 1, so we subtract (day_of_week - 1) days
WITH current_week AS (
  SELECT 
    CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::int - 1) AS week_start,
    CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::int - 1) + INTERVAL '6 days' AS week_end
)

SELECT section, col1, col2, col3
FROM (
  -- PART 1: Group Information
  SELECT '=== GROUP INFORMATION ===' AS section, NULL::text AS col1, NULL::text AS col2, NULL::text AS col3
  UNION ALL
  SELECT 
    'GROUP INFO',
    g.name,
    g.type,
    format('Created: %s | Ice-breaker completes: %s', g.created_at::text, COALESCE(g.ice_breaker_queue_completed_date::text, 'NULL'))
  FROM groups g
  WHERE g.id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  UNION ALL
  SELECT 
    'MEMORIALS',
    format('%s memorial(s)', COUNT(*)::text),
    COALESCE(array_to_string(array_agg(m.name ORDER BY m.created_at), ', '), 'None'),
    NULL::text
  FROM memorials m
  WHERE m.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  UNION ALL
  SELECT 
    'CATEGORY PREF',
    COALESCE(cp.preference, 'Not set'),
    format('Weight: %s', COALESCE(cp.weight::text, '1.0')),
    NULL::text
  FROM question_category_preferences cp
  WHERE cp.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68' AND cp.category = 'Remembering'

  UNION ALL

  -- PART 2: This Week's Memorial Questions
  SELECT '=== THIS WEEK MEMORIAL QUESTIONS (SHOULD BE 1-2) ===', NULL::text, NULL::text, NULL::text
  UNION ALL
  SELECT 
    'THIS WEEK',
    dp.date::text,
    LEFT(p.question, 100),
    format('ID: %s | Scheduled: %s', dp.prompt_id, dp.created_at::text)
  FROM daily_prompts dp
  JOIN prompts p ON dp.prompt_id = p.id
  CROSS JOIN current_week cw
  WHERE dp.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
    AND dp.date >= cw.week_start::date
    AND dp.date <= cw.week_end::date
    AND p.category = 'Remembering'
    AND dp.user_id IS NULL
  UNION ALL
  SELECT 
    'SUMMARY',
    format('Total: %s (Expected: 1-2)', COUNT(*)::text),
    NULL::text,
    NULL::text
  FROM daily_prompts dp
  JOIN prompts p ON dp.prompt_id = p.id
  CROSS JOIN current_week cw
  WHERE dp.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
    AND dp.date >= cw.week_start::date
    AND dp.date <= cw.week_end::date
    AND p.category = 'Remembering'
    AND dp.user_id IS NULL

  UNION ALL

  -- PART 3: Queued Memorial Questions
  SELECT '=== QUEUED MEMORIAL QUESTIONS ===', NULL::text, NULL::text, NULL::text
  UNION ALL
  SELECT 
    'QUEUED',
    format('Position: %s', gpq.position),
    LEFT(p.question, 100),
    format('Queued: %s', gpq.created_at::text)
  FROM group_prompt_queue gpq
  JOIN prompts p ON gpq.prompt_id = p.id
  WHERE gpq.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68' AND p.category = 'Remembering'

  UNION ALL

  -- PART 4: Recent Memorial Questions (Last 3 weeks)
  SELECT '=== RECENT MEMORIAL QUESTIONS (LAST 3 WEEKS) ===', NULL::text, NULL::text, NULL::text
  UNION ALL
  SELECT 
    'RECENT',
    dp.date::text,
    LEFT(p.question, 100),
    format('ID: %s', dp.prompt_id)
  FROM daily_prompts dp
  JOIN prompts p ON dp.prompt_id = p.id
  WHERE dp.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
    AND p.category = 'Remembering'
    AND dp.user_id IS NULL
    AND dp.date >= CURRENT_DATE - INTERVAL '21 days'
) AS results
ORDER BY 
  CASE section
    WHEN '=== GROUP INFORMATION ===' THEN 1
    WHEN 'GROUP INFO' THEN 2
    WHEN 'MEMORIALS' THEN 3
    WHEN 'CATEGORY PREF' THEN 4
    WHEN '=== THIS WEEK MEMORIAL QUESTIONS (SHOULD BE 1-2) ===' THEN 5
    WHEN 'THIS WEEK' THEN 6
    WHEN 'SUMMARY' THEN 7
    WHEN '=== QUEUED MEMORIAL QUESTIONS ===' THEN 8
    WHEN 'QUEUED' THEN 9
    WHEN '=== RECENT MEMORIAL QUESTIONS (LAST 3 WEEKS) ===' THEN 10
    WHEN 'RECENT' THEN 11
    ELSE 99
  END,
  col1 NULLS LAST;
