-- Return the group's faces alongside the invite.
--
-- The invite screen showed a name and a count. Seeing who is actually inside is
-- what makes "join this private group" a decision you can make — a count alone
-- tells you nothing about whether these are your people.
--
-- Capped at 6: enough for the avatar stack, and it keeps the payload small for
-- what is an unauthenticated lookup.
CREATE OR REPLACE FUNCTION public.v2_peek_invite(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE WHEN t.token IS NULL THEN jsonb_build_object('error','not_found')
              WHEN t.revoked_at IS NOT NULL THEN jsonb_build_object('error','revoked')
              WHEN t.expires_at IS NOT NULL AND t.expires_at < now() THEN jsonb_build_object('error','expired')
              ELSE jsonb_build_object(
                'group_id', g.id, 'group_name', g.name,
                'inviter', coalesce(u.name,'Someone'),
                'member_count', (SELECT count(*) FROM public.group_members m WHERE m.group_id = g.id),
                'members', coalesce((
                  SELECT jsonb_agg(jsonb_build_object(
                           'id', mu.id, 'name', mu.name, 'avatar_url', mu.avatar_url))
                  FROM (
                    SELECT mu.id, mu.name, mu.avatar_url
                    FROM public.group_members m
                    JOIN public.users mu ON mu.id = m.user_id
                    WHERE m.group_id = g.id
                    ORDER BY m.joined_at
                    LIMIT 6
                  ) mu
                ), '[]'::jsonb))
         END
  FROM public.invite_tokens t
  LEFT JOIN public.groups g ON g.id = t.group_id
  LEFT JOIN public.users u ON u.id = t.created_by
  WHERE upper(t.token) = upper(p_token);
$function$;
