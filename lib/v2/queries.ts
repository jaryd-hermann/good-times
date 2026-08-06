import { useEffect } from "react"
import { AppState } from "react-native"
import { useQuery, useQueryClient, useMutation, type QueryClient } from "@tanstack/react-query"
import { supabase } from "../supabase"
import { getTodayDate } from "../utils"
import * as api from "./api"
import type { ChatListRow, HistoryRow, Thread, TodayHub } from "./types"

/**
 * v2 query layer.
 *
 * Deliberately NOT the v1 defaults. app/_layout.tsx sets staleTime: 0 +
 * refetchOnMount + refetchOnWindowFocus globally across 166 useQuery call sites,
 * so every screen focus refetches everything. Here each family gets a real
 * staleTime and freshness comes from Realtime invalidation instead.
 *
 * refetchOnMount stays TRUE (the default): it only refetches when a query is
 * STALE, so the staleTime above still does its job. Setting it to false meant an
 * inactive query that invalidateQueries had marked stale served its old cache
 * forever on remount — after editing an answer, the thread, Capture and the
 * composer each kept a different version of it.
 */

export const V2_STALE = {
  /** The question for a date never changes once resolved. */
  question: 1000 * 60 * 60,
  /** Hub counts move when others answer; Realtime invalidates on top of this. */
  hub: 1000 * 30,
  /** Open thread is Realtime-backed, so polling is unnecessary. */
  thread: 1000 * 60 * 5,
  chatList: 1000 * 30,
  history: 1000 * 60 * 2,
} as const

export const v2Keys = {
  hub: (userId: string, date: string) => ["v2", "hub", userId, date] as const,
  thread: (groupId: string, date: string) => ["v2", "thread", groupId, date] as const,
  chatList: (userId: string, date: string) => ["v2", "chatList", userId, date] as const,
  history: (userId: string, f: string) => ["v2", "history", userId, f] as const,
}

export function useTodayHub(userId: string | undefined, date = getTodayDate()) {
  return useQuery<TodayHub>({
    queryKey: v2Keys.hub(userId ?? "", date),
    queryFn: () => api.getTodayHub(userId!, date),
    enabled: !!userId,
    staleTime: V2_STALE.hub,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })
}

export function useThread(groupId: string | undefined, date: string, userId: string | undefined) {
  return useQuery<Thread>({
    queryKey: v2Keys.thread(groupId ?? "", date),
    queryFn: () => api.getThread(groupId!, date, userId!),
    enabled: !!groupId && !!userId,
    staleTime: V2_STALE.thread,
    // "always", not true. Realtime only runs while the thread screen is MOUNTED,
    // so a message that arrives while you sit on Today never invalidates this
    // key — and `true` refetches only when STALE, so a thread cached under 5
    // minutes ago served its old list on open. Today showed the new message and
    // the unread count, the thread itself did not, and only an app restart
    // reconciled them. Subscribing on mount does not backfill: the channel picks
    // up future inserts only.
    // Cached data still paints instantly; this refetches behind it.
    refetchOnMount: "always",
    refetchOnWindowFocus: false, // Realtime keeps this fresh; see AppState below
  })
}

export function useChatList(userId: string | undefined, date = getTodayDate()) {
  return useQuery<ChatListRow[]>({
    queryKey: v2Keys.chatList(userId ?? "", date),
    queryFn: () => api.getChatList(userId!, date),
    enabled: !!userId,
    staleTime: V2_STALE.chatList,
    refetchOnMount: true,
  })
}

export function useHistory(
  userId: string | undefined,
  opts: { groupId?: string | null; from?: string | null; to?: string | null; unseenOnly?: boolean } = {}
) {
  const fingerprint = JSON.stringify(opts)
  return useQuery<HistoryRow[]>({
    queryKey: v2Keys.history(userId ?? "", fingerprint),
    queryFn: () => api.getHistory(userId!, opts),
    enabled: !!userId,
    staleTime: V2_STALE.history,
    refetchOnMount: true,
  })
}

/**
 * Realtime subscription for one open thread.
 *
 * The app's first use of Supabase Realtime — v1 had zero `.channel()` calls and
 * refreshed purely by re-fetching on focus.
 */
export function useThreadRealtime(groupId: string | undefined, date: string) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!groupId) return
    const channel = supabase
      .channel(`thread:${groupId}:${date}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `group_id=eq.${groupId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as { thread_date?: string } | null
          if (row?.thread_date && row.thread_date !== date) return
          qc.invalidateQueries({ queryKey: v2Keys.thread(groupId, date) })
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        () => qc.invalidateQueries({ queryKey: v2Keys.thread(groupId, date) })
      )
      .subscribe()

    // The socket drops while the app is backgrounded and reconnects on return,
    // but anything sent during that gap is simply missed — Realtime does not
    // replay. Without this, sitting on a thread, backgrounding, and coming back
    // shows the same stale list refetchOnMount can't fix (the screen never
    // unmounted). refetchOnWindowFocus would be the idiomatic answer, but
    // TanStack's focusManager listens for a DOM visibilitychange that never
    // fires in React Native, so it is inert app-wide.
    const appState = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        qc.invalidateQueries({ queryKey: v2Keys.thread(groupId, date) })
      }
    })

    return () => {
      supabase.removeChannel(channel)
      appState.remove()
    }
  }, [groupId, date, qc])
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

