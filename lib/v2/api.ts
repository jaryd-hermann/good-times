import { supabase } from "../supabase"
import { getTodayDate } from "../utils"
import type {
  ChatListRow,
  HistoryRow,
  MediaType,
  Thread,
  TodayHub,
} from "./types"

/**
 * v2 data access.
 *
 * Every screen read is ONE rpc call returning a shaped payload. This is the fix
 * for the v1 pattern where home.tsx ran three Promise.all loops over the visible
 * date range — one round trip per date each, ~90 requests for 30 days of history.
 */

function unwrap<T>(data: unknown, error: { message: string } | null, what: string): T {
  if (error) throw new Error(`${what}: ${error.message}`)
  return data as T
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getTodayHub(userId: string, date = getTodayDate()): Promise<TodayHub> {
  const { data, error } = await supabase.rpc("v2_get_today_hub", {
    p_user_id: userId,
    p_date: date,
  })
  return unwrap<TodayHub>(data, error, "getTodayHub")
}

export async function getThread(
  groupId: string,
  date: string,
  userId: string
): Promise<Thread> {
  const { data, error } = await supabase.rpc("v2_get_thread", {
    p_group_id: groupId,
    p_date: date,
    p_user_id: userId,
  })
  return unwrap<Thread>(data, error, "getThread")
}

export async function getChatList(userId: string, date = getTodayDate()): Promise<ChatListRow[]> {
  const { data, error } = await supabase.rpc("v2_get_chat_list", {
    p_user_id: userId,
    p_date: date,
  })
  return unwrap<ChatListRow[]>(data, error, "getChatList")
}

export async function getHistory(
  userId: string,
  opts: {
    groupId?: string | null
    from?: string | null
    to?: string | null
    unseenOnly?: boolean
    limit?: number
    offset?: number
  } = {}
): Promise<HistoryRow[]> {
  // Optional rpc args are typed `string | undefined`; passing null is a type
  // error even though Postgres treats a missing arg as its DEFAULT NULL.
  const { data, error } = await supabase.rpc("v2_get_history", {
    p_user_id: userId,
    p_group_id: opts.groupId ?? undefined,
    p_from: opts.from ?? undefined,
    p_to: opts.to ?? undefined,
    p_unseen_only: opts.unseenOnly ?? false,
    p_limit: opts.limit ?? 30,
    p_offset: opts.offset ?? 0,
  })
  return unwrap<HistoryRow[]>(data, error, "getHistory")
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export type PostAnswerInput = {
  userId: string
  promptId: string
  date: string
  mode: "video" | "voice" | "text"
  textContent?: string | null
  transcript?: string | null
  mediaUrls?: string[]
  mediaTypes?: MediaType[]
  captions?: (string | null)[]
  mediaDays?: (string | null)[]
  mentions?: string[]
  /** Groups to share into. Empty array is valid — the onboarding answer has no groups yet. */
  groupIds: string[]
}

/**
 * Posts today's answer and fans it out.
 *
 * Writes one `answers` row, one `answer_shares` row per selected group, and one
 * `kind='answer'` message into each of those group threads. The message insert is
 * what fires the digest trigger, so ordering matters: shares first, then messages.
 *
 * An answer with zero groups is deliberate (decision 15) — it retro-shares into
 * the first group the user joins, at its own date, without notifying.
 */
export async function postAnswer(input: PostAnswerInput): Promise<string> {
  const row = {
    user_id: input.userId,
    prompt_id: input.promptId,
    date: input.date,
    mode: input.mode,
    text_content: input.textContent ?? null,
    transcript: input.transcript ?? null,
    media_urls: input.mediaUrls ?? null,
    media_types: input.mediaTypes ?? null,
    // Postgres text[] permits NULL elements, and captions relies on that: a
    // null at index i means "photo i has no caption", keeping the array
    // parallel to media_urls. The generated type models it as string[] and so
    // cannot express that, hence the cast.
    captions: (input.captions ?? null) as string[] | null,
    media_days: (input.mediaDays ?? null) as string[] | null,
    mentions: input.mentions ?? [],
  }

  /**
   * Find-then-update rather than upsert.
   *
   * `answers_user_date_unique` is a PARTIAL index — (user_id, date) WHERE date >=
   * '2026-08-01' — and PostgREST's onConflict cannot express the predicate, so an
   * upsert fails to infer it. Editing an answer therefore hit the constraint head
   * on: "duplicate key value violates unique constraint answers_user_date_unique".
   */
  const { data: existing, error: findErr } = await supabase
    .from("answers")
    .select("id")
    .eq("user_id", input.userId)
    .eq("date", input.date)
    .maybeSingle()
  if (findErr) throw new Error(`postAnswer/find: ${findErr.message}`)

  let answerId: string
  if (existing) {
    const { error: uErr } = await supabase
      .from("answers")
      .update(row)
      .eq("id", (existing as { id: string }).id)
    if (uErr) throw new Error(`postAnswer/update: ${uErr.message}`)
    answerId = (existing as { id: string }).id
  } else {
    const { data: answer, error: aErr } = await supabase
      .from("answers")
      .insert(row)
      .select("id")
      .single()
    if (aErr) throw new Error(`postAnswer: ${aErr.message}`)
    answerId = (answer as { id: string }).id
  }

  // Reconcile the audience instead of blindly inserting: on an edit the answer is
  // already shared, and idx_messages_answer_group is unique per (answer, group).
  const { data: shareRows, error: sReadErr } = await supabase
    .from("answer_shares")
    .select("group_id")
    .eq("answer_id", answerId)
  if (sReadErr) throw new Error(`postAnswer/shares-read: ${sReadErr.message}`)

  const current = new Set((shareRows ?? []).map((s) => (s as { group_id: string }).group_id))
  const wanted = new Set(input.groupIds)
  const toAdd = input.groupIds.filter((g) => !current.has(g))
  const toRemove = [...current].filter((g) => !wanted.has(g))

  if (toRemove.length > 0) {
    // Drop the answer message too, or the group keeps showing an answer that is
    // no longer shared with it.
    const { error: mDelErr } = await supabase
      .from("messages")
      .delete()
      .eq("answer_id", answerId)
      .in("group_id", toRemove)
    if (mDelErr) throw new Error(`postAnswer/messages-remove: ${mDelErr.message}`)

    const { error: sDelErr } = await supabase
      .from("answer_shares")
      .delete()
      .eq("answer_id", answerId)
      .in("group_id", toRemove)
    if (sDelErr) throw new Error(`postAnswer/shares-remove: ${sDelErr.message}`)
  }

  if (toAdd.length > 0) {
    const { error: sErr } = await supabase
      .from("answer_shares")
      .insert(toAdd.map((group_id) => ({ answer_id: answerId, group_id })))
    if (sErr) throw new Error(`postAnswer/shares: ${sErr.message}`)

    const { error: mErr } = await supabase.from("messages").insert(
      toAdd.map((group_id) => ({
        group_id,
        thread_date: input.date,
        kind: "answer" as const,
        user_id: input.userId,
        answer_id: answerId,
        mentions: input.mentions ?? [],
      }))
    )
    if (mErr) throw new Error(`postAnswer/messages: ${mErr.message}`)
  }

  return answerId
}

export async function sendMessage(input: {
  groupId: string
  threadDate: string
  userId: string
  text?: string | null
  mediaUrls?: string[]
  mediaTypes?: MediaType[]
  mentions?: string[]
  replyToMessageId?: string | null
}): Promise<string> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      group_id: input.groupId,
      thread_date: input.threadDate,
      kind: "chat",
      user_id: input.userId,
      text: input.text ?? null,
      media_urls: input.mediaUrls ?? null,
      media_types: input.mediaTypes ?? null,
      mentions: input.mentions ?? [],
      reply_to_message_id: input.replyToMessageId ?? null,
    })
    .select("id")
    .single()
  if (error) throw new Error(`sendMessage: ${error.message}`)
  return (data as { id: string }).id
}

