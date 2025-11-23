"use client"

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

  function handleBackToHome() {
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
        <Text style={styles.title}>Your question will be asked soon!</Text>
        <Text style={styles.body}>
          Your custom question will be asked to everyone in the group tomorrow.
        </Text>
        <Button title="Back to Home" onPress={handleBackToHome} style={styles.button} />
      </View>
    </View>
  )
}

