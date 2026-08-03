import { Redirect } from "expo-router"

/**
 * Entry point into the v2 onboarding flow while v1 remains the default boot path.
 *
 * Open with `goodtimes://onboard`, or `goodtimes://onboard?invite=GT-7F3K` to
 * exercise the invited variant. Delete at cutover, when app/index.tsx routes new
 * users straight into (onboarding-v2).
 */
export default function OnboardEntry() {
  return <Redirect href="/(onboarding-v2)/splash" />
}