function invalidateAfterWrite(qc: QueryClient, userId: string, groupIds: string[], date: string) {
  qc.invalidateQueries({ queryKey: ["v2", "hub", userId] })
  qc.invalidateQueries({ queryKey: ["v2", "chatList", userId] })
  qc.invalidateQueries({ queryKey: ["v2", "history", userId] })
  qc.invalidateQueries({ queryKey: ["v2", "unseenTotal", userId] })
  // The day dropdown's answered ticks come from here. Without this the day you
  // just answered kept showing as unanswered.
  qc.invalidateQueries({ queryKey: ["v2", "questionRange", userId] })
  groupIds.forEach((g) => qc.invalidateQueries({ queryKey: v2Keys.thread(g, date) }))
}

export function usePostAnswer(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<api.PostAnswerInput, "userId">) =>
      api.postAnswer({ ...input, userId: userId! }),
    onSuccess: (_id, input) => {
      if (userId) invalidateAfterWrite(qc, userId, input.groupIds, input.date)
    },
  })
}

export function useSendMessage(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<Parameters<typeof api.sendMessage>[0], "userId">) =>
      api.sendMessage({ ...input, userId: userId! }),
    onSuccess: (_id, input) => {
      if (userId) invalidateAfterWrite(qc, userId, [input.groupId], input.threadDate)
    },
  })
}

export function useToggleReaction(userId: string | undefined, groupId: string, date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      api.toggleReaction(messageId, userId!, emoji),
    // Optimistic: reactions must feel instant.
    onMutate: async ({ messageId, emoji }) => {
      const key = v2Keys.thread(groupId, date)
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<Thread>(key)
      if (prev) {
        qc.setQueryData<Thread>(key, {
          ...prev,
          messages: prev.messages.map((m) => {
            if (m.id !== messageId) return m
            const existing = m.reactions.find((r) => r.emoji === emoji)
            if (existing?.mine) {
              return {
                ...m,
                reactions: m.reactions
                  .map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, mine: false } : r))
                  .filter((r) => r.count > 0),
              }
            }
            if (existing) {
              return {
                ...m,
                reactions: m.reactions.map((r) =>
                  r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r
                ),
              }
            }
            return { ...m, reactions: [...m.reactions, { emoji, count: 1, mine: true }] }
          }),
        })
      }
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(v2Keys.thread(groupId, date), ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: v2Keys.thread(groupId, date) }),
  })
}

export function useMarkThreadRead(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ groupId, threadDate }: { groupId: string; threadDate: string }) =>
      api.markThreadRead(userId!, groupId, threadDate),
    onSuccess: () => {
      if (userId) {
        qc.invalidateQueries({ queryKey: ["v2", "hub", userId] })
        qc.invalidateQueries({ queryKey: ["v2", "chatList", userId] })
      }
    },
  })
}

/**
 * Unseen across ALL recent days, not just today.
 *
 * The header badge used to sum today's hub, so an unseen message on an older
 * thread showed in History and left the badge blank.
 */
export function useUnseenTotal(userId: string | undefined) {
  return useQuery({
    queryKey: ["v2", "unseenTotal", userId ?? ""],
    queryFn: () => api.getUnseenTotal(userId!),
    enabled: !!userId,
    staleTime: V2_STALE.chatList,
    refetchOnMount: true,
  })
}

/** Questions for the Today pager's whole visible window. */
export function useQuestionRange(userId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: ["v2", "questionRange", userId ?? "", from, to],
    queryFn: () => api.getQuestionsForRange(userId!, from, to),
    enabled: !!userId,
    staleTime: V2_STALE.question,
    refetchOnMount: true,
  })
}

export function useMarkAllRead(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (groupId?: string | null) => api.markAllRead(userId!, groupId),
    onSuccess: () => {
      if (!userId) return
      qc.invalidateQueries({ queryKey: ["v2", "history", userId] })
  qc.invalidateQueries({ queryKey: ["v2", "unseenTotal", userId] })
  // The day dropdown's answered ticks come from here. Without this the day you
  // just answered kept showing as unanswered.
  qc.invalidateQueries({ queryKey: ["v2", "questionRange", userId] })
      qc.invalidateQueries({ queryKey: ["v2", "hub", userId] })
      qc.invalidateQueries({ queryKey: ["v2", "chatList", userId] })
    },
  })
}
