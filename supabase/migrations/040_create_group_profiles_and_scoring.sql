-- Phase 3: Profile Assessment & Question Scoring
-- Creates materialized view for group vibe profiles and functions for question scoring
-- 
-- This enables the personalization system to:
-- 1. Assess group profiles based on engagement, swipes, decks, and answers
-- 2. Score questions for fit with each group
-- 3. Suggest personalized questions for groups

-- ============================================================================
-- 1. CREATE GROUP VIBE PROFILES MATERIALIZED VIEW
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS group_vibe_profiles AS
SELECT 
  g.id as group_id,
  g.type as group_type,
  
  -- Basic engagement metrics
  COUNT(DISTINCT dp.id) as total_prompts_asked,
  COUNT(DISTINCT e.id) as total_entries,
  COUNT(DISTINCT gm.user_id) as member_count,
  COUNT(DISTINCT e.id)::FLOAT / NULLIF(
    COUNT(DISTINCT dp.id) * COUNT(DISTINCT gm.user_id), 0
  ) as avg_completion_rate,
  
  -- Answer characteristics
  AVG(LENGTH(e.text_content)) as avg_answer_length,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY LENGTH(e.text_content)) as median_answer_length,
  
  -- Media affinity
  COUNT(CASE WHEN e.media_urls IS NOT NULL AND array_length(e.media_urls, 1) > 0 THEN 1 END)::FLOAT / 
    NULLIF(COUNT(e.id), 0) as media_attachment_rate,
  
  -- Question attribute preferences (from answered questions)
  AVG(p.depth_level) as avg_preferred_depth,
  STDDEV(p.depth_level) as depth_variance,
  AVG(p.vulnerability_score) as avg_vulnerability_comfort,
  STDDEV(p.vulnerability_score) as vulnerability_variance,
  
  -- Category preferences (calculated via subquery to avoid nested aggregates)
  (SELECT jsonb_object_agg(
     category,
     engagement_rate
   )
   FROM (
     SELECT 
       p.category,
       COUNT(DISTINCT e.id)::FLOAT / NULLIF(COUNT(DISTINCT dp.id), 0) as engagement_rate
     FROM daily_prompts dp
     JOIN prompts p ON dp.prompt_id = p.id
     LEFT JOIN entries e ON e.prompt_id = p.id AND e.group_id = g.id
     WHERE dp.group_id = g.id AND p.category IS NOT NULL
     GROUP BY p.category
   ) category_stats
  ) as category_engagement_rates,
  
  -- Time orientation preference
  AVG(CASE 
    WHEN p.time_orientation = 'past' THEN 1.0
    WHEN p.time_orientation = 'present' THEN 0.5
    WHEN p.time_orientation = 'future' THEN 0.0
    ELSE 0.5
  END) as time_orientation_score,
  
  -- Swipe preferences (CRITICAL: Early signal)
  (SELECT AVG(CASE WHEN qs.response = 'yes' THEN 1.0 ELSE 0.0 END)
   FROM group_question_swipes qs
   JOIN prompts p2 ON qs.prompt_id = p2.id
   WHERE qs.group_id = g.id) as swipe_yes_rate,
  
  -- Swipe-based attribute preferences (before they answer!)
  (SELECT AVG(p2.depth_level)
   FROM group_question_swipes qs
   JOIN prompts p2 ON qs.prompt_id = p2.id
   WHERE qs.group_id = g.id AND qs.response = 'yes') as swipe_preferred_depth,
  
  (SELECT AVG(p2.vulnerability_score)
   FROM group_question_swipes qs
   JOIN prompts p2 ON qs.prompt_id = p2.id
   WHERE qs.group_id = g.id AND qs.response = 'yes') as swipe_preferred_vulnerability,
  
  -- Deck preferences (CRITICAL: Early signal)
  (SELECT jsonb_object_agg(
     d.id::TEXT,
     jsonb_build_object(
       'depth_level', dc.depth_level,
       'vulnerability_score', dc.vulnerability_score,
       'emotional_weight', dc.emotional_weight
     )
   )
   FROM group_active_decks gad
   JOIN decks d ON gad.deck_id = d.id
   LEFT JOIN deck_classifications dc ON dc.deck_id = d.id
   WHERE gad.group_id = g.id AND gad.status = 'active'
  ) as active_deck_profiles,
  
  -- Response speed
  AVG(EXTRACT(EPOCH FROM (e.created_at - dp.date))) / 3600 as avg_hours_to_first_response,
  
  -- Comment engagement (CRITICAL: Shows discussion interest)
  (SELECT AVG(comment_count)
   FROM (
     SELECT e.id, COUNT(c.id) as comment_count
     FROM entries e
     JOIN daily_prompts dp ON e.prompt_id = dp.prompt_id AND dp.group_id = g.id
     LEFT JOIN comments c ON c.entry_id = e.id
     WHERE e.group_id = g.id
     GROUP BY e.id
   ) entry_comments
  ) as avg_comments_per_entry,
  
  (SELECT AVG(CASE WHEN comment_count > 0 THEN 1.0 ELSE 0.0 END)
   FROM (
     SELECT e.id, COUNT(c.id) as comment_count
     FROM entries e
     JOIN daily_prompts dp ON e.prompt_id = dp.prompt_id AND dp.group_id = g.id
     LEFT JOIN comments c ON c.entry_id = e.id
     WHERE e.group_id = g.id
     GROUP BY e.id
   ) entry_comments
  ) as entry_comment_rate,
  
  -- Conversation starter preference (questions that generate discussion)
  AVG(CASE WHEN p.is_conversation_starter = true THEN 1.0 ELSE 0.0 END) as conversation_starter_preference,
  
  -- Topic preferences (from answered questions)
  (SELECT jsonb_object_agg(
     topic,
     engagement_rate
   )
   FROM (
     SELECT 
       topic,
       COUNT(DISTINCT e.id)::FLOAT / NULLIF(COUNT(DISTINCT dp.id), 0) as engagement_rate
     FROM daily_prompts dp
     JOIN prompts p ON dp.prompt_id = p.id
     JOIN entries e ON e.prompt_id = p.id AND e.group_id = g.id
     CROSS JOIN LATERAL unnest(p.topics) as topic
     WHERE dp.group_id = g.id
     GROUP BY topic
   ) topic_stats
  ) as topic_engagement_rates,
  
  -- Mood preferences (from answered questions)
  (SELECT jsonb_object_agg(
     mood_tag,
     engagement_rate
   )
   FROM (
     SELECT 
       mood_tag,
       COUNT(DISTINCT e.id)::FLOAT / NULLIF(COUNT(DISTINCT dp.id), 0) as engagement_rate
     FROM daily_prompts dp
     JOIN prompts p ON dp.prompt_id = p.id
     JOIN entries e ON e.prompt_id = p.id AND e.group_id = g.id
     CROSS JOIN LATERAL unnest(p.mood_tags) as mood_tag
     WHERE dp.group_id = g.id
     GROUP BY mood_tag
   ) mood_stats
  ) as mood_engagement_rates,
  
  -- Last engagement
  MAX(e.created_at) as last_engagement_date,
  MAX(dp.date) as last_prompt_date
  
