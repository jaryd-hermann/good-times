"use client"

import { useEffect, useState } from "react"
import { View, Text, StyleSheet, TextInput, Alert, TouchableOpacity } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { supabase } from "../../../lib/supabase"
import { updateGroupName, isGroupAdmin } from "../../../lib/db"
import { colors, spacing, typography } from "../../../lib/theme"
import { FontAwesome } from "@expo/vector-icons"
import { Button } from "../../../components/Button"

export default function GroupNameSettings() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const groupId = params.groupId as string
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState<string>()
  const [groupName, setGroupName] = useState("")
  const [saving, setSaving] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

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
        const admin = await isGroupAdmin(groupId, user.id)
        setIsAdmin(admin)
        if (!admin) {
          Alert.alert("Access Denied", "Only admins can change the group name.")
          router.replace({
            pathname: "/(main)/group-settings",
            params: { groupId },
          })
        }
      }
    }
    if (groupId) {
      loadUser()
    }
  }, [groupId, router])

  useEffect(() => {
    if (group) {
      setGroupName(group.name || "")
    }
  }, [group])

  async function handleSave() {
    if (!userId || !groupId) return
    if (!groupName.trim()) {
      Alert.alert("Error", "Group name cannot be empty")
      return
    }

    setSaving(true)
    try {
      await updateGroupName(groupId, groupName.trim(), userId)
      await queryClient.invalidateQueries({ queryKey: ["group", groupId] })
      await queryClient.invalidateQueries({ queryKey: ["groups"] })
      Alert.alert("Success", "Group name updated successfully")
      router.replace({
        pathname: "/(main)/group-settings",
        params: { groupId },
      })
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to update group name")
    } finally {
      setSaving(false)
    }
  }

  if (!isAdmin) {
    return null
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Group Name</Text>
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
        <Text style={styles.label}>Group Name</Text>
        <TextInput
          style={styles.input}
          value={groupName}
          onChangeText={setGroupName}
          placeholder="Enter group name"
          placeholderTextColor={colors.gray[500]}
          autoFocus
        />
        <Text style={styles.hint}>Only admins can change the group name.</Text>

        <Button
          title="Save Changes"
          onPress={handleSave}
          loading={saving}
          disabled={!groupName.trim() || groupName === group?.name}
          style={styles.saveButton}
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
    gap: spacing.md,
  },
  label: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.gray[400],
    marginBottom: spacing.xs,
  },
  input: {
    ...typography.body,
    fontSize: 18,
    color: colors.white,
    backgroundColor: colors.gray[900],
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray[800],
  },
  hint: {
    ...typography.caption,
    color: colors.gray[500],
    fontSize: 12,
  },
  saveButton: {
    marginTop: spacing.lg,
  },
})

