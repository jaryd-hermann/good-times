import { useEffect, useState } from "react"
import { Stack, Redirect } from "expo-router"
import { View, ActivityIndicator } from "react-native"
import { useAuth } from "../../components/AuthProvider"
import { supabase } from "../../lib/supabase"
import { useV2Colors } from "../../lib/v2/theme"

/**
 * v2 shell — a Stack, not Tabs.
 *
 * There is no bottom app menu anywhere in v2. History is reached from the header
 * icon on Today and closes with its own back arrow; the composer and thread are
 * pushed screens. A tab bar under a chat composer or a camera viewfinder is just
 * in the way.
 *
 * The auth guard below is load-bearing. Signing out from the menu used to leave you
 * sitting inside v2 with no session: every screen kept rendering, its queries
 * silently disabled by `enabled: !!userId`, so you got a permanent spinner instead
 * of the splash. Guarding at the LAYOUT means any route into a signed-out state
 * bounces to onboarding — not just the one code path that happened to call
 * signOut().
 */
export default function V2Layout() {
  const { user, loading, restoringSession } = useAuth()
  const { c } = useV2Colors()

  /**
   * `user` going null is not sufficient grounds to eject someone.
   *
   * AuthProvider populates `user` from a `users` row fetch that can lag, time out,
   * or (before the SIGNED_IN fix) be skipped entirely. Redirecting on that alone
   * threw people back to the splash screen in the middle of a successful login.
   * Supabase's session is the real authority, so ask it before evicting anyone.
   */
  const [sessionState, setSessionState] = useState<"unknown" | "live" | "none">("unknown")

  useEffect(() => {
    if (user) {
      setSessionState("live")
      return
    }
    let cancelled = false
    supabase.auth
      .getSession()
      .then(({ data }) => !cancelled && setSessionState(data.session ? "live" : "none"))
      // A failed lookup is not proof of signing out — keep them where they are.
      .catch(() => !cancelled && setSessionState("live"))
    return () => {
      cancelled = true
    }
  }, [user])

  const settling = loading || restoringSession || (!user && sessionState === "unknown")

  if (settling) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: "center" }}>
        <ActivityIndicator color={c.text} />
      </View>
    )
  }

  if (!user && sessionState === "none") {
    return <Redirect href="/(onboarding-v2)/splash" />
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="today" />
      <Stack.Screen name="history" />
      <Stack.Screen name="thread" />
      <Stack.Screen name="menu" />
      <Stack.Screen name="feedback" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="compose" options={{ animation: "slide_from_bottom" }} />
    </Stack>
  )
}
