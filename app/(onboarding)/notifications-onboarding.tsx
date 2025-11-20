"use client"

import { useState, useEffect } from "react"
import { Alert, Dimensions, ImageBackground, StyleSheet, Text, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useRouter } from "expo-router"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { colors, spacing, typography } from "../../lib/theme"
import { Button } from "../../components/Button"
import { registerForPushNotifications, savePushToken } from "../../lib/notifications"
import { supabase } from "../../lib/supabase"
import * as Notifications from "expo-notifications"

const { width, height } = Dimensions.get("window")
const POST_AUTH_ONBOARDING_KEY_PREFIX = "has_completed_post_auth_onboarding"

// Helper function to get user-specific onboarding key
function getPostAuthOnboardingKey(userId: string): string {
  return `${POST_AUTH_ONBOARDING_KEY_PREFIX}_${userId}`
}

export default function NotificationsOnboarding() {
  const router = useRouter()
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    // Check if notifications are already granted
    // Only auto-skip if permissions are already granted AND user has completed onboarding
    // This prevents skipping the screen for new users who should see it
    async function checkPermission() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const onboardingKey = getPostAuthOnboardingKey(user.id)
      const hasCompletedPostAuth = await AsyncStorage.getItem(onboardingKey)
      const { status } = await Notifications.getPermissionsAsync()
      
      // Only auto-skip if BOTH conditions are true:
      // 1. Permissions already granted
      // 2. User has already completed post-auth onboarding (meaning they've seen this screen before)
      if (status === "granted" && hasCompletedPostAuth) {
        // Already granted and onboarding completed - skip this screen
        await completeOnboarding()
      }
      // Otherwise, show the screen so user can interact with it
    }
    checkPermission()
  }, [])

  async function completeOnboarding() {
    // Mark onboarding as complete for this specific user
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      console.error("[notifications-onboarding] No user found when completing onboarding")
      router.replace("/(main)/home")
      return
    }

    const onboardingKey = getPostAuthOnboardingKey(user.id)
    await AsyncStorage.setItem(onboardingKey, "true")
    // Navigate to home
    router.replace("/(main)/home")
  }

  async function handleYes() {
    setProcessing(true)
    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        throw new Error("User not found")
      }

      // Request notification permission (this will show Apple's native modal)
      // This will show the native iOS permission modal to the user
      const token = await registerForPushNotifications()

      if (token) {
        // Permission granted and token received
        try {
          // Save push token to database
          await savePushToken(user.id, token)
          console.log("[notifications-onboarding] Push token saved:", token)
        } catch (saveError) {
          // Token save failed, but permission was granted
          // Don't block user - they can enable notifications later
          console.error("[notifications-onboarding] Failed to save push token:", saveError)
          // Continue without showing error - permission was granted, saving token is secondary
        }
        // Complete onboarding and route to home
        await completeOnboarding()
      } else {
        // User denied permission in the native modal - that's okay
        console.log("[notifications-onboarding] Permission denied, continuing without notifications")
        // Complete onboarding without showing error (user made their choice)
        await completeOnboarding()
      }
    } catch (error: any) {
      console.error("[notifications-onboarding] Error:", error)
      // Only show error alert for actual errors (network issues, etc.)
      // Permission denial returns null and is handled above, so this is a real error
      // Show error but still allow user to continue
      Alert.alert("Notice", "You can enable notifications later in Settings.")
      await completeOnboarding()
    } finally {
      setProcessing(false)
    }
  }

  async function handleNo() {
    // User chose not to enable notifications - that's fine, just continue
    await completeOnboarding()
  }

  return (
    <ImageBackground
      source={require("../../assets/images/mom-open.png")}
      style={styles.container}
      resizeMode="cover"
    >
      <LinearGradient
        colors={["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0.5)", "rgba(0, 0, 0, 0.8)", "rgba(0, 0, 0, 1)"]}
        locations={[0, 0.4, 0.7, 1]}
        style={styles.gradientOverlay}
      />
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Enable notifications</Text>
          <Text style={styles.body}>Enable notifications so you don't miss your group's daily question.</Text>
        </View>

        <View style={styles.buttonContainer}>
          <Button
            title="No"
            onPress={handleNo}
            variant="secondary"
            style={styles.buttonNo}
            loading={processing}
            disabled={processing}
          />
          <Button
            title="Yes"
            onPress={handleYes}
            style={styles.buttonYes}
            loading={processing}
            disabled={processing}
          />
        </View>
      </View>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width,
    height,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    padding: spacing.lg,
    paddingTop: spacing.xxl * 2,
    paddingBottom: spacing.xxl * 2,
  },
  textContainer: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: spacing.xxl,
  },
  title: {
    ...typography.h1,
    fontSize: 40,
    marginBottom: spacing.lg,
  },
  body: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.white,
    marginBottom: spacing.md,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  buttonNo: {
    flex: 1,
  },
  buttonYes: {
    flex: 1,
  },
})

