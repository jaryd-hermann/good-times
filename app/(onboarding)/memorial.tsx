"use client"

import { useState } from "react"
import { Alert, Dimensions, ImageBackground, StyleSheet, Text, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useLocalSearchParams, useRouter } from "expo-router"
import { colors, spacing, typography } from "../../lib/theme"
import { Button } from "../../components/Button"
import { OnboardingBack } from "../../components/OnboardingBack"
import { useOnboarding } from "../../components/OnboardingProvider"
import { createGroupFromOnboarding } from "../../lib/onboarding-actions"

const { width, height } = Dimensions.get("window")

export default function Memorial() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const mode = params.mode as string | undefined
  const { data, setMemorialName, setMemorialPhoto, clear } = useOnboarding()
  const [creating, setCreating] = useState(false)

  async function handleSkip() {
    if (mode === "add") {
      try {
        setCreating(true)
        setMemorialName("")
        setMemorialPhoto(undefined)
        const group = await createGroupFromOnboarding({
          ...data,
          memorialName: undefined,
          memorialPhoto: undefined,
        })
        clear()
        router.replace({
          pathname: "/(onboarding)/create-group/invite",
          params: { groupId: group.id, mode: "add" },
        })
      } catch (error: any) {
        Alert.alert("Error", error.message ?? "We couldn't create that group just yet.")
      } finally {
        setCreating(false)
      }
      return
    }

    router.push("/(onboarding)/about")
  }

  function handleRemember() {
    setMemorialName("")
    setMemorialPhoto(undefined)
    router.push({
      pathname: "/(onboarding)/memorial-input",
      params: mode ? { mode } : undefined,
    })
  }

  return (
    <ImageBackground
      source={require("../../assets/images/mom-bg.png")}
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
          <Text style={styles.title}>Remembering them...</Text>
          <Text style={styles.body}>
            My siblings and I lost our mom last year. Moments where we're together and share stories, memories, and
           photos of her are everything.
          </Text>
          <Text style={styles.body}>
            I hope you haven't, but if your group has lost someone, do you want to add this to your story book?
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <Button
            title="No"
            onPress={handleSkip}
            variant="secondary"
            style={styles.buttonNo}
            loading={creating}
            disabled={creating}
          />
          <Button
            title="Yes"
            onPress={handleRemember}
            style={styles.buttonYes}
            disabled={creating}
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
