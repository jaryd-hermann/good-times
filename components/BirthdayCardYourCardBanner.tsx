"use client"

import { useMemo, useEffect } from "react"
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { useTheme } from "../lib/theme-context"
import { spacing, typography } from "../lib/theme"
import { FontAwesome } from "@expo/vector-icons"
import { usePostHog } from "posthog-react-native"
import { captureEvent } from "../lib/posthog"
import { Avatar } from "./Avatar"

interface ContributorAvatar {
  user_id: string
  avatar_url?: string
  name?: string
}

interface BirthdayCardYourCardBannerProps {
  groupId: string
  cardId: string
  birthdayDate: string
  contributorAvatars: ContributorAvatar[]
  onPress: () => void
}

export function BirthdayCardYourCardBanner({
  groupId,
  cardId,
  birthdayDate,
  contributorAvatars,
  onPress,
}: BirthdayCardYourCardBannerProps) {
  const { colors, isDark } = useTheme()
  const posthog = usePostHog()

  // Track viewed_birthday_card_your_card_banner event when banner is rendered
  useEffect(() => {
    try {
      if (posthog) {
        posthog.capture("viewed_birthday_card_your_card_banner", {
          group_id: groupId,
          card_id: cardId,
          birthday_date: birthdayDate,
          contributor_count: contributorAvatars.length,
        })
      } else {
        captureEvent("viewed_birthday_card_your_card_banner", {
          group_id: groupId,
          card_id: cardId,
          birthday_date: birthdayDate,
          contributor_count: contributorAvatars.length,
        })
      }
    } catch (error) {
      if (__DEV__)
        console.error(
          "[BirthdayCardYourCardBanner] Failed to track viewed_birthday_card_your_card_banner:",
          error
        )
    }
  }, [posthog, groupId, cardId, birthdayDate, contributorAvatars.length])

  function handlePress() {
    // Track clicked_birthday_card_your_card_banner event
    try {
      if (posthog) {
        posthog.capture("clicked_birthday_card_your_card_banner", {
          group_id: groupId,
          card_id: cardId,
          birthday_date: birthdayDate,
        })
      } else {
        captureEvent("clicked_birthday_card_your_card_banner", {
          group_id: groupId,
          card_id: cardId,
          birthday_date: birthdayDate,
        })
      }
    } catch (error) {
      if (__DEV__)
        console.error(
          "[BirthdayCardYourCardBanner] Failed to track clicked_birthday_card_your_card_banner:",
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
          padding: spacing.md,
          borderRadius: 0, // Square edges
          borderWidth: 1,
          borderColor: isDark ? "#ffffff" : "#000000", // White in dark mode, black in light mode
          marginHorizontal: spacing.lg,
          marginTop: spacing.xs,
          marginBottom: spacing.lg,
          flexDirection: "column", // Vertical layout for top-centered avatars
          alignItems: "center", // Center content horizontally
          justifyContent: "space-between",
          minHeight: 80,
        },
        bannerWrapper: {
          marginBottom: spacing.lg,
        },
        bannerContent: {
          flex: 1,
          width: "100%",
          flexDirection: "column",
          alignItems: "center",
        },
        avatarsContainer: {
          flexDirection: "row",
          justifyContent: "center", // Center avatars horizontally
          alignItems: "center",
          marginBottom: spacing.sm,
        },
        avatar: {
          marginLeft: -8, // Overlap avatars slightly
        },
        firstAvatar: {
          marginLeft: 0,
        },
        textContainer: {
          flex: 1,
          alignItems: "center", // Center text
          width: "100%",
        },
        bannerTitle: {
          ...typography.bodyBold,
          fontSize: 16,
          color: isDark ? "#ffffff" : "#000000", // White in dark mode, black in light mode
          marginBottom: spacing.xs,
          textAlign: "center",
        },
        bannerText: {
          ...typography.body,
          fontSize: 14,
          color: colors.gray[300],
          opacity: 0.9,
          textAlign: "center",
        },
        bannerIcon: {
          position: "absolute",
          right: spacing.md,
          top: "50%",
          marginTop: -8, // Half of icon height to center vertically
        },
      }),
    [colors, isDark]
  )

  // Show up to 3 avatars (small circular avatars)
  const avatarsToShow = contributorAvatars.slice(0, 3)
  const avatarSize = 32 // Small circular avatars

  return (
    <View style={styles.bannerWrapper}>
      <TouchableOpacity style={styles.banner} onPress={handlePress} activeOpacity={0.8}>
        <View style={styles.bannerContent}>
          <View style={styles.avatarsContainer}>
            {avatarsToShow.map((contributor, index) => (
              <View
                key={contributor.user_id}
                style={[styles.avatar, index === 0 && styles.firstAvatar]}
              >
                <Avatar 
                  uri={contributor.avatar_url} 
                  name={contributor.name || `User ${contributor.user_id.slice(0, 4)}`} 
                  size={avatarSize} 
                />
              </View>
            ))}
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.bannerTitle}>You have a birthday card! 🎉</Text>
            <Text style={styles.bannerText}>
              {contributorAvatars.length} {contributorAvatars.length === 1 ? "person" : "people"}{" "}
              wrote you a special message
            </Text>
          </View>
        </View>
        <FontAwesome name="chevron-right" size={16} color={isDark ? "#ffffff" : "#000000"} style={styles.bannerIcon} />
      </TouchableOpacity>
    </View>
  )
}

