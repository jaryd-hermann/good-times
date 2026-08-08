-- 133: a group must never be left with members but no admin.
--
-- Camps Bay ended up with 3 members and 0 admins. Its creator was the only
-- admin, and v2's "Leave group" is a bare client-side
-- DELETE FROM group_members with no last-admin check — v1's leaveGroup() had one
-- ("Cannot leave group as the last admin") and the v2 rewrite lost it. An
-- admin-less group cannot be renamed or managed by anyone in it.
--
-- The guarantee lives in the AFTER DELETE trigger, NOT in the RPC below,
-- because RLS is off on this database: any client can still issue the raw
-- delete, so only a server-side rule actually holds. Succession rather than
-- refusal — blocking the last admin traps people in groups they want to leave.

CREATE OR REPLACE FUNCTION public.v2_ensure_group_has_admin()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_heir uuid;
BEGIN
  -- Last member out: nobody to hand it to, and an empty group is fine.
  IF NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = OLD.group_id) THEN
    RETURN NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM public.group_members
             WHERE group_id = OLD.group_id AND role = 'admin') THEN
    RETURN NULL;
  END IF;

  SELECT user_id INTO v_heir FROM public.group_members
   WHERE group_id = OLD.group_id
   ORDER BY joined_at NULLS LAST LIMIT 1;

  IF v_heir IS NOT NULL THEN
    UPDATE public.group_members SET role = 'admin'
     WHERE group_id = OLD.group_id AND user_id = v_heir;
    RAISE WARNING 'v2_ensure_group_has_admin: promoted % in group %', v_heir, OLD.group_id;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS v2_group_admin_succession ON public.group_members;
CREATE TRIGGER v2_group_admin_succession
AFTER DELETE ON public.group_members
FOR EACH ROW EXECUTE FUNCTION public.v2_ensure_group_has_admin();

-- The clean path for the client, so leaving reports what happened instead of
-- being a fire-and-forget delete whose failure is indistinguishable from success.
CREATE OR REPLACE FUNCTION public.v2_leave_group(p_group_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text; v_heir uuid;
BEGIN
  SELECT role INTO v_role FROM public.group_members
   WHERE group_id = p_group_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_a_member');
  END IF;

  DELETE FROM public.group_members
   WHERE group_id = p_group_id AND user_id = p_user_id;

  -- Succession is the trigger's job; read back who holds it now so the caller
  -- can say who inherited it rather than guessing.
  SELECT user_id INTO v_heir FROM public.group_members
   WHERE group_id = p_group_id AND role = 'admin'
   ORDER BY joined_at NULLS LAST LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'was_admin', v_role = 'admin',
    'new_admin', v_heir,
    'new_admin_name', (SELECT coalesce(name,'Someone') FROM public.users WHERE id = v_heir));
END $$;

GRANT EXECUTE ON FUNCTION public.v2_leave_group(uuid, uuid) TO anon, authenticated;

-- Heal anything already orphaned, by the same rule the trigger applies.
UPDATE public.group_members gm SET role = 'admin'
WHERE gm.user_id = (
  SELECT x.user_id FROM public.group_members x
   WHERE x.group_id = gm.group_id ORDER BY x.joined_at NULLS LAST LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM public.group_members a
                  WHERE a.group_id = gm.group_id AND a.role = 'admin');
