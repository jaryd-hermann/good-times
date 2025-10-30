import * as Notifications from "expo-notifications"
import { Platform } from "react-native"
import { supabase } from "./supabase"

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export async function registerForPushNotifications(): Promise<string | null> {
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

  if (finalStatus !== "granted") {
    return null
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data
  return token
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
