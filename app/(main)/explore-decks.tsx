"use client"

import React, { useState, useEffect, useRef, useMemo } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageBackground,
  Modal,
  Dimensions,
  Animated,
  Alert,
  PanResponder,
} from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { FontAwesome } from "@expo/vector-icons"
import { useTheme } from "../../lib/theme-context"
import { typography, spacing } from "../../lib/theme"
import { getCollections, getGroupActiveDecks, getDeckQuestionsLeftCount, getDecksByCollection, getCurrentUser, getVoteStatus, getUserGroups, getFeaturedPromptsForCurrentWeek, getGroupFeaturedQuestionCount, addFeaturedQuestionToQueue, isFeaturedPromptInGroupQueue, getFeaturedQuestionAddedBy, getSwipeableQuestionsForGroup, recordSwipe, getSwipingParticipants, getMatchInfo } from "../../lib/db"
import { supabase } from "../../lib/supabase"
import { useTabBar } from "../../lib/tab-bar-context"
import type { Collection, GroupActiveDeck, FeaturedPrompt, Prompt, User } from "../../lib/types"
import { usePostHog } from "posthog-react-native"
import { safeCapture } from "../../lib/posthog"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useCallback } from "react"
import { Avatar } from "../../components/Avatar"

const { width: SCREEN_WIDTH } = Dimensions.get("window")
const CARD_WIDTH = (SCREEN_WIDTH - spacing.md * 3) / 2 // 2 columns with spacing

// Theme 2 color palette - will be made dynamic in component

// Helper function to get collection icon source and dimensions based on collection name
// NOTE: Collection icons have been removed - this function is kept for potential future use
function getCollectionIconSource(collectionName: string | undefined) {
  // Return null since icons are no longer used
  return null
}

// Helper function to get collection card background color and text color based on collection name
function getCollectionCardColors(collectionName: string | undefined, theme2Colors: { red: string; yellow: string; green: string; blue: string; white: string; text: string }): { backgroundColor: string; textColor: string; descriptionColor: string } {
  if (!collectionName) {
    return { backgroundColor: theme2Colors.red, textColor: theme2Colors.white, descriptionColor: theme2Colors.white }
  }
  
  const nameLower = collectionName.toLowerCase()
  
  // Match colors from the image description
  if (nameLower.includes("deeper")) {
    return { backgroundColor: "#B94444", textColor: theme2Colors.white, descriptionColor: theme2Colors.white } // Reddish-brown
  }
  
  if (nameLower.includes("nostalgia")) {
    return { backgroundColor: theme2Colors.blue, textColor: theme2Colors.white, descriptionColor: theme2Colors.white } // Blue
  }
  
  if (nameLower.includes("real life routine") || nameLower.includes("routines")) {
    return { backgroundColor: theme2Colors.yellow, textColor: theme2Colors.text, descriptionColor: theme2Colors.text } // Golden-yellow
  }
  
  if (nameLower.includes("raw truth") || nameLower.includes("truths")) {
    return { backgroundColor: theme2Colors.green, textColor: theme2Colors.white, descriptionColor: theme2Colors.white } // Dark green
  }
  
  if (nameLower.includes("memorial")) {
    return { backgroundColor: "#9B59B6", textColor: theme2Colors.white, descriptionColor: theme2Colors.white } // Purple
  }
  
  if (nameLower.includes("mindset") || nameLower.includes("growth")) {
    return { backgroundColor: "#E91E63", textColor: theme2Colors.white, descriptionColor: theme2Colors.white } // Hot pink
  }
  
  // Default fallback
  return { backgroundColor: theme2Colors.red, textColor: theme2Colors.white, descriptionColor: theme2Colors.white }
}

// Helper function to get card height - Deeper and Nostalgia are double height
function getCollectionCardHeight(collectionName: string | undefined): number {
  if (!collectionName) {
    return 200
  }
  
  const nameLower = collectionName.toLowerCase()
  
  // Deeper and Nostalgia are double height (base height is ~180, so double is ~360)
  if (nameLower.includes("deeper") || nameLower.includes("nostalgia")) {
    return 360
  }
  
  // All other cards use standard height
  return 180
}

// Helper function to check if collection should be on left column
function isLeftColumnCollection(collectionName: string | undefined): boolean {
  if (!collectionName) {
    return false
  }
  
  const nameLower = collectionName.toLowerCase()
  return nameLower.includes("deeper") || nameLower.includes("nostalgia")
}

// Helper function to render geometric shapes for collection cards
function renderCollectionGeometricShapes(collectionName: string | undefined) {
  if (!collectionName) {
    return null
  }
  
  const nameLower = collectionName.toLowerCase()
  
  // Deeper: Two overlapping white circles
  if (nameLower.includes("deeper")) {
    return (
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, overflow: "hidden" }}>
        <View style={{ position: "absolute", bottom: -20, left: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(255, 255, 255, 0.3)" }} />
        <View style={{ position: "absolute", bottom: -10, right: 30, width: 50, height: 50, borderRadius: 25, backgroundColor: "rgba(255, 255, 255, 0.3)" }} />
      </View>
    )
  }
  
  // Nostalgia: Two overlapping light blue circles
  if (nameLower.includes("nostalgia")) {
    return (
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, overflow: "hidden" }}>
        <View style={{ position: "absolute", bottom: -20, left: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(173, 216, 230, 0.4)" }} />
        <View style={{ position: "absolute", bottom: -10, right: 30, width: 50, height: 50, borderRadius: 25, backgroundColor: "rgba(173, 216, 230, 0.4)" }} />
      </View>
    )
  }
  
  // Raw Truths: Light green mountain/wave shape
  if (nameLower.includes("raw truth") || nameLower.includes("truths")) {
    return (
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, overflow: "hidden" }}>
        <View style={{ 
          position: "absolute", 
          bottom: 0, 
          left: 0, 
          right: 0, 
          height: 40, 
          backgroundColor: "rgba(144, 238, 144, 0.3)",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
        }} />
      </View>
    )
  }
  
  // Quick Vibes: Two overlapping light brown ovals
  if (nameLower.includes("quick") || nameLower.includes("vibes")) {
    return (
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, overflow: "hidden" }}>
        <View style={{ position: "absolute", bottom: -15, left: 25, width: 70, height: 40, borderRadius: 20, backgroundColor: "rgba(210, 180, 140, 0.3)" }} />
        <View style={{ position: "absolute", bottom: -5, right: 20, width: 60, height: 35, borderRadius: 18, backgroundColor: "rgba(210, 180, 140, 0.3)" }} />
      </View>
    )
  }
  
  // Daily Wins: Semi-transparent light pink circle
  if (nameLower.includes("daily") || nameLower.includes("wins")) {
    return (
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, overflow: "hidden" }}>
        <View style={{ position: "absolute", bottom: -10, right: 30, width: 50, height: 50, borderRadius: 25, backgroundColor: "rgba(255, 182, 193, 0.4)" }} />
      </View>
    )
  }
  
  // Default: Simple circle
  return (
    <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, overflow: "hidden" }}>
      <View style={{ position: "absolute", bottom: -10, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255, 255, 255, 0.2)" }} />
    </View>
  )
}

// Helper function to get collection icon dimensions based on collection name
// Returns { width, height } maintaining aspect ratio, scaled to base width of 48
function getCollectionIconDimensions(collectionName: string | undefined) {
  if (!collectionName) {
    // icon-deeper.png: 72x64
    return { width: 48, height: 43 } // Maintains ~1.125:1 aspect ratio
  }
  
  const nameLower = collectionName.toLowerCase()
  
  if (nameLower.includes("deeper")) {
    // icon-deeper.png: 72x64
    return { width: 48, height: 43 } // Maintains ~1.125:1 aspect ratio
  }
  
  if (nameLower.includes("real life routine") || nameLower.includes("routines")) {
    // icon-routine.png: 300x300
    return { width: 48, height: 48 } // Square
  }
  
  if (nameLower.includes("raw truth") || nameLower.includes("truths")) {
    // icon-truths.png: 164x173 - 10% larger
    return { width: 51, height: 53 } // 10% larger (was 46x48), maintains ~0.948:1 aspect ratio
  }
  
  if (nameLower.includes("nostalgia")) {
    // icon-nostalgia.png: 128x128
    return { width: 48, height: 48 } // Square
  }
  
  if (nameLower.includes("memorial")) {
    // icon-memorial.png: 120x120
    return { width: 48, height: 48 } // Square
  }
  
  if (nameLower.includes("mindset") || nameLower.includes("growth")) {
    // icon-mindset.png: 138x140
    return { width: 47, height: 48 } // Maintains ~0.986:1 aspect ratio
  }
  
  // Default fallback (icon-deeper.png)
  return { width: 48, height: 43 }
}

// Helper function to get deck image source based on deck name
function getDeckImageSource(deckName: string | undefined, iconUrl: string | undefined) {
  if (!deckName) {
    // Use icon-daily as default fallback
    return require("../../assets/images/icon-daily.png")
  }
  
  const nameLower = deckName.toLowerCase()
  
  if (nameLower.includes("everyday reflections") || nameLower.includes("reflections")) {
    return require("../../assets/images/icon-reflections.png")
  }
  
  if (nameLower.includes("past & present") || nameLower.includes("past and present")) {
    return require("../../assets/images/icon-past.png")
  }
  
  if (nameLower.includes("relationships and connection") || nameLower.includes("relationships")) {
    return require("../../assets/images/icon-relationships.png")
  }
  
  // Real life routine collection
  if (nameLower.includes("right now")) {
    return require("../../assets/images/icon-rightnow.png")
  }
  
  if (nameLower.includes("home") && !nameLower.includes("homemade") && !nameLower.includes("homework")) {
    return require("../../assets/images/icon-home.png")
  }
  
  if (nameLower.includes("daily joys")) {
    return require("../../assets/images/icon-daily.png")
  }
  
  // Raw truths collection
  if (nameLower.includes("mayhem")) {
    return require("../../assets/images/icon-mayhem.png")
  }
  
  if (nameLower.includes("hot takes only") || nameLower.includes("hot takes")) {
    return require("../../assets/images/icon-hottakes.png")
  }
  
  if (nameLower.includes("night out energy") || nameLower.includes("night out")) {
    return require("../../assets/images/icon-nightout.png")
  }
  
  // Nostalgia collection
  if (nameLower.includes("old photos")) {
    return require("../../assets/images/icon-oldphotos.png")
  }
  
  if (nameLower.includes("childhood")) {
    return require("../../assets/images/icon-childhood.png")
  }
  
  if (nameLower.includes("milestones")) {
    return require("../../assets/images/icon-milestones.png")
  }
  
  // Memorial collection
  if (nameLower.includes("shared memories")) {
    return require("../../assets/images/icon-sharedmemories.png")
  }
  
  if (nameLower.includes("their legacy") || nameLower.includes("legacy")) {
    return require("../../assets/images/icon-legacy.png")
  }
  
  // Mindset & Growth collection
  if (nameLower.includes("little lessons")) {
    return require("../../assets/images/icon-littlelessons.png")
  }
  
  if (nameLower.includes("personal philosophies")) {
    return require("../../assets/images/icon-lifephilosophies.png")
  }
  
  // Fallback to icon_url if available, otherwise default
  if (iconUrl) {
    return { uri: iconUrl }
  }
  
  // Use icon-daily as default fallback
  return require("../../assets/images/icon-daily.png")
}

