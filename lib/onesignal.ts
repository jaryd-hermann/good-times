import Constants from "expo-constants"
import { TurboModuleRegistry } from "react-native"

let initialized = false

/**
 * Release builds should inline `EXPO_PUBLIC_*` via Babel, but some EAS / config paths
 * only populate `app.config.ts` → `extra`. Read both so OneSignal always gets an app id.
 */
export function getOneSignalAppId(): string | undefined {
  const fromEnv = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) return fromEnv.trim()
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined
  const fromExtra = extra?.EXPO_PUBLIC_ONESIGNAL_APP_ID
  if (typeof fromExtra === "string" && fromExtra.trim().length > 0) return fromExtra.trim()
  return undefined
}

/**
 * The JS SDK loads native listeners as soon as the package is required. If the dev client
 * was built with an older OneSignal native layer, `onPermissionChanged` is missing and the
 * app crashes. Probe the TurboModule first and skip loading JS until native matches.
 */
export function isOneSignalNativeModuleCompatible(): boolean {
  try {
    const mod = TurboModuleRegistry.get("OneSignal") as Record<string, unknown> | null | undefined
    if (!mod || typeof mod !== "object") return false
    if (typeof mod.initialize !== "function") return false
    // `react-native-onesignal` registers listeners at require() time via these callables.
    // `addPermissionObserver` alone is NOT enough — missing `onPermissionChanged` crashes inside require().
    if (typeof mod.onPermissionChanged !== "function") return false
    if (typeof mod.onSubscriptionChanged !== "function") return false
    return true
  } catch {
    return false
  }
}

/** Call before other OneSignal APIs. Safe to call repeatedly. */
export function ensureOneSignalInitialized(): boolean {
  const appId = getOneSignalAppId()
  if (!appId) {
    console.warn(
      "[onesignal] OneSignal App ID missing at runtime (check process.env and app.config extra EXPO_PUBLIC_ONESIGNAL_APP_ID; rebuild after setting EAS env)."
    )
    return false
  }
  if (initialized) return true
  if (!isOneSignalNativeModuleCompatible()) {
    console.warn(
      "[onesignal] Native OneSignal is missing TurboModule APIs (e.g. onPermissionChanged). The JS SDK was not loaded. Rebuild the dev client after `pod install` / EAS iOS build so native matches react-native-onesignal in package.json. Simulator needs the same native build as device."
    )
    return false
  }
  try {
    const { OneSignal, LogLevel } = require("react-native-onesignal") as typeof import("react-native-onesignal")
    if (__DEV__) {
      OneSignal.Debug.setLogLevel(LogLevel.Verbose)
    }
    OneSignal.initialize(appId)
    initialized = true
    console.log(
      `[ONESIGNAL] SDK initialized (app id ${appId.slice(0, 8)}…). ${__DEV__ ? "Verbose native logs enabled in dev." : ""}`,
    )
    return true
  } catch (e) {
    console.error("[onesignal] OneSignal require/initialize failed:", e)
    return false
  }
}
