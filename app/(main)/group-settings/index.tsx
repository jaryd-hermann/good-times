"use client"

import { useEffect, useState, useMemo } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Platform, Image } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useQuery } from "@tanstack/react-query"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { supabase } from "../../../lib/supabase"
import { isGroupAdmin, getUserGroups } from "../../../lib/db"
import { spacing, typography } from "../../../lib/theme"
import { useTheme } from "../../../lib/theme-context"
import { FontAwesome } from "@expo/vector-icons"
import { usePostHog } from "posthog-react-native"
import { captureEvent } from "../../../lib/posthog"

export default function GroupSettingsIndex() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { colors, isDark } = useTheme()
  const groupId = params.groupId as string
  const insets = useSafeAreaInsets()
  const [userId, setUserId] = useState<string>()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isDefaultGroup, setIsDefaultGroup] = useState(false)
  const [hasMultipleGroups, setHasMultipleGroups] = useState(false)
  const posthog = usePostHog()

  // Theme 2 color palette - dynamic based on dark/light mode
  const theme2Colors = useMemo(() => ({
    red: "#B94444",
    yellow: "#E8A037",
    green: "#2D6F4A",
    blue: "#3A5F8C",
    beige: isDark ? "#000000" : "#E8E0D5", // Black in dark mode
    cream: isDark ? "#111111" : "#F5F0EA", // Dark gray in dark mode (for cards)
    white: isDark ? "#E8E0D5" : "#FFFFFF", // Beige in dark mode
    text: isDark ? "#F5F0EA" : "#000000", // Cream in dark mode
    textSecondary: isDark ? "#A0A0A0" : "#404040", // Light gray in dark mode
    onboardingPink: "#D97393", // Pink for onboarding CTAs (same in both modes)
  }), [isDark])

  // Load user groups to check if user has multiple groups
  const { data: groups = [] } = useQuery({
    queryKey: ["groups", userId],
    queryFn: () => (userId ? getUserGroups(userId) : []),
    enabled: !!userId,
  })

  useEffect(() => {
    if (groups.length > 1) {
      setHasMultipleGroups(true)
    } else {
      setHasMultipleGroups(false)
    }
  }, [groups.length])

  // Load default group preference
  useEffect(() => {
    async function loadDefaultGroup() {
      const defaultGroupId = await AsyncStorage.getItem("default_group_id")
      setIsDefaultGroup(defaultGroupId === groupId)
    }
    if (groupId) {
      loadDefaultGroup()
    }
  }, [groupId])

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
      iconSource: require("../../../assets/images/pic.png"),
    },
    {
      id: "remembering-them",
      title: "Remembering Them",
      subtitle: "See and manage people you're remembering",
      adminOnly: true,
      iconSource: require("../../../assets/images/memorial.png"),
    },
    {
      id: "manage-members",
      title: "Manage Members",
      subtitle: "Remove members from the group",
      adminOnly: true,
      iconSource: require("../../../assets/images/manage.png"),
    },
    {
      id: "invite",
      title: "Invite Members",
      subtitle: "Share invite link to add new members",
      adminOnly: false,
      iconSource: require("../../../assets/images/people.png"),
    },
    {
      id: "leave",
      title: "Leave Group",
      subtitle: "Remove yourself from this group",
      adminOnly: false,
      iconSource: require("../../../assets/images/leave.png"),
    },
  ]

  async function handleDefaultGroupToggle(value: boolean) {
    if (value) {
      // Set this group as default
      await AsyncStorage.setItem("default_group_id", groupId)
      setIsDefaultGroup(true)
      
      // Track event
      try {
        if (posthog) {
          posthog.capture("set_default_group", { group_id: groupId })
        } else {
          captureEvent("set_default_group", { group_id: groupId })
        }
      } catch (error) {
        if (__DEV__) console.error("[group-settings] Failed to track set_default_group:", error)
      }
    } else {
      // Remove default group
      await AsyncStorage.removeItem("default_group_id")
      setIsDefaultGroup(false)
      
      // Track event
      try {
        if (posthog) {
          posthog.capture("unset_default_group", { group_id: groupId })
        } else {
          captureEvent("unset_default_group", { group_id: groupId })
        }
      } catch (error) {
        if (__DEV__) console.error("[group-settings] Failed to track unset_default_group:", error)
      }
    }
  }

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
      backgroundColor: theme2Colors.beige,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? theme2Colors.beige : theme2Colors.white, // Black in dark mode
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme2Colors.text, // Cream in dark mode
    },
    title: {
      fontFamily: "PMGothicLudington-Text115",
      fontSize: 32,
      color: theme2Colors.text,
    },
    adminBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: theme2Colors.yellow,
      borderRadius: 12,
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
    },
    adminText: {
      ...typography.caption,
      color: theme2Colors.text,
      fontSize: 12,
      fontWeight: "600",
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: spacing.md,
    },
    optionCard: {
      backgroundColor: theme2Colors.cream,
      borderRadius: 16,
      overflow: "hidden",
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
    },
    optionContent: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.md,
    },
    optionIcon: {
      width: 24,
      height: 24,
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
      color: theme2Colors.text,
    },
    optionSubtitle: {
      ...typography.caption,
      color: theme2Colors.textSecondary,
      fontSize: 13,
    },
    defaultGroupCard: {
      backgroundColor: theme2Colors.cream,
      borderRadius: 16,
      overflow: "hidden",
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
    },
    defaultGroupContent: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: spacing.md,
    },
    defaultGroupText: {
      flex: 1,
      marginRight: spacing.md,
    },
    defaultGroupTitle: {
      ...typography.bodyBold,
      fontSize: 16,
      color: theme2Colors.text,
    },
    defaultGroupSubtitle: {
      ...typography.caption,
      color: theme2Colors.textSecondary,
      fontSize: 13,
      marginTop: spacing.xs,
    },
  }), [colors, isDark, theme2Colors])

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Group Settings</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton} activeOpacity={0.7}>
          <FontAwesome name="times" size={16} color={theme2Colors.text} />
        </TouchableOpacity>
      </View>

      {isAdmin && (
        <View style={styles.adminBadge}>
          <FontAwesome name="shield" size={14} color={theme2Colors.text} style={{ marginRight: spacing.xs }} />
          <Text style={styles.adminText}>You're the admin</Text>
        </View>
      )}

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Default Group Toggle - only show if user has multiple groups */}
        {hasMultipleGroups && (
          <View style={styles.defaultGroupCard}>
            <View style={styles.defaultGroupContent}>
              <View style={styles.defaultGroupText}>
                <Text style={styles.defaultGroupTitle}>Set default group</Text>
                <Text style={styles.defaultGroupSubtitle}>
                  This group will load when you open the app
                </Text>
              </View>
              <Switch
                value={isDefaultGroup}
                onValueChange={handleDefaultGroupToggle}
                trackColor={{ true: theme2Colors.onboardingPink }}
                thumbColor={Platform.OS === "android" ? theme2Colors.white : undefined}
              />
            </View>
          </View>
        )}

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
                  <Image 
                    source={option.iconSource} 
                    style={{ width: 24, height: 24 }}
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
                </View>
                <FontAwesome name="chevron-right" size={16} color={theme2Colors.textSecondary} style={{ marginLeft: spacing.md }} />
              </View>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </View>
  )
}

