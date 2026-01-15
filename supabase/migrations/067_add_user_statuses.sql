-- Create user_statuses table to store daily user statuses
CREATE TABLE IF NOT EXISTS user_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  status_text TEXT NOT NULL CHECK (char_length(status_text) <= 200), -- Max 20 words (roughly 200 chars)
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, group_id, date) -- One status per user per group per day
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_statuses_user_group_date ON user_statuses(user_id, group_id, date);
CREATE INDEX IF NOT EXISTS idx_user_statuses_group_date ON user_statuses(group_id, date);
CREATE INDEX IF NOT EXISTS idx_user_statuses_date ON user_statuses(date);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_statuses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_user_statuses_updated_at_trigger
  BEFORE UPDATE ON user_statuses
  FOR EACH ROW
  EXECUTE FUNCTION update_user_statuses_updated_at();

-- Enable Row Level Security
ALTER TABLE user_statuses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read all statuses in their groups
CREATE POLICY "Users can read statuses in their groups"
  ON user_statuses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = user_statuses.group_id
      AND group_members.user_id = auth.uid()
    )
  );

-- Policy: Users can insert their own statuses
CREATE POLICY "Users can insert their own statuses"
  ON user_statuses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own statuses (only for today)
CREATE POLICY "Users can update their own statuses"
  ON user_statuses
  FOR UPDATE
  USING (auth.uid() = user_id AND date = CURRENT_DATE)
  WITH CHECK (auth.uid() = user_id AND date = CURRENT_DATE);

-- Policy: Users can delete their own statuses (only for today)
CREATE POLICY "Users can delete their own statuses"
  ON user_statuses
  FOR DELETE
  USING (auth.uid() = user_id AND date = CURRENT_DATE);
