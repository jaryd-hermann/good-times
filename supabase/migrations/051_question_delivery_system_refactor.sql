-- Comprehensive Question Delivery System Refactor
-- This migration implements all the changes requested for the question delivery system

-- ============================================================================
-- 1. DROP DEPENDENT OBJECTS FIRST
-- ============================================================================

-- Drop functions that depend on the materialized view and columns we're removing
DROP FUNCTION IF EXISTS suggest_questions_for_group(UUID, INTEGER, UUID[]);
DROP FUNCTION IF EXISTS calculate_question_fit_score(UUID, UUID);
DROP FUNCTION IF EXISTS refresh_group_vibe_profiles();

-- Drop the materialized view (it depends on columns we're removing)
DROP MATERIALIZED VIEW IF EXISTS group_vibe_profiles CASCADE;

-- ============================================================================
-- 2. REMOVE COLUMNS FROM PROMPTS TABLE
-- ============================================================================

-- Remove description column
ALTER TABLE prompts DROP COLUMN IF EXISTS description;

-- Remove is_default column
ALTER TABLE prompts DROP COLUMN IF EXISTS is_default;

-- Remove swipeable columns
ALTER TABLE prompts DROP COLUMN IF EXISTS swipeable;
ALTER TABLE prompts DROP COLUMN IF EXISTS yes_swipes_count;
ALTER TABLE prompts DROP COLUMN IF EXISTS no_swipes_count;

-- Remove scoring/profile columns
ALTER TABLE prompts DROP COLUMN IF EXISTS vulnerability_score CASCADE;
ALTER TABLE prompts DROP COLUMN IF EXISTS emotional_weight;
ALTER TABLE prompts DROP COLUMN IF EXISTS time_orientation;
ALTER TABLE prompts DROP COLUMN IF EXISTS focus_type;
ALTER TABLE prompts DROP COLUMN IF EXISTS answer_lenght_expectation;
ALTER TABLE prompts DROP COLUMN IF EXISTS media_affinity;
ALTER TABLE prompts DROP COLUMN IF EXISTS clarity_level;
ALTER TABLE prompts DROP COLUMN IF EXISTS mood_tags;
ALTER TABLE prompts DROP COLUMN IF EXISTS is_conversation_started;
ALTER TABLE prompts DROP COLUMN IF EXISTS is_training;
ALTER TABLE prompts DROP COLUMN IF EXISTS depth_level;
ALTER TABLE prompts DROP COLUMN IF EXISTS topics;

-- ============================================================================
-- 2. ADD NEW COLUMNS TO PROMPTS TABLE
-- ============================================================================

-- Add ice_breaker_order column
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS ice_breaker_order INTEGER;

-- Add question_type column
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS question_type TEXT;

-- Create index on ice_breaker_order for efficient ordering
CREATE INDEX IF NOT EXISTS idx_prompts_ice_breaker_order ON prompts(ice_breaker_order) WHERE ice_breaker_order IS NOT NULL;

-- ============================================================================
-- 3. UPDATE CATEGORY: Change "Custom" to "Deck" when deck_id is known
-- ============================================================================

-- Update prompts with deck_id to have category "Deck" instead of "Custom"
UPDATE prompts
SET category = 'Deck'
WHERE deck_id IS NOT NULL
  AND category = 'Custom';

-- ============================================================================
-- 4. MERGE "Friends" AND "Family" CATEGORIES TO "Standard"
-- ============================================================================

-- Update all prompts
UPDATE prompts
SET category = 'Standard'
WHERE category IN ('Friends', 'Family');

-- Update daily_prompts (via prompt relationship - this will cascade through joins)
-- Note: This is handled by the prompts table update above since daily_prompts references prompt_id

-- Update group_prompt_queue (via prompt relationship)
-- Note: This is handled by the prompts table update above

-- Update question_category_preferences
UPDATE question_category_preferences
SET category = 'Standard'
WHERE category IN ('Friends', 'Family');

-- Handle duplicate preferences (if a group had both Friends and Family preferences)
-- Keep the one with higher weight, or if equal, keep the one with later updated_at
DELETE FROM question_category_preferences p1
USING question_category_preferences p2
WHERE p1.group_id = p2.group_id
  AND p1.category = 'Standard'
  AND p2.category = 'Standard'
  AND p1.ctid < p2.ctid
  AND (
    p1.weight < p2.weight
    OR (p1.weight = p2.weight AND (p1.updated_at IS NULL OR (p2.updated_at IS NOT NULL AND p1.updated_at < p2.updated_at)))
  );

-- Update group_question_matches (via prompt relationship)
-- Note: This is handled by the prompts table update above

-- ============================================================================
-- 5. UPDATE CUSTOM_QUESTIONS TABLE
-- ============================================================================

-- Remove description column
ALTER TABLE custom_questions DROP COLUMN IF EXISTS description;

-- Add user_name column
ALTER TABLE custom_questions ADD COLUMN IF NOT EXISTS user_name TEXT;

-- Add group_name column
ALTER TABLE custom_questions ADD COLUMN IF NOT EXISTS group_name TEXT;

-- Populate user_name and group_name from existing relationships
UPDATE custom_questions cq
SET 
  user_name = u.name,
  group_name = g.name
FROM users u, groups g
WHERE cq.user_id = u.id
  AND cq.group_id = g.id
  AND (cq.user_name IS NULL OR cq.group_name IS NULL);

-- ============================================================================
-- 6. CREATE GROUP_ENGAGEMENT_DATA TABLE (replacing materialized view)
-- ============================================================================

-- Create new table to replace the materialized view with useful engagement metrics
CREATE TABLE IF NOT EXISTS group_engagement_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE UNIQUE,
  group_name TEXT,
  group_members TEXT, -- Comma-separated list
  
  -- Basic engagement metrics
  total_prompts_asked INTEGER DEFAULT 0,
  total_entries INTEGER DEFAULT 0,
  member_count INTEGER DEFAULT 0,
  avg_completion_rate FLOAT DEFAULT 0,
  
  -- Answer characteristics
  avg_answer_length FLOAT DEFAULT 0,
  median_answer_length FLOAT DEFAULT 0,
  
  -- Media affinity
  media_attachment_rate FLOAT DEFAULT 0,
  
  -- Response speed
  avg_hours_to_first_response FLOAT DEFAULT 0,
  
  -- Comment engagement
  avg_comments_per_entry FLOAT DEFAULT 0,
  entry_comment_rate FLOAT DEFAULT 0,
  
  -- Last engagement tracking
  last_engagement_date TIMESTAMPTZ,
  last_prompt_date DATE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on group_id
CREATE INDEX IF NOT EXISTS idx_group_engagement_data_group_id ON group_engagement_data(group_id);

-- Populate initial data from existing groups
INSERT INTO group_engagement_data (
  group_id, 
  group_name, 
  group_members,
  total_prompts_asked,
  total_entries,
  member_count,
  avg_completion_rate,
  avg_answer_length,
  median_answer_length,
  media_attachment_rate,
  avg_hours_to_first_response,
  avg_comments_per_entry,
  entry_comment_rate,
  last_engagement_date,
  last_prompt_date
)
SELECT 
  g.id,
  g.name,
  (
    SELECT string_agg(u.name, ', ')
    FROM group_members gm
    JOIN users u ON gm.user_id = u.id
    WHERE gm.group_id = g.id
  ),
  COUNT(DISTINCT dp.id),
  COUNT(DISTINCT e.id),
  COUNT(DISTINCT gm.user_id),
  COUNT(DISTINCT e.id)::FLOAT / NULLIF(COUNT(DISTINCT dp.id) * COUNT(DISTINCT gm.user_id), 0),
  AVG(LENGTH(e.text_content)),
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY LENGTH(e.text_content)),
  COUNT(CASE WHEN e.media_urls IS NOT NULL AND array_length(e.media_urls, 1) > 0 THEN 1 END)::FLOAT / 
    NULLIF(COUNT(e.id), 0),
  AVG(EXTRACT(EPOCH FROM (e.created_at - dp.date))) / 3600,
  (
    SELECT AVG(comment_count)
    FROM (
      SELECT e2.id, COUNT(c.id) as comment_count
      FROM entries e2
      JOIN daily_prompts dp2 ON e2.prompt_id = dp2.prompt_id AND dp2.group_id = g.id
      LEFT JOIN comments c ON c.entry_id = e2.id
      WHERE e2.group_id = g.id
      GROUP BY e2.id
    ) entry_comments
  ),
  (
    SELECT AVG(CASE WHEN comment_count > 0 THEN 1.0 ELSE 0.0 END)
    FROM (
      SELECT e2.id, COUNT(c.id) as comment_count
      FROM entries e2
      JOIN daily_prompts dp2 ON e2.prompt_id = dp2.prompt_id AND dp2.group_id = g.id
      LEFT JOIN comments c ON c.entry_id = e2.id
      WHERE e2.group_id = g.id
      GROUP BY e2.id
    ) entry_comments
  ),
  MAX(e.created_at),
  MAX(dp.date)
