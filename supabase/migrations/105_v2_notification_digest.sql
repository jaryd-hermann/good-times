-- =============================================================================
-- v2_notification_digest   (applied to production as migration 20260801162720)
-- =============================================================================
-- Exported from supabase_migrations.schema_migrations so the repo matches the
-- database exactly. ADDITIVE ONLY -- no v1 table is dropped or altered.
-- See docs/V2_PLAN.md.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notification_pref_enabled(p_user_id uuid, p_type text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT COALESCE(u.notifications_enabled, true)
     AND COALESCE((u.notification_prefs->>p_type)::boolean, true)
  FROM public.users u WHERE u.id = p_user_id;
$$;

CREATE TABLE IF NOT EXISTS public.notification_digest (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  group_id       uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  thread_date    date,
  type           text NOT NULL,
  event_count    int NOT NULL DEFAULT 1,
  actor_ids      uuid[] NOT NULL DEFAULT '{}',
  first_event_at timestamptz NOT NULL DEFAULT now(),
  last_event_at  timestamptz NOT NULL DEFAULT now(),
  flushed_at     timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_digest_open
  ON public.notification_digest (user_id, group_id, thread_date, type)
  WHERE flushed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_digest_pending
  ON public.notification_digest (last_event_at) WHERE flushed_at IS NULL;

CREATE OR REPLACE FUNCTION public.v2_digest_add(
  p_user_id uuid, p_group_id uuid, p_thread_date date, p_type text, p_actor uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_user_id = p_actor THEN RETURN; END IF;
  IF NOT public.notification_pref_enabled(p_user_id, p_type) THEN RETURN; END IF;
  INSERT INTO public.notification_digest AS nd
    (user_id, group_id, thread_date, type, event_count, actor_ids)
  VALUES (p_user_id, p_group_id, p_thread_date, p_type, 1, ARRAY[p_actor])
  ON CONFLICT (user_id, group_id, thread_date, type) WHERE flushed_at IS NULL
  DO UPDATE SET
    event_count   = nd.event_count + 1,
    actor_ids     = CASE WHEN p_actor = ANY(nd.actor_ids)
                         THEN nd.actor_ids ELSE nd.actor_ids || p_actor END,
    last_event_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.v2_notify_now(
  p_user_id uuid, p_type text, p_title text, p_body text, p_data jsonb)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT public.notification_pref_enabled(p_user_id, p_type) THEN RETURN; END IF;
  INSERT INTO public.notification_queue (user_id, type, title, body, data)
  VALUES (p_user_id, p_type, p_title, p_body, p_data);
END $$;;
