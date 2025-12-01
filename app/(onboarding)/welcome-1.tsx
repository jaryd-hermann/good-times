"use client"

import { useEffect } from "react"
import { View, Text, StyleSheet, ImageBackground, Dimensions, TouchableOpacity } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useRouter } from "expo-router"
import { colors, typography, spacing } from "../../lib/theme"
import { Button } from "../../components/Button"
import { 
  isBiometricAvailable, 
  getBiometricPreference, 
  getBiometricRefreshToken, 
  getBiometricUserId,
  authenticateWithBiometric,
  clearBiometricCredentials,
} from "../../lib/biometric"
import { supabase } from "../../lib/supabase"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useOnboarding } from "../../components/OnboardingProvider"
import { usePostHog } from "posthog-react-native"
import { captureEvent } from "../../lib/posthog"

const { width, height } = Dimensions.get("window")

export default function Welcome1() {
  const router = useRouter()
  const { clear } = useOnboarding()
  const posthog = usePostHog()

  // Track onboarding_started event
  useEffect(() => {
    async function trackOnboardingStart() {
      try {
        // Check if user came from invite link
        const pendingGroupId = await AsyncStorage.getItem("pending_group_join")
        const source = pendingGroupId ? "invite_page" : "default_landing"
        
        if (posthog) {
          posthog.capture("onboarding_started", { source })
        } else {
          // Fallback to captureEvent if hook not available
          captureEvent("onboarding_started", { source })
        }
      } catch (error) {
        // Never let PostHog errors affect app behavior
        if (__DEV__) {
          console.error("[welcome-1] Failed to track onboarding_started:", error)
        }
      }
    }
    trackOnboardingStart()
  }, [posthog])

  async function handleLogin() {
    // Clear any onboarding data to ensure sign-in mode (not sign-up)
    // This ensures users always see the Sign In screen, not Create Account
    // Clear both AsyncStorage and in-memory context state
    clear() // This clears both AsyncStorage and context state
    // Also clear any pending group join to ensure clean sign-in flow
    await AsyncStorage.removeItem("pending_group_join")
    // Small delay to ensure state is cleared before navigation
    await new Promise(resolve => setTimeout(resolve, 100))
    router.push("/(onboarding)/auth")
  }

  // Phase 4: FaceID should trigger at login screens (welcome-1 is a login screen)
  // Phase 7: Enhanced navigation with success check
  useEffect(() => {
    async function attemptBiometricLogin() {
      try {
        // Check if biometric is available and enabled
        const biometricAvailable = await isBiometricAvailable()
        if (!biometricAvailable) return

        const biometricEnabled = await getBiometricPreference()
        if (!biometricEnabled) return

        // Check if we have stored credentials
        const refreshToken = await getBiometricRefreshToken()
        const userId = await getBiometricUserId()
        if (!refreshToken || !userId) return

        // Attempt biometric authentication
        const authResult = await authenticateWithBiometric("Authenticate to log in")
        if (!authResult.success) return

        // Use refresh token to get new session
        const { data, error } = await supabase.auth.refreshSession({
          refresh_token: refreshToken,
        })

        if (error || !data.session) {
          console.warn("[welcome-1] Failed to refresh session with biometric:", error)
          // Clear invalid credentials
          await clearBiometricCredentials()
          return
        }

        // Phase 7: Enhanced navigation with success check
        const navigateToHome = async () => {
          try {
            router.replace("/(main)/home")
            
            // Check if navigation succeeded after a short delay
            await new Promise(resolve => setTimeout(resolve, 1000))
            
            // Fallback: try again if navigation failed
            setTimeout(() => {
              router.replace("/(main)/home")
            }, 2000)
          } catch (error) {
            console.error("[welcome-1] Navigation error:", error)
            // Fallback: try again
            router.replace("/(main)/home")
          }
        }

        // Successfully authenticated - navigate to home
        await navigateToHome()
      } catch (error) {
        // Silently fail - user can still log in manually
        console.warn("[welcome-1] Biometric login error:", error)
      }
    }

    // Attempt biometric login after a short delay to allow screen to render
    const timeout = setTimeout(() => {
      attemptBiometricLogin()
    }, 500)

    return () => clearTimeout(timeout)
  }, [router])

  return (
    <ImageBackground source={require("../../assets/images/welcome-home.png")} style={styles.container} resizeMode="cover">
      <LinearGradient
        colors={["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0.3)", "rgba(0, 0, 0, 0.8)", "rgba(0, 0, 0, 1)"]}
        locations={[0, 0.4, 0.7, 1]}
        style={styles.gradientOverlay}
      />
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Good Times</Text>
          <Text style={styles.subtitle}>
          The group-based, low-effort, social app for friends & family to meaningfully hear from each other everyday in just 3 minutes.
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <View style={styles.loginContainer}>
            <Text style={styles.loginPrefix}>Already in a group? </Text>
            <TouchableOpacity onPress={handleLogin} activeOpacity={0.8}>
              <Text style={styles.loginText}>Login</Text>
            </TouchableOpacity>
          </View>
          <Button
            title="→"
            onPress={() => router.push("/(onboarding)/welcome-2")}
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
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    padding: spacing.lg,
    paddingTop: spacing.xxl * 3,
    paddingBottom: spacing.xxl * 2,
  },
  loginContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  loginPrefix: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    color: colors.white,
  },
  loginText: {
    fontFamily: "Roboto-Bold",
    fontSize: 16,
    color: colors.white,
    textDecorationLine: "underline",
  },
  textContainer: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: spacing.xxl,
  },
  title: {
    fontFamily: "LibreBaskerville-Bold",
    fontSize: 48,
    lineHeight: 56,
    color: colors.white,
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.body,
    fontSize: 18,
    lineHeight: 28,
    color: colors.white,
  },
  buttonContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  button: {
    width: 100,
    height: 60,
  },
  buttonText: {
    fontSize: 32,
  },
})
