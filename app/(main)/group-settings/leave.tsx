"use client"

import { useState, useEffect } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { supabase } from "../../../lib/supabase"
import { leaveGroup } from "../../../lib/db"
import { colors, spacing, typography } from "../../../lib/theme"
import { FontAwesome } from "@expo/vector-icons"
import { Button } from "../../../components/Button"

export default function LeaveGroupSettings() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const groupId = params.groupId as string
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState<string>()
  const [leaving, setLeaving] = useState(false)

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
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.warningContainer}>
          <FontAwesome name="exclamation-triangle" size={48} color={colors.accent} />
        </View>
        <Text style={styles.heading}>Leave "{group?.name}"?</Text>
        <Text style={styles.description}>
          You will no longer be able to see entries or prompts from this group. If you are the last admin, you cannot
          leave the group.
        </Text>

        <Button
          title="Leave Group"
          onPress={handleLeave}
          loading={leaving}
          variant="secondary"
          style={styles.leaveButton}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
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
    backgroundColor: colors.gray[900],
    justifyContent: "center",
    alignItems: "center",
  },
  heading: {
    ...typography.h2,
    fontSize: 24,
    textAlign: "center",
  },
  description: {
    ...typography.body,
    color: colors.gray[400],
    textAlign: "center",
    lineHeight: 22,
  },
  leaveButton: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
  },
})

