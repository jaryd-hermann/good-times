-- Diagnose why group ce951223-3540-4007-816d-829f260a5f5d has empty ice-breaker queue
-- The group is in ice-breaker period but has 0 queued items

-- 1. Check group's ice-breaker completion date
SELECT 
    id,
    name,
    ice_breaker_queue_completed_date,
    CURRENT_DATE as today,
    CASE 
        WHEN ice_breaker_queue_completed_date IS NULL THEN 'NULL - queue never initialized'
        WHEN ice_breaker_queue_completed_date > CURRENT_DATE THEN 'In ice-breaker period (completes ' || ice_breaker_queue_completed_date::TEXT || ')'
        ELSE 'Ice-breaker completed'
    END as status,
    -- Calculate days until completion
    CASE 
        WHEN ice_breaker_queue_completed_date > CURRENT_DATE 
        THEN (ice_breaker_queue_completed_date - CURRENT_DATE)::INTEGER
        ELSE 0
    END as days_remaining
FROM groups
WHERE id = 'ce951223-3540-4007-816d-829f260a5f5d';

-- 2. Check if queue was ever populated (check for any queue entries, even deleted ones)
-- Note: This won't show deleted entries, but we can check recent daily prompts
SELECT 
    'Queue Status' as check_type,
    COUNT(*) as current_queue_items,
    CASE 
        WHEN COUNT(*) = 0 THEN '❌ EMPTY - No items in queue'
        ELSE '✅ Has ' || COUNT(*)::TEXT || ' items'
    END as status
FROM group_prompt_queue
WHERE group_id = 'ce951223-3540-4007-816d-829f260a5f5d';

-- 3. Check recent daily prompts to see if queue items were consumed
-- Queue items are deleted after being scheduled, so if we see recent prompts, queue was consumed
SELECT 
    dp.date,
    dp.prompt_id,
    p.category,
    p.ice_breaker,
    LEFT(p.question, 60) as question_preview,
    CASE 
        WHEN p.ice_breaker = TRUE THEN '✅ Ice-breaker (from queue)'
        ELSE 'Regular prompt'
    END as prompt_type
FROM daily_prompts dp
LEFT JOIN prompts p ON dp.prompt_id = p.id
WHERE dp.group_id = 'ce951223-3540-4007-816d-829f260a5f5d'
ORDER BY dp.date DESC
LIMIT 20;

-- 4. Count how many ice-breaker prompts have been scheduled
SELECT 
    COUNT(*) as ice_breaker_prompts_scheduled,
    MIN(dp.date) as first_ice_breaker_date,
    MAX(dp.date) as last_ice_breaker_date
FROM daily_prompts dp
JOIN prompts p ON dp.prompt_id = p.id
WHERE dp.group_id = 'ce951223-3540-4007-816d-829f260a5f5d'
AND p.ice_breaker = TRUE;

-- 5. Check if there are any ice-breaker prompts available to add to queue
SELECT 
    COUNT(*) as available_ice_breaker_prompts,
    p.category,
    COUNT(*) as count_by_category
FROM prompts p
WHERE p.ice_breaker = TRUE
AND p.category IN ('Friends', 'Family') -- Adjust based on group type
GROUP BY p.category;

-- 6. Check group type to know which category of ice-breaker prompts to use
SELECT 
    g.type,
    CASE 
        WHEN g.type = 'friends' THEN 'Friends'
        WHEN g.type = 'family' THEN 'Family'
    END as expected_category
FROM groups g
WHERE g.id = 'ce951223-3540-4007-816d-829f260a5f5d';

-- 7. Check if queue was supposed to have 15 items (standard ice-breaker queue size)
-- If completion date is set, queue should have been initialized with ~15 items
-- Calculate how many days have passed since group creation
SELECT 
    g.created_at::DATE as group_created_date,
    CURRENT_DATE as today,
    (CURRENT_DATE - g.created_at::DATE)::INTEGER as days_since_creation,
    g.ice_breaker_queue_completed_date,
    CASE 
        WHEN g.ice_breaker_queue_completed_date IS NOT NULL 
        THEN (g.ice_breaker_queue_completed_date - g.created_at::DATE)::INTEGER
        ELSE NULL
    END as ice_breaker_period_days
FROM groups g
WHERE g.id = 'ce951223-3540-4007-816d-829f260a5f5d';

-- SUMMARY: The issue is that the queue is empty but ice-breaker period hasn't ended
-- This means queue items were consumed/deleted but not replenished
-- Solution: Re-initialize the queue OR manually add ice-breaker prompts to the queue

