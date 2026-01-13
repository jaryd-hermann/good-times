-- Function to calculate engagement score for a daily_prompt
-- Engagement score formula:
-- - Answered: 50% weight (1 if answered, 0 if not)
-- - Response length: 30% weight (normalized 0-1, max 500 chars = 1.0)
-- - Reactions count: 20% weight (normalized 0-1, max 5 reactions = 1.0)
CREATE OR REPLACE FUNCTION calculate_engagement_score(p_daily_prompt_id UUID)
RETURNS DECIMAL AS $$
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
$$ LANGUAGE plpgsql;

-- Function to analyze discovery engagement and promote to inferred interests
-- This should be called periodically (e.g., daily) to process discovery attempts
CREATE OR REPLACE FUNCTION analyze_discovery_engagement()
RETURNS TABLE (
  group_id UUID,
  interest_name TEXT,
  status TEXT,
  avg_engagement DECIMAL
) AS $$
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
$$ LANGUAGE plpgsql;

-- Function to update engagement scores for discovery questions
-- This should be called after responses/reactions are created
CREATE OR REPLACE FUNCTION update_discovery_engagement(p_daily_prompt_id UUID)
RETURNS void AS $$
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
$$ LANGUAGE plpgsql;

-- Trigger to auto-update engagement when responses/reactions are created
-- Note: This requires triggers on prompt_responses and prompt_reactions tables
-- We'll create a simpler approach: call update_discovery_engagement manually or via cron