FROM groups g
LEFT JOIN group_members gm ON gm.group_id = g.id
LEFT JOIN daily_prompts dp ON dp.group_id = g.id
LEFT JOIN entries e ON e.prompt_id = dp.prompt_id AND e.group_id = g.id
GROUP BY g.id, g.name
ON CONFLICT (group_id) DO UPDATE SET
  group_name = EXCLUDED.group_name,
  group_members = EXCLUDED.group_members,
  total_prompts_asked = EXCLUDED.total_prompts_asked,
  total_entries = EXCLUDED.total_entries,
  member_count = EXCLUDED.member_count,
  avg_completion_rate = EXCLUDED.avg_completion_rate,
  avg_answer_length = EXCLUDED.avg_answer_length,
  median_answer_length = EXCLUDED.median_answer_length,
  media_attachment_rate = EXCLUDED.media_attachment_rate,
  avg_hours_to_first_response = EXCLUDED.avg_hours_to_first_response,
  avg_comments_per_entry = EXCLUDED.avg_comments_per_entry,
  entry_comment_rate = EXCLUDED.entry_comment_rate,
  last_engagement_date = EXCLUDED.last_engagement_date,
  last_prompt_date = EXCLUDED.last_prompt_date;

-- Note: The old materialized view group_vibe_profiles was already dropped in section 1

