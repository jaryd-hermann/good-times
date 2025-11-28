-- Migration: Add Birthday Cards Feature
-- Enables group members to write private birthday cards for each other

-- 1. birthday_cards table
CREATE TABLE birthday_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  birthday_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  birthday_date DATE NOT NULL,
  birthday_year INTEGER NOT NULL, -- Year of this birthday (for age calculation)
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'public')) DEFAULT 'draft',
  is_public BOOLEAN DEFAULT false, -- Whether card is visible in group history
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ, -- When card was published (12 hours before birthday)
  UNIQUE(group_id, birthday_user_id, birthday_date) -- One card per user per birthday
);

-- 2. birthday_card_entries table
CREATE TABLE birthday_card_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES birthday_cards(id) ON DELETE CASCADE,
  contributor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text_content TEXT,
  media_urls TEXT[],
  media_types TEXT[],
  embedded_media JSONB, -- Same structure as entries.embedded_media
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(card_id, contributor_user_id) -- One entry per contributor per card
);

-- 3. birthday_card_notifications table
CREATE TABLE birthday_card_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES birthday_cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('initial', 'reminder')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(card_id, user_id, notification_type)
);

-- 4. Indexes
CREATE INDEX idx_birthday_cards_group ON birthday_cards(group_id);
CREATE INDEX idx_birthday_cards_birthday_user ON birthday_cards(birthday_user_id);
CREATE INDEX idx_birthday_cards_birthday_date ON birthday_cards(birthday_date);
CREATE INDEX idx_birthday_cards_status ON birthday_cards(status);
CREATE INDEX idx_birthday_cards_birthday_user_date ON birthday_cards(birthday_user_id, birthday_date);

CREATE INDEX idx_birthday_card_entries_card ON birthday_card_entries(card_id);
CREATE INDEX idx_birthday_card_entries_contributor ON birthday_card_entries(contributor_user_id);
CREATE INDEX idx_birthday_card_entries_created ON birthday_card_entries(created_at);

CREATE INDEX idx_birthday_card_notifications_card ON birthday_card_notifications(card_id);
CREATE INDEX idx_birthday_card_notifications_user ON birthday_card_notifications(user_id);
CREATE INDEX idx_birthday_card_notifications_type ON birthday_card_notifications(notification_type);

-- 5. Enable RLS
ALTER TABLE birthday_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE birthday_card_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE birthday_card_notifications ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for birthday_cards
CREATE POLICY "Group members can view birthday cards"
  ON birthday_cards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = birthday_cards.group_id
      AND group_members.user_id = auth.uid()
    )
  );

-- 7. RLS Policies for birthday_card_entries
CREATE POLICY "Contributors can view their entries"
  ON birthday_card_entries FOR SELECT
  USING (
    contributor_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM birthday_cards
      WHERE birthday_cards.id = birthday_card_entries.card_id
      AND birthday_cards.birthday_user_id = auth.uid()
    )
  );

CREATE POLICY "Contributors can insert entries"
  ON birthday_card_entries FOR INSERT
  WITH CHECK (
    contributor_user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM birthday_cards
      WHERE birthday_cards.id = birthday_card_entries.card_id
      AND birthday_cards.status = 'draft'
    )
  );

CREATE POLICY "Contributors can update their entries"
  ON birthday_card_entries FOR UPDATE
  USING (contributor_user_id = auth.uid())
  WITH CHECK (contributor_user_id = auth.uid());

-- Service role can update card status (for Edge Functions)
CREATE POLICY "Service role can update birthday cards"
  ON birthday_cards FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Birthday person can make their card public
CREATE POLICY "Birthday person can make card public"
  ON birthday_cards FOR UPDATE
  USING (birthday_user_id = auth.uid())
  WITH CHECK (birthday_user_id = auth.uid());

-- 8. RLS Policies for birthday_card_notifications
CREATE POLICY "Users can view their notifications"
  ON birthday_card_notifications FOR SELECT
  USING (user_id = auth.uid());

-- Service role can insert notifications (for Edge Functions)
CREATE POLICY "Service role can insert notifications"
  ON birthday_card_notifications FOR INSERT
  WITH CHECK (true);

-- 9. Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_birthday_card_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_birthday_card_entries_updated_at
    BEFORE UPDATE ON birthday_card_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_birthday_card_entries_updated_at();

-- 10. Comments for documentation
COMMENT ON TABLE birthday_cards IS 'Tracks birthday card metadata and status. One card per user per birthday per group.';
COMMENT ON TABLE birthday_card_entries IS 'Individual contributions to birthday cards. One entry per contributor per card.';
COMMENT ON TABLE birthday_card_notifications IS 'Tracks notification status for birthday card contributors.';
COMMENT ON COLUMN birthday_cards.birthday_year IS 'Year of this specific birthday (for age calculation)';
COMMENT ON COLUMN birthday_cards.status IS 'Card status: draft (being written), published (ready to view), public (visible in group history)';
COMMENT ON COLUMN birthday_cards.published_at IS 'Timestamp when card was published (12 hours before birthday)';

