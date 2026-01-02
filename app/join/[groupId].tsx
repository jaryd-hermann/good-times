"use client"

import { useEffect, useState } from "react"
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, ScrollView, Dimensions, Modal, Image } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { supabase } from "../../lib/supabase"
import { colors, typography, spacing } from "../../lib/theme"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Avatar } from "../../components/Avatar"
import { Button } from "../../components/Button"
import { getGroupMembers } from "../../lib/db"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { usePostHog } from "posthog-react-native"
import { captureEvent } from "../../lib/posthog"
import { OnboardingGallery } from "../../components/OnboardingGallery"

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
const PENDING_GROUP_KEY = "pending_group_join"
const POST_AUTH_ONBOARDING_KEY_PREFIX = "has_completed_post_auth_onboarding"

// Helper function to get user-specific onboarding key
function getPostAuthOnboardingKey(userId: string): string {
  return `${POST_AUTH_ONBOARDING_KEY_PREFIX}_${userId}`
}

export default function JoinGroup() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const groupId = params.groupId as string
  const insets = useSafeAreaInsets()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [group, setGroup] = useState<any>(null)
  const [creator, setCreator] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [showAboutModal, setShowAboutModal] = useState(false)
  const [onboardingGalleryVisible, setOnboardingGalleryVisible] = useState(false)
  const posthog = usePostHog()

  // Track loaded_invite_group_screen event
  useEffect(() => {
    try {
      if (posthog) {
        posthog.capture("loaded_invite_group_screen")
      } else {
        captureEvent("loaded_invite_group_screen")
      }
    } catch (error) {
      if (__DEV__) console.error("[join] Failed to track loaded_invite_group_screen:", error)
    }
  }, [posthog, groupId])

  useEffect(() => {
    loadGroupInfo()
  }, [groupId])

  async function loadGroupInfo() {
    if (!groupId) {
      setError("Invalid invite link")
      setLoading(false)
      return
    }

    try {
      // Check if group exists and get creator info
      const { data: groupData, error: groupError } = await supabase
        .from("groups")
        .select("*, creator:users!created_by(*)")
        .eq("id", groupId)
        .maybeSingle()

      if (groupError) throw groupError
      if (!groupData) {
        setError("Group not found")
        setLoading(false)
        return
      }

      setGroup(groupData)
      // Show group creator/admin as the inviter
      // Note: We don't track who actually sent the invite link, so we show the group creator
      setCreator((groupData as any).creator)

      // Get group members
      const membersData = await getGroupMembers(groupId)
      setMembers(membersData)

      setLoading(false)
    } catch (err: any) {
      console.error("[join] error loading group:", err)
      setError(err.message || "Failed to load group information")
      setLoading(false)
    }
  }

  async function handleJoinGroup() {
    try {
      // Check if user is authenticated
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) throw sessionError

      if (!session) {
        // User not authenticated - store groupId and redirect to welcome-2
        await AsyncStorage.setItem(PENDING_GROUP_KEY, groupId)
        router.replace("/(onboarding)/welcome-2")
        return
      }

      const userId = session.user.id

      // CRITICAL: Ensure user has a profile before joining group
      // Check if user profile exists
      const { data: userProfile } = await supabase
        .from("users")
        .select("name, birthday")
        .eq("id", userId)
        .maybeSingle()

      if (!userProfile) {
        // User profile doesn't exist - create minimal profile
        console.log("[join] User profile not found, creating profile...")
        const { error: profileError } = await supabase
          .from("users")
          .insert({
            id: userId,
            email: session.user.email || "",
          } as any)

        if (profileError) {
          console.error("[join] Failed to create user profile:", profileError)
          Alert.alert(
            "Error",
            "Failed to create your profile. Please try again.",
            [{ text: "OK", onPress: () => {} }]
          )
          return
        }
        console.log("[join] User profile created successfully")
        // User doesn't have complete profile - go to welcome-2 to complete onboarding
        await AsyncStorage.setItem(PENDING_GROUP_KEY, groupId)
        router.replace("/(onboarding)/welcome-2")
        return
      }

      if (!(userProfile as any)?.name || !(userProfile as any)?.birthday) {
        // User doesn't have complete profile - go to welcome-2
        await AsyncStorage.setItem(PENDING_GROUP_KEY, groupId)
        router.replace("/(onboarding)/welcome-2")
        return
      }

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from("group_members")
        .select("id")
        .eq("group_id", groupId)
        .eq("user_id", userId)
        .maybeSingle()

      if (existingMember) {
        // User is already a member - check post-auth onboarding before redirecting (user-specific)
        const onboardingKey = getPostAuthOnboardingKey(userId)
        const hasCompletedPostAuth = await AsyncStorage.getItem(onboardingKey)
        if (!hasCompletedPostAuth) {
          router.replace("/(onboarding)/welcome-post-auth")
          return
        }
        
        // TEMPORARILY DISABLED: Skip swipe-onboarding - go directly to home
        router.replace({
          pathname: "/(main)/home",
          params: { focusGroupId: groupId },
        })
        return
        
        // OLD CODE - TEMPORARILY DISABLED:
        // // Check if user has completed swipe onboarding for this group
        // const SWIPE_ONBOARDING_KEY_PREFIX = "has_completed_swipe_onboarding"
        // const swipeOnboardingKey = `${SWIPE_ONBOARDING_KEY_PREFIX}_${userId}_${groupId}`
        // const hasCompletedSwipeOnboarding = await AsyncStorage.getItem(swipeOnboardingKey)
        // 
        // if (hasCompletedSwipeOnboarding === "true") {
        //   // Already completed swipe onboarding - go to home
        //   router.replace({
        //     pathname: "/(main)/home",
        //     params: { focusGroupId: groupId },
        //   })
        //   return
        // }
        // 
        // // Route to swipe onboarding (with groupId param)
        // router.replace({
        //   pathname: "/(onboarding)/swipe-onboarding",
        //   params: { groupId },
        // })
        // return
      }

      // Add user to group
      const { error: insertError, data: insertData } = await supabase.from("group_members").insert({
        group_id: groupId,
        user_id: userId,
        role: "member",
      } as any).select()

      if (insertError) {
        if (insertError.code === "23505") {
          // Already a member - check post-auth onboarding (user-specific)
          const onboardingKey = getPostAuthOnboardingKey(userId)
          const hasCompletedPostAuth = await AsyncStorage.getItem(onboardingKey)
          if (!hasCompletedPostAuth) {
            router.replace("/(onboarding)/welcome-post-auth")
            return
          }
          
          // TEMPORARILY DISABLED: Skip swipe-onboarding - go directly to home
          router.replace({
            pathname: "/(main)/home",
            params: { focusGroupId: groupId },
          })
          return
          
          // OLD CODE - TEMPORARILY DISABLED:
          // // Check if user has completed swipe onboarding for this group
          // const SWIPE_ONBOARDING_KEY_PREFIX = "has_completed_swipe_onboarding"
          // const swipeOnboardingKey = `${SWIPE_ONBOARDING_KEY_PREFIX}_${userId}_${groupId}`
          // const hasCompletedSwipeOnboarding = await AsyncStorage.getItem(swipeOnboardingKey)
          // 
          // if (hasCompletedSwipeOnboarding === "true") {
          //   // Already completed swipe onboarding - go to home
          //   router.replace({
          //     pathname: "/(main)/home",
          //     params: { focusGroupId: groupId },
          //   })
          //   return
          // }
          // 
          // // Route to swipe onboarding (with groupId param)
          // router.replace({
          //   pathname: "/(onboarding)/swipe-onboarding",
          //   params: { groupId },
          // })
          // return
        }
        console.error("[join] Failed to join group:", insertError)
        Alert.alert(
          "Error",
          `Failed to join group: ${insertError.message || "Unknown error"}`,
          [{ text: "OK", onPress: () => {} }]
        )
        return
      }

      // Verify the insert was successful
      if (!insertData || insertData.length === 0) {
        console.error("[join] Group join returned no data")
        Alert.alert(
          "Error",
          "Failed to join group. Please try again.",
          [{ text: "OK", onPress: () => {} }]
        )
        return
      }

      // Track joined_group event
      try {
        if (posthog) {
          posthog.capture("joined_group", {
            group_id: groupId,
            join_method: "invite_link",
          })
        } else {
          captureEvent("joined_group", {
            group_id: groupId,
            join_method: "invite_link",
          })
        }
      } catch (error) {
        if (__DEV__) console.error("[join] Failed to track joined_group:", error)
      }

      // Success - check post-auth onboarding before redirecting (user-specific)
      const onboardingKey = getPostAuthOnboardingKey(userId)
      const hasCompletedPostAuth = await AsyncStorage.getItem(onboardingKey)
      if (!hasCompletedPostAuth) {
        router.replace("/(onboarding)/welcome-post-auth")
        return
      }
      
      // TEMPORARILY DISABLED: Skip swipe-onboarding - go directly to home
      router.replace({
        pathname: "/(main)/home",
        params: { focusGroupId: groupId },
      })
      
      // OLD CODE - TEMPORARILY DISABLED:
      // // Check if user has completed swipe onboarding for this group
      // const SWIPE_ONBOARDING_KEY_PREFIX = "has_completed_swipe_onboarding"
      // const swipeOnboardingKey = `${SWIPE_ONBOARDING_KEY_PREFIX}_${userId}_${groupId}`
      // const hasCompletedSwipeOnboarding = await AsyncStorage.getItem(swipeOnboardingKey)
      // 
      // if (hasCompletedSwipeOnboarding === "true") {
      //   // Already completed swipe onboarding - go to home
      //   router.replace({
      //     pathname: "/(main)/home",
      //     params: { focusGroupId: groupId },
      //   })
      //   return
      // }
      // 
      // // Route to swipe onboarding (with groupId param)
      // router.replace({
      //   pathname: "/(onboarding)/swipe-onboarding",
      //   params: { groupId },
      // })
    } catch (err: any) {
      console.error("[join] error:", err)
      Alert.alert("Error", err.message || "Failed to join group. Please try again.")
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={theme2Colors.text} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setError(null)
            setLoading(true)
            loadGroupInfo()
          }}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Spacer at top to push invite content down */}
        <View style={styles.topSpacer} />

        {/* Invite Section - Inviter text and avatars */}
        <View style={styles.topSection}>
          {/* Inviter text */}
          {creator && group && (
            <View style={styles.inviterSection}>
              <Text style={styles.inviterText}>
                {creator.name || "Someone"} invited you to join the group, &quot;{group.name}&quot;
              </Text>
            </View>
          )}

          {/* Member avatars */}
          {members.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.membersScroll}>
              {members.map((member, index) => {
                // Cycle through theme colors: pink, yellow, green, blue
                const avatarColors = [theme2Colors.onboardingPink, theme2Colors.yellow, theme2Colors.green, theme2Colors.blue]
                const borderColor = avatarColors[index % avatarColors.length]
                // Create slight rotation angles for overlapping effect
                const rotationAngles = [-8, 5, -3, 7, -5, 4, -6]
                const rotation = rotationAngles[index % rotationAngles.length]
                return (
                  <View
                    key={member.id}
                    style={[styles.memberAvatar, { transform: [{ rotate: `${rotation}deg` }] }]}
                  >
                    <Avatar uri={member.user?.avatar_url} name={member.user?.name || "User"} size={42} borderColor={borderColor} square={true} />
                  </View>
                )
              })}
            </ScrollView>
          )}
        </View>

        {/* Bottom Section - Content (wordmark and CTA stay at bottom) */}
        <View style={styles.content}>
          {/* Wordmark */}
          <Image 
            source={require("../../assets/images/wordmark.png")} 
            style={styles.wordmark}
            resizeMode="contain"
          />

          {/* Tagline */}
          <Text style={styles.subtitle}>
            Answer just one question a day with your favorite people
          </Text>

          {/* Show me first link */}
          <TouchableOpacity
            style={styles.showMeFirstButton}
            onPress={() => setOnboardingGalleryVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.showMeFirstText}>show and tell me more first</Text>
          </TouchableOpacity>

          {/* CTA Button */}
          <View style={styles.buttonSection}>
            <TouchableOpacity
              style={styles.joinButton}
              onPress={handleJoinGroup}
              activeOpacity={0.8}
            >
              <Text style={styles.joinButtonText}>
                {group?.type === "family" ? "Join your family" : "Join your friends"}
              </Text>
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

      {/* Onboarding Gallery Modal */}
      <OnboardingGallery
        visible={onboardingGalleryVisible}
        screenshots={[
          { id: "1", source: require("../../assets/images/onboarding-1-one-question.png") },
          { id: "2", source: require("../../assets/images/onboarding-2-your-answer.png") },
          { id: "3", source: require("../../assets/images/onboarding-3-their-answer.png") },
          { id: "4", source: require("../../assets/images/onboarding-4-your-group.png") },
          { id: "5", source: require("../../assets/images/onboarding-5-ask-them.png") },
          { id: "6", source: require("../../assets/images/onboarding-6-themed-decks.png") },
          { id: "7", source: require("../../assets/images/onboarding-7-set-your-vibe.png") },
          { id: "8", source: require("../../assets/images/onboarding-8-remember.png") },
        ]}
        onComplete={() => setOnboardingGalleryVisible(false)}
        returnRoute={`/join/${groupId}`}
      />
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
  },
  topSpacer: {
    flex: 1,
    minHeight: 400, // Increased to push all content down, matching image height from welcome-1
  },
  topSection: {
    padding: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs, // Minimal padding to bring avatars closer to wordmark
    backgroundColor: theme2Colors.beige,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl * 4,
    backgroundColor: theme2Colors.beige,
  },
  wordmark: {
    width: 280,
    height: 92,
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
    marginLeft: -spacing.sm,
    alignSelf: "flex-start",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  subtitle: {
    fontFamily: "PMGothicLudington-Text115",
    fontSize: 22,
    lineHeight: 30,
    color: theme2Colors.text,
    marginBottom: spacing.md,
  },
  showMeFirstButton: {
    alignSelf: "flex-start",
    marginBottom: spacing.lg,
  },
  showMeFirstText: {
    fontFamily: "Roboto-Regular",
    fontSize: 14,
    color: theme2Colors.text,
    textDecorationLine: "underline",
  },
  inviterSection: {
    marginBottom: spacing.sm, // Reduced margin to bring closer to avatars
  },
  inviterText: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    color: theme2Colors.text,
    lineHeight: 24,
  },
  membersScroll: {
    paddingVertical: 3,
    paddingLeft: 3,
    paddingRight: spacing.sm,
  },
  memberAvatar: {
    marginRight: -4, // Slight overlap
  },
  buttonSection: {
    alignItems: "flex-start",
    marginTop: spacing.md,
    width: "100%",
  },
  joinButton: {
    width: "100%",
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
    position: "relative",
  },
  joinButtonText: {
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
  loadingText: {
    ...typography.body,
    color: theme2Colors.text,
    textAlign: "center",
    marginTop: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: theme2Colors.red,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  retryButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: theme2Colors.onboardingPink,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: theme2Colors.blue,
  },
  retryButtonText: {
    ...typography.bodyBold,
    color: theme2Colors.white,
  },
})
