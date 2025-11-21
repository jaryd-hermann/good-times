"use client"

import { useEffect } from "react"
import { View, Text, StyleSheet, ImageBackground, Dimensions } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useRouter } from "expo-router"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { colors, typography, spacing } from "../../lib/theme"
import { Button } from "../../components/Button"
import { supabase } from "../../lib/supabase"

const { width, height } = Dimensions.get("window")
const POST_AUTH_ONBOARDING_KEY_PREFIX = "has_completed_post_auth_onboarding"

// Helper function to get user-specific onboarding key
function getPostAuthOnboardingKey(userId: string): string {
  return `${POST_AUTH_ONBOARDING_KEY_PREFIX}_${userId}`
}

export default function WelcomePostAuth() {
  const router = useRouter()

  useEffect(() => {
    // Check if user has already completed post-auth onboarding
    // If yes, skip directly to home
    async function checkOnboardingStatus() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const onboardingKey = getPostAuthOnboardingKey(user.id)
      const hasCompletedPostAuth = await AsyncStorage.getItem(onboardingKey)
      
      if (hasCompletedPostAuth) {
        // Already completed - skip to home
        router.replace("/(main)/home")
      }
    }
    checkOnboardingStatus()
  }, [router])

  function handleContinue() {
    router.replace("/(onboarding)/notifications-onboarding")
  }

  return (
    <ImageBackground
      source={require("../../assets/images/friends.png")}
      style={styles.container}
      resizeMode="cover"
    >
      <LinearGradient
        colors={["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0.4)", "rgba(0, 0, 0, 0.8)", "rgba(0, 0, 0, 1)"]}
        locations={[0, 0.4, 0.7, 1]}
        style={styles.gradientOverlay}
      />
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Welcome</Text>
          <Text style={styles.body}>
            Thanks for downloading my app! I made it myself, so if you see any problems or have any ideas...find me in
            "Settings". Email, text, or WhatsApp, I'd love to hear your feedback.
          </Text>
        </View>

        <View style={styles.bottomContainer}>
          <View style={styles.buttonContainer}>
            <Button
              title="→"
              onPress={handleContinue}
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
  textContainer: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: spacing.xxl,
  },
  bottomContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
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

