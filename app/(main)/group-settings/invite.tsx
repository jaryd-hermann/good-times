"use client"

import { useState } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Share, Alert } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { colors, spacing, typography } from "../../../lib/theme"
import { FontAwesome } from "@expo/vector-icons"

export default function InviteMembersSettings() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const groupId = params.groupId as string
  const insets = useSafeAreaInsets()

  async function handleShareInvite() {
    if (!groupId) return
    try {
      const inviteLink = `goodtimes://join/${groupId}`
      await Share.share({
        url: inviteLink,
        message: inviteLink,
        title: "Join my Good Times group",
      })
    } catch (error: any) {
      Alert.alert("Error", error.message)
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Invite Members</Text>
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
        <View style={styles.iconContainer}>
          <FontAwesome name="user-plus" size={48} color={colors.accent} />
        </View>
        <Text style={styles.heading}>Share Invite Link</Text>
        <Text style={styles.description}>
          Share this link with friends and family to invite them to join your group. Anyone with the link can join.
        </Text>

        <TouchableOpacity style={styles.shareButton} onPress={handleShareInvite}>
          <FontAwesome name="share" size={20} color={colors.white} />
          <Text style={styles.shareButtonText}>Share Invite Link</Text>
        </TouchableOpacity>

        <View style={styles.linkContainer}>
          <Text style={styles.linkLabel}>Invite Link:</Text>
          <Text style={styles.linkText} selectable>
            goodtimes://join/{groupId}
          </Text>
        </View>
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
  iconContainer: {
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
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 12,
    marginTop: spacing.md,
  },
  shareButtonText: {
    ...typography.bodyBold,
    color: colors.white,
    fontSize: 16,
  },
  linkContainer: {
    width: "100%",
    backgroundColor: colors.gray[900],
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs,
  },
  linkLabel: {
    ...typography.caption,
    color: colors.gray[400],
    fontSize: 12,
  },
  linkText: {
    ...typography.body,
    color: colors.white,
    fontSize: 14,
  },
})

