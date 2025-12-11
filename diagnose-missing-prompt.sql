-- Diagnostic query to find why group ce951223-3540-4007-816d-829f260a5f5d has no question today
-- Run this in Supabase SQL Editor

DO $$
DECLARE
    target_group_id UUID := 'ce951223-3540-4007-816d-829f260a5f5d';
    today_date DATE := CURRENT_DATE;
    today_month_day TEXT := TO_CHAR(today_date, 'MM-DD');
    result_text TEXT := '';
BEGIN
    RAISE NOTICE '=== DIAGNOSING MISSING PROMPT FOR GROUP % ===', target_group_id;
    RAISE NOTICE 'Today''s date: %', today_date;
    RAISE NOTICE '';
    
    -- 1. Check if group exists and get basic info
    RAISE NOTICE '1. GROUP INFORMATION:';
    PERFORM g.id, g.name, g.type, g.ice_breaker_queue_completed_date, g.created_at
    FROM groups g
    WHERE g.id = target_group_id;
    
    -- 2. Check if daily_prompt exists for today
    RAISE NOTICE '';
    RAISE NOTICE '2. DAILY PROMPT CHECK:';
    IF EXISTS (
        SELECT 1 FROM daily_prompts 
        WHERE group_id = target_group_id 
        AND date = today_date
    ) THEN
        RAISE NOTICE '   ✅ Daily prompt EXISTS for today';
        PERFORM dp.id, dp.prompt_id, dp.user_id, dp.date, p.question
        FROM daily_prompts dp
        LEFT JOIN prompts p ON dp.prompt_id = p.id
        WHERE dp.group_id = target_group_id 
        AND dp.date = today_date;
    ELSE
        RAISE NOTICE '   ❌ NO daily prompt for today';
    END IF;
    
    -- 3. Check ice-breaker queue completion status
    RAISE NOTICE '';
    RAISE NOTICE '3. ICE-BREAKER STATUS:';
    PERFORM 
        g.ice_breaker_queue_completed_date,
        CASE 
            WHEN g.ice_breaker_queue_completed_date IS NULL THEN 'NULL - Group may need initialization'
            WHEN g.ice_breaker_queue_completed_date > today_date THEN 'IN ICE-BREAKER PERIOD (completes ' || g.ice_breaker_queue_completed_date || ')'
            ELSE 'COMPLETED (completion date: ' || g.ice_breaker_queue_completed_date || ')'
        END as status
    FROM groups g
    WHERE g.id = target_group_id;
    
    -- 4. Check for queued items
    RAISE NOTICE '';
    RAISE NOTICE '4. QUEUED ITEMS:';
    IF EXISTS (
        SELECT 1 FROM group_prompt_queue 
        WHERE group_id = target_group_id
    ) THEN
        RAISE NOTICE '   ✅ Has queued items';
        PERFORM qp.id, qp.prompt_id, qp.position, p.category, p.question
        FROM group_prompt_queue qp
        LEFT JOIN prompts p ON qp.prompt_id = p.id
        WHERE qp.group_id = target_group_id
        ORDER BY qp.position ASC
        LIMIT 5;
    ELSE
        RAISE NOTICE '   ❌ NO queued items';
    END IF;
    
    -- 5. Check for custom questions scheduled for today
    RAISE NOTICE '';
    RAISE NOTICE '5. CUSTOM QUESTIONS FOR TODAY:';
    IF EXISTS (
        SELECT 1 FROM custom_questions 
        WHERE group_id = target_group_id 
        AND date_asked = today_date
        AND prompt_id IS NOT NULL
    ) THEN
        RAISE NOTICE '   ✅ Custom question scheduled for today';
        PERFORM cq.id, cq.prompt_id, cq.date_asked, p.question
        FROM custom_questions cq
        LEFT JOIN prompts p ON cq.prompt_id = p.id
        WHERE cq.group_id = target_group_id 
        AND cq.date_asked = today_date
        AND cq.prompt_id IS NOT NULL;
    ELSE
        RAISE NOTICE '   ❌ NO custom question for today';
    END IF;
    
    -- 6. Check for birthday prompts (user-specific)
    RAISE NOTICE '';
    RAISE NOTICE '6. BIRTHDAY PROMPTS FOR TODAY:';
    IF EXISTS (
        SELECT 1 FROM daily_prompts dp
        JOIN prompts p ON dp.prompt_id = p.id
        JOIN group_members gm ON dp.user_id = gm.user_id
        JOIN users u ON gm.user_id = u.id
        WHERE dp.group_id = target_group_id
        AND dp.date = today_date
        AND p.birthday_type IS NOT NULL
        AND SUBSTRING(u.birthday::TEXT, 6) = today_month_day
    ) THEN
        RAISE NOTICE '   ✅ Birthday prompt exists for today';
    ELSE
        RAISE NOTICE '   ❌ NO birthday prompt for today';
    END IF;
    
    -- 7. Check recent daily prompts (last 7 days)
    RAISE NOTICE '';
    RAISE NOTICE '7. RECENT DAILY PROMPTS (last 7 days):';
    PERFORM dp.date, dp.prompt_id, p.category, p.question, dp.user_id
    FROM daily_prompts dp
    LEFT JOIN prompts p ON dp.prompt_id = p.id
    WHERE dp.group_id = target_group_id
    AND dp.date >= today_date - INTERVAL '7 days'
    ORDER BY dp.date DESC;
    
    -- 8. Check if group has members
    RAISE NOTICE '';
    RAISE NOTICE '8. GROUP MEMBERS:';
    PERFORM COUNT(*) as member_count
    FROM group_members
    WHERE group_id = target_group_id;
    
    -- 9. Check for memorial prompts this week (Remembering category)
    RAISE NOTICE '';
    RAISE NOTICE '9. MEMORIAL PROMPTS THIS WEEK:';
    DECLARE
        week_start DATE := DATE_TRUNC('week', today_date)::DATE;
        -- Adjust week_start to Monday (PostgreSQL's week starts on Monday)
        week_start_monday DATE;
    BEGIN
        -- Calculate Monday of current week
        week_start_monday := week_start;
        IF EXTRACT(DOW FROM today_date) = 0 THEN
            -- If today is Sunday, go back 6 days to get Monday
            week_start_monday := today_date - INTERVAL '6 days';
        ELSIF EXTRACT(DOW FROM today_date) > 1 THEN
            -- If today is Tuesday-Saturday, go back (DOW - 1) days
            week_start_monday := today_date - (EXTRACT(DOW FROM today_date)::INTEGER - 1) || ' days'::INTERVAL;
        END IF;
        
        IF EXISTS (
            SELECT 1 FROM daily_prompts dp
            JOIN prompts p ON dp.prompt_id = p.id
            WHERE dp.group_id = target_group_id
            AND dp.date >= week_start_monday
            AND dp.date <= today_date
            AND p.category = 'Remembering'
            AND dp.user_id IS NULL
        ) THEN
            RAISE NOTICE '   ⚠️ Memorial prompt already scheduled this week (prevents another)';
            PERFORM dp.date, p.question
            FROM daily_prompts dp
            JOIN prompts p ON dp.prompt_id = p.id
            WHERE dp.group_id = target_group_id
            AND dp.date >= week_start_monday
            AND dp.date <= today_date
            AND p.category = 'Remembering'
            AND dp.user_id IS NULL;
        ELSE
            RAISE NOTICE '   ✅ NO memorial prompt this week (can schedule one)';
        END IF;
    END;
    
    -- 10. Check if schedule-daily-prompts function ran today
    RAISE NOTICE '';
    RAISE NOTICE '10. SCHEDULER FUNCTION STATUS:';
    RAISE NOTICE '   Check Supabase Edge Functions logs for "schedule-daily-prompts"';
    RAISE NOTICE '   Look for entries with group_id: %', target_group_id;
    RAISE NOTICE '   Check for status messages like:';
    RAISE NOTICE '     - skipped_ice_breaker_period';
    RAISE NOTICE '     - skipped_no_completion_date';
    RAISE NOTICE '     - skipped_remembering_already_scheduled_today';
    RAISE NOTICE '     - scheduled';
    
    RAISE NOTICE '';
    RAISE NOTICE '=== DIAGNOSIS COMPLETE ===';
    
END $$;

-- Also run these individual queries for detailed output:

-- Group info
SELECT 
    id,
    name,
    type,
    ice_breaker_queue_completed_date,
    created_at,
    CASE 
        WHEN ice_breaker_queue_completed_date IS NULL THEN 'NULL - May need initialization'
        WHEN ice_breaker_queue_completed_date > CURRENT_DATE THEN 'IN ICE-BREAKER PERIOD'
        ELSE 'COMPLETED'
    END as ice_breaker_status
FROM groups
WHERE id = 'ce951223-3540-4007-816d-829f260a5f5d';

-- Daily prompt for today
SELECT 
    dp.id,
    dp.date,
    dp.prompt_id,
    dp.user_id,
    p.category,
    p.question,
    p.birthday_type
FROM daily_prompts dp
LEFT JOIN prompts p ON dp.prompt_id = p.id
WHERE dp.group_id = 'ce951223-3540-4007-816d-829f260a5f5d'
AND dp.date = CURRENT_DATE;

-- Queued items
SELECT 
    qp.id,
    qp.position,
    qp.prompt_id,
    p.category,
    p.question
FROM group_prompt_queue qp
LEFT JOIN prompts p ON qp.prompt_id = p.id
WHERE qp.group_id = 'ce951223-3540-4007-816d-829f260a5f5d'
ORDER BY qp.position ASC;

-- Recent prompts (last 7 days)
SELECT 
    dp.date,
    dp.prompt_id,
    p.category,
    LEFT(p.question, 50) as question_preview,
    dp.user_id
FROM daily_prompts dp
LEFT JOIN prompts p ON dp.prompt_id = p.id
WHERE dp.group_id = 'ce951223-3540-4007-816d-829f260a5f5d'
AND dp.date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY dp.date DESC;

-- Group members count
SELECT COUNT(*) as member_count
FROM group_members
WHERE group_id = 'ce951223-3540-4007-816d-829f260a5f5d';

-- Custom questions for today
SELECT 
    id,
    prompt_id,
    date_asked,
    created_at
FROM custom_questions
WHERE group_id = 'ce951223-3540-4007-816d-829f260a5f5d'
AND date_asked = CURRENT_DATE;

