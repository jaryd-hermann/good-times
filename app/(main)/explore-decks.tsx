"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Dimensions,
  Animated,
  Alert,
  PanResponder,
} from "react-native"
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

// Helper function to get collection icon source and dimensions based on collection name
function getCollectionIconSource(collectionName: string | undefined) {
  if (!collectionName) {
    return require("../../assets/images/icon-deeper.png") // Default fallback
  }
  
  const nameLower = collectionName.toLowerCase()
  
  if (nameLower.includes("deeper")) {
    return require("../../assets/images/icon-deeper.png")
  }
  
  if (nameLower.includes("real life routine") || nameLower.includes("routines")) {
    return require("../../assets/images/icon-routine.png")
  }
  
  if (nameLower.includes("raw truth") || nameLower.includes("truths")) {
    return require("../../assets/images/icon-truths.png")
  }
  
  if (nameLower.includes("nostalgia")) {
    return require("../../assets/images/icon-nostalgia.png")
  }
  
  if (nameLower.includes("memorial")) {
    return require("../../assets/images/icon-memorial.png")
  }
  
  if (nameLower.includes("mindset") || nameLower.includes("growth")) {
    return require("../../assets/images/icon-mindset.png")
  }
  
  // Default fallback
  return require("../../assets/images/icon-deeper.png")
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
    return require("../../assets/images/deck-icon-default.png")
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
  
  return require("../../assets/images/deck-icon-default.png")
}

