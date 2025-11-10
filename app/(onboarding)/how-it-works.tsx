"use client"

import { View, Text, StyleSheet, ImageBackground, Dimensions } from "react-native"
import { useRouter } from "expo-router"
import { colors, typography, spacing } from "../../lib/theme"
import { Button } from "../../components/Button"
import { OnboardingBack } from "../../components/OnboardingBack"
import { OnboardingProgress } from "../../components/OnboardingProgress"

const { width, height } = Dimensions.get("window")

const STEPS = [
  "Every day, your group gets a new question or prompt to answer. Something simple, meaningful, or fun.",
  "Share your answer with text, photos, or voice notes. It takes just a minute or two.",
  "Once you've shared, you can see what everyone else said. React, comment, and connect.",
  "Over time, you build a shared story. A living record of your lives together.",
  "Look back anytime to relive memories, see how you've grown, and feel close even when you're far apart.",
]

export default function HowItWorks() {
  const router = useRouter()

  return (
    <ImageBackground
      source={require("../../assets/images/onboarding3-bg.png")}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <View style={styles.topBar}>
        <OnboardingBack />
      </View>
      <View style={styles.content}>
        <View style={styles.floatingContent}>
          <Text style={styles.title}>How to use it</Text>

          <View style={styles.steps}>
            {STEPS.map((step, index) => (
              <View key={step} style={styles.step}>
                <Text style={styles.stepNumber}>{index + 1}.</Text>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>

          <View style={styles.controls}>
            <OnboardingProgress total={3} current={3} />
            <View style={styles.buttonContainer}>
              <Button
                title="→"
                onPress={() => router.push("/(onboarding)/create-group/name-type")}
                style={styles.button}
                textStyle={styles.buttonText}
              />
            </View>
          </View>
        </View>
      </View>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width,
    height,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  topBar: {
    position: "absolute",
    top: spacing.xxl,
    left: spacing.lg,
    zIndex: 1,
  },
  content: {
    padding: spacing.lg,
    flex: 1,
  },
  floatingContent: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
    gap: spacing.lg,
  },
  title: {
    ...typography.h1,
    fontSize: 40,
    marginBottom: spacing.xl,
  },
  steps: {
    gap: spacing.sm,
  },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  stepNumber: {
    ...typography.h3,
    fontSize: 18,
    minWidth: 30,
  },
  stepText: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.white,
    flex: 1,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
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
