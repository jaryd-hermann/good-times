"use client"

import { useEffect } from "react"
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Image, ScrollView } from "react-native"
import { useRouter } from "expo-router"
import { colors, typography, spacing } from "../../lib/theme"
import { OnboardingProgress } from "../../components/OnboardingProgress"
import AsyncStorage from "@react-native-async-storage/async-storage"
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
}

const { width, height } = Dimensions.get("window")
const PENDING_GROUP_KEY = "pending_group_join"

const STEPS = [
  "Every day, you all get one short question.",
  "Answer with text, photos, video, or audio.",
  "Enjoy what everyone said.",
]

export default function HowItWorks() {
  const router = useRouter()
  const posthog = usePostHog()

  useEffect(() => {
    try {
      if (posthog) {
        posthog.capture("loaded_how_it_works")
      } else {
        captureEvent("loaded_how_it_works")
      }
    } catch (error) {
      if (__DEV__) console.error("[how-it-works] Failed to track event:", error)
    }
  }, [posthog])

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
              source={require("../../assets/images/onboarding3-bg.png")}
              style={styles.image}
              resizeMode="cover"
            />
            {/* Texture overlay */}
            <View style={styles.imageTexture} pointerEvents="none">
              <Image
                source={require("../../assets/images/texture.png")}
                style={styles.textureImage}
                resizeMode="cover"
              />
            </View>
          </View>
        </View>

        {/* Bottom Section - Content */}
        <View style={styles.content}>
          {/* Text Content */}
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

          {/* Bottom Container */}
          <View style={styles.bottomContainer}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <FontAwesome name="angle-left" size={18} color={theme2Colors.text} />
            </TouchableOpacity>
            <OnboardingProgress total={3} current={3} />
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={handleContinue}
              activeOpacity={0.8}
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
    backgroundColor: theme2Colors.beige,
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
    paddingBottom: spacing.xs,
    justifyContent: "flex-start",
    alignItems: "center",
  },
  imageWrapper: {
    width: "100%",
    aspectRatio: 0.8,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: theme2Colors.beige,
    borderWidth: 2,
    borderColor: theme2Colors.text,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageTexture: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.3,
    zIndex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl * 4,
    backgroundColor: theme2Colors.beige,
  },
  textContainer: {
    marginBottom: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme2Colors.white,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontFamily: "PMGothicLudington-Text115",
    fontSize: 40,
    lineHeight: 48,
    color: theme2Colors.text,
    marginBottom: spacing.xl,
    marginTop: spacing.xl,
  },
  steps: {
    gap: spacing.xs,
  },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  stepNumber: {
    fontFamily: "Roboto-Bold",
    fontSize: 16,
    color: theme2Colors.text,
    minWidth: 30,
  },
  stepText: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    lineHeight: 24,
    color: theme2Colors.text,
    flex: 1,
  },
  bottomContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
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
})
