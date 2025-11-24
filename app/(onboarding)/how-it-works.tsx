"use client"

import { View, Text, StyleSheet, ImageBackground, Dimensions } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useRouter } from "expo-router"
import { colors, typography, spacing } from "../../lib/theme"
import { Button } from "../../components/Button"
import { OnboardingBack } from "../../components/OnboardingBack"
import { OnboardingProgress } from "../../components/OnboardingProgress"
import AsyncStorage from "@react-native-async-storage/async-storage"

const { width, height } = Dimensions.get("window")
const PENDING_GROUP_KEY = "pending_group_join"

const STEPS = [
  "Every day, you get one short question.",
  "Answer in just a minute or two.",
  "Enjoy what everyone said.",
  "It all gets connected in your History.",
  "Flip through your timeine to relive memories and feel closer even when you're far apart.",
]

export default function HowItWorks() {
  const router = useRouter()

  async function handleContinue() {
    // Check if user is joining a group (group join flow)
    const pendingGroupId = await AsyncStorage.getItem(PENDING_GROUP_KEY)
    if (pendingGroupId) {
      // Group join flow: skip create-group and memorial, go straight to about
      router.push("/(onboarding)/about")
    } else {
      // Standard flow: go to create-group
      router.push("/(onboarding)/create-group/name-type")
    }
  }

  return (
    <ImageBackground
      source={require("../../assets/images/onboarding3-bg.png")}
      style={styles.container}
      resizeMode="cover"
    >
      <LinearGradient
        colors={["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0.5)", "rgba(0, 0, 0, 0.8)", "rgba(0, 0, 0, 1)"]}
        locations={[0, 0.4, 0.7, 1]}
        style={styles.gradientOverlay}
      />
      <View style={styles.content}>
        <View style={styles.topBar}>
          <OnboardingBack />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>How to use it</Text>

          <View style={styles.steps}>
            {STEPS.map((step, index) => (
              <View key={step} style={styles.step}>
                <Text style={styles.stepNumber}>{index + 1}.</Text>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.bottomContainer}>
          <OnboardingProgress total={3} current={3} />
          <View style={styles.buttonContainer}>
            <Button
              title="→"
              onPress={handleContinue}
              style={styles.button}
              textStyle={styles.buttonText}
            />
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
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    padding: spacing.lg,
    paddingTop: spacing.xxl * 2,
    paddingBottom: spacing.xxl * 2,
  },
  topBar: {
    position: "absolute",
    top: spacing.xxl,
    left: spacing.lg,
    zIndex: 1,
  },
  textContainer: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: spacing.xxl,
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
  bottomContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  buttonContainer: {
    alignItems: "flex-end",
    marginLeft: spacing.md,
  },
  button: {
    width: 100,
    height: 60,
  },
  buttonText: {
    fontSize: 32,
  },
})
