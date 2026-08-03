import { Stack } from "expo-router"

/**
 * v2 onboarding shell — 5 screens, answer-first (decision 14).
 *
 * v1 was 13 screens (15 with the memorial branch) and put group creation and a
 * full profile ahead of any value. Here the first answer is step 4, before the
 * user has a group at all — possible only because v2 resolves one global question
 * per date, so a groupless user still has something to answer.
 */
export default function OnboardingV2Layout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="splash" />
      <Stack.Screen name="auth" options={{ animation: "slide_from_bottom" }} />
      <Stack.Screen name="profile" />
      <Stack.Screen name="alone" />
      <Stack.Screen name="join" options={{ presentation: "modal" }} />
    </Stack>
  )
}
