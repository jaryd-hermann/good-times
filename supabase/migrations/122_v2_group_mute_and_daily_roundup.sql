-- =============================================================================
-- Per-group mute, with a 7pm local roundup in place of the live stream
-- (applied via MCP as v2_group_mute_and_daily_roundup +
--  v2_muted_roundup_counts_all_thread_activity)
-- =============================================================================
-- "Mute" in the group sheet was a dead toggle: local useState(false), never
-- persisted, never read by anything. It changed nothing.
--
-- Muting is per MEMBERSHIP, not per group — one person silencing a group must not
-- silence it for everyone else — so the flag lives on group_members.
--
-- Gating happens in v2_digest_add (covers new_answer / thread_message / reaction
-- in one place, so it cannot be forgotten at a call site) and in
-- v2_on_message_insert for the instant ones (reply, mention, birthday) which
-- bypass the digest.
--
-- The roundup counts ALL chat messages, including suppress_notify ones: that flag
-- governs whether an event raises its own push, and everything mirrored from v1 by
-- v2_sync_from_v1 carries it. Excluding them would under-report the whole
-- transition. Silent on days with no activity rather than sending "0 answers".
--
-- Verified in a rolled-back transaction: unmuted digest accepts an event (1),
-- muted drops it (0), and the roundup queues exactly one row with a correct body.
-- =============================================================================

ALTER TABLE public.group_members
  ADD COLUMN IF NOT EXISTS muted boolean NOT NULL DEFAULT false;

-- Function bodies live in the applied migrations; see:
--   v2_group_muted(user, group)
--   v2_digest_add            -- + mute gate
--   v2_on_message_insert     -- + mute gate on reply / mention / birthday
--   v2_queue_muted_roundup(p_local_hour default 19)

SELECT cron.schedule('v2-muted-roundup-local-7pm', '*/30 * * * *',
                     $$SELECT public.v2_queue_muted_roundup(19);$$);