FROM groups g
LEFT JOIN group_members gm ON gm.group_id = g.id
LEFT JOIN daily_prompts dp ON dp.group_id = g.id
LEFT JOIN entries e ON e.prompt_id = dp.prompt_id AND e.group_id = g.id
LEFT JOIN prompts p ON p.id = dp.prompt_id
GROUP BY g.id, g.type;

-- Create index on materialized view for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_vibe_profiles_group_id ON group_vibe_profiles(group_id);

-- ============================================================================
-- 2. CREATE FUNCTION TO CALCULATE QUESTION FIT SCORE
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_question_fit_score(
  p_group_id UUID,
  p_prompt_id UUID
)
RETURNS FLOAT AS $$
DECLARE
  v_profile RECORD;
  v_prompt RECORD;
  v_score FLOAT := 0.0;
  v_depth_score FLOAT := 0.0;
  v_vulnerability_score FLOAT := 0.0;
  v_category_score FLOAT := 0.0;
  v_time_orientation_score FLOAT := 0.0;
  v_topic_score FLOAT := 0.0;
  v_mood_score FLOAT := 0.0;
  v_media_score FLOAT := 0.0;
  v_conversation_starter_score FLOAT := 0.0;
  v_global_popularity_score FLOAT := 0.0;
  v_swipe_score FLOAT := 0.0;
  v_deck_score FLOAT := 0.0;
  v_comment_interest_score FLOAT := 0.0;
