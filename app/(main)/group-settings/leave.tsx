"use client"

import { useState, useEffect, useMemo } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { supabase } from "../../../lib/supabase"
import { leaveGroup } from "../../../lib/db"
import { spacing, typography } from "../../../lib/theme"
import { useTheme } from "../../../lib/theme-context"
import { FontAwesome } from "@expo/vector-icons"

export default function LeaveGroupSettings() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { colors, isDark } = useTheme()
  const groupId = params.groupId as string
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState<string>()
  const [leaving, setLeaving] = useState(false)

  // Theme 2 color palette - dynamic based on dark/light mode
  const theme2Colors = useMemo(() => ({
    red: "#B94444",
    yellow: "#E8A037",
    green: "#2D6F4A",
    blue: "#3A5F8C",
    beige: isDark ? "#000000" : "#E8E0D5", // Black in dark mode
    cream: isDark ? "#000000" : "#F5F0EA", // Black in dark mode
    white: isDark ? "#E8E0D5" : "#FFFFFF", // Beige in dark mode
    text: isDark ? "#F5F0EA" : "#000000", // Cream in dark mode
    textSecondary: isDark ? "#A0A0A0" : "#404040", // Light gray in dark mode
  }), [isDark])

  const { data: group } = useQuery({
    queryKey: ["group", groupId],
    queryFn: async () => {
      const { data, error } = await supabase.from("groups").select("*").eq("id", groupId).single()
      if (error) throw error
      return data
    },
    enabled: !!groupId,
  })

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    }
    if (groupId) {
      loadUser()
    }
  }, [groupId])

  async function handleLeave() {
    if (!userId || !groupId) return

    Alert.alert(
      "Leave Group",
      `Are you sure you want to leave "${group?.name}"? You will no longer see entries or prompts from this group.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            setLeaving(true)
            try {
              await leaveGroup(groupId, userId)
              await queryClient.invalidateQueries({ queryKey: ["groups"] })
              Alert.alert("Success", "You have left the group")
              router.replace("/(main)/home")
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to leave group")
            } finally {
              setLeaving(false)
            }
          },
        },
      ]
    )
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
    content: {
      flex: 1,
      padding: spacing.lg,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.lg,
    },
    warningContainer: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: theme2Colors.textSecondary,
      justifyContent: "center",
      alignItems: "center",
    },
    heading: {
      fontFamily: "PMGothicLudington-Text115",
      fontSize: 24,
      textAlign: "center",
      color: theme2Colors.text,
    },
    description: {
      ...typography.body,
      color: theme2Colors.textSecondary,
      textAlign: "center",
      lineHeight: 22,
    },
    leaveButton: {
      marginTop: spacing.md,
      backgroundColor: theme2Colors.red,
      borderRadius: 25,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      alignItems: "center",
      justifyContent: "center",
    },
    leaveButtonText: {
      ...typography.bodyBold,
      fontSize: 18,
      color: theme2Colors.white,
      textAlign: "center",
    },
  }), [colors, isDark, theme2Colors])

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Leave Group</Text>
        <TouchableOpacity
          onPress={() =>
            router.replace({
              pathname: "/(main)/group-settings",
              params: { groupId },
            })
          }
          style={styles.closeButton}
          activeOpacity={0.7}
        >
          <FontAwesome name="times" size={16} color={theme2Colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.warningContainer}>
          <FontAwesome name="exclamation-triangle" size={48} color={theme2Colors.white} />
        </View>
        <Text style={styles.heading}>Leave "{group?.name}"?</Text>
        <Text style={styles.description}>
          You will no longer be able to see entries or prompts from this group. If you are the last admin, you cannot
          leave the group.
        </Text>

        <TouchableOpacity
          style={styles.leaveButton}
          onPress={handleLeave}
          disabled={leaving}
          activeOpacity={0.7}
        >
          {leaving ? (
            <ActivityIndicator color={theme2Colors.white} />
          ) : (
            <Text style={styles.leaveButtonText}>Leave Group</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

