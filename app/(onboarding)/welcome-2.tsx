"use client"

import { useEffect } from "react"
import { View, Text, StyleSheet, ImageBackground, Dimensions } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useRouter } from "expo-router"
import { colors, typography, spacing } from "../../lib/theme"
import { Button } from "../../components/Button"
import { OnboardingBack } from "../../components/OnboardingBack"
import { OnboardingProgress } from "../../components/OnboardingProgress"
import { usePostHog } from "posthog-react-native"
import { captureEvent } from "../../lib/posthog"

const { width, height } = Dimensions.get("window")

export default function Welcome2() {
  const router = useRouter()
  const posthog = usePostHog()

  useEffect(() => {
    try {
      if (posthog) {
        posthog.capture("loaded_jaryd_intro_1")
      } else {
        captureEvent("loaded_jaryd_intro_1")
      }
    } catch (error) {
      if (__DEV__) console.error("[welcome-2] Failed to track event:", error)
    }
  }, [posthog])

  return (
    <ImageBackground
      source={require("../../assets/images/me-1.png")}
      style={styles.container}
      resizeMode="cover"
    >
      <LinearGradient
        colors={["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0.4)", "rgba(0, 0, 0, 0.8)", "rgba(0, 0, 0, 1)"]}
        locations={[0, 0.4, 0.7, 1]}
        style={styles.gradientOverlay}
      />
      <View style={styles.content}>
        <View style={styles.topBar}>
          <OnboardingBack />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>I'm Jaryd</Text>
          <Text style={styles.body}>
          I made Good Times to stay close to my favorite people. Most of them live far away. 
          </Text>
          <Text style={styles.body}>
            <Text style={styles.boldText}>Keeping in touch isn't always easy...</Text>
          </Text>
        </View>

        <View style={styles.bottomContainer}>
          <OnboardingProgress total={3} current={1} />
          <View style={styles.buttonContainer}>
            <Button
              title="→"
              onPress={() => router.push("/(onboarding)/welcome-3")}
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
  bottomContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  title: {
    ...typography.h1,
    fontSize: 40,
    marginBottom: spacing.lg,
  },
  body: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.white,
    marginBottom: spacing.md,
  },
  boldText: {
    fontWeight: "bold",
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
