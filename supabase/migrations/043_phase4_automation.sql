-- Phase 4: Automation & Integration Testing
-- Creates queue population function and sets up automation
-- 
-- This enables the personalization system to:
-- 1. Automatically populate personalized questions into group queues
-- 2. Schedule automated refreshes of profiles and metrics
-- 3. Test end-to-end flow

-- ============================================================================
-- 1. CREATE QUEUE POPULATION FUNCTION
-- ============================================================================

-- Drop existing function if it exists (to allow return type change)
DROP FUNCTION IF EXISTS populate_personalized_queue();

CREATE OR REPLACE FUNCTION populate_personalized_queue()
RETURNS TABLE(result_group_id UUID, result_prompts_added INTEGER) AS $$
DECLARE
  v_group RECORD;
  v_suggestions RECORD;
  v_current_position INTEGER;
  v_prompts_added INTEGER;
  v_total_added INTEGER := 0;
  v_added_by UUID;
  v_exclude_prompt_ids UUID[];
BEGIN
  -- Loop through all active groups
  FOR v_group IN
    SELECT DISTINCT g.id, g.type
    FROM groups g
    JOIN group_members gm ON gm.group_id = g.id
    -- Only process groups that have at least 2 members (active groups)
    GROUP BY g.id, g.type
    HAVING COUNT(DISTINCT gm.user_id) >= 2
  LOOP
    v_prompts_added := 0;
    
    -- Get current max position in queue for this group
    SELECT COALESCE(MAX(gpq.position), -1) INTO v_current_position
    FROM group_prompt_queue gpq
    WHERE gpq.group_id = v_group.id;
    
    -- Get added_by user (admin first, then any member)
    SELECT gm.user_id INTO v_added_by
    FROM group_members gm
    WHERE gm.group_id = v_group.id AND gm.role = 'admin'
    LIMIT 1;
    
    IF v_added_by IS NULL THEN
      SELECT gm.user_id INTO v_added_by
      FROM group_members gm
      WHERE gm.group_id = v_group.id
      LIMIT 1;
    END IF;
    
    -- Skip if no members found (shouldn't happen due to HAVING clause, but be safe)
    IF v_added_by IS NULL THEN
      CONTINUE;
    END IF;
    
    -- Get personalized suggestions for this group
    -- Exclude prompts already in queue or already asked recently (last 30 days)
    -- NOTE: Remembering, Birthday, Featured are excluded by suggest_questions_for_group()
    -- NOTE: Custom questions are handled separately via custom_questions table, not via category filtering
    -- Build exclusion array: prompts in queue + prompts asked in last 30 days
    SELECT array_agg(DISTINCT combined.prompt_id) INTO v_exclude_prompt_ids
    FROM (
      SELECT gpq.prompt_id FROM group_prompt_queue gpq WHERE gpq.group_id = v_group.id
      UNION
      SELECT DISTINCT dp.prompt_id 
      FROM daily_prompts dp
      WHERE dp.group_id = v_group.id 
        AND dp.date >= CURRENT_DATE - INTERVAL '30 days'
    ) combined;
    
    -- If no exclusions, use empty array instead of NULL
    IF v_exclude_prompt_ids IS NULL THEN
      v_exclude_prompt_ids := ARRAY[]::UUID[];
    END IF;
    
    -- Get personalized suggestions
    -- NOTE: suggest_questions_for_group() now filters by group type (Friends/Family)
    -- and excludes Remembering, Birthday, Custom, Featured categories
    FOR v_suggestions IN
      SELECT 
        s.prompt_id,
        s.fit_score,
        s.question,
        s.category
      FROM suggest_questions_for_group(
        v_group.id,
        10,  -- Get top 10 suggestions
        v_exclude_prompt_ids
      ) s
      -- Only add if fit score is above threshold (0.4 = 40% fit)
      -- Double-check category matches group type (safety check)
      WHERE s.fit_score >= 0.4
        AND s.category = CASE WHEN v_group.type = 'family' THEN 'Family' ELSE 'Friends' END
      LIMIT 5  -- Add up to 5 questions per group per run
    LOOP
      BEGIN
        -- Check if prompt is already in queue (safety check, though exclusion array should prevent this)
        IF EXISTS (
          SELECT 1 FROM group_prompt_queue gpq
          WHERE gpq.group_id = v_group.id AND gpq.prompt_id = v_suggestions.prompt_id
        ) THEN
          CONTINUE;  -- Skip this prompt, already in queue
        END IF;
        
        -- Insert into queue at the end (after current max position)
        v_current_position := v_current_position + 1;
        
        INSERT INTO group_prompt_queue (group_id, prompt_id, added_by, position)
        VALUES (v_group.id, v_suggestions.prompt_id, v_added_by, v_current_position);
        
        v_prompts_added := v_prompts_added + 1;
      EXCEPTION WHEN OTHERS THEN
        -- Log error but continue with next suggestion
        RAISE WARNING 'Failed to add prompt % to queue for group %: %', 
          v_suggestions.prompt_id, v_group.id, SQLERRM;
      END;
    END LOOP;
    
    -- Return result for this group
    IF v_prompts_added > 0 THEN
      result_group_id := v_group.id;
      result_prompts_added := v_prompts_added;
      RETURN NEXT;
      v_total_added := v_total_added + v_prompts_added;
    END IF;
  END LOOP;
  
  -- Log summary
  RAISE NOTICE 'populate_personalized_queue: Added % total prompts across all groups', v_total_added;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. CREATE AUTOMATED REFRESH FUNCTION (COMBINES MULTIPLE TASKS)
-- ============================================================================

CREATE OR REPLACE FUNCTION run_daily_personalization_tasks()
RETURNS TABLE(task TEXT, status TEXT, details TEXT) AS $$
DECLARE
  v_start_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
  v_duration INTERVAL;
BEGIN
  v_start_time := NOW();
  
  -- Task 1: Refresh group vibe profiles
  BEGIN
    PERFORM refresh_group_vibe_profiles();
    task := 'refresh_group_vibe_profiles';
    status := 'success';
    details := 'Materialized view refreshed';
    RETURN NEXT;
  EXCEPTION WHEN OTHERS THEN
    task := 'refresh_group_vibe_profiles';
    status := 'error';
    details := SQLERRM;
    RETURN NEXT;
  END;
  
  -- Task 2: Update global question metrics
  BEGIN
    PERFORM update_question_global_metrics();
    task := 'update_question_global_metrics';
    status := 'success';
    details := 'Global metrics updated';
    RETURN NEXT;
  EXCEPTION WHEN OTHERS THEN
    task := 'update_question_global_metrics';
    status := 'error';
    details := SQLERRM;
    RETURN NEXT;
  END;
  
  v_end_time := NOW();
  v_duration := v_end_time - v_start_time;
  
  -- Log completion
  RAISE NOTICE 'run_daily_personalization_tasks completed in %', v_duration;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. CREATE WEEKLY QUEUE POPULATION FUNCTION
-- ============================================================================

-- Drop existing function if it exists (to allow return type change)
DROP FUNCTION IF EXISTS run_weekly_queue_population();

CREATE OR REPLACE FUNCTION run_weekly_queue_population()
RETURNS TABLE(result_group_id UUID, result_prompts_added INTEGER) AS $$
BEGIN
  -- Call the queue population function
  RETURN QUERY
  SELECT * FROM populate_personalized_queue();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION populate_personalized_queue IS 
  'Populates group_prompt_queue with personalized question suggestions for all active groups. Should be called weekly.';

COMMENT ON FUNCTION run_daily_personalization_tasks IS 
  'Runs daily personalization tasks: refreshes profiles and updates global metrics. Should be called daily after schedule-daily-prompts.';

COMMENT ON FUNCTION run_weekly_queue_population IS 
  'Wrapper for populate_personalized_queue. Should be called weekly to add personalized questions to group queues.';

