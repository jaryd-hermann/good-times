"use client"

import { View, Text, StyleSheet, ImageBackground, Dimensions } from "react-native"
import { useRouter } from "expo-router"
import { colors, typography, spacing } from "../../lib/theme"
import { Button } from "../../components/Button"
import { OnboardingBack } from "../../components/OnboardingBack"
import { OnboardingProgress } from "../../components/OnboardingProgress"

const { width, height } = Dimensions.get("window")

export default function Welcome3() {
  const router = useRouter()

  return (
    <ImageBackground
      source={require("../../assets/images/welcome4-bg.png")}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <View style={styles.content}>
        <View style={styles.topBar}>
          <OnboardingBack />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.body}>
            This is for you if you have family and friends you don't always get to see and speak with. If you want to be in touch better
            but calls and messages can be a lot. Good Times is the simple and meaningful way to keep connected with the people you love and want to be close to, without the pressure.
          </Text>
        </View>

        <View style={styles.bottomContainer}>
          <OnboardingProgress total={3} current={2} />
          <View style={styles.buttonContainer}>
            <Button
              title="→"
              onPress={() => router.push("/(onboarding)/how-it-works")}
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
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
    paddingBottom: spacing.xl,
  },
  body: {
    ...typography.body,
    fontSize: 18,
    lineHeight: 28,
    color: colors.white,
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
