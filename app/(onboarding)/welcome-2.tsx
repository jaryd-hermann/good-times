"use client"

import { useEffect, useState, useRef } from "react"
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Image, ScrollView } from "react-native"
import { useRouter } from "expo-router"
import { WebView } from "react-native-webview"
import { colors, typography, spacing } from "../../lib/theme"
import { OnboardingProgress } from "../../components/OnboardingProgress"
import { usePostHog } from "posthog-react-native"
import { captureEvent } from "../../lib/posthog"
import { FontAwesome } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"

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

export default function Welcome2() {
  const router = useRouter()
  const posthog = usePostHog()
  const insets = useSafeAreaInsets()
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)

  // Video URL - hosted on Supabase storage (H.264 encoded)
  const VIDEO_URL = "https://ytnnsykbgohiscfgomfe.supabase.co/storage/v1/object/public/onboarding-videos/why2.mp4"

  useEffect(() => {
    try {
      if (posthog) {
        posthog.capture("loaded_jaryd_intro_1")
      } else {
        captureEvent("loaded_jaryd_intro_1")
      }
    } catch (error) {
      if (__DEV__) console.error("[welcome-2] Failed to track event:", error)
    }
  }, [posthog])

  const handlePlayVideo = () => {
    console.log("[welcome-2] Play button pressed")
    setIsVideoPlaying(true)
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Section - Image/Video */}
        <View style={styles.imageContainer}>
          <View style={styles.imageWrapper}>
            {/* Image - shown when video is not playing */}
            {!isVideoPlaying && (
              <>
            <Image
              source={require("../../assets/images/welcome4-bg.png")}
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
                {/* Play Button Overlay */}
                <TouchableOpacity
                  style={styles.playButton}
                  onPress={handlePlayVideo}
                  activeOpacity={0.8}
                >
                  <FontAwesome name="play" size={24} color={theme2Colors.text} />
                </TouchableOpacity>
              </>
            )}
            {/* Video - use WebView as workaround for CORS issues on iOS */}
            {isVideoPlaying && (
              <WebView
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
                          }
                          video {
                            width: 100%;
                            height: 100%;
                            object-fit: cover;
                            outline: none;
                          }
                        </style>
                      </head>
                      <body>
                        <video 
                          id="videoPlayer"
                          controls 
                          autoplay 
                          playsinline
                          muted
                          preload="auto"
                        >
                          <source src="${VIDEO_URL}" type="video/mp4">
                          Your browser does not support the video tag.
                        </video>
                        <script>
                          (function() {
                            const video = document.getElementById('videoPlayer');
                            if (video) {
                              // Unmute and play when video can play
                              video.addEventListener('canplay', function() {
                                video.muted = false;
                                video.play().catch(function(error) {
                                  console.log('Autoplay prevented:', error);
                                  // If autoplay fails, user can click play button
                                });
                              });
                              
                              // Handle video end
                              video.addEventListener('ended', function() {
                                // Video ended - could send message to React Native if needed
                              });
                              
                              // Try to play immediately
                              video.play().catch(function(error) {
                                console.log('Initial play failed:', error);
                              });
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
                  console.error("[welcome-2] WebView error:", nativeEvent)
                  setIsVideoPlaying(false)
                }}
                onLoad={() => {
                  console.log("[welcome-2] WebView video loaded")
                }}
                onMessage={(event) => {
                  // Handle messages from WebView if needed
                  console.log("[welcome-2] WebView message:", event.nativeEvent.data)
                }}
              />
            )}
          </View>
        </View>

        {/* Bottom Section - Content */}
        <View style={styles.content}>
          {/* Text Content */}
          <View style={styles.textContainer}>
            <Text style={styles.title}>I'm Jaryd</Text>
            <Text style={styles.body}>
              I made Good Times to feel genuinely closer to my favorite people. Most of them live far away.
            </Text>
            <Text style={styles.body}>
              <Text style={styles.boldText}>Keeping in touch isn't always easy...</Text>
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Navigation Bar */}
      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom }]}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <FontAwesome name="angle-left" size={18} color={theme2Colors.text} />
            </TouchableOpacity>
            <OnboardingProgress total={3} current={1} />
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={() => router.push("/(onboarding)/welcome-3")}
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
    paddingBottom: spacing.lg,
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
  videoHidden: {
    opacity: 0,
    zIndex: -1,
    pointerEvents: "none",
  },
  imageTexture: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.3,
    zIndex: 1,
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
    marginBottom: spacing.lg,
  },
  body: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    lineHeight: 24,
    color: theme2Colors.text,
    marginBottom: spacing.md,
  },
  boldText: {
    fontFamily: "Roboto-Bold",
  },
  bottomContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    backgroundColor: theme2Colors.beige,
    borderTopWidth: 1,
    borderTopColor: "transparent", // Invisible border for consistent spacing
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
