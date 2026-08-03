-- =============================================================================
-- BASELINE 02 — Functions
-- =============================================================================
-- Generated from the live catalog of project ytnnsykbgohiscfgomfe on 2026-08-01.
-- Migrations 001-059 were never committed; this reconstructs what they built.
-- 45 functions. All use CREATE OR REPLACE, so this file is idempotent.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.analyze_discovery_engagement()
 RETURNS TABLE(group_id uuid, interest_name text, status text, avg_engagement numeric)
 LANGUAGE plpgsql
AS $function$
DECLARE
  attempt_record RECORD;
  total_score DECIMAL;
  question_count INTEGER;
  avg_score DECIMAL;
BEGIN
  -- Process all discovery attempts that are in 'testing' status
  FOR attempt_record IN
    SELECT 
      da.id,
      da.group_id,
      da.interest_name,
      da.question_count,
      da.total_engagement_score
    FROM discovery_attempts da
    WHERE da.status = 'testing'
      AND da.question_count >= 2 -- Need at least 2 questions to make inference
  LOOP
    -- Calculate average engagement (only if we have questions)
    IF attempt_record.question_count > 0 THEN
      avg_score := attempt_record.total_engagement_score / attempt_record.question_count;
    ELSE
      avg_score := 0.0;
    END IF;
    
    -- If average engagement >= 0.6 (60%), promote to inferred
    IF avg_score >= 0.6 THEN
      -- Add to group's inferred_interests
      UPDATE groups
      SET inferred_interests = COALESCE(inferred_interests, ARRAY[]::TEXT[]) || ARRAY[attempt_record.interest_name]
      WHERE id = attempt_record.group_id
        AND NOT (attempt_record.interest_name = ANY(COALESCE(inferred_interests, ARRAY[]::TEXT[])));
      
      -- Update discovery attempt status
      UPDATE discovery_attempts
      SET status = 'inferred'
      WHERE id = attempt_record.id;
      
      -- Return result
      group_id := attempt_record.group_id;
      interest_name := attempt_record.interest_name;
      status := 'inferred';
      avg_engagement := avg_score;
      RETURN NEXT;
    ELSIF avg_score < 0.6 AND attempt_record.question_count >= 3 THEN
      -- If we've tested 3+ questions and still below threshold, reject
      UPDATE discovery_attempts
      SET status = 'rejected'
      WHERE id = attempt_record.id;
      
      -- Return result
      group_id := attempt_record.group_id;
      interest_name := attempt_record.interest_name;
      status := 'rejected';
      avg_engagement := avg_score;
      RETURN NEXT;
    END IF;
  END LOOP;
  
  RETURN;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.batch_update_prompt_answer_counts()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE prompt_usage_stats pus
  SET answers_count = (
    SELECT COUNT(*)
    FROM entries e
    WHERE e.group_id = pus.group_id
    AND e.date = pus.date
    AND e.prompt_id = pus.prompt_id
  ),
  updated_at = NOW()
  WHERE pus.daily_prompt_id IS NOT NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_engagement_score(p_daily_prompt_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_group_id UUID;
  v_prompt_id UUID;
  v_date DATE;
  v_answered BOOLEAN;
  v_response_length INTEGER;
  v_reactions_count INTEGER;
  v_answered_score DECIMAL;
  v_length_score DECIMAL;
  v_reactions_score DECIMAL;
  v_total_score DECIMAL;
BEGIN
  -- Get daily_prompt details
  SELECT group_id, prompt_id, date INTO v_group_id, v_prompt_id, v_date
  FROM daily_prompts
  WHERE id = p_daily_prompt_id;
  
  IF v_group_id IS NULL THEN
    RETURN 0.0;
  END IF;
  
  -- Check if prompt was answered (entries exist for this prompt/group/date)
  SELECT EXISTS(
    SELECT 1 FROM entries 
    WHERE group_id = v_group_id
      AND prompt_id = v_prompt_id
      AND date = v_date
  ) INTO v_answered;
  
  -- Get response length (sum of all entry text lengths for this prompt)
  SELECT COALESCE(SUM(LENGTH(COALESCE(text_content, ''))), 0) INTO v_response_length
  FROM entries
  WHERE group_id = v_group_id
    AND prompt_id = v_prompt_id
    AND date = v_date;
  
  -- Get reactions count (sum of all reactions on entries for this prompt)
  SELECT COALESCE(COUNT(*), 0) INTO v_reactions_count
  FROM reactions r
  INNER JOIN entries e ON e.id = r.entry_id
  WHERE e.group_id = v_group_id
    AND e.prompt_id = v_prompt_id
    AND e.date = v_date;
  
  -- Calculate component scores
  v_answered_score := CASE WHEN v_answered THEN 1.0 ELSE 0.0 END * 0.5;
  v_length_score := LEAST(v_response_length::DECIMAL / 500.0, 1.0) * 0.3;
  v_reactions_score := LEAST(v_reactions_count::DECIMAL / 5.0, 1.0) * 0.2;
  
  -- Total score (0.0 to 1.0)
  v_total_score := v_answered_score + v_length_score + v_reactions_score;
  
  RETURN v_total_score;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_interest_similarities()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  interest_record RECORD;
  similar_record RECORD;
  total_groups_with_interest INTEGER;
  groups_with_both INTEGER;
  co_occurrence_percentage DECIMAL;
BEGIN
  -- Clear existing similarities
  DELETE FROM interest_similarities;
  
  -- For each interest, find other interests that co-occur
  FOR interest_record IN 
    SELECT DISTINCT i.name as interest_name
    FROM interests i
    INNER JOIN group_interests gi ON gi.interest_id = i.id
  LOOP
    -- Count total groups that have this interest
    SELECT COUNT(DISTINCT gi.group_id) INTO total_groups_with_interest
    FROM group_interests gi
    INNER JOIN interests i ON i.id = gi.interest_id
    WHERE i.name = interest_record.interest_name;
    
    -- Only process if at least 2 groups have this interest (need co-occurrence)
    IF total_groups_with_interest >= 2 THEN
      -- Find other interests that appear in groups with this interest
      FOR similar_record IN
        SELECT DISTINCT i2.name as similar_interest_name
        FROM group_interests gi1
        INNER JOIN interests i1 ON i1.id = gi1.interest_id
        INNER JOIN group_interests gi2 ON gi2.group_id = gi1.group_id AND gi2.interest_id != gi1.interest_id
        INNER JOIN interests i2 ON i2.id = gi2.interest_id
        WHERE i1.name = interest_record.interest_name
          AND i2.name != interest_record.interest_name
      LOOP
        -- Count groups that have BOTH interests
        SELECT COUNT(DISTINCT gi1.group_id) INTO groups_with_both
        FROM group_interests gi1
        INNER JOIN interests i1 ON i1.id = gi1.interest_id
        INNER JOIN group_interests gi2 ON gi2.group_id = gi1.group_id
        INNER JOIN interests i2 ON i2.id = gi2.interest_id
        WHERE i1.name = interest_record.interest_name
          AND i2.name = similar_record.similar_interest_name;
        
        -- Calculate co-occurrence percentage
        co_occurrence_percentage := (groups_with_both::DECIMAL / total_groups_with_interest::DECIMAL) * 100;
        
        -- Only store if co-occurrence is at least 10% (threshold to avoid noise)
        IF co_occurrence_percentage >= 10 THEN
          INSERT INTO interest_similarities (interest_name, similar_interest, co_occurrence_score, calculated_at)
          VALUES (interest_record.interest_name, similar_record.similar_interest_name, co_occurrence_percentage, NOW())
          ON CONFLICT (interest_name, similar_interest) 
          DO UPDATE SET 
            co_occurrence_score = EXCLUDED.co_occurrence_score,
            calculated_at = NOW();
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_and_create_match(p_group_id uuid, p_prompt_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  yes_count INTEGER;
  match_exists BOOLEAN;
BEGIN
  -- Count yes swipes for this group and prompt
  SELECT COUNT(*) INTO yes_count
  FROM group_question_swipes
  WHERE group_id = p_group_id
    AND prompt_id = p_prompt_id
    AND response = 'yes';

  -- Check if match already exists
  SELECT EXISTS(
    SELECT 1 FROM group_question_matches
    WHERE group_id = p_group_id AND prompt_id = p_prompt_id
  ) INTO match_exists;

  -- If 2+ yes swipes and no match exists, create match
  IF yes_count >= 2 AND NOT match_exists THEN
    INSERT INTO group_question_matches (group_id, prompt_id, matched_at)
    VALUES (p_group_id, p_prompt_id, NOW())
    ON CONFLICT (group_id, prompt_id) DO NOTHING;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_prompt_usage_stat()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  member_count INTEGER;
BEGIN
  -- Get group size at the time of prompt scheduling
  SELECT COUNT(*) INTO member_count
  FROM group_members
  WHERE group_id = NEW.group_id;
  
  -- Create prompt usage stat record
  INSERT INTO prompt_usage_stats (
    prompt_id,
    group_id,
    date,
    group_size_at_time,
    daily_prompt_id,
    answers_count
  ) VALUES (
    NEW.prompt_id,
    NEW.group_id,
    NEW.date,
    member_count,
    NEW.id,
    0 -- Will be updated by batch_update_prompt_answer_counts() function
  )
  ON CONFLICT (daily_prompt_id) DO NOTHING; -- Prevent duplicates
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_app_setting(setting_key text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  setting_value TEXT;
BEGIN
  SELECT value INTO setting_value
  FROM app_settings
  WHERE key = setting_key;
  
  IF setting_value IS NULL THEN
    RAISE EXCEPTION 'Setting % not found. Please update app_settings table.', setting_key;
  END IF;
  
  RETURN setting_value;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_current_week_monday()
 RETURNS date
 LANGUAGE plpgsql
AS $function$
DECLARE
  today DATE := CURRENT_DATE;
  day_of_week INTEGER;
BEGIN
  -- Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  day_of_week := EXTRACT(DOW FROM today);
  
  -- Calculate days to subtract to get to Monday
  -- If today is Sunday (0), subtract 6 days to get to previous Monday
  -- Otherwise subtract (day_of_week - 1) days
  IF day_of_week = 0 THEN
    RETURN today - INTERVAL '6 days';
  ELSE
    RETURN today - INTERVAL '1 day' * (day_of_week - 1);
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_deck_activation_count(deck_uuid uuid)
 RETURNS bigint
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN (
    SELECT COUNT(DISTINCT group_id)
    FROM deck_activations
    WHERE deck_id = deck_uuid
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_inactive_users(check_date_start date, check_date_end date)
 RETURNS TABLE(user_id uuid, group_id uuid, joined_at timestamp with time zone, group_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    gm.user_id,
    gm.group_id,
    gm.joined_at,
    g.name as group_name
  FROM group_members gm
  INNER JOIN groups g ON g.id = gm.group_id
  WHERE gm.joined_at <= check_date_start::TIMESTAMPTZ  -- Joined at least 3 days ago
    AND NOT EXISTS (
      -- User has no entries in the last 3 days for this group
      SELECT 1 FROM entries e
      WHERE e.user_id = gm.user_id
        AND e.group_id = gm.group_id
        AND e.date >= check_date_start
        AND e.date <= check_date_end
    )
    AND EXISTS (
      -- Group has prompts in the last 3 days
      SELECT 1 FROM daily_prompts dp
      WHERE dp.group_id = gm.group_id
        AND dp.date >= check_date_start
        AND dp.date <= check_date_end
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_interest_stats(interest_id_param uuid)
 RETURNS TABLE(total_active_groups bigint, total_members bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT gi.group_id)::BIGINT as total_active_groups,
    COUNT(DISTINCT ui.user_id)::BIGINT as total_members
  FROM interests i
  LEFT JOIN group_interests gi ON i.id = gi.interest_id
  LEFT JOIN user_interests ui ON i.id = ui.interest_id
  WHERE i.id = interest_id_param
  GROUP BY i.id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_prompt_answer_rate(prompt_uuid uuid)
 RETURNS TABLE(total_asks bigint, total_answers bigint, answer_rate numeric)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    SUM(pus.group_size_at_time)::BIGINT as total_asks,
    SUM(pus.answers_count)::BIGINT as total_answers,
    CASE 
      WHEN SUM(pus.group_size_at_time) > 0 THEN
        ROUND((SUM(pus.answers_count)::NUMERIC / SUM(pus.group_size_at_time)::NUMERIC) * 100, 2)
      ELSE 0
    END as answer_rate
  FROM prompt_usage_stats pus
  WHERE pus.prompt_id = prompt_uuid;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_related_interests(p_group_id uuid, p_limit integer DEFAULT 5)
 RETURNS TABLE(interest_name text, co_occurrence_score numeric)
 LANGUAGE plpgsql
AS $function$
DECLARE
  group_explicit_interests TEXT[];
  group_inferred_interests TEXT[];
  group_all_interests TEXT[];
BEGIN
  -- Get group's explicit interests
  SELECT ARRAY_AGG(i.name) INTO group_explicit_interests
  FROM group_interests gi
  INNER JOIN interests i ON i.id = gi.interest_id
  WHERE gi.group_id = p_group_id;
  
  -- Get group's inferred interests
  SELECT inferred_interests INTO group_inferred_interests
  FROM groups
  WHERE id = p_group_id;
  
  -- Combine explicit and inferred (handle nulls)
  group_all_interests := COALESCE(group_explicit_interests, ARRAY[]::TEXT[]) || 
                         COALESCE(group_inferred_interests, ARRAY[]::TEXT[]);
  
  -- Return top similar interests that are NOT already in the group's interests
  RETURN QUERY
  SELECT DISTINCT isim.similar_interest as interest_name, isim.co_occurrence_score
  FROM interest_similarities isim
  WHERE isim.interest_name = ANY(group_all_interests)
    AND isim.similar_interest != ALL(group_all_interests)
  ORDER BY isim.co_occurrence_score DESC
  LIMIT p_limit;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_prompt_swipe_count(p_prompt_id uuid, p_response text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  count_column TEXT;
BEGIN
  -- Determine which column to update
  IF p_response = 'yes' THEN
    count_column := 'yes_swipes_count';
  ELSIF p_response = 'no' THEN
    count_column := 'no_swipes_count';
  ELSE
    RAISE EXCEPTION 'Invalid response: %', p_response;
  END IF;

  -- Update the count using dynamic SQL
  EXECUTE format(
    'UPDATE prompts SET %I = COALESCE(%I, 0) + 1 WHERE id = $1',
    count_column,
    count_column
  ) USING p_prompt_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_question_asked(p_prompt_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE prompts 
  SET 
    total_asked_count = total_asked_count + 1,
    last_asked_date = CURRENT_DATE
  WHERE id = p_prompt_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_group_member(p_user uuid, p_group uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group
      and gm.user_id  = p_user
  );
$function$
;

CREATE OR REPLACE FUNCTION public.needs_queue_initialization(group_uuid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
  prompt_count INTEGER;
BEGIN
  -- Check if group has any prompts in the last 7 days
  SELECT COUNT(*) INTO prompt_count
  FROM daily_prompts
  WHERE group_id = group_uuid
    AND date >= CURRENT_DATE - INTERVAL '7 days'
    AND user_id IS NULL; -- Only count general prompts, not birthday-specific
  
  -- Return true if no prompts found (needs initialization)
  RETURN prompt_count = 0;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.populate_personalized_queue()
 RETURNS TABLE(result_group_id uuid, result_prompts_added integer)
 LANGUAGE plpgsql
AS $function$
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
    FOR v_suggestions IN
      SELECT 
        s.prompt_id,
        s.fit_score,
        s.question
      FROM suggest_questions_for_group(
        v_group.id,
        10,  -- Get top 10 suggestions
        v_exclude_prompt_ids
      ) s
      -- Only add if fit score is above threshold (0.4 = 40% fit)
      WHERE s.fit_score >= 0.4
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
$function$
;

CREATE OR REPLACE FUNCTION public.queue_member_joined_notification()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  new_member_name TEXT;
  group_name TEXT;
  group_members RECORD;
BEGIN
  BEGIN
    -- Get new member's name with fallback (never NULL)
    SELECT COALESCE(name, 'Someone') INTO new_member_name 
    FROM users WHERE id = NEW.user_id;
    
    -- Get group name with fallback (should never be NULL, but be safe)
    SELECT COALESCE(name, 'the group') INTO group_name 
    FROM groups WHERE id = NEW.group_id;
    
    -- Only proceed if we have valid data (defensive check)
    IF new_member_name IS NOT NULL AND group_name IS NOT NULL THEN
      -- Queue notifications for all existing members (except the new member)
      FOR group_members IN
        SELECT user_id FROM group_members 
        WHERE group_id = NEW.group_id AND user_id != NEW.user_id
      LOOP
        BEGIN
          INSERT INTO notification_queue (user_id, type, title, body, data)
          VALUES (
            group_members.user_id,
            'member_joined',
            new_member_name || ' joined ' || group_name,
            new_member_name || ' joined your group',
            jsonb_build_object(
              'type', 'member_joined',
              'group_id', NEW.group_id,
              'member_id', NEW.user_id
            )
          );
        EXCEPTION WHEN OTHERS THEN
          -- Log error but don't fail the join
          RAISE WARNING 'Failed to queue member_joined notification for user %: %', 
            group_members.user_id, SQLERRM;
        END;
      END LOOP;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If anything fails, log but don't prevent the join
    RAISE WARNING 'Failed to queue member_joined notifications for group %: %', 
      NEW.group_id, SQLERRM;
  END;
  
  -- Always return NEW so the join succeeds regardless of notification status
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.queue_new_comment_notification()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  commenter_name TEXT;
  entry_author_id UUID;
  entry_author_name TEXT;
  entry_group_id UUID;
  previous_commenter RECORD;
BEGIN
  BEGIN
    -- Get commenter's name with fallback (never NULL)
    SELECT COALESCE(name, 'Someone') INTO commenter_name 
    FROM users WHERE id = NEW.user_id;
    
    -- Get entry details
    SELECT user_id, group_id INTO entry_author_id, entry_group_id
    FROM entries WHERE id = NEW.entry_id;
    
    -- Get entry author's name with fallback
    SELECT COALESCE(name, 'Someone') INTO entry_author_name 
    FROM users WHERE id = entry_author_id;
    
    -- Validate we have required data
    IF entry_author_id IS NOT NULL 
       AND entry_group_id IS NOT NULL
       AND entry_author_name IS NOT NULL
       AND commenter_name IS NOT NULL 
       AND NEW.text IS NOT NULL THEN
      
      -- 1. Notify the entry author (if they didn't write the comment)
      IF entry_author_id != NEW.user_id THEN
        BEGIN
          INSERT INTO notification_queue (user_id, type, title, body, data)
          VALUES (
            entry_author_id,
            'new_comment',
            commenter_name || ' commented on your post',
            'See what they said',
            jsonb_build_object(
              'type', 'new_comment',
              'entry_id', NEW.entry_id,
              'group_id', entry_group_id,
              'commenter_id', NEW.user_id
            )
          );
        EXCEPTION WHEN OTHERS THEN
          -- Log error but don't fail the comment creation
          RAISE WARNING 'Failed to queue new_comment notification for entry author %: %', 
            entry_author_id, SQLERRM;
        END;
      END IF;
      
      -- 2. Notify all previous commenters on this entry (if they didn't write the comment)
      -- This includes users who have commented before, keeping them engaged in the thread
      -- Note: We exclude entry_author_id since they're already notified above with a different message
      FOR previous_commenter IN
        SELECT DISTINCT user_id 
        FROM comments 
        WHERE entry_id = NEW.entry_id 
          AND user_id != NEW.user_id  -- Don't notify the current commenter
          AND user_id != entry_author_id  -- Don't notify entry author again (already notified above)
      LOOP
        BEGIN
          INSERT INTO notification_queue (user_id, type, title, body, data)
          VALUES (
            previous_commenter.user_id,
            'comment_reply',
            commenter_name || ' replied to ' || entry_author_name || '''s answer',
            'See what they said',
            jsonb_build_object(
              'type', 'comment_reply',
              'entry_id', NEW.entry_id,
              'group_id', entry_group_id,
              'commenter_id', NEW.user_id
            )
          );
        EXCEPTION WHEN OTHERS THEN
          -- Log error but don't fail the comment creation
          RAISE WARNING 'Failed to queue comment_reply notification for user %: %', 
            previous_commenter.user_id, SQLERRM;
        END;
      END LOOP;
      
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If anything fails, log but don't prevent the comment creation
    RAISE WARNING 'Failed to queue comment thread notifications for comment %: %', 
      NEW.id, SQLERRM;
  END;
  
  -- Always return NEW so the comment creation succeeds regardless of notification status
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.queue_new_entry_notification()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  author_name TEXT;
  group_name TEXT;
  group_members RECORD;
BEGIN
  BEGIN
    -- Get author's name with fallback (never NULL)
    SELECT COALESCE(name, 'Someone') INTO author_name 
    FROM users WHERE id = NEW.user_id;
    
    -- Get group name with fallback
    SELECT COALESCE(name, 'your group') INTO group_name 
    FROM groups WHERE id = NEW.group_id;
    
    -- Only proceed if we have valid data
    IF author_name IS NOT NULL AND group_name IS NOT NULL THEN
      -- Queue notifications for all group members (except the author)
      FOR group_members IN
        SELECT user_id FROM group_members 
        WHERE group_id = NEW.group_id AND user_id != NEW.user_id
      LOOP
        BEGIN
          INSERT INTO notification_queue (user_id, type, title, body, data)
          VALUES (
            group_members.user_id,
            'new_entry',
            author_name || ' shared in ' || group_name,
            'See their answer to today''s question',
            jsonb_build_object(
              'type', 'new_entry',
              'group_id', NEW.group_id,
              'entry_id', NEW.id
            )
          );
        EXCEPTION WHEN OTHERS THEN
          -- Log error but don't fail the entry creation
          RAISE WARNING 'Failed to queue new_entry notification for user %: %', 
            group_members.user_id, SQLERRM;
        END;
      END LOOP;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If anything fails, log but don't prevent the entry creation
    RAISE WARNING 'Failed to queue new_entry notifications for entry %: %', 
      NEW.id, SQLERRM;
  END;
  
  -- Always return NEW so the entry creation succeeds regardless of notification status
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.run_daily_personalization_tasks()
 RETURNS TABLE(task text, status text, details text)
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.run_weekly_queue_population()
 RETURNS TABLE(result_group_id uuid, result_prompts_added integer)
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Call the queue population function
  RETURN QUERY
  SELECT * FROM populate_personalized_queue();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.schedule_onboarding_emails(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  user_created_at TIMESTAMPTZ;
  welcome_time TIMESTAMPTZ;
  day2_time TIMESTAMPTZ;
  day3_time TIMESTAMPTZ;
  day4_time TIMESTAMPTZ;
  day5_time TIMESTAMPTZ;
  day6_time TIMESTAMPTZ;
  day7_time TIMESTAMPTZ;
BEGIN
  -- Get user creation time
  SELECT created_at INTO user_created_at
  FROM auth.users
  WHERE id = p_user_id;
  
  IF user_created_at IS NULL THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;
  
  -- Schedule welcome email immediately (or very soon)
  welcome_time := user_created_at + INTERVAL '5 minutes';
  
  -- Schedule follow-up emails: day 2-7 after user creation
  day2_time := user_created_at + INTERVAL '1 day';
  day3_time := user_created_at + INTERVAL '2 days';
  day4_time := user_created_at + INTERVAL '3 days';
  day5_time := user_created_at + INTERVAL '4 days';
  day6_time := user_created_at + INTERVAL '5 days';
  day7_time := user_created_at + INTERVAL '6 days';
  
  -- Insert email schedule entries (using ON CONFLICT to prevent duplicates)
  INSERT INTO onboarding_email_schedule (user_id, email_type, scheduled_for)
  VALUES
    (p_user_id, 'welcome', welcome_time),
    (p_user_id, 'onboarding_day_2', day2_time),
    (p_user_id, 'onboarding_day_3', day3_time),
    (p_user_id, 'onboarding_day_4', day4_time),
    (p_user_id, 'onboarding_day_5', day5_time),
    (p_user_id, 'onboarding_day_6', day6_time),
    (p_user_id, 'onboarding_day_7', day7_time)
  ON CONFLICT (user_id, email_type) DO NOTHING;
END;
$function$
;

-- !! REDACTED: this function hardcodes the Supabase anon key in its body.
-- The literal was replaced with <REDACTED_ANON_KEY> so it is not committed.
-- Before running this baseline elsewhere, substitute the key OR (preferred)
-- rewrite it to read get_app_setting('supabase_anon_key') at runtime, matching
-- the pattern used by the process-onboarding-emails cron job.
CREATE OR REPLACE FUNCTION public.send_welcome_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  project_url TEXT;
  anon_key TEXT;
  edge_function_url TEXT;
  existing_memberships INTEGER;
BEGIN
  -- Check if this is the user's first group membership
  SELECT COUNT(*) INTO existing_memberships
  FROM group_members
  WHERE user_id = NEW.user_id
    AND id != NEW.id;
  
  -- Only send email if this is their first group membership
  IF existing_memberships = 0 THEN
    -- Get Supabase project URL and anon key from environment
    project_url := current_setting('app.settings.supabase_url', true);
    anon_key := current_setting('app.settings.supabase_anon_key', true);
    
    IF project_url IS NULL OR project_url = '' THEN
      project_url := 'https://ytnnsykbgohiscfgomfe.supabase.co';
    END IF;
    
    IF anon_key IS NULL OR anon_key = '' THEN
      anon_key := '<REDACTED_ANON_KEY>';
    END IF;
    
    edge_function_url := project_url || '/functions/v1/send-email';
    
    -- Call the Edge Function asynchronously (fire and forget)
    PERFORM
      net.http_post(
        url := edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || anon_key
        ),
        body := jsonb_build_object(
          'email_type', 'welcome',
          'user_id', NEW.user_id,
          'group_id', NEW.group_id
        )
      );
    
    -- Schedule follow-up onboarding emails
    PERFORM schedule_onboarding_emails(NEW.user_id);
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.track_birthday_card_view(card_uuid uuid, user_uuid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO birthday_card_views (card_id, user_id, viewed_at)
  VALUES (card_uuid, user_uuid, NOW())
  ON CONFLICT (card_id, user_id) DO UPDATE
  SET viewed_at = NOW(); -- Update timestamp if already viewed
END;
$function$
;

CREATE OR REPLACE FUNCTION public.track_deck_activation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- When a deck status changes to 'active', create an activation record
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    INSERT INTO deck_activations (
      deck_id,
      group_id,
      activated_at,
      group_active_deck_id
    ) VALUES (
      NEW.deck_id,
      NEW.group_id,
      COALESCE(NEW.activated_at, NOW()),
      NEW.id
    )
    ON CONFLICT (deck_id, group_id) DO NOTHING; -- Prevent duplicates
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_update_discovery_engagement_on_entry()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_daily_prompt_id UUID;
BEGIN
  -- Find the daily_prompt_id for this entry
  SELECT id INTO v_daily_prompt_id
  FROM daily_prompts
  WHERE group_id = NEW.group_id
    AND prompt_id = NEW.prompt_id
    AND date = NEW.date
    AND is_discovery = TRUE
  LIMIT 1;
  
  -- Update engagement if this is a discovery question
  IF v_daily_prompt_id IS NOT NULL THEN
    PERFORM update_discovery_engagement(v_daily_prompt_id);
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_update_discovery_engagement_on_reaction()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_daily_prompt_id UUID;
BEGIN
  -- Find the daily_prompt_id for this reaction's entry
  SELECT dp.id INTO v_daily_prompt_id
  FROM daily_prompts dp
  INNER JOIN entries e ON e.group_id = dp.group_id 
    AND e.prompt_id = dp.prompt_id 
    AND e.date = dp.date
  WHERE e.id = COALESCE(NEW.entry_id, OLD.entry_id)
    AND dp.is_discovery = TRUE
  LIMIT 1;
  
  -- Update engagement if this is a discovery question
  IF v_daily_prompt_id IS NOT NULL THEN
    PERFORM update_discovery_engagement(v_daily_prompt_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_welcome_email_on_registration()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Only schedule emails for new group members (not updates)
  IF TG_OP = 'INSERT' THEN
    -- Schedule onboarding emails for the new user
    -- Only schedule if this is their first group (to avoid duplicate schedules)
    IF NOT EXISTS (
      SELECT 1 FROM group_members 
      WHERE user_id = NEW.user_id 
      AND id != NEW.id
    ) THEN
      PERFORM schedule_onboarding_emails(NEW.user_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_birthday_card_entries_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_discovery_attempts_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_discovery_engagement(p_daily_prompt_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_group_id UUID;
  v_discovery_interest TEXT;
  v_engagement_score DECIMAL;
BEGIN
  -- Get group_id and discovery_interest from daily_prompt
  SELECT group_id, discovery_interest INTO v_group_id, v_discovery_interest
  FROM daily_prompts
  WHERE id = p_daily_prompt_id
    AND is_discovery = TRUE;
  
  -- Only process if this is a discovery question
  IF v_discovery_interest IS NOT NULL THEN
    -- Calculate engagement score
    v_engagement_score := calculate_engagement_score(p_daily_prompt_id);
    
    -- Update daily_prompt engagement_score
    UPDATE daily_prompts
    SET engagement_score = v_engagement_score
    WHERE id = p_daily_prompt_id;
    
    -- Update discovery_attempts total_engagement_score and increment question_count
    UPDATE discovery_attempts
    SET 
      total_engagement_score = total_engagement_score + v_engagement_score,
      question_count = question_count + 1,
      last_tested_date = (SELECT date FROM daily_prompts WHERE id = p_daily_prompt_id)
    WHERE group_id = v_group_id
      AND interest_name = v_discovery_interest
      AND status = 'testing';
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_featured_count_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_group_active_decks_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_group_active_interests()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE groups
  SET active_interests = (
    SELECT ARRAY_AGG(i.name ORDER BY i.name)
    FROM group_interests gi
    JOIN interests i ON gi.interest_id = i.id
    WHERE gi.group_id = COALESCE(NEW.group_id, OLD.group_id)
  )
  WHERE id = COALESCE(NEW.group_id, OLD.group_id);
  RETURN COALESCE(NEW, OLD);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_group_activity_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_group_deck_votes_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_group_engagement_data_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_group_swipes_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_question_answered()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE prompts 
  SET total_answered_count = total_answered_count + 1
  WHERE id = NEW.prompt_id;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_question_global_metrics()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Update asked count
  UPDATE prompts p
  SET total_asked_count = (
    SELECT COUNT(*) 
    FROM daily_prompts dp 
    WHERE dp.prompt_id = p.id
  );
  
  -- Update answered count
  UPDATE prompts p
  SET total_answered_count = (
    SELECT COUNT(*) 
    FROM entries e 
    WHERE e.prompt_id = p.id
  );
  
  -- Update completion rate
  UPDATE prompts p
  SET global_completion_rate = 
    CASE 
      WHEN total_asked_count > 0 THEN 
        total_answered_count::FLOAT / total_asked_count::FLOAT
      ELSE 0
    END;
  
  -- Update last asked date
  UPDATE prompts p
  SET last_asked_date = (
    SELECT MAX(date) 
    FROM daily_prompts dp 
    WHERE dp.prompt_id = p.id
  );
  
  -- Calculate popularity score (weighted combination)
  UPDATE prompts p
  SET popularity_score = (
    -- Weight: 40% completion rate, 30% total answered, 30% recency
    (COALESCE(global_completion_rate, 0) * 0.4) +
    (LEAST(total_answered_count::FLOAT / 100.0, 1.0) * 0.3) + -- Normalize to 0-1
    (CASE 
      WHEN last_asked_date IS NULL THEN 0
      WHEN last_asked_date > CURRENT_DATE - INTERVAL '7 days' THEN 1.0
      WHEN last_asked_date > CURRENT_DATE - INTERVAL '30 days' THEN 0.7
      WHEN last_asked_date > CURRENT_DATE - INTERVAL '90 days' THEN 0.4
      ELSE 0.1
    END * 0.3)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_user_active_interests()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE users
  SET active_interests = (
    SELECT ARRAY_AGG(i.name ORDER BY i.name)
    FROM user_interests ui
    JOIN interests i ON ui.interest_id = i.id
    WHERE ui.user_id = COALESCE(NEW.user_id, OLD.user_id)
  )
  WHERE id = COALESCE(NEW.user_id, OLD.user_id);
  RETURN COALESCE(NEW, OLD);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_user_statuses_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;
