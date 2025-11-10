"use client"

import { View, Text, StyleSheet, ImageBackground, Dimensions, TouchableOpacity } from "react-native"
import { useRouter } from "expo-router"
import { colors, typography, spacing } from "../../lib/theme"
import { Button } from "../../components/Button"
import { OnboardingBack } from "../../components/OnboardingBack"
import { useOnboarding } from "../../components/OnboardingProvider"

const { width, height } = Dimensions.get("window")

export default function MemorialPreview() {
  const router = useRouter()
  const { data } = useOnboarding()

  const hasPhoto = !!(data.memorialPhoto && data.memorialPhoto.length > 0)

  const card = (
    <>
      <View style={styles.topBar}>
        <OnboardingBack />
        <TouchableOpacity onPress={() => router.push("/(onboarding)/memorial-input")}>
          <Text style={styles.secondaryLink}>Remember someone else</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        <View style={styles.floatingCard}>
          <Text style={styles.title}>
            {data.memorialName ? `Good Times, with ${data.memorialName}` : "Good Times"}
          </Text>
          <Text style={styles.body}>
            Each week, you'll get a prompt to share a memory, story, or thought about {data.memorialName}. We'll add everyone's share to your private group story for you all to easily look back on.
          </Text>
          <View style={styles.buttonContainer}>
            <Button
              title="→"
              onPress={() => router.push("/(onboarding)/about")}
              style={styles.button}
              textStyle={styles.buttonText}
            />
          </View>
        </View>
      </View>
    </>
  )

  if (hasPhoto) {
    return (
      <ImageBackground
        source={{ uri: data.memorialPhoto! }}
        style={styles.container}
        resizeMode="cover"
      >
        <View style={styles.overlay} />
        {card}
      </ImageBackground>
    )
  }

  return (
    <View style={[styles.container, styles.noPhoto]}>
      {card}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width,
    height,
  },
  noPhoto: {
    backgroundColor: colors.black,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  topBar: {
    position: "absolute",
    top: spacing.xxl,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  content: {
    flex: 1,
    justifyContent: "flex-end",
    padding: spacing.lg,
  },
  floatingCard: {
    gap: spacing.md,
    maxWidth: 420,
    padding: spacing.lg,
  },
  title: {
    ...typography.h1,
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  body: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 24,
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
  secondaryLink: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    color: colors.white,
    textDecorationLine: "underline",
  },
})
