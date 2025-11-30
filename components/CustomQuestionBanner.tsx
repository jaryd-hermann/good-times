"use client"

import { useMemo, useEffect } from "react"
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native"
import { useTheme } from "../lib/theme-context"
import { spacing, typography } from "../lib/theme"
import { FontAwesome } from "@expo/vector-icons"
import { usePostHog } from "posthog-react-native"
import { captureEvent } from "../lib/posthog"

interface CustomQuestionBannerProps {
  groupId: string
  date: string
  onPress: () => void
  reduceSpacing?: boolean // Reduce bottom margin when birthday banners follow
}

export function CustomQuestionBanner({ groupId, date, onPress, reduceSpacing = false }: CustomQuestionBannerProps) {
  const { colors, isDark } = useTheme()
  const posthog = usePostHog()

  // Track custom_question_banner_shown event when banner is rendered
  useEffect(() => {
    try {
      if (posthog) {
        posthog.capture("custom_question_banner_shown", { group_id: groupId, date })
      } else {
        captureEvent("custom_question_banner_shown", { group_id: groupId, date })
      }
    } catch (error) {
      if (__DEV__) console.error("[CustomQuestionBanner] Failed to track custom_question_banner_shown:", error)
    }
  }, [posthog, groupId, date])

  function handlePress() {
    // Track clicked_custom_question_alert event
    try {
      if (posthog) {
        posthog.capture("clicked_custom_question_alert", { group_id: groupId, date })
      } else {
        captureEvent("clicked_custom_question_alert", { group_id: groupId, date })
      }
    } catch (error) {
      if (__DEV__) console.error("[CustomQuestionBanner] Failed to track clicked_custom_question_alert:", error)
    }
    
    onPress()
  }

  // Calculate banner height for icon sizing
  // Subtract border width (1px top + 1px bottom = 2px) so image doesn't overlap border
  const bannerHeight = 80
  const borderWidth = 1
  const iconHeight = bannerHeight - (borderWidth * 2) // Account for top and bottom borders

  const styles = useMemo(() => StyleSheet.create({
    banner: {
      backgroundColor: colors.gray[900], // Dark gray background
      paddingRight: spacing.md,
      paddingLeft: 0, // No left padding - icon touches edge
      paddingVertical: 0, // No vertical padding - icon touches top/bottom
      borderRadius: 0, // Square edges
      borderWidth: 1,
      borderColor: isDark ? "#ffffff" : "#000000", // White in dark mode, black in light mode
      marginHorizontal: spacing.lg,
      marginTop: spacing.xs,
      marginBottom: 0, // No bottom margin on banner itself - handled by wrapper
      flexDirection: "row",
      alignItems: "center", // Center content vertically
      justifyContent: "space-between",
      height: 80, // Fixed height to match birthday card banners
    },
    bannerWrapper: {
      marginBottom: reduceSpacing ? spacing.md : spacing.lg, // Reduce by 50% when birthday banners follow
    },
    bannerContent: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      height: "100%", // Fill banner height
    },
    iconContainer: {
      marginRight: spacing.md,
      height: "100%", // Fill banner height
      justifyContent: "center",
      alignItems: "center",
    },
    icon: {
      width: iconHeight, // Square - width matches height
      height: iconHeight,
      resizeMode: "contain",
    },
    textContainer: {
      flex: 1,
    },
    bannerTitle: {
      ...typography.bodyBold,
      fontSize: 16,
      color: isDark ? "#ffffff" : "#000000", // White in dark mode, black in light mode
      marginBottom: spacing.xs,
    },
    bannerText: {
      ...typography.body,
      fontSize: 14,
      color: colors.gray[300], // Light gray to match birthday card banner
    },
    bannerIcon: {
      marginLeft: spacing.md,
      alignSelf: "center", // Center chevron vertically
      color: isDark ? "#ffffff" : "#000000", // White in dark mode, black in light mode
    },
  }), [colors, isDark, reduceSpacing, iconHeight])

  return (
    <View style={styles.bannerWrapper}>
      <TouchableOpacity style={styles.banner} onPress={handlePress} activeOpacity={0.8}>
        <View style={styles.bannerContent}>
          <View style={styles.iconContainer}>
            <Image
              source={require("../assets/images/custom-question.png")}
              style={styles.icon}
              resizeMode="contain"
              tintColor={isDark ? undefined : "#000000"} // Black in light mode, default (white) in dark mode
            />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.bannerTitle}>Ask the group a question!</Text>
            <Text style={styles.bannerText}>Your turn expires today</Text>
          </View>
        </View>
        <FontAwesome name="chevron-right" size={16} color={isDark ? "#ffffff" : "#000000"} style={styles.bannerIcon} />
      </TouchableOpacity>
    </View>
  )
}
