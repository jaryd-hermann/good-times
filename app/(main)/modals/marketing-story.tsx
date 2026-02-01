"use client"

import { useState, useEffect, useRef } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  PanResponder,
  Animated,
  StatusBar,
  Image,
  ActivityIndicator,
} from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useQuery } from "@tanstack/react-query"
import { getMarketingStory, type MarketingStorySlide } from "../../../lib/db"
import { useTheme } from "../../../lib/theme-context"
import { typography, spacing } from "../../../lib/theme"
import { useMarketingStories } from "../../../lib/useMarketingStories"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { FontAwesome } from "@expo/vector-icons"
import { usePostHog } from "posthog-react-native"

const SCREEN_WIDTH = Dimensions.get("window").width
const SCREEN_HEIGHT = Dimensions.get("window").height
const SWIPE_THRESHOLD = 100

function getStoryTitle(storyId: string): string {
  const titles: Record<string, string> = {
    "tips-asking": "Tips on asking questions",
    "tips-answering": "Tips on answering questions",
    "tips-getting-most": "How to get the most out of Good Times",
  }
  return titles[storyId] || "Good Times Tips"
}

export default function MarketingStoryModal() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const storyId = params.storyId as string
  const returnTo = (params.returnTo as string) || "/(main)/home"
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const { markSlideViewed, getLastSlideViewed } = useMarketingStories()
  const posthog = usePostHog()

  // Theme 2 colors
  const theme2Colors = {
    beige: isDark ? "#000000" : "#E8E0D5",
    cream: isDark ? "#000000" : "#F5F0EA",
    white: isDark ? "#E8E0D5" : "#FFFFFF",
    text: isDark ? "#F5F0EA" : "#000000",
    textSecondary: isDark ? "#A0A0A0" : "#404040",
    accent: "#D35E3C",
    yellow: "#E8A037",
    pink: "#D97393",
  }

  // Fetch story slides
  const { data: slides = [], isLoading } = useQuery({
    queryKey: ["marketing-story", storyId],
    queryFn: () => getMarketingStory(storyId),
    enabled: !!storyId,
  })

  // Track when user views the marketing story
  useEffect(() => {
    if (slides.length > 0 && storyId) {
      const storyName = getStoryTitle(storyId)
      if (posthog) {
        posthog.capture("viewed_marketing_story", {
          story_id: storyId,
          story_name: storyName,
        })
      }
    }
  }, [slides.length, storyId, posthog])

  // Get last slide viewed (resume from there)
  const lastSlideViewed = getLastSlideViewed(storyId)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(
    Math.max(0, lastSlideViewed) // Start from last viewed slide
  )

  // Track last marked slide to prevent infinite loops
  const lastMarkedSlideRef = useRef<number>(0)

  const translateX = useRef(new Animated.Value(0)).current

  // Define handlers before pan responder
  const handleClose = () => {
    const slideIndex = currentSlideIndex
    if (slideIndex >= slides.length - 1) {
      markSlideViewed(storyId, 8)
    }
    // Close modal - use back() like other modals, fallback to replace
    if (router.canGoBack()) {
      router.back()
    } else if (returnTo) {
      router.replace(returnTo as any)
    } else {
      router.replace("/(main)/home")
    }
  }

  const handleNext = () => {
    setCurrentSlideIndex((prev) => {
      if (prev < slides.length - 1) {
        translateX.setValue(0)
        return prev + 1
      } else {
        // Last slide - close modal
        markSlideViewed(storyId, 8)
        setTimeout(() => {
          if (router.canGoBack()) {
            router.back()
          } else if (returnTo) {
            router.replace(returnTo as any)
          } else {
            router.replace("/(main)/home")
          }
        }, 0)
        return prev
      }
    })
  }

  const handlePrevious = () => {
    setCurrentSlideIndex((prev) => {
      if (prev > 0) {
        translateX.setValue(0)
        return prev - 1
      }
      return prev
    })
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false, // Don't capture taps
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Don't capture if touch started in header area (where close button is)
        const { locationY } = evt.nativeEvent
        if (locationY < 100) { // Header area is roughly top 100px
          return false
        }
        // Only respond to horizontal swipes with significant movement
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10
      },
      onPanResponderMove: (_, gestureState) => {
        translateX.setValue(gestureState.dx)
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx } = gestureState

        if (Math.abs(dx) > SWIPE_THRESHOLD) {
          if (dx > 0) {
            // Swipe right - previous slide
            handlePrevious()
          } else {
            // Swipe left - next slide
            handleNext()
          }
        } else {
          // Return to center
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start()
        }
      },
    })
  ).current

  useEffect(() => {
    // Mark slide as viewed when it's displayed (only if not already marked)
    if (slides.length > 0 && currentSlideIndex < slides.length) {
      const slideNumber = currentSlideIndex + 1 // 1-indexed
      if (slideNumber !== lastMarkedSlideRef.current) {
        lastMarkedSlideRef.current = slideNumber
        markSlideViewed(storyId, slideNumber)
      }
    }
  }, [currentSlideIndex, slides.length, storyId]) // Removed markSlideViewed from deps

  const currentSlide = slides[currentSlideIndex]

  if (isLoading || slides.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme2Colors.beige }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme2Colors.text} />
          <Text style={[styles.loadingText, { color: theme2Colors.text, marginTop: spacing.md }]}>Loading...</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme2Colors.beige }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.headerLeft}>
            <View style={[styles.logoCircle, { backgroundColor: theme2Colors.white, overflow: "hidden" }]}>
              <Image
                source={require("../../../assets/images/loading.png")}
                style={styles.logoImage}
                resizeMode="cover"
              />
            </View>
            <Text style={[styles.storyTitle, { color: theme2Colors.text }]}>
              {getStoryTitle(storyId)}
            </Text>
          </View>
          <View style={styles.headerRight} pointerEvents="box-none">
            <TouchableOpacity 
              onPress={() => {
                console.log('[marketing-story] X button pressed, returnTo:', returnTo)
                handleClose()
              }} 
              style={styles.closeButton}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              activeOpacity={0.7}
            >
              <FontAwesome 
                name="times-circle" 
                size={18} 
                color={isDark ? theme2Colors.textSecondary : theme2Colors.textSecondary} 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressSegment,
                {
                  backgroundColor:
                    index <= currentSlideIndex ? theme2Colors.white : theme2Colors.textSecondary,
                  opacity: index <= currentSlideIndex ? 1 : 0.3,
                },
              ]}
            />
          ))}
        </View>

        {/* Content Area with tap zones */}
        <View style={styles.contentAreaWrapper}>
          {/* Left tap zone - previous */}
          <TouchableOpacity
            style={styles.tapZone}
            onPress={handlePrevious}
            activeOpacity={1}
          />
          {/* Center content - swipeable */}
          <Animated.View
            style={[
              styles.contentArea,
              {
                transform: [{ translateX }],
              },
            ]}
            {...panResponder.panHandlers}
          >
            <View style={styles.slideContainer}>
              <Text style={[styles.headline, { color: theme2Colors.text }]}>
                {currentSlide.headline}
              </Text>
              <Text style={[styles.body, { color: theme2Colors.textSecondary }]}>
                {currentSlide.body}
              </Text>
            </View>
          </Animated.View>
          {/* Right tap zone - next */}
          <TouchableOpacity
            style={styles.tapZone}
            onPress={handleNext}
            activeOpacity={1}
          />
        </View>

        {/* Navigation Controls */}
        <View style={[styles.navigation, { paddingBottom: insets.bottom + spacing.md }]}>
          <TouchableOpacity
            onPress={handlePrevious}
            disabled={currentSlideIndex === 0}
            style={[
              styles.navButton,
              {
                backgroundColor: theme2Colors.white,
                opacity: currentSlideIndex === 0 ? 0.3 : 1,
              },
            ]}
          >
            <FontAwesome
              name="chevron-left"
              size={16}
              color={currentSlideIndex === 0 ? theme2Colors.textSecondary : theme2Colors.beige}
            />
          </TouchableOpacity>

          <Text style={[styles.hintText, { color: theme2Colors.textSecondary }]}>
            {currentSlideIndex === slides.length - 1 ? "Tap to close" : "Tap to advance"}
          </Text>

          <TouchableOpacity
            onPress={handleNext}
            style={[
              styles.navButton,
              {
                backgroundColor: currentSlideIndex === slides.length - 1 ? theme2Colors.white : theme2Colors.pink,
                borderWidth: currentSlideIndex === slides.length - 1 ? 0 : 1,
                borderColor: currentSlideIndex === slides.length - 1 ? "transparent" : (isDark ? theme2Colors.textSecondary : theme2Colors.text),
              },
            ]}
          >
            <FontAwesome
              name={currentSlideIndex === slides.length - 1 ? "times" : "chevron-right"}
              size={16}
              color={currentSlideIndex === slides.length - 1 ? theme2Colors.beige : theme2Colors.white}
            />
          </TouchableOpacity>
        </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    ...typography.body,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    zIndex: 1000,
    elevation: 1000, // For Android
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  logoCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.sm,
  },
  logoImage: {
    width: 32,
    height: 32,
  },
  storyTitle: {
    fontFamily: "Roboto-Bold",
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  badgeText: {
    ...typography.caption,
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  closeButton: {
    padding: spacing.xs,
    zIndex: 1000,
    elevation: 1000, // For Android
  },
  progressContainer: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  contentAreaWrapper: {
    flex: 1,
    flexDirection: "row",
  },
  tapZone: {
    width: 60, // Fixed width for tap zones on each side
  },
  contentArea: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.sm, // Reduced padding for wider content
  },
  slideContainer: {
    alignItems: "center",
    width: "100%",
  },
  headline: {
    fontFamily: "PMGothicLudington-Text115",
    fontSize: 36,
    fontWeight: "400",
    textAlign: "center",
    marginBottom: spacing.xl,
    lineHeight: 44,
  },
  body: {
    ...typography.body,
    fontSize: 18,
    lineHeight: 28,
    textAlign: "center",
    width: "100%",
  },
  navigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  hintText: {
    ...typography.body,
    fontSize: 14,
  },
})
