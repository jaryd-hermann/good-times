"use client"

import { useEffect, useState } from "react"
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, ScrollView, ImageBackground, Dimensions } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { supabase } from "../../lib/supabase"
import { colors, typography, spacing } from "../../lib/theme"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Avatar } from "../../components/Avatar"
import { Button } from "../../components/Button"
import { getGroupMembers } from "../../lib/db"
import { useSafeAreaInsets } from "react-native-safe-area-context"

const { width, height } = Dimensions.get("window")
const PENDING_GROUP_KEY = "pending_group_join"

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
      setCreator(groupData.creator)

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
        // User not authenticated - store groupId and redirect to onboarding
        await AsyncStorage.setItem(PENDING_GROUP_KEY, groupId)
        router.replace("/(onboarding)/about")
        return
      }

      const userId = session.user.id

      // Check if user has profile
      const { data: userProfile } = await supabase
        .from("users")
        .select("name, birthday")
        .eq("id", userId)
        .single()

      if (!userProfile?.name || !userProfile?.birthday) {
        // User doesn't have complete profile - go to about screen
        await AsyncStorage.setItem(PENDING_GROUP_KEY, groupId)
        router.replace("/(onboarding)/about")
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
        // User is already a member - redirect to home
        router.replace({
          pathname: "/(main)/home",
          params: { focusGroupId: groupId },
        })
        return
      }

      // Add user to group
      const { error: insertError } = await supabase.from("group_members").insert({
        group_id: groupId,
        user_id: userId,
        role: "member",
      })

      if (insertError) {
        if (insertError.code === "23505") {
          // Already a member
          router.replace({
            pathname: "/(main)/home",
            params: { focusGroupId: groupId },
          })
          return
        }
        throw insertError
      }

      // Success - redirect to home
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
    <ImageBackground source={require("../../assets/images/welcome-bg.png")} style={styles.container} resizeMode="cover">
      <View style={styles.overlay} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>You&apos;ve been added!</Text>
        </View>

        <View style={styles.inviterSection}>
          <Avatar uri={creator?.avatar_url} name={creator?.name || "User"} size={80} />
          <Text style={styles.inviterName}>{creator?.name || "Someone"}</Text>
          <Text style={styles.inviterText}>invited you to join</Text>
        </View>

        <View style={styles.groupSection}>
          <Text style={styles.groupName}>{group?.name}</Text>
          <Text style={styles.groupType}>{group?.type === "family" ? "Family Group" : "Friends Group"}</Text>
        </View>

        {members.length > 0 && (
          <View style={styles.membersSection}>
            <Text style={styles.membersTitle}>Already In</Text>
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

        <View style={styles.descriptionSection}>
          <Text style={styles.descriptionText}>
            Good Times is a private space for you and your favorite people to stay connected. Every day, your group gets
            a simple question to answer—share moments, memories, and stay close without the pressure of social media.
          </Text>
        </View>

        <View style={styles.buttonSection}>
          <Button title="Join Group" onPress={handleJoinGroup} style={styles.joinButton} />
        </View>
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    fontSize: 36,
    color: colors.white,
    textAlign: "center",
  },
  inviterSection: {
    alignItems: "center",
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  inviterName: {
    ...typography.h2,
    fontSize: 24,
    color: colors.white,
  },
  inviterText: {
    ...typography.body,
    fontSize: 16,
    color: colors.gray[300],
  },
  groupSection: {
    alignItems: "center",
    marginBottom: spacing.xl,
    gap: spacing.xs,
  },
  groupName: {
    ...typography.h1,
    fontSize: 32,
    color: colors.white,
  },
  groupType: {
    ...typography.body,
    fontSize: 16,
    color: colors.gray[400],
    textTransform: "capitalize",
  },
  membersSection: {
    marginBottom: spacing.xl,
  },
  membersTitle: {
    ...typography.bodyBold,
    fontSize: 18,
    color: colors.white,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  membersList: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.md,
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
  descriptionSection: {
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  descriptionText: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.white,
    textAlign: "center",
  },
  buttonSection: {
    alignItems: "center",
  },
  joinButton: {
    width: "100%",
    maxWidth: 400,
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
