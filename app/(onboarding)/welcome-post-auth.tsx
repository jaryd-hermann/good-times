"use client"

import { useEffect, useState } from "react"
import { View, Text, StyleSheet, ImageBackground, Dimensions, ActivityIndicator, Alert } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useRouter } from "expo-router"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { colors, typography, spacing } from "../../lib/theme"
import { Button } from "../../components/Button"
import { supabase } from "../../lib/supabase"
import { usePostHog } from "posthog-react-native"
import { captureEvent } from "../../lib/posthog"

const { width, height } = Dimensions.get("window")
const POST_AUTH_ONBOARDING_KEY_PREFIX = "has_completed_post_auth_onboarding"
const PENDING_GROUP_KEY = "pending_group_join"

// Helper function to get user-specific onboarding key
function getPostAuthOnboardingKey(userId: string): string {
  return `${POST_AUTH_ONBOARDING_KEY_PREFIX}_${userId}`
}

export default function WelcomePostAuth() {
  const router = useRouter()
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
          // Check if there's a pending group join - if so, route to swipe-onboarding
          const pendingGroupId = await AsyncStorage.getItem(PENDING_GROUP_KEY)
          if (pendingGroupId) {
            // User just joined a group - route to swipe-onboarding
            console.log(`[welcome-post-auth] User joined group, routing to swipe-onboarding with groupId: ${pendingGroupId}`)
            router.replace({
              pathname: "/(onboarding)/swipe-onboarding",
              params: { groupId: pendingGroupId },
            })
            return
          }
          router.replace("/(main)/home")
          return
        }

        // Only show screen if user is new AND hasn't completed onboarding
        setShouldShow(true)
        
        // Track loaded_feedback_screen event
        try {
          if (posthog) {
            posthog.capture("loaded_feedback_screen")
          } else {
            captureEvent("loaded_feedback_screen")
          }
        } catch (error) {
          if (__DEV__) console.error("[welcome-post-auth] Failed to track event:", error)
        }
      } catch (error) {
        console.error("[welcome-post-auth] Error checking onboarding status:", error)
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

  function handleContinue() {
    router.replace("/(onboarding)/notifications-onboarding")
  }

  return (
    <ImageBackground
      source={require("../../assets/images/friends.png")}
      style={styles.container}
      resizeMode="cover"
    >
      <LinearGradient
        colors={["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0.4)", "rgba(0, 0, 0, 0.8)", "rgba(0, 0, 0, 1)"]}
        locations={[0, 0.4, 0.7, 1]}
        style={styles.gradientOverlay}
      />
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Welcome</Text>
          <Text style={styles.body}>
            Thanks for joining! This is a new app, so if you see any problems or have any ideas...find me in
            "Settings". Email, text, or WhatsApp, I'd love to hear your feedback.
          </Text>
        </View>

        <View style={styles.bottomContainer}>
          <View style={styles.buttonContainer}>
            <Button
              title="→"
              onPress={handleContinue}
              style={styles.button}
              textStyle={styles.buttonText}
            />
          </View>
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
  bottomContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "flex-end",
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
    alignItems: "flex-end",
  },
  button: {
    width: 100,
    height: 60,
  },
  buttonText: {
    fontSize: 32,
  },
  checkingContainer: {
    flex: 1,
    backgroundColor: colors.black,
    justifyContent: "center",
    alignItems: "center",
  },
})

