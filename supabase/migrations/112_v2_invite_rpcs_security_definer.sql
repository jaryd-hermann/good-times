-- Fix: "new row violates row-level security policy for table invite_tokens".
--
-- invite_tokens is the one table in the schema with RLS ENABLED and ZERO policies,
-- which denies every read and write. The four invite RPCs all ran SECURITY INVOKER,
-- so they inherited the caller's (denied) rights. That broke group creation,
-- invite-code generation, peeking an invite, AND redeeming one — the whole invite
-- surface, not just the error that surfaced.
--
-- Two ways out: disable RLS on invite_tokens to match the rest of the schema, or
-- let the vetted RPCs run as owner. Taking the second: an invite token is a
-- credential — anyone holding one joins a private group — so it should stay
-- unreadable from the client, with these four functions as the only way in. That
-- is strictly tighter than the surrounding tables, not looser.
--
-- Each function already checks the caller's membership/authorisation internally;
-- SECURITY DEFINER does not skip those checks, it only bypasses table RLS.
--
-- search_path is pinned on all four: a SECURITY DEFINER function without one is a
-- privilege-escalation hole, because a caller can put a malicious schema ahead of
-- public and have the definer execute it.

ALTER FUNCTION public.v2_create_group(p_name text, p_user_id uuid)
  SECURITY DEFINER SET search_path = public, pg_temp;

ALTER FUNCTION public.v2_get_or_create_invite(p_group_id uuid, p_user_id uuid)
  SECURITY DEFINER SET search_path = public, pg_temp;

ALTER FUNCTION public.v2_peek_invite(p_token text)
  SECURITY DEFINER SET search_path = public, pg_temp;

ALTER FUNCTION public.v2_redeem_invite(p_token text, p_user_id uuid)
  SECURITY DEFINER SET search_path = public, pg_temp;
