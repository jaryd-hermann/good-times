"use client"

import { useMemo } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { spacing, typography } from "../../../lib/theme"
import { useTheme } from "../../../lib/theme-context"
import { FontAwesome } from "@expo/vector-icons"
import { format, parseISO } from "date-fns"

interface ChangeEntry {
  date: string
  title: string
  subtitle: string
  items: string[]
  timestamp?: string
}

const CHANGES: ChangeEntry[] = [
  {
    date: "2025-12-23",
    title: "Tuesday, December 23rd",
    subtitle: "Release notes",
    timestamp: "8:35am",
    items: [
      "You can now reply in comments with videos, voice notes, and photos!",
    ],
  },
  {
    date: "2025-12-22",
    title: "Monday, December 22nd",
    subtitle: "Release notes",
    timestamp: "4:00pm",
    items: [
      "You can now record video replies to a question directly in Good Times. Max 2 minutes. Try it!",
      "Improved the scroll behavior, your groups answers shouldn't get stuck behind the header anymore",
      "Major improvements to app speed and performance",
      "Other bits and bobs to make things smoother for you",
    ],
  },
  {
    date: "2025-12-21",
    title: "Sunday, December 21st",
    subtitle: "Release notes",
    timestamp: "9:38am",
    items: [
      "Been a minute since I shared here, but lots has been happening. Here's what's new:",
      "A redesign. A new lighter, more fun, more unique look and feel. The previous version felt a bit heavy. Let me know what you think.",
      "You can now see what people answered before you do. I was hesitant to do this but Gab explained why I should change it so well. Thanks Gab!",
      "I fixed an issue where notifcations where dissapearing after opening them once",
      "History now lives on your main page, simplifying things and giving you one living \"timeline\"",
      "Made it easier to react and search for the right emoji",
      "Several other bug and improvement fixes",
    ],
  },
  {
    date: "2025-12-11",
    title: "Thursday, December 11th",
    subtitle: "Release notes",
    timestamp: "8:23am",
    items: [
      "Ok, actually have fixed the black screen issue when opening the app after over an hour",
      "You can now mentioned someone in an answer with @.",
      "Improved question personalization has been a big focus this week, you should now have more tailored questions to your group and your vibe",
      "Lots of small bug fixes and stability improvements",
    ],
  },
  {
    date: "2025-12-07",
    title: "Sunday, December 7th",
    subtitle: "Release notes",
    timestamp: "11:15am",
    items: [
      "At long holy last, fixed the black screen issue after long sessions. You should have no issue reopening app and getting stuck.",
      "Fixed the annoying keyboard typing glitch on IOS.",
      "Added mini profiles, if you tap someones pic you'll see their photo and all their answers.",
      "Added better and wider emoji support for reacting instead of just comments.",
      "Improved onboarding, with swipe to like questions added while joining to better personalize your groups questions",
      "Some general stability and bug fixes",
    ],
  },
  {
    date: "2025-12-04",
    title: "Thursday, December 4th",
    subtitle: "Release notes",
    timestamp: "9:32am",
    items: [
      "New feature, you can now swipe on questions with your group to find ones you like together. Go to \"Ask\" and tap \"Swipe\" to try it",
      "Added a notification for when someone wants to vote on a deck to shuffle in",
      "Added hyperlinking to answers to make sharing things easier",
    ],
  },
  {
    date: "2025-12-03",
    title: "Wednesday, December 3rd",
    subtitle: "Release notes",
    timestamp: "9am",
    items: [
      "Add new \"Featured Questions\" in the \"Ask\" secton, allowing your group to select curated questions available for this week only. You can choose up to two, and also, suggest questions for the entire app!",
      "If you tap someone in your groups pic at the top of the \"Ask\" tab, you'll now see a list of their answers in History. Thanks, Emily!",
      "Got rid of \"Heart\" reactions, because they seem unproductive. Rather leave the space for discussions.",
      "Added the ability to embed Soundcloud links to more easily share music (already works for Apple and Spotify).",
      "Some other bug fixes and little improvements",
    ],
  },
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

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme2Colors.beige,
    },
    header: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
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
      color: theme2Colors.textSecondary,
      fontSize: 14,
      textDecorationLine: "underline",
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
      color: theme2Colors.text,
      fontSize: 32,
    },
    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    changeSection: {
      marginBottom: spacing.lg,
    },
    changeCard: {
      backgroundColor: theme2Colors.cream,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
      marginBottom: spacing.md,
    },
    dateHeader: {
      fontSize: 22,
      marginBottom: spacing.xl,
      marginHorizontal: spacing.lg,
      flexDirection: "row",
      alignItems: "center",
    },
    dateHeaderDay: {
      fontFamily: "Roboto-Regular",
      fontSize: 22,
      lineHeight: 32,
      color: theme2Colors.text,
      fontWeight: "600",
    },
    dateHeaderDate: {
      fontFamily: "Roboto-Regular",
      fontSize: 22,
      color: theme2Colors.textSecondary,
    },
    changeList: {
      marginTop: spacing.xs,
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
      color: theme2Colors.text,
      marginRight: spacing.sm,
      marginTop: 2,
    },
    changeText: {
      ...typography.body,
      fontSize: 14,
      color: theme2Colors.text,
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
      color: theme2Colors.textSecondary,
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
      color: theme2Colors.text,
      fontSize: 14,
    },
    timestamp: {
      ...typography.caption,
      color: theme2Colors.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
  }), [colors, isDark, theme2Colors])

  return (
      <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Latest Changes</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton} activeOpacity={0.7}>
            <FontAwesome name="times" size={16} color={theme2Colors.text} />
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
                  <View style={styles.dateHeader}>
                    <Text style={styles.dateHeaderDay}>{format(parseISO(change.date), "EEEE")}</Text>
                    <Text style={styles.dateHeaderDate}>, {format(parseISO(change.date), "d MMMM yyyy")}</Text>
                  </View>
                )}
                <View style={styles.changeCard}>
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
                      itemIndex === 0 ? (
                        // First item: plain text without bullet
                        <Text key={itemIndex} style={styles.changeText}>{item}</Text>
                      ) : (
                        // Subsequent items: with bullet
                        <View key={itemIndex} style={styles.changeItem}>
                          <Text style={styles.bullet}>•</Text>
                          <Text style={styles.changeText}>{item}</Text>
                        </View>
                      )
                    ))}
                  </View>
                </View>
              </View>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}

