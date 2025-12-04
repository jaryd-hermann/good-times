-- Question Swipes Feature Migration
-- Adds tables and functionality for swipe-to-match questions

-- 1. Add swipeable and swipe count columns to prompts table
ALTER TABLE prompts 
ADD COLUMN IF NOT EXISTS swipeable BOOLEAN DEFAULT FALSE;

ALTER TABLE prompts 
ADD COLUMN IF NOT EXISTS yes_swipes_count INTEGER DEFAULT 0;

ALTER TABLE prompts 
ADD COLUMN IF NOT EXISTS no_swipes_count INTEGER DEFAULT 0;

-- Add indexes for swipeable queries
CREATE INDEX IF NOT EXISTS idx_prompts_swipeable ON prompts(swipeable) WHERE swipeable = TRUE;
CREATE INDEX IF NOT EXISTS idx_prompts_category_swipeable ON prompts(category, swipeable) WHERE swipeable = TRUE;

-- 2. Create group_question_swipes table to track individual swipes
CREATE TABLE IF NOT EXISTS group_question_swipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  response TEXT NOT NULL CHECK (response IN ('yes', 'no')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, group_id, prompt_id) -- One swipe per user per group per question
);

CREATE INDEX idx_group_swipes_user_group ON group_question_swipes(user_id, group_id);
CREATE INDEX idx_group_swipes_group_prompt ON group_question_swipes(group_id, prompt_id);
CREATE INDEX idx_group_swipes_prompt_response ON group_question_swipes(prompt_id, response);

-- 3. Create group_question_matches table to track matched questions
CREATE TABLE IF NOT EXISTS group_question_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  matched_at TIMESTAMPTZ DEFAULT NOW(),
  asked BOOLEAN DEFAULT FALSE, -- Track if this matched question has been asked
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, prompt_id) -- One match per group per question
);

CREATE INDEX idx_group_matches_group ON group_question_matches(group_id);
CREATE INDEX idx_group_matches_prompt ON group_question_matches(prompt_id);
CREATE INDEX idx_group_matches_asked ON group_question_matches(group_id, asked) WHERE asked = FALSE;

-- 4. Enable RLS on new tables
ALTER TABLE group_question_swipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_question_matches ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for group_question_swipes
-- Users can view swipes for their groups
CREATE POLICY "Users can view swipes in their groups" ON group_question_swipes
  FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
  );

-- Users can insert their own swipes
CREATE POLICY "Users can create their own swipes" ON group_question_swipes
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own swipes
CREATE POLICY "Users can update their own swipes" ON group_question_swipes
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 6. RLS Policies for group_question_matches
-- Users can view matches for their groups
CREATE POLICY "Users can view matches in their groups" ON group_question_matches
  FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
  );

-- Service role can insert matches (via backend function)
CREATE POLICY "Service role can insert matches" ON group_question_matches
  FOR INSERT
  WITH CHECK (true); -- Will be restricted by service role key

-- Service role can update matches (via backend function)
CREATE POLICY "Service role can update matches" ON group_question_matches
  FOR UPDATE
  USING (true)
  WITH CHECK (true); -- Will be restricted by service role key

-- 7. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_group_swipes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_group_swipes_updated_at
    BEFORE UPDATE ON group_question_swipes
    FOR EACH ROW
    EXECUTE FUNCTION update_group_swipes_updated_at();

-- 8. Create function to check and create matches when swipes occur
-- This will be called from the application layer, but we can create a helper function
CREATE OR REPLACE FUNCTION check_and_create_match(
  p_group_id UUID,
  p_prompt_id UUID
)
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Add comments for documentation
COMMENT ON COLUMN prompts.swipeable IS 'TRUE if question can be shown in swipe feed. FALSE by default.';
COMMENT ON COLUMN prompts.yes_swipes_count IS 'Aggregated count of yes swipes across all groups';
COMMENT ON COLUMN prompts.no_swipes_count IS 'Aggregated count of no swipes across all groups';
COMMENT ON TABLE group_question_swipes IS 'Tracks individual user swipes on questions per group';
COMMENT ON TABLE group_question_matches IS 'Tracks matched questions (2+ yes swipes) per group';

