"use client"

import { View, StyleSheet, TouchableOpacity } from "react-native"
import { useTheme } from "../lib/theme-context"
import { spacing } from "../lib/theme"

interface NotificationBellProps {
  hasNotifications: boolean
  onPress: () => void
  size?: number
}

export function NotificationBell({ hasNotifications, onPress, size = 28 }: NotificationBellProps) {
  const { colors, isDark } = useTheme()

  const styles = StyleSheet.create({
    container: {
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: 1,
      borderColor: isDark ? colors.gray[400] : colors.gray[200],
      backgroundColor: "transparent",
      justifyContent: "center",
      alignItems: "center",
      position: "relative",
    },
    dot: {
      position: "absolute",
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.accent, // CTA color
      top: "50%",
      left: "50%",
      marginTop: -5, // Half of dot height (10 / 2)
      marginLeft: -5, // Half of dot width (10 / 2)
    },
  })

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={styles.container}>
        {hasNotifications && <View style={styles.dot} />}
      </View>
    </TouchableOpacity>
  )
}

