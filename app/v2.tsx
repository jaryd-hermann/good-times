import { Redirect } from "expo-router"

/**
 * Entry point into the v2 shell while v1 is still the default.
 *
 * v2 lives in app/(v2)/ alongside the untouched app/(main)/, so the shipped app
 * keeps working. Reaching it needs an explicit route because app/index.tsx still
 * boots into (main).
 *
 * Open it with either:
 *   - deep link:  goodtimes://v2
 *   - dev server: press `j` for the debugger, or navigate to /v2
 *
 * Delete this file at cutover, when app/index.tsx boots into (v2) directly and
 * the kill list removes (main). See docs/V2_PLAN.md §10 phase 8.
 */
export default function V2Entry() {
  return <Redirect href="/(v2)/today" />
}