/**
 * Rewrites a chat message in place, keeping its slot in the timeline.
 *
 * Goes through an RPC rather than a PostgREST .update() because RLS is off on
 * this database: the function's author check is the only thing stopping a client
 * from editing someone else's message.
 */
export async function editMessage(input: {
  messageId: string
  userId: string
  text?: string | null
  mediaUrls?: string[] | null
  mediaTypes?: MediaType[] | null
  mentions?: string[]
}): Promise<void> {
  const { data, error } = await supabase.rpc("v2_edit_message", {
    p_message_id: input.messageId,
    p_user_id: input.userId,
    p_text: input.text ?? null,
    p_media_urls: input.mediaUrls ?? null,
    p_media_types: input.mediaTypes ?? null,
    p_mentions: input.mentions ?? [],
  })
  if (error) throw new Error(`editMessage: ${error.message}`)
  const res = data as { ok?: boolean; error?: string } | null
  // The RPC reports refusals in its payload, not as a Postgres error, so without
  // this an edit that was rejected would look like it succeeded.
  if (!res?.ok) throw new Error(`editMessage: ${res?.error ?? "failed"}`)
}

/** Toggles one emoji for one user on one message. Unlike v1, several emoji per user are allowed. */
export async function toggleReaction(messageId: string, userId: string, emoji: string) {
  const { data: existing } = await supabase
    .from("message_reactions")
    .select("id")
    .eq("message_id", messageId)
    .eq("user_id", userId)
    .eq("emoji", emoji)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from("message_reactions")
      .delete()
      .eq("id", (existing as { id: string }).id)
    if (error) throw new Error(`toggleReaction/remove: ${error.message}`)
    return false
  }

  const { error } = await supabase
    .from("message_reactions")
    .insert({ message_id: messageId, user_id: userId, emoji })
  if (error) throw new Error(`toggleReaction/add: ${error.message}`)
  return true
}

