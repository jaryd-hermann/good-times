"use client"

import { useEffect, useState } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { supabase } from "../../../lib/supabase"
import { getGroupMembers, removeGroupMember, isGroupAdmin } from "../../../lib/db"
import { colors, spacing, typography } from "../../../lib/theme"
import { Avatar } from "../../../components/Avatar"
import { FontAwesome } from "@expo/vector-icons"

export default function ManageMembersSettings() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const groupId = params.groupId as string
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState<string>()
  const [isAdmin, setIsAdmin] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

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
        >
          <Text style={styles.closeText}>✕</Text>
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
                <Avatar uri={member.user?.avatar_url} name={member.user?.name || "User"} size={48} />
                <View style={styles.memberText}>
                  <View style={styles.memberNameRow}>
                    <Text style={styles.memberName}>{member.user?.name || "Unknown"}</Text>
                    {member.role === "admin" && (
                      <View style={styles.adminBadge}>
                        <FontAwesome name="shield" size={12} color={colors.accent} />
                        <Text style={styles.adminText}>Admin</Text>
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
                >
                  <FontAwesome name="times" size={16} color={colors.accent} />
                </TouchableOpacity>
              )}
            </View>
          )
        })}
      </ScrollView>
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
  },
  contentContainer: {
    padding: spacing.md,
    gap: spacing.md,
  },
  description: {
    ...typography.body,
    color: colors.gray[400],
    marginBottom: spacing.sm,
  },
  memberCard: {
    backgroundColor: colors.gray[900],
    borderRadius: 16,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  },
  adminBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    backgroundColor: colors.gray[800],
    borderRadius: 4,
  },
  adminText: {
    ...typography.caption,
    color: colors.accent,
    fontSize: 10,
  },
  memberEmail: {
    ...typography.caption,
    color: colors.gray[400],
    fontSize: 12,
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gray[800],
    justifyContent: "center",
    alignItems: "center",
  },
  removeButtonDisabled: {
    opacity: 0.5,
  },
})

