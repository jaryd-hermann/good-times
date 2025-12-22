"use client"

import { useState, useMemo } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Share, Alert, Image } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { spacing, typography } from "../../../lib/theme"
import { useTheme } from "../../../lib/theme-context"
import { FontAwesome } from "@expo/vector-icons"

export default function InviteMembersSettings() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { colors, isDark } = useTheme()
  const groupId = params.groupId as string
  const insets = useSafeAreaInsets()

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

  async function handleShareInvite() {
    if (!groupId) return
    try {
      const inviteLink = `https://thegoodtimes.app/join/${groupId}`
      await Share.share({
        url: inviteLink,
        message: inviteLink,
        title: "Join my Good Times group",
      })
    } catch (error: any) {
      Alert.alert("Error", error.message)
    }
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
  iconContainer: {
    width: 96,
    height: 96,
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
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    lineHeight: 24,
    color: theme2Colors.textSecondary,
    textAlign: "center",
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: theme2Colors.blue,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 25,
    marginTop: spacing.md,
  },
  shareButtonText: {
    fontFamily: "Roboto-Bold",
    fontSize: 18,
    color: theme2Colors.white,
  },
  linkContainer: {
    width: "100%",
    backgroundColor: theme2Colors.cream,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: theme2Colors.textSecondary,
  },
  linkLabel: {
    fontFamily: "Roboto-Regular",
    fontSize: 12,
    color: theme2Colors.textSecondary,
  },
  linkText: {
    fontFamily: "Roboto-Regular",
    fontSize: 14,
    color: theme2Colors.text,
  },
  }), [colors, isDark, theme2Colors])

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
          activeOpacity={0.7}
        >
          <FontAwesome name="times" size={16} color={theme2Colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Image 
            source={require("../../../assets/images/people.png")} 
            style={{ width: 96, height: 96 }}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.heading}>Share Invite Link</Text>
        <Text style={styles.description}>
          Share this link with friends and family to invite them to join your group. Anyone with the link can join.
        </Text>

        <TouchableOpacity style={styles.shareButton} onPress={handleShareInvite} activeOpacity={0.7}>
          <FontAwesome name="share" size={20} color={theme2Colors.white} />
          <Text style={styles.shareButtonText}>Share Invite Link</Text>
        </TouchableOpacity>

        <View style={styles.linkContainer}>
          <Text style={styles.linkLabel}>Invite Link:</Text>
          <Text style={styles.linkText} selectable>
            https://thegoodtimes.app/join/{groupId}
          </Text>
        </View>
      </View>
    </View>
  )
}

