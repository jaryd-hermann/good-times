"use client"

import { useMemo } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native"
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
      "New question decks feature - explore curated collections of questions",
      "Improved video playback with inline controls",
      "Enhanced avatar upload during onboarding",
      "Better error handling for media uploads",
      "Fixed duplicate URL issue in invite links",
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
      color: colors.white,
      fontSize: 32,
    },
    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    changeSection: {
      marginBottom: spacing.xl,
    },
    dateHeader: {
      flexDirection: "row",
      alignItems: "baseline",
      marginBottom: spacing.sm,
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
  }), [colors, isDark])

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Latest Changes</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Text style={styles.closeText}>✕</Text>
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
              <View style={styles.changeList}>
                {change.items.map((item, itemIndex) => (
                  <View key={itemIndex} style={styles.changeItem}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.changeText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
}

