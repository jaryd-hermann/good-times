"use client"

import { View, StyleSheet, TouchableOpacity, Image } from "react-native"

interface NotificationBellProps {
  hasNotifications: boolean
  onPress: () => void
  size?: number
}

export function NotificationBell({ hasNotifications, onPress, size = 25 }: NotificationBellProps) {
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
            ? require("../assets/images/bell.png")
            : require("../assets/images/empty-bell.png")
          }
          style={styles.icon}
        />
      </View>
    </TouchableOpacity>
  )
}

