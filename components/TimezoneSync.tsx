import { useEffect, useRef } from "react"
import { useAuth } from "./AuthProvider"
import { supabase } from "../lib/supabase"

/**
 * Keeps users.timezone in step with the device.
 *
 * The column defaults to 'America/New_York' and NOTHING in the app has ever
 * written it — not the client, not an edge function, not a trigger. So every
 * account has carried that default regardless of where the person actually is,
 * and the handful of rows holding other zones were set outside the app entirely.
 *
 * That quietly undermines the local-time scheduling: v2_queue_daily_question fires
 * at 08:00 in the user's stored zone, so a user in London got the daily question at
 * 1pm and one stored as Asia/Shanghai received it at 8pm their time.
 *
 * Runs once per session per user, and only writes when the value actually differs
 * — so it is a no-op for the overwhelming majority of launches, and it self-heals
 * anyone whose stored zone is wrong or who has moved.
 */
export function TimezoneSync() {
  const { user } = useAuth()
  const userId = user?.id
  const syncedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!userId || syncedFor.current === userId) return
    syncedFor.current = userId

    let cancelled = false
    ;(async () => {
      try {
        // IANA zone, e.g. "Europe/London". Hermes on SDK 54 ships full ICU, so
        // this is a real zone rather than "UTC".
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
        if (!tz || cancelled) return

        const { data } = await supabase
          .from("users")
          .select("timezone")
          .eq("id", userId)
          .maybeSingle()
        if (cancelled) return

        const stored = (data as { timezone: string | null } | null)?.timezone
        if (stored === tz) return

        await supabase.from("users").update({ timezone: tz }).eq("id", userId)
      } catch (e) {
        // Never block a launch over this — a stale timezone only shifts when a
        // notification lands, it does not break the app.
        if (__DEV__) console.warn("[TimezoneSync] failed:", (e as Error).message)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userId])

  return null
}
