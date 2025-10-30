import { Stack } from "expo-router"

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome-1" />
      <Stack.Screen name="welcome-2" />
      <Stack.Screen name="how-it-works" />
      <Stack.Screen name="about" />
      <Stack.Screen name="memorial" />
      <Stack.Screen name="memorial-preview" />
      <Stack.Screen name="create-group/name-type" />
      <Stack.Screen name="create-group/invite" />
      <Stack.Screen name="join-group" />
    </Stack>
  )
}
