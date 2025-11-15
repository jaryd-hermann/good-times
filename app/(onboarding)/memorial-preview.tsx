"use client"

import { useState } from "react"
import { Alert, Dimensions, ImageBackground, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { colors, typography, spacing } from "../../lib/theme"
import { Button } from "../../components/Button"
import { OnboardingBack } from "../../components/OnboardingBack"
import { useOnboarding } from "../../components/OnboardingProvider"
import { createGroupFromOnboarding } from "../../lib/onboarding-actions"

const { width, height } = Dimensions.get("window")

export default function MemorialPreview() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const mode = params.mode as string | undefined
  const { data, clear, addMemorial, clearCurrentMemorial } = useOnboarding()
  const [creating, setCreating] = useState(false)

  const hasPhoto = !!(data.memorialPhoto && data.memorialPhoto.length > 0)

  async function handleContinue() {
    // Save current memorial before continuing (if not already saved)
    if (data.memorialName && data.memorialName.trim()) {
      const isAlreadySaved = data.memorials?.some(
        (m) => m.name === data.memorialName && m.photo === data.memorialPhoto
      )
      if (!isAlreadySaved) {
        addMemorial({
          name: data.memorialName,
          photo: data.memorialPhoto,
        })
      }
    }

    if (mode === "add") {
      try {
        setCreating(true)
        const group = await createGroupFromOnboarding(data)
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

  const card = (
    <>
      <View style={styles.topBar}>
        <OnboardingBack />
        <TouchableOpacity
          disabled={creating}
          onPress={() => {
            // Save current memorial to the list before adding another
            if (data.memorialName && data.memorialName.trim()) {
              addMemorial({
                name: data.memorialName,
                photo: data.memorialPhoto,
              })
            } else {
              clearCurrentMemorial()
            }
            router.push({
              pathname: "/(onboarding)/memorial-input",
              params: mode ? { mode } : undefined,
            })
          }}
        >
          <Text style={[styles.secondaryLink, creating && styles.secondaryLinkDisabled]}>Remember someone else</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        <View style={styles.floatingCard}>
          <Text style={styles.title}>
            {data.memorialName ? `Good Times, with ${data.memorialName}` : "Good Times"}
          </Text>
          <Text style={styles.body}>
            Each week, you'll get a question to share a memory, story, or thought about {data.memorialName}. We'll add everyone's share to your group's history for you all to easily look back on.
          </Text>
          <View style={styles.buttonContainer}>
            <Button
              title="→"
              onPress={handleContinue}
              style={styles.button}
              textStyle={styles.buttonText}
              loading={creating}
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
  secondaryLinkDisabled: {
    opacity: 0.5,
  },
})
