"use client"

import { useState, useEffect } from "react"
import { Alert, Dimensions, StyleSheet, Text, TouchableOpacity, View, Image, ScrollView } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { colors, typography, spacing } from "../../lib/theme"
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

export default function MemorialPreview() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const mode = params.mode as string | undefined
  const { data, clear, addMemorial, clearCurrentMemorial } = useOnboarding()
  const [creating, setCreating] = useState(false)
  const posthog = usePostHog()

  const hasPhoto = !!(data.memorialPhoto && data.memorialPhoto.length > 0)

  useEffect(() => {
    try {
      if (posthog) {
        posthog.capture("loaded_memorial_preview")
      } else {
        captureEvent("loaded_memorial_preview")
      }
    } catch (error) {
      if (__DEV__) console.error("[memorial-preview] Failed to track event:", error)
    }
  }, [posthog])

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

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          !hasPhoto && styles.scrollContentNoPhoto,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Section - Image */}
        {hasPhoto && (
          <View style={styles.imageContainer}>
            <View style={styles.imageWrapper}>
              <Image
                source={{ uri: data.memorialPhoto! }}
                style={styles.image}
                resizeMode="cover"
              />
            </View>
          </View>
        )}

        {/* Bottom Section - Content */}
        <View style={[styles.content, !hasPhoto && styles.contentNoPhoto]}>
          {/* Text Content */}
          <View style={styles.textContainer}>
            <Text style={styles.title}>
              {data.memorialName ? `Good Times, with ${data.memorialName}` : "Good Times"}
            </Text>
            <Text style={styles.body}>
              Each week, you'll all get a question about {data.memorialName}. We'll add your answers to your searchable history for you all to easily look back on.
            </Text>
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

          {/* Bottom Container */}
          <View style={styles.bottomContainer}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <FontAwesome name="angle-left" size={18} color={theme2Colors.white} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={handleContinue}
              activeOpacity={0.8}
              disabled={creating}
            >
              <Text style={styles.ctaButtonText}>→</Text>
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
  scrollContentNoPhoto: {
    justifyContent: "flex-end",
    minHeight: "100%",
    paddingBottom: 0,
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
  contentNoPhoto: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "flex-start",
    paddingBottom: spacing.xxl * 2,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    marginBottom: spacing.lg,
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
    width: "100%",
  },
  ctaButton: {
    width: 100,
    height: 60,
    backgroundColor: theme2Colors.onboardingPink,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: theme2Colors.blue,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ctaButtonText: {
    fontFamily: "Roboto-Bold",
    fontSize: 32,
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
  secondaryLink: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    color: theme2Colors.white,
    textDecorationLine: "underline",
  },
  secondaryLinkDisabled: {
    opacity: 0.5,
  },
})
