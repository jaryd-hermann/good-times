"use client"

import { View, StyleSheet, TouchableOpacity, Image } from "react-native"
import { useTheme } from "../lib/theme-context"
import { spacing } from "../lib/theme"

interface NotificationBellProps {
  hasNotifications: boolean
  onPress: () => void
  size?: number
}

export function NotificationBell({ hasNotifications, onPress, size = 25 }: NotificationBellProps) {
  const { colors, isDark } = useTheme()

  const styles = StyleSheet.create({
    container: {
      width: size,
      height: size,
      justifyContent: "center",
      alignItems: "center",
    },
    icon: {
      width: size,
      height: size,
      resizeMode: "contain",
    },
  })

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={styles.container}>
        <Image
          source={hasNotifications 
            ? require("../assets/images/active-alert.png")
            : require("../assets/images/empty-alert.png")
          }
          style={[
            styles.icon,
            !hasNotifications && { opacity: 0.7 } // Reduce opacity by 30% when no notifications
          ]}
        />
      </View>
    </TouchableOpacity>
  )
}