export default function ExploreDecks() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  
  // Theme 2 color palette - dynamic based on dark/light mode
  const theme2Colors = useMemo(() => {
    if (isDark) {
      // Dark mode colors
      return {
        red: "#B94444",
        yellow: "#E8A037",
        green: "#2D6F4A",
        blue: "#3A5F8C",
        beige: "#000000", // Black (was beige) - page background
        cream: "#000000", // Black (was cream) - for card backgrounds
        white: "#E8E0D5", // Beige (was white)
        text: "#F5F0EA", // Cream (was black) - text color
        textSecondary: "#A0A0A0", // Light gray (was dark gray)
      }
    } else {
      // Light mode colors (current/default)
      return {
        red: "#B94444",
        yellow: "#E8A037",
        green: "#2D6F4A",
        blue: "#3A5F8C",
        beige: "#E8E0D5",
        cream: "#F5F0EA",
        white: "#FFFFFF",
        text: "#000000",
        textSecondary: "#404040",
      }
    }
  }, [isDark])
  const [currentGroupId, setCurrentGroupId] = useState<string>()
  const [userId, setUserId] = useState<string>()
  const [helpModalVisible, setHelpModalVisible] = useState(false)
  const [featuredQuestionModalVisible, setFeaturedQuestionModalVisible] = useState(false)
  const [selectedFeaturedPrompt, setSelectedFeaturedPrompt] = useState<FeaturedPrompt | null>(null)
  const [featuredQuestionCarouselIndex, setFeaturedQuestionCarouselIndex] = useState(0)
  const [activeTab, setActiveTab] = useState<"decks" | "featured" | "matches">("decks")
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [matchModalVisible, setMatchModalVisible] = useState(false)
  const [matchInfo, setMatchInfo] = useState<{ matchedWithUsers: string[] } | null>(null)
  const [isSwiping, setIsSwiping] = useState(false)
  const [progressCompleteModalVisible, setProgressCompleteModalVisible] = useState(false)
  const [hasShownCompletionModal, setHasShownCompletionModal] = useState(false) // Track if modal has been shown
  const [userName, setUserName] = useState<string>("there")
  const [localYesSwipeCount, setLocalYesSwipeCount] = useState<number | null>(null)
  const [progressBarKey, setProgressBarKey] = useState(0) // Force re-render key
  // Use refs to track values to avoid stale closure issues
  const currentQuestionIndexRef = useRef(0)
  const currentGroupIdRef = useRef<string | undefined>(undefined)
  const userIdRef = useRef<string | undefined>(undefined)
  const yesSwipeCountRef = useRef<number>(0)
  const queryClientRef = useRef(queryClient)
  const handleSwipeRef = useRef<((direction: "yes" | "no") => Promise<void>) | null>(null)
  const setLocalYesSwipeCountRef = useRef<React.Dispatch<React.SetStateAction<number | null>> | null>(null)
  const cardPosition = useRef(new Animated.ValueXY()).current
  const cardRotation = useRef(new Animated.Value(0)).current
  const cardOpacity = useRef(new Animated.Value(1)).current
  const scrollY = useRef(new Animated.Value(0)).current
  const headerTranslateY = useRef(new Animated.Value(0)).current
  const progressBarWidthRef = useRef(new Animated.Value(0))
  const progressBarWidth = progressBarWidthRef.current // Animated progress bar width (0-100%)
  const contentPaddingTop = useRef(new Animated.Value(0)).current
  const lastScrollY = useRef(0)
  const isResettingScroll = useRef(false)
  const { opacity: tabBarOpacity } = useTabBar()
  const posthog = usePostHog()
  const queryClient = useQueryClient()
  
  // Modal animations
  const featuredModalBackdropOpacity = useRef(new Animated.Value(0)).current
  const featuredModalSlideY = useRef(new Animated.Value(300)).current
  const matchModalBackdropOpacity = useRef(new Animated.Value(0)).current
  const matchModalSlideY = useRef(new Animated.Value(300)).current
  const progressModalBackdropOpacity = useRef(new Animated.Value(0)).current
  const progressModalSlideY = useRef(new Animated.Value(300)).current
  const helpModalBackdropOpacity = useRef(new Animated.Value(0)).current
  const helpModalSlideY = useRef(new Animated.Value(300)).current

  // Animate featured modal
  useEffect(() => {
    if (featuredQuestionModalVisible) {
      Animated.parallel([
        Animated.timing(featuredModalBackdropOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(featuredModalSlideY, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(featuredModalBackdropOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(featuredModalSlideY, {
          toValue: 300,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [featuredQuestionModalVisible, featuredModalBackdropOpacity, featuredModalSlideY])

  // Animate match modal
  useEffect(() => {
    if (matchModalVisible) {
      Animated.parallel([
        Animated.timing(matchModalBackdropOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(matchModalSlideY, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(matchModalBackdropOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(matchModalSlideY, {
          toValue: 300,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [matchModalVisible, matchModalBackdropOpacity, matchModalSlideY])

  // Animate progress modal
  useEffect(() => {
    if (progressCompleteModalVisible) {
      Animated.parallel([
        Animated.timing(progressModalBackdropOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(progressModalSlideY, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(progressModalBackdropOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(progressModalSlideY, {
          toValue: 300,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [progressCompleteModalVisible, progressModalBackdropOpacity, progressModalSlideY])

  // Animate help modal
  useEffect(() => {
    if (helpModalVisible) {
      Animated.parallel([
        Animated.timing(helpModalBackdropOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(helpModalSlideY, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(helpModalBackdropOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(helpModalSlideY, {
          toValue: 300,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [helpModalVisible, helpModalBackdropOpacity, helpModalSlideY])

  // Track loaded_explore_decks event
  useEffect(() => {
    if (currentGroupId) {
      safeCapture(posthog, "loaded_explore_decks", {
        group_id: currentGroupId,
      })
    }
  }, [posthog, currentGroupId])

  const focusGroupId = params.focusGroupId as string | undefined
  const paramGroupId = params.groupId as string | undefined

  async function loadUser() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        // Get user name
        const currentUser = await getCurrentUser()
        if (currentUser?.name) {
          setUserName(currentUser.name)
        }
        // Get user's groups
        const groups = await getUserGroups(user.id)
        if (groups.length > 0) {
          // Priority order:
          // 1. focusGroupId param (highest priority - explicit group switch)
          // 2. groupId param (from URL)
          // 3. Default group ID from AsyncStorage (if user has multiple groups)
          // 4. Persisted group ID from AsyncStorage
          // 5. Current state (if already set)
          // 6. First group (fallback)
          
          if (focusGroupId && groups.some((group) => group.id === focusGroupId)) {
            setCurrentGroupId(focusGroupId)
            await AsyncStorage.setItem("current_group_id", focusGroupId)
          } else if (paramGroupId && groups.some((group) => group.id === paramGroupId)) {
            setCurrentGroupId(paramGroupId)
            await AsyncStorage.setItem("current_group_id", paramGroupId)
          } else {
            // Check for default group first (only if user has multiple groups)
            const defaultGroupId = groups.length > 1 
              ? await AsyncStorage.getItem("default_group_id")
              : null
            
            if (defaultGroupId && groups.some((group) => group.id === defaultGroupId)) {
              setCurrentGroupId(defaultGroupId)
              await AsyncStorage.setItem("current_group_id", defaultGroupId)
            } else {
              // Try to restore from AsyncStorage
              const persistedGroupId = await AsyncStorage.getItem("current_group_id")
              if (persistedGroupId && groups.some((group) => group.id === persistedGroupId)) {
                setCurrentGroupId(persistedGroupId)
              } else {
                // Fallback to first group
                setCurrentGroupId(groups[0].id)
                await AsyncStorage.setItem("current_group_id", groups[0].id)
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("[explore-decks] Error loading user:", error)
    }
  }

  useEffect(() => {
    loadUser()
  }, [])

  // Reload group context when screen comes into focus (e.g., returning from group switch)
  useFocusEffect(
    useCallback(() => {
      async function reloadGroupContext() {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser()
          if (user) {
            const groups = await getUserGroups(user.id)
            if (groups.length === 0) return

            // Always check AsyncStorage for current group (group switching updates this)
            const persistedGroupId = await AsyncStorage.getItem("current_group_id")
            
            // Priority order:
            // 1. focusGroupId param (explicit group switch)
            // 2. persistedGroupId from AsyncStorage (most recent group - this is the key!)
            // 3. First group (fallback)
            
            let newGroupId: string | undefined
            
            if (focusGroupId && groups.some((group) => group.id === focusGroupId)) {
              newGroupId = focusGroupId
            } else if (persistedGroupId && groups.some((group) => group.id === persistedGroupId)) {
              newGroupId = persistedGroupId
            } else {
              newGroupId = groups[0].id // Fallback to first group
            }
            
            // Always update to ensure we're in sync with AsyncStorage
            if (newGroupId) {
              // Use functional update to get current state
              setCurrentGroupId((prevGroupId) => {
                const groupChanged = newGroupId !== prevGroupId
                
                // If group changed, invalidate all group-related queries to force refetch
                if (groupChanged && newGroupId) {
                  queryClient.invalidateQueries({ queryKey: ["groupActiveDecks"] })
                  queryClient.invalidateQueries({ queryKey: ["collectionDeckCounts"] })
                  queryClient.invalidateQueries({ queryKey: ["deckQuestionsLeft"] })
                  queryClient.invalidateQueries({ queryKey: ["voteStatuses"] })
                }
                
                return newGroupId
              })
            }
          }
        } catch (error) {
          console.error("[explore-decks] Error reloading group context:", error)
        }
        
        // CRITICAL: Always invalidate and refetch featured prompts query when screen comes into focus
        // This ensures the section shows if prompts exist for the current week
        // This fixes the issue where the section disappears after adding a question
        // Use exact: false to invalidate all queries with this key prefix (handles week changes)
        queryClient.invalidateQueries({ queryKey: ["featuredPrompts"], exact: false })
        queryClient.refetchQueries({ queryKey: ["featuredPrompts"], exact: false })
        
        // CRITICAL: If swipe tab is active, ensure queries refetch when screen comes into focus
        // This fixes blank content when switching groups or returning to the screen
        if (activeTab === "matches" && currentGroupId && userId) {
          queryClient.invalidateQueries({ queryKey: ["swipeableQuestions", currentGroupId, userId] })
          queryClient.invalidateQueries({ queryKey: ["swipingParticipants", currentGroupId, userId] })
          queryClient.invalidateQueries({ queryKey: ["yesSwipeCount", currentGroupId, userId] })
          queryClient.refetchQueries({ queryKey: ["swipeableQuestions", currentGroupId, userId] })
          queryClient.refetchQueries({ queryKey: ["yesSwipeCount", currentGroupId, userId] })
        }
      }
      reloadGroupContext()
    }, [focusGroupId, queryClient])
  )

  // Invalidate and refetch queries when currentGroupId changes (handles group switches)
  useEffect(() => {
    if (currentGroupId) {
      // Invalidate all queries that depend on groupId
      queryClient.invalidateQueries({ queryKey: ["groupActiveDecks", currentGroupId] })
      queryClient.invalidateQueries({ queryKey: ["collectionDeckCounts"] })
      queryClient.invalidateQueries({ queryKey: ["deckQuestionsLeft", currentGroupId] })
      queryClient.invalidateQueries({ queryKey: ["voteStatuses", currentGroupId] })
      
      // CRITICAL: If swipe tab is active, refetch swipe queries immediately when group changes
      // This ensures data loads even if queries were disabled before
      if (activeTab === "matches" && userId) {
        queryClient.invalidateQueries({ queryKey: ["swipeableQuestions", currentGroupId, userId] })
        queryClient.invalidateQueries({ queryKey: ["swipingParticipants", currentGroupId, userId] })
        queryClient.invalidateQueries({ queryKey: ["yesSwipeCount", currentGroupId, userId] })
        // Explicitly refetch to ensure data loads
        queryClient.refetchQueries({ queryKey: ["swipeableQuestions", currentGroupId, userId] })
        queryClient.refetchQueries({ queryKey: ["yesSwipeCount", currentGroupId, userId] })
      }
      
      // Always refetch featured prompts when group changes (they're group-agnostic but should refresh)
      refetchFeaturedPrompts()
    }
  }, [currentGroupId, queryClient, activeTab, userId, refetchFeaturedPrompts])

  const { data: collections = [] } = useQuery({
    queryKey: ["collections"],
    queryFn: getCollections,
  })

  const { data: activeDecks = [] } = useQuery({
    queryKey: ["groupActiveDecks", currentGroupId],
    queryFn: () => (currentGroupId ? getGroupActiveDecks(currentGroupId) : []),
    enabled: !!currentGroupId,
  })

  // Get deck counts for each collection
  const { data: collectionDeckCounts = {} } = useQuery({
    queryKey: ["collectionDeckCounts", collections.map(c => c.id).join(","), currentGroupId],
    queryFn: async () => {
      const counts: Record<string, number> = {}
      for (const collection of collections) {
        const decks = await getDecksByCollection(collection.id)
        // Count decks that are not active/rejected/finished for this group
        if (currentGroupId) {
          const { data: groupDecks } = await supabase
            .from("group_active_decks")
            .select("deck_id")
            .eq("group_id", currentGroupId)
            .in("status", ["active", "rejected", "finished"])
          
          const usedDeckIds = new Set((groupDecks || []).map((gd: any) => gd.deck_id))
          const unusedDecks = decks.filter(d => !usedDeckIds.has(d.id))
          counts[collection.id] = unusedDecks.length
        } else {
          counts[collection.id] = decks.length
        }
      }
      return counts
    },
    enabled: collections.length > 0,
  })

  // Get questions left count for each active deck
  const { data: deckQuestionsLeft = {} } = useQuery({
    queryKey: ["deckQuestionsLeft", currentGroupId, activeDecks.map(d => d.deck_id).join(",")],
    queryFn: async () => {
      if (!currentGroupId || activeDecks.length === 0) return {}
      const counts: Record<string, number> = {}
      for (const deck of activeDecks) {
        if (deck.status === "active") {
          const count = await getDeckQuestionsLeftCount(currentGroupId, deck.deck_id)
          counts[deck.deck_id] = count
        }
      }
      return counts
    },
    enabled: !!currentGroupId && activeDecks.length > 0,
  })

  // Get vote status for voting decks to show counts
  const { data: voteStatuses = {} } = useQuery({
    queryKey: ["voteStatuses", currentGroupId, activeDecks.filter(d => d.status === "voting").map(d => d.deck_id).join(",")],
    queryFn: async () => {
      if (!currentGroupId) return {}
      const statuses: Record<string, { yes_votes: number; no_votes: number }> = {}
      for (const deck of activeDecks) {
        if (deck.status === "voting") {
          try {
            const status = await getVoteStatus(currentGroupId, deck.deck_id)
            statuses[deck.deck_id] = {
              yes_votes: status.yes_votes,
              no_votes: status.no_votes,
            }
          } catch (error) {
            console.warn(`[explore-decks] Error getting vote status for deck ${deck.deck_id}:`, error)
          }
        }
      }
      return statuses
    },
    enabled: !!currentGroupId && activeDecks.some(d => d.status === "voting"),
  })

  // Get current week Monday for query key
  // CRITICAL: Recalculate when screen comes into focus to handle week changes
  // This ensures the query key is always current, even if the app was open when the week changed
  const [currentWeekMonday, setCurrentWeekMonday] = useState(() => {
    const today = new Date()
    const dayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const monday = new Date(today)
    monday.setDate(today.getDate() - daysToSubtract)
    return monday.toISOString().split("T")[0]
  })
  
  // Recalculate week Monday when screen comes into focus (handles week changes)
  useFocusEffect(
    useCallback(() => {
      const today = new Date()
      const dayOfWeek = today.getDay()
      const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      const monday = new Date(today)
      monday.setDate(today.getDate() - daysToSubtract)
      const weekMonday = monday.toISOString().split("T")[0]
      setCurrentWeekMonday(weekMonday)
    }, [])
  )

  // Get featured prompts for current week
  // CRITICAL: Include current week Monday in query key so it refetches when week changes
  // This ensures the section always shows when there are prompts for the current week
  // The query key changes when the week changes, forcing a refetch
  // NOTE: getFeaturedPromptsForCurrentWeek calculates the week internally, so even if currentWeekMonday is stale,
  // the function will fetch the correct week. However, React Query caches by query key, so we need to ensure
  // proper invalidation when switching tabs or when the week might have changed.
  const { data: featuredPrompts = [], error: featuredPromptsError, isLoading: isLoadingFeaturedPrompts, isFetching: isFetchingFeaturedPrompts, refetch: refetchFeaturedPrompts } = useQuery({
    queryKey: ["featuredPrompts", currentWeekMonday], // Use memoized value
    queryFn: getFeaturedPromptsForCurrentWeek,
    enabled: true, // Always enabled - featured prompts are group-agnostic
    staleTime: 0, // Always consider stale to ensure fresh data
    refetchOnMount: true, // Always refetch on mount
    refetchOnWindowFocus: true, // Refetch when screen comes into focus
    retry: 2, // Retry on failure
    refetchInterval: 3600000, // Refetch every hour to catch week changes
  })
  
  // CRITICAL: Refetch when switching to featured tab to ensure fresh data
  // This fixes the issue where prompts don't show when first opening the tab
  useEffect(() => {
    if (activeTab === "featured") {
      // Invalidate all featured prompts queries (including any with different week keys)
      queryClient.invalidateQueries({ queryKey: ["featuredPrompts"], exact: false })
      // Force a fresh refetch - this ensures we get the latest week's data
      refetchFeaturedPrompts()
    }
  }, [activeTab, refetchFeaturedPrompts, queryClient])
  
  // Log errors for debugging
  useEffect(() => {
    if (featuredPromptsError) {
      console.error("[explore-decks] Error fetching featured prompts:", featuredPromptsError)
    }
  }, [featuredPromptsError])

  // Get featured question count for current group
  const { data: featuredQuestionCount = 0, refetch: refetchFeaturedCount } = useQuery({
    queryKey: ["featuredQuestionCount", currentGroupId],
    queryFn: () => (currentGroupId ? getGroupFeaturedQuestionCount(currentGroupId) : 0),
    enabled: !!currentGroupId,
  })

  // Get swipeable questions for matches tab
  const { data: swipeableQuestionsData = [], refetch: refetchSwipeableQuestions, isLoading: isLoadingSwipeableQuestions } = useQuery({
    queryKey: ["swipeableQuestions", currentGroupId, userId],
    queryFn: () => (currentGroupId && userId ? getSwipeableQuestionsForGroup(currentGroupId, userId) : []),
    enabled: !!currentGroupId && !!userId && activeTab === "matches",
    staleTime: 0, // Always consider stale to ensure fresh data
    refetchOnMount: true, // Always refetch on mount
    refetchOnWindowFocus: true, // Refetch when screen comes into focus
  })

  // Get swiping participants
  const { data: swipingParticipantsData = [] } = useQuery({
    queryKey: ["swipingParticipants", currentGroupId, userId],
    queryFn: () => (currentGroupId && userId ? getSwipingParticipants(currentGroupId, userId) : []),
    enabled: !!currentGroupId && !!userId && activeTab === "matches",
  })

  // Get count of "yes" swipes for current user
  const { data: yesSwipeCount = 0 } = useQuery({
    queryKey: ["yesSwipeCount", currentGroupId, userId],
    queryFn: async () => {
      if (!currentGroupId || !userId) return 0
      const { count, error } = await supabase
        .from("group_question_swipes")
        .select("*", { count: "exact", head: true })
        .eq("group_id", currentGroupId)
        .eq("user_id", userId)
        .eq("response", "yes")
      
      if (error) {
        console.error("[explore-decks] Error fetching yes swipe count:", error)
        return 0
      }
      const countValue = count || 0
      // Sync local state with fetched count
      setLocalYesSwipeCount(countValue)
      return countValue
    },
    enabled: !!currentGroupId && !!userId && activeTab === "matches",
    refetchOnMount: true,
  })

  // Use local count if available (for optimistic updates), otherwise use query count
  const displaySwipeCount = localYesSwipeCount !== null ? localYesSwipeCount : yesSwipeCount

  // Keep refs in sync for use in pan responder
  useEffect(() => {
    yesSwipeCountRef.current = yesSwipeCount
  }, [yesSwipeCount])
  
  useEffect(() => {
    queryClientRef.current = queryClient
  }, [queryClient])

  // Update animated progress bar width when displaySwipeCount changes
  useEffect(() => {
    const percentage = Math.min((displaySwipeCount / 15) * 100, 100)
    Animated.timing(progressBarWidth, {
      toValue: percentage,
      duration: 200,
      useNativeDriver: false, // width animation requires layout
    }).start()
  }, [displaySwipeCount, progressBarWidth])

  // Reset card position and index when new questions load
  useEffect(() => {
    if (swipeableQuestionsData.length > 0) {
      setCurrentQuestionIndex(0)
      currentQuestionIndexRef.current = 0
      // Reset card position when new questions load
      cardPosition.setValue({ x: 0, y: 0 })
      cardRotation.setValue(0)
      cardOpacity.setValue(1)
    }
  }, [swipeableQuestionsData.length]) // Only depend on length, not the array reference

  // Reset card if groupId or userId changes (to prevent stuck state)
  useEffect(() => {
    if (currentGroupId && userId && activeTab === "matches") {
      // Ensure card is reset when values become available
      cardPosition.setValue({ x: 0, y: 0 })
      cardRotation.setValue(0)
      cardOpacity.setValue(1)
      setIsSwiping(false)
    }
  }, [currentGroupId, userId, activeTab])

  // Keep refs in sync with state
  useEffect(() => {
    currentQuestionIndexRef.current = currentQuestionIndex
  }, [currentQuestionIndex])

  useEffect(() => {
    currentGroupIdRef.current = currentGroupId
  }, [currentGroupId])

  useEffect(() => {
    userIdRef.current = userId
  }, [userId])

  // Check which featured prompts are already in queue (for disabling)
  const { data: featuredPromptsInQueue = [] } = useQuery({
    queryKey: ["featuredPromptsInQueue", currentGroupId, featuredPrompts.map(p => p.id).join(",")],
    queryFn: async () => {
      if (!currentGroupId || featuredPrompts.length === 0) return []
      const inQueue: string[] = []
      for (const prompt of featuredPrompts) {
        try {
          const isInQueue = await isFeaturedPromptInGroupQueue(currentGroupId, prompt.id)
          if (isInQueue) {
            inQueue.push(prompt.id)
          }
        } catch (error) {
          console.warn(`[explore-decks] Error checking if featured prompt ${prompt.id} is in queue:`, error)
        }
      }
      return inQueue
    },
    enabled: !!currentGroupId && featuredPrompts.length > 0,
  })

  // Sort active decks: voting -> active -> finished -> rejected
  // Filter to show all statuses (voting, active, finished, rejected)
  // Voting decks should always appear first for visibility
  const sortedActiveDecks = useMemo(() => {
    if (!activeDecks || activeDecks.length === 0) return []
    
    // Normalize status to lowercase for comparison
    const normalizeStatus = (status: string) => (status || "").toLowerCase().trim()
    
    // Define priority order: voting first, then active, then finished, then rejected
    const order: Record<string, number> = { 
      voting: 0, 
      active: 1, 
      finished: 2, 
      rejected: 3 
    }
    
    // Create a copy and sort it
    const sorted = [...activeDecks].sort((a, b) => {
      const aStatus = normalizeStatus(a.status)
      const bStatus = normalizeStatus(b.status)
      
      const aOrder = order[aStatus] ?? 99
      const bOrder = order[bStatus] ?? 99
      
      // Primary sort: by status priority (voting=0 should come before active=1)
      const statusComparison = aOrder - bOrder
      if (statusComparison !== 0) {
        return statusComparison
      }
      
      // Secondary sort: within voting decks, sort by total votes (most votes first)
      if (aStatus === "voting" && bStatus === "voting") {
        const aVotes = voteStatuses[a.deck_id] 
          ? (voteStatuses[a.deck_id].yes_votes + voteStatuses[a.deck_id].no_votes)
          : 0
        const bVotes = voteStatuses[b.deck_id]
          ? (voteStatuses[b.deck_id].yes_votes + voteStatuses[b.deck_id].no_votes)
          : 0
        return bVotes - aVotes // Descending order (most votes first)
      }
      
      // For same status (non-voting), maintain original order
      return 0
    })
    
    // Debug logging in development
    if (__DEV__) {
      console.log("[explore-decks] Original decks:", activeDecks.map(d => ({ 
        name: d.deck?.name, 
        status: d.status,
        normalized: normalizeStatus(d.status),
        order: order[normalizeStatus(d.status)] ?? 99
      })))
      console.log("[explore-decks] Sorted decks:", sorted.map(d => ({ 
        name: d.deck?.name, 
        status: d.status,
        normalized: normalizeStatus(d.status),
        order: order[normalizeStatus(d.status)] ?? 99
      })))
    }
    
    return sorted
  }, [activeDecks, voteStatuses])

  // Calculate header height
  // Header structure:
  // - insets.top + spacing.md (paddingTop from Animated.View inline style)
  // - spacing.sm (paddingTop from styles.header)
  // - 32px (title fontSize)
  // - spacing.md (title marginBottom)
  // - ~50px (subtitle height - estimated for 2-3 lines with lineHeight ~20px)
  // - spacing.md (subtitle marginBottom)
  // - spacing.md (tabContainer marginTop)
  // - ~40px (tabContainer height - estimated)
  // - spacing.md (tabContainer marginBottom)
  // - spacing.lg (header paddingBottom)
  // - spacing.lg (extra padding after header divider)
  const headerHeight = useMemo(() => {
    return insets.top + spacing.md + spacing.sm + 32 + spacing.md + 50 + spacing.md + 40 + spacing.md + spacing.lg + spacing.lg
  }, [insets.top])

  useEffect(() => {
    // Set initial padding to header height
    const initialPadding = headerHeight
    contentPaddingTop.setValue(initialPadding)
  }, [headerHeight])

  const scrollViewRef = useRef<ScrollView>(null)
  const featuredCarouselRef = useRef<ScrollView>(null)

  // Reset animated values and scroll position when screen comes into focus (fixes content cut off when navigating back)
  useFocusEffect(
    useCallback(() => {
      // Set flag to prevent scroll handler from interfering
      isResettingScroll.current = true
      
      // Reset all animated values to initial state
      Animated.parallel([
        Animated.timing(headerTranslateY, {
          toValue: 0,
          duration: 0, // Instant reset
          useNativeDriver: true,
        }),
        Animated.timing(contentPaddingTop, {
          toValue: headerHeight,
          duration: 0, // Instant reset
          useNativeDriver: false,
        }),
        Animated.timing(tabBarOpacity, {
          toValue: 1,
          duration: 0, // Instant reset
          useNativeDriver: true,
        }),
      ]).start(() => {
        // After animation completes, ensure padding is set correctly
        contentPaddingTop.setValue(headerHeight)
      })
      
      // Reset scroll tracking
      lastScrollY.current = 0
      scrollY.setValue(0)
      
      // Reset scroll position to top
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false })
        // Ensure padding is correct after scroll
        contentPaddingTop.setValue(headerHeight)
        // Re-enable scroll handler after a brief delay
        setTimeout(() => {
          isResettingScroll.current = false
        }, 100)
      }, 0)
    }, [headerHeight, scrollY, contentPaddingTop])
  )

  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: false, // Need false for paddingTop animation
    listener: (event: any) => {
      // Skip scroll handling during reset
      if (isResettingScroll.current) return
      
      const currentScrollY = event.nativeEvent.contentOffset.y
      const scrollDiff = currentScrollY - lastScrollY.current
      lastScrollY.current = currentScrollY

      if (scrollDiff > 5 && currentScrollY > 50) {
        // Scrolling down - hide header and reduce padding, fade tab bar
        Animated.parallel([
          Animated.timing(headerTranslateY, {
            toValue: -(headerHeight + 100),
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(contentPaddingTop, {
            toValue: spacing.md,
            duration: 300,
            useNativeDriver: false,
          }),
          Animated.timing(tabBarOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start()
      } else if (scrollDiff < -5 || currentScrollY <= 0) {
        // Scrolling up or at top - show header and restore padding, show tab bar
        Animated.parallel([
          Animated.timing(headerTranslateY, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(contentPaddingTop, {
            toValue: headerHeight,
            duration: 300,
            useNativeDriver: false,
          }),
          Animated.timing(tabBarOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => {
          // Ensure padding is set correctly after animation completes
          if (currentScrollY <= 0) {
            contentPaddingTop.setValue(headerHeight)
          }
        })
      }
    },
  })

  // Swipe handler function
  // Use useCallback to ensure we always have the latest state values
  const handleSwipe = useCallback(async (direction: "yes" | "no") => {
    // Use refs to get the latest values (avoids stale closure)
    const questionIndex = currentQuestionIndexRef.current
    const groupId = currentGroupIdRef.current
    const user = userIdRef.current
    const questions = swipeableQuestionsData

    console.log("[explore-decks] handleSwipe called:", {
      direction,
      currentGroupId: groupId,
      userId: user,
      currentQuestionIndex: questionIndex,
      questionsLength: questions.length,
    })

    if (!groupId || !user) {
      console.warn("[explore-decks] Missing currentGroupId or userId", {
        groupId,
        user,
        currentGroupIdState: currentGroupId,
        userIdState: userId,
      })
      Alert.alert("Error", "Please try again. Missing group or user information.")
      return
    }

    if (questionIndex >= questions.length) {
      console.warn("[explore-decks] Question index out of bounds", { questionIndex, questionsLength: questions.length })
      return
    }

    const currentQuestion = questions[questionIndex]
    if (!currentQuestion) {
      console.warn("[explore-decks] No current question found")
      return
    }

    console.log("[explore-decks] Recording swipe for question:", currentQuestion.id)

    // If swiped yes, check if pan responder already updated (to avoid double counting)
    // Pan responder updates optimistically, so we should use that value, not increment again
    if (direction === "yes") {
      // Get the current count from ref (which pan responder updates) and cache
      const refCount = yesSwipeCountRef.current
      const cachedCount = queryClient.getQueryData<number>(["yesSwipeCount", groupId, user]) || 0
      
      // If refCount is higher than cached count, pan responder already updated - use refCount
      // Otherwise, increment from cached count (button tap path)
      const newCount = refCount > cachedCount ? refCount : cachedCount + 1
      
      console.log("[explore-decks] handleSwipe progress check:", { refCount, cachedCount, newCount, "fromPanResponder": refCount > cachedCount })
      
      // Ensure ref and state are in sync (but don't double-update if pan responder already did it)
      if (refCount !== newCount) {
        yesSwipeCountRef.current = newCount
      }
      setLocalYesSwipeCount(newCount)
      queryClient.setQueryData(["yesSwipeCount", groupId, user], newCount)
      
      // Show modal if reached exactly 15 likes (only once)
      if (newCount === 15 && !hasShownCompletionModal) {
        // Delay showing modal slightly to let card animation complete
        setTimeout(() => {
          console.log("[explore-decks] handleSwipe: Showing completion modal, newCount:", newCount)
          setProgressCompleteModalVisible(true)
          setHasShownCompletionModal(true) // Mark as shown so it doesn't show again
        }, 400)
      }
      
      // Update animated progress bar (only if pan responder didn't already update it)
      // Pan responder updates it immediately, so this is mainly for button taps
      if (refCount <= cachedCount) {
        const percentage = Math.min((newCount / 15) * 100, 100)
        console.log("[explore-decks] handleSwipe: Updating progress bar animated value:", { newCount, percentage })
        Animated.timing(progressBarWidth, {
          toValue: percentage,
          duration: 200,
          useNativeDriver: false,
        }).start((finished) => {
          console.log("[explore-decks] handleSwipe: Progress bar animation finished:", finished)
        })
      }
    }

    try {
      // Record swipe
      const result = await recordSwipe(groupId, currentQuestion.id, user, direction)
      console.log("[explore-decks] Swipe recorded successfully:", result)
      
      // Refetch to ensure accuracy (in background, but don't overwrite optimistic update immediately)
      if (direction === "yes") {
        setTimeout(() => {
          queryClient.refetchQueries({ queryKey: ["yesSwipeCount", groupId, user] })
        }, 500)
      }

      // Animate card off screen
      const screenWidth = SCREEN_WIDTH
      const targetX = direction === "yes" ? screenWidth : -screenWidth

      Animated.parallel([
        Animated.timing(cardPosition, {
          toValue: { x: targetX, y: 0 },
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(async () => {
        console.log("[explore-decks] Animation completed, moving to next question")
        
        // Check for match
        if (result.matched && result.matchedWithUsers) {
          // Hide match modal - don't show it
          // setMatchInfo({ matchedWithUsers: result.matchedWithUsers })
          // setMatchModalVisible(true)
        }

        // Get the latest question index from ref (most up-to-date)
        const latestIndex = currentQuestionIndexRef.current
        const latestQuestions = swipeableQuestionsData
        
        // Move to next question
        if (latestIndex + 1 < latestQuestions.length) {
          const nextIndex = latestIndex + 1
          console.log("[explore-decks] Moving to next question index:", nextIndex)
          currentQuestionIndexRef.current = nextIndex
          setCurrentQuestionIndex(nextIndex)
          // Reset card position for next question
          cardPosition.setValue({ x: 0, y: 0 })
          cardRotation.setValue(0)
          cardOpacity.setValue(1)
        } else {
          // No more questions - refetch
          console.log("[explore-decks] No more questions, refetching")
          await refetchSwipeableQuestions()
          // Reset index after refetch
          currentQuestionIndexRef.current = 0
          setCurrentQuestionIndex(0)
          cardPosition.setValue({ x: 0, y: 0 })
          cardRotation.setValue(0)
          cardOpacity.setValue(1)
        }

        // Refetch participants to update avatars
        queryClient.invalidateQueries({ queryKey: ["swipingParticipants", groupId, user] })
      })
    } catch (error) {
      console.error("[explore-decks] Error recording swipe:", error)
      // Reset card position on error
      Animated.parallel([
        Animated.spring(cardPosition, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: true,
        }),
        Animated.spring(cardRotation, {
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
      Alert.alert("Error", "Failed to record your swipe. Please try again.")
      // On error, revert optimistic update if it was a yes swipe
      if (direction === "yes") {
        setLocalYesSwipeCount((prevCount) => {
          if (prevCount !== null && prevCount > 0) {
            return prevCount - 1
          }
          return prevCount
        })
      }
    }
  }, [currentGroupId, userId, swipeableQuestionsData, refetchSwipeableQuestions, queryClient, yesSwipeCount])

  // Keep handleSwipe ref in sync so pan responder always uses latest version
  useEffect(() => {
    handleSwipeRef.current = handleSwipe
    setLocalYesSwipeCountRef.current = setLocalYesSwipeCount
  }, [handleSwipe, setLocalYesSwipeCount])

  // PanResponder for swipe gestures - recreate when handleSwipe changes
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => {
          // Only allow swipe if we have necessary values
          return !!(currentGroupIdRef.current && userIdRef.current)
        },
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // Only allow if we have necessary values
          if (!currentGroupIdRef.current || !userIdRef.current) return false
          // Prioritize horizontal swipes over vertical scrolling
          // If horizontal movement is significant, claim the gesture
          return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10
        },
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          // Only allow if we have necessary values
          if (!currentGroupIdRef.current || !userIdRef.current) return false
          // Capture horizontal gestures to prevent ScrollView from handling them
          return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10
        },
        onPanResponderGrant: () => {
          // When gesture starts, disable ScrollView scrolling
          setIsSwiping(true)
        },
        onPanResponderMove: (_, gestureState) => {
          cardPosition.setValue({ x: gestureState.dx, y: gestureState.dy })
          // Add rotation based on horizontal movement
          const rotation = gestureState.dx / 20
          cardRotation.setValue(rotation)
        },
        onPanResponderRelease: (_, gestureState) => {
          setIsSwiping(false)
          const SWIPE_THRESHOLD = 50 // Reduced threshold for easier swiping
          const { dx } = gestureState

          // Double-check if we have the necessary values before processing swipe
          const groupId = currentGroupIdRef.current
          const userId = userIdRef.current
          
          if (!groupId || !userId) {
            console.warn("[explore-decks] Cannot process swipe - missing groupId or userId", {
              groupId,
              userId,
            })
            // Return to center immediately
            Animated.parallel([
              Animated.spring(cardPosition, {
                toValue: { x: 0, y: 0 },
                useNativeDriver: true,
              }),
              Animated.spring(cardRotation, {
                toValue: 0,
                useNativeDriver: true,
              }),
            ]).start()
            return
          }

          if (Math.abs(dx) > SWIPE_THRESHOLD) {
            // Swipe detected - call handleSwipe directly (EXACTLY like the button does)
            const direction = dx > 0 ? "yes" : "no"
            console.log("[explore-decks] Swipe detected:", direction, "dx:", dx, "SWIPE_THRESHOLD:", SWIPE_THRESHOLD, "abs(dx):", Math.abs(dx))
            
            // FOR YES SWIPES: Update progress bar IMMEDIATELY before calling handleSwipe
            // This ensures it updates even if handleSwipe has issues
            console.log("[explore-decks] Checking direction, direction === 'yes':", direction === "yes", "direction:", direction, "dx > 0:", dx > 0)
            if (direction === "yes") {
              console.log("[explore-decks] YES SWIPE DETECTED! Entering yes swipe block")
              const currentCount = yesSwipeCountRef.current || 0
              const newCount = currentCount + 1
              const percentage = Math.min((newCount / 15) * 100, 100)
              
              console.log("[explore-decks] SWIPE YES: Updating progress bar immediately:", { currentCount, newCount, percentage, progressBarWidthRefExists: !!progressBarWidthRef.current })
              
              // Update ref and state (but NOT query cache - let handleSwipe update cache to avoid double counting)
              yesSwipeCountRef.current = newCount
              setLocalYesSwipeCount(newCount)
              // Don't update query cache here - handleSwipe will do it and can detect if we already updated
              
              // Update animated progress bar DIRECTLY using ref - this is the critical update
              const animatedValue = progressBarWidthRef.current
              console.log("[explore-decks] SWIPE YES: About to animate, animatedValue exists:", !!animatedValue, "percentage:", percentage)
              Animated.timing(animatedValue, {
                toValue: percentage,
                duration: 200,
                useNativeDriver: false,
              }).start((finished) => {
                console.log("[explore-decks] SWIPE YES: Progress bar animation finished:", finished)
              })
              
              // Show modal if reached exactly 15 likes (only once)
              if (newCount === 15 && !hasShownCompletionModal) {
                setTimeout(() => {
                  setProgressCompleteModalVisible(true)
                  setHasShownCompletionModal(true) // Mark as shown so it doesn't show again
                }, 400)
              }
            }
            
            // Now call handleSwipe for API call and card animation
            const latestHandleSwipe = handleSwipeRef.current || handleSwipe
            if (!latestHandleSwipe) {
              console.error("[explore-decks] handleSwipeRef.current is null and handleSwipe is not available!")
              return
            }
            
            console.log("[explore-decks] Calling handleSwipe from swipe, direction:", direction)
            latestHandleSwipe(direction).catch((error) => {
              console.error("[explore-decks] Error in handleSwipe:", error)
              setIsSwiping(false)
              // Reset card position on error
              Animated.parallel([
                Animated.spring(cardPosition, {
                  toValue: { x: 0, y: 0 },
                  useNativeDriver: true,
                }),
                Animated.spring(cardRotation, {
                  toValue: 0,
                  useNativeDriver: true,
                }),
                Animated.timing(cardOpacity, {
                  toValue: 1,
                  duration: 200,
                  useNativeDriver: true,
                }),
              ]).start()
            })
          } else {
            // Return to center
            Animated.parallel([
              Animated.spring(cardPosition, {
                toValue: { x: 0, y: 0 },
                useNativeDriver: true,
              }),
              Animated.spring(cardRotation, {
                toValue: 0,
                useNativeDriver: true,
              }),
            ]).start()
          }
        },
        onPanResponderTerminate: () => {
          setIsSwiping(false)
          // If gesture is terminated, return to center
          Animated.parallel([
            Animated.spring(cardPosition, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: true,
            }),
            Animated.spring(cardRotation, {
              toValue: 0,
              useNativeDriver: true,
            }),
          ]).start()
        },
      }),
    [handleSwipe, queryClient, yesSwipeCount]
  )

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme2Colors.beige,
    },
    header: {
      paddingTop: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.lg, // More padding at bottom
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      borderBottomWidth: 0, // Remove border
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: theme2Colors.beige,
      zIndex: 10,
    },
    headerLeft: {
      flex: 1,
    },
    headerRight: {
      justifyContent: "flex-end",
      alignItems: "center", // Center align icon with title
    },
    title: {
      fontFamily: "PMGothicLudington-Text115",
      fontSize: 32,
      color: theme2Colors.text,
      marginTop: spacing.sm, // More padding above title
      marginBottom: spacing.md, // More padding below title
    },
    subtitle: {
      ...typography.body,
      color: theme2Colors.textSecondary,
      marginBottom: spacing.md, // Reduced padding for tabs
      textAlign: "left", // Align left like title
    },
    headerParticipantsContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.md,
    },
    headerParticipantsAvatars: {
      flexDirection: "row",
      marginRight: spacing.sm,
    },
    headerParticipantAvatar: {
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.black,
    },
    tabContainer: {
      flexDirection: "row",
      gap: spacing.md, // Increased from spacing.xs to spacing.md for more padding between tabs
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
    tab: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme2Colors.text,
      backgroundColor: theme2Colors.beige,
    },
    tabActive: {
      backgroundColor: theme2Colors.yellow,
      borderColor: theme2Colors.yellow,
    },
    tabText: {
      ...typography.body,
      fontSize: 14,
      color: theme2Colors.text,
    },
    tabTextActive: {
      color: theme2Colors.text,
      fontWeight: "600",
    },
    helpButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme2Colors.white,
      borderWidth: 1,
      borderColor: theme2Colors.text,
      justifyContent: "center",
      alignItems: "center",
      marginTop: spacing.sm, // Match title's marginTop for alignment
    },
    content: {
      flex: 1,
      // No marginTop - header will overlay content when visible
    },
    contentContainer: {
      paddingTop: spacing.lg, // Extra padding after header divider (in addition to animated paddingTop)
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xxl * 2,
    },
    carouselSection: {
      marginBottom: spacing.xxl + spacing.lg, // More padding before Collections
    },
    carouselTitle: {
      fontFamily: "Roboto-Bold",
      fontSize: 16,
      color: theme2Colors.text,
      marginBottom: spacing.md,
      fontWeight: "700",
    },
    carousel: {
      flexDirection: "row",
    },
    carouselContent: {
      flexDirection: "row",
      alignItems: "stretch", // Stretch items to same height
    },
    deckCard: {
      width: CARD_WIDTH, // Match collection card width
      marginRight: spacing.md,
      backgroundColor: theme2Colors.cream, // Changed from white to cream
      borderRadius: 12,
      padding: spacing.md,
      alignItems: "center", // Center content
      borderWidth: 1,
      borderColor: theme2Colors.text,
      justifyContent: "flex-start", // Align content to top
    },
    deckCardContent: {
      width: "100%",
      flex: 1, // Take up available space to ensure consistent height
      justifyContent: "flex-start", // Align content to top
      minHeight: 210, // Reduced minimum height to minimize empty space
    },
    deckCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between", // Space between badge and chevron
      alignItems: "flex-start",
      marginBottom: spacing.sm,
      width: "100%",
      position: "relative",
    },
    statusBadgeContainer: {
      flex: 1,
      alignItems: "center", // Center the badge
    },
    statusBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: 12,
      borderWidth: 0, // Remove border for solid badges
    },
    statusBadgeVoting: {
      backgroundColor: theme2Colors.yellow, // Solid yellow
    },
    statusBadgeActive: {
      backgroundColor: theme2Colors.green, // Solid green
    },
    statusBadgeFinished: {
      backgroundColor: theme2Colors.red, // Solid red for expired
    },
    statusBadgeRejected: {
      backgroundColor: theme2Colors.red, // Solid red for expired
    },
    statusText: {
      ...typography.caption,
      fontSize: 10,
      color: theme2Colors.white, // White text on solid backgrounds
    },
    deckIcon: {
      width: 120,
      height: 120,
      borderRadius: 8,
      marginBottom: spacing.sm,
      backgroundColor: "transparent",
      alignSelf: "center", // Center icon
    },
    deckName: {
      ...typography.bodyBold,
      fontSize: 16,
      color: theme2Colors.text,
      marginBottom: spacing.xs,
      textAlign: "center", // Center deck name
    },
    deckStats: {
      ...typography.caption,
      fontSize: 12,
      color: theme2Colors.textSecondary,
      textAlign: "center", // Center align stats text
    },
    collectionsTitle: {
      fontFamily: "Roboto-Bold",
      fontSize: 16,
      color: theme2Colors.text, // Changed to black
      marginBottom: spacing.md,
      fontWeight: "700",
    },
    collectionsGrid: {
      flexDirection: "row",
      paddingBottom: spacing.xl,
    },
    collectionsLeftColumn: {
      width: CARD_WIDTH,
      marginRight: spacing.md,
    },
    collectionsRightColumn: {
      flex: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "flex-start",
    },
    collectionCardRight: {
      marginRight: spacing.md, // Horizontal spacing between cards (matches middle gap)
    },
    suggestDeckButton: {
      marginHorizontal: spacing.md,
      marginTop: spacing.lg,
      marginBottom: spacing.xxl * 2,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 20, // Rounded
      borderWidth: 2, // Thick outline
      borderColor: isDark ? theme2Colors.text : theme2Colors.text, // Cream outline in dark mode
      backgroundColor: isDark ? theme2Colors.beige : theme2Colors.white, // Black in dark mode
      alignItems: "center",
      justifyContent: "center",
      position: "relative", // For texture overlay
      overflow: "hidden", // Clip texture
    },
    suggestDeckButtonTexture: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: "100%",
      height: "100%",
      minWidth: "100%",
      minHeight: "100%",
      opacity: 0.3,
    },
    suggestDeckButtonText: {
      ...typography.bodyBold,
      fontSize: 16,
      color: theme2Colors.text,
    },
    collectionCard: {
      width: CARD_WIDTH,
      borderRadius: 20, // More rounded edges
      padding: spacing.md,
      marginBottom: spacing.md, // Equal spacing between cards
      flexDirection: "column",
      justifyContent: "space-between", // Space between content and footer
      borderWidth: 2, // Thicker stroke
      borderColor: theme2Colors.text,
      position: "relative", // For geometric shapes positioning
      overflow: "hidden", // Clip geometric shapes
    },
    collectionCardBevel: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 30, // Width of bevel effect (increased for more prominence)
      zIndex: 1,
      pointerEvents: "none", // Allow touches to pass through
    },
    collectionCardTexture: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.3,
      zIndex: 2,
      pointerEvents: "none", // Allow touches to pass through
    },
    collectionCardTextureImage: {
      width: "100%",
      height: "100%",
      minWidth: "100%",
      minHeight: "100%",
    },
    collectionIcon: {
      width: 70,
      height: 115,
      borderRadius: 8,
      marginBottom: spacing.sm,
      backgroundColor: colors.gray[700],
      alignSelf: "center", // Center the icon
    },
    collectionTextContainer: {
      alignItems: "flex-start", // Left align content
      flexShrink: 0, // Don't shrink
      paddingTop: spacing.md, // More padding between top of card and icon
    },
    collectionNameIcon: {
      // Width and height are set dynamically via getCollectionIconDimensions()
      marginBottom: spacing.md, // Increased padding below icon
    },
    collectionName: {
      ...typography.bodyBold,
      fontSize: 18,
      marginBottom: spacing.xs,
      textAlign: "left", // Left align text
      minHeight: 22, // Fixed height for name (1 line)
    },
    collectionDescription: {
      ...typography.caption,
      fontSize: 12,
      textAlign: "left", // Left align text
      lineHeight: 16, // Fixed line height
      height: 32, // Fixed height for exactly 2 lines (16 * 2)
      overflow: "hidden", // Hide overflow
    },
    collectionFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: spacing.md, // Consistent spacing above footer
      flexShrink: 0, // Don't shrink
    },
    collectionDecksCount: {
      ...typography.caption,
      fontSize: 12,
      flex: 1, // Take up available space
    },
    // Modal styles
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: theme2Colors.beige,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: spacing.lg,
      paddingBottom: insets.bottom + spacing.lg,
      position: "relative",
    },
    modalCloseButton: {
      position: "absolute",
      top: spacing.lg,
      right: spacing.lg,
      width: 32,
      height: 32,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 10,
    },
    modalTitle: {
      fontFamily: "PMGothicLudington-Text115",
      fontSize: 24,
      color: theme2Colors.text,
      marginBottom: spacing.md,
    },
    modalText: {
      ...typography.body,
      color: theme2Colors.textSecondary,
      lineHeight: 24,
      marginBottom: spacing.lg,
    },
    modalButton: {
      marginTop: spacing.md,
    },
    modalButtonRow: {
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.md,
    },
    modalButtonSecondary: {
      flex: 1,
      backgroundColor: theme2Colors.white,
      borderWidth: 1,
      borderColor: theme2Colors.text,
      paddingVertical: spacing.md,
      borderRadius: 20,
      alignItems: "center",
    },
    modalButtonPrimary: {
      backgroundColor: theme2Colors.blue,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
    },
    modalButtonSecondaryText: {
      ...typography.bodyBold,
      color: theme2Colors.text,
    },
    modalButtonPrimaryText: {
      ...typography.bodyBold,
      color: theme2Colors.white,
    },
    modalCloseButton: {
      position: "absolute",
      top: spacing.lg,
      right: spacing.lg,
      width: 32,
      height: 32,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 10,
    },
    // Featured Questions Styles
    featuredSection: {
      marginBottom: spacing.xxl + spacing.lg,
      minHeight: 400, // Match swipeContainer minHeight for consistent empty state positioning
    },
    featuredTitle: {
      fontFamily: "Roboto-Bold",
      fontSize: 24,
      color: theme2Colors.text,
      marginBottom: spacing.xs,
      textAlign: "center",
      fontWeight: "700",
    },
    featuredSubtitle: {
      ...typography.body,
      fontSize: 14,
      color: theme2Colors.textSecondary,
      marginBottom: spacing.md,
      textAlign: "center",
    },
    featuredStatus: {
      ...typography.body,
      fontSize: 14,
      color: theme2Colors.text,
      marginBottom: spacing.lg,
      textAlign: "center",
    },
    featuredCarousel: {
      marginBottom: spacing.md,
    },
    featuredCarouselContent: {
      paddingHorizontal: spacing.md,
    },
    featuredCard: {
      width: SCREEN_WIDTH - spacing.md * 2, // Card width matches screen minus padding
      backgroundColor: theme2Colors.cream, // Cream color like prompt cards
      borderRadius: 20, // More rounded like prompt cards
      padding: spacing.lg,
      marginRight: spacing.md, // Margin between cards
      borderWidth: 2,
      borderColor: theme2Colors.textSecondary, // Gray outline like prompt cards
      minHeight: 105, // Reduced by 30% from 150 (150 * 0.7 = 105)
      position: "relative", // For texture overlay
      overflow: "hidden", // Clip texture
      justifyContent: "center", // Center content vertically
    },
    featuredCardTexture: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.4,
      zIndex: 1,
      pointerEvents: "none",
      borderRadius: 20, // Match card border radius
      overflow: "hidden", // Ensure texture respects border radius
    },
    featuredCardTextureImage: {
      position: "absolute",
      top: -10, // Extend beyond container to ensure full coverage
      left: -10, // Extend beyond container to ensure full coverage
      right: -10, // Extend beyond container to ensure full coverage
      bottom: -10, // Extend beyond container to ensure full coverage
      width: SCREEN_WIDTH, // Use screen width to ensure full coverage
      height: "120%", // Slightly larger than container
      minWidth: SCREEN_WIDTH,
      minHeight: "120%",
    },
    featuredCardContent: {
      position: "relative",
      zIndex: 2, // Above texture
      flex: 1,
      justifyContent: "center", // Center content vertically
    },
    featuredCardQuestion: {
      fontFamily: "PMGothicLudington-Text115", // Question font
      fontSize: 22,
      color: theme2Colors.text,
      marginBottom: spacing.md,
      lineHeight: 28,
    },
    featuredCardCTA: {
      backgroundColor: theme2Colors.blue,
      borderRadius: 25,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      alignItems: "center",
      justifyContent: "center",
      marginTop: spacing.sm,
    },
    featuredCardCTAText: {
      ...typography.bodyBold,
      fontSize: 16,
      color: theme2Colors.white,
    },
    featuredCardDescription: {
      ...typography.body,
      fontSize: 14,
      color: theme2Colors.textSecondary,
      marginBottom: spacing.md,
      lineHeight: 20,
    },
    featuredCardBy: {
      ...typography.caption,
      fontSize: 12,
      color: theme2Colors.textSecondary,
      fontStyle: "italic",
      marginTop: "auto",
    },
    featuredTag: {
      alignSelf: "flex-start",
      backgroundColor: theme2Colors.textSecondary,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: 12,
      marginTop: spacing.sm,
    },
    featuredTagText: {
      ...typography.caption,
      fontSize: 11,
      color: theme2Colors.white,
    },
    paginationDots: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: spacing.lg,
      gap: spacing.xs,
    },
    paginationDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme2Colors.textSecondary,
    },
    paginationDotActive: {
      backgroundColor: theme2Colors.text,
    },
    askQuestionButton: {
      backgroundColor: theme2Colors.blue,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 20,
      alignItems: "center",
      marginBottom: spacing.md,
      marginHorizontal: spacing.md,
    },
    askQuestionButtonDisabled: {
      backgroundColor: theme2Colors.textSecondary,
      opacity: 0.5,
    },
    askQuestionButtonText: {
      ...typography.bodyBold,
      fontSize: 16,
      color: theme2Colors.white,
    },
    contributeLink: {
      alignItems: "center",
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
    },
    contributeLinkText: {
      ...typography.body,
      fontSize: 14,
      color: theme2Colors.textSecondary,
      textDecorationLine: "underline",
    },
    swipeContainer: {
      minHeight: Dimensions.get("window").height - 300, // Ensure enough space
      justifyContent: "flex-start",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md, // Reduced from spacing.xl to bring progress bar closer to header
      paddingBottom: spacing.xxl * 2, // Increased to move buttons away from app nav
    },
    swipePlaceholder: {
      ...typography.body,
      color: colors.gray[400],
      textAlign: "center",
    },
    swipeEmptyState: {
      minHeight: 400, // Ensure consistent minimum height
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: spacing.xxl * 2,
      paddingHorizontal: spacing.md,
    },
    emptyBlob: {
      width: 120,
      height: 120,
      borderRadius: 60, // Imperfect circle - adjust for blob effect
      backgroundColor: theme2Colors.cream,
      marginBottom: spacing.lg,
      // Create imperfect blob shape with varying border radius
      borderTopLeftRadius: 50,
      borderTopRightRadius: 70,
      borderBottomLeftRadius: 70,
      borderBottomRightRadius: 50,
    },
    swipeEmptyText: {
      fontFamily: "Roboto-Regular", // Changed to Roboto
      fontSize: 14,
      color: theme2Colors.text,
      marginBottom: spacing.xs,
      textAlign: "center",
    },
    swipeEmptySubtext: {
      fontFamily: "Roboto-Regular", // Changed to Roboto
      fontSize: 14,
      color: theme2Colors.textSecondary,
      textAlign: "center",
    },
    participantsContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.lg,
      paddingHorizontal: spacing.md,
    },
    participantsAvatars: {
      flexDirection: "row",
      marginRight: spacing.sm,
    },
    participantAvatar: {
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.black,
    },
    participantsText: {
      ...typography.body,
      fontSize: 14,
      color: theme2Colors.textSecondary,
      flex: 1,
    },
    swipeButtons: {
      flexDirection: "row",
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      marginTop: spacing.lg, // Reduced from spacing.xl to bring buttons closer to card
      marginBottom: spacing.xl, // Increased from spacing.lg to add more space above app nav
      justifyContent: "center",
      alignItems: "center",
    },
    swipeButtonIcon: {
      width: 80,
      height: 80,
    },
    swipeCard: {
      width: SCREEN_WIDTH - spacing.md * 2,
      height: 250, // Reduced height for swipe card
      backgroundColor: theme2Colors.cream, // Cream color for card consistency
      borderRadius: 20, // More rounded
      padding: spacing.lg,
      borderWidth: 2,
      borderColor: theme2Colors.textSecondary,
      justifyContent: "center",
      alignItems: "flex-start", // Left align content
      alignSelf: "center",
      position: "relative", // For texture overlay
      overflow: "hidden", // Clip texture
    },
    swipeCardTexture: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 20, // Match card borderRadius
      opacity: 0.3,
      zIndex: 1,
      pointerEvents: "none", // Allow touches to pass through
      overflow: "hidden", // Ensure texture respects borderRadius
    },
    swipeCardTextureImage: {
      width: "100%",
      height: "100%",
      minWidth: "100%",
      minHeight: "100%",
    },
    swipeCardQuestion: {
      fontFamily: "PMGothicLudington-Text115",
      fontSize: 24,
      color: theme2Colors.text,
      textAlign: "left", // Left align
      lineHeight: 32,
      position: "relative",
      zIndex: 2, // Above texture
    },
    progressBarContainer: {
      width: "100%",
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md, // Reduced from spacing.lg to bring card closer to progress bar
    },
    progressBarBackground: {
      width: "100%",
      height: 4,
      backgroundColor: theme2Colors.white, // White for incomplete progress
      borderRadius: 2,
      overflow: "visible", // Changed to visible to allow star icon to show
      position: "relative",
    },
    progressBarFill: {
      height: "100%",
      backgroundColor: "#2D6F4A", // Green when full
      borderRadius: 2,
    },
    progressStar: {
      position: "absolute",
      top: -10, // Center vertically on the progress bar (4px bar + offset for 24px icon)
      width: 24,
      height: 24,
      marginLeft: -12, // Center the star on the progress line
      alignItems: "center",
      justifyContent: "center",
    },
    progressStarImage: {
      width: 24,
      height: 24,
    },
  }), [colors, isDark, theme2Colors])

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          { paddingTop: insets.top + spacing.md },
          {
            transform: [{ translateY: headerTranslateY }],
          },
        ]}
      >
        <View style={styles.headerLeft}>
          {/* Tab Navigation - moved above title */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === "decks" && styles.tabActive]}
              onPress={() => {
                setActiveTab("decks")
                // Refetch decks-related queries when switching to decks tab
                if (currentGroupId) {
                  queryClient.invalidateQueries({ queryKey: ["groupActiveDecks", currentGroupId] })
                  queryClient.invalidateQueries({ queryKey: ["collectionDeckCounts"] })
                }
              }}
            >
              <Text style={[styles.tabText, activeTab === "decks" && styles.tabTextActive]}>Decks</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "featured" && styles.tabActive]}
              onPress={() => {
                setActiveTab("featured")
                // Invalidate and refetch featured prompts when switching to featured tab
                // Use exact: false to invalidate all queries with this key prefix
                queryClient.invalidateQueries({ queryKey: ["featuredPrompts"], exact: false })
                refetchFeaturedPrompts()
              }}
            >
              <Text style={[styles.tabText, activeTab === "featured" && styles.tabTextActive]}>Featured</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "matches" && styles.tabActive]}
              onPress={() => {
                setActiveTab("matches")
                // Refetch swipe queries when switching to swipe tab
                if (currentGroupId && userId) {
                  queryClient.invalidateQueries({ queryKey: ["swipeableQuestions", currentGroupId, userId] })
                  queryClient.invalidateQueries({ queryKey: ["swipingParticipants", currentGroupId, userId] })
                  queryClient.invalidateQueries({ queryKey: ["yesSwipeCount", currentGroupId, userId] })
                  queryClient.refetchQueries({ queryKey: ["swipeableQuestions", currentGroupId, userId] })
                  queryClient.refetchQueries({ queryKey: ["yesSwipeCount", currentGroupId, userId] })
                }
              }}
            >
              <Text style={[styles.tabText, activeTab === "matches" && styles.tabTextActive]}>Swipe</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.title}>
            {activeTab === "decks" && "Add a deck"}
            {activeTab === "featured" && "This week only"}
            {activeTab === "matches" && "Like some questions"}
          </Text>
          
          {/* Show subtitle */}
          <Text style={styles.subtitle}>
            {activeTab === "decks" && "Explore theme of questions you can vote on for you all to answer."}
            {activeTab === "featured" && "See a question you like? Ask it to everyone. Max 2 a week."}
            {activeTab === "matches" && "Help us understand your vibe by swiping on some example questions."}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => setHelpModalVisible(true)}
          >
            <FontAwesome name="question-circle" size={18} color={theme2Colors.text} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Content */}
      <Animated.ScrollView
        ref={scrollViewRef}
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: contentPaddingTop,
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        scrollEnabled={activeTab !== "matches"}
      >
        {/* Decks Tab Content */}
        {activeTab === "decks" && (
          <>
            {/* Your decks carousel */}
            {sortedActiveDecks.length > 0 && (
          <View style={styles.carouselSection}>
            <Text style={styles.carouselTitle}>Your decks</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              style={styles.carousel}
              contentContainerStyle={styles.carouselContent}
            >
              {sortedActiveDecks.map((deck) => {
                const questionsLeft = deckQuestionsLeft[deck.deck_id] || 0
                const isFinished = deck.status === "finished" || questionsLeft === 0
                
                return (
                  <TouchableOpacity
                    key={deck.id}
                    style={styles.deckCard}
                    onPress={() => {
                      if (deck.status === "voting") {
                        router.push(`/(main)/deck-vote?deckId=${deck.deck_id}&groupId=${currentGroupId}`)
                      } else {
                        router.push(`/(main)/deck-detail?deckId=${deck.deck_id}&groupId=${currentGroupId}`)
                      }
                    }}
                  >
                    <View style={styles.deckCardContent}>
                      <View style={styles.deckCardHeader}>
                        <View style={styles.statusBadgeContainer}>
                          <View
                            style={[
                              styles.statusBadge,
                              deck.status === "voting" && styles.statusBadgeVoting,
                              deck.status === "active" && styles.statusBadgeActive,
                              deck.status === "finished" && styles.statusBadgeFinished,
                              deck.status === "rejected" && styles.statusBadgeRejected,
                            ]}
                          >
                            <Text style={styles.statusText}>
                              {deck.status === "voting" && "Voting"}
                              {deck.status === "active" && "Live"}
                              {deck.status === "finished" && "Deck finished"}
                              {deck.status === "rejected" && "Verdict: Not interested"}
                            </Text>
                          </View>
                        </View>
                        <FontAwesome 
                          name="chevron-right" 
                          size={12} 
                          color={colors.gray[400]}
                          style={{ position: "absolute", top: 0, right: 0 }}
                        />
                      </View>
                      
                      <Image
                        source={getDeckImageSource(deck.deck?.name, deck.deck?.icon_url)}
                        style={styles.deckIcon}
                        resizeMode="cover"
                      />
                      
                      <Text style={styles.deckName}>{deck.deck?.name || "Unknown Deck"}</Text>
                      
                      {/* Stats - only show for voting (with vote counts) or active (with questions left) or finished */}
                      {deck.status === "voting" && voteStatuses[deck.deck_id] && (
                        <Text style={styles.deckStats}>
                          {voteStatuses[deck.deck_id].yes_votes} Yes • {voteStatuses[deck.deck_id].no_votes} No
                        </Text>
                      )}
                      {deck.status === "active" && !isFinished && (
                        <Text style={styles.deckStats}>
                          {questionsLeft} questions left
                        </Text>
                      )}
                      {deck.status === "finished" && (
                        <Text style={styles.deckStats}>All questions answered</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>
        )}

            {/* Collections grid */}
            <Text style={styles.collectionsTitle}>What interests you?</Text>
            <View style={styles.collectionsGrid}>
              {/* Left Column - Deeper and Nostalgia (double height) */}
              <View style={styles.collectionsLeftColumn}>
                {collections
                  .filter((collection) => isLeftColumnCollection(collection.name))
                  .map((collection) => {
                    const cardColors = getCollectionCardColors(collection.name, theme2Colors)
                    const cardHeight = getCollectionCardHeight(collection.name)
                    return (
                      <TouchableOpacity
                        key={collection.id}
                        style={[
                          styles.collectionCard, 
                          { 
                            backgroundColor: cardColors.backgroundColor,
                            height: cardHeight,
                          }
                        ]}
                        onPress={() => router.push(`/(main)/collection-detail?collectionId=${collection.id}&groupId=${currentGroupId}`)}
                      >
                        {/* Texture overlay */}
                        <View style={styles.collectionCardTexture}>
                          <Image 
                            source={require("../../assets/images/texture.png")} 
                            style={styles.collectionCardTextureImage}
                            resizeMode="cover"
                          />
                        </View>
                        
                        {/* Bevel effect - gray opacity on left side */}
                        <LinearGradient
                          colors={["rgba(0, 0, 0, 0.3)", "rgba(0, 0, 0, 0.1)", "rgba(0, 0, 0, 0)"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.collectionCardBevel}
                        />
                        
                        {/* Geometric shapes background */}
                        {renderCollectionGeometricShapes(collection.name)}
                        
                        <View style={styles.collectionTextContainer}>
                          <Text style={[styles.collectionName, { color: cardColors.textColor }]}>{collection.name}</Text>
                          <Text style={[styles.collectionDescription, { color: cardColors.descriptionColor }]} numberOfLines={2}>
                            {collection.description || ""}
                          </Text>
                        </View>
                        <View style={styles.collectionFooter}>
                          <Text style={[styles.collectionDecksCount, { color: cardColors.textColor }]}>
                            {collectionDeckCounts[collection.id] || 0} unused {collectionDeckCounts[collection.id] === 1 ? 'deck' : 'decks'}
                          </Text>
                          <FontAwesome
                            name="chevron-right"
                            size={12}
                            color={cardColors.textColor}
                          />
                        </View>
                      </TouchableOpacity>
                    )
                  })}
              </View>
              
              {/* Right Column - All other collections */}
              <View style={styles.collectionsRightColumn}>
                {collections
                  .filter((collection) => !isLeftColumnCollection(collection.name))
                  .map((collection) => {
                    const cardColors = getCollectionCardColors(collection.name, theme2Colors)
                    const cardHeight = getCollectionCardHeight(collection.name)
                    return (
                      <TouchableOpacity
                        key={collection.id}
                        style={[
                          styles.collectionCard,
                          styles.collectionCardRight,
                          { 
                            backgroundColor: cardColors.backgroundColor,
                            height: cardHeight,
                          }
                        ]}
                        onPress={() => router.push(`/(main)/collection-detail?collectionId=${collection.id}&groupId=${currentGroupId}`)}
                      >
                        {/* Texture overlay */}
                        <View style={styles.collectionCardTexture}>
                          <Image 
                            source={require("../../assets/images/texture.png")} 
                            style={styles.collectionCardTextureImage}
                            resizeMode="cover"
                          />
                        </View>
                        
                        {/* Bevel effect - gray opacity on left side */}
                        <LinearGradient
                          colors={["rgba(0, 0, 0, 0.3)", "rgba(0, 0, 0, 0.1)", "rgba(0, 0, 0, 0)"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.collectionCardBevel}
                        />
                        
                        {/* Geometric shapes background */}
                        {renderCollectionGeometricShapes(collection.name)}
                        
                        <View style={styles.collectionTextContainer}>
                          <Text style={[styles.collectionName, { color: cardColors.textColor }]}>{collection.name}</Text>
                          <Text style={[styles.collectionDescription, { color: cardColors.descriptionColor }]} numberOfLines={2}>
                            {collection.description || ""}
                          </Text>
                        </View>
                        <View style={styles.collectionFooter}>
                          <Text style={[styles.collectionDecksCount, { color: cardColors.textColor }]}>
                            {collectionDeckCounts[collection.id] || 0} unused {collectionDeckCounts[collection.id] === 1 ? 'deck' : 'decks'}
                          </Text>
                          <FontAwesome
                            name="chevron-right"
                            size={12}
                            color={cardColors.textColor}
                          />
                        </View>
                      </TouchableOpacity>
                    )
                  })}
              </View>
            </View>

            {/* Suggest a deck button */}
            <TouchableOpacity
              style={styles.suggestDeckButton}
              onPress={() => router.push(`/(main)/modals/suggest-deck?groupId=${currentGroupId}&returnTo=/(main)/explore-decks`)}
            >
              <Text style={styles.suggestDeckButtonText}>Suggest a deck</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Featured Questions Carousel */}
        {activeTab === "featured" && (
          <View style={styles.featuredSection}>
            {isLoadingFeaturedPrompts || isFetchingFeaturedPrompts ? (
              <View style={styles.swipeEmptyState}>
                <Text style={styles.swipeEmptyText}>Loading featured questions...</Text>
              </View>
            ) : featuredPromptsError ? (
              <View style={styles.swipeEmptyState}>
                <Text style={styles.swipeEmptyText}>Failed to load featured questions</Text>
                <Text style={styles.swipeEmptySubtext}>Please try again later</Text>
              </View>
            ) : featuredPrompts.length === 0 ? (
              // CRITICAL: Only show empty state if query has completed and confirmed no prompts
              // This prevents showing empty state prematurely when data is still loading
              <View style={styles.swipeEmptyState}>
                <View style={styles.emptyBlob} />
                <Text style={styles.swipeEmptyText}>Nothing here right now.{"\n"}Come back later</Text>
              </View>
            ) : (
              <>
            
            <ScrollView
              ref={featuredCarouselRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.featuredCarousel}
              contentContainerStyle={styles.featuredCarouselContent}
              pagingEnabled={false}
              snapToInterval={SCREEN_WIDTH - spacing.md * 2 + spacing.md}
              snapToAlignment="start"
              decelerationRate="fast"
              scrollEventThrottle={16}
              onScroll={(event) => {
                // Update index during scroll for pagination dots
                const cardWidth = SCREEN_WIDTH - spacing.md * 2
                const scrollX = event.nativeEvent.contentOffset.x
                const snapInterval = cardWidth + spacing.md
                const index = Math.round(scrollX / snapInterval)
                const clampedIndex = Math.max(0, Math.min(index, featuredPrompts.length - 1))
                if (clampedIndex !== featuredQuestionCarouselIndex && clampedIndex >= 0 && clampedIndex < featuredPrompts.length) {
                  setFeaturedQuestionCarouselIndex(clampedIndex)
                }
              }}
              onMomentumScrollEnd={(event) => {
                const cardWidth = SCREEN_WIDTH - spacing.md * 2
                const scrollX = event.nativeEvent.contentOffset.x
                const contentWidth = event.nativeEvent.contentSize.width
                const snapInterval = cardWidth + spacing.md
                
                // Calculate which card we're on
                let index = Math.round(scrollX / snapInterval)
                index = Math.max(0, Math.min(index, featuredPrompts.length - 1))
                setFeaturedQuestionCarouselIndex(index)
                
                // If we've scrolled past the last card, loop back to the first
                const maxScrollX = contentWidth - (SCREEN_WIDTH - spacing.md)
                if (scrollX >= maxScrollX - 10) {
                  setTimeout(() => {
                    featuredCarouselRef.current?.scrollTo({ x: 0, animated: false })
                    setFeaturedQuestionCarouselIndex(0)
                  }, 100)
                }
              }}
            >
              {featuredPrompts.map((prompt, index) => {
                const isInQueue = featuredPromptsInQueue.includes(prompt.id)
                const isDisabled = isInQueue || featuredQuestionCount >= 2
                
                return (
                  <TouchableOpacity
                    key={prompt.id}
                    style={styles.featuredCard}
                    onPress={() => {
                      if (!isDisabled) {
                        setSelectedFeaturedPrompt(prompt)
                        setFeaturedQuestionModalVisible(true)
                      }
                    }}
                    disabled={isDisabled}
                    activeOpacity={isDisabled ? 1 : 0.7}
                  >
                    {/* Texture overlay */}
                    <View style={styles.featuredCardTexture}>
                      <Image 
                        source={require("../../assets/images/texture.png")} 
                        style={styles.featuredCardTextureImage}
                        resizeMode="cover"
                      />
                    </View>
                    
                    <View style={styles.featuredCardContent}>
                      <Text style={styles.featuredCardQuestion}>{prompt.question}</Text>
                      {prompt.description && (
                        <Text style={styles.featuredCardDescription} numberOfLines={3}>
                          {prompt.description}
                        </Text>
                      )}
                      {prompt.suggested_by && (
                        <Text style={styles.featuredCardBy}>By {prompt.suggested_by}</Text>
                      )}
                      {isInQueue && (
                        <View style={styles.featuredTag}>
                          <Text style={styles.featuredTagText}>Someone is asking this already</Text>
                        </View>
                      )}
                      {!isDisabled && (
                        <TouchableOpacity
                          style={styles.featuredCardCTA}
                          onPress={() => {
                            setSelectedFeaturedPrompt(prompt)
                            setFeaturedQuestionModalVisible(true)
                          }}
                        >
                          <Text style={styles.featuredCardCTAText}>Ask this question</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
            
            {/* Pagination dots */}
            {featuredPrompts.length > 1 && (
              <View style={styles.paginationDots}>
                {featuredPrompts.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.paginationDot,
                      index === featuredQuestionCarouselIndex && styles.paginationDotActive,
                    ]}
                  />
                ))}
              </View>
            )}
            
            {/* Contribute a question link */}
            <TouchableOpacity
              style={styles.contributeLink}
              onPress={() => router.push(`/(main)/modals/contribute-featured-question?groupId=${currentGroupId}&returnTo=/(main)/explore-decks`)}
            >
              <Text style={styles.contributeLinkText}>Contribute a question</Text>
            </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Matches Tab Content - Swipe Interface */}
        {activeTab === "matches" && (
          <View style={styles.swipeContainer}>
            {isLoadingSwipeableQuestions ? (
              <View style={styles.swipeEmptyState}>
                <Text style={styles.swipeEmptyText}>Loading questions...</Text>
              </View>
            ) : swipeableQuestionsData.length === 0 ? (
              <View style={styles.swipeEmptyState}>
                <View style={styles.emptyBlob} />
                <Text style={styles.swipeEmptyText}>Nothing here right now.{"\n"}Come back later</Text>
              </View>
            ) : (
              <>
                {/* Progress Bar */}
                {swipeableQuestionsData.length > 0 && currentGroupId && userId && (
                  <View style={styles.progressBarContainer}>
                    <View style={styles.progressBarBackground}>
                      <Animated.View
                        style={[
                          styles.progressBarFill,
                          {
                            width: progressBarWidth.interpolate({
                              inputRange: [0, 100],
                              outputRange: ["0%", "100%"],
                            }),
                          },
                        ]}
                      />
                      {/* Star icon at current progress position */}
                      <Animated.View
                        style={[
                          styles.progressStar,
                          {
                            left: progressBarWidth.interpolate({
                              inputRange: [0, 100],
                              outputRange: ["0%", "100%"],
                            }),
                          },
                        ]}
                      >
                        <Image
                          source={require("../../assets/images/star.png")}
                          style={styles.progressStarImage}
                          resizeMode="contain"
                        />
                      </Animated.View>
                    </View>
                  </View>
                )}
                
                {/* Swipe Card */}
                {currentQuestionIndex < swipeableQuestionsData.length && currentGroupId && userId && (
                  <Animated.View
                    style={[
                      styles.swipeCard,
                      {
                        transform: [
                          { translateX: cardPosition.x },
                          { translateY: cardPosition.y },
                          {
                            rotate: cardRotation.interpolate({
                              inputRange: [-200, 0, 200],
                              outputRange: ["-30deg", "0deg", "30deg"],
                            }),
                          },
                        ],
                        opacity: cardOpacity,
                      },
                    ]}
                    {...panResponder.panHandlers}
                  >
                    {/* Texture overlay */}
                    <View style={styles.swipeCardTexture}>
                      <Image 
                        source={require("../../assets/images/texture.png")} 
                        style={styles.swipeCardTextureImage}
                        resizeMode="cover"
                      />
                    </View>
                    <Text style={styles.swipeCardQuestion}>
                      {swipeableQuestionsData[currentQuestionIndex].question}
                    </Text>
                  </Animated.View>
                )}

                {/* Yes/No Icons */}
                {currentQuestionIndex < swipeableQuestionsData.length && currentGroupId && userId && (
                  <View style={styles.swipeButtons}>
                    <TouchableOpacity
                      onPress={() => handleSwipe("no")}
                      activeOpacity={0.7}
                    >
                      <Image 
                        source={require("../../assets/images/No.png")} 
                        style={styles.swipeButtonIcon}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleSwipe("yes")}
                      activeOpacity={0.7}
                    >
                      <Image 
                        source={require("../../assets/images/Yes.png")} 
                        style={styles.swipeButtonIcon}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        )}

      </Animated.ScrollView>

      {/* Featured Question Confirmation Modal */}
      <Modal
        transparent
        animationType="none"
        visible={featuredQuestionModalVisible}
        onRequestClose={() => setFeaturedQuestionModalVisible(false)}
      >
        <Animated.View
          style={[
            styles.modalBackdrop,
            { opacity: featuredModalBackdropOpacity },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setFeaturedQuestionModalVisible(false)}
          />
          <Animated.View
            style={[
              styles.modalContent,
              {
                transform: [{ translateY: featuredModalSlideY }],
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.modalTitle}>Add Featured Question</Text>
            {selectedFeaturedPrompt && (
              <>
                <Text style={styles.modalText}>
                  Are you sure you want to add "{selectedFeaturedPrompt.question}" to your group's question queue?
                </Text>
                <View style={styles.modalButtonRow}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonSecondary]}
                    onPress={() => setFeaturedQuestionModalVisible(false)}
                  >
                    <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonPrimary]}
                    onPress={async () => {
                      if (!selectedFeaturedPrompt || !currentGroupId || !userId) return
                      
                      try {
                        await addFeaturedQuestionToQueue(
                          currentGroupId,
                          selectedFeaturedPrompt.id,
                          userId
                        )
                        
                        // Close modal first
                        setFeaturedQuestionModalVisible(false)
                        setSelectedFeaturedPrompt(null)
                        
                        // Force immediate refetch to update UI
                        await Promise.all([
                          refetchFeaturedCount(),
                          queryClient.refetchQueries({ queryKey: ["featuredPromptsInQueue", currentGroupId] }),
                        ])
                        
                        Alert.alert("Success", "Featured question added to your group's queue!")
                      } catch (error: any) {
                        Alert.alert("Error", error.message || "Failed to add featured question")
                      }
                    }}
                  >
                    <Text style={styles.modalButtonPrimaryText}>Add to Queue</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Match Modal - Toaster from bottom */}
      <Modal
        transparent
        animationType="none"
        visible={matchModalVisible}
        onRequestClose={() => setMatchModalVisible(false)}
      >
        <Animated.View
          style={[
            styles.modalBackdrop,
            { opacity: matchModalBackdropOpacity },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setMatchModalVisible(false)}
          />
          <Animated.View
            style={[
              styles.modalContent,
              { marginBottom: insets.bottom + spacing.lg },
              {
                transform: [{ translateY: matchModalSlideY }],
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.modalTitle}>Match!</Text>
            {matchInfo && matchInfo.matchedWithUsers.length > 0 && (
              <Text style={styles.modalText}>
                You and {matchInfo.matchedWithUsers.join(", ")} liked this one!
              </Text>
            )}
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonPrimary]}
              onPress={() => setMatchModalVisible(false)}
            >
              <Text style={styles.modalButtonPrimaryText}>Got it</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Progress Complete Modal - Toaster from bottom */}
      <Modal
        transparent
        animationType="none"
        visible={progressCompleteModalVisible}
        onRequestClose={() => setProgressCompleteModalVisible(false)}
      >
        <Animated.View
          style={[
            styles.modalBackdrop,
            { opacity: progressModalBackdropOpacity },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setProgressCompleteModalVisible(false)}
          />
          <Animated.View
            style={[
              styles.modalContent,
              { paddingBottom: insets.bottom + spacing.lg },
              {
                transform: [{ translateY: progressModalSlideY }],
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            {/* Close button */}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setProgressCompleteModalVisible(false)}
            >
              <FontAwesome name="times" size={20} color={colors.white} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Thanks, {userName}!</Text>
            <Text style={styles.modalText}>
              You've helped give us a great idea of what your group likes, which helps us ask you questions you'd all like to answer. No need to keep swiping.
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonPrimary]}
              onPress={() => {
                setProgressCompleteModalVisible(false)
                router.push("/(main)/home")
              }}
            >
              <Text style={styles.modalButtonPrimaryText}>Happy to help</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Help Modal */}
      <Modal
        transparent
        animationType="none"
        visible={helpModalVisible}
        onRequestClose={() => setHelpModalVisible(false)}
      >
        <Animated.View
          style={[
            styles.modalBackdrop,
            { opacity: helpModalBackdropOpacity },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setHelpModalVisible(false)}
          />
          <Animated.View
            style={[
              styles.modalContent,
              {
                transform: [{ translateY: helpModalSlideY }],
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            {activeTab === "decks" && (
              <>
                <Text style={styles.modalTitle}>Question Decks</Text>
                <Text style={styles.modalText}>
                  Question decks are curated collections of questions that your group can vote to add to your daily question rotation.{"\n\n"}
                  When a deck is activated, one question from that deck will be included each week alongside your regular questions.{"\n\n"}
                  You can have up to 3 active decks at a time. Once all questions in a deck have been asked, it will be marked as finished and no longer count toward your limit.
                </Text>
              </>
            )}
            {activeTab === "featured" && (
              <>
                <Text style={styles.modalTitle}>Featured Questions</Text>
                <Text style={styles.modalText}>
                  Featured questions are special questions selected for this week.{"\n\n"}
                  You can ask up to 2 featured questions to your group each week. These questions appear alongside your regular daily questions.{"\n\n"}
                  Once you've asked 2 featured questions, you'll need to wait until next week to ask more.
                </Text>
              </>
            )}
            {activeTab === "matches" && (
              <>
                <Text style={styles.modalTitle}>Like Some Questions</Text>
                <Text style={styles.modalText}>
                  Swipe right on questions you'd like your group to answer, or swipe left to skip.{"\n\n"}
                  This helps us understand what your group likes, so we can ask you questions you'd all enjoy answering.{"\n\n"}
                  You can swipe through as many questions as you'd like. But, 15 is the sweetspot that gives us a good picture of your groups vibe.
                </Text>
              </>
            )}
            <TouchableOpacity
              onPress={() => setHelpModalVisible(false)}
              style={styles.modalButton}
            >
              <Text style={{ ...typography.bodyBold, color: theme2Colors.text, textAlign: "center" }}>Got it</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  )
}

