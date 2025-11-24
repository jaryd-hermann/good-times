-- Migration: Add inactivity notification system
-- Tracks when users haven't answered questions in a group for 3 consecutive days
-- Only sends notifications if user has been a member for at least 3 days

-- Create table to track inactivity notification logs (prevent duplicates)
CREATE TABLE IF NOT EXISTS inactivity_notification_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  last_sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, group_id)
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_inactivity_log_user_group ON inactivity_notification_log(user_id, group_id);
CREATE INDEX IF NOT EXISTS idx_inactivity_log_last_sent ON inactivity_notification_log(last_sent_at);

-- Enable RLS
ALTER TABLE inactivity_notification_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own notification logs
CREATE POLICY "Users can view own inactivity logs"
  ON inactivity_notification_log FOR SELECT
  USING (user_id = auth.uid());

-- RLS Policy: Service role can insert/update (for Edge Functions)
CREATE POLICY "Service role can manage inactivity logs"
  ON inactivity_notification_log FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add composite index for entries query performance (if not exists)
-- This helps with the "check if user has entries in last 3 days" query
CREATE INDEX IF NOT EXISTS idx_entries_user_group_date ON entries(user_id, group_id, date DESC);

-- Create helper function to get inactive users (optional - improves performance)
-- This function finds users who haven't answered in the last 3 days
CREATE OR REPLACE FUNCTION get_inactive_users(check_date_start DATE, check_date_end DATE)
RETURNS TABLE (
  user_id UUID,
  group_id UUID,
  joined_at TIMESTAMPTZ,
  group_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    gm.user_id,
    gm.group_id,
    gm.joined_at,
    g.name as group_name
  FROM group_members gm
  INNER JOIN groups g ON g.id = gm.group_id
  WHERE gm.joined_at <= check_date_start::TIMESTAMPTZ  -- Joined at least 3 days ago
    AND NOT EXISTS (
      -- User has no entries in the last 3 days for this group
      SELECT 1 FROM entries e
      WHERE e.user_id = gm.user_id
        AND e.group_id = gm.group_id
        AND e.date >= check_date_start
        AND e.date <= check_date_end
    )
    AND EXISTS (
      -- Group has prompts in the last 3 days
      SELECT 1 FROM daily_prompts dp
      WHERE dp.group_id = gm.group_id
        AND dp.date >= check_date_start
        AND dp.date <= check_date_end
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

