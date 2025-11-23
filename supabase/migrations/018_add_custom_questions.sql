-- Custom Questions Feature Migration
-- Adds tables and columns for custom question functionality

-- 1. Custom questions table
CREATE TABLE custom_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL CHECK (char_length(question) <= 200), -- ~20 words max
  description TEXT,
  is_anonymous BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  date_assigned DATE NOT NULL, -- The date the user was selected
  date_asked DATE, -- The date the question was actually asked (null if skipped)
  prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL, -- Links to prompts table if created
  UNIQUE(group_id, date_assigned) -- Only one custom question opportunity per group per day
);

CREATE INDEX idx_custom_questions_group ON custom_questions(group_id);
CREATE INDEX idx_custom_questions_user ON custom_questions(user_id);
CREATE INDEX idx_custom_questions_date_assigned ON custom_questions(date_assigned);
CREATE INDEX idx_custom_questions_date_asked ON custom_questions(date_asked);
CREATE INDEX idx_custom_questions_prompt ON custom_questions(prompt_id);

-- 2. Custom question rotation tracking table
CREATE TABLE custom_question_rotation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL, -- Monday of the week
  date_assigned DATE NOT NULL, -- The date they were selected
  status TEXT NOT NULL CHECK (status IN ('assigned', 'completed', 'skipped')) DEFAULT 'assigned',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id, week_start_date) -- One assignment per user per week per group
);

CREATE INDEX idx_rotation_group_week ON custom_question_rotation(group_id, week_start_date);
CREATE INDEX idx_rotation_user ON custom_question_rotation(user_id);
CREATE INDEX idx_rotation_status ON custom_question_rotation(status);

-- 3. Group activity tracking table
CREATE TABLE group_activity_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  first_member_joined_at TIMESTAMPTZ, -- First non-admin member join date
  first_entry_date DATE, -- Date of first entry in group
  is_eligible_for_custom_questions BOOLEAN DEFAULT false,
  eligible_since TIMESTAMPTZ, -- When eligibility was achieved
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id)
);

CREATE INDEX idx_activity_group ON group_activity_tracking(group_id);
CREATE INDEX idx_activity_eligible ON group_activity_tracking(is_eligible_for_custom_questions);

-- 4. Add columns to existing tables
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_seen_custom_question_onboarding BOOLEAN DEFAULT false;
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT false;
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS custom_question_id UUID REFERENCES custom_questions(id) ON DELETE SET NULL;

-- 5. Enable RLS
ALTER TABLE custom_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_question_rotation ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_activity_tracking ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
-- Users can view custom questions for their groups
CREATE POLICY "Users can view custom questions for their groups" ON custom_questions FOR SELECT
  USING (group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid()));

-- Users can create custom questions for their assigned opportunities
CREATE POLICY "Users can create custom questions" ON custom_questions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );

-- Users can update their own custom questions (before date_asked is set)
CREATE POLICY "Users can update their custom questions" ON custom_questions FOR UPDATE
  USING (
    auth.uid() = user_id AND
    date_asked IS NULL
  );

-- Users can view rotation data for their groups
CREATE POLICY "Users can view rotation for their groups" ON custom_question_rotation FOR SELECT
  USING (group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid()));

-- Users can view activity tracking for their groups
CREATE POLICY "Users can view activity tracking for their groups" ON group_activity_tracking FOR SELECT
  USING (group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid()));

-- 7. Create trigger to update updated_at on group_activity_tracking
CREATE OR REPLACE FUNCTION update_group_activity_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_group_activity_updated_at
    BEFORE UPDATE ON group_activity_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_group_activity_updated_at();

