-- Investigate why memorial questions were scheduled during ice-breaker period
-- Group: 8dd82cfd-7328-4deb-96c0-d729f7fc8e68
-- Created: 2025-11-29, Ice-breaker ends: 2025-12-07
-- Memorial questions scheduled on: 2025-12-01, 2025-12-04, 2025-12-06 (all during ice-breaker!)

WITH group_info AS (
  SELECT 
    id,
    name,
    type,
    created_at,
    ice_breaker_queue_completed_date,
    created_at::date AS created_date,
    ice_breaker_queue_completed_date::date AS ice_breaker_end_date
  FROM groups
  WHERE id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
),
memorial_questions AS (
  SELECT 
    dp.id,
    dp.date,
    dp.prompt_id,
    dp.created_at AS scheduled_at,
    dp.created_at::date AS scheduled_date,
    p.question,
    p.category,
    CASE 
      WHEN dp.date < gi.ice_breaker_end_date THEN 'DURING ICE-BREAKER'
      ELSE 'AFTER ICE-BREAKER'
    END AS period_status
  FROM daily_prompts dp
  JOIN prompts p ON dp.prompt_id = p.id
  CROSS JOIN group_info gi
  WHERE dp.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
    AND p.category = 'Remembering'
    AND dp.user_id IS NULL
  ORDER BY dp.date
),
queued_items AS (
  SELECT 
    gpq.id,
    gpq.position,
    gpq.created_at,
    gpq.prompt_id,
    p.category,
    p.question
  FROM group_prompt_queue gpq
  JOIN prompts p ON gpq.prompt_id = p.id
  WHERE gpq.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
    AND p.category = 'Remembering'
),
all_daily_prompts AS (
  -- Check ALL prompts scheduled during ice-breaker period
  SELECT 
    dp.date,
    dp.prompt_id,
    dp.created_at,
    p.category,
    p.question,
    p.ice_breaker,
    CASE 
      WHEN dp.date < gi.ice_breaker_end_date THEN 'DURING ICE-BREAKER'
      ELSE 'AFTER ICE-BREAKER'
    END AS period_status
  FROM daily_prompts dp
  JOIN prompts p ON dp.prompt_id = p.id
  CROSS JOIN group_info gi
  WHERE dp.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
    AND dp.user_id IS NULL
    AND dp.date < gi.ice_breaker_end_date
  ORDER BY dp.date
)

SELECT 
  '=== GROUP TIMELINE ===' AS section,
  NULL::text AS col1,
  NULL::text AS col2,
  NULL::text AS col3
WHERE FALSE

UNION ALL

SELECT 
  'TIMELINE',
  'Group Created',
  gi.created_at::text,
  NULL::text
FROM group_info gi

UNION ALL

SELECT 
  'TIMELINE',
  'Ice-breaker Ends',
  gi.ice_breaker_end_date::text,
  NULL::text
FROM group_info gi

UNION ALL

SELECT 
  '=== MEMORIAL QUESTIONS SCHEDULED ===' AS section,
  NULL::text,
  NULL::text,
  NULL::text
WHERE FALSE

UNION ALL

SELECT 
  'MEMORIAL Q',
  mq.date::text,
  mq.period_status,
  format('Scheduled: %s | Question: %s', 
    mq.scheduled_at::text,
    LEFT(mq.question, 60)
  )
FROM memorial_questions mq

UNION ALL

SELECT 
  '=== ALL PROMPTS DURING ICE-BREAKER PERIOD ===' AS section,
  NULL::text,
  NULL::text,
  NULL::text
WHERE FALSE

UNION ALL

SELECT 
  'ICE-BREAKER PERIOD',
  adp.date::text,
  adp.category,
  format('Ice-breaker: %s | %s', 
    COALESCE(adp.ice_breaker::text, 'false'),
    LEFT(adp.question, 50)
  )
FROM all_daily_prompts adp

UNION ALL

SELECT 
  '=== QUEUED MEMORIAL QUESTIONS ===' AS section,
  NULL::text,
  NULL::text,
  NULL::text
WHERE FALSE

UNION ALL

SELECT 
  'QUEUED',
  format('Position: %s', qi.position),
  qi.created_at::text,
  format('Question: %s', LEFT(qi.question, 60))
FROM queued_items qi

UNION ALL

SELECT 
  '=== ANALYSIS ===' AS section,
  NULL::text,
  NULL::text,
  NULL::text
WHERE FALSE

UNION ALL

SELECT 
  'ANALYSIS',
  format('Memorial Qs during ice-breaker: %s', COUNT(*)::text),
  'Should be: 0',
  NULL::text
FROM memorial_questions
WHERE period_status = 'DURING ICE-BREAKER'

UNION ALL

SELECT 
  'ANALYSIS',
  format('Total prompts during ice-breaker: %s', COUNT(*)::text),
  format('Ice-breaker prompts: %s', COUNT(*) FILTER (WHERE adp.ice_breaker = true)::text),
  format('Memorial prompts: %s', COUNT(*) FILTER (WHERE adp.category = 'Remembering')::text)
FROM all_daily_prompts adp

ORDER BY 
  CASE section
    WHEN '=== GROUP TIMELINE ===' THEN 1
    WHEN 'TIMELINE' THEN 2
    WHEN '=== MEMORIAL QUESTIONS SCHEDULED ===' THEN 3
    WHEN 'MEMORIAL Q' THEN 4
    WHEN '=== ALL PROMPTS DURING ICE-BREAKER PERIOD ===' THEN 5
    WHEN 'ICE-BREAKER PERIOD' THEN 6
    WHEN '=== QUEUED MEMORIAL QUESTIONS ===' THEN 7
    WHEN 'QUEUED' THEN 8
    WHEN '=== ANALYSIS ===' THEN 9
    WHEN 'ANALYSIS' THEN 10
    ELSE 99
  END,
  col1 NULLS LAST;

