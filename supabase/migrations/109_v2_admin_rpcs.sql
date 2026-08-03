-- =============================================================================
-- v2_admin_rpcs   (applied to production as migration 20260801163910)
-- =============================================================================
-- Exported from supabase_migrations.schema_migrations so the repo matches the
-- database exactly. ADDITIVE ONLY -- no v1 table is dropped or altered.
-- See docs/V2_PLAN.md.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.v2_refresh_prompt_engagement()
RETURNS void LANGUAGE sql AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.prompt_engagement;
$$;

CREATE OR REPLACE FUNCTION public.v2_admin_dashboard()
RETURNS jsonb LANGUAGE sql STABLE AS $$
  WITH
  u AS (SELECT count(*) n FROM public.users),
  g AS (SELECT count(*) n FROM public.groups),
  sz AS (SELECT round(avg(c),2) a FROM (SELECT count(*) c FROM public.group_members GROUP BY group_id) x),
  q AS (SELECT public.resolve_question_for_date(CURRENT_DATE) pid),
  at AS (SELECT count(*) n FROM public.answers WHERE date = CURRENT_DATE),
  act AS (SELECT count(DISTINCT user_id) n FROM public.answers WHERE date > CURRENT_DATE - 30),
  silent AS (
    SELECT count(*) n FROM public.groups gr
    WHERE NOT EXISTS (SELECT 1 FROM public.messages m
      WHERE m.group_id = gr.id AND m.thread_date = CURRENT_DATE AND m.kind='answer')),
  un7 AS (SELECT coalesce(jsonb_agg(date ORDER BY date),'[]'::jsonb) d FROM public.v2_unscheduled_dates(7)),
  un30 AS (SELECT count(*) n FROM public.v2_unscheduled_dates(30))
  SELECT jsonb_build_object(
    'users', u.n, 'groups', g.n, 'avgGroupSize', sz.a,
    'answersToday', at.n, 'activeUsers30d', act.n,
    'todayQuestion', (SELECT question FROM public.prompts WHERE id = q.pid),
    'todayAnswerRate', CASE WHEN act.n > 0 THEN round(100.0*at.n/act.n,1) ELSE 0 END,
    'groupsSilentToday', silent.n,
    'unscheduledNext7', un7.d, 'unscheduledNext30', un30.n)
  FROM u,g,sz,q,at,act,silent,un7,un30;
$$;

CREATE OR REPLACE FUNCTION public.v2_admin_schedule(p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.date), '[]'::jsonb) FROM (
    SELECT d::date AS date,
           q.prompt_id,
           coalesce(p.question, '(unscheduled - will fall back)') AS question,
           coalesce(p.category,'') AS category,
           q.notes,
           extract(dow FROM d) = 0 AS is_sunday,
           (SELECT count(*) FROM public.answers a WHERE a.date = d::date) AS answer_count
    FROM generate_series(p_from, p_to, '1 day') d
    LEFT JOIN public.question_schedule q ON q.date = d::date
    LEFT JOIN public.prompts p ON p.id = q.prompt_id
  ) r;
$$;

CREATE OR REPLACE FUNCTION public.v2_admin_bank(
  p_search text DEFAULT NULL, p_filter text DEFAULT 'all', p_limit int DEFAULT 100)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.answer_rate DESC NULLS LAST, r.question), '[]'::jsonb)
  FROM (
    SELECT p.id, p.question, p.category,
           round(e.answer_rate, 3) AS answer_rate,
           e.times_asked, e.total_answers, e.last_asked,
           (SELECT min(q.date) FROM public.question_schedule q WHERE q.prompt_id = p.id) AS scheduled_for
    FROM public.prompts p
    LEFT JOIN public.prompt_engagement e ON e.id = p.id
    WHERE (p_search IS NULL OR p.question ILIKE '%'||p_search||'%')
      AND CASE p_filter
            WHEN 'unused'      THEN NOT EXISTS (SELECT 1 FROM public.question_schedule q WHERE q.prompt_id = p.id)
            WHEN 'scheduled'   THEN EXISTS (SELECT 1 FROM public.question_schedule q WHERE q.prompt_id = p.id)
            WHEN 'never_asked' THEN e.id IS NULL
            WHEN 'top'         THEN e.answer_rate IS NOT NULL
            ELSE true END
    LIMIT p_limit
  ) r;
$$;

CREATE OR REPLACE FUNCTION public.v2_admin_performance(p_days int DEFAULT 60)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.date DESC), '[]'::jsonb) FROM (
    SELECT a.date,
      (SELECT p.question FROM public.prompts p WHERE p.id = public.resolve_question_for_date(a.date)) AS question,
      count(DISTINCT a.user_id) AS unique_answerers,
      round(100.0 * count(DISTINCT a.user_id) /
            nullif((SELECT count(DISTINCT a2.user_id) FROM public.answers a2
                    WHERE a2.date BETWEEN a.date - 30 AND a.date), 0), 1) AS pct_of_active,
      (SELECT count(*) FROM public.messages m WHERE m.thread_date = a.date AND m.kind='chat') AS messages,
      (SELECT count(*) FROM public.message_reactions mr
        JOIN public.messages m ON m.id = mr.message_id WHERE m.thread_date = a.date) AS reactions,
      (SELECT count(DISTINCT m.group_id) FROM public.messages m
        WHERE m.thread_date = a.date AND m.kind='answer') AS groups_with_answer
    FROM public.answers a
    WHERE a.date > CURRENT_DATE - p_days
    GROUP BY a.date
  ) r;
$$;;
