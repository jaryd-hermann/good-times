-- Fix for group ce951223-3540-4007-816d-829f260a5f5d
-- The group is in ice-breaker period but queue is empty
-- This will repopulate the queue with ice-breaker prompts

DO $$
DECLARE
    target_group_id UUID := 'ce951223-3540-4007-816d-829f260a5f5d';
    group_type TEXT;
    group_category TEXT;
    ice_breaker_prompts UUID[];
    current_position INTEGER;
    days_remaining INTEGER;
    completion_date DATE;
    prompt_id UUID;
    admin_user_id UUID;
BEGIN
    -- Get group info
    SELECT g.type, g.ice_breaker_queue_completed_date, g.created_by
    INTO group_type, completion_date, admin_user_id
    FROM groups g
    WHERE g.id = target_group_id;
    
    IF group_type IS NULL THEN
        RAISE EXCEPTION 'Group not found';
    END IF;
    
    -- Determine category based on group type
    group_category := CASE 
        WHEN group_type = 'friends' THEN 'Friends'
        WHEN group_type = 'family' THEN 'Family'
        ELSE 'Friends' -- Default
    END;
    
    -- Calculate days remaining in ice-breaker period
    IF completion_date IS NOT NULL AND completion_date > CURRENT_DATE THEN
        days_remaining := (completion_date - CURRENT_DATE)::INTEGER;
        RAISE NOTICE 'Ice-breaker period ends on %, % days remaining', completion_date, days_remaining;
    ELSE
        RAISE EXCEPTION 'Group is not in ice-breaker period (completion_date: %)', completion_date;
    END IF;
    
    -- Ensure we have at least 1 day remaining
    IF days_remaining < 1 THEN
        RAISE EXCEPTION 'Ice-breaker period has ended or ends today';
    END IF;
    
    RAISE NOTICE 'Group type: %, Category: %, Days remaining: %, Completion date: %', 
        group_type, group_category, days_remaining, completion_date;
    
    -- Get ice-breaker prompts for this group's category
    SELECT ARRAY_AGG(id ORDER BY RANDOM())
    INTO ice_breaker_prompts
    FROM prompts
    WHERE ice_breaker = TRUE
    AND category = group_category;
    
    IF ice_breaker_prompts IS NULL OR array_length(ice_breaker_prompts, 1) = 0 THEN
        RAISE EXCEPTION 'No ice-breaker prompts found for category: %', group_category;
    END IF;
    
    RAISE NOTICE 'Found % ice-breaker prompts', array_length(ice_breaker_prompts, 1);
    
    -- Get current max position in queue (or start at 0)
    SELECT COALESCE(MAX(position), -1) + 1
    INTO current_position
    FROM group_prompt_queue
    WHERE group_id = target_group_id;
    
    RAISE NOTICE 'Starting queue position: %', current_position;
    
    -- Add prompts to queue for remaining days
    -- We'll add enough prompts to fill the remaining ice-breaker period
    -- If we need more prompts than available, we'll cycle through them
    FOR i IN 1..days_remaining LOOP
        -- Cycle through prompts if needed
        prompt_id := ice_breaker_prompts[((i - 1) % array_length(ice_breaker_prompts, 1)) + 1];
        
        -- Insert into queue
        INSERT INTO group_prompt_queue (group_id, prompt_id, added_by, position)
        VALUES (target_group_id, prompt_id, admin_user_id, current_position + i - 1)
        ON CONFLICT DO NOTHING; -- Skip if already exists
        
        RAISE NOTICE 'Added prompt % at position %', prompt_id, current_position + i - 1;
    END LOOP;
    
    RAISE NOTICE 'Successfully added % prompts to queue', days_remaining;
    
    -- Verify queue now has items
    SELECT COUNT(*) INTO current_position
    FROM group_prompt_queue
    WHERE group_id = target_group_id;
    
    RAISE NOTICE 'Queue now has % items', current_position;
    
END $$;

-- Verify the fix worked
SELECT 
    COUNT(*) as queue_items_count,
    MIN(position) as min_position,
    MAX(position) as max_position,
    '✅ Queue repopulated' as status
FROM group_prompt_queue
WHERE group_id = 'ce951223-3540-4007-816d-829f260a5f5d';

-- Show the queue items
SELECT 
    qp.position,
    qp.prompt_id,
    p.category,
    p.ice_breaker,
    LEFT(p.question, 60) as question_preview
FROM group_prompt_queue qp
LEFT JOIN prompts p ON qp.prompt_id = p.id
WHERE qp.group_id = 'ce951223-3540-4007-816d-829f260a5f5d'
ORDER BY qp.position ASC;

