-- =============================================================================
-- v2_core_tables   (applied to production as migration 20260801162428)
-- =============================================================================
-- Exported from supabase_migrations.schema_migrations so the repo matches the
-- database exactly. ADDITIVE ONLY -- no v1 table is dropped or altered.
-- See docs/V2_PLAN.md.
-- =============================================================================

-- V2 core: answers, shares, threads, reactions, read state, share links.
-- ADDITIVE ONLY. entries/comments/reactions remain untouched and authoritative
-- for v1 until the cutover.

CREATE TABLE IF NOT EXISTS public.answers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  prompt_id    uuid NOT NULL REFERENCES public.prompts(id) ON DELETE RESTRICT,
  date         date NOT NULL,
  mode         text NOT NULL DEFAULT 'text' CHECK (mode IN ('video','voice','text')),
  text_content text,
  transcript   text,
  media_urls   text[],
  media_types  text[],
  captions     text[],
  mentions     uuid[] DEFAULT '{}'::uuid[],
  legacy_entry_id uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_answers_user_date ON public.answers (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_answers_date ON public.answers (date);
CREATE INDEX IF NOT EXISTS idx_answers_prompt ON public.answers (prompt_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_answers_legacy_entry ON public.answers (legacy_entry_id) WHERE legacy_entry_id IS NOT NULL;
COMMENT ON COLUMN public.answers.legacy_entry_id IS 'v1 entries.id this row was migrated from. Migration idempotency key; drop after cutover.';

CREATE TABLE IF NOT EXISTS public.answer_shares (
  answer_id uuid NOT NULL REFERENCES public.answers(id) ON DELETE CASCADE,
  group_id  uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  shared_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (answer_id, group_id)
);
CREATE INDEX IF NOT EXISTS idx_answer_shares_group ON public.answer_shares (group_id);

CREATE TABLE IF NOT EXISTS public.messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id            uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  thread_date         date NOT NULL,
  kind                text NOT NULL CHECK (kind IN ('answer','chat','system')),
  user_id             uuid REFERENCES public.users(id) ON DELETE CASCADE,
  text                text,
  media_urls          text[],
  media_types         text[],
  mentions            uuid[] DEFAULT '{}'::uuid[],
  answer_id           uuid REFERENCES public.answers(id) ON DELETE CASCADE,
  reply_to_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  system_payload      jsonb,
  suppress_notify     boolean NOT NULL DEFAULT false,
  legacy_comment_id   uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz,
  CONSTRAINT messages_kind_shape CHECK (
    (kind = 'answer' AND answer_id IS NOT NULL AND user_id IS NOT NULL) OR
    (kind = 'chat'   AND user_id IS NOT NULL) OR
    (kind = 'system' AND system_payload IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON public.messages (group_id, thread_date, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_user ON public.messages (user_id);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON public.messages (reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_answer_group ON public.messages (answer_id, group_id) WHERE answer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_legacy_comment ON public.messages (legacy_comment_id) WHERE legacy_comment_id IS NOT NULL;
COMMENT ON TABLE public.messages IS 'v2: one row per thread item. kind=answer is the answer card, chat is inline conversation, system is generated (birthdays).';

CREATE TABLE IF NOT EXISTS public.message_reactions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON public.message_reactions (message_id);

CREATE TABLE IF NOT EXISTS public.thread_reads (
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  group_id     uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  thread_date  date NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, group_id, thread_date)
);
CREATE INDEX IF NOT EXISTS idx_thread_reads_user ON public.thread_reads (user_id, last_read_at DESC);

CREATE TABLE IF NOT EXISTS public.share_links (
  token       text PRIMARY KEY,
  kind        text NOT NULL CHECK (kind IN ('answer','thread')),
  message_id  uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  group_id    uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  thread_date date,
  created_by  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz,
  CONSTRAINT share_links_shape CHECK (
    (kind = 'answer' AND message_id IS NOT NULL) OR
    (kind = 'thread' AND group_id IS NOT NULL AND thread_date IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_share_links_creator ON public.share_links (created_by);

-- v2 user columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS onesignal_id text;

-- updated_at maintenance
CREATE OR REPLACE FUNCTION public.v2_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS answers_touch_updated_at ON public.answers;
CREATE TRIGGER answers_touch_updated_at BEFORE UPDATE ON public.answers
  FOR EACH ROW EXECUTE FUNCTION public.v2_touch_updated_at();

DROP TRIGGER IF EXISTS question_schedule_touch_updated_at ON public.question_schedule;
CREATE TRIGGER question_schedule_touch_updated_at BEFORE UPDATE ON public.question_schedule
  FOR EACH ROW EXECUTE FUNCTION public.v2_touch_updated_at();;
