"use client"

import { useState, useEffect } from "react"
import { Alert, Dimensions, StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, Image, ScrollView } from "react-native"
import { useRouter } from "expo-router"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { colors, spacing, typography } from "../../lib/theme"
import { registerForPushNotifications, savePushToken } from "../../lib/notifications"
import { supabase } from "../../lib/supabase"
import * as Notifications from "expo-notifications"
import { usePostHog } from "posthog-react-native"
import { captureEvent } from "../../lib/posthog"

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
        
        // If has completed onboarding OR is existing user, check for pending group join/creation before redirecting
        // Prioritize hasCompletedPostAuth check (more reliable)
        if (hasCompletedPostAuth || isExistingUser) {
          // Profile and group joining are handled in auth.tsx immediately after authentication
          // Check if there's a pending group join - route to set-theme (then group-interests, then home)
          const pendingGroupId = await AsyncStorage.getItem(PENDING_GROUP_KEY)
          if (pendingGroupId) {
            // User just joined a group - route to set-theme (then group-interests, then home)
            console.log(`[notifications-onboarding] User joined group, routing to set-theme for groupId: ${pendingGroupId}`)
            router.replace({
              pathname: "/(onboarding)/set-theme",
              params: { groupId: pendingGroupId },
            })
            return
          }
          
          // Check if there's a pending group creation
          const pendingGroupCreated = await AsyncStorage.getItem("pending_group_created")
          if (pendingGroupCreated) {
            // If user has completed post-auth onboarding, they already have a theme set - skip set-theme, go to group-interests
            if (hasCompletedPostAuth) {
              console.log(`[notifications-onboarding] Existing user created group, routing to group-interests (skipping set-theme) for groupId: ${pendingGroupCreated}`)
              await AsyncStorage.removeItem("pending_group_created")
              router.replace({
                pathname: "/(main)/group-interests",
                params: { groupId: pendingGroupCreated },
              })
              return
            }
            // New user (hasn't completed post-auth onboarding) - route to set-theme
            console.log(`[notifications-onboarding] New user created group, routing to set-theme for groupId: ${pendingGroupCreated}`)
            router.replace({
              pathname: "/(onboarding)/set-theme",
              params: { groupId: pendingGroupCreated },
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
        <ActivityIndicator size="large" color={theme2Colors.text} />
      </View>
    )
  }

  // Don't render if user shouldn't see this screen
  if (!shouldShow) {
    return null
  }

  async function completeOnboarding() {
    console.log("[notifications-onboarding] completeOnboarding() called")
    // Mark onboarding as complete for this specific user
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      console.error("[notifications-onboarding] No user found when completing onboarding")
      router.replace("/(main)/home")
      return
    }

    console.log(`[notifications-onboarding] User ID: ${user.id}`)

    // Get the group ID FIRST - check pending group created first, then pending group join, then user's first group
    let targetGroupId: string | undefined
    
    // Check for pending group created (from group creation flow)
    const pendingGroupCreated = await AsyncStorage.getItem("pending_group_created")
    console.log(`[notifications-onboarding] pending_group_created: ${pendingGroupCreated}`)
    if (pendingGroupCreated) {
      targetGroupId = pendingGroupCreated
      console.log(`[notifications-onboarding] Using pending_group_created: ${targetGroupId}`)
    } else {
      // Check for pending group join (from invite link)
      const pendingGroupId = await AsyncStorage.getItem(PENDING_GROUP_KEY)
      console.log(`[notifications-onboarding] pending_group_join: ${pendingGroupId}`)
      if (pendingGroupId) {
        targetGroupId = pendingGroupId
        console.log(`[notifications-onboarding] Using pending_group_join: ${targetGroupId}`)
      } else {
        // Get user's first group
        console.log("[notifications-onboarding] Querying database for user's first group")
        const { data: groups } = await supabase
          .from("group_members")
          .select("group_id")
          .eq("user_id", user.id)
          .limit(1)
        
        console.log(`[notifications-onboarding] Found ${groups?.length || 0} groups`)
        if (groups && groups.length > 0) {
          targetGroupId = groups[0].group_id
          console.log(`[notifications-onboarding] Using first group from database: ${targetGroupId}`)
        }
      }
    }

    console.log(`[notifications-onboarding] Final targetGroupId: ${targetGroupId}`)

    if (!targetGroupId) {
      // No group found - mark onboarding complete and go to home
      const onboardingKey = getPostAuthOnboardingKey(user.id)
      await AsyncStorage.setItem(onboardingKey, "true")
      console.log("[notifications-onboarding] No group found, routing to home")
      router.replace("/(main)/home")
      return
    }

    // Check if user needs to see set-theme screen BEFORE marking post-auth as complete
    // This applies to both joining a group and creating a group
    const SET_THEME_ONBOARDING_KEY_PREFIX = "has_completed_set_theme_onboarding"
    const setThemeOnboardingKey = `${SET_THEME_ONBOARDING_KEY_PREFIX}_${user.id}_${targetGroupId}`
    const hasCompletedSetTheme = await AsyncStorage.getItem(setThemeOnboardingKey)
    
    // Check if user has completed post-auth onboarding (before we set it)
    const onboardingKey = getPostAuthOnboardingKey(user.id)
    const hasCompletedPostAuth = await AsyncStorage.getItem(onboardingKey)
    
    // Check if user is joining a group (has pending_group_join) - always route to set-theme if not completed
    const pendingGroupId = await AsyncStorage.getItem(PENDING_GROUP_KEY)
    if (pendingGroupId && !hasCompletedSetTheme) {
      console.log(`[notifications-onboarding] User joining group, routing to set-theme for groupId: ${targetGroupId}`)
      // Mark post-auth onboarding as complete so they don't see notifications screen again
      await AsyncStorage.setItem(onboardingKey, "true")
      router.replace({
        pathname: "/(onboarding)/set-theme",
        params: { groupId: targetGroupId },
      })
      return
    }
    
    // If user is creating a new group (has pending_group_created) and hasn't set theme, route to set-theme
    // Don't mark post-auth as complete yet - let set-theme screen handle that
    if (pendingGroupCreated && !hasCompletedSetTheme) {
      console.log(`[notifications-onboarding] New user creating group, routing to set-theme for groupId: ${targetGroupId}`)
      // Mark post-auth onboarding as complete so they don't see notifications screen again
      await AsyncStorage.setItem(onboardingKey, "true")
      router.replace({
        pathname: "/(onboarding)/set-theme",
        params: { groupId: targetGroupId },
      })
      return
    }
    
    // Mark post-auth onboarding as complete
    await AsyncStorage.setItem(onboardingKey, "true")
    
    // Otherwise, go to home
    // Clean up pending group keys
    const pendingGroupIdForCleanup = await AsyncStorage.getItem(PENDING_GROUP_KEY)
    if (pendingGroupCreated) {
      await AsyncStorage.removeItem("pending_group_created")
    }
    if (pendingGroupIdForCleanup) {
      await AsyncStorage.removeItem(PENDING_GROUP_KEY)
    }
    if (pendingGroupCreated || pendingGroupIdForCleanup) {
      console.log(`[notifications-onboarding] Going to home with groupId: ${targetGroupId}`)
      router.replace({
        pathname: "/(main)/home",
        params: { focusGroupId: targetGroupId },
      })
    } else {
      router.replace("/(main)/home")
    }
    
    // OLD CODE - TEMPORARILY DISABLED:
    // // Check if user has completed swipe onboarding for this group
    // const SWIPE_ONBOARDING_KEY_PREFIX = "has_completed_swipe_onboarding"
    // const swipeOnboardingKey = `${SWIPE_ONBOARDING_KEY_PREFIX}_${user.id}_${targetGroupId}`
    // const hasCompletedSwipeOnboarding = await AsyncStorage.getItem(swipeOnboardingKey)
    // 
    // if (hasCompletedSwipeOnboarding === "true") {
    //   // Already completed swipe onboarding - go to home
    //   // Clean up pending group keys
    //   const pendingGroupCreated = await AsyncStorage.getItem("pending_group_created")
    //   const pendingGroupId = await AsyncStorage.getItem(PENDING_GROUP_KEY)
    //   if (pendingGroupCreated) {
    //     await AsyncStorage.removeItem("pending_group_created")
    //   }
    //   if (pendingGroupId) {
    //     await AsyncStorage.removeItem(PENDING_GROUP_KEY)
    //   }
    //   if (pendingGroupCreated || pendingGroupId) {
    //     router.replace({
    //       pathname: "/(main)/home",
    //       params: { focusGroupId: targetGroupId },
    //     })
    //   } else {
    //     router.replace("/(main)/home")
    //   }
    //   return
    // }
    // 
    // // Route to swipe onboarding (with groupId param)
    // console.log(`[notifications-onboarding] Routing to swipe onboarding with groupId: ${targetGroupId}`)
    // router.replace({
    //   pathname: "/(onboarding)/swipe-onboarding",
    //   params: { groupId: targetGroupId },
    // })
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
    console.log("[notifications-onboarding] User clicked No, calling completeOnboarding()")
    await completeOnboarding()
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
            source={require("../../assets/images/notification-onboarding.png")}
            style={styles.image}
            resizeMode="contain"
          />
          {/* Text Content */}
          <View style={styles.textContainer}>
            <Text style={styles.title}>Notifications?</Text>
            <Text style={styles.body}>I'll make sure you don't miss your group's daily question and new entries to your history.</Text>
          </View>

          {/* Bottom Container */}
          <View style={styles.bottomContainer}>
            <TouchableOpacity
              style={styles.buttonNo}
              onPress={handleNo}
              activeOpacity={0.8}
              disabled={processing}
            >
              <Text style={styles.buttonNoText}>No</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.buttonYes}
              onPress={handleYes}
              activeOpacity={0.8}
              disabled={processing}
            >
              <Text style={styles.buttonYesText}>Yes</Text>
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
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
    gap: spacing.md,
  },
  buttonNo: {
    flex: 0.45,
    backgroundColor: theme2Colors.white,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: theme2Colors.blue,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
  },
  buttonNoText: {
    fontFamily: "Roboto-Bold",
    fontSize: 18,
    color: theme2Colors.text,
  },
  buttonYes: {
    flex: 0.45,
    backgroundColor: theme2Colors.onboardingPink,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: theme2Colors.blue,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
    overflow: "hidden",
  },
  buttonYesText: {
    fontFamily: "Roboto-Bold",
    fontSize: 18,
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

