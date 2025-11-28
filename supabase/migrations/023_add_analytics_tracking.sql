-- Migration: Add Analytics and Tracking Tables
-- Tracks prompt usage, birthday card views, and deck activations

-- 1. Prompt Usage Statistics Table
-- Tracks how many times prompts are "asked" (based on group size) and answered
CREATE TABLE prompt_usage_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  group_size_at_time INTEGER NOT NULL, -- Number of members when prompt was scheduled
  answers_count INTEGER DEFAULT 0, -- Number of actual answers (updated via batch function)
  daily_prompt_id UUID REFERENCES daily_prompts(id) ON DELETE CASCADE, -- Link to the daily_prompt record
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(daily_prompt_id) -- One stat record per daily_prompt
);

-- Index for efficient queries
CREATE INDEX idx_prompt_usage_stats_prompt ON prompt_usage_stats(prompt_id);
CREATE INDEX idx_prompt_usage_stats_group ON prompt_usage_stats(group_id);
CREATE INDEX idx_prompt_usage_stats_date ON prompt_usage_stats(date);
CREATE INDEX idx_prompt_usage_stats_prompt_date ON prompt_usage_stats(prompt_id, date);

-- 2. Birthday Card Views Table
-- Tracks when users view/open their birthday cards
CREATE TABLE birthday_card_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES birthday_cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(card_id, user_id) -- One view record per user per card
);

-- Index for efficient queries
CREATE INDEX idx_birthday_card_views_card ON birthday_card_views(card_id);
CREATE INDEX idx_birthday_card_views_user ON birthday_card_views(user_id);
CREATE INDEX idx_birthday_card_views_viewed_at ON birthday_card_views(viewed_at);

-- 3. Deck Activation Tracking Table
-- Tracks when decks are activated by groups (for counting unique group activations)
CREATE TABLE deck_activations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  group_active_deck_id UUID REFERENCES group_active_decks(id) ON DELETE SET NULL, -- Link to group_active_decks
  UNIQUE(deck_id, group_id) -- One activation record per deck per group
);

-- Index for efficient queries
CREATE INDEX idx_deck_activations_deck ON deck_activations(deck_id);
CREATE INDEX idx_deck_activations_group ON deck_activations(group_id);
CREATE INDEX idx_deck_activations_activated_at ON deck_activations(activated_at);

-- 4. Enable RLS
ALTER TABLE prompt_usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE birthday_card_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE deck_activations ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for prompt_usage_stats
-- Service role can insert/update (for Edge Functions and triggers)
CREATE POLICY "Service role can manage prompt stats"
  ON prompt_usage_stats FOR ALL
  USING (true)
  WITH CHECK (true);

-- Group members can view stats for their groups
CREATE POLICY "Group members can view prompt stats"
  ON prompt_usage_stats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = prompt_usage_stats.group_id
      AND group_members.user_id = auth.uid()
    )
  );

-- 6. RLS Policies for birthday_card_views
-- Users can view their own card views
CREATE POLICY "Users can view their card views"
  ON birthday_card_views FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert when they view their own card
CREATE POLICY "Users can track their card views"
  ON birthday_card_views FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM birthday_cards
      WHERE birthday_cards.id = birthday_card_views.card_id
      AND birthday_cards.birthday_user_id = auth.uid()
    )
  );

-- Service role can insert (for Edge Functions)
CREATE POLICY "Service role can track card views"
  ON birthday_card_views FOR INSERT
  WITH CHECK (true);

-- 7. RLS Policies for deck_activations
-- Group members can view activations for their groups
CREATE POLICY "Group members can view deck activations"
  ON deck_activations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = deck_activations.group_id
      AND group_members.user_id = auth.uid()
    )
  );

-- Service role can insert (for Edge Functions/triggers)
CREATE POLICY "Service role can track deck activations"
  ON deck_activations FOR INSERT
  WITH CHECK (true);

-- 8. Batch update function for answer counts
-- This function recalculates answer counts for all prompt_usage_stats
-- Should be called periodically (e.g., via cron job every hour or daily)
CREATE OR REPLACE FUNCTION batch_update_prompt_answer_counts()
RETURNS void AS $$
BEGIN
  UPDATE prompt_usage_stats pus
  SET answers_count = (
    SELECT COUNT(*)
    FROM entries e
    WHERE e.group_id = pus.group_id
    AND e.date = pus.date
    AND e.prompt_id = pus.prompt_id
  ),
  updated_at = NOW()
  WHERE pus.daily_prompt_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- 9. Trigger: Create prompt_usage_stats when daily_prompt is created
CREATE OR REPLACE FUNCTION create_prompt_usage_stat()
RETURNS TRIGGER AS $$
DECLARE
  member_count INTEGER;
BEGIN
  -- Get group size at the time of prompt scheduling
  SELECT COUNT(*) INTO member_count
  FROM group_members
  WHERE group_id = NEW.group_id;
  
  -- Create prompt usage stat record
  INSERT INTO prompt_usage_stats (
    prompt_id,
    group_id,
    date,
    group_size_at_time,
    daily_prompt_id,
    answers_count
  ) VALUES (
    NEW.prompt_id,
    NEW.group_id,
    NEW.date,
    member_count,
    NEW.id,
    0 -- Will be updated by batch_update_prompt_answer_counts() function
  )
  ON CONFLICT (daily_prompt_id) DO NOTHING; -- Prevent duplicates
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_prompt_usage_stat_on_daily_prompt
  AFTER INSERT ON daily_prompts
  FOR EACH ROW
  EXECUTE FUNCTION create_prompt_usage_stat();

