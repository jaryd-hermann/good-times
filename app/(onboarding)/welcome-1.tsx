"use client"

import { useEffect, useState } from "react"
import { View, Text, StyleSheet, ImageBackground, Dimensions, TouchableOpacity, Modal, Animated } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { colors, typography, spacing } from "../../lib/theme"
import { Button } from "../../components/Button"
import { OnboardingGallery } from "../../components/OnboardingGallery"
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
  const insets = useSafeAreaInsets()
  const [showModal, setShowModal] = useState(false)
  const [showJoinInfo, setShowJoinInfo] = useState(false)
  const [onboardingGalleryVisible, setOnboardingGalleryVisible] = useState(false)
  const slideAnim = useState(new Animated.Value(height))[0]
  const overlayOpacity = useState(new Animated.Value(0))[0]

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

  function handleMainCTA() {
    setShowJoinInfo(false)
    // Reset animations to initial state before showing modal
    slideAnim.setValue(height)
    overlayOpacity.setValue(0)
    // Set modal visible first, then animate
    setShowModal(true)
    // Use requestAnimationFrame to ensure modal is rendered before animating
    requestAnimationFrame(() => {
      // Animate overlay and content together
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
      ]).start()
    })
  }

  function handleCreateGroup() {
    closeModal()
    router.push("/(onboarding)/welcome-2")
  }

  function handleJoinGroup() {
    setShowJoinInfo(true)
  }

  function handleGotIt() {
    closeModal()
  }

  function closeModal() {
    // Animate overlay and content together, then hide modal
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Only hide modal after animation completes to prevent flash
      // Use a small delay to ensure animation is fully complete
      setTimeout(() => {
        setShowModal(false)
        setShowJoinInfo(false)
        // Reset to initial state for next open
        slideAnim.setValue(height)
        overlayOpacity.setValue(0)
      }, 50)
    })
  }

  // Reset animations when modal closes
  useEffect(() => {
    if (!showModal) {
      // Reset to initial state when modal is hidden
      slideAnim.setValue(height)
      overlayOpacity.setValue(0)
    }
  }, [showModal])

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
          {/* Already in a group? Login - above title */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginPrefix}>Already in a group? </Text>
            <TouchableOpacity onPress={handleLogin} activeOpacity={0.8}>
              <Text style={styles.loginText}>Login</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.title}>Good Times</Text>
          <Text style={styles.subtitle}>
          Answer just one question a day with your favorite people
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          {/* Show me first button - bottom left */}
          <TouchableOpacity
            style={styles.showMeFirstButton}
            onPress={() => setOnboardingGalleryVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.showMeFirstText}>Show me first</Text>
          </TouchableOpacity>
          <Button
            title="→"
            onPress={handleMainCTA}
            style={styles.button}
            textStyle={styles.buttonText}
          />
        </View>
      </View>

      <Modal
        visible={showModal}
        transparent={true}
        animationType="none"
        onRequestClose={closeModal}
      >
        <View style={styles.modalContainer}>
          <Animated.View
            style={[
              styles.modalOverlay,
              {
                opacity: overlayOpacity,
              },
            ]}
          >
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={closeModal}
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.modalContent,
              {
                transform: [{ translateY: slideAnim }],
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
              {!showJoinInfo ? (
                <>
                  <Text style={styles.modalTitle}>
                    Are you creating a new group, or joining an existing one?
                  </Text>
                  <View style={styles.modalButtons}>
                    <Button
                      title="Create Group"
                      onPress={handleCreateGroup}
                      style={styles.modalButton}
                      textStyle={styles.modalButtonText}
                    />
                    <Button
                      title="Join Group"
                      onPress={handleJoinGroup}
                      variant="secondary"
                      style={styles.modalButton}
                      textStyle={styles.modalButtonText}
                    />
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.modalTitle}>
                    To join a group, follow the invite link shared with you. If you don't have one, ask anyone in your group
                  </Text>
                  <Button
                    title="Got it"
                    onPress={handleGotIt}
                    style={styles.modalButton}
                    textStyle={styles.modalButtonText}
                  />
                </>
              )}
          </Animated.View>
        </View>
      </Modal>

      {/* Onboarding Gallery Modal */}
      <OnboardingGallery
        visible={onboardingGalleryVisible}
        screenshots={[
          { id: "1", source: require("../../assets/images/onboarding-1-one-question.png") },
          { id: "2", source: require("../../assets/images/onboarding-2-your-answer.png") },
          { id: "3", source: require("../../assets/images/onboarding-3-their-answer.png") },
          { id: "4", source: require("../../assets/images/onboarding-4-your-group.png") },
          { id: "5", source: require("../../assets/images/onboarding-5-ask-them.png") },
          { id: "6", source: require("../../assets/images/onboarding-6-themed-decks.png") },
          { id: "7", source: require("../../assets/images/onboarding-7-set-your-vibe.png") },
          { id: "8", source: require("../../assets/images/onboarding-8-remember.png") },
        ]}
        onComplete={() => setOnboardingGalleryVisible(false)}
        returnRoute="/(onboarding)/welcome-1"
      />
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
    marginBottom: spacing.lg,
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
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
  },
  modalContent: {
    backgroundColor: colors.black,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    width: "100%",
  },
  modalTitle: {
    ...typography.body,
    fontSize: 18,
    lineHeight: 26,
    color: colors.white,
    marginBottom: spacing.xl,
    textAlign: "center",
  },
  modalButtons: {
    gap: spacing.md,
  },
  modalButton: {
    width: "100%",
  },
  modalButtonText: {
    fontSize: 16,
  },
  showMeFirstButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.white,
  },
  showMeFirstText: {
    ...typography.body,
    fontSize: 14,
    color: colors.white,
  },
})
