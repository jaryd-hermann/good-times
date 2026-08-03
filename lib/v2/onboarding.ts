import * as Clipboard from "expo-clipboard"
import { supabase } from "../supabase"

/**
 * v2 onboarding, invites and sharing.
 *
 * Onboarding state lives on `users.onboarded_at`, NOT AsyncStorage. v1 kept it in
 * `has_completed_post_auth_onboarding_<userId>` with a 10-minute account-age
 * fallback, so a reinstall could replay onboarding for an existing user.
 */

export type InvitePeek =
  | {
      group_id: string
      group_name: string
      inviter: string
      member_count: number
      /** Up to 6 faces for the invite screen's avatar stack. */
      members?: { id: string; name: string | null; avatar_url: string | null }[]
    }
  | { error: "not_found" | "revoked" | "expired" }

export async function peekInvite(token: string): Promise<InvitePeek> {
  const { data, error } = await supabase.rpc("v2_peek_invite", { p_token: token })
  if (error) throw new Error(`peekInvite: ${error.message}`)
  return (data ?? { error: "not_found" }) as InvitePeek
}

export async function redeemInvite(token: string, userId: string) {
  const { data, error } = await supabase.rpc("v2_redeem_invite", {
    p_token: token,
    p_user_id: userId,
  })
  if (error) throw new Error(`redeemInvite: ${error.message}`)
  const res = data as { group_id?: string; group_name?: string; error?: string }
  if (res.error) throw new Error(res.error)
  return res as { group_id: string; group_name: string }
}

/**
 * Where a user goes the moment they finish authenticating.
 *
 * OAuth gives no reliable "is this a new account" signal — Supabase returns a
 * session either way, and created_at is unusable because v1 rows already exist for
 * people signing in to v2 for the first time. So we ask the data instead: a
 * finished profile means a returning user, and they go straight to the app rather
 * than being walked through onboarding again.
 *
 * An invite is redeemed here for anyone whose profile is already complete —
 * clicking a link while signed in should just drop you in the group, not restart
 * onboarding. New users carry the token through profile → answer and join after.
 */
export async function routeAfterAuth(
  userId: string,
  invite?: string
): Promise<"/(v2)/today" | "/(onboarding-v2)/profile"> {
  const [{ data: profile }, { count }] = await Promise.all([
    supabase.from("users").select("name, birthday").eq("id", userId).maybeSingle(),
    supabase
      .from("group_members")
      .select("group_id", { count: "exact", head: true })
      .eq("user_id", userId),
  ])

  const profileComplete = !!profile?.name && !!profile?.birthday
  if (!profileComplete) return "/(onboarding-v2)/profile"

  if (invite) {
    // Best-effort: a dead or already-redeemed token must not strand a returning
    // user on the auth screen. They land in the app and can retry from the menu.
    try {
      await redeemInvite(invite, userId)
      return "/(v2)/today"
    } catch {
      /* fall through to the normal decision below */
    }
  }

  // Groupless users go to Today too: they answer there, and the create/join card
  // sits under the question card for them.
  return "/(v2)/today"
}

export async function createGroup(name: string, userId: string) {
  const { data, error } = await supabase.rpc("v2_create_group", {
    p_name: name,
    p_user_id: userId,
  })
  if (error) throw new Error(`createGroup: ${error.message}`)
  return data as {
    group_id: string
    group_name: string
    invite: { token: string }
  }
}

export async function getInviteCode(groupId: string, userId: string) {
  const { data, error } = await supabase.rpc("v2_get_or_create_invite", {
    p_group_id: groupId,
    p_user_id: userId,
  })
  if (error) throw new Error(`getInviteCode: ${error.message}`)
  return data as { token?: string; error?: string }
}

export function inviteUrl(token: string) {
  return `https://thegoodtimes.app/join/${token}`
}

/**
 * Looks for an invite code the user copied from the join page before installing.
 *
 * Called ONLY from an explicit "Paste invite code" tap — never on launch. A
 * programmatic clipboard read triggers iOS's "pasted from Safari" banner, which is
 * fine in response to a tap and alarming unprompted. The zero-friction path is the
 * OS paste suggestion above the keyboard, which costs us nothing and never reads
 * the clipboard ourselves.
 *
 * Note `textContentType="oneTimeCode"` does NOT help here — that mechanism is
 * SMS-driven and our code arrives via a web page.
 */
export async function readInviteCodeFromClipboard(): Promise<string | null> {
  try {
    const raw = (await Clipboard.getStringAsync())?.trim()
    if (!raw) return null
    const code = raw.match(/GT-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4,}/i)
    if (code) return code[0].toUpperCase()
    const url = raw.match(/thegoodtimes\.app\/join\/([A-Za-z0-9-]+)/i)
    if (url) return url[1]
    return null
  } catch {
    return null
  }
}

export async function saveProfile(
  userId: string,
  profile: { name: string; birthday?: string | null; avatar_url?: string | null }
) {
  const { error } = await supabase
    .from("users")
    .update({
      name: profile.name,
      // Explicitly nullable: birthday is skippable in v2, and v1's silently
      // pre-filled 1969-03-15 picker is exactly why 24% of stored birthdays
      // were fiction.
      birthday: profile.birthday ?? null,
      avatar_url: profile.avatar_url ?? null,
    })
    .eq("id", userId)
  if (error) throw new Error(`saveProfile: ${error.message}`)
}

export async function markOnboarded(userId: string) {
  const { error } = await supabase
    .from("users")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", userId)
  if (error) console.warn("[v2] markOnboarded failed:", error.message)
}

export async function isOnboarded(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("users")
    .select("onboarded_at, name")
    .eq("id", userId)
    .maybeSingle()
  const row = data as { onboarded_at: string | null; name: string | null } | null
  return !!row?.onboarded_at && !!row?.name
}

export async function createShareLink(input: {
  kind: "answer" | "thread"
  userId: string
  messageId?: string
  groupId?: string
  threadDate?: string
}) {
  const { data, error } = await supabase.rpc("v2_create_share_link", {
    p_kind: input.kind,
    p_user_id: input.userId,
    p_message_id: input.messageId,
    p_group_id: input.groupId,
    p_thread_date: input.threadDate,
  })
  if (error) throw new Error(`createShareLink: ${error.message}`)
  return data as { token?: string; url?: string; error?: string }
}
