-- Fix for group ce951223-3540-4007-816d-829f260a5f5d
-- The group is in ice-breaker period but has no queued items, so no prompts are being scheduled

-- First, check the ice-breaker completion date
SELECT 
    id,
    name,
    ice_breaker_queue_completed_date,
    CURRENT_DATE as today,
    CASE 
        WHEN ice_breaker_queue_completed_date IS NULL THEN 'NULL - needs initialization'
        WHEN ice_breaker_queue_completed_date > CURRENT_DATE THEN 'In ice-breaker period (completes ' || ice_breaker_queue_completed_date::TEXT || ')'
        ELSE 'Ice-breaker completed'
    END as status
FROM groups
WHERE id = 'ce951223-3540-4007-816d-829f260a5f5d';

-- Option 1: If ice-breaker period should be over, set completion date to today or past
-- Uncomment and run this if the ice-breaker period should have ended:
/*
UPDATE groups
SET ice_breaker_queue_completed_date = CURRENT_DATE - INTERVAL '1 day'
WHERE id = 'ce951223-3540-4007-816d-829f260a5f5d'
AND ice_breaker_queue_completed_date > CURRENT_DATE;
*/

-- Option 2: If ice-breaker period is correct but queue is empty, check if queue needs initialization
-- Check if there are any prompts in the queue at all (even if not for today):
SELECT 
    COUNT(*) as total_queue_items,
    MIN(position) as min_position,
    MAX(position) as max_position
FROM group_prompt_queue
WHERE group_id = 'ce951223-3540-4007-816d-829f260a5f5d';

-- Option 3: Check recent daily prompts to see when last prompt was scheduled
SELECT 
    date,
    prompt_id,
    p.category,
    LEFT(p.question, 60) as question_preview
FROM daily_prompts dp
LEFT JOIN prompts p ON dp.prompt_id = p.id
WHERE dp.group_id = 'ce951223-3540-4007-816d-829f260a5f5d'
ORDER BY dp.date DESC
LIMIT 10;

-- RECOMMENDED FIX: If the group should be out of ice-breaker period
-- Set the completion date to today so normal prompts can be scheduled
-- This assumes the ice-breaker period has ended or should end
UPDATE groups
SET ice_breaker_queue_completed_date = CURRENT_DATE
WHERE id = 'ce951223-3540-4007-816d-829f260a5f5d'
AND ice_breaker_queue_completed_date > CURRENT_DATE;

-- After running the fix, verify:
SELECT 
    id,
    name,
    ice_breaker_queue_completed_date,
    CASE 
        WHEN ice_breaker_queue_completed_date IS NULL THEN 'NULL'
        WHEN ice_breaker_queue_completed_date > CURRENT_DATE THEN 'Still in ice-breaker'
        ELSE 'Ice-breaker completed - normal prompts will be scheduled'
    END as status
FROM groups
WHERE id = 'ce951223-3540-4007-816d-829f260a5f5d';

