"use client"

import { View, Text, StyleSheet, ImageBackground, Dimensions } from "react-native"
import { useRouter } from "expo-router"
import { colors, typography, spacing } from "../../lib/theme"
import { Button } from "../../components/Button"

const { width, height } = Dimensions.get("window")

export default function Welcome2() {
  const router = useRouter()

  return (
    <ImageBackground
      source={require("../../assets/images/onboarding1-bg.png")}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>I'm Jaryd</Text>
          <Text style={styles.body}>
            I made this because I live far from my family and friends. We all do. And I wanted a way to stay close that
            didn't feel like work.
          </Text>
          <Text style={styles.body}>
            No endless scrolling. No pressure to perform. Just a simple way to share what matters with the people who
            matter most.
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <Button
            title="→"
            onPress={() => router.push("/(onboarding)/how-it-works")}
            style={styles.button}
            textStyle={styles.buttonText}
          />
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
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    padding: spacing.lg,
    paddingTop: spacing.xxl * 3,
    paddingBottom: spacing.xxl * 2,
  },
  textContainer: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: spacing.xxl,
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