-- 10. Trigger: Track deck activation when status changes to 'active'
CREATE OR REPLACE FUNCTION track_deck_activation()
RETURNS TRIGGER AS $$
BEGIN
  -- When a deck status changes to 'active', create an activation record
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    INSERT INTO deck_activations (
      deck_id,
      group_id,
      activated_at,
      group_active_deck_id
    ) VALUES (
      NEW.deck_id,
      NEW.group_id,
      COALESCE(NEW.activated_at, NOW()),
      NEW.id
    )
    ON CONFLICT (deck_id, group_id) DO NOTHING; -- Prevent duplicates
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_deck_activation_on_status_change
  AFTER INSERT OR UPDATE ON group_active_decks
  FOR EACH ROW
  EXECUTE FUNCTION track_deck_activation();

-- 11. Backfill existing data (optional - for historical tracking)
-- Backfill prompt_usage_stats for existing daily_prompts
INSERT INTO prompt_usage_stats (
  prompt_id,
  group_id,
  date,
  group_size_at_time,
  daily_prompt_id,
  answers_count
)
SELECT 
  dp.prompt_id,
  dp.group_id,
  dp.date,
  (
    SELECT COUNT(*) 
    FROM group_members 
    WHERE group_id = dp.group_id
  ) as group_size_at_time,
  dp.id as daily_prompt_id,
  (
    SELECT COUNT(*) 
    FROM entries 
    WHERE group_id = dp.group_id 
    AND date = dp.date 
    AND prompt_id = dp.prompt_id
  ) as answers_count
FROM daily_prompts dp
WHERE dp.date >= CURRENT_DATE - INTERVAL '30 days' -- Only backfill recent data
ON CONFLICT (daily_prompt_id) DO NOTHING;

-- Backfill deck_activations for existing active decks
INSERT INTO deck_activations (
  deck_id,
  group_id,
  activated_at,
  group_active_deck_id
)
SELECT 
  gad.deck_id,
  gad.group_id,
  COALESCE(gad.activated_at, gad.created_at),
  gad.id
FROM group_active_decks gad
WHERE gad.status = 'active'
ON CONFLICT (deck_id, group_id) DO NOTHING;

-- 12. Helper function: Track birthday card view (call from Edge Function or app)
-- This is the recommended way to track views - more reliable than client-side
CREATE OR REPLACE FUNCTION track_birthday_card_view(card_uuid UUID, user_uuid UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO birthday_card_views (card_id, user_id, viewed_at)
  VALUES (card_uuid, user_uuid, NOW())
  ON CONFLICT (card_id, user_id) DO UPDATE
  SET viewed_at = NOW(); -- Update timestamp if already viewed
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Helper function: Get prompt answer rate
CREATE OR REPLACE FUNCTION get_prompt_answer_rate(prompt_uuid UUID)
RETURNS TABLE (
  total_asks BIGINT,
  total_answers BIGINT,
  answer_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    SUM(pus.group_size_at_time)::BIGINT as total_asks,
    SUM(pus.answers_count)::BIGINT as total_answers,
    CASE 
      WHEN SUM(pus.group_size_at_time) > 0 THEN
        ROUND((SUM(pus.answers_count)::NUMERIC / SUM(pus.group_size_at_time)::NUMERIC) * 100, 2)
      ELSE 0
    END as answer_rate
  FROM prompt_usage_stats pus
  WHERE pus.prompt_id = prompt_uuid;
END;
$$ LANGUAGE plpgsql;

-- 14. Helper function: Get deck activation count
CREATE OR REPLACE FUNCTION get_deck_activation_count(deck_uuid UUID)
RETURNS BIGINT AS $$
BEGIN
  RETURN (
    SELECT COUNT(DISTINCT group_id)
    FROM deck_activations
    WHERE deck_id = deck_uuid
  );
END;
$$ LANGUAGE plpgsql;

-- 15. Cron job to batch update answer counts (runs hourly)
-- This runs directly in the database, no Edge Function needed
SELECT cron.schedule(
  'batch-update-prompt-answer-counts',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT batch_update_prompt_answer_counts();
  $$
);

-- 16. Comments for documentation
COMMENT ON TABLE prompt_usage_stats IS 'Tracks prompt usage: how many times prompts are asked (group size) and answered';
COMMENT ON TABLE birthday_card_views IS 'Tracks when users view/open their birthday cards';
COMMENT ON TABLE deck_activations IS 'Tracks deck activations by groups for counting unique group activations per deck';
COMMENT ON COLUMN prompt_usage_stats.group_size_at_time IS 'Number of group members when prompt was scheduled (represents potential answers)';
COMMENT ON COLUMN prompt_usage_stats.answers_count IS 'Actual number of answers submitted (updated via batch_update_prompt_answer_counts() function, runs hourly)';
COMMENT ON FUNCTION batch_update_prompt_answer_counts IS 'Recalculates answer counts for all prompt usage stats. Should be called periodically via cron job.';
COMMENT ON FUNCTION track_birthday_card_view IS 'Tracks when a user views their birthday card. Call from Edge Function or app when card details page is opened.';
COMMENT ON FUNCTION get_prompt_answer_rate IS 'Returns total asks, answers, and answer rate percentage for a prompt';
COMMENT ON FUNCTION get_deck_activation_count IS 'Returns count of unique groups that have activated a deck';

