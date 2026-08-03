-- =============================================================================
-- v2_admin_daily_digest
-- =============================================================================
-- Adds the "Good Times, Yesterday" admin digest email:
--   * app_settings toggle + recipient (controllable from the admin portal)
--   * v2_admin_digest_stats(date) -> the numbers the email reports
--   * a daily cron that pings the send-admin-digest edge function
--
-- The cron ALWAYS fires; the edge function no-ops when admin_digest_enabled is
-- not 'true'. That keeps the on/off switch in app_settings (editable from the
-- admin UI) rather than in the cron schedule.
--
-- ADDITIVE ONLY. See docs/V2_PLAN.md.
-- =============================================================================

-- ---- settings (defaults; safe to re-run) -----------------------------------
INSERT INTO public.app_settings (key, value) VALUES
  ('admin_digest_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value) VALUES
  ('admin_digest_recipient', 'hermannjaryd@gmail.com')
ON CONFLICT (key) DO NOTHING;

-- ---- stats for a single day (defaults to yesterday) ------------------------
-- Mirrors the definitions used by v2_admin_dashboard / v2_admin_performance so
-- the digest and the portal never disagree:
--   * "active users" = distinct answerers in the trailing 30 days
--   * answer rate    = answerers that day / active users
--   * group rate     = groups with an answer that day / total groups
CREATE OR REPLACE FUNCTION public.v2_admin_digest_stats(p_date date DEFAULT (CURRENT_DATE - 1))
RETURNS jsonb LANGUAGE sql STABLE AS $$
  WITH
  answerers AS (
    SELECT count(DISTINCT user_id) n FROM public.answers WHERE date = p_date),
  active AS (
    SELECT count(DISTINCT user_id) n FROM public.answers
    WHERE date > p_date - 30 AND date <= p_date),
  msgs AS (
    SELECT count(*) n FROM public.messages
    WHERE thread_date = p_date AND kind = 'chat'),
  answer_msgs AS (
    SELECT count(*) n FROM public.messages
    WHERE thread_date = p_date AND kind = 'answer'),
  reacts AS (
    SELECT count(*) n FROM public.message_reactions mr
    JOIN public.messages m ON m.id = mr.message_id
    WHERE m.thread_date = p_date),
  groups_answered AS (
    SELECT count(DISTINCT m.group_id) n FROM public.messages m
    WHERE m.thread_date = p_date AND m.kind = 'answer'),
  groups_total AS (SELECT count(*) n FROM public.groups),
  new_users AS (
    SELECT count(*) n FROM public.users
    WHERE created_at >= p_date::timestamptz
      AND created_at <  (p_date + 1)::timestamptz),
  new_groups AS (
    SELECT count(*) n FROM public.groups
    WHERE created_at >= p_date::timestamptz
      AND created_at <  (p_date + 1)::timestamptz),
  totals AS (
    SELECT (SELECT count(*) FROM public.users)  AS users,
           (SELECT count(*) FROM public.groups) AS groups),
  question AS (
    SELECT p.question q FROM public.prompts p
    WHERE p.id = public.resolve_question_for_date(p_date))
  SELECT jsonb_build_object(
    'date',              p_date,
    'question',          (SELECT q FROM question),
    'answerers',         (SELECT n FROM answerers),
    'activeUsers30d',    (SELECT n FROM active),
    'answerRate',        CASE WHEN (SELECT n FROM active) > 0
                              THEN round(100.0 * (SELECT n FROM answerers) / (SELECT n FROM active), 1)
                              ELSE 0 END,
    'messages',          (SELECT n FROM msgs),
    'answerMessages',    (SELECT n FROM answer_msgs),
    'reactions',         (SELECT n FROM reacts),
    'groupsAnswered',    (SELECT n FROM groups_answered),
    'groupsTotal',       (SELECT n FROM groups_total),
    'groupEngagement',   CASE WHEN (SELECT n FROM groups_total) > 0
                              THEN round(100.0 * (SELECT n FROM groups_answered) / (SELECT n FROM groups_total), 1)
                              ELSE 0 END,
    'silentGroups',      (SELECT n FROM groups_total) - (SELECT n FROM groups_answered),
    'newUsers',          (SELECT n FROM new_users),
    'newGroups',         (SELECT n FROM new_groups),
    'totalUsers',        (SELECT users FROM totals),
    'totalGroups',       (SELECT groups FROM totals)
  );
$$;

COMMENT ON FUNCTION public.v2_admin_digest_stats(date) IS
  'v2: numbers for the "Good Times, Yesterday" admin digest email. Defaults to yesterday.';

-- ---- cron: ping the edge function every morning ----------------------------
-- 12:00 UTC ~= 8am US Eastern. The function itself honours the on/off toggle.
SELECT cron.schedule(
  'v2-admin-digest',
  '0 12 * * *',
  $cron$
  SELECT net.http_post(
    url := public.get_app_setting('supabase_url') || '/functions/v1/send-admin-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.get_app_setting('supabase_service_role_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);
