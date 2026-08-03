import Constants from "expo-constants"
import { NativeModules } from "react-native"

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
 * The JS SDK wires up its listeners as soon as the package is required, so a native
 * layer that does not match the JS package crashes inside `require()`. Probe first
 * and skip loading the SDK unless the two agree.
 *
 * This check is version-shaped, and getting it wrong fails silently — the app runs
 * fine and simply never registers anyone for push.
 *
 * react-native-onesignal >= 5.4.0 declares its events as codegen `EventEmitter`
 * properties, which only exist under the New Architecture. This app runs the old
 * architecture (`newArchEnabled: false`), so 5.4.x can never work here: the probe
 * that used to look for `onPermissionChanged` / `onSubscriptionChanged` always
 * returned false and OneSignal was disabled on every single build.
 *
 * We are pinned to 5.3.6, the last release with a legacy path. It resolves the
 * module through `NativeModules.OneSignal` (iOS registers `RCTOneSignal`; React
 * Native strips the `RCT` prefix) and delivers events over `NativeEventEmitter`,
 * so there are no `onXxx` methods to look for — checking for them is exactly the
 * bug. Only the imperative methods exist.
 *
 * If you ever bump react-native-onesignal, re-check this function against the new
 * package's `dist/` rather than assuming it still holds.
 */
export function isOneSignalNativeModuleCompatible(): boolean {
  try {
    const mod = (NativeModules as Record<string, unknown>)?.OneSignal as
      | Record<string, unknown>
      | null
      | undefined
    if (!mod || typeof mod !== "object") return false
    // The imperative surface the SDK calls into. `addPermissionObserver` is what
    // 5.3.x uses to back its permission events, so its presence is what tells us
    // the native layer is the matching generation.
    if (typeof mod.initialize !== "function") return false
    if (typeof mod.addPermissionObserver !== "function") return false
    if (typeof mod.login !== "function") return false
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
      "[onesignal] NativeModules.OneSignal is absent or does not expose the expected 5.3.x API, so the JS SDK was not loaded and nobody will be registered for push. Rebuild after `pod install` / an EAS iOS build so native matches react-native-onesignal in package.json.",
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
