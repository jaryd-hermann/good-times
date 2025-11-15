-- Group Settings Migration
-- Adds group settings and question category preferences

-- Group settings table (for future extensibility)
CREATE TABLE IF NOT EXISTS group_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id)
);

-- Question category preferences table
CREATE TABLE IF NOT EXISTS question_category_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  preference TEXT NOT NULL CHECK (preference IN ('more', 'less', 'none')),
  weight DECIMAL(3,2) DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, category)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_group_settings_group ON group_settings(group_id);
CREATE INDEX IF NOT EXISTS idx_question_preferences_group ON question_category_preferences(group_id);
CREATE INDEX IF NOT EXISTS idx_question_preferences_category ON question_category_preferences(category);

-- Enable RLS
ALTER TABLE group_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_category_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for group_settings
CREATE POLICY "Group members can view settings"
  ON group_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_settings.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Only admins can update settings"
  ON group_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_settings.group_id
      AND group_members.user_id = auth.uid()
      AND group_members.role = 'admin'
    )
  );

CREATE POLICY "Only admins can insert settings"
  ON group_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_settings.group_id
      AND group_members.user_id = auth.uid()
      AND group_members.role = 'admin'
    )
  );

-- RLS Policies for question_category_preferences
CREATE POLICY "Group members can view preferences"
  ON question_category_preferences FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = question_category_preferences.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Only admins can manage preferences"
  ON question_category_preferences FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = question_category_preferences.group_id
      AND group_members.user_id = auth.uid()
      AND group_members.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = question_category_preferences.group_id
      AND group_members.user_id = auth.uid()
      AND group_members.role = 'admin'
    )
  );

-- RLS Policy: Only admins can update group name
CREATE POLICY "Only admins can update group name"
  ON groups FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
      AND group_members.role = 'admin'
    )
  );

-- RLS Policy: Only admins can remove members (except themselves)
CREATE POLICY "Admins can remove members"
  ON group_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
      AND gm.role = 'admin'
    )
    AND user_id != auth.uid() -- Cannot remove yourself
  );

-- Initialize group_settings for existing groups
INSERT INTO group_settings (group_id)
SELECT id FROM groups
ON CONFLICT (group_id) DO NOTHING;

