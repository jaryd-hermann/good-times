import { View, ActivityIndicator, StyleSheet } from "react-native"
import { Redirect, useLocalSearchParams } from "expo-router"
import { useAuth } from "../../components/AuthProvider"

/**
 * `/join/<token>` — hand-off to the v2 invite flow.
 *
 * This used to be v1's full join screen, and Expo Router matches a deep link to a
 * route file BEFORE any manual Linking listener runs. So `goodtimes://join/GT-97DP`
 * landed here rather than in the handler in app/_layout.tsx, and this screen looked
 * the segment up as `groups.id` — a uuid column — producing:
 *
 *   invalid input syntax for type uuid: "GT-97DP"
 *
 * The segment is now treated as an opaque invite token and passed along, which is
 * what v2 issues. Signed-in users get the accept/decline screen; signed-out users
 * see the splash with the invite peeked, and join after creating an account.
 *
 * The v1 implementation is in git (38b6f70) if any of it is ever wanted back.
 */
export default function JoinRedirect() {
  const { groupId } = useLocalSearchParams<{ groupId?: string }>()
  const { user, loading, restoringSession } = useAuth()

  // Wait for auth before choosing — guessing would push a signed-in user through
  // sign-up, or strand a signed-out one on a screen that needs a session.
  if (loading || restoringSession) {
    return (
      <View style={s.wrap}>
        <ActivityIndicator />
      </View>
    )
  }

  if (!groupId) return <Redirect href="/(v2)/today" />

  return user ? (
    <Redirect href={{ pathname: "/(onboarding-v2)/invite", params: { token: groupId } }} />
  ) : (
    <Redirect href={{ pathname: "/(onboarding-v2)/splash", params: { invite: groupId } }} />
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#E8E0D5" },
})
