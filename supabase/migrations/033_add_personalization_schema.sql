-- Migration: Add personalization system schema (Phase 1)
-- Adds classification attributes and global metrics to prompts and decks tables

-- ============================================================================
-- 1. Update prompts table with classification attributes
-- ============================================================================

-- Core classification attributes
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS depth_level INTEGER CHECK (depth_level BETWEEN 1 AND 5);
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS vulnerability_score INTEGER CHECK (vulnerability_score BETWEEN 1 AND 5);
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS emotional_weight TEXT CHECK (emotional_weight IN ('light', 'moderate', 'heavy'));
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS time_orientation TEXT CHECK (time_orientation IN ('past', 'present', 'future', 'timeless'));
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS focus_type TEXT CHECK (focus_type IN ('self', 'others', 'group', 'external'));
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS answer_length_expectation TEXT CHECK (answer_length_expectation IN ('quick', 'medium', 'long'));
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS media_affinity TEXT[];
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS clarity_level INTEGER CHECK (clarity_level BETWEEN 1 AND 5);

-- Tag arrays for additional classification
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS topics TEXT[];
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS mood_tags TEXT[];
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS is_conversation_starter BOOLEAN DEFAULT false;

-- Global metrics
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS total_asked_count INTEGER DEFAULT 0;
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS total_answered_count INTEGER DEFAULT 0;
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS global_completion_rate FLOAT;
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS last_asked_date DATE;
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS popularity_score FLOAT;

-- Training questions flag (for Phase 6)
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS is_training BOOLEAN DEFAULT false;

-- ============================================================================
-- 2. Create deck_classifications table (normalized approach)
-- ============================================================================

CREATE TABLE IF NOT EXISTS deck_classifications (
  deck_id UUID PRIMARY KEY REFERENCES decks(id) ON DELETE CASCADE,
  depth_level INTEGER CHECK (depth_level BETWEEN 1 AND 5),
  vulnerability_score INTEGER CHECK (vulnerability_score BETWEEN 1 AND 5),
  emotional_weight TEXT CHECK (emotional_weight IN ('light', 'moderate', 'heavy')),
  time_orientation TEXT CHECK (time_orientation IN ('past', 'present', 'future', 'timeless')),
  focus_type TEXT CHECK (focus_type IN ('self', 'others', 'group', 'external')),
  media_affinity TEXT[],
  deck_vibe_tags TEXT[],
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. Create indexes for performance
-- ============================================================================

-- Standard indexes for prompt attributes
CREATE INDEX IF NOT EXISTS idx_prompts_depth_level ON prompts(depth_level);
CREATE INDEX IF NOT EXISTS idx_prompts_vulnerability_score ON prompts(vulnerability_score);
CREATE INDEX IF NOT EXISTS idx_prompts_time_orientation ON prompts(time_orientation);
CREATE INDEX IF NOT EXISTS idx_prompts_popularity_score ON prompts(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_prompts_is_conversation_starter ON prompts(is_conversation_starter);
CREATE INDEX IF NOT EXISTS idx_prompts_is_training ON prompts(is_training);

-- GIN indexes for array columns (enables efficient array queries)
CREATE INDEX IF NOT EXISTS idx_prompts_topics_gin ON prompts USING GIN(topics);
CREATE INDEX IF NOT EXISTS idx_prompts_mood_tags_gin ON prompts USING GIN(mood_tags);
CREATE INDEX IF NOT EXISTS idx_prompts_media_affinity_gin ON prompts USING GIN(media_affinity);

-- Index for group_question_swipes (used in early signal detection)
-- Note: Index already exists (idx_group_swipes_group_prompt) but adding this for clarity
-- The existing index covers this use case

-- ============================================================================
-- 4. Create function to update global question metrics
-- ============================================================================

CREATE OR REPLACE FUNCTION update_question_global_metrics()
RETURNS void AS $$
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
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. Create trigger to update metrics when entry is created
-- ============================================================================

CREATE OR REPLACE FUNCTION update_question_answered()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE prompts 
  SET total_answered_count = total_answered_count + 1
  WHERE id = NEW.prompt_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS entry_created_update_metrics ON entries;

CREATE TRIGGER entry_created_update_metrics
AFTER INSERT ON entries
FOR EACH ROW
EXECUTE FUNCTION update_question_answered();

-- ============================================================================
-- 6. Create function to increment asked count (call when scheduling)
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_question_asked(p_prompt_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE prompts 
  SET 
    total_asked_count = total_asked_count + 1,
    last_asked_date = CURRENT_DATE
  WHERE id = p_prompt_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. Initial population of global metrics (run once)
-- ============================================================================

-- Populate metrics for all existing questions
SELECT update_question_global_metrics();

