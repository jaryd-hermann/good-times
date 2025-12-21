"use client"

import { useEffect, useState } from "react"
import { View, Text, StyleSheet, Dimensions, ActivityIndicator, TouchableOpacity, Image, ScrollView } from "react-native"
import { useRouter } from "expo-router"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { colors, typography, spacing } from "../../lib/theme"
import { supabase } from "../../lib/supabase"
import { usePostHog } from "posthog-react-native"
import { captureEvent } from "../../lib/posthog"
import { FontAwesome } from "@expo/vector-icons"

// Theme 2 color palette matching new design system
const theme2Colors = {
  red: "#B94444",
  yellow: "#E8A037",
  green: "#2D6F4A",
  blue: "#3A5F8C",
  beige: "#E8E0D5",
  cream: "#F5F0EA",
  white: "#FFFFFF",
  text: "#000000",
  textSecondary: "#404040",
  onboardingPink: "#D97393", // Pink for onboarding CTAs
}

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
        <ActivityIndicator size="large" color={theme2Colors.text} />
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
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Bottom Section - Content */}
        <View style={styles.content}>
          {/* Image */}
          <Image
            source={require("../../assets/images/feedback-onboarding.png")}
            style={styles.image}
            resizeMode="contain"
          />
          {/* Text Content */}
          <View style={styles.textContainer}>
            <Text style={styles.title}>Welcome</Text>
            <Text style={styles.body}>
              Thanks for joining! This is a new app, so if you see any problems or have any ideas...find me in
              "Settings". Email, text, or WhatsApp, I'd love to hear your feedback.
            </Text>
          </View>

          {/* Bottom Container */}
          <View style={styles.bottomContainer}>
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={handleContinue}
              activeOpacity={0.8}
            >
              <Text style={styles.ctaButtonText}>→</Text>
              <View style={styles.buttonTexture} pointerEvents="none">
                <Image
                  source={require("../../assets/images/texture.png")}
                  style={styles.textureImage}
                  resizeMode="cover"
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme2Colors.beige,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "flex-end",
    minHeight: "100%",
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xxl * 4, // Increased from spacing.xxl * 2 to shift content lower
    paddingBottom: spacing.xxl * 4,
    backgroundColor: theme2Colors.beige,
  },
  image: {
    width: "100%",
    height: 200,
    marginBottom: spacing.xl,
    alignSelf: "flex-start",
  },
  textContainer: {
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: "PMGothicLudington-Text115",
    fontSize: 40,
    lineHeight: 48,
    color: theme2Colors.text,
    marginBottom: spacing.lg,
  },
  body: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    lineHeight: 24,
    color: theme2Colors.text,
    marginBottom: spacing.md,
  },
  bottomContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: spacing.md,
  },
  ctaButton: {
    width: 100,
    height: 60,
    backgroundColor: theme2Colors.onboardingPink,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: theme2Colors.blue,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ctaButtonText: {
    fontFamily: "Roboto-Bold",
    fontSize: 32,
    color: theme2Colors.white,
    zIndex: 2,
  },
  buttonTexture: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.3,
    zIndex: 1,
  },
  textureImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  checkingContainer: {
    flex: 1,
    backgroundColor: theme2Colors.beige,
    justifyContent: "center",
    alignItems: "center",
  },
})

