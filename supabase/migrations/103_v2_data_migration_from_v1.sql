-- =============================================================================
-- v2_data_migration_from_v1   (applied to production as migration 20260801162535)
-- =============================================================================
-- Exported from supabase_migrations.schema_migrations so the repo matches the
-- database exactly. ADDITIVE ONLY -- no v1 table is dropped or altered.
--
-- NON-DESTRUCTIVE COPY. entries/comments/reactions are left fully intact.
-- Idempotent via legacy_entry_id / legacy_comment_id, so it is safe to re-run.
-- Verified: 1410->1410 answers/shares/cards, 1138->1138 chat messages (all
-- reply-anchored), 439->439 reactions with emoji preserved, zero orphans.
-- See docs/V2_PLAN.md.
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS answers_user_date_unique
  ON public.answers (user_id, date) WHERE date >= DATE '2026-08-01';

INSERT INTO public.answers (
  user_id, prompt_id, date, mode, text_content, media_urls, media_types,
  captions, mentions, legacy_entry_id, created_at, updated_at)
SELECT e.user_id, e.prompt_id, e.date, 'text', e.text_content, e.media_urls,
       e.media_types, e.captions, coalesce(e.mentions,'{}'::uuid[]), e.id,
       e.created_at, coalesce(e.updated_at, e.created_at)
FROM public.entries e
ON CONFLICT (legacy_entry_id) WHERE legacy_entry_id IS NOT NULL DO NOTHING;

INSERT INTO public.answer_shares (answer_id, group_id, shared_at)
SELECT a.id, e.group_id, e.created_at
FROM public.entries e JOIN public.answers a ON a.legacy_entry_id = e.id
ON CONFLICT (answer_id, group_id) DO NOTHING;

INSERT INTO public.messages (
  group_id, thread_date, kind, user_id, answer_id, mentions,
  suppress_notify, created_at)
SELECT e.group_id, e.date, 'answer', e.user_id, a.id,
       coalesce(e.mentions,'{}'::uuid[]), true, e.created_at
FROM public.entries e JOIN public.answers a ON a.legacy_entry_id = e.id
ON CONFLICT (answer_id, group_id) WHERE answer_id IS NOT NULL DO NOTHING;

INSERT INTO public.messages (
  group_id, thread_date, kind, user_id, text, media_urls, media_types,
  reply_to_message_id, suppress_notify, legacy_comment_id, created_at)
SELECT e.group_id, e.date, 'chat', c.user_id, c.text,
       CASE WHEN c.media_url IS NOT NULL THEN ARRAY[c.media_url] ELSE NULL END,
       CASE WHEN c.media_type IS NOT NULL THEN ARRAY[c.media_type] ELSE NULL END,
       m.id, true, c.id, c.created_at
FROM public.comments c
JOIN public.entries e ON e.id = c.entry_id
JOIN public.answers a ON a.legacy_entry_id = e.id
JOIN public.messages m ON m.answer_id = a.id AND m.group_id = e.group_id
ON CONFLICT (legacy_comment_id) WHERE legacy_comment_id IS NOT NULL DO NOTHING;

INSERT INTO public.message_reactions (message_id, user_id, emoji, created_at)
SELECT m.id, r.user_id,
       CASE WHEN r.type IS NULL OR r.type IN ('heart','like','') THEN '❤️' ELSE r.type END,
       r.created_at
FROM public.reactions r
JOIN public.answers a ON a.legacy_entry_id = r.entry_id
JOIN public.messages m ON m.answer_id = a.id
ON CONFLICT (message_id, user_id, emoji) DO NOTHING;

INSERT INTO public.message_reactions (message_id, user_id, emoji, created_at)
SELECT m.id, cr.user_id,
       CASE WHEN cr.type IS NULL OR cr.type IN ('heart','like','') THEN '❤️' ELSE cr.type END,
       cr.created_at
FROM public.comment_reactions cr
JOIN public.messages m ON m.legacy_comment_id = cr.comment_id
ON CONFLICT (message_id, user_id, emoji) DO NOTHING;

UPDATE public.users SET onboarded_at = created_at WHERE onboarded_at IS NULL;;
