"use client"

import { useEffect, useState } from "react"
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Modal, Animated, Image, ScrollView } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { colors, typography, spacing } from "../../lib/theme"
import { Button } from "../../components/Button"

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
              source={require("../../assets/images/welcome-home.png")}
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
          {/* Wordmark */}
          <Image 
            source={require("../../assets/images/wordmark.png")} 
            style={styles.wordmark}
            resizeMode="contain"
          />

          {/* Tagline */}
          <Text style={styles.subtitle}>
            Answer one question a day with your favorite people
          </Text>

          {/* Show me first link */}
          <TouchableOpacity
            style={styles.showMeFirstButton}
            onPress={() => setOnboardingGalleryVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.showMeFirstText}>show me first</Text>
          </TouchableOpacity>

          {/* CTA Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.loginButton}
              onPress={handleLogin}
              activeOpacity={0.8}
            >
              <Text style={styles.loginButtonText}>Login</Text>
              <View style={styles.buttonTexture} pointerEvents="none">
                <Image
                  source={require("../../assets/images/texture.png")}
                  style={styles.textureImage}
                  resizeMode="cover"
                />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.joinButton}
              onPress={handleMainCTA}
              activeOpacity={0.8}
            >
              <Text style={styles.joinButtonText}>Join</Text>
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
                    <TouchableOpacity
                      style={styles.modalButtonPrimary}
                      onPress={handleCreateGroup}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.modalButtonTextPrimary}>Create Group</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.modalButtonSecondary}
                      onPress={handleJoinGroup}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.modalButtonTextSecondary}>Join Group</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.modalTitle}>
                    To join a group, follow the invite link shared with you. If you don't have one, ask anyone in your group
                  </Text>
                  <TouchableOpacity
                    style={styles.modalButtonPrimary}
                    onPress={handleGotIt}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalButtonTextPrimary}>Got it</Text>
                  </TouchableOpacity>
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
          { id: "3", source: require("../../assets/images/onboarding-video.png") },
          { id: "4", source: require("../../assets/images/onboarding-3-their-answer.png") },
          { id: "5", source: require("../../assets/images/onboarding-4-your-group.png") },
          { id: "6", source: require("../../assets/images/onboarding-5-ask-them.png") },
          { id: "7", source: require("../../assets/images/onboarding-6-themed-decks.png") },
          { id: "8", source: require("../../assets/images/onboarding-7-set-your-vibe.png") },
        ]}
        onComplete={() => setOnboardingGalleryVisible(false)}
        returnRoute="/(onboarding)/welcome-1"
      />
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
  textureImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl * 4,
    backgroundColor: theme2Colors.beige,
  },
  wordmark: {
    width: 280,
    height: 92,
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
    marginLeft: -spacing.sm,
    alignSelf: "flex-start",
    // Remove any shadow or outline effects
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  subtitle: {
    fontFamily: "PMGothicLudington-Text115",
    fontSize: 22,
    lineHeight: 30,
    color: theme2Colors.text,
    marginBottom: spacing.md,
  },
  showMeFirstButton: {
    alignSelf: "flex-start",
    marginBottom: spacing.lg,
  },
  showMeFirstText: {
    fontFamily: "Roboto-Regular",
    fontSize: 14,
    color: theme2Colors.text,
    textDecorationLine: "underline",
  },
  buttonContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  loginButton: {
    flex: 1,
    backgroundColor: theme2Colors.white,
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
  loginButtonText: {
    fontFamily: "Roboto-Bold",
    fontSize: 18,
    color: theme2Colors.text,
    zIndex: 2,
  },
  joinButton: {
    flex: 1,
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
  buttonTexture: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.3,
    zIndex: 1,
  },
  joinButtonText: {
    fontFamily: "Roboto-Bold",
    fontSize: 18,
    color: theme2Colors.white,
    zIndex: 2,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: theme2Colors.beige,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    width: "100%",
  },
  modalTitle: {
    fontFamily: "PMGothicLudington-Text115",
    fontSize: 24,
    lineHeight: 32,
    color: theme2Colors.text,
    marginBottom: spacing.xl,
    textAlign: "center",
  },
  modalButtons: {
    gap: spacing.md,
  },
  modalButtonPrimary: {
    width: "100%",
    backgroundColor: theme2Colors.onboardingPink,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: theme2Colors.blue,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
  },
  modalButtonTextPrimary: {
    fontFamily: "Roboto-Bold",
    fontSize: 18,
    color: theme2Colors.white,
  },
  modalButtonSecondary: {
    width: "100%",
    backgroundColor: theme2Colors.white,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: theme2Colors.text,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
  },
  modalButtonTextSecondary: {
    fontFamily: "Roboto-Bold",
    fontSize: 18,
    color: theme2Colors.text,
  },
})
