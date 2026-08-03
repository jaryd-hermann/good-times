import * as Notifications from "expo-notifications"
import { Platform } from "react-native"
import { router } from "expo-router"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { supabase } from "./supabase"
import { captureEvent } from "./posthog"
import { ensureOneSignalInitialized, getOneSignalAppId, isOneSignalNativeModuleCompatible } from "./onesignal"

/** Set in AsyncStorage after we attempt Expo + OneSignal registration (success or deny). Bump value to re-run for all users after changing push logic. */
export const PUSH_CHANNELS_REGISTERED_KEY = "push_channels_registered"
export const PUSH_CHANNELS_DONE_VALUE = "expo_onesignal_v1"

/**
 * Set only when the user has actually asked for notifications — i.e. tapped the
 * CTA on the onboarding notifications screen.
 *
 * iOS gives an app exactly one shot at the system permission dialog, so it must
 * be spent on a screen that has explained what the notifications are for. The
 * resume handler used to fire the prompt on any inactive→active transition,
 * which on a fresh install happens during launch — so the OS dialog appeared
 * over the splash screen before the user had seen anything at all.
 */
const PUSH_OPT_IN_REQUESTED_KEY = "push_opt_in_requested"

export async function markPushOptInRequested(): Promise<void> {
  await AsyncStorage.setItem(PUSH_OPT_IN_REQUESTED_KEY, "true")
}

export async function hasRequestedPushOptIn(): Promise<boolean> {
  return (await AsyncStorage.getItem(PUSH_OPT_IN_REQUESTED_KEY)) === "true"
}

/**
 * Whether home/history should call `registerForPushNotifications`.
 * iOS only shows Settings → Notifications for the app after the first permission request.
 * If `push_channels_registered` was restored from a device backup but this install never
 * asked the OS (`status === "undetermined"`), we must still run registration — otherwise
 * users see no prompt and no notification toggles for the app.
 */
export async function needsPushRegistrationAttempt(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync()
  if (status === "undetermined") {
    return true
  }
  const pushChannelsDone = await AsyncStorage.getItem(PUSH_CHANNELS_REGISTERED_KEY)
  return pushChannelsDone !== PUSH_CHANNELS_DONE_VALUE
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

async function ensureAndroidDefaultChannel() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#de2f08",
    })
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function registerWithOneSignal(): Promise<string | null> {
  await ensureAndroidDefaultChannel()
  if (!ensureOneSignalInitialized()) {
    console.log("[ONESIGNAL] registerWithOneSignal skipped (init returned false — see [onesignal] warnings above)")
    return null
  }
  const { OneSignal } = require("react-native-onesignal") as typeof import("react-native-onesignal")

  // requestPermission resolves false when it did not actually put a dialog on
  // screen — including the case where permission is ALREADY granted. Trusting it
  // meant returning null here, skipping optIn() and the subscription-id capture
  // below, while OneSignal.login() further up the caller still ran. That is how a
  // user ends up correctly linked in OneSignal by external_id with a live push
  // subscription, yet with no row in push_tokens and therefore no welcome push.
  //
  // Ask for the real state afterwards and go by that.
  const requested = await OneSignal.Notifications.requestPermission(false)
  const granted = requested || (await OneSignal.Notifications.getPermissionAsync())

  try {
    captureEvent(granted ? "notification_permission_granted" : "notification_permission_denied")
  } catch (error) {
    if (__DEV__) console.error("[notifications] Failed to track permission event:", error)
  }

  if (!granted) {
    return null
  }

  OneSignal.User.pushSubscription.optIn()

  let subscriptionId: string | null = null
  for (let i = 0; i < 20; i++) {
    subscriptionId = await OneSignal.User.pushSubscription.getIdAsync()
    if (subscriptionId) break
    await sleep(400)
  }

  const token = await OneSignal.User.pushSubscription.getTokenAsync()
  const optedIn = await OneSignal.User.pushSubscription.getOptedInAsync()
  const state = {
    subscriptionId: subscriptionId ?? "(null — check APNs/FCM in OneSignal dashboard)",
    hasToken: !!token,
    optedIn,
  }
  if (__DEV__ || !subscriptionId) {
    console.log("[notifications] OneSignal push state:", state)
  }

  if (!subscriptionId) {
    console.warn(
      "[notifications] OneSignal: permission granted but subscription id still null after wait — confirm Apple Push (or FCM) is configured for this OneSignal app and ONESIGNAL_APS_MODE matches how you installed the build.",
    )
  }
  return subscriptionId
}

