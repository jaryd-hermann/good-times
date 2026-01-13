"use client"

import { useMemo } from "react"
import { View, Text, StyleSheet, TouchableOpacity } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { typography, spacing } from "../../../lib/theme"
import { useTheme } from "../../../lib/theme-context"
import { Button } from "../../../components/Button"
import { useSafeAreaInsets } from "react-native-safe-area-context"

export default function CustomQuestionSuccess() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const returnTo = (params.returnTo as string) || "/(main)/home"

  // Theme 2 color palette - dynamic based on dark/light mode
  const theme2Colors = useMemo(() => {
    if (isDark) {
      // Dark mode colors
      return {
        red: "#B94444",
        yellow: "#E8A037",
        green: "#2D6F4A",
        blue: "#3A5F8C",
        beige: "#000000", // Black (was beige) - page background
        cream: "#000000", // Black (was cream) - for card backgrounds
        white: "#E8E0D5", // Beige (was white)
        text: "#F5F0EA", // Cream (was black) - text color
        textSecondary: "#A0A0A0", // Light gray (was dark gray)
      }
    } else {
      // Light mode colors (current/default)
      return {
  red: "#B94444",
  yellow: "#E8A037",
  green: "#2D6F4A",
  blue: "#3A5F8C",
  beige: "#E8E0D5",
  cream: "#F5F0EA",
  white: "#FFFFFF",
  text: "#000000",
  textSecondary: "#404040",
}
    }
  }, [isDark])

  function handleBackToHome() {
    router.push(returnTo as any)
  }

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme2Colors.beige,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.lg,
    },
    content: {
      alignItems: "center",
      maxWidth: 400,
    },
    title: {
      fontFamily: "PMGothicLudington-Text115",
      fontSize: 32,
      color: theme2Colors.text,
      marginBottom: spacing.md,
      textAlign: "center",
    },
    body: {
      fontFamily: "Roboto-Regular",
      fontSize: 16,
      color: theme2Colors.textSecondary,
      textAlign: "center",
      marginBottom: spacing.xl,
      lineHeight: 24,
    },
    button: {
      width: "100%",
      maxWidth: 300,
      backgroundColor: theme2Colors.blue,
      borderRadius: 25,
    },
    buttonText: {
      color: theme2Colors.white,
    },
  }), [theme2Colors])

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        <Text style={styles.title}>Your question will be asked soon!</Text>
        <Text style={styles.body}>
          Your custom question will be asked to everyone in the group tomorrow.
        </Text>
        <Button 
          title="Back to Home" 
          onPress={handleBackToHome} 
          style={styles.button}
          textStyle={styles.buttonText}
        />
      </View>
    </View>
  )
}