BEGIN
  -- Get group profile
  SELECT * INTO v_profile
  FROM group_vibe_profiles
  WHERE group_id = p_group_id;
  
  -- Get prompt details
  SELECT * INTO v_prompt
  FROM prompts
  WHERE id = p_prompt_id;
  
  -- If no profile exists (new group), use global popularity
  IF v_profile IS NULL OR v_profile.total_prompts_asked = 0 THEN
    -- Use global popularity metrics for new groups
    v_global_popularity_score := COALESCE(
      v_prompt.popularity_score, 
      0.5
    ) * 0.3; -- Weight global popularity at 30% for new groups
    
    -- Also consider if question has been asked/answered globally
    IF v_prompt.total_asked_count > 0 THEN
      v_global_popularity_score := v_global_popularity_score + 
        (LEAST(v_prompt.global_completion_rate, 1.0) * 0.2);
    END IF;
    
    RETURN LEAST(v_global_popularity_score, 1.0);
  END IF;
  
  -- 1. DEPTH SCORE (0-1, weight: 20%)
  -- Use swipe data if available (early signal), otherwise use answered questions
  IF v_profile.swipe_preferred_depth IS NOT NULL THEN
    -- Use swipe preference for early groups
    v_depth_score := 1.0 - ABS(
      COALESCE(v_prompt.depth_level, 3) - v_profile.swipe_preferred_depth
    ) / 5.0;
  ELSIF v_profile.avg_preferred_depth IS NOT NULL THEN
    -- Use answered question preference
    v_depth_score := 1.0 - ABS(
      COALESCE(v_prompt.depth_level, 3) - v_profile.avg_preferred_depth
    ) / 5.0;
  ELSE
    v_depth_score := 0.5; -- Neutral if no data
  END IF;
  
  -- 2. VULNERABILITY SCORE (0-1, weight: 15%)
  IF v_profile.swipe_preferred_vulnerability IS NOT NULL THEN
    v_vulnerability_score := 1.0 - ABS(
      COALESCE(v_prompt.vulnerability_score, 3) - v_profile.swipe_preferred_vulnerability
    ) / 5.0;
  ELSIF v_profile.avg_vulnerability_comfort IS NOT NULL THEN
    v_vulnerability_score := 1.0 - ABS(
      COALESCE(v_prompt.vulnerability_score, 3) - v_profile.avg_vulnerability_comfort
    ) / 5.0;
  ELSE
    v_vulnerability_score := 0.5;
  END IF;
  
  -- 3. CATEGORY SCORE (0-1, weight: 10%)
  IF v_profile.category_engagement_rates IS NOT NULL AND 
     v_profile.category_engagement_rates ? v_prompt.category THEN
    v_category_score := LEAST(
      (v_profile.category_engagement_rates->>v_prompt.category)::FLOAT,
      1.0
    );
  ELSE
    v_category_score := 0.3; -- Lower score for untested categories
  END IF;
  
  -- 4. TIME ORIENTATION SCORE (0-1, weight: 10%)
  IF v_profile.time_orientation_score IS NOT NULL THEN
    CASE v_prompt.time_orientation
      WHEN 'past' THEN
        v_time_orientation_score := v_profile.time_orientation_score;
      WHEN 'present' THEN
        v_time_orientation_score := 1.0 - ABS(v_profile.time_orientation_score - 0.5) * 2.0;
      WHEN 'future' THEN
        v_time_orientation_score := 1.0 - v_profile.time_orientation_score;
      ELSE
        v_time_orientation_score := 0.5;
    END CASE;
  ELSE
    v_time_orientation_score := 0.5;
  END IF;
  
  -- 5. TOPIC SCORE (0-1, weight: 10%)
  -- Check if any prompt topics match group's preferred topics
  IF v_profile.topic_engagement_rates IS NOT NULL AND 
     v_prompt.topics IS NOT NULL THEN
    SELECT COALESCE(MAX((v_profile.topic_engagement_rates->>topic)::FLOAT), 0.0)
    INTO v_topic_score
    FROM unnest(v_prompt.topics) as topic
    WHERE v_profile.topic_engagement_rates ? topic;
    
    -- If no matches, use average of all topic rates
    IF v_topic_score = 0.0 THEN
      SELECT COALESCE(AVG((value::jsonb->>0)::FLOAT), 0.3)
      INTO v_topic_score
      FROM jsonb_each(v_profile.topic_engagement_rates);
    END IF;
  ELSE
    v_topic_score := 0.3;
  END IF;
  
  -- 6. MOOD SCORE (0-1, weight: 5%)
  IF v_profile.mood_engagement_rates IS NOT NULL AND 
     v_prompt.mood_tags IS NOT NULL THEN
    SELECT COALESCE(MAX((v_profile.mood_engagement_rates->>mood_tag)::FLOAT), 0.0)
    INTO v_mood_score
    FROM unnest(v_prompt.mood_tags) as mood_tag
    WHERE v_profile.mood_engagement_rates ? mood_tag;
    
    IF v_mood_score = 0.0 THEN
      SELECT COALESCE(AVG((value::jsonb->>0)::FLOAT), 0.3)
      INTO v_mood_score
      FROM jsonb_each(v_profile.mood_engagement_rates);
    END IF;
  ELSE
    v_mood_score := 0.3;
  END IF;
  
  -- 7. MEDIA AFFINITY SCORE (0-1, weight: 5%)
  IF v_profile.media_attachment_rate IS NOT NULL THEN
    CASE 
      WHEN v_prompt.media_affinity && ARRAY['high'] THEN
        v_media_score := v_profile.media_attachment_rate;
      WHEN v_prompt.media_affinity && ARRAY['medium'] THEN
        v_media_score := 0.5 + (v_profile.media_attachment_rate - 0.5) * 0.5;
      WHEN v_prompt.media_affinity && ARRAY['low'] THEN
        v_media_score := 0.5 - (v_profile.media_attachment_rate - 0.5) * 0.5;
      ELSE
        v_media_score := 0.5;
    END CASE;
  ELSE
    v_media_score := 0.5;
  END IF;
  
  -- 8. CONVERSATION STARTER SCORE (0-1, weight: 5%)
  -- Boost if group likes conversation starters and question is one
  IF v_profile.conversation_starter_preference IS NOT NULL AND 
     v_prompt.is_conversation_starter = true THEN
    v_conversation_starter_score := v_profile.conversation_starter_preference;
  ELSE
    v_conversation_starter_score := 0.5;
  END IF;
  
  -- 9. COMMENT INTEREST SCORE (0-1, weight: 5%)
  -- Boost if group has high comment engagement and question is conversation starter
  IF v_profile.entry_comment_rate IS NOT NULL AND 
     v_prompt.is_conversation_starter = true THEN
    v_comment_interest_score := v_profile.entry_comment_rate;
  ELSE
    v_comment_interest_score := 0.5;
  END IF;
  
  -- 10. SWIPE SCORE (0-1, weight: 10% if available)
  -- Check if group has swiped on this question
  SELECT AVG(CASE WHEN response = 'yes' THEN 1.0 ELSE 0.0 END)
  INTO v_swipe_score
  FROM group_question_swipes
  WHERE group_id = p_group_id AND prompt_id = p_prompt_id;
  
  IF v_swipe_score IS NULL THEN
    v_swipe_score := 0.5; -- Neutral if no swipe data
  END IF;
  
  -- 11. DECK SCORE (0-1, weight: 5% if available)
  -- Check if question belongs to an active deck
  SELECT COUNT(*)::FLOAT / NULLIF(COUNT(DISTINCT gad.deck_id), 0)
  INTO v_deck_score
  FROM group_active_decks gad
  JOIN prompts p ON p.deck_id = gad.deck_id
  WHERE gad.group_id = p_group_id 
    AND gad.status = 'active'
    AND p.id = p_prompt_id;
  
  IF v_deck_score IS NULL OR v_deck_score = 0 THEN
    v_deck_score := 0.5; -- Neutral if not in active deck
  ELSE
    v_deck_score := 1.0; -- High score if in active deck
  END IF;
  
  -- Calculate weighted final score
  v_score := 
    (v_depth_score * 0.20) +
    (v_vulnerability_score * 0.15) +
    (v_category_score * 0.10) +
    (v_time_orientation_score * 0.10) +
    (v_topic_score * 0.10) +
    (v_mood_score * 0.05) +
    (v_media_score * 0.05) +
    (v_conversation_starter_score * 0.05) +
    (v_comment_interest_score * 0.05) +
    (v_swipe_score * 0.10) +
    (v_deck_score * 0.05);
  
  -- Ensure score is between 0 and 1
  RETURN LEAST(GREATEST(v_score, 0.0), 1.0);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 3. CREATE FUNCTION TO SUGGEST QUESTIONS FOR GROUP
