"use client"

import { useEffect, useState, useRef } from "react"
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Modal, Animated, Image, ScrollView } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { colors, typography, spacing } from "../../lib/theme"
import { Button } from "../../components/Button"
import { WebView } from "react-native-webview"
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
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const slideAnim = useState(new Animated.Value(height))[0]
  const overlayOpacity = useState(new Animated.Value(0))[0]

  // Video URL - hosted on Supabase storage (H.264 encoded)
  const VIDEO_URL = "https://ytnnsykbgohiscfgomfe.supabase.co/storage/v1/object/public/onboarding-videos/intro.mp4"

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
    // If video is playing, pause it and return to photo view
    if (isVideoPlaying) {
      setIsVideoPlaying(false)
      // Send pause message to WebView if it's still mounted
      // Small delay to ensure state update happens
      await new Promise(resolve => setTimeout(resolve, 100))
    }
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
    // If video is playing, pause it and return to photo view
    if (isVideoPlaying) {
      setIsVideoPlaying(false)
    }
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

  const handlePlayVideo = () => {
    console.log("[welcome-1] Play button pressed")
    setIsVideoPlaying(true)
  }

  const handlePauseVideo = () => {
    console.log("[welcome-1] Pause button pressed")
    setIsVideoPlaying(false)
  }

  // Ref to store WebView reference for sending messages
  const webViewRef = useRef<any>(null)

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

  // Pause video when isVideoPlaying becomes false
  useEffect(() => {
    if (!isVideoPlaying && webViewRef.current) {
      // Inject JavaScript to pause video before unmounting
      try {
        webViewRef.current.injectJavaScript(`
          (function() {
            const video = document.getElementById('videoPlayer');
            if (video && !video.paused) {
              video.pause();
            }
          })();
          true; // Required for injectJavaScript
        `)
      } catch (error) {
        // WebView might be unmounting, ignore error
        if (__DEV__) {
          console.log("[welcome-1] Could not inject pause script to WebView:", error)
        }
      }
    }
  }, [isVideoPlaying])

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
        scrollEnabled={false}
      >
        {/* Top Section - Image/Video */}
        <View style={styles.imageContainer}>
          <View style={styles.imageWrapper}>
            {/* Image - shown when video is not playing */}
            {!isVideoPlaying && (
              <>
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
                {/* Play Button Overlay - Temporarily hidden */}
                {false && (
                  <TouchableOpacity
                    style={styles.playButton}
                    onPress={handlePlayVideo}
                    activeOpacity={0.8}
                  >
                    <FontAwesome name="play" size={24} color={theme2Colors.text} />
                  </TouchableOpacity>
                )}
              </>
            )}
            {/* Video - use WebView as workaround for CORS issues on iOS */}
            {isVideoPlaying && (
              <>
                <WebView
                  ref={(ref) => {
                    if (ref) {
                      webViewRef.current = ref
                    }
                  }}
                  source={{
                    html: `
                      <!DOCTYPE html>
                      <html>
                        <head>
                          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                          <style>
                            * { margin: 0; padding: 0; box-sizing: border-box; }
                            body, html { 
                              width: 100%; 
                              height: 100%; 
                              overflow: hidden; 
                              background: #000; 
                              display: flex;
                              align-items: center;
                              justify-content: center;
                              position: relative;
                            }
                            video {
                              width: 100%;
                              height: 100%;
                              object-fit: cover;
                              outline: none;
                            }
                            .controls {
                              position: absolute;
                              bottom: 16px;
                              right: 16px;
                              z-index: 100;
                              display: flex;
                              gap: 8px;
                            }
                            .control-button {
                              width: 60px;
                              height: 60px;
                              border-radius: 30px;
                              background-color: #FFFFFF;
                              border: 2px solid #000000;
                              display: flex;
                              align-items: center;
                              justify-content: center;
                              cursor: pointer;
                              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                            }
                            .control-button:active {
                              opacity: 0.8;
                            }
                            .play-icon, .pause-icon {
                              width: 24px;
                              height: 24px;
                              fill: #000000;
                            }
                          </style>
                        </head>
                        <body>
                          <video 
                            id="videoPlayer"
                            autoplay 
                            playsinline
                            muted
                            preload="auto"
                          >
                            <source src="${VIDEO_URL}" type="video/mp4">
                            Your browser does not support the video tag.
                          </video>
                          <div class="controls">
                            <div class="control-button" id="playPauseButton">
                              <svg class="pause-icon" id="pauseIcon" viewBox="0 0 24 24" style="display: none;">
                                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                              </svg>
                              <svg class="play-icon" id="playIcon" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z"/>
                              </svg>
                            </div>
                          </div>
                          <script>
                            (function() {
                              const video = document.getElementById('videoPlayer');
                              const playPauseButton = document.getElementById('playPauseButton');
                              const playIcon = document.getElementById('playIcon');
                              const pauseIcon = document.getElementById('pauseIcon');
                              
                              if (video && playPauseButton) {
                                // Update button icon based on video state
                                function updateButton() {
                                  if (video.paused) {
                                    playIcon.style.display = 'block';
                                    pauseIcon.style.display = 'none';
                                  } else {
                                    playIcon.style.display = 'none';
                                    pauseIcon.style.display = 'block';
                                  }
                                }
                                
                                // Handle play/pause button click
                                playPauseButton.addEventListener('click', function() {
                                  if (video.paused) {
                                    video.play().catch(function(error) {
                                      console.log('Play failed:', error);
                                    });
                                  } else {
                                    video.pause();
                                    // When paused, return to photo view
                                    if (window.ReactNativeWebView) {
                                      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'videoPaused' }));
                                    }
                                  }
                                  updateButton();
                                });
                                
                                // Update button when video state changes
                                video.addEventListener('play', updateButton);
                                video.addEventListener('pause', updateButton);
                                
                                // Unmute and play when video can play
                                video.addEventListener('canplay', function() {
                                  video.muted = false;
                                  video.play().catch(function(error) {
                                    console.log('Autoplay prevented:', error);
                                    updateButton();
                                  });
                                  updateButton();
                                });
                                
                                // Handle video end - return to photo view
                                video.addEventListener('ended', function() {
                                  if (window.ReactNativeWebView) {
                                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'videoEnded' }));
                                  }
                                });
                                
                                
                                // Try to play immediately
                                video.play().catch(function(error) {
                                  console.log('Initial play failed:', error);
                                  updateButton();
                                });
                                
                                // Initial button state
                                updateButton();
                              }
                            })();
                          </script>
                        </body>
                      </html>
                    `
                  }}
                  style={styles.video}
                  allowsFullscreen={false}
                  mediaPlaybackRequiresUserAction={false}
                  allowsInlineMediaPlayback={true}
                  onError={(syntheticEvent) => {
                    const { nativeEvent } = syntheticEvent
                    console.error("[welcome-1] WebView error:", nativeEvent)
                    setIsVideoPlaying(false)
                  }}
                  onLoad={() => {
                    console.log("[welcome-1] WebView video loaded")
                  }}
                  onMessage={(event) => {
                    // Handle messages from WebView
                    try {
                      const message = JSON.parse(event.nativeEvent.data)
                      if (message.type === 'videoEnded' || message.type === 'videoPaused') {
                        setIsVideoPlaying(false)
                      }
                    } catch (error) {
                      console.log("[welcome-1] WebView message:", event.nativeEvent.data)
                    }
                  }}
                />
              </>
            )}
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
            Answer one question a day with friends
          </Text>

          {/* Sub-tagline */}
          <Text style={styles.subTagline}>
            No Ads. No AI. No Strangers.
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
          { id: "7", source: require("../../assets/images/onboarding-status.png") },
          { id: "8", source: require("../../assets/images/onboarding-journal.png") },
          { id: "9", source: require("../../assets/images/onboarding-7-set-your-vibe.png") },
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
  video: {
    width: "100%",
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  playButton: {
    position: "absolute",
    bottom: spacing.md,
    right: spacing.md,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme2Colors.white,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 2,
    borderWidth: 2,
    borderColor: theme2Colors.text,
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
    marginBottom: spacing.sm,
  },
  subTagline: {
    fontFamily: "PMGothicLudington-Text115",
    fontSize: 18,
    lineHeight: 26,
    color: "#808080", // Lighter gray
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
