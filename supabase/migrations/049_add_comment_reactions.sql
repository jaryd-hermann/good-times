-- Create comment_reactions table
CREATE TABLE IF NOT EXISTS comment_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'heart',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment ON comment_reactions(comment_id);

-- Enable RLS
ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view all comment reactions
CREATE POLICY "Users can view comment reactions"
  ON comment_reactions FOR SELECT
  USING (true);

-- Users can insert their own comment reactions
CREATE POLICY "Users can insert their own comment reactions"
  ON comment_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own comment reactions
CREATE POLICY "Users can update their own comment reactions"
  ON comment_reactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own comment reactions
CREATE POLICY "Users can delete their own comment reactions"
  ON comment_reactions FOR DELETE
  USING (auth.uid() = user_id);