-- ============================================================================

CREATE OR REPLACE FUNCTION suggest_questions_for_group(
  p_group_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_exclude_prompt_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS TABLE(
  prompt_id UUID,
  fit_score FLOAT,
  question TEXT,
  category TEXT,
  depth_level INTEGER,
  vulnerability_score INTEGER,
  popularity_score FLOAT
) AS $$
DECLARE
  v_group_type TEXT;
  v_profile RECORD;
BEGIN
  -- Get group type
  SELECT type INTO v_group_type
  FROM groups
  WHERE id = p_group_id;
  
  -- Check if group exists
  IF v_group_type IS NULL THEN
    RAISE WARNING 'Group % does not exist', p_group_id;
    RETURN;
  END IF;
  
  -- Get profile to check if group is new
  SELECT * INTO v_profile
  FROM group_vibe_profiles
  WHERE group_id = p_group_id;
  
  -- For new groups or groups with no engagement, use global popularity
  IF v_profile IS NULL OR v_profile.total_prompts_asked = 0 THEN
    RETURN QUERY
    SELECT 
      p.id as prompt_id,
      COALESCE(p.popularity_score, 0.5) as fit_score,
      p.question,
      p.category,
      p.depth_level,
      p.vulnerability_score,
      p.popularity_score
    FROM prompts p
    WHERE (p.is_default = true OR p.is_default IS NULL)  -- Include default prompts or NULL (assume available)
      AND p.category = CASE WHEN v_group_type = 'family' THEN 'Family' ELSE 'Friends' END
      AND (p_exclude_prompt_ids IS NULL OR array_length(p_exclude_prompt_ids, 1) IS NULL OR NOT (p.id = ANY(p_exclude_prompt_ids)))
      AND (p.is_training IS NULL OR p.is_training = false)  -- Exclude only if explicitly marked as training
    ORDER BY 
      COALESCE(p.popularity_score, 0.5) DESC,
      COALESCE(p.global_completion_rate, 0.0) DESC,
      COALESCE(p.total_asked_count, 0) DESC
    LIMIT p_limit;
  ELSE
    -- Use personalized scoring
    -- CRITICAL: Always filter by group type category (Friends/Family)
    -- Exclude special categories: Remembering, Birthday, Custom, Featured (handled separately in scheduling)
    RETURN QUERY
    SELECT 
      p.id as prompt_id,
      calculate_question_fit_score(p_group_id, p.id) as fit_score,
      p.question,
      p.category,
      p.depth_level,
      p.vulnerability_score,
      p.popularity_score
    FROM prompts p
    WHERE (p.is_default = true OR p.is_default IS NULL)  -- Include default prompts or NULL (assume available)
      AND p.category = CASE WHEN v_group_type = 'family' THEN 'Family' ELSE 'Friends' END  -- CRITICAL: Match group type
      AND p.category NOT IN ('Remembering', 'Birthday', 'Featured')  -- Exclude special categories (Custom handled via custom_questions table)
      AND (p_exclude_prompt_ids IS NULL OR array_length(p_exclude_prompt_ids, 1) IS NULL OR NOT (p.id = ANY(p_exclude_prompt_ids)))
      AND (p.is_training IS NULL OR p.is_training = false)  -- Exclude only if explicitly marked as training
      -- Progressive introduction: start with similar depth/vulnerability
      AND (
        v_profile.avg_preferred_depth IS NULL OR
        p.depth_level IS NULL OR
        ABS(p.depth_level - COALESCE(v_profile.avg_preferred_depth, 3)) <= 2
      )
      AND (
        v_profile.avg_vulnerability_comfort IS NULL OR
        p.vulnerability_score IS NULL OR
        ABS(p.vulnerability_score - COALESCE(v_profile.avg_vulnerability_comfort, 3)) <= 2
      )
    ORDER BY 
      calculate_question_fit_score(p_group_id, p.id) DESC,
      COALESCE(p.popularity_score, 0.5) DESC
    LIMIT p_limit;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 4. CREATE FUNCTION TO REFRESH GROUP VIBE PROFILES
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_group_vibe_profiles()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY group_vibe_profiles;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON MATERIALIZED VIEW group_vibe_profiles IS 
  'Pre-calculated group profiles based on engagement, swipes, decks, and answers. Used for personalization.';

COMMENT ON FUNCTION calculate_question_fit_score IS 
  'Calculates a fit score (0-1) for a question and group based on group profile. Higher scores indicate better fit.';

COMMENT ON FUNCTION suggest_questions_for_group IS 
  'Returns personalized question suggestions for a group, ordered by fit score. Uses global popularity for new groups.';

COMMENT ON FUNCTION refresh_group_vibe_profiles IS 
  'Refreshes the materialized view with latest group engagement data. Should be called daily.';

