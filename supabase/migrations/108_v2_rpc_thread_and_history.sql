-- =============================================================================
-- v2_rpc_thread_and_history   (applied to production as migration 20260801163735)
-- =============================================================================
-- Exported from supabase_migrations.schema_migrations so the repo matches the
-- database exactly. ADDITIVE ONLY -- no v1 table is dropped or altered.
--
-- When a thread is locked the RPC strips content SERVER-SIDE (text/media null,
-- redacted:true) rather than trusting the client to hide it. Verified on a real
-- 31-message thread: 6 answers + 25 chats, every chat reply-anchored with a quote
-- excerpt, 6 messages carrying reactions with correct mine/count.
-- See docs/V2_PLAN.md.
-- =============================================================================

-- Designs 2C / 2D / 4A: the entire thread in one call.
-- Replaces the N+1 fan-out in home.tsx (three Promise.all loops, one round trip
-- per date each, ~90 requests for 30 days).
CREATE OR REPLACE FUNCTION public.v2_get_thread(
  p_group_id uuid, p_date date, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_locked boolean; v_prompt_id uuid; v_question text;
  v_group jsonb; v_messages jsonb; v_last_read timestamptz;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.group_members
                 WHERE group_id = p_group_id AND user_id = p_user_id) THEN
    RETURN jsonb_build_object('error','not_a_member');
  END IF;

  v_locked := public.v2_is_locked(p_user_id, p_date);
  v_prompt_id := public.resolve_question_for_date(p_date);
  SELECT question INTO v_question FROM public.prompts WHERE id = v_prompt_id;

  SELECT tr.last_read_at INTO v_last_read FROM public.thread_reads tr
  WHERE tr.user_id = p_user_id AND tr.group_id = p_group_id AND tr.thread_date = p_date;

  SELECT jsonb_build_object(
    'id', gr.id, 'name', gr.name,
    'member_count', (SELECT count(*) FROM public.group_members gm WHERE gm.group_id = gr.id),
    'answered_count', (SELECT count(*) FROM public.messages m
                       WHERE m.group_id = gr.id AND m.thread_date = p_date AND m.kind='answer'),
    'members', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                  'id', u.id, 'name', u.name, 'avatar_url', u.avatar_url)), '[]'::jsonb)
                FROM public.group_members gm JOIN public.users u ON u.id = gm.user_id
                WHERE gm.group_id = gr.id))
  INTO v_group FROM public.groups gr WHERE gr.id = p_group_id;

  -- When locked we still return the shape, but with content stripped: the client
  -- blurs placeholders (screenshot 1) and must not hold the real text in memory.
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at), '[]'::jsonb)
  INTO v_messages FROM (
    SELECT
      m.id, m.kind, m.created_at, m.thread_date, m.system_payload,
      jsonb_build_object('id', u.id, 'name', u.name, 'avatar_url', u.avatar_url) AS author,
      CASE WHEN v_locked THEN NULL ELSE m.text END AS text,
      CASE WHEN v_locked THEN NULL ELSE m.media_urls END AS media_urls,
      CASE WHEN v_locked THEN NULL ELSE m.media_types END AS media_types,
      CASE WHEN v_locked THEN true ELSE false END AS redacted,
      CASE WHEN m.answer_id IS NOT NULL AND NOT v_locked THEN
        (SELECT jsonb_build_object('id', a.id, 'mode', a.mode,
                  'text_content', a.text_content, 'transcript', a.transcript,
                  'media_urls', a.media_urls, 'media_types', a.media_types,
                  'captions', a.captions,
                  'share_count', (SELECT count(*) FROM public.answer_shares s WHERE s.answer_id = a.id))
         FROM public.answers a WHERE a.id = m.answer_id)
      WHEN m.answer_id IS NOT NULL THEN jsonb_build_object('redacted', true)
      ELSE NULL END AS answer,
      CASE WHEN m.reply_to_message_id IS NOT NULL THEN
        (SELECT jsonb_build_object('id', rm.id,
                  'author', coalesce(ru.name,'Someone'),
                  'excerpt', left(coalesce(rm.text, ra.text_content, ''), 80))
         FROM public.messages rm
         LEFT JOIN public.users ru ON ru.id = rm.user_id
         LEFT JOIN public.answers ra ON ra.id = rm.answer_id
         WHERE rm.id = m.reply_to_message_id)
      ELSE NULL END AS reply_to,
      (SELECT coalesce(jsonb_agg(r), '[]'::jsonb) FROM (
         SELECT mr.emoji, count(*) AS count,
                bool_or(mr.user_id = p_user_id) AS mine
         FROM public.message_reactions mr
         WHERE mr.message_id = m.id GROUP BY mr.emoji ORDER BY count(*) DESC) r
      ) AS reactions
    FROM public.messages m
    LEFT JOIN public.users u ON u.id = m.user_id
    WHERE m.group_id = p_group_id AND m.thread_date = p_date
  ) x;

  RETURN jsonb_build_object(
    'group', v_group,
    'date', p_date,
    'question', jsonb_build_object('prompt_id', v_prompt_id, 'text', v_question),
    'locked', v_locked,
    'last_read_at', v_last_read,
    'messages', v_messages);