async function registerWithExpoPush(): Promise<string | null> {
  await ensureAndroidDefaultChannel()

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  try {
    if (finalStatus === "granted") {
      captureEvent("notification_permission_granted")
    } else {
      captureEvent("notification_permission_denied")
    }
  } catch (error) {
    if (__DEV__) console.error("[notifications] Failed to track permission event:", error)
  }

  if (finalStatus !== "granted") {
    return null
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data
    return token
  } catch (tokenError) {
    console.error("[notifications] Failed to get push token after permission granted:", tokenError)
    throw tokenError
  }
}

/** Expo token for transactional pushes; OneSignal subscription id for marketing (dashboard / OneSignal API). */
export type PushRegistrationResult = {
  expoPushToken: string | null
  oneSignalSubscriptionId: string | null
}

export type RegisterPushOptions = {
  /** When set, calls `OneSignal.login` so the device appears under this id in OneSignal (recommended). */
  linkSupabaseUserId?: string
}

/**
 * Registers both channels when configured: Expo (always) for your edge functions + DB tokens,
 * then OneSignal when `EXPO_PUBLIC_ONESIGNAL_APP_ID` is present for marketing.
 */
export async function registerForPushNotifications(
  options?: RegisterPushOptions,
): Promise<PushRegistrationResult> {
  try {
    const hasAppId = !!getOneSignalAppId()
    const nativeOk = isOneSignalNativeModuleCompatible()
    console.log("[ONESIGNAL] registerForPushNotifications", {
      hasAppId,
      nativeModuleCompatible: nativeOk,
      willRunOneSignalPath: hasAppId,
    })

    const expoPushToken = await registerWithExpoPush()

    let oneSignalSubscriptionId: string | null = null
    if (getOneSignalAppId()) {
      oneSignalSubscriptionId = await registerWithOneSignal()
    } else {
      console.log("[ONESIGNAL] OneSignal path not run — no app id (EXPO_PUBLIC_ONESIGNAL_APP_ID / extra).")
    }

    if (options?.linkSupabaseUserId && getOneSignalAppId() && ensureOneSignalInitialized()) {
      try {
        const { OneSignal } = require("react-native-onesignal") as typeof import("react-native-onesignal")
        OneSignal.login(options.linkSupabaseUserId)
      } catch (e) {
        if (__DEV__) console.warn("[notifications] OneSignal.login failed:", e)
      }
    }

    if (getOneSignalAppId() && expoPushToken && !oneSignalSubscriptionId) {
      console.warn(
        "[ONESIGNAL] Expo token OK but no OneSignal subscription id yet — check APNs/FCM in OneSignal dashboard and ONESIGNAL_APS_MODE vs build type.",
      )
    }

    console.log("[ONESIGNAL] registerForPushNotifications finished", {
      expoOk: !!expoPushToken,
      oneSignalSubscriptionOk: !!oneSignalSubscriptionId,
    })

    return { expoPushToken, oneSignalSubscriptionId }
  } catch (error) {
    console.error("[notifications] Error in registerForPushNotifications:", error)
    throw error
  }
}

/** Upserts Expo + OneSignal tokens as separate rows (different `token` values). */
export async function savePushRegistrationToSupabase(userId: string, result: PushRegistrationResult) {
  if (result.expoPushToken) await savePushToken(userId, result.expoPushToken)
  if (result.oneSignalSubscriptionId) await savePushToken(userId, result.oneSignalSubscriptionId)
}

