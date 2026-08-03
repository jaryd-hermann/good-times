-- =============================================================================
-- Keep v2 in sync with v1 writes until every user has upgraded
-- =============================================================================
-- Migration 103 copied v1 into the v2 tables once. It has no ongoing counterpart:
-- there is no trigger on `entries`, so anything a v1 user posts between that
-- migration and the day they install v2 is invisible in v2 — their own history
-- included. This runs 103's logic continuously.
--
-- Differences from 103, both forced by the v2 data model:
--
--  * v1 stored one entry PER GROUP per day; v2 stores one answer per user per day
--    fanned out through answer_shares. answers_user_date_unique enforces that for
--    date >= 2026-08-01, so a straight per-entry insert would raise as soon as
--    somebody posted to two groups on one day. The answers insert therefore takes
--    the earliest entry per (user, date), and answer_shares links EVERY entry's
--    group to that single answer — which is exactly the v2 shape.
--
--  * joins are on (user_id, date) rather than legacy_entry_id, so the second and
--    later groups of a day still get their share and their thread message.
--
-- Scoped to the v2 era (date >= 2026-08-01). Older stragglers are not expected —
-- 103 covered all history — and migration 103 is itself idempotent if any appear.
--
-- suppress_notify is true on every message, as in 103: v1's own on_new_entry
-- trigger already queues a notification for these posts, and both v1 and v2 drain
-- the same notification_queue, so notifying again here would double-send.
--
-- Verified against production in a rolled-back transaction:
--   * first run picked up the 3 outstanding entries, second run returned all
--     zeros (idempotent)
--   * every synced answer reachable from a group thread (0 orphans)
--   * 0 synced messages notifiable
--   * the two-groups-in-one-day case yields 1 answer, 2 shares, 2 thread
--     messages rather than a unique violation
-- =============================================================================

CREATE OR REPLACE FUNCTION public.v2_sync_from_v1()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_cutoff CONSTANT date := DATE '2026-08-01';
  v_answers int; v_shares int; v_answer_msgs int; v_chat_msgs int;
  v_reactions int; v_comment_reactions int;
BEGIN
  -- 1. One answer per (user, date): the earliest entry of that day wins.
  INSERT INTO public.answers (
    user_id, prompt_id, date, mode, text_content, media_urls, media_types,
    captions, mentions, legacy_entry_id, created_at, updated_at)
  SELECT DISTINCT ON (e.user_id, e.date)
    e.user_id, e.prompt_id, e.date, 'text', e.text_content, e.media_urls,
    e.media_types, e.captions, coalesce(e.mentions, '{}'::uuid[]), e.id,
    e.created_at, coalesce(e.updated_at, e.created_at)
  FROM public.entries e
  WHERE e.date >= v_cutoff
    AND NOT EXISTS (SELECT 1 FROM public.answers a WHERE a.legacy_entry_id = e.id)
    -- Already answered that day (either from v2 directly, or from an earlier
    -- entry in this same run). Its groups are still picked up by step 2.
    AND NOT EXISTS (
      SELECT 1 FROM public.answers a2
      WHERE a2.user_id = e.user_id AND a2.date = e.date)
  ORDER BY e.user_id, e.date, e.created_at
  ON CONFLICT (legacy_entry_id) WHERE legacy_entry_id IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_answers = ROW_COUNT;

  -- 2. Every group the user posted to that day becomes a share of that answer.
  INSERT INTO public.answer_shares (answer_id, group_id, shared_at)
  SELECT a.id, e.group_id, e.created_at
  FROM public.entries e
  JOIN public.answers a ON a.user_id = e.user_id AND a.date = e.date
  WHERE e.date >= v_cutoff
  ON CONFLICT (answer_id, group_id) DO NOTHING;
  GET DIAGNOSTICS v_shares = ROW_COUNT;

  -- 3. The answer's message in each of those group threads.
  INSERT INTO public.messages (
    group_id, thread_date, kind, user_id, answer_id, mentions,
    suppress_notify, created_at)
  SELECT e.group_id, e.date, 'answer', e.user_id, a.id,
         coalesce(e.mentions, '{}'::uuid[]), true, e.created_at
  FROM public.entries e
  JOIN public.answers a ON a.user_id = e.user_id AND a.date = e.date
  WHERE e.date >= v_cutoff
  ON CONFLICT (answer_id, group_id) WHERE answer_id IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_answer_msgs = ROW_COUNT;

  -- 4. v1 comments become chat messages anchored to that answer message.
  INSERT INTO public.messages (
    group_id, thread_date, kind, user_id, text, media_urls, media_types,
    reply_to_message_id, suppress_notify, legacy_comment_id, created_at)
  SELECT e.group_id, e.date, 'chat', c.user_id, c.text,
         CASE WHEN c.media_url IS NOT NULL THEN ARRAY[c.media_url] ELSE NULL END,
         CASE WHEN c.media_type IS NOT NULL THEN ARRAY[c.media_type] ELSE NULL END,
         m.id, true, c.id, c.created_at
  FROM public.comments c
  JOIN public.entries e ON e.id = c.entry_id
  JOIN public.answers a ON a.user_id = e.user_id AND a.date = e.date
  JOIN public.messages m ON m.answer_id = a.id AND m.group_id = e.group_id
  WHERE e.date >= v_cutoff
  ON CONFLICT (legacy_comment_id) WHERE legacy_comment_id IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_chat_msgs = ROW_COUNT;

  -- 5. Reactions on the entry itself.
  INSERT INTO public.message_reactions (message_id, user_id, emoji, created_at)
  SELECT m.id, r.user_id,
         CASE WHEN r.type IS NULL OR r.type IN ('heart','like','') THEN '❤️' ELSE r.type END,
         r.created_at
  FROM public.reactions r
  JOIN public.entries e ON e.id = r.entry_id
  JOIN public.answers a ON a.user_id = e.user_id AND a.date = e.date
  JOIN public.messages m ON m.answer_id = a.id AND m.group_id = e.group_id
  WHERE e.date >= v_cutoff
  ON CONFLICT (message_id, user_id, emoji) DO NOTHING;
  GET DIAGNOSTICS v_reactions = ROW_COUNT;

  -- 6. Reactions on comments, keyed off the legacy id set in step 4.
  INSERT INTO public.message_reactions (message_id, user_id, emoji, created_at)
  SELECT m.id, cr.user_id,
         CASE WHEN cr.type IS NULL OR cr.type IN ('heart','like','') THEN '❤️' ELSE cr.type END,
         cr.created_at
  FROM public.comment_reactions cr
  JOIN public.messages m ON m.legacy_comment_id = cr.comment_id
  ON CONFLICT (message_id, user_id, emoji) DO NOTHING;
  GET DIAGNOSTICS v_comment_reactions = ROW_COUNT;

  RETURN jsonb_build_object(
    'answers', v_answers, 'shares', v_shares, 'answer_messages', v_answer_msgs,
    'chat_messages', v_chat_msgs, 'reactions', v_reactions,
    'comment_reactions', v_comment_reactions);
END $function$;
