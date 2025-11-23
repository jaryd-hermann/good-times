"use client"

import { useMemo } from "react"
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { useTheme } from "../lib/theme-context"
import { spacing, typography } from "../lib/theme"
import { FontAwesome } from "@expo/vector-icons"

interface CustomQuestionBannerProps {
  groupId: string
  date: string
  onPress: () => void
}

export function CustomQuestionBanner({ groupId, date, onPress }: CustomQuestionBannerProps) {
  const { colors } = useTheme()

  const styles = useMemo(() => StyleSheet.create({
    banner: {
      backgroundColor: "#b04931",
      padding: spacing.md,
      borderRadius: 12,
      marginHorizontal: spacing.lg,
      marginTop: spacing.xs, // Small top margin to separate from notice
      marginBottom: spacing.lg, // Bottom margin to prevent cropping
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    bannerWrapper: {
      marginBottom: spacing.lg, // Wrapper ensures bottom spacing isn't clipped
    },
    bannerContent: {
      flex: 1,
    },
    bannerTitle: {
      ...typography.bodyBold,
      fontSize: 16,
      color: "#ffffff",
      marginBottom: spacing.xs,
    },
    bannerText: {
      ...typography.body,
      fontSize: 14,
      color: "#ffffff",
      opacity: 0.9,
    },
    expiresText: {
      textDecorationLine: "underline",
    },
    bannerIcon: {
      marginLeft: spacing.md,
    },
  }), [colors])

  return (
    <View style={styles.bannerWrapper}>
      <TouchableOpacity style={styles.banner} onPress={onPress} activeOpacity={0.8}>
        <View style={styles.bannerContent}>
          <Text style={styles.bannerTitle}>You've been selected...</Text>
          <Text style={styles.bannerText}>
            You've been given the power to ask the group your own question!{" "}
            <Text style={styles.expiresText}>Expires today</Text>
          </Text>
        </View>
        <FontAwesome name="chevron-right" size={16} color="#ffffff" style={styles.bannerIcon} />
      </TouchableOpacity>
    </View>
  )
}
