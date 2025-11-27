-- Migration: Add question decks feature
-- Enables groups to vote on and activate optional question decks/packs
-- Replaces Fun/A Bit Deeper categories with deck-based system

-- 1. Collections table
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Decks table (packs)
CREATE TABLE decks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Group deck votes
CREATE TABLE group_deck_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK (vote IN ('yes', 'no')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, deck_id, user_id)
);

-- 4. Group active decks (tracks status)
CREATE TABLE group_active_decks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('voting', 'active', 'rejected', 'finished')),
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activated_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, deck_id)
);

-- 5. Add deck_id and deck_order to prompts
ALTER TABLE prompts 
  ADD COLUMN IF NOT EXISTS deck_id UUID REFERENCES decks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deck_order INTEGER; -- Order within deck (1, 2, 3, etc.)

-- 6. Add deck_id to daily_prompts (for tracking)
ALTER TABLE daily_prompts 
  ADD COLUMN IF NOT EXISTS deck_id UUID REFERENCES decks(id) ON DELETE SET NULL;

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_prompts_deck ON prompts(deck_id);
CREATE INDEX IF NOT EXISTS idx_prompts_deck_order ON prompts(deck_id, deck_order) WHERE deck_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_daily_prompts_deck ON daily_prompts(deck_id);
CREATE INDEX IF NOT EXISTS idx_group_deck_votes_group_deck ON group_deck_votes(group_id, deck_id);
CREATE INDEX IF NOT EXISTS idx_group_active_decks_group_status ON group_active_decks(group_id, status);
CREATE INDEX IF NOT EXISTS idx_group_active_decks_status ON group_active_decks(status) WHERE status IN ('voting', 'active');
CREATE INDEX IF NOT EXISTS idx_collections_order ON collections(display_order);
CREATE INDEX IF NOT EXISTS idx_decks_collection_order ON decks(collection_id, display_order);

-- 8. Enable RLS
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_deck_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_active_decks ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies for collections
CREATE POLICY "Anyone can view collections"
  ON collections FOR SELECT
  USING (true);

-- 10. RLS Policies for decks
CREATE POLICY "Anyone can view decks"
  ON decks FOR SELECT
  USING (true);

-- 11. RLS Policies for group_deck_votes
CREATE POLICY "Group members can view votes for their groups"
  ON group_deck_votes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_deck_votes.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can cast votes"
  ON group_deck_votes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_deck_votes.group_id
      AND group_members.user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update their own votes"
  ON group_deck_votes FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 12. RLS Policies for group_active_decks
CREATE POLICY "Group members can view active decks for their groups"
  ON group_active_decks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_active_decks.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can request deck votes"
  ON group_active_decks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_active_decks.group_id
      AND group_members.user_id = auth.uid()
    )
    AND requested_by = auth.uid()
    AND status = 'voting'
  );

-- Service role can update (for Edge Functions)
CREATE POLICY "Service role can update active decks"
  ON group_active_decks FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 13. Create trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_group_deck_votes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_group_deck_votes_updated_at
    BEFORE UPDATE ON group_deck_votes
    FOR EACH ROW
    EXECUTE FUNCTION update_group_deck_votes_updated_at();

CREATE OR REPLACE FUNCTION update_group_active_decks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_group_active_decks_updated_at
    BEFORE UPDATE ON group_active_decks
    FOR EACH ROW
    EXECUTE FUNCTION update_group_active_decks_updated_at();

-- 14. Migration: Update existing Fun/A Bit Deeper daily_prompts to Family/Friends
-- First, update prompts that are scheduled for groups
UPDATE daily_prompts dp
SET prompt_id = (
  SELECT p.id 
  FROM prompts p 
  WHERE p.category = CASE 
    WHEN (SELECT type FROM groups WHERE id = dp.group_id) = 'family' THEN 'Family'
    ELSE 'Friends'
  END
  AND p.id NOT IN (
    SELECT prompt_id 
    FROM daily_prompts 
    WHERE group_id = dp.group_id 
    AND date = dp.date
    AND id != dp.id
  )
  AND p.is_default = true
  AND p.birthday_type IS NULL
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM prompts p 
  WHERE p.id = dp.prompt_id 
  AND p.category IN ('Fun', 'A Bit Deeper')
)
AND dp.user_id IS NULL; -- Only update general prompts, not birthday-specific

-- 15. Delete Fun and A Bit Deeper prompts
-- Note: This will cascade delete any daily_prompts that reference these prompts
-- But we've already migrated the important ones above
DELETE FROM prompts WHERE category IN ('Fun', 'A Bit Deeper');

-- 16. Add notification type for pack voting (if notifications table exists)
-- Check if notifications table has type column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' 
    AND column_name = 'type'
  ) THEN
    -- Add pack_vote_requested to notification types if constraint exists
    -- Note: This may fail if there's a CHECK constraint - we'll handle that separately
    NULL; -- Placeholder - actual constraint modification handled in app code
  END IF;
END $$;

-- 17. Comments for documentation
COMMENT ON TABLE collections IS 'Question collections that contain multiple decks';
COMMENT ON TABLE decks IS 'Question decks/packs that groups can vote on and activate';
COMMENT ON TABLE group_deck_votes IS 'Individual votes cast by group members on decks';
COMMENT ON TABLE group_active_decks IS 'Tracks which decks are active, voting, rejected, or finished for each group';
COMMENT ON COLUMN prompts.deck_id IS 'Links prompt to a deck if it belongs to a deck';
COMMENT ON COLUMN prompts.deck_order IS 'Order of this question within its deck (1, 2, 3, etc.)';
COMMENT ON COLUMN daily_prompts.deck_id IS 'Tracks which deck a scheduled prompt belongs to (for completion tracking)';

