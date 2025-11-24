import * as Notifications from "expo-notifications"
import { Platform } from "react-native"
import { supabase } from "./supabase"
import { captureEvent } from "./posthog"

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#de2f08",
      })
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    // Track notification permission result
    try {
      if (finalStatus === "granted") {
        captureEvent("notification_permission_granted")
      } else {
        captureEvent("notification_permission_denied")
      }
    } catch (error) {
      // Never let PostHog errors affect notification flow
      if (__DEV__) console.error("[notifications] Failed to track permission event:", error)
    }

    // If permission not granted, return null (not an error - user's choice)
    if (finalStatus !== "granted") {
      return null
    }

    // Permission granted - try to get token
    // This can throw if there's a network/config issue, but permission was granted
    try {
      const token = (await Notifications.getExpoPushTokenAsync()).data
      return token
    } catch (tokenError) {
      // Permission was granted but getting token failed
      // This is a real error that should be handled by caller
      console.error("[notifications] Failed to get push token after permission granted:", tokenError)
      throw tokenError
    }
  } catch (error) {
    // Only re-throw if it's not a permission denial
    // Permission denial is handled above by returning null
    console.error("[notifications] Error in registerForPushNotifications:", error)
    throw error
  }
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
