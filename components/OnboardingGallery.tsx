"use client"

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react"
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
  Animated,
  PanResponder,
  Modal,
} from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTheme } from "../lib/theme-context"
import { spacing, typography } from "../lib/theme"
import { FontAwesome } from "@expo/vector-icons"
import { markAppTutorialSeen } from "../lib/db"
import { supabase } from "../lib/supabase"
import { usePostHog } from "posthog-react-native"
import { captureEvent, safeCapture } from "../lib/posthog"

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
  onboardingPink: "#D97393",
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window")
const CARD_SCALE = 0.9 // Scale for cards behind the focal card
const CARD_OPACITY = 0.4 // Opacity for cards behind the focal card
const CARD_OFFSET = 30 // Horizontal offset for stacked cards

interface OnboardingGalleryProps {
  visible: boolean
  screenshots: Array<{ id: string; source: any }> // source will be require() statements
  onComplete: () => void
  returnRoute?: string // Optional route to return to when gallery closes (defaults to /(main)/home)
}

export function OnboardingGallery({ visible, screenshots, onComplete, returnRoute }: OnboardingGalleryProps) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const posthog = usePostHog()
  
  const [currentIndex, setCurrentIndex] = useState(0)
  const [hasViewedAll, setHasViewedAll] = useState(false)
  const currentIndexRef = useRef(0) // Keep ref in sync for panResponder
  
  // Animated values for deck effect
  const pan = useRef(new Animated.ValueXY()).current
  const scale = useRef(new Animated.Value(1)).current
  const opacity = useRef(new Animated.Value(1)).current
  
  // Animated values for progress dots - create array of animated values
  const dotAnimationsRef = useRef<Animated.Value[]>([])
  
  // Initialize dot animations when screenshots are available
  useEffect(() => {
    if (screenshots.length > 0) {
      // Only initialize if not already initialized or if length changed
      if (dotAnimationsRef.current.length !== screenshots.length) {
        dotAnimationsRef.current = screenshots.map((_, index) => 
          new Animated.Value(index === 0 ? 1 : 0)
        )
      }
    }
  }, [screenshots.length])
  
  const dotAnimations = dotAnimationsRef.current

  // Track if user has swiped through all screenshots (no auto-close)
  useEffect(() => {
    if (visible && screenshots.length > 0 && currentIndex === screenshots.length - 1) {
      // User reached the last screenshot
      setHasViewedAll(true)
      // Don't auto-close - wait for user to tap or click X
    }
  }, [currentIndex, screenshots.length, visible])

  // Reset when gallery opens
  useEffect(() => {
    if (visible && screenshots.length > 0) {
      setCurrentIndex(0)
      currentIndexRef.current = 0
      setHasViewedAll(false)
      pan.setValue({ x: 0, y: 0 })
      scale.setValue(1)
      opacity.setValue(1)
      // Reset dot animations
      dotAnimationsRef.current.forEach((dot, index) => {
        dot.setValue(index === 0 ? 1 : 0)
      })
    }
  }, [visible, pan, scale, opacity, screenshots.length])
  
  // Keep ref in sync with state
  useEffect(() => {
    currentIndexRef.current = currentIndex
  }, [currentIndex])

  // Track when user sees the first screen (index 0)
  useEffect(() => {
    if (visible && currentIndex === 0 && screenshots.length > 0) {
      async function markTutorialSeen() {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            await markAppTutorialSeen(user.id)
          }
        } catch (error) {
          console.error("[OnboardingGallery] Failed to mark tutorial as seen:", error)
        }
      }
      markTutorialSeen()
    }
  }, [visible, currentIndex, screenshots.length])

  // Track each screen view with PostHog
  useEffect(() => {
    if (visible && screenshots.length > 0 && currentIndex >= 0 && currentIndex < screenshots.length) {
      try {
        const screenNumber = currentIndex + 1 // 1-indexed for user-friendly tracking
        const totalScreens = screenshots.length
        const screenshotId = screenshots[currentIndex]?.id || `screen-${currentIndex}`
        
        safeCapture(posthog, "viewed_walkthrough_screen", {
          screen_number: screenNumber,
          total_screens: totalScreens,
          screen_index: currentIndex,
          screenshot_id: screenshotId,
        })
      } catch (error) {
        if (__DEV__) console.error("[OnboardingGallery] Failed to track screen view:", error)
      }
    }
  }, [visible, currentIndex, screenshots.length, posthog])
  
  // Update progress dots when currentIndex changes
  useEffect(() => {
    if (screenshots.length > 0 && dotAnimationsRef.current.length > 0) {
      dotAnimationsRef.current.forEach((dot, index) => {
        Animated.timing(dot, {
          toValue: index === currentIndex ? 1 : 0,
          duration: 300,
          useNativeDriver: true,
        }).start()
      })
    }
  }, [currentIndex, screenshots.length])

  const handleSkip = useCallback(async () => {
    // Determine route: prioritize logged-in state, then use returnRoute as fallback
    let targetRoute: string
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        // User is logged in - always go to home
        targetRoute = "/(main)/home"
      } else {
        // User is not logged in - use returnRoute if provided, otherwise go to welcome-1
        targetRoute = returnRoute || "/(onboarding)/welcome-1"
      }
    } catch {
      // On error, use returnRoute if provided, otherwise go to welcome-1
      targetRoute = returnRoute || "/(onboarding)/welcome-1"
    }
    
    // Close modal first
    onComplete()
    
    // Then navigate after a small delay to ensure modal closes properly
    setTimeout(() => {
      router.replace(targetRoute as any)
    }, 100)
  }, [returnRoute, onComplete, router])

  const panResponder = useMemo(
    () =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only become responder if there's significant movement
        return Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow horizontal swiping
        pan.setValue({ x: gestureState.dx, y: 0 })
        
        // Scale down slightly when dragging
        const dragProgress = Math.abs(gestureState.dx) / SCREEN_WIDTH
        scale.setValue(1 - dragProgress * 0.1)
        opacity.setValue(1 - dragProgress * 0.3)
      },
      onPanResponderRelease: (_, gestureState) => {
        const swipeThreshold = SCREEN_WIDTH * 0.25 // 25% of screen width
        const velocityThreshold = 0.5
        const idx = currentIndexRef.current

          // If it's a tap (very small movement)
        if (Math.abs(gestureState.dx) < 10 && Math.abs(gestureState.dy) < 10) {
          if (idx < screenshots.length - 1) {
            goToNext()
            } else {
              // On last screen, tap closes the gallery
              handleSkip()
          }
          return
        }

        if (gestureState.dx > swipeThreshold || gestureState.vx > velocityThreshold) {
          // Swipe right - go to previous
          if (idx > 0) {
            goToPrevious()
          } else {
            // Snap back
            snapBack()
          }
        } else if (gestureState.dx < -swipeThreshold || gestureState.vx < -velocityThreshold) {
          // Swipe left - go to next
          if (idx < screenshots.length - 1) {
            goToNext()
          } else {
              // On last screen, swipe left closes the gallery
              handleSkip()
          }
        } else {
          // Snap back to center
          snapBack()
        }
      },
      }),
    [handleSkip, goToNext, goToPrevious, snapBack, screenshots.length]
  )

  const goToNext = () => {
    const idx = currentIndexRef.current
    if (idx < screenshots.length - 1) {
      const newIndex = idx + 1
      
      // Fade out current image
      Animated.parallel([
        Animated.timing(pan, {
          toValue: { x: -SCREEN_WIDTH, y: 0 },
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.7,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Update index while opacity is 0 (image is invisible)
        setCurrentIndex(newIndex)
        currentIndexRef.current = newIndex
        
        // Reset animation values
        pan.setValue({ x: 0, y: 0 })
        scale.setValue(1)
        
        // Use requestAnimationFrame to ensure React has rendered the new image before fading in
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // Now fade in the new image
            Animated.timing(opacity, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }).start()
          })
        })
      })
    } else {
      // Reached last screen - handle routing
      handleSkip()
    }
  }

  const goToPrevious = () => {
    const idx = currentIndexRef.current
    if (idx > 0) {
      const newIndex = idx - 1
      
      // Fade out current image
      Animated.parallel([
        Animated.timing(pan, {
          toValue: { x: SCREEN_WIDTH, y: 0 },
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.7,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Update index while opacity is 0 (image is invisible)
        setCurrentIndex(newIndex)
        currentIndexRef.current = newIndex
        
        // Reset animation values
        pan.setValue({ x: 0, y: 0 })
        scale.setValue(1)
        
        // Use requestAnimationFrame to ensure React has rendered the new image before fading in
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // Now fade in the new image
            Animated.timing(opacity, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }).start()
          })
        })
      })
    }
  }

  const snapBack = () => {
    Animated.parallel([
      Animated.spring(pan, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.spring(opacity, {
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start()
  }

  if (!visible || screenshots.length === 0) return null

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
    >
      <View style={[styles.container, { backgroundColor: theme2Colors.beige }]}>
        {/* Skip button - top right */}
        <TouchableOpacity
          style={[styles.skipButton, { top: insets.top + spacing.xs, right: spacing.md }]}
          onPress={handleSkip}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <FontAwesome name="times" size={16} color={theme2Colors.text} />
        </TouchableOpacity>

        {/* Progress dots - centered at top, aligned with Skip this */}
        {screenshots.length > 0 && dotAnimationsRef.current.length > 0 && (
          <View style={[styles.progressDotsContainer, { top: insets.top + spacing.md }]}>
            <View style={styles.progressDotsRow}>
              {screenshots.map((_, index) => {
                const dot = dotAnimationsRef.current[index]
                if (!dot) return null
                
                const dotScale = dot.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.6, 1],
                })
                const dotOpacity = dot.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.4, 1],
                })
                
                return (
                  <Animated.View
                    key={index}
                    style={[
                      styles.progressDot,
                      {
                        transform: [{ scale: dotScale }],
                        opacity: dotOpacity,
                        backgroundColor: index === currentIndex ? theme2Colors.text : theme2Colors.white,
                      },
                    ]}
                  />
                )
              })}
            </View>
            {/* Tap or swipe instruction text - only show on first screenshot */}
            {currentIndex === 0 && (
              <Text style={[styles.instructionText, { color: theme2Colors.textSecondary }]}>
                tap or swipe to continue
              </Text>
            )}
          </View>
        )}

        {/* Deck structure */}
        <View style={styles.deckContainer}>
          {/* Current image (focal, with pan responder and tap handler) */}
          <TouchableOpacity
            activeOpacity={1}
            style={styles.tapArea}
            onPress={() => {
              if (currentIndexRef.current < screenshots.length - 1) {
                goToNext()
              } else {
                // On last screen, close gallery when tapped
                handleSkip()
              }
            }}
          >
            <Animated.View
              style={[
                styles.imageContainer,
                styles.currentImage,
                {
                  transform: [
                    { translateX: pan.x },
                    { scale: scale },
                  ],
                  opacity: opacity,
                },
              ]}
              {...panResponder.panHandlers}
            >
              <Image
                key={`image-${currentIndex}`} // Force React to remount Image when index changes
                source={screenshots[currentIndex]?.source}
                style={styles.image}
                resizeMode="contain"
                fadeDuration={0}
              />
            </Animated.View>
          </TouchableOpacity>
        </View>

      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  deckContainer: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingTop: 60, // Space for top progress dots
    paddingBottom: 0, // No padding at bottom
  },
  tapArea: {
    position: "absolute",
    width: SCREEN_WIDTH * 0.98,
    bottom: 0,
    left: SCREEN_WIDTH * 0.01,
    height: SCREEN_HEIGHT * 0.88,
    zIndex: 1, // Lower than skip button
  },
  imageContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
    borderRadius: 12,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: SCREEN_HEIGHT * 0.88, // Slightly larger (was 0.85)
  },
  currentImage: {
    zIndex: 10,
  },
  nextImage: {
    zIndex: 5,
  },
  backgroundImage: {
    zIndex: 1,
  },
  skipButton: {
    position: "absolute",
    zIndex: 10000, // Much higher zIndex to ensure it's above everything
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme2Colors.white,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme2Colors.text,
    elevation: 10000, // Android elevation
  },
  progressDotsContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1000,
  },
  progressDotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  instructionText: {
    ...typography.body,
    fontSize: 12,
    marginTop: spacing.sm,
    textAlign: "center",
  },
})

