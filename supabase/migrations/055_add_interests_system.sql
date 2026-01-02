-- Add interests system for groups and users
-- This sets up the foundation for prioritizing questions by group interests

-- Create interests table
CREATE TABLE IF NOT EXISTS interests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  display_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create junction table for group interests (many-to-many)
CREATE TABLE IF NOT EXISTS group_interests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  interest_id UUID NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, interest_id)
);

-- Create junction table for user interests (many-to-many)
CREATE TABLE IF NOT EXISTS user_interests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interest_id UUID NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, interest_id)
);

-- Add interests column to prompts table (array of interest names)
ALTER TABLE prompts 
ADD COLUMN IF NOT EXISTS interests TEXT[] DEFAULT '{}';

-- Add active_interests column to groups table (computed/denormalized for performance)
-- This will be updated via triggers or functions
ALTER TABLE groups
ADD COLUMN IF NOT EXISTS active_interests TEXT[] DEFAULT '{}';

-- Add active_interests column to users table (computed/denormalized for performance)
-- This will be updated via triggers or functions
ALTER TABLE users
ADD COLUMN IF NOT EXISTS active_interests TEXT[] DEFAULT '{}';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_group_interests_group_id ON group_interests(group_id);
CREATE INDEX IF NOT EXISTS idx_group_interests_interest_id ON group_interests(interest_id);
CREATE INDEX IF NOT EXISTS idx_user_interests_user_id ON user_interests(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interests_interest_id ON user_interests(interest_id);
CREATE INDEX IF NOT EXISTS idx_interests_name ON interests(name);

-- Insert the predefined interests
INSERT INTO interests (name, display_order) VALUES
  ('Personal Growth', 1),
  ('Wellness & Lifestyle', 2),
  ('Health & Fitness', 3),
  ('Career & Work', 4),
  ('Money & Wealth', 5),
  ('Pop Culture', 6),
  ('TV & Movies', 7),
  ('Music', 8),
  ('Books & Reading', 9),
  ('Celebrities & Creators', 10),
  ('Technology & Internet', 11),
  ('Entrepreneurship & Building', 12),
  ('News & What''s Happening', 13),
  ('Travel & Experiences', 14),
  ('Animals & Pets', 15),
  ('Games', 16),
  ('Art & Photography', 17),
  ('Food & Cooking', 18)
ON CONFLICT (name) DO NOTHING;

-- Create function to update group active_interests
CREATE OR REPLACE FUNCTION update_group_active_interests()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger to update group active_interests when group_interests changes
DROP TRIGGER IF EXISTS trigger_update_group_active_interests ON group_interests;
CREATE TRIGGER trigger_update_group_active_interests
  AFTER INSERT OR UPDATE OR DELETE ON group_interests
  FOR EACH ROW
  EXECUTE FUNCTION update_group_active_interests();

-- Create function to update user active_interests
CREATE OR REPLACE FUNCTION update_user_active_interests()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger to update user active_interests when user_interests changes
DROP TRIGGER IF EXISTS trigger_update_user_active_interests ON user_interests;
CREATE TRIGGER trigger_update_user_active_interests
  AFTER INSERT OR UPDATE OR DELETE ON user_interests
  FOR EACH ROW
  EXECUTE FUNCTION update_user_active_interests();

-- Create function to calculate total_active_groups and total_members for interests
-- This will be used in views or computed on-demand
CREATE OR REPLACE FUNCTION get_interest_stats(interest_id_param UUID)
RETURNS TABLE(total_active_groups BIGINT, total_members BIGINT) AS $$
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
$$ LANGUAGE plpgsql;

-- Add RLS policies
ALTER TABLE interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interests ENABLE ROW LEVEL SECURITY;

-- RLS policies for interests (read-only for authenticated users)
CREATE POLICY "Interests are viewable by authenticated users"
  ON interests FOR SELECT
  TO authenticated
  USING (true);

-- RLS policies for group_interests
CREATE POLICY "Users can view group interests for their groups"
  ON group_interests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_interests.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage interests for their groups"
  ON group_interests FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_interests.group_id
      AND group_members.user_id = auth.uid()
    )
  );

-- RLS policies for user_interests
CREATE POLICY "Users can view their own interests"
  ON user_interests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view interests of group members"
  ON user_interests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm1
      JOIN group_members gm2 ON gm1.group_id = gm2.group_id
      WHERE gm1.user_id = auth.uid()
      AND gm2.user_id = user_interests.user_id
    )
  );

CREATE POLICY "Users can manage their own interests"
  ON user_interests FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

