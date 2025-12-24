-- Migration: Fix groups with more than 3 active decks
-- Removes decks that have all questions remaining (6 questions left) to satisfy the 3-deck limit

-- Function to calculate questions left for a deck
-- A deck has "6 questions left" if it has 6 total questions and 0 have been asked
CREATE OR REPLACE FUNCTION get_deck_questions_left(group_id_param UUID, deck_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
  total_questions INTEGER;
  asked_count INTEGER;
BEGIN
  -- Get total questions in deck
  SELECT COUNT(*) INTO total_questions
  FROM prompts
  WHERE deck_id = deck_id_param
    AND deck_id IS NOT NULL;

  -- Get questions asked for this group
  SELECT COUNT(DISTINCT prompt_id) INTO asked_count
  FROM daily_prompts
  WHERE group_id = group_id_param
    AND deck_id = deck_id_param
    AND user_id IS NULL; -- Only count general prompts

  RETURN GREATEST(0, total_questions - asked_count);
END;
$$ LANGUAGE plpgsql;

-- Fix groups with more than 3 active decks
-- For each group with more than 3 active decks:
-- 1. Keep the 3 most recently activated decks
-- 2. For the rest, if they have 6 questions left (all questions remaining), remove them
-- 3. If they have fewer than 6 questions left, mark them as "finished" instead
DO $$
DECLARE
  group_record RECORD;
  active_deck_record RECORD;
  active_decks_count INTEGER;
  questions_left INTEGER;
  decks_to_remove UUID[];
  decks_to_finish UUID[];
BEGIN
  -- Find all groups with more than 3 active decks
  FOR group_record IN
    SELECT DISTINCT group_id
    FROM group_active_decks
    WHERE status = 'active'
    GROUP BY group_id
    HAVING COUNT(*) > 3
  LOOP
    RAISE NOTICE 'Processing group % with more than 3 active decks', group_record.group_id;

    -- Get all active decks for this group, ordered by activated_at (most recent first)
    -- Keep the 3 most recently activated
    decks_to_remove := ARRAY[]::UUID[];
    decks_to_finish := ARRAY[]::UUID[];

    FOR active_deck_record IN
      SELECT id, deck_id, activated_at
      FROM group_active_decks
      WHERE group_id = group_record.group_id
        AND status = 'active'
      ORDER BY 
        CASE WHEN activated_at IS NOT NULL THEN activated_at ELSE created_at END DESC
      OFFSET 3  -- Skip the first 3 (most recent)
    LOOP
      -- Calculate questions left for this deck
      questions_left := get_deck_questions_left(group_record.group_id, active_deck_record.deck_id);

      IF questions_left = 6 THEN
        -- Deck has all questions remaining - remove it
        decks_to_remove := array_append(decks_to_remove, active_deck_record.id);
        RAISE NOTICE '  Removing deck % (6 questions left)', active_deck_record.deck_id;
      ELSE
        -- Deck has been started - mark as finished instead
        decks_to_finish := array_append(decks_to_finish, active_deck_record.id);
        RAISE NOTICE '  Finishing deck % (% questions left)', active_deck_record.deck_id, questions_left;
      END IF;
    END LOOP;

    -- Remove decks with 6 questions left
    IF array_length(decks_to_remove, 1) > 0 THEN
      DELETE FROM group_active_decks
      WHERE id = ANY(decks_to_remove);
      RAISE NOTICE '  Removed % decks', array_length(decks_to_remove, 1);
    END IF;

    -- Mark started decks as finished
    IF array_length(decks_to_finish, 1) > 0 THEN
      UPDATE group_active_decks
      SET status = 'finished',
          finished_at = NOW()
      WHERE id = ANY(decks_to_finish);
      RAISE NOTICE '  Finished % decks', array_length(decks_to_finish, 1);
    END IF;
  END LOOP;
END $$;

-- Clean up the temporary function
DROP FUNCTION IF EXISTS get_deck_questions_left(UUID, UUID);

