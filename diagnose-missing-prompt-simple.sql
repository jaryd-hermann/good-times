-- Simple diagnostic queries to find why group ce951223-3540-4007-816d-829f260a5f5d has no question today
-- Run each query separately in Supabase SQL Editor

-- 1. Group basic info and ice-breaker status
SELECT 
    id,
    name,
    type,
    ice_breaker_queue_completed_date,
    created_at,
    CASE 
        WHEN ice_breaker_queue_completed_date IS NULL THEN '❌ NULL - Group may need initialization'
        WHEN ice_breaker_queue_completed_date > CURRENT_DATE THEN '⚠️ IN ICE-BREAKER PERIOD (completes ' || ice_breaker_queue_completed_date::TEXT || ')'
        ELSE '✅ COMPLETED (completion date: ' || ice_breaker_queue_completed_date::TEXT || ')'
    END as ice_breaker_status
FROM groups
WHERE id = 'ce951223-3540-4007-816d-829f260a5f5d';

-- 2. Check if daily prompt exists for today
SELECT 
    dp.id,
    dp.date,
    dp.prompt_id,
    dp.user_id,
    p.category,
    p.question,
    p.birthday_type,
    CASE 
        WHEN dp.id IS NOT NULL THEN '✅ Daily prompt EXISTS for today'
        ELSE '❌ NO daily prompt for today'
    END as status
FROM daily_prompts dp
LEFT JOIN prompts p ON dp.prompt_id = p.id
WHERE dp.group_id = 'ce951223-3540-4007-816d-829f260a5f5d'
AND dp.date = CURRENT_DATE;

-- 3. Check for queued items (Featured, Custom, etc.)
SELECT 
    qp.id,
    qp.position,
    qp.prompt_id,
    p.category,
    LEFT(p.question, 80) as question_preview,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Has ' || COUNT(*)::TEXT || ' queued items'
        ELSE '❌ NO queued items'
    END as status
FROM group_prompt_queue qp
LEFT JOIN prompts p ON qp.prompt_id = p.id
WHERE qp.group_id = 'ce951223-3540-4007-816d-829f260a5f5d'
GROUP BY qp.id, qp.position, qp.prompt_id, p.category, p.question
ORDER BY qp.position ASC;

-- 4. Check for custom questions scheduled for today
SELECT 
    cq.id,
    cq.prompt_id,
    cq.date_asked,
    LEFT(p.question, 80) as question_preview,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Custom question scheduled for today'
        ELSE '❌ NO custom question for today'
    END as status
FROM custom_questions cq
LEFT JOIN prompts p ON cq.prompt_id = p.id
WHERE cq.group_id = 'ce951223-3540-4007-816d-829f260a5f5d'
AND cq.date_asked = CURRENT_DATE
AND cq.prompt_id IS NOT NULL
GROUP BY cq.id, cq.prompt_id, cq.date_asked, p.question;

-- 5. Recent daily prompts (last 7 days) - to see pattern
SELECT 
    dp.date,
    dp.prompt_id,
    p.category,
    LEFT(p.question, 60) as question_preview,
    dp.user_id,
    CASE 
        WHEN dp.user_id IS NOT NULL THEN 'User-specific'
        ELSE 'General'
    END as prompt_type
FROM daily_prompts dp
LEFT JOIN prompts p ON dp.prompt_id = p.id
WHERE dp.group_id = 'ce951223-3540-4007-816d-829f260a5f5d'
AND dp.date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY dp.date DESC;

-- 6. Group members count
SELECT 
    COUNT(*) as member_count,
    CASE 
        WHEN COUNT(*) = 0 THEN '❌ NO MEMBERS'
        WHEN COUNT(*) = 1 THEN '⚠️ Only 1 member'
        ELSE '✅ ' || COUNT(*)::TEXT || ' members'
    END as status
FROM group_members
WHERE group_id = 'ce951223-3540-4007-816d-829f260a5f5d';

-- 7. Check for memorial prompts this week (Monday to today)
-- This prevents multiple memorial prompts in one week
WITH week_start AS (
    SELECT 
        CASE 
            WHEN EXTRACT(DOW FROM CURRENT_DATE) = 0 THEN CURRENT_DATE - INTERVAL '6 days' -- Sunday -> Monday
            ELSE CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER - 1) * INTERVAL '1 day' -- Tuesday-Saturday -> Monday
        END as monday
)
SELECT 
    dp.date,
    p.category,
    LEFT(p.question, 60) as question_preview,
    CASE 
        WHEN COUNT(*) > 0 THEN '⚠️ Memorial prompt already scheduled this week (prevents another)'
        ELSE '✅ NO memorial prompt this week (can schedule one)'
    END as status
FROM daily_prompts dp
JOIN prompts p ON dp.prompt_id = p.id
CROSS JOIN week_start ws
WHERE dp.group_id = 'ce951223-3540-4007-816d-829f260a5f5d'
AND dp.date >= ws.monday
AND dp.date <= CURRENT_DATE
AND p.category = 'Remembering'
AND dp.user_id IS NULL
GROUP BY dp.date, p.category, p.question;

-- 8. Summary query - all key info in one place
SELECT 
    'Group Info' as check_type,
    g.name as detail_1,
    CASE 
        WHEN g.ice_breaker_queue_completed_date IS NULL THEN 'NULL completion date'
        WHEN g.ice_breaker_queue_completed_date > CURRENT_DATE THEN 'In ice-breaker period'
        ELSE 'Ice-breaker completed'
    END as detail_2,
    NULL::TEXT as detail_3
FROM groups g
WHERE g.id = 'ce951223-3540-4007-816d-829f260a5f5d'

UNION ALL

SELECT 
    'Daily Prompt Today' as check_type,
    CASE WHEN EXISTS (
        SELECT 1 FROM daily_prompts 
        WHERE group_id = 'ce951223-3540-4007-816d-829f260a5f5d' 
        AND date = CURRENT_DATE
    ) THEN 'EXISTS' ELSE 'MISSING' END as detail_1,
    NULL::TEXT as detail_2,
    NULL::TEXT as detail_3

UNION ALL

SELECT 
    'Queued Items' as check_type,
    COUNT(*)::TEXT as detail_1,
    CASE WHEN COUNT(*) > 0 THEN 'Has queue' ELSE 'No queue' END as detail_2,
    NULL::TEXT as detail_3
FROM group_prompt_queue
WHERE group_id = 'ce951223-3540-4007-816d-829f260a5f5d'

UNION ALL

SELECT 
    'Members' as check_type,
    COUNT(*)::TEXT as detail_1,
    NULL::TEXT as detail_2,
    NULL::TEXT as detail_3
FROM group_members
WHERE group_id = 'ce951223-3540-4007-816d-829f260a5f5d';

