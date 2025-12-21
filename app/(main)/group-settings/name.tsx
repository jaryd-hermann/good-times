"use client"

import { useEffect, useState, useMemo } from "react"
import { View, Text, StyleSheet, TextInput, Alert, TouchableOpacity, ActivityIndicator } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { supabase } from "../../../lib/supabase"
import { updateGroupName, isGroupAdmin } from "../../../lib/db"
import { spacing, typography } from "../../../lib/theme"
import { useTheme } from "../../../lib/theme-context"
import { FontAwesome } from "@expo/vector-icons"

export default function GroupNameSettings() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { colors, isDark } = useTheme()
  const groupId = params.groupId as string
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState<string>()
  const [groupName, setGroupName] = useState("")
  const [saving, setSaving] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [focusedInput, setFocusedInput] = useState(false)

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
  }

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

  // Create dynamic styles based on theme (must be before conditional return)
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
      backgroundColor: theme2Colors.white,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme2Colors.text,
    },
    title: {
      fontFamily: "PMGothicLudington-Text115",
      fontSize: 32,
      color: theme2Colors.text,
    },
    content: {
      flex: 1,
      padding: spacing.lg,
      gap: spacing.md,
    },
    label: {
      ...typography.bodyBold,
      fontSize: 14,
      color: theme2Colors.text,
      marginBottom: spacing.xs,
      fontWeight: "600",
    },
    input: {
      ...typography.body,
      fontSize: 18,
      color: theme2Colors.text,
      backgroundColor: theme2Colors.white,
      borderRadius: 12,
      padding: spacing.md,
      borderWidth: 2,
      borderColor: theme2Colors.textSecondary,
    },
    inputFocused: {
      borderColor: theme2Colors.blue,
    },
    hint: {
      ...typography.caption,
      color: theme2Colors.textSecondary,
      fontSize: 12,
    },
    saveButton: {
      marginTop: spacing.lg,
      backgroundColor: theme2Colors.blue,
      borderRadius: 25,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      alignItems: "center",
      justifyContent: "center",
    },
    saveButtonText: {
      ...typography.bodyBold,
      fontSize: 18,
      color: theme2Colors.white,
      textAlign: "center",
    },
  }), [colors, isDark, focusedInput])

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
          activeOpacity={0.7}
        >
          <FontAwesome name="times" size={16} color={theme2Colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>Group Name</Text>
        <TextInput
          style={[styles.input, focusedInput && styles.inputFocused]}
          value={groupName}
          onChangeText={setGroupName}
          placeholder="Enter group name"
          placeholderTextColor={theme2Colors.textSecondary}
          onFocus={() => setFocusedInput(true)}
          onBlur={() => setFocusedInput(false)}
          autoFocus
        />
        <Text style={styles.hint}>Only admins can change the group name.</Text>

        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={!groupName.trim() || groupName === group?.name || saving}
          activeOpacity={0.7}
        >
          {saving ? (
            <ActivityIndicator color={theme2Colors.white} />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

