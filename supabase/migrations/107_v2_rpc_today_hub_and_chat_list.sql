-- =============================================================================
-- v2_rpc_today_hub_and_chat_list   (applied to production as migration 20260801163700)
-- =============================================================================
-- Exported from supabase_migrations.schema_migrations so the repo matches the
-- database exactly. ADDITIVE ONLY -- no v1 table is dropped or altered.
-- See docs/V2_PLAN.md.
-- =============================================================================

DROP FUNCTION IF EXISTS public.__dump_migrations();

-- Shared helper: is this thread locked for this user?
-- Gating (decision 3): today's thread is hidden until you answer today. Past
-- days always unlock. Keys off having ANSWERED, not off having shared -- a user
-- who toggled every group off in 3E still unlocks (3E: "Unlocks all your groups").
CREATE OR REPLACE FUNCTION public.v2_is_locked(p_user_id uuid, p_date date)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT p_date >= CURRENT_DATE
     AND NOT EXISTS (
       SELECT 1 FROM public.answers a
       WHERE a.user_id = p_user_id AND a.date = p_date);
$$;

-- Designs 2A / 2B: one call powers the whole Today screen.
CREATE OR REPLACE FUNCTION public.v2_get_today_hub(p_user_id uuid, p_date date DEFAULT CURRENT_DATE)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_prompt_id uuid; v_question text; v_answer jsonb; v_groups jsonb; v_locked boolean;
BEGIN
  v_prompt_id := public.resolve_question_for_date(p_date);
  SELECT question INTO v_question FROM public.prompts WHERE id = v_prompt_id;
  v_locked := public.v2_is_locked(p_user_id, p_date);

  SELECT to_jsonb(x) INTO v_answer FROM (
    SELECT a.id, a.mode, a.text_content, a.transcript, a.media_urls, a.media_types,
           a.captions, a.created_at,
           coalesce((SELECT jsonb_agg(s.group_id) FROM public.answer_shares s
                     WHERE s.answer_id = a.id), '[]'::jsonb) AS shared_group_ids
    FROM public.answers a
    WHERE a.user_id = p_user_id AND a.date = p_date
    LIMIT 1
  ) x;

  SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY g.last_activity DESC NULLS LAST), '[]'::jsonb)
  INTO v_groups FROM (
    SELECT
      gr.id, gr.name,
      (SELECT count(*) FROM public.group_members gm2 WHERE gm2.group_id = gr.id) AS member_count,
      (SELECT coalesce(jsonb_agg(jsonb_build_object('id', u2.id, 'name', u2.name, 'avatar_url', u2.avatar_url)), '[]'::jsonb)
         FROM (SELECT u3.id, u3.name, u3.avatar_url FROM public.group_members gm3
               JOIN public.users u3 ON u3.id = gm3.user_id
               WHERE gm3.group_id = gr.id ORDER BY gm3.joined_at LIMIT 4) u2) AS members,
      (SELECT count(*) FROM public.messages m WHERE m.group_id = gr.id
        AND m.thread_date = p_date AND m.kind = 'answer') AS answer_count,
      (SELECT count(*) FROM public.messages m WHERE m.group_id = gr.id
        AND m.thread_date = p_date AND m.kind = 'chat') AS message_count,
      (SELECT count(*) FROM public.messages m
        WHERE m.group_id = gr.id AND m.thread_date = p_date
          AND m.user_id IS DISTINCT FROM p_user_id
          AND m.created_at > coalesce(
            (SELECT tr.last_read_at FROM public.thread_reads tr
             WHERE tr.user_id = p_user_id AND tr.group_id = gr.id AND tr.thread_date = p_date),
            'epoch'::timestamptz)) AS unread_count,
      EXISTS (SELECT 1 FROM public.messages m WHERE m.group_id = gr.id
              AND m.thread_date = p_date AND m.kind = 'system'
              AND m.system_payload->>'event' = 'birthday') AS has_birthday,
      (SELECT jsonb_build_object('text', left(coalesce(m.text,''), 90),
                                 'author', coalesce(u4.name,'Someone'),
                                 'kind', m.kind)
         FROM public.messages m LEFT JOIN public.users u4 ON u4.id = m.user_id
        WHERE m.group_id = gr.id AND m.thread_date = p_date
        ORDER BY m.created_at DESC LIMIT 1) AS last_message,
      (SELECT max(m.created_at) FROM public.messages m
        WHERE m.group_id = gr.id AND m.thread_date = p_date) AS last_activity
    FROM public.groups gr
    JOIN public.group_members gm ON gm.group_id = gr.id AND gm.user_id = p_user_id
  ) g;

  RETURN jsonb_build_object(
    'date', p_date,
    'question', jsonb_build_object('prompt_id', v_prompt_id, 'text', v_question),
    'locked', v_locked,
    'my_answer', v_answer,
    'groups', v_groups);
END $$;

-- Chat list rows (design 2B lower half / standalone Groups list).
CREATE OR REPLACE FUNCTION public.v2_get_chat_list(p_user_id uuid, p_date date DEFAULT CURRENT_DATE)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY g.last_activity DESC NULLS LAST), '[]'::jsonb)
  FROM (
    SELECT gr.id, gr.name,
      (SELECT count(*) FROM public.group_members gm2 WHERE gm2.group_id = gr.id) AS member_count,
      public.v2_is_locked(p_user_id, p_date) AS locked,
      (SELECT count(*) FROM public.messages m
        WHERE m.group_id = gr.id AND m.user_id IS DISTINCT FROM p_user_id
          AND m.created_at > coalesce(
            (SELECT max(tr.last_read_at) FROM public.thread_reads tr
             WHERE tr.user_id = p_user_id AND tr.group_id = gr.id), 'epoch'::timestamptz)
      ) AS unread_count,
      (SELECT jsonb_build_object('text', left(coalesce(m.text,''), 90),
                                 'author', coalesce(u.name,'Someone'),
                                 'kind', m.kind, 'thread_date', m.thread_date)
         FROM public.messages m LEFT JOIN public.users u ON u.id = m.user_id
        WHERE m.group_id = gr.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
      (SELECT max(m.created_at) FROM public.messages m WHERE m.group_id = gr.id) AS last_activity
    FROM public.groups gr
    JOIN public.group_members gm ON gm.group_id = gr.id AND gm.user_id = p_user_id
  ) g;
$$;;
