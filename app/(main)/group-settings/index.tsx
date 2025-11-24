"use client"

import { useEffect, useState, useMemo } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useQuery } from "@tanstack/react-query"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { supabase } from "../../../lib/supabase"
import { isGroupAdmin } from "../../../lib/db"
import { spacing, typography } from "../../../lib/theme"
import { useTheme } from "../../../lib/theme-context"
import { FontAwesome } from "@expo/vector-icons"
import { usePostHog } from "posthog-react-native"
import { captureEvent } from "../../../lib/posthog"

export default function GroupSettingsIndex() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { colors } = useTheme()
  const groupId = params.groupId as string
  const insets = useSafeAreaInsets()
  const [userId, setUserId] = useState<string>()
  const [isAdmin, setIsAdmin] = useState(false)
  const posthog = usePostHog()

  // Track loaded_group_settings event
  useEffect(() => {
    try {
      if (posthog) {
        posthog.capture("loaded_group_settings", { group_id: groupId })
      } else {
        captureEvent("loaded_group_settings", { group_id: groupId })
      }
    } catch (error) {
      if (__DEV__) console.error("[group-settings] Failed to track loaded_group_settings:", error)
    }
  }, [posthog, groupId])

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const admin = await isGroupAdmin(groupId, user.id)
        setIsAdmin(admin)
      }
    }
    if (groupId) {
      loadUser()
    }
  }, [groupId])

  const settingsOptions = [
    {
      id: "name",
      title: "Group Name",
      subtitle: "Change the name of your group",
      adminOnly: true,
      icon: "edit",
    },
    {
      id: "question-types",
      title: "Types of Questions",
      subtitle: "Control which question categories appear",
      adminOnly: true,
      icon: "question-circle",
    },
    {
      id: "remembering-them",
      title: "Remembering Them",
      subtitle: "See and manage people you're remembering",
      adminOnly: true,
      icon: "heart",
    },
    {
      id: "manage-members",
      title: "Manage Members",
      subtitle: "Remove members from the group",
      adminOnly: true,
      icon: "user-times",
    },
    {
      id: "invite",
      title: "Invite Members",
      subtitle: "Share invite link to add new members",
      adminOnly: false,
      icon: "user-plus",
    },
    {
      id: "leave",
      title: "Leave Group",
      subtitle: "Remove yourself from this group",
      adminOnly: false,
      icon: "sign-out",
    },
  ]

  function handleNavigate(optionId: string) {
    router.push({
      pathname: `/(main)/group-settings/${optionId}`,
      params: { groupId },
    })
  }

  // Create dynamic styles based on theme
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.black,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.gray[800],
    },
    closeButton: {
      padding: spacing.sm,
    },
    closeText: {
      ...typography.h2,
      color: colors.white,
    },
    title: {
      ...typography.h1,
      fontSize: 28,
      color: colors.white,
    },
    adminBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.gray[900],
    },
    adminText: {
      ...typography.caption,
      color: colors.accent,
      fontSize: 12,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: spacing.md,
    },
    optionCard: {
      backgroundColor: colors.gray[900],
      borderRadius: 16,
      overflow: "hidden",
      marginBottom: spacing.sm,
    },
    optionContent: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.md,
    },
    optionIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.gray[800],
      justifyContent: "center",
      alignItems: "center",
      marginRight: spacing.md,
    },
    optionText: {
      flex: 1,
    },
    optionTitle: {
      ...typography.bodyBold,
      fontSize: 16,
      color: colors.white,
    },
    optionSubtitle: {
      ...typography.caption,
      color: colors.gray[400],
      fontSize: 13,
    },
  }), [colors])

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Group Settings</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {isAdmin && (
        <View style={styles.adminBadge}>
          <FontAwesome name="shield" size={14} color={colors.accent} style={{ marginRight: spacing.xs }} />
          <Text style={styles.adminText}>Admin</Text>
        </View>
      )}

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {settingsOptions.map((option) => {
          // Hide admin-only options for non-admins
          if (option.adminOnly && !isAdmin) {
            return null
          }

          return (
            <TouchableOpacity
              key={option.id}
              style={styles.optionCard}
              onPress={() => handleNavigate(option.id)}
              activeOpacity={0.7}
            >
              <View style={styles.optionContent}>
                <View style={styles.optionIcon}>
                  <FontAwesome name={option.icon as any} size={20} color={colors.white} />
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
                </View>
                <FontAwesome name="chevron-right" size={16} color={colors.gray[500]} style={{ marginLeft: spacing.md }} />
              </View>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </View>
  )
}

