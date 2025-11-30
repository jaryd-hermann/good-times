"use client"

import { View, Text, StyleSheet, TouchableOpacity } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { typography, spacing } from "../../../lib/theme"
import { useTheme } from "../../../lib/theme-context"
import { Button } from "../../../components/Button"
import { useSafeAreaInsets } from "react-native-safe-area-context"

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
      backgroundColor: colors.black,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.lg,
    },
    content: {
      alignItems: "center",
      maxWidth: 400,
    },
    title: {
      ...typography.h1,
      fontSize: 32,
      color: colors.white,
      marginBottom: spacing.md,
      textAlign: "center",
    },
    body: {
      ...typography.body,
      fontSize: 16,
      color: colors.gray[400],
      textAlign: "center",
      marginBottom: spacing.xl,
      lineHeight: 24,
    },
    button: {
      width: "100%",
      maxWidth: 300,
    },
  })

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        <Text style={styles.title}>Thanks for your suggestion!</Text>
        <Text style={styles.body}>
          We'll review your deck idea and consider adding it to Good Times.
        </Text>
        <Button title="Back to Decks" onPress={handleBack} style={styles.button} />
      </View>
    </View>
  )
}