-- Enable RLS on new table
ALTER TABLE group_engagement_data ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view engagement data for their groups
CREATE POLICY "Users can view group engagement data for their groups" ON group_engagement_data FOR SELECT
  USING (group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid()));

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_group_engagement_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_group_engagement_data_updated_at
    BEFORE UPDATE ON group_engagement_data
    FOR EACH ROW
    EXECUTE FUNCTION update_group_engagement_data_updated_at();

-- ============================================================================
-- 7. CREATE FUNCTION TO REFRESH GROUP ENGAGEMENT DATA
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_group_engagement_data(p_group_id UUID DEFAULT NULL)
RETURNS void AS $$
BEGIN
  -- If group_id is provided, refresh only that group, otherwise refresh all
  INSERT INTO group_engagement_data (
    group_id, 
    group_name, 
    group_members,
    total_prompts_asked,
    total_entries,
    member_count,
    avg_completion_rate,
    avg_answer_length,
    median_answer_length,
    media_attachment_rate,
    avg_hours_to_first_response,
    avg_comments_per_entry,
    entry_comment_rate,
    last_engagement_date,
    last_prompt_date
  )
  SELECT 
    g.id,
    g.name,
    (
      SELECT string_agg(u.name, ', ')
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = g.id
    ),
    COUNT(DISTINCT dp.id),
    COUNT(DISTINCT e.id),
    COUNT(DISTINCT gm.user_id),
    COUNT(DISTINCT e.id)::FLOAT / NULLIF(COUNT(DISTINCT dp.id) * COUNT(DISTINCT gm.user_id), 0),
    AVG(LENGTH(e.text_content)),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY LENGTH(e.text_content)),
    COUNT(CASE WHEN e.media_urls IS NOT NULL AND array_length(e.media_urls, 1) > 0 THEN 1 END)::FLOAT / 
      NULLIF(COUNT(e.id), 0),
    AVG(EXTRACT(EPOCH FROM (e.created_at - dp.date))) / 3600,
    (
      SELECT AVG(comment_count)
      FROM (
        SELECT e2.id, COUNT(c.id) as comment_count
        FROM entries e2
        JOIN daily_prompts dp2 ON e2.prompt_id = dp2.prompt_id AND dp2.group_id = g.id
        LEFT JOIN comments c ON c.entry_id = e2.id
        WHERE e2.group_id = g.id
        GROUP BY e2.id
      ) entry_comments
    ),
    (
      SELECT AVG(CASE WHEN comment_count > 0 THEN 1.0 ELSE 0.0 END)
      FROM (
        SELECT e2.id, COUNT(c.id) as comment_count
        FROM entries e2
        JOIN daily_prompts dp2 ON e2.prompt_id = dp2.prompt_id AND dp2.group_id = g.id
        LEFT JOIN comments c ON c.entry_id = e2.id
        WHERE e2.group_id = g.id
        GROUP BY e2.id
      ) entry_comments
    ),
    MAX(e.created_at),
    MAX(dp.date)
  FROM groups g
  LEFT JOIN group_members gm ON gm.group_id = g.id
  LEFT JOIN daily_prompts dp ON dp.group_id = g.id
  LEFT JOIN entries e ON e.prompt_id = dp.prompt_id AND e.group_id = g.id
  WHERE (p_group_id IS NULL OR g.id = p_group_id)
  GROUP BY g.id, g.name
  ON CONFLICT (group_id) DO UPDATE SET
    group_name = EXCLUDED.group_name,
    group_members = EXCLUDED.group_members,
    total_prompts_asked = EXCLUDED.total_prompts_asked,
    total_entries = EXCLUDED.total_entries,
    member_count = EXCLUDED.member_count,
    avg_completion_rate = EXCLUDED.avg_completion_rate,
    avg_answer_length = EXCLUDED.avg_answer_length,
    median_answer_length = EXCLUDED.median_answer_length,
    media_attachment_rate = EXCLUDED.media_attachment_rate,
    avg_hours_to_first_response = EXCLUDED.avg_hours_to_first_response,
    avg_comments_per_entry = EXCLUDED.avg_comments_per_entry,
    entry_comment_rate = EXCLUDED.entry_comment_rate,
    last_engagement_date = EXCLUDED.last_engagement_date,
    last_prompt_date = EXCLUDED.last_prompt_date,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_group_engagement_data IS 
  'Refreshes engagement metrics for a specific group or all groups. Should be called after entries are created or updated.';

