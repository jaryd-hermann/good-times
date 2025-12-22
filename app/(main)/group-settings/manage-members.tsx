"use client"

import { useEffect, useState, useMemo } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { supabase } from "../../../lib/supabase"
import { getGroupMembers, removeGroupMember, isGroupAdmin } from "../../../lib/db"
import { spacing, typography } from "../../../lib/theme"
import { useTheme } from "../../../lib/theme-context"
import { Avatar } from "../../../components/Avatar"
import { FontAwesome } from "@expo/vector-icons"

export default function ManageMembersSettings() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { colors, isDark } = useTheme()
  const groupId = params.groupId as string
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState<string>()
  const [isAdmin, setIsAdmin] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

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
  }), [isDark])

  const { data: members = [] } = useQuery({
    queryKey: ["groupMembers", groupId],
    queryFn: () => getGroupMembers(groupId),
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
          Alert.alert("Access Denied", "Only admins can manage members.")
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

  async function handleRemoveMember(memberId: string, memberName: string) {
    if (!userId || !groupId) return

    Alert.alert(
      "Remove Member",
      `Are you sure you want to remove ${memberName} from this group?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setRemoving(memberId)
            try {
              await removeGroupMember(groupId, memberId, userId)
              await queryClient.invalidateQueries({ queryKey: ["groupMembers", groupId] })
              Alert.alert("Success", "Member removed successfully")
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to remove member")
            } finally {
              setRemoving(null)
            }
          },
        },
      ]
    )
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
    },
    contentContainer: {
      padding: spacing.md,
      gap: spacing.md,
    },
    description: {
      ...typography.body,
      color: theme2Colors.textSecondary,
      marginBottom: spacing.sm,
    },
    memberCard: {
      backgroundColor: theme2Colors.cream,
      borderRadius: 16,
      padding: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
    },
    memberInfo: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      flex: 1,
    },
    memberText: {
      flex: 1,
      gap: spacing.xs,
    },
    memberNameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    memberName: {
      ...typography.bodyBold,
      fontSize: 16,
      color: theme2Colors.text,
    },
    adminBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      backgroundColor: theme2Colors.yellow,
      borderRadius: 4,
    },
    adminText: {
      ...typography.caption,
      color: theme2Colors.text,
      fontSize: 10,
      fontWeight: "600",
    },
    memberEmail: {
      ...typography.caption,
      color: theme2Colors.textSecondary,
      fontSize: 12,
    },
    removeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme2Colors.white,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme2Colors.text,
    },
    removeButtonDisabled: {
      opacity: 0.5,
    },
  }), [colors, isDark, theme2Colors])

  if (!isAdmin) {
    return null
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Manage Members</Text>
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

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.description}>Remove members from this group. You cannot remove yourself.</Text>

        {members.map((member) => {
          const isCurrentUser = member.user_id === userId
          const isRemoving = removing === member.user_id

          return (
            <View key={member.id} style={styles.memberCard}>
              <View style={styles.memberInfo}>
                <Avatar uri={member.user?.avatar_url} name={member.user?.name || "User"} size={48} borderColor={theme2Colors.text} />
                <View style={styles.memberText}>
                  <View style={styles.memberNameRow}>
                    <Text style={styles.memberName}>{member.user?.name || "Unknown"}</Text>
                    {member.role === "admin" && (
                      <View style={styles.adminBadge}>
                        <FontAwesome name="shield" size={12} color={theme2Colors.text} />
                        <Text style={styles.adminText}>You're the admin</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.memberEmail}>{member.user?.email}</Text>
                </View>
              </View>
              {!isCurrentUser && (
                <TouchableOpacity
                  style={[styles.removeButton, isRemoving && styles.removeButtonDisabled]}
                  onPress={() => handleRemoveMember(member.user_id, member.user?.name || "this member")}
                  disabled={isRemoving}
                  activeOpacity={0.7}
                >
                  <FontAwesome name="times" size={16} color={theme2Colors.text} />
                </TouchableOpacity>
              )}
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