END $$;

-- Design 2F: group-first history rows, paginated.
CREATE OR REPLACE FUNCTION public.v2_get_history(
  p_user_id uuid,
  p_group_id uuid DEFAULT NULL,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_unseen_only boolean DEFAULT false,
  p_limit int DEFAULT 30,
  p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(h) ORDER BY h.thread_date DESC, h.group_name), '[]'::jsonb)
  FROM (
    SELECT
      m.group_id, gr.name AS group_name, m.thread_date,
      (SELECT p.question FROM public.prompts p
        WHERE p.id = public.resolve_question_for_date(m.thread_date)) AS question,
      count(*) FILTER (WHERE m.kind = 'answer') AS answer_count,
      count(*) FILTER (WHERE m.kind = 'chat')   AS message_count,
      count(*) FILTER (WHERE m.kind = 'answer'
        AND 'video' = ANY(coalesce(
          (SELECT a.media_types FROM public.answers a WHERE a.id = m.answer_id), '{}'))) AS video_count,
      max(m.created_at) AS last_activity,
      (SELECT jsonb_build_object('author', coalesce(u.name,'Someone'),
                                 'text', left(coalesce(mm.text,''), 90))
         FROM public.messages mm LEFT JOIN public.users u ON u.id = mm.user_id
        WHERE mm.group_id = m.group_id AND mm.thread_date = m.thread_date
        ORDER BY mm.created_at DESC LIMIT 1) AS last_message,
      count(*) FILTER (
        WHERE m.user_id IS DISTINCT FROM p_user_id
          AND m.created_at > coalesce(
            (SELECT tr.last_read_at FROM public.thread_reads tr
             WHERE tr.user_id = p_user_id AND tr.group_id = m.group_id
               AND tr.thread_date = m.thread_date), 'epoch'::timestamptz)) AS unread_count
    FROM public.messages m
    JOIN public.groups gr ON gr.id = m.group_id
    JOIN public.group_members gm ON gm.group_id = m.group_id AND gm.user_id = p_user_id
    WHERE (p_group_id IS NULL OR m.group_id = p_group_id)
      AND (p_from IS NULL OR m.thread_date >= p_from)
      AND (p_to   IS NULL OR m.thread_date <= p_to)
    GROUP BY m.group_id, gr.name, m.thread_date
    HAVING NOT p_unseen_only OR count(*) FILTER (
        WHERE m.user_id IS DISTINCT FROM p_user_id
          AND m.created_at > coalesce(
            (SELECT tr.last_read_at FROM public.thread_reads tr
             WHERE tr.user_id = p_user_id AND tr.group_id = m.group_id
               AND tr.thread_date = m.thread_date), 'epoch'::timestamptz)) > 0
    ORDER BY m.thread_date DESC, gr.name
    LIMIT p_limit OFFSET p_offset
  ) h;
$$;

-- Mark read (drives unread badges and the NEW divider).
CREATE OR REPLACE FUNCTION public.v2_mark_thread_read(
  p_user_id uuid, p_group_id uuid, p_thread_date date)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.thread_reads (user_id, group_id, thread_date, last_read_at)
  VALUES (p_user_id, p_group_id, p_thread_date, now())
  ON CONFLICT (user_id, group_id, thread_date)
  DO UPDATE SET last_read_at = now();
$$;;