export default function ExploreDecks() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
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
  // Use refs to track values to avoid stale closure issues
  const currentQuestionIndexRef = useRef(0)
  const currentGroupIdRef = useRef<string | undefined>(undefined)
  const userIdRef = useRef<string | undefined>(undefined)
  const cardPosition = useRef(new Animated.ValueXY()).current
  const cardRotation = useRef(new Animated.Value(0)).current
  const cardOpacity = useRef(new Animated.Value(1)).current
  const scrollY = useRef(new Animated.Value(0)).current
  const headerTranslateY = useRef(new Animated.Value(0)).current
  const contentPaddingTop = useRef(new Animated.Value(0)).current
  const lastScrollY = useRef(0)
  const isResettingScroll = useRef(false)
  const { opacity: tabBarOpacity } = useTabBar()
  const posthog = usePostHog()
  const queryClient = useQueryClient()

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
        
        // CRITICAL: Always invalidate featured prompts query when screen comes into focus
        // This ensures the section shows if prompts exist for the current week
        // This fixes the issue where the section disappears after adding a question
        queryClient.invalidateQueries({ queryKey: ["featuredPrompts"] })
      }
      reloadGroupContext()
    }, [focusGroupId, queryClient])
  )

  // Invalidate queries when currentGroupId changes (handles group switches)
  useEffect(() => {
    if (currentGroupId) {
      // Invalidate all queries that depend on groupId
      queryClient.invalidateQueries({ queryKey: ["groupActiveDecks", currentGroupId] })
      queryClient.invalidateQueries({ queryKey: ["collectionDeckCounts"] })
      queryClient.invalidateQueries({ queryKey: ["deckQuestionsLeft", currentGroupId] })
      queryClient.invalidateQueries({ queryKey: ["voteStatuses", currentGroupId] })
    }
  }, [currentGroupId, queryClient])

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

  // Get current week Monday for query key (ensures refetch when week changes)
  // Calculate inline to always get the current week
  const getCurrentWeekMonday = () => {
    const today = new Date()
    const dayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const monday = new Date(today)
    monday.setDate(today.getDate() - daysToSubtract)
    return monday.toISOString().split("T")[0]
  }

  // Get featured prompts for current week
  // CRITICAL: Include current week Monday in query key so it refetches when week changes
  // This ensures the section always shows when there are prompts for the current week
  // The query key changes when the week changes, forcing a refetch
  const { data: featuredPrompts = [], error: featuredPromptsError } = useQuery({
    queryKey: ["featuredPrompts", getCurrentWeekMonday()],
    queryFn: getFeaturedPromptsForCurrentWeek,
    staleTime: 0, // Always consider stale to ensure fresh data
    refetchOnMount: true, // Always refetch on mount
    refetchOnWindowFocus: true, // Refetch when screen comes into focus
    retry: 2, // Retry on failure
  })
  
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
  const { data: swipeableQuestionsData = [], refetch: refetchSwipeableQuestions } = useQuery({
    queryKey: ["swipeableQuestions", currentGroupId, userId],
    queryFn: () => (currentGroupId && userId ? getSwipeableQuestionsForGroup(currentGroupId, userId) : []),
    enabled: !!currentGroupId && !!userId && activeTab === "matches",
  })

  // Get swiping participants
  const { data: swipingParticipantsData = [] } = useQuery({
    queryKey: ["swipingParticipants", currentGroupId, userId],
    queryFn: () => (currentGroupId && userId ? getSwipingParticipants(currentGroupId, userId) : []),
    enabled: !!currentGroupId && !!userId && activeTab === "matches",
  })

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

    try {
      // Record swipe
      const result = await recordSwipe(groupId, currentQuestion.id, user, direction)
      console.log("[explore-decks] Swipe recorded successfully:", result)

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
          setMatchInfo({ matchedWithUsers: result.matchedWithUsers })
          setMatchModalVisible(true)
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
    }
  }, [currentGroupId, userId, swipeableQuestionsData, refetchSwipeableQuestions, queryClient])

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
            // Swipe detected
            const direction = dx > 0 ? "yes" : "no"
            console.log("[explore-decks] Swipe detected:", direction, "dx:", dx)
            handleSwipe(direction).catch((error) => {
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
    [handleSwipe]
  )

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.black,
    },
    header: {
      paddingTop: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.lg, // More padding at bottom
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.gray[800] : "#000000",
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.black,
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
      ...typography.h1,
      fontSize: 32,
      color: colors.white,
      marginTop: spacing.sm, // More padding above title
      marginBottom: spacing.md, // More padding below title
    },
    subtitle: {
      ...typography.body,
      color: colors.gray[400],
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
      borderColor: isDark ? colors.white : colors.black,
      backgroundColor: colors.gray[900],
    },
    tabActive: {
      backgroundColor: isDark ? colors.white : colors.black,
    },
    tabText: {
      ...typography.body,
      fontSize: 14,
      color: isDark ? colors.white : colors.black,
    },
    tabTextActive: {
      color: isDark ? colors.black : colors.white,
      fontWeight: "600",
    },
    helpButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.gray[800],
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
      color: "#C7C7C7",
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
      backgroundColor: colors.gray[900],
      borderRadius: 12,
      padding: spacing.md,
      alignItems: "center", // Center content
      borderWidth: 1,
      borderColor: colors.white,
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
      borderWidth: 1,
    },
    statusBadgeVoting: {
      borderColor: colors.accent,
    },
    statusBadgeActive: {
      borderColor: "#4CAF50", // Green
    },
    statusBadgeFinished: {
      borderColor: colors.gray[600],
    },
    statusBadgeRejected: {
      borderColor: colors.gray[600],
    },
    statusText: {
      ...typography.caption,
      fontSize: 10,
      color: colors.white,
    },
    deckIcon: {
      width: 120,
      height: 120,
      borderRadius: 8,
      marginBottom: spacing.sm,
      backgroundColor: colors.gray[700],
      alignSelf: "center", // Center icon
    },
    deckName: {
      ...typography.bodyBold,
      fontSize: 16,
      color: colors.white,
      marginBottom: spacing.xs,
      textAlign: "center", // Center deck name
    },
    deckStats: {
      ...typography.caption,
      fontSize: 12,
      color: colors.gray[300],
      textAlign: "center", // Center align stats text
    },
    collectionsTitle: {
      fontFamily: "Roboto-Bold",
      fontSize: 16,
      color: "#C7C7C7",
      marginBottom: spacing.md,
      fontWeight: "700",
    },
    collectionsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      paddingBottom: spacing.xl,
    },
    suggestDeckButton: {
      marginHorizontal: spacing.md,
      marginTop: spacing.lg,
      marginBottom: spacing.xxl * 2,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 0, // Square border
      borderWidth: 1,
      borderColor: isDark ? colors.white : colors.black,
      alignItems: "center",
      justifyContent: "center",
    },
    suggestDeckButtonText: {
      ...typography.bodyBold,
      fontSize: 16,
      color: isDark ? colors.white : colors.black,
    },
    collectionCard: {
      width: CARD_WIDTH,
      height: 220, // Fixed height for all cards
      backgroundColor: colors.gray[900],
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.md,
      flexDirection: "column",
      justifyContent: "space-between", // Space between content and footer
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
      alignItems: "center", // Center content horizontally
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
      color: colors.white,
      marginBottom: spacing.xs,
      textAlign: "center", // Center align text
      minHeight: 22, // Fixed height for name (1 line)
    },
    collectionDescription: {
      ...typography.caption,
      fontSize: 12,
      color: colors.gray[400],
      textAlign: "center", // Center align text
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
      color: colors.gray[300],
      flex: 1, // Take up available space
    },
    // Modal styles
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.85)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: colors.black,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: spacing.lg,
      paddingBottom: insets.bottom + spacing.lg,
    },
    modalTitle: {
      ...typography.h2,
      fontSize: 24,
      color: colors.white,
      marginBottom: spacing.md,
    },
    modalText: {
      ...typography.body,
      color: colors.gray[300],
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
      backgroundColor: colors.gray[800],
      paddingVertical: spacing.md,
      borderRadius: 0, // Square edges
      alignItems: "center",
    },
    modalButtonPrimary: {
      flex: 1,
      backgroundColor: colors.accent,
      paddingVertical: spacing.md,
      borderRadius: 0, // Square edges
      alignItems: "center",
    },
    modalButtonSecondaryText: {
      ...typography.bodyBold,
      color: colors.white,
    },
    modalButtonPrimaryText: {
      ...typography.bodyBold,
      color: colors.white,
    },
    // Featured Questions Styles
    featuredSection: {
      marginBottom: spacing.xxl + spacing.lg,
    },
    featuredTitle: {
      fontFamily: "Roboto-Bold",
      fontSize: 24,
      color: colors.white,
      marginBottom: spacing.xs,
      textAlign: "center",
      fontWeight: "700",
    },
    featuredSubtitle: {
      ...typography.body,
      fontSize: 14,
      color: colors.gray[400],
      marginBottom: spacing.md,
      textAlign: "center",
    },
    featuredStatus: {
      ...typography.body,
      fontSize: 14,
      color: colors.white,
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
      backgroundColor: colors.gray[900],
      borderRadius: 12,
      padding: spacing.lg,
      paddingTop: spacing.xxl, // Extra padding at top to prevent number cropping
      marginRight: spacing.md, // Margin between cards
      borderWidth: 1,
      borderColor: colors.gray[700],
      minHeight: 300,
      overflow: "visible", // Allow number to extend if needed
    },
    featuredCardNumber: {
      ...typography.h1,
      fontSize: 48,
      color: colors.white,
      marginBottom: spacing.md,
      marginTop: 0,
      fontWeight: "700",
      lineHeight: 56, // Ensure proper line height for large number
    },
    featuredCardQuestion: {
      ...typography.bodyBold,
      fontSize: 20,
      color: colors.white,
      marginBottom: spacing.md,
      lineHeight: 28,
    },
    featuredCardDescription: {
      ...typography.body,
      fontSize: 14,
      color: colors.gray[400],
      marginBottom: spacing.md,
      lineHeight: 20,
    },
    featuredCardBy: {
      ...typography.caption,
      fontSize: 12,
      color: colors.gray[500],
      fontStyle: "italic",
      marginTop: "auto",
    },
    featuredTag: {
      alignSelf: "flex-start",
      backgroundColor: colors.gray[800],
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: 12,
      marginTop: spacing.sm,
    },
    featuredTagText: {
      ...typography.caption,
      fontSize: 11,
      color: colors.gray[400],
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
      backgroundColor: colors.gray[700],
    },
    paginationDotActive: {
      backgroundColor: colors.white,
    },
    askQuestionButton: {
      backgroundColor: colors.accent,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 0, // Square edges
      alignItems: "center",
      marginBottom: spacing.md,
      marginHorizontal: spacing.md,
    },
    askQuestionButtonDisabled: {
      backgroundColor: colors.gray[700],
      opacity: 0.5,
    },
    askQuestionButtonText: {
      ...typography.bodyBold,
      fontSize: 16,
      color: colors.white,
    },
    contributeLink: {
      alignItems: "center",
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
    },
    contributeLinkText: {
      ...typography.body,
      fontSize: 14,
      color: colors.gray[400],
      textDecorationLine: "underline",
    },
    swipeContainer: {
      minHeight: Dimensions.get("window").height - 300, // Ensure enough space
      justifyContent: "flex-start",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingTop: spacing.xl,
      paddingBottom: spacing.xxl,
    },
    swipePlaceholder: {
      ...typography.body,
      color: colors.gray[400],
      textAlign: "center",
    },
    swipeEmptyState: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: spacing.xxl * 2,
    },
    swipeEmptyText: {
      ...typography.h2,
      fontSize: 20,
      color: colors.white,
      marginBottom: spacing.sm,
      textAlign: "center",
    },
    swipeEmptySubtext: {
      ...typography.body,
      color: colors.gray[400],
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
      color: colors.gray[400],
      flex: 1,
    },
    swipeButtons: {
      flexDirection: "row",
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      marginTop: spacing.xl,
      marginBottom: spacing.lg,
    },
    swipeButton: {
      flex: 1,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 0, // Square edges
      alignItems: "center",
      justifyContent: "center",
    },
    swipeButtonNo: {
      backgroundColor: colors.white,
    },
    swipeButtonYes: {
      backgroundColor: colors.accent,
    },
    swipeButtonText: {
      ...typography.bodyBold,
      fontSize: 16,
      color: colors.black,
    },
    swipeButtonYesText: {
      color: colors.white,
    },
    swipeCard: {
      width: SCREEN_WIDTH - spacing.md * 2,
      height: 340, // Reduced from 400 to 340 (15% less height: 400 * 0.85 = 340)
      backgroundColor: colors.gray[900],
      borderRadius: 12,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.gray[700],
      justifyContent: "center",
      alignItems: "center",
      alignSelf: "center",
    },
    swipeCardQuestion: {
      ...typography.h2,
      fontSize: 24,
      color: colors.white,
      textAlign: "center",
      lineHeight: 32,
    },
  })

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
          <Text style={styles.title}>
            {activeTab === "decks" && "Question Decks"}
            {activeTab === "featured" && "Featured"}
            {activeTab === "matches" && "Swipe and Match"}
          </Text>
          {/* Show subtitle or participant info in same position */}
          {activeTab === "matches" && swipingParticipantsData.length > 0 ? (
            <View style={styles.headerParticipantsContainer}>
              <View style={styles.headerParticipantsAvatars}>
                {swipingParticipantsData.slice(0, 3).map((participant, index) => (
                  <View
                    key={participant.id}
                    style={[
                      styles.headerParticipantAvatar,
                      { marginLeft: index > 0 ? -12 : 0, zIndex: 3 - index },
                    ]}
                  >
                    <Avatar uri={participant.avatar_url} name={participant.name} size={32} />
                  </View>
                ))}
              </View>
              <Text style={styles.subtitle}>
                {swipingParticipantsData.length === 1
                  ? `${swipingParticipantsData[0].name} has liked some questions`
                  : swipingParticipantsData.length === 2
                  ? `${swipingParticipantsData[0].name} and ${swipingParticipantsData[1].name} have liked some questions`
                  : `${swipingParticipantsData[0].name} and ${swipingParticipantsData.length - 1} others have liked some questions`}
              </Text>
            </View>
          ) : (
            <Text style={styles.subtitle}>
              {activeTab === "decks" && "Explore collections and intentional question decks to add for your group."}
              {activeTab === "featured" && "Ask a single question to your group"}
              {activeTab === "matches" && "Find some good questions you like and want the group to answer"}
            </Text>
          )}
          {/* Tab Navigation */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === "decks" && styles.tabActive]}
              onPress={() => setActiveTab("decks")}
            >
              <Text style={[styles.tabText, activeTab === "decks" && styles.tabTextActive]}>Decks</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "featured" && styles.tabActive]}
              onPress={() => setActiveTab("featured")}
            >
              <Text style={[styles.tabText, activeTab === "featured" && styles.tabTextActive]}>Featured</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "matches" && styles.tabActive]}
              onPress={() => setActiveTab("matches")}
            >
              <Text style={[styles.tabText, activeTab === "matches" && styles.tabTextActive]}>Swipe</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => setHelpModalVisible(true)}
          >
            <FontAwesome name="question-circle" size={18} color={colors.white} />
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
            <Text style={styles.collectionsTitle}>Collections</Text>
            <View style={styles.collectionsGrid}>
              {collections.map((collection) => (
                <TouchableOpacity
                  key={collection.id}
                  style={styles.collectionCard}
                  onPress={() => router.push(`/(main)/collection-detail?collectionId=${collection.id}&groupId=${currentGroupId}`)}
                >
                  <View style={styles.collectionTextContainer}>
                    <Image 
                      source={getCollectionIconSource(collection.name)} 
                      style={[
                        styles.collectionNameIcon,
                        getCollectionIconDimensions(collection.name)
                      ]}
                      resizeMode="contain"
                    />
                    <Text style={styles.collectionName}>{collection.name}</Text>
                    <Text style={styles.collectionDescription} numberOfLines={2}>
                      {collection.description || ""}
                    </Text>
                  </View>
                  <View style={styles.collectionFooter}>
                    <Text style={styles.collectionDecksCount}>
                      {collectionDeckCounts[collection.id] || 0} unused {collectionDeckCounts[collection.id] === 1 ? 'deck' : 'decks'}
                    </Text>
                    <FontAwesome
                      name="chevron-right"
                      size={12}
                      color={colors.gray[400]}
                    />
                  </View>
                </TouchableOpacity>
              ))}
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
        {activeTab === "featured" && featuredPrompts.length > 0 && (
          <View style={styles.featuredSection}>
            <Text style={styles.featuredTitle}>This weeks featured questions</Text>
            <Text style={styles.featuredSubtitle}>Ask a single question to your group</Text>
            
            {featuredQuestionCount === 0 && (
              <Text style={styles.featuredStatus}>
                You can ask 2 questions this week
              </Text>
            )}
            {featuredQuestionCount === 1 && (
              <Text style={styles.featuredStatus}>
                You can ask 1 more question this week
              </Text>
            )}
            {featuredQuestionCount >= 2 && (
              <Text style={styles.featuredStatus}>
                You can't ask any more this week
              </Text>
            )}
            
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
                    <Text style={styles.featuredCardNumber}>{prompt.display_order}</Text>
                    <Text style={styles.featuredCardQuestion}>{prompt.question}</Text>
                    {prompt.description && (
                      <Text style={styles.featuredCardDescription} numberOfLines={4}>
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
            
            {/* Ask this question button */}
            {featuredPrompts.length > 0 && (() => {
              const currentPrompt = featuredPrompts[featuredQuestionCarouselIndex]
              const currentIsDisabled = currentPrompt 
                ? (featuredPromptsInQueue.includes(currentPrompt.id) || featuredQuestionCount >= 2)
                : true
              
              return (
                <TouchableOpacity
                  style={[
                    styles.askQuestionButton,
                    currentIsDisabled && styles.askQuestionButtonDisabled,
                  ]}
                  onPress={() => {
                    if (currentPrompt && !currentIsDisabled) {
                      setSelectedFeaturedPrompt(currentPrompt)
                      setFeaturedQuestionModalVisible(true)
                    }
                  }}
                  disabled={currentIsDisabled}
                >
                  <Text style={styles.askQuestionButtonText}>Ask this question</Text>
                </TouchableOpacity>
              )
            })()}
            
            {/* Contribute a question link */}
            <TouchableOpacity
              style={styles.contributeLink}
              onPress={() => router.push(`/(main)/modals/contribute-featured-question?groupId=${currentGroupId}&returnTo=/(main)/explore-decks`)}
            >
              <Text style={styles.contributeLinkText}>Contribute a question</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Matches Tab Content - Swipe Interface */}
        {activeTab === "matches" && (
          <View style={styles.swipeContainer}>
            {swipeableQuestionsData.length === 0 ? (
              <View style={styles.swipeEmptyState}>
                <Text style={styles.swipeEmptyText}>No questions available to swipe</Text>
                <Text style={styles.swipeEmptySubtext}>Check back later for more questions!</Text>
              </View>
            ) : (
              <>
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
                    <Text style={styles.swipeCardQuestion}>
                      {swipeableQuestionsData[currentQuestionIndex].question}
                    </Text>
                  </Animated.View>
                )}

                {/* Yes/No Buttons */}
                {currentQuestionIndex < swipeableQuestionsData.length && currentGroupId && userId && (
                  <View style={styles.swipeButtons}>
                    <TouchableOpacity
                      style={[styles.swipeButton, styles.swipeButtonNo]}
                      onPress={() => handleSwipe("no")}
                    >
                      <Text style={styles.swipeButtonText}>No</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.swipeButton, styles.swipeButtonYes]}
                      onPress={() => handleSwipe("yes")}
                    >
                      <Text style={[styles.swipeButtonText, styles.swipeButtonYesText]}>Yes</Text>
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
        animationType="slide"
        visible={featuredQuestionModalVisible}
        onRequestClose={() => setFeaturedQuestionModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setFeaturedQuestionModalVisible(false)}
        >
          <View
            style={styles.modalContent}
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
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Match Modal - Toaster from bottom */}
      <Modal
        transparent
        animationType="slide"
        visible={matchModalVisible}
        onRequestClose={() => setMatchModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setMatchModalVisible(false)}
        >
          <View
            style={[styles.modalContent, { marginBottom: insets.bottom + spacing.lg }]}
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
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Help Modal */}
      <Modal
        transparent
        animationType="slide"
        visible={helpModalVisible}
        onRequestClose={() => setHelpModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setHelpModalVisible(false)}
        >
          <View
            style={styles.modalContent}
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.modalTitle}>Question Decks</Text>
            <Text style={styles.modalText}>
              Question decks are curated collections of questions that your group can vote to add to your daily question rotation.{"\n\n"}
              When a deck is activated, one question from that deck will be included each week alongside your regular questions.{"\n\n"}
              You can have up to 3 active decks at a time. Once all questions in a deck have been asked, it will be marked as finished and no longer count toward your limit.
            </Text>
            <TouchableOpacity
              onPress={() => setHelpModalVisible(false)}
              style={styles.modalButton}
            >
              <Text style={{ ...typography.bodyBold, color: colors.white, textAlign: "center" }}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

