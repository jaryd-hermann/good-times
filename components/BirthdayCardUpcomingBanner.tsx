"use client"

import { useMemo, useEffect } from "react"
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native"
import { useTheme } from "../lib/theme-context"
import { spacing, typography } from "../lib/theme"
import { FontAwesome } from "@expo/vector-icons"
import { usePostHog } from "posthog-react-native"
import { captureEvent } from "../lib/posthog"
import { Avatar } from "./Avatar"

// Square avatar variant for birthday card banners - fills full height
function SquareAvatar({ uri, name, containerHeight }: { uri?: string; name?: string | null; containerHeight: number }) {
  const { colors } = useTheme()
  
  // Handle null/undefined names gracefully
  const displayName = name || "User"
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const squareAvatarStyles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          width: containerHeight, // Square - width matches height
          height: containerHeight,
          backgroundColor: colors.gray[700],
          justifyContent: "center",
          alignItems: "center",
          overflow: "hidden",
          borderTopLeftRadius: 12, // Match banner border radius
          borderBottomLeftRadius: 12, // Match banner border radius
        },
        image: {
          width: containerHeight,
          height: containerHeight,
        },
        initials: {
          ...typography.bodyBold,
          color: colors.white,
          fontSize: containerHeight * 0.4,
        },
      }),
    [colors, containerHeight]
  )

  return (
    <View style={squareAvatarStyles.container}>
      {uri ? (
        <Image source={{ uri }} style={squareAvatarStyles.image} />
      ) : (
        <Text style={squareAvatarStyles.initials}>{initials}</Text>
      )}
    </View>
  )
}

interface BirthdayCardUpcomingBannerProps {
  groupId: string
  cardId: string
  birthdayUserId: string
  birthdayUserName: string
  birthdayUserAvatar?: string
  birthdayDate: string
  onPress: () => void
}

export function BirthdayCardUpcomingBanner({
  groupId,
  cardId,
  birthdayUserId,
  birthdayUserName,
  birthdayUserAvatar,
  birthdayDate,
  onPress,
}: BirthdayCardUpcomingBannerProps) {
  const { colors, isDark } = useTheme()
  const posthog = usePostHog()

  // Track viewed_birthday_card_upcoming_banner event when banner is rendered
  useEffect(() => {
    try {
      if (posthog) {
        posthog.capture("viewed_birthday_card_upcoming_banner", {
          group_id: groupId,
          card_id: cardId,
          birthday_user_id: birthdayUserId,
          birthday_date: birthdayDate,
        })
      } else {
        captureEvent("viewed_birthday_card_upcoming_banner", {
          group_id: groupId,
          card_id: cardId,
          birthday_user_id: birthdayUserId,
          birthday_date: birthdayDate,
        })
      }
    } catch (error) {
      if (__DEV__)
        console.error(
          "[BirthdayCardUpcomingBanner] Failed to track viewed_birthday_card_upcoming_banner:",
          error
        )
    }
  }, [posthog, groupId, cardId, birthdayUserId, birthdayDate])

  function handlePress() {
    // Track clicked_birthday_card_upcoming_banner event
    try {
      if (posthog) {
        posthog.capture("clicked_birthday_card_upcoming_banner", {
          group_id: groupId,
          card_id: cardId,
          birthday_user_id: birthdayUserId,
          birthday_date: birthdayDate,
        })
      } else {
        captureEvent("clicked_birthday_card_upcoming_banner", {
          group_id: groupId,
          card_id: cardId,
          birthday_user_id: birthdayUserId,
          birthday_date: birthdayDate,
        })
      }
    } catch (error) {
      if (__DEV__)
        console.error(
          "[BirthdayCardUpcomingBanner] Failed to track clicked_birthday_card_upcoming_banner:",
          error
        )
    }

    onPress()
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
        banner: {
          backgroundColor: colors.gray[900],
          paddingRight: spacing.md,
          paddingLeft: 0, // No left padding - avatar touches edge
          paddingVertical: 0, // No vertical padding - avatar touches top/bottom
          borderRadius: 12, // Rounded edges
          borderWidth: 1,
          borderColor: isDark ? "#ffffff" : "#000000", // White in dark mode, black in light mode
          marginHorizontal: spacing.lg,
          marginTop: 0, // Reduced spacing below day navigation
          marginBottom: spacing.lg,
          flexDirection: "row",
          alignItems: "center", // Center content vertically
          justifyContent: "space-between",
          height: 80, // Fixed height to match avatar
          overflow: "hidden", // Ensure rounded corners clip content
        },
        bannerWrapper: {
          marginBottom: spacing.lg,
        },
        bannerContent: {
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          height: "100%", // Fill banner height
        },
        avatarContainer: {
          marginRight: spacing.md,
          height: "100%", // Fill banner height
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
          color: colors.gray[300],
          opacity: 0.9,
        },
        bannerIcon: {
          marginLeft: spacing.md,
          alignSelf: "center", // Center chevron vertically
        },
      }),
    [colors, isDark]
  )

  // Calculate banner height for avatar sizing
  // Subtract border width (1px top + 1px bottom = 2px) so image doesn't overlap border
  const bannerHeight = 80
  const borderWidth = 1
  const avatarHeight = bannerHeight - (borderWidth * 2) // Account for top and bottom borders

  return (
    <View style={styles.bannerWrapper}>
      <TouchableOpacity style={styles.banner} onPress={handlePress} activeOpacity={0.8}>
        <View style={styles.bannerContent}>
          <View style={styles.avatarContainer}>
            <SquareAvatar uri={birthdayUserAvatar} name={birthdayUserName} containerHeight={avatarHeight} />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.bannerTitle}>Write {birthdayUserName || "them"} a birthday card</Text>
            <Text style={styles.bannerText}>Their birthday is coming up soon!</Text>
          </View>
        </View>
        <FontAwesome name="chevron-right" size={16} color={isDark ? "#ffffff" : "#000000"} style={styles.bannerIcon} />
      </TouchableOpacity>
    </View>
  )
}

