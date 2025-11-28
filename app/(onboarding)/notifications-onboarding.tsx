"use client"

import { useState, useEffect } from "react"
import { Alert, Dimensions, ImageBackground, StyleSheet, Text, View, ActivityIndicator } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useRouter } from "expo-router"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { colors, spacing, typography } from "../../lib/theme"
import { Button } from "../../components/Button"
import { registerForPushNotifications, savePushToken } from "../../lib/notifications"
import { supabase } from "../../lib/supabase"
import * as Notifications from "expo-notifications"
import { usePostHog } from "posthog-react-native"
import { captureEvent } from "../../lib/posthog"

const { width, height } = Dimensions.get("window")
const POST_AUTH_ONBOARDING_KEY_PREFIX = "has_completed_post_auth_onboarding"
const PENDING_GROUP_KEY = "pending_group_join"

// Helper function to get user-specific onboarding key
function getPostAuthOnboardingKey(userId: string): string {
  return `${POST_AUTH_ONBOARDING_KEY_PREFIX}_${userId}`
}

export default function NotificationsOnboarding() {
  const router = useRouter()
  const [processing, setProcessing] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [shouldShow, setShouldShow] = useState(false)
  const posthog = usePostHog()

  useEffect(() => {
    // Check if user has already completed post-auth onboarding
    // If yes, skip directly to home BEFORE rendering anything
    async function checkOnboardingStatus() {
      try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
        
        if (!user) {
          // No user - redirect to welcome
          router.replace("/(onboarding)/welcome-1")
          return
        }

        // PRIMARY CHECK: Check if they've completed onboarding (most reliable)
        // This is the source of truth - if this is set, user has completed onboarding
        const onboardingKey = getPostAuthOnboardingKey(user.id)
        let hasCompletedPostAuth = await AsyncStorage.getItem(onboardingKey)
        
        // Retry once if not found (handles AsyncStorage timing issues)
        if (!hasCompletedPostAuth) {
          await new Promise(resolve => setTimeout(resolve, 100))
          hasCompletedPostAuth = await AsyncStorage.getItem(onboardingKey)
        }

        // SECONDARY CHECK: Check if user is an existing user (created more than 10 minutes ago)
        // Only use this as a fallback if onboarding key check fails
        const userCreatedAt = new Date(user.created_at)
        const now = new Date()
        const minutesSinceCreation = (now.getTime() - userCreatedAt.getTime()) / (1000 * 60)
        const isExistingUser = minutesSinceCreation >= 10
        
        // If has completed onboarding OR is existing user, check for pending group join before redirecting
        // Prioritize hasCompletedPostAuth check (more reliable)
        if (hasCompletedPostAuth || isExistingUser) {
          // Profile and group joining are handled in auth.tsx immediately after authentication
          // This screen is just for UI - check if there's a pending group to focus on
          const pendingGroupId = await AsyncStorage.getItem(PENDING_GROUP_KEY)
          if (pendingGroupId) {
            // Clear pending and navigate to home with focus
            await AsyncStorage.removeItem(PENDING_GROUP_KEY)
            router.replace({
              pathname: "/(main)/home",
              params: { focusGroupId: pendingGroupId },
            })
            return
          }
          router.replace("/(main)/home")
          return
        }

        // Only show screen if user is new AND hasn't completed onboarding
        setShouldShow(true)
        
        // Track loaded_notification_screen event
        try {
          if (posthog) {
            posthog.capture("loaded_notification_screen")
          } else {
            captureEvent("loaded_notification_screen")
          }
        } catch (error) {
          if (__DEV__) console.error("[notifications-onboarding] Failed to track event:", error)
        }
      } catch (error) {
        console.error("[notifications-onboarding] Error checking onboarding status:", error)
        // On error, redirect to home to be safe
        router.replace("/(main)/home")
      } finally {
        setIsChecking(false)
      }
    }
    checkOnboardingStatus()
  }, [router])

  // Don't render anything until we've checked onboarding status
  if (isChecking) {
    return (
      <View style={styles.checkingContainer}>
        <ActivityIndicator size="large" color={colors.white} />
      </View>
    )
  }

  // Don't render if user shouldn't see this screen
  if (!shouldShow) {
    return null
  }

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
    
        // Profile and group joining are handled in auth.tsx immediately after authentication
        // This screen is just for UI - check if there's a pending group to focus on
        const pendingGroupId = await AsyncStorage.getItem(PENDING_GROUP_KEY)
        if (pendingGroupId) {
          // Clear pending and navigate to home with focus
          await AsyncStorage.removeItem(PENDING_GROUP_KEY)
          router.replace({
            pathname: "/(main)/home",
            params: { focusGroupId: pendingGroupId },
          })
          return
        }
    
    // Navigate to home (no pending group join)
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
          <Text style={styles.title}>Notifications?</Text>
          <Text style={styles.body}>I'll make sure you don't miss your group's daily question and new entries to your history.</Text>
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
  checkingContainer: {
    flex: 1,
    backgroundColor: colors.black,
    justifyContent: "center",
    alignItems: "center",
  },
})

