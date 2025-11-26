"use client"

import { useEffect, useState } from "react"
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, ScrollView, ImageBackground, Dimensions, Modal } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
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
        router.replace({
          pathname: "/(main)/home",
          params: { focusGroupId: groupId },
        })
        return
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
          router.replace({
            pathname: "/(main)/home",
            params: { focusGroupId: groupId },
          })
          return
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
      
      router.replace({
        pathname: "/(main)/home",
        params: { focusGroupId: groupId },
      })
    } catch (err: any) {
      console.error("[join] error:", err)
      Alert.alert("Error", err.message || "Failed to join group. Please try again.")
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.text}>Loading...</Text>
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
    <ImageBackground source={require("../../assets/images/welcome-home.png")} style={styles.container} resizeMode="cover">
      <LinearGradient
        colors={["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0.3)", "rgba(0, 0, 0, 0.8)", "rgba(0, 0, 0, 1)"]}
        locations={[0, 0.4, 0.7, 1]}
        style={styles.gradientOverlay}
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xxl * 3 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Your invite</Text>
        </View>

        <View style={styles.inviterSection}>
          <Avatar uri={creator?.avatar_url} name={creator?.name || "User"} size={80} />
          <View style={styles.inviterTextContainer}>
            <Text style={styles.inviterName}>{creator?.name || "Someone"}</Text>
            <Text style={styles.inviterText}>
              invited you to join the closed group &quot;<Text style={styles.groupNameBold}>{group?.name}</Text>&quot;
            </Text>
          </View>
        </View>

        {members.length > 0 && (
          <View style={styles.membersSection}>
            <Text style={styles.membersTitle}>In the group already</Text>
            <View style={styles.membersList}>
              {members.slice(0, 6).map((member) => (
                <View key={member.id} style={styles.memberItem}>
                  <Avatar uri={member.user?.avatar_url} name={member.user?.name || "User"} size={48} />
                  <Text style={styles.memberName} numberOfLines={1}>
                    {member.user?.name || "User"}
                  </Text>
                </View>
              ))}
              {members.length > 6 && (
                <View style={styles.memberItem}>
                  <View style={styles.moreMembers}>
                    <Text style={styles.moreMembersText}>+{members.length - 6}</Text>
                  </View>
                  <Text style={styles.memberName}>More</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={styles.buttonSection}>
          <Button 
            title={group?.type === "family" ? "Join Your Family" : "Join Your Friends"} 
            onPress={handleJoinGroup} 
            style={styles.joinButton} 
          />
          <View style={styles.aboutLinkContainer}>
            <TouchableOpacity 
              onPress={() => setShowAboutModal(true)}
              style={styles.aboutLink}
            >
              <Text style={styles.aboutLinkText}>What&apos;s this app?</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Modal
          transparent
          animationType="fade"
          visible={showAboutModal}
          onRequestClose={() => setShowAboutModal(false)}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowAboutModal(false)}
          >
            <View 
              style={[styles.modalContent, { paddingBottom: insets.bottom + spacing.lg }]}
              onStartShouldSetResponder={() => true}
            >
              <Text style={styles.modalTitle}>About Good Times</Text>
              <Text style={styles.modalText}>
                {creator?.name || "Someone"} has invited you to join their free private group on Good Times.
              </Text>
              <Text style={[styles.modalText, styles.modalTextSpacing]}>
                Good Times is the group-based, low-effort, social app for friends & family to meaningfully hear from each other everyday in just 3 minutes.
              </Text>
              <Text style={[styles.modalText, styles.modalTextSpacing]}>
                <Text style={styles.modalTextBold}>Just one easy, shared Q&A a day</Text>
              </Text>
              <Button
                title={group?.type === "family" ? "Join Your Family" : "Join Your Friends"}
                onPress={() => {
                  setShowAboutModal(false)
                  handleJoinGroup()
                }}
                style={styles.modalButton}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      </ScrollView>
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
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
    justifyContent: "flex-end",
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    fontSize: 36,
    color: colors.white,
    textAlign: "left",
  },
  inviterSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  inviterTextContainer: {
    flex: 1,
  },
  inviterName: {
    ...typography.h2,
    fontSize: 24,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  inviterText: {
    ...typography.body,
    fontSize: 16,
    color: colors.white,
    textAlign: "left",
    lineHeight: 24,
  },
  groupNameBold: {
    ...typography.bodyBold,
    fontSize: 16,
    color: colors.white,
  },
  membersSection: {
    marginBottom: spacing.xl,
  },
  membersTitle: {
    ...typography.bodyBold,
    fontSize: 18,
    color: colors.white,
    marginBottom: spacing.md,
    textAlign: "left",
  },
  membersList: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: spacing.md * 0.5, // 50% closer spacing
  },
  memberItem: {
    alignItems: "center",
    gap: spacing.xs,
    width: 80,
  },
  memberName: {
    ...typography.caption,
    fontSize: 12,
    color: colors.gray[300],
    textAlign: "center",
  },
  moreMembers: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.gray[800],
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.gray[600],
  },
  moreMembersText: {
    ...typography.bodyBold,
    fontSize: 16,
    color: colors.white,
  },
  buttonSection: {
    alignItems: "flex-start",
    gap: spacing.md,
  },
  joinButton: {
    width: "100%",
    maxWidth: 400,
  },
  aboutLinkContainer: {
    width: "100%",
    alignItems: "center",
  },
  aboutLink: {
    paddingVertical: spacing.sm,
  },
  aboutLinkText: {
    ...typography.body,
    fontSize: 16,
    color: colors.white,
    textDecorationLine: "underline",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.black,
    padding: spacing.lg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: spacing.md,
  },
  modalTitle: {
    ...typography.h2,
    fontSize: 24,
    color: colors.white,
    marginBottom: spacing.sm,
  },
  modalText: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.gray[300],
  },
  modalTextSpacing: {
    marginTop: spacing.md,
  },
  modalTextBold: {
    fontWeight: "bold",
  },
  modalButton: {
    marginTop: spacing.md,
  },
  text: {
    ...typography.body,
    color: colors.white,
    textAlign: "center",
  },
  errorText: {
    ...typography.body,
    color: colors.accent,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  retryButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: 8,
  },
  retryButtonText: {
    ...typography.bodyBold,
    color: colors.white,
  },
})
