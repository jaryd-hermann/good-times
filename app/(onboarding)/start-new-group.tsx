"use client"

import { ImageBackground, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { useRouter } from "expo-router"
import { colors, spacing, typography } from "../../lib/theme"
import { Button } from "../../components/Button"
import { useOnboarding } from "../../components/OnboardingProvider"

export default function StartNewGroup() {
  const router = useRouter()
  const { clear } = useOnboarding()

  function handleContinue() {
    clear()
    router.push({
      pathname: "/(onboarding)/create-group/name-type",
      params: { mode: "add" },
    })
  }

  function handleBackHome() {
    router.back()
  }

  return (
    <ImageBackground
      source={require("../../assets/images/newgroup-bg.png")}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={handleBackHome} activeOpacity={0.8}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>Start another group</Text>
          <Text style={styles.subtitle}>
            Keep a new story going with a fresh group. We’ll walk you through the details in just a minute.
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <Button title="→" onPress={handleContinue} style={styles.button} textStyle={styles.buttonText} />
        </View>
      </View>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    padding: spacing.lg,
    paddingTop: spacing.xxl * 3,
    paddingBottom: spacing.xxl * 2,
  },
  topRow: {
    position: "absolute",
    top: spacing.xxl,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  backText: {
    fontFamily: "Roboto-Medium",
    fontSize: 16,
    color: colors.white,
  },
  textContainer: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  title: {
    fontFamily: "LibreBaskerville-Bold",
    fontSize: 44,
    lineHeight: 52,
    color: colors.white,
  },
  subtitle: {
    ...typography.body,
    fontSize: 18,
    lineHeight: 28,
    color: colors.white,
  },
  buttonContainer: {
    alignItems: "flex-end",
  },
  button: {
    width: 100,
    height: 60,
  },
  buttonText: {
    fontSize: 32,
  },
})

