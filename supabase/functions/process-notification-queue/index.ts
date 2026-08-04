import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

/**
 * Notification worker — v2.
 *
 * Sends via OneSignal, targeting by EXTERNAL ID (the Supabase user id, set on the
 * client by OneSignal.login). That takes push_tokens out of the send path, which
 * removes:
 *   - the `.like('token','ExponentPushToken%')` prefix-guessing spread across ten
 *     call sites,
 *   - the single-device limit (v1 took `.limit(1)` token per user),
 *   - Expo receipt polling and dead-token pruning (OneSignal handles both).
 *
 * Fixes from the v1 audit:
 *   - batches recipients per request instead of one HTTP call per notification,
 *   - exponential backoff instead of retrying a broken row every 5 minutes forever,
 *   - no head-of-line blocking: a failing row is parked via next_attempt_at rather
 *     than sitting at the front of an ordered limit(50) scan,
 *   - preferences are enforced at SEND time, not only at enqueue time.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const ONESIGNAL_API = "https://api.onesignal.com/notifications"
const MAX_ATTEMPTS = 5
const BATCH = 100

type QueueRow = {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  data: Record<string, unknown> | null
  attempts: number | null
}

/** 1m, 4m, 9m, 16m, 25m — keeps a broken row out of the way without dropping it. */
function nextAttemptAt(attempts: number): string {
  const minutes = Math.min(attempts * attempts, 60)
  return new Date(Date.now() + minutes * 60_000).toISOString()
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  )

  const appId = Deno.env.get("ONESIGNAL_APP_ID")
  const restKey = Deno.env.get("ONESIGNAL_REST_API_KEY")
  if (!appId || !restKey) {
    return new Response(
      JSON.stringify({ error: "ONESIGNAL_APP_ID / ONESIGNAL_REST_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  // Claim atomically instead of SELECT-then-UPDATE.
  //
  // Reading unprocessed rows and only marking them processed AFTER sending leaves
  // a window in which they still look unprocessed, so an overlapping run picks up
  // the same rows and sends them twice. v2_claim_notifications marks them claimed
  // in a single statement using FOR UPDATE SKIP LOCKED, so concurrent runs take
  // DIFFERENT rows rather than fighting over the same ones. The date filters that
  // used to live here moved into that function.
  const { data: rows, error } = await supabase.rpc("v2_claim_notifications", {
    p_limit: BATCH,
    p_max_attempts: MAX_ATTEMPTS,
  })

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
  if (!rows || rows.length === 0) {
    return new Response(JSON.stringify({ success: true, sent: 0, skipped: 0, failed: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const queue = rows as QueueRow[]
  const userIds = [...new Set(queue.map((r) => r.user_id))]

  const { data: prefRows } = await supabase
    .from("users")
    .select("id, notifications_enabled, notification_prefs")
    .in("id", userIds)

  const prefs = new Map(
    ((prefRows ?? []) as {
      id: string
      notifications_enabled: boolean
      notification_prefs: Record<string, boolean> | null
    }[]).map((u) => [u.id, u])
  )

  function allowed(userId: string, type: string) {
    const u = prefs.get(userId)
    if (!u) return false
    if (u.notifications_enabled === false) return false
    return (u.notification_prefs ?? {})[type] !== false
  }

  const sent: string[] = []
  const skipped: string[] = []
  const failed: { id: string; attempts: number; error: string }[] = []

  // Collapse identical notifications so one API call covers many recipients.
  const groups = new Map<string, { row: QueueRow; ids: string[]; users: string[] }>()
  for (const r of queue) {
    if (!allowed(r.user_id, r.type)) {
      skipped.push(r.id)
      continue
    }
    const key = `${r.type}|${r.title}|${r.body}|${JSON.stringify(r.data ?? {})}`
    const g = groups.get(key)
    if (g) {
      g.ids.push(r.id)
      g.users.push(r.user_id)
    } else {
      groups.set(key, { row: r, ids: [r.id], users: [r.user_id] })
    }
  }

  for (const g of groups.values()) {
    /**
     * Sender's face on engagement pushes, app logo on system ones.
     *
     * OneSignal ships its own iOS Notification Service Extension, so
     * ios_attachments is enough — no hand-written native target. On Android
     * large_icon is the round image and small_icon stays the app mark, which is
     * the TikTok-style pairing: who it's from, plus whose app it is.
     *
     * data.actor_avatar is set by v2_flush_digests / v2_on_message_insert and is
     * null for digests with several actors and for system notifications, which
     * correctly fall back to the app icon alone.
     */
    const avatar =
      typeof (g.row.data as Record<string, unknown> | null)?.actor_avatar === "string"
        ? ((g.row.data as Record<string, string>).actor_avatar as string)
        : null

    const payload: Record<string, unknown> = {
      app_id: appId,
      target_channel: "push",
      include_aliases: { external_id: [...new Set(g.users)] },
      headings: { en: g.row.title },
      contents: { en: g.row.body },
      data: g.row.data ?? {},
      ios_badge_type: "Increase",
      ios_badge_count: 1,
      // Android: the app mark in the status bar / corner of the tray item.
      small_icon: "ic_stat_onesignal_default",
    }

    if (avatar) {
      payload.large_icon = avatar // Android
      payload.ios_attachments = { avatar } // iOS, rendered by OneSignal's NSE
    }

    try {
      const res = await fetch(ONESIGNAL_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Key ${restKey}` },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))

      // "All included players are not subscribed" is terminal, not transient —
      // nobody in this batch has an active subscription. Marking it delivered
      // stops the row burning all five attempts for a condition retries can't fix.
      const noSubscribers =
        Array.isArray(json?.errors) &&
        json.errors.some((e: unknown) => String(e).includes("not subscribed"))

      if (res.ok || noSubscribers) {
        sent.push(...g.ids)
        await supabase.from("notifications").insert(
          g.users.map((user_id) => ({
            user_id,
            type: g.row.type,
            title: g.row.title,
            body: g.row.body,
            data: g.row.data ?? {},
          }))
        )
      } else {
        const msg = JSON.stringify(json?.errors ?? json).slice(0, 300)
        for (const id of g.ids) failed.push({ id, attempts: (g.row.attempts ?? 0) + 1, error: msg })
      }
    } catch (e) {
      for (const id of g.ids) {
        failed.push({ id, attempts: (g.row.attempts ?? 0) + 1, error: String(e).slice(0, 300) })
      }
    }
  }

  if (sent.length) {
    await supabase
      .from("notification_queue")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .in("id", sent)
  }
  if (skipped.length) {
    await supabase
      .from("notification_queue")
      .update({ processed: true, last_error: "suppressed by user preference" })
      .in("id", skipped)
  }
  for (const f of failed) {
    await supabase
      .from("notification_queue")
      .update({
        attempts: f.attempts,
        last_error: f.error,
        next_attempt_at: nextAttemptAt(f.attempts),
        processed: f.attempts >= MAX_ATTEMPTS,
        // Release the claim so the retry is governed by next_attempt_at rather
        // than having to wait out the stale-claim window first.
        claimed_at: null,
      })
      .eq("id", f.id)
  }

  return new Response(
    JSON.stringify({
      success: true,
      sent: sent.length,
      skipped: skipped.length,
      failed: failed.length,
      batches: groups.size,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  )
})