-- ============================================================================
-- 8. REMOVE ICE_BREAKER_QUEUE_COMPLETED_DATE LOGIC
-- ============================================================================

-- We're removing the ice-breaker period concept, but we'll keep the column
-- for now to avoid breaking existing code. The scheduling logic will be updated
-- to ignore this column and use ice_breaker_order instead.

-- ============================================================================
-- 9. UPDATE CONSTRAINTS AND INDEXES
-- ============================================================================

-- Ensure question_category_preferences doesn't have duplicates after merge
-- (Already handled above with DELETE statement)

-- Add index for ice_breaker questions ordered by ice_breaker_order
CREATE INDEX IF NOT EXISTS idx_prompts_ice_breaker_ordered 
ON prompts(ice_breaker_order) 
WHERE ice_breaker = true 
  AND ice_breaker_order IS NOT NULL;

-- Add index for Standard category (formerly Friends/Family)
CREATE INDEX IF NOT EXISTS idx_prompts_standard_category 
ON prompts(category) 
WHERE category = 'Standard';

-- ============================================================================
-- 10. COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN prompts.ice_breaker_order IS 'Order in which ice-breaker questions should be asked. Lower numbers are asked first.';
COMMENT ON COLUMN prompts.question_type IS 'Type classification for the question (e.g., reflection, conversation starter, etc.)';
COMMENT ON COLUMN custom_questions.user_name IS 'Name of the user who created this custom question';
COMMENT ON COLUMN custom_questions.group_name IS 'Name of the group this custom question belongs to';
COMMENT ON COLUMN group_engagement_data.group_name IS 'Name of the group';
COMMENT ON COLUMN group_engagement_data.group_members IS 'Comma-separated list of group member names';
COMMENT ON COLUMN group_engagement_data.total_prompts_asked IS 'Total number of prompts asked to this group';
COMMENT ON COLUMN group_engagement_data.total_entries IS 'Total number of entries created by this group';
COMMENT ON COLUMN group_engagement_data.member_count IS 'Number of members in the group';
COMMENT ON COLUMN group_engagement_data.avg_completion_rate IS 'Average completion rate (entries / prompts * members)';
COMMENT ON COLUMN group_engagement_data.avg_answer_length IS 'Average length of text content in entries';
COMMENT ON COLUMN group_engagement_data.median_answer_length IS 'Median length of text content in entries';
COMMENT ON COLUMN group_engagement_data.media_attachment_rate IS 'Percentage of entries that include media';
COMMENT ON COLUMN group_engagement_data.avg_hours_to_first_response IS 'Average hours between prompt date and first entry creation';
COMMENT ON COLUMN group_engagement_data.avg_comments_per_entry IS 'Average number of comments per entry';
COMMENT ON COLUMN group_engagement_data.entry_comment_rate IS 'Percentage of entries that have at least one comment';
COMMENT ON COLUMN group_engagement_data.last_engagement_date IS 'Most recent entry creation timestamp';
COMMENT ON COLUMN group_engagement_data.last_prompt_date IS 'Most recent prompt date';

