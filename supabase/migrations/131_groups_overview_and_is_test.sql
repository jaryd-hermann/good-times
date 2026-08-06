-- 131: see who runs each group, and mark test groups out of the stats.
--
-- Asked for as columns on `groups` holding the admin's email, the admin's name
-- and the member list. Those three are DERIVED, and a stored copy is wrong the
-- moment anyone joins, leaves, renames themselves or changes their email —
-- keeping them honest would mean triggers on both group_members and users, so
-- they are a view instead. Views appear in the Supabase table editor alongside
-- tables, so it reads the same way while never going stale.
--
-- The one thing that genuinely IS new information, and so genuinely is a
-- column: which groups are test groups. No query can know that for certain, and
-- a heuristic that silently drops a real group from the numbers is worse than
-- no heuristic. suggested_test proposes; a human ticks groups.is_test; every
-- stats query filters on the column, never on the guess.

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.groups.is_test IS
  'Hand-set: exclude this group from stats/engagement. See groups_overview.suggested_test for candidates.';

DROP VIEW IF EXISTS public.groups_overview;

CREATE VIEW public.groups_overview AS
WITH member_rows AS (
  SELECT
    gm.group_id,
    gm.role,
    u.id   AS user_id,
    u.name AS user_name,
    u.email,
    gm.joined_at,
    -- Drawn from the domains actually present in this database rather than a
    -- generic list: the built.studio staff domain, example.com, and the
    -- malformed domains typo signups leave behind ('gm', 'gmom', 'gmail.comm'
    -- — anything with no dot after the @).
    (
      lower(u.email) LIKE '%@built.studio'
      OR lower(u.email) LIKE '%@built.studio.%'
      OR lower(u.email) LIKE '%@example.com'
      OR lower(u.email) LIKE '%+test%'
      OR split_part(u.email, '@', 2) NOT LIKE '%.%'
      OR lower(coalesce(u.name, '')) LIKE '%test%'
    ) AS is_test_account
  FROM public.group_members gm
  JOIN public.users u ON u.id = gm.user_id
),
flags AS (
  SELECT
    g.id AS group_id,
    coalesce((SELECT bool_and(m.is_test_account) FROM member_rows m WHERE m.group_id = g.id), false) AS all_test,
    coalesce((SELECT bool_or(m.is_test_account)  FROM member_rows m WHERE m.group_id = g.id), false) AS any_test,
    -- Membership is not the only signal. A group called "Test Group" created
    -- from a real gmail address is still a test group, and a name that is 900
    -- characters of pasted ARKit diagnostics is not a real group either.
    lower(g.name) LIKE '%test%' AS name_says_test,
    length(g.name) > 80         AS name_is_junk
  FROM public.groups g
)
SELECT
  g.id,
  g.name,
  g.is_test,
  g.created_at,

  -- Falls back to groups.created_by so a group that somehow lost its admin row
  -- still shows an owner rather than a blank line.
  coalesce(adm.email, cb.email)    AS admin_email,
  coalesce(adm.user_name, cb.name) AS admin_name,

  (SELECT count(*) FROM member_rows m WHERE m.group_id = g.id) AS member_count,

  -- Readable at a glance in the table editor, oldest member first.
  (SELECT array_agg(coalesce(m.user_name, '?') || ' <' || m.email || '>' ORDER BY m.joined_at)
     FROM member_rows m WHERE m.group_id = g.id)               AS members,
  (SELECT array_agg(m.email ORDER BY m.joined_at)
     FROM member_rows m WHERE m.group_id = g.id)               AS member_emails,

  (SELECT count(*) FROM member_rows m
    WHERE m.group_id = g.id AND m.is_test_account)             AS test_member_count,
  f.all_test                                                   AS all_members_test,

  -- Why it is suspected, so a flag is never a black box.
  nullif(concat_ws(', ',
    CASE WHEN f.all_test THEN 'all members are test accounts' END,
    CASE WHEN f.any_test AND NOT f.all_test THEN 'some members are test accounts' END,
    CASE WHEN f.name_says_test THEN 'group name says test' END,
    CASE WHEN f.name_is_junk THEN 'group name looks like pasted junk' END
  ), '')                                                       AS test_reason,

  (f.any_test OR f.name_says_test OR f.name_is_junk)           AS suggested_test,

  -- Engagement alongside it, so a dead group is as visible as a fake one.
  (SELECT count(*) FROM public.messages ms
    WHERE ms.group_id = g.id AND ms.kind = 'answer')           AS answers,
  (SELECT count(*) FROM public.messages ms
    WHERE ms.group_id = g.id AND ms.kind = 'chat')             AS chat_messages,
  (SELECT max(ms.created_at) FROM public.messages ms
    WHERE ms.group_id = g.id)                                  AS last_activity
FROM public.groups g
JOIN flags f ON f.group_id = g.id
LEFT JOIN LATERAL (
  SELECT m.email, m.user_name FROM member_rows m
  WHERE m.group_id = g.id AND m.role = 'admin'
  ORDER BY m.joined_at LIMIT 1
) adm ON true
LEFT JOIN public.users cb ON cb.id = g.created_by;

COMMENT ON VIEW public.groups_overview IS
  'Admin + member roster per group, always current. Set groups.is_test to exclude from stats.';

-- RLS is disabled across this database, so anything readable by anon is
-- readable by anyone holding the shipped publishable key. This view collects
-- every user email into one place, which makes that materially worse. Studio
-- and server-side jobs connect as service_role, so nothing is lost.
REVOKE ALL ON public.groups_overview FROM anon, authenticated;
GRANT SELECT ON public.groups_overview TO service_role;
