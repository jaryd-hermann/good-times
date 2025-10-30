"use client"

import { View, Text, StyleSheet, ImageBackground, Dimensions } from "react-native"
import { useRouter } from "expo-router"
import { colors, typography, spacing } from "../../lib/theme"
import { Button } from "../../components/Button"

const { width, height } = Dimensions.get("window")

export default function Memorial() {
  const router = useRouter()

  return (
    <ImageBackground
      source={require("../../assets/images/memorial-bg.png")}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Remembering them...</Text>
          <Text style={styles.body}>
            My 4 siblings and I lost our mom last year. Moments where we're together and share stories, memories, and
            old photos of her are everything to me.
          </Text>
          <Text style={styles.body}>
            I hope you haven't, but if your group has lost someone, do you want to add this to your story book?
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <Button
            title="No"
            onPress={() => router.push("/(onboarding)/create-group/name-type")}
            variant="secondary"
            style={styles.buttonNo}
          />
          <Button title="Yes" onPress={() => router.push("/(onboarding)/memorial-preview")} style={styles.buttonYes} />
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
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  buttonNo: {
    flex: 1,
  },
  buttonYes: {
    flex: 1,
  },
})