export async function markThreadRead(userId: string, groupId: string, threadDate: string) {
  const { error } = await supabase.rpc("v2_mark_thread_read", {
    p_user_id: userId,
    p_group_id: groupId,
    p_thread_date: threadDate,
  })
  if (error) console.warn("[v2] markThreadRead failed:", error.message)
}

export async function updateAnswerShares(answerId: string, userId: string, groupIds: string[]) {
  const { data: existing } = await supabase
    .from("answer_shares")
    .select("group_id")
    .eq("answer_id", answerId)
  const have = new Set(((existing ?? []) as { group_id: string }[]).map((r) => r.group_id))
  const want = new Set(groupIds)

  const toAdd = groupIds.filter((g) => !have.has(g))
  const toRemove = [...have].filter((g) => !want.has(g))

  if (toAdd.length) {
    await supabase.from("answer_shares").insert(toAdd.map((group_id) => ({ answer_id: answerId, group_id })))
    await supabase.from("messages").insert(
      toAdd.map((group_id) => ({
        group_id,
        thread_date: getTodayDate(),
        kind: "answer" as const,
        user_id: userId,
        answer_id: answerId,
      }))
    )
  }
  if (toRemove.length) {
    await supabase.from("answer_shares").delete().eq("answer_id", answerId).in("group_id", toRemove)
    await supabase.from("messages").delete().eq("answer_id", answerId).in("group_id", toRemove)
  }
}

export type RangeQuestion = { prompt_id: string; text: string; answered: boolean }

/**
 * Questions for a span of days, keyed by ISO date.
 *
 * The Today pager renders several days side by side; without this only the active
 * day had a question and every other page was blank.
 */
/** Unseen messages across every group and recent day — powers the header badge. */
export async function getUnseenTotal(userId: string): Promise<number> {
  const { data, error } = await supabase.rpc("v2_unseen_total", { p_user_id: userId })
  if (error) throw new Error(`getUnseenTotal: ${error.message}`)
  return (data as number) ?? 0
}

export async function getQuestionsForRange(
  userId: string,
  from: string,
  to: string
): Promise<Record<string, RangeQuestion>> {
  const { data, error } = await supabase.rpc("v2_get_questions_for_range", {
    p_user_id: userId,
    p_from: from,
    p_to: to,
  })
  return unwrap<Record<string, RangeQuestion>>(data, error, "getQuestionsForRange")
}

/** Marks every visible thread read. Powers History's "Clear unseen". */
export async function markAllRead(userId: string, groupId?: string | null): Promise<number> {
  const { data, error } = await supabase.rpc("v2_mark_all_read", {
    p_user_id: userId,
    p_group_id: groupId ?? undefined,
  })
  if (error) throw new Error(`markAllRead: ${error.message}`)
  return (data as number) ?? 0
}
