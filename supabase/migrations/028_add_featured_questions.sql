-- Featured Questions Feature Migration
-- Adds tables and functionality for weekly featured questions

-- 1. Featured prompts table
CREATE TABLE featured_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question TEXT NOT NULL,
  description TEXT,
  week_starting DATE NOT NULL, -- Monday of the week
  category TEXT NOT NULL DEFAULT 'Featured',
  display_order INTEGER NOT NULL, -- Order in carousel (1-10)
  suggested_by TEXT, -- Optional name of suggester
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_featured_prompts_week ON featured_prompts(week_starting);
CREATE INDEX idx_featured_prompts_order ON featured_prompts(week_starting, display_order);

-- 2. Group featured questions tracking table
CREATE TABLE group_featured_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  featured_prompt_id UUID NOT NULL REFERENCES featured_prompts(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_added TIMESTAMPTZ DEFAULT NOW(),
  date_scheduled DATE, -- When it will be asked (from group_prompt_queue position)
  prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL, -- Links to prompts table if created
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, featured_prompt_id) -- Prevent duplicate additions
);

CREATE INDEX idx_group_featured_group ON group_featured_questions(group_id);
CREATE INDEX idx_group_featured_prompt ON group_featured_questions(featured_prompt_id);
CREATE INDEX idx_group_featured_added_by ON group_featured_questions(added_by);
CREATE INDEX idx_group_featured_scheduled ON group_featured_questions(date_scheduled);

-- 3. Group featured question count per week
CREATE TABLE group_featured_question_count (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  week_starting DATE NOT NULL, -- Monday of the week
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0 AND count <= 2), -- Max 2 per week
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, week_starting)
);

CREATE INDEX idx_featured_count_group_week ON group_featured_question_count(group_id, week_starting);

-- 4. Add column to prompts table to track if it's a featured prompt
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS featured_prompt_id UUID REFERENCES featured_prompts(id) ON DELETE SET NULL;

CREATE INDEX idx_prompts_featured ON prompts(featured_prompt_id);

-- 5. Enable RLS
ALTER TABLE featured_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_featured_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_featured_question_count ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
-- Anyone authenticated can view featured prompts for current week
CREATE POLICY "Users can view featured prompts" ON featured_prompts FOR SELECT
  TO authenticated USING (true);

-- Allow authenticated users to insert prompts (needed for featured questions)
CREATE POLICY "Users can insert prompts" ON prompts FOR INSERT
  TO authenticated WITH CHECK (true);

-- Allow users to insert into group_prompt_queue for their groups (needed for featured questions)
CREATE POLICY "Users can insert into group_prompt_queue" ON group_prompt_queue FOR INSERT
  TO authenticated WITH CHECK (
    group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid()) AND
    added_by = auth.uid()
  );

-- Allow users to view group_prompt_queue for their groups
CREATE POLICY "Users can view group_prompt_queue" ON group_prompt_queue FOR SELECT
  TO authenticated USING (
    group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );

-- Allow users to update group_prompt_queue for their groups (needed for shifting positions)
CREATE POLICY "Users can update group_prompt_queue" ON group_prompt_queue FOR UPDATE
  TO authenticated USING (
    group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );

-- Users can view featured questions for their groups
CREATE POLICY "Users can view group featured questions" ON group_featured_questions FOR SELECT
  USING (group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid()));

-- Users can add featured questions to their groups
CREATE POLICY "Users can add featured questions" ON group_featured_questions FOR INSERT
  WITH CHECK (
    auth.uid() = added_by AND
    group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );

-- Users can view featured question counts for their groups
CREATE POLICY "Users can view featured question counts" ON group_featured_question_count FOR SELECT
  USING (group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid()));

-- 7. Create trigger to update updated_at on group_featured_question_count
CREATE OR REPLACE FUNCTION update_featured_count_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_featured_count_updated_at
    BEFORE UPDATE ON group_featured_question_count
    FOR EACH ROW
    EXECUTE FUNCTION update_featured_count_updated_at();

-- 8. Helper function to get current week's Monday
CREATE OR REPLACE FUNCTION get_current_week_monday()
RETURNS DATE AS $$
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
$$ LANGUAGE plpgsql;

