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
  timestamp?: string
}

const CHANGES: ChangeEntry[] = [
  {
    date: "2025-12-02",
    title: "Tuesday, December 2nd",
    subtitle: "Release notes",
    timestamp: "7:15am",
    items: [
      "You can now click on comments to open a discussion more easily--thanks Elliot!",
      "Added a little notification icon in the top right corner to let you know if you missed anything in your group",
      "Fixed the password glitch during sign up with password generators...sorry Seth & Shishir!",
      "Removed the double URLs showing in the one invitation flow",
      "Hopefully found a fix for black screens after inactivity, shouldn't be an issue anymore but let's see",
    ],
  },
  {
    date: "2025-12-01",
    title: "Monday, December 1st",
    subtitle: "Release notes",
    timestamp: "2:30pm",
    items: [
      "Improved timeline view on Home screen",
      "Made it easier to see if you missed a previous day",
      "If you're in multiple groups, made it easier to see what you've missed while in a different group",
    ],
  },
  {
    date: "2024-11-30",
    title: "Sunday, November 30th",
    subtitle: "Release notes",
    timestamp: "10:08am",
    items: [
      "Improved recency sorting so you see the latest first",
      "Hopefully fixed the video audio button not working",
      "Fingers crossed, no black screens when opening the app after long periods",
      "Made it easier to see if you missed a previous days answers",
    ],
  },
  {
    date: "2024-11-29",
    title: "Saturday, November 29th",
    subtitle: "Release notes",
    timestamp: "10:16pm",
    items: [
      "You can now open images in full view, and save them to your phone.",
    ],
  },
  {
    date: "2024-11-29",
    title: "Saturday, November 29th",
    subtitle: "Release notes",
    timestamp: "3:32pm",
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
      marginBottom: spacing.lg, // Increased padding below date
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
      marginTop: spacing.xs, // Reduced padding above bullets
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
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    avatarName: {
      ...typography.bodyBold,
      color: colors.white,
      fontSize: 14,
    },
    timestamp: {
      ...typography.caption,
      color: colors.gray[400],
      fontSize: 12,
      marginTop: 2,
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
          CHANGES.map((change, index) => {
            const previousChange = index > 0 ? CHANGES[index - 1] : null
            const showDateHeader = !previousChange || previousChange.date !== change.date
            
            return (
              <View key={index} style={styles.changeSection}>
                {showDateHeader && (
                  <>
                    <View style={styles.dateHeader}>
                      <Text style={styles.dateTitle}>{change.title}</Text>
                    </View>
                    <View style={styles.divider} />
                  </>
                )}
                <View style={[
                  styles.changeContent,
                  !showDateHeader && { paddingTop: spacing.md } // 50% reduction when no date header
                ]}>
                  <View style={styles.avatarSection}>
                    <Image 
                      source={require("../../../assets/images/jaryd-pic.png")} 
                      style={styles.avatarImage}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.avatarName}>Note from Jaryd</Text>
                      {change.timestamp && (
                        <Text style={styles.timestamp}>{change.timestamp}</Text>
                      )}
                    </View>
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
            )
          })
        )}
      </ScrollView>
    </View>
  )
}

