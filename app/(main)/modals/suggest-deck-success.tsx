"use client"

import { View, Text, StyleSheet, TouchableOpacity } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { typography, spacing } from "../../../lib/theme"
import { useTheme } from "../../../lib/theme-context"
import { useSafeAreaInsets } from "react-native-safe-area-context"

// Theme 2 color palette matching new design system
const theme2Colors = {
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

export default function SuggestDeckSuccess() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const returnTo = (params.returnTo as string) || "/(main)/explore-decks"

  function handleBack() {
    router.push(returnTo as any)
  }

  const styles = StyleSheet.create({
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
      backgroundColor: theme2Colors.blue,
      borderRadius: 25,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 56,
      width: "100%",
      maxWidth: 300,
    },
    buttonText: {
      ...typography.bodyBold,
      fontSize: 16,
      color: theme2Colors.white,
    },
  })

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        <Text style={styles.title}>Thanks for your suggestion!</Text>
        <Text style={styles.body}>
          We'll review your deck idea and consider adding it to Good Times.
        </Text>
        <TouchableOpacity onPress={handleBack} style={styles.button}>
          <Text style={styles.buttonText}>Back to Decks</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

