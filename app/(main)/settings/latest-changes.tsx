"use client"

import { useMemo } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { spacing, typography } from "../../../lib/theme"
import { useTheme } from "../../../lib/theme-context"
import { FontAwesome } from "@expo/vector-icons"

interface ChangeEntry {
  date: string
  title: string
  subtitle: string
  items: string[]
}

const CHANGES: ChangeEntry[] = [
  {
    date: "2024-11-29",
    title: "Saturday, November 29th",
    subtitle: "Release notes",
    items: [
      "Made it easier for you to see multiple photos at once",
      "Made it easier for you to watch videos",
      "Improved that odd reloading glitch",
      "Made sure your profile pic shows up",
      "Made it possible to reorder multiple media uploads in your entries",
      "Remove duplicate links showing in your invite URLs",
      "Added this new update section to keep you posted with new things added to the app",
    ],
  },
]

export default function LatestChanges() {
  const router = useRouter()
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.black,
    },
    header: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.gray[800],
    },
    headerTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
    },
    feedbackLink: {
      marginTop: spacing.xs,
    },
    feedbackLinkText: {
      ...typography.body,
      color: colors.gray[400],
      fontSize: 14,
      textDecorationLine: "underline",
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
      color: colors.white,
      fontSize: 32,
    },
    content: {
      paddingBottom: spacing.xxl,
    },
    changeSection: {
      marginBottom: spacing.xl,
    },
    divider: {
      height: 1,
      backgroundColor: isDark ? colors.gray[800] : colors.gray[200],
      width: "100%",
    },
    dateHeader: {
      flexDirection: "row",
      alignItems: "baseline",
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    changeContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.md,
    },
    dateTitle: {
      ...typography.h2,
      fontSize: 22,
      fontFamily: "LibreBaskerville-Bold",
      color: colors.white,
      marginRight: spacing.sm,
    },
    dateSubtitle: {
      ...typography.body,
      fontSize: 14,
      color: colors.gray[400],
    },
    changeList: {
      marginTop: spacing.md,
      gap: spacing.sm,
    },
    changeItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingLeft: spacing.md,
    },
    bullet: {
      ...typography.body,
      fontSize: 14,
      color: colors.gray[400],
      marginRight: spacing.sm,
      marginTop: 2,
    },
    changeText: {
      ...typography.body,
      fontSize: 14,
      color: colors.gray[300],
      flex: 1,
      lineHeight: 20,
    },
    emptyState: {
      padding: spacing.xl,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 200,
    },
    emptyText: {
      ...typography.body,
      color: colors.gray[400],
      textAlign: "center",
    },
    avatarSection: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.lg,
      gap: spacing.md,
    },
    avatarImage: {
      width: 28,
      height: 28,
      borderRadius: 14,
    },
    avatarName: {
      ...typography.bodyBold,
      color: colors.white,
      fontSize: 14,
    },
  }), [colors, isDark])

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Latest Changes</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => router.push("/(main)/feedback")} style={styles.feedbackLink}>
          <Text style={styles.feedbackLinkText}>Share your feedback</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {CHANGES.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No changes to display yet.</Text>
          </View>
        ) : (
          CHANGES.map((change, index) => (
            <View key={index} style={styles.changeSection}>
              <View style={styles.dateHeader}>
                <Text style={styles.dateTitle}>{change.title}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.changeContent}>
                <View style={styles.avatarSection}>
                  <Image 
                    source={require("../../../assets/images/jaryd-pic.png")} 
                    style={styles.avatarImage}
                  />
                  <Text style={styles.avatarName}>Note from Jaryd</Text>
                </View>
                <View style={styles.changeList}>
                  {change.items.map((item, itemIndex) => (
                    <View key={itemIndex} style={styles.changeItem}>
                      <Text style={styles.bullet}>•</Text>
                      <Text style={styles.changeText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.divider} />
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
}

