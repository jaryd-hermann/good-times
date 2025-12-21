"use client"

import { useState, useEffect } from "react"
import { Alert, Dimensions, StyleSheet, Text, View, TouchableOpacity, Image, ScrollView } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { colors, spacing, typography } from "../../lib/theme"
import { useOnboarding } from "../../components/OnboardingProvider"
import { createGroupFromOnboarding } from "../../lib/onboarding-actions"
import { usePostHog } from "posthog-react-native"
import { captureEvent } from "../../lib/posthog"
import { FontAwesome } from "@expo/vector-icons"

// Theme 2 color palette matching new design system
const theme2Colors = {
  red: "#B94444",
  yellow: "#E8A037",
  green: "#2D6F4A",
  blue: "#3A5F8C",
  beige: "#E8E0D5",
  cream: "#F5F0EA",
  white: "#FFFFFF",
  text: "#000000",
  textSecondary: "#404040",
  onboardingPink: "#D97393", // Pink for onboarding CTAs
  darkBackground: "#1A1A1C", // Dark background for memorial screen
}

const { width, height } = Dimensions.get("window")

export default function Memorial() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const mode = params.mode as string | undefined
  const { data, setMemorialName, setMemorialPhoto, clear } = useOnboarding()
  const [creating, setCreating] = useState(false)
  const posthog = usePostHog()

  useEffect(() => {
    try {
      if (posthog) {
        posthog.capture("loaded_memorial")
      } else {
        captureEvent("loaded_memorial")
      }
    } catch (error) {
      if (__DEV__) console.error("[memorial] Failed to track event:", error)
    }
  }, [posthog])

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
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Section - Image */}
        <View style={styles.imageContainer}>
          <View style={styles.imageWrapper}>
            <Image
              source={require("../../assets/images/mom-bg.png")}
              style={styles.image}
              resizeMode="cover"
            />
          </View>
        </View>

        {/* Bottom Section - Content */}
        <View style={styles.content}>
          {/* Text Content */}
          <View style={styles.textContainer}>
            <Text style={styles.title}>Remembering them...</Text>
            <Text style={styles.body}>
              We lost our mom last year. Sharing memories of her are everything to me, so I've created a space for that here.
            </Text>
            <Text style={styles.body}>
              If your group has lost someone, we can send you specific questions occassionally. Would you like to add them here?
            </Text>
          </View>

          {/* Bottom Container */}
          <View style={styles.bottomContainer}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <FontAwesome name="angle-left" size={18} color={theme2Colors.white} />
            </TouchableOpacity>
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.buttonNo}
                onPress={handleSkip}
                activeOpacity={0.8}
                disabled={creating}
              >
                <Text style={styles.buttonNoText}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.buttonYes}
                onPress={handleRemember}
                activeOpacity={0.8}
                disabled={creating}
              >
                <Text style={styles.buttonYesText}>Yes</Text>
                <View style={styles.buttonTexture} pointerEvents="none">
                  <Image
                    source={require("../../assets/images/texture.png")}
                    style={styles.textureImage}
                    resizeMode="cover"
                  />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme2Colors.darkBackground,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  imageContainer: {
    padding: spacing.lg,
    paddingTop: spacing.xxl * 2,
    paddingBottom: spacing.lg,
    justifyContent: "flex-start",
    alignItems: "center",
  },
  imageWrapper: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: theme2Colors.darkBackground,
    borderWidth: 2,
    borderColor: theme2Colors.white,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl * 4,
    backgroundColor: theme2Colors.darkBackground,
  },
  textContainer: {
    marginBottom: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontFamily: "PMGothicLudington-Text115",
    fontSize: 40,
    lineHeight: 48,
    color: theme2Colors.white,
    marginBottom: spacing.lg,
  },
  body: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    lineHeight: 24,
    color: theme2Colors.white,
    marginBottom: spacing.md,
  },
  bottomContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: spacing.md,
    flex: 1,
    justifyContent: "flex-end",
  },
  buttonNo: {
    flex: 0.45,
    backgroundColor: theme2Colors.white,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: theme2Colors.blue,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
  },
  buttonNoText: {
    fontFamily: "Roboto-Bold",
    fontSize: 18,
    color: theme2Colors.text,
  },
  buttonYes: {
    flex: 0.45,
    backgroundColor: theme2Colors.onboardingPink,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: theme2Colors.blue,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
    overflow: "hidden",
  },
  buttonYesText: {
    fontFamily: "Roboto-Bold",
    fontSize: 18,
    color: theme2Colors.white,
    zIndex: 2,
  },
  buttonTexture: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.3,
    zIndex: 1,
  },
  textureImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
})