export async function savePushToken(userId: string, token: string) {
  const { error } = await supabase.from("push_tokens").upsert(
    {
      user_id: userId,
      token,
    },
    {
      onConflict: "token",
    },
  )

  if (error) throw error
}

/** Removes all push tokens for a user so server sends will skip them. */
export async function deletePushTokensForUser(userId: string) {
  const { error } = await supabase.from("push_tokens").delete().eq("user_id", userId)
  if (error) throw error
}

export async function scheduleLocalNotification(title: string, body: string, data?: any) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
    },
    trigger: null,
  })
}

/** Shared handler for Expo remote notifications and OneSignal notification taps (same `additionalData` shape as Expo `data`). */
export async function handlePushNotificationOpen(data: Record<string, unknown> | object | undefined) {
  if (!data || typeof data !== "object") return

  const { type, group_id, entry_id, prompt_id, thread_date } = data as Record<string, unknown>
  if (type == null) return

  /**
   * v2 destinations, checked before the v1 branches below.
   *
   * Every v2 notification is about one thread on one day, so it opens that
   * thread — except the daily question and the first-answer nudge, which are
   * about answering and open Capture. Without this, tapping a v2 notification
   * fell through to the v1 branches and landed in the old app.
   */
  const V2_THREAD_TYPES = new Set([
    "new_answer",
    "thread_message",
    "reaction",
    "reply_to_you",
    "mention",
    "birthday",
  ])

  if (V2_THREAD_TYPES.has(String(type)) && group_id) {
    setTimeout(() => {
      router.push({
        pathname: "/(v2)/thread",
        params: {
          groupId: String(group_id),
          date: thread_date ? String(thread_date) : new Date().toISOString().split("T")[0],
        },
      })
    }, 300)
    return
  }

  if (type === "v2_daily_question" || type === "v2_first_answer_nudge") {
    setTimeout(() => router.push("/(v2)/today"), 300)
    return
  }

  // The activation series exists to get a groupless user into a group, so it
  // lands on create/join. If that route can't resolve for any reason, Capture is
  // the safe floor — never a dead tap.
  if (type === "v2_group_nudge") {
    setTimeout(() => {
      try {
        router.push("/(onboarding-v2)/alone")
      } catch {
        router.push("/(v2)/today")
      }
    }, 300)
    return
  }

  console.log("[notifications] Push opened — storing for boot screen to handle")

  let shouldNavigateDirectly = false

  try {
    await AsyncStorage.setItem(
      "pending_notification",
      JSON.stringify({
        type,
        group_id,
        entry_id,
        prompt_id,
        timestamp: Date.now(),
      }),
    )

    await AsyncStorage.setItem("notification_clicked", "true")
    console.log("[notifications] Push payload stored, boot screen will run if needed")

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const isAppInitialized = !!session

      if (isAppInitialized) {
        console.log("[notifications] Session present — navigating from push tap")
        shouldNavigateDirectly = true
      } else {
        console.log("[notifications] Cold start — boot screen will handle navigation")
        return
      }
    } catch {
      console.log("[notifications] Session check failed — boot screen will handle navigation")
      return
    }
  } catch (error) {
    console.error("[notifications] Error storing push payload:", error)
    return
  }

  if (!shouldNavigateDirectly) return

  setTimeout(() => {
    /**
     * Legacy v1 notification types, landed in a v2 binary.
     *
     * v1's crons keep firing until cutover, so a v2 user can still receive
     * daily_prompt / new_entry / new_comment / member_joined / inactivity_reminder.
     * These used to open (main) routes, which no longer exist in this build — so
     * they map onto the nearest v2 destination instead of dead-ending.
     */
    const today = new Date().toISOString().split("T")[0]

    if (type === "new_entry" && group_id) {
      // We have the group; the v1 entry id has no v2 equivalent to deep link to.
      router.push({
        pathname: "/(v2)/thread",
        params: { groupId: String(group_id), date: today },
      })
    } else {
      // daily_prompt, new_comment, member_joined, inactivity_reminder — all are
      // "come back to the app" nudges with no precise v2 target.
      router.push("/(v2)/today")
    }
  }, 300)
}
