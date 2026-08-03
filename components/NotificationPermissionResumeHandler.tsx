"use client"

import { useEffect, useRef } from "react"
import { AppState, type AppStateStatus, Alert, Linking } from "react-native"
import * as Notifications from "expo-notifications"
import { useAuth } from "./AuthProvider"
import { registerForPushNotifications, savePushRegistrationToSupabase } from "../lib/notifications"

/** iOS may not reflect Settings changes until shortly after returning to the app. */
const PERMISSION_RECHECK_DELAY_MS = 450
/** Avoid nagging if the user leaves notifications off and switches apps often. */
const OPEN_SETTINGS_ALERT_COOLDOWN_MS = 5 * 60 * 1000

async function syncPushRegistration(userId: string) {
  const registration = await registerForPushNotifications({ linkSupabaseUserId: userId })
  if (registration.expoPushToken || registration.oneSignalSubscriptionId) {
    await savePushRegistrationToSupabase(userId, registration)
  }
}

/**
 * When the user returns from the background (e.g. after changing notification toggles in
 * Settings), re-check permission: if granted, refresh push registration; if not, request the
 * system prompt when possible, otherwise offer to open Settings.
 */
export function NotificationPermissionResumeHandler() {
  const { user } = useAuth()
  const userId = user?.id
  const appStateRef = useRef<AppStateStatus>(AppState.currentState)
  const lastOpenSettingsAlertAtRef = useRef(0)

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      const prev = appStateRef.current
      appStateRef.current = nextAppState

      if (nextAppState === "background" || nextAppState === "inactive") {
        return
      }

      if (nextAppState !== "active") return
      if (prev !== "background" && prev !== "inactive") return

      const run = async () => {
        await new Promise((r) => setTimeout(r, PERMISSION_RECHECK_DELAY_MS))

        let { status } = await Notifications.getPermissionsAsync()
        if (status === "granted") {
          if (userId) {
            try {
              await syncPushRegistration(userId)
            } catch (e) {
              if (__DEV__) console.warn("[NotificationPermissionResumeHandler] sync after grant failed:", e)
            }
          }
          return
        }

        const requested = await Notifications.requestPermissionsAsync()
        status = requested.status

        if (status === "granted") {
          if (userId) {
            try {
              await syncPushRegistration(userId)
            } catch (e) {
              if (__DEV__) console.warn("[NotificationPermissionResumeHandler] sync after request grant failed:", e)
            }
          }
          return
        }

        if (status === "undetermined") {
          return
        }

        const now = Date.now()
        if (now - lastOpenSettingsAlertAtRef.current < OPEN_SETTINGS_ALERT_COOLDOWN_MS) {
          return
        }
        lastOpenSettingsAlertAtRef.current = now

        Alert.alert(
          "Notifications",
          "To get reminders for daily questions and activity, turn on notifications for Good Times in Settings.",
          [
            { text: "Not now", style: "cancel" },
            { text: "Open Settings", onPress: () => void Linking.openSettings() },
          ],
        )
      }

      void run()
    })

    return () => subscription.remove()
  }, [userId])

  return null
}
