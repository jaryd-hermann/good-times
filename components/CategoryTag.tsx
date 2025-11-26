"use client"

import { View, Text, StyleSheet } from "react-native"
import { useTheme } from "../lib/theme-context"
import { typography, spacing } from "../lib/theme"

interface CategoryTagProps {
  category: string
}

export function CategoryTag({ category }: CategoryTagProps) {
  const { colors, isDark } = useTheme()
  
  // Only show tags for specific categories
  const shouldShow = category === "A bit deeper" || category === "Edgy/NSFW"
  if (!shouldShow) return null
  
  const displayText = category === "Edgy/NSFW" ? "NSFW" : category
  
  const styles = StyleSheet.create({
    tag: {
      alignSelf: "flex-start",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: 16,
      backgroundColor: isDark ? colors.white : colors.black,
      marginBottom: spacing.sm,
    },
    tagText: {
      ...typography.caption,
      fontSize: 12,
      fontWeight: "600",
      color: isDark ? colors.black : colors.white,
    },
  })
  
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{displayText}</Text>
    </View>
  )
}

