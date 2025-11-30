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
} from "react-native"
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { FontAwesome } from "@expo/vector-icons"
import { useTheme } from "../../lib/theme-context"
import { typography, spacing } from "../../lib/theme"
import { getCollections, getGroupActiveDecks, getDeckQuestionsLeftCount, getDecksByCollection, getCurrentUser, getVoteStatus, getUserGroups } from "../../lib/db"
import { supabase } from "../../lib/supabase"
import { useTabBar } from "../../lib/tab-bar-context"
import type { Collection, GroupActiveDeck } from "../../lib/types"
import { usePostHog } from "posthog-react-native"
import { safeCapture } from "../../lib/posthog"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useCallback } from "react"

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
  // - spacing.lg (subtitle marginBottom)
  // - spacing.lg (header paddingBottom)
  // - spacing.lg (extra padding after header divider)
  const headerHeight = useMemo(() => {
    return insets.top + spacing.md + spacing.sm + 32 + spacing.md + 50 + spacing.lg + spacing.lg + spacing.lg
  }, [insets.top])

  useEffect(() => {
    // Set initial padding to header height
    const initialPadding = headerHeight
    contentPaddingTop.setValue(initialPadding)
  }, [headerHeight])

  const scrollViewRef = useRef<ScrollView>(null)

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
      ]).start()
      
      // Reset scroll tracking
      lastScrollY.current = 0
      scrollY.setValue(0)
      
      // Reset scroll position to top
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false })
        // Re-enable scroll handler after a brief delay
        setTimeout(() => {
          isResettingScroll.current = false
        }, 100)
      }, 0)
    }, [headerHeight, scrollY])
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
      } else if (scrollDiff < -5) {
        // Scrolling up - show header and restore padding, show tab bar
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
        ]).start()
      }
    },
  })

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
      marginBottom: spacing.lg, // More padding below description
      textAlign: "left", // Align left like title
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
          <Text style={styles.title}>Question Decks</Text>
          <Text style={styles.subtitle}>Explore collections and intentional question decks to add for your group.</Text>
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
      >
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
      </Animated.ScrollView>

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

