-- 130: unseen group chats sort to the top of the feed.
--
-- Both feeds ordered by last_activity alone. Answering one question into
-- several groups writes a message into each within the same few milliseconds,
-- so every card's last_activity is effectively identical and the resulting
-- order is arbitrary — groups with unread replies sat BELOW groups with none.
--
-- Two changes:
--   1. unread first, so "someone is waiting for you" outranks recency
--   2. g.name as a final tie-break, so cards with identical timestamps stop
--      reshuffling between refetches
--
-- Patched by rewriting only the ORDER BY of whatever is currently defined,
-- rather than re-emitting two long function bodies. These are ~60 lines each
-- and re-typing them to change one clause is how definitions silently drift.
DO $$
DECLARE
  v_fn text;
  v_def text;
  v_old constant text := 'ORDER BY g.last_activity DESC NULLS LAST';
  v_new constant text := 'ORDER BY (g.unread_count > 0) DESC, g.last_activity DESC NULLS LAST, g.name';
BEGIN
  FOREACH v_fn IN ARRAY ARRAY['v2_get_today_hub', 'v2_get_chat_list'] LOOP
    SELECT pg_get_functiondef(oid) INTO v_def
    FROM pg_proc
    WHERE proname = v_fn AND pronamespace = 'public'::regnamespace;

    IF v_def IS NULL THEN
      RAISE EXCEPTION 'migration 130: function % not found', v_fn;
    END IF;

    -- Re-run on an already-patched database: nothing to do. (v_new does not
    -- contain v_old as a substring, so this test is unambiguous.)
    IF position(v_new in v_def) > 0 THEN
      CONTINUE;
    END IF;

    -- Fail loudly rather than silently no-op if the source clause ever moves.
    IF position(v_old in v_def) = 0 THEN
      RAISE EXCEPTION 'migration 130: expected ORDER BY not found in %', v_fn;
    END IF;

    EXECUTE replace(v_def, v_old, v_new);
  END LOOP;
END $$;
