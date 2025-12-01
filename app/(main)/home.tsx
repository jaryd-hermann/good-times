"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Share,
  Alert,
  Dimensions,
  Modal,
  Animated,
  AppState,
  Platform,
  Image,
  ActivityIndicator,
} from "react-native"
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { usePostHog } from "posthog-react-native"
import { captureEvent, safeCapture } from "../../lib/posthog"
import { supabase } from "../../lib/supabase"
import AsyncStorage from "@react-native-async-storage/async-storage"
import {
  getUserGroups,
  getGroupMembers,
  getDailyPrompt,
  getEntriesForDate,
  getUserEntryForDate,
  getCurrentUser,
  getAllPrompts,
  getUpcomingBirthdayCards,
  getMyCardEntriesForDate,
  getMyBirthdayCard,
  getBirthdayCardEntries,
} from "../../lib/db"
import { getTodayDate, getWeekDates, getPreviousDay, utcStringToLocalDate, formatDateAsLocalISO } from "../../lib/utils"
import { typography, spacing } from "../../lib/theme"
import { useTheme } from "../../lib/theme-context"
import { Avatar } from "../../components/Avatar"
import { Button } from "../../components/Button"
import { EntryCard } from "../../components/EntryCard"
import { CategoryTag } from "../../components/CategoryTag"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { FontAwesome } from "@expo/vector-icons"
import { registerForPushNotifications, savePushToken } from "../../lib/notifications"
import { getMemorials, getCustomQuestionOpportunity, hasSeenCustomQuestionOnboarding, getPendingVotes, getDeckDetails } from "../../lib/db"
import { personalizeMemorialPrompt, replaceDynamicVariables } from "../../lib/prompts"
import { useTabBar } from "../../lib/tab-bar-context"
import { CustomQuestionBanner } from "../../components/CustomQuestionBanner"
import { BirthdayCardUpcomingBanner } from "../../components/BirthdayCardUpcomingBanner"
import { BirthdayCardEditBanner } from "../../components/BirthdayCardEditBanner"
import { BirthdayCardYourCardBanner } from "../../components/BirthdayCardYourCardBanner"

const { width: SCREEN_WIDTH } = Dimensions.get("window")

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

function getDayIndex(dateString: string, groupId?: string) {
  const base = new Date(dateString)
  const start = new Date("2020-01-01")
  const diff = Math.floor((base.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  const groupOffset = groupId ? groupId.length : 0
  return diff + groupOffset
}

export default function Home() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const focusGroupId = params.focusGroupId as string | undefined
  const queryClient = useQueryClient()
  const { colors, isDark } = useTheme()
  const [selectedDate, setSelectedDate] = useState(getTodayDate())
  const [currentGroupId, setCurrentGroupId] = useState<string>()
  const [userId, setUserId] = useState<string>()
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | undefined>()
  const [userName, setUserName] = useState<string>("User")
  const [refreshing, setRefreshing] = useState(false)
  const [showRefreshIndicator, setShowRefreshIndicator] = useState(false)
  const insets = useSafeAreaInsets()
  const [groupPickerVisible, setGroupPickerVisible] = useState(false)
  const [isGroupSwitching, setIsGroupSwitching] = useState(false)
  const scrollY = useRef(new Animated.Value(0)).current
  const headerTranslateY = useRef(new Animated.Value(0)).current
  const contentPaddingTop = useRef(new Animated.Value(0)).current
  const lastScrollY = useRef(0)
  const scrollViewRef = useRef<ScrollView>(null)
  const isResettingScroll = useRef(false)
  const { opacity: tabBarOpacity } = useTabBar()
  const posthog = usePostHog()

  // Track loaded_home_screen event once per session
  useEffect(() => {
    let hasTrackedSession = false
    async function trackHomeScreen() {
      try {
        // Check if we've already tracked this session
        const sessionKey = await AsyncStorage.getItem("posthog_home_session_tracked")
        if (sessionKey === "true") {
          return // Already tracked this session
        }

        // Track the event
        safeCapture(posthog, "loaded_home_screen")

        // Mark session as tracked
        await AsyncStorage.setItem("posthog_home_session_tracked", "true")
        hasTrackedSession = true
      } catch (error) {
        if (__DEV__) console.error("[home] Failed to track loaded_home_screen:", error)
      }
    }
    trackHomeScreen()

    // Reset session tracking when app goes to background (new session)
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "background" || nextAppState === "inactive") {
        AsyncStorage.removeItem("posthog_home_session_tracked")
      }
    })

    return () => {
      subscription.remove()
    }
  }, [posthog])

  useEffect(() => {
    loadUser()
  }, [])

  // Reload user profile when screen comes into focus (e.g., returning from settings)
  // But don't reset group - only update if focusGroupId param is provided
  useFocusEffect(
    useCallback(() => {
      // Only reload user profile, not group (preserve current group)
      async function reloadProfile() {
        try {
          // Ensure session is valid before loading data
          const { ensureValidSession } = await import("../../lib/auth")
          await ensureValidSession()
          
          const {
            data: { user },
          } = await supabase.auth.getUser()
          if (user) {
            setUserId(user.id)
            const profile = await getCurrentUser()
            if (profile) {
              setUserAvatarUrl(profile.avatar_url || undefined)
              setUserName(profile.name || "User")
            }
            // Only update group if focusGroupId param is provided
            if (focusGroupId) {
              const groups = await getUserGroups(user.id)
              if (groups.some((group) => group.id === focusGroupId)) {
                setCurrentGroupId(focusGroupId)
              }
            }
          }
        } catch (error) {
          console.error("[home] Error reloading profile:", error)
          // Don't block UI if reload fails
        }
      }
      reloadProfile()
      
      // Invalidate and refetch unseen count when screen comes into focus
      queryClient.invalidateQueries({ queryKey: ["groupUnseenCount"] })
    }, [focusGroupId, queryClient])
  )

  // Request push notification permission on first visit to home
  useEffect(() => {
    async function requestNotificationsOnFirstVisit() {
      const hasRequestedNotifications = await AsyncStorage.getItem("has_requested_notifications")
      if (!hasRequestedNotifications && userId) {
        try {
          const token = await registerForPushNotifications()
          if (token) {
            await savePushToken(userId, token)
            console.log("[home] push notifications registered")
          }
          await AsyncStorage.setItem("has_requested_notifications", "true")
        } catch (error) {
          console.warn("[home] failed to register push notifications:", error)
          // Still mark as requested so we don't keep asking
          await AsyncStorage.setItem("has_requested_notifications", "true")
        }
      }
    }
    requestNotificationsOnFirstVisit()
  }, [userId])

  async function loadUser() {
    try {
      // Ensure session is valid before loading data
      const { ensureValidSession } = await import("../../lib/auth")
      await ensureValidSession()
      
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const profile = await getCurrentUser()
        if (profile) {
          setUserAvatarUrl(profile.avatar_url || undefined)
          setUserName(profile.name || "User")
        }
        // Get user's groups
        const groups = await getUserGroups(user.id)
        if (groups.length > 0) {
          // Priority order:
          // 1. focusGroupId param (highest priority)
          // 2. Default group ID from AsyncStorage (if user has multiple groups)
          // 3. Persisted group ID from AsyncStorage
          // 4. Current state (if already set)
          // 5. First group (fallback)
          
          if (focusGroupId && groups.some((group) => group.id === focusGroupId)) {
            setCurrentGroupId(focusGroupId)
            await AsyncStorage.setItem("current_group_id", focusGroupId)
          } else if (!currentGroupId) {
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
          // Otherwise, preserve the existing currentGroupId
        }
      }
    } catch (error) {
      console.error("[home] Error loading user:", error)
      // Don't block UI if load fails - user can retry
    }
  }

  const { data: groups = [] } = useQuery({
    queryKey: ["groups", userId],
    queryFn: () => (userId ? getUserGroups(userId) : []),
    enabled: !!userId,
    staleTime: 0, // Always refetch groups to detect new groups
  })

  // When groups list changes (new group added), invalidate prompts for all groups
  useEffect(() => {
    if (groups.length > 0 && currentGroupId) {
      // Check if current group is in the list (might be a new group)
      const currentGroup = groups.find((g) => g.id === currentGroupId)
      if (currentGroup) {
        // Invalidate prompts for current group to ensure fresh data
        queryClient.invalidateQueries({ 
          queryKey: ["dailyPrompt", currentGroupId],
          exact: false 
        })
        queryClient.invalidateQueries({ 
          queryKey: ["entries", currentGroupId],
          exact: false 
        })
      }
    }
  }, [groups.length, currentGroupId, queryClient])

  useEffect(() => {
    if (focusGroupId && focusGroupId !== currentGroupId && groups.some((group) => group.id === focusGroupId)) {
      setCurrentGroupId(focusGroupId)
      // Invalidate queries when switching to focused group
      queryClient.invalidateQueries({ 
        queryKey: ["dailyPrompt", focusGroupId],
        exact: false 
      })
      queryClient.invalidateQueries({ 
        queryKey: ["entries", focusGroupId],
        exact: false 
      })
    }
  }, [focusGroupId, groups, currentGroupId, queryClient])

  // Track previous group ID to clear its cache when switching
  const prevGroupIdRef = useRef<string | undefined>(undefined)

  // Invalidate queries ONLY when currentGroupId changes (group switch), not on date changes
  useEffect(() => {
    const prevGroupId = prevGroupIdRef.current
    
    // Only do this if group actually changed (not on initial mount or date changes)
    if (prevGroupId && prevGroupId !== currentGroupId) {
      console.log(`[home] Group changed from ${prevGroupId} to ${currentGroupId}, clearing old group cache`)
      setIsGroupSwitching(true) // Set loading state immediately
      
      // Remove all queries for the previous group (all dates)
      queryClient.removeQueries({ 
        queryKey: ["dailyPrompt", prevGroupId],
        exact: false 
      })
      queryClient.removeQueries({ 
        queryKey: ["entries", prevGroupId],
        exact: false 
      })
      queryClient.removeQueries({ 
        queryKey: ["userEntry", prevGroupId],
        exact: false 
      })
      
      // Clear cache for new group to ensure fresh data
      if (currentGroupId) {
        queryClient.removeQueries({ 
          queryKey: ["dailyPrompt", currentGroupId],
          exact: false 
        })
        queryClient.removeQueries({ 
          queryKey: ["entries", currentGroupId],
          exact: false 
        })
        queryClient.removeQueries({ 
          queryKey: ["userEntry", currentGroupId],
          exact: false 
        })
        
        // Invalidate and refetch for new group
        queryClient.invalidateQueries({ 
          queryKey: ["dailyPrompt", currentGroupId],
          exact: false 
        })
        queryClient.invalidateQueries({ 
          queryKey: ["entries", currentGroupId],
          exact: false 
        })
        
        // Force refetch immediately
        queryClient.refetchQueries({ 
          queryKey: ["dailyPrompt", currentGroupId],
          exact: false 
        })
        
        // Clear switching state once data starts loading
        // Use a small delay to ensure queries have started
        setTimeout(() => {
          setIsGroupSwitching(false)
        }, 150)
      }
    }
    
    // Update ref for next render
    prevGroupIdRef.current = currentGroupId
  }, [currentGroupId, queryClient]) // Only depend on currentGroupId, not selectedDate

  // Check for unseen updates in each group (boolean - for dot indicator)
  const { data: groupUnseenStatus = {} } = useQuery({
    queryKey: ["groupUnseenStatus", groups.map((g) => g.id).join(","), userId],
    queryFn: async () => {
      if (groups.length === 0 || !userId) return {}
      const status: Record<string, boolean> = {}
      for (const group of groups) {
        if (group.id === currentGroupId) {
          status[group.id] = false // Current group is always "seen"
          continue
        }
        // Get last visit time
        const lastVisitStr = await AsyncStorage.getItem(`group_visited_${group.id}`)
        const lastVisit = lastVisitStr ? new Date(lastVisitStr) : null

        // Check for new entries by others since last visit
        const { data: recentEntries } = await supabase
          .from("entries")
          .select("created_at")
          .eq("group_id", group.id)
          .neq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        // Check for new daily prompts since last visit
        const { data: recentPrompt } = await supabase
          .from("daily_prompts")
          .select("created_at")
          .eq("group_id", group.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        const latestActivity = (recentEntries as any)?.created_at || (recentPrompt as any)?.created_at
        if (latestActivity) {
          const latestActivityDate = new Date(latestActivity)
          status[group.id] = !lastVisit || latestActivityDate > lastVisit
        } else {
          status[group.id] = false
        }
      }
      return status
    },
    enabled: groups.length > 0 && !!userId,
  })

  // Check for unseen entry counts in each group (for "X new answers" text)
  const { data: groupUnseenCount = {} } = useQuery({
    queryKey: ["groupUnseenCount", groups.map((g) => g.id).join(","), userId, currentGroupId],
    queryFn: async () => {
      if (groups.length === 0 || !userId) return {}
      const status: Record<string, { hasNew: boolean; newCount: number }> = {}
      
      for (const group of groups) {
        // Current group is always "seen" - no count
        if (group.id === currentGroupId) {
          status[group.id] = { hasNew: false, newCount: 0 }
          continue
        }
        
        // Get last visit time for this group
        const lastVisitStr = await AsyncStorage.getItem(`group_visited_${group.id}`)
        const lastVisit = lastVisitStr ? new Date(lastVisitStr) : null

        if (!lastVisit) {
          // No last visit - count all entries by others
          const { count, error } = await supabase
            .from("entries")
            .select("*", { count: "exact", head: true })
            .eq("group_id", group.id)
            .neq("user_id", userId)
          
          if (error) {
            status[group.id] = { hasNew: false, newCount: 0 }
          } else {
            status[group.id] = { hasNew: (count || 0) > 0, newCount: count || 0 }
          }
        } else {
          // Count entries by others since last visit
          // Use a small buffer (subtract 1 second) to account for timing issues
          const lastVisitWithBuffer = new Date(lastVisit.getTime() - 1000)
          
          const { count, error } = await supabase
            .from("entries")
            .select("*", { count: "exact", head: true })
            .eq("group_id", group.id)
            .neq("user_id", userId)
            .gt("created_at", lastVisitWithBuffer.toISOString())
          
          if (error) {
            status[group.id] = { hasNew: false, newCount: 0 }
          } else {
            status[group.id] = { hasNew: (count || 0) > 0, newCount: count || 0 }
          }
        }
      }
      
      return status
    },
    enabled: groups.length > 0 && !!userId,
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window comes into focus
    staleTime: 0, // Always consider data stale to ensure fresh counts
    refetchInterval: 30000, // Poll every 30 seconds to check for new entries
  })

  const { data: allPrompts = [] } = useQuery({
    queryKey: ["allPrompts"],
    queryFn: getAllPrompts,
  })

  const { data: members = [] } = useQuery({
    queryKey: ["members", currentGroupId],
    queryFn: () => (currentGroupId ? getGroupMembers(currentGroupId) : []),
    enabled: !!currentGroupId,
    staleTime: 0, // Always refetch to ensure avatars are up to date
    refetchOnMount: true, // Refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when screen comes into focus
  })

  // Preload prompts for all week dates when group changes to prevent glitching
  useEffect(() => {
    if (currentGroupId && userId) {
      const weekDatesForPrefetch = getWeekDates()
      // Preload prompts for all dates in the week
      weekDatesForPrefetch.forEach((day) => {
        queryClient.prefetchQuery({
          queryKey: ["dailyPrompt", currentGroupId, day.date, userId],
          queryFn: () => getDailyPrompt(currentGroupId, day.date, userId),
          staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        })
      })
    }
  }, [currentGroupId, userId, queryClient])

  // Preload prompt for selected date when it changes to prevent glitching
  useEffect(() => {
    if (currentGroupId && userId && selectedDate) {
      queryClient.prefetchQuery({
        queryKey: ["dailyPrompt", currentGroupId, selectedDate, userId],
        queryFn: () => getDailyPrompt(currentGroupId, selectedDate, userId),
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
      })
    }
  }, [selectedDate, currentGroupId, userId, queryClient])

  const { data: dailyPrompt, isLoading: isLoadingPrompt, isFetching: isFetchingPrompt } = useQuery({
    queryKey: ["dailyPrompt", currentGroupId, selectedDate, userId],
    queryFn: () => (currentGroupId ? getDailyPrompt(currentGroupId, selectedDate, userId) : null),
    enabled: !!currentGroupId && !!selectedDate, // Always enabled when group and date are available
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes to prevent glitching during date navigation
    gcTime: 10 * 60 * 1000, // Keep cache for 10 minutes for smooth date navigation
    refetchOnMount: false, // Don't refetch on mount if data is cached (prevents flash)
    refetchOnWindowFocus: false, // Don't refetch on focus (prevents flash)
    // Don't use placeholder data from different dates - this causes glitching
    placeholderData: undefined,
  })

  const { data: userEntry } = useQuery({
    queryKey: ["userEntry", currentGroupId, userId, selectedDate],
    queryFn: () => (currentGroupId && userId ? getUserEntryForDate(currentGroupId, userId, selectedDate) : null),
    enabled: !!currentGroupId && !!userId,
  })

  // Get today's date - call directly to ensure fresh value
  const todayDate = getTodayDate()
  
  // Get previous day's date (yesterday relative to TODAY, not selectedDate)
  // This ensures CTA logic works correctly when user is viewing today
  // Calculate directly without memoization to ensure it's always fresh
  const previousDate = getPreviousDay(todayDate)
  
  // Debug: Log the calculation directly
  if (__DEV__) {
    console.log("[previousDate calculation]", {
      todayDate,
      previousDate,
      calculated: getPreviousDay(todayDate),
    })
  }

  // Query for previous day's entries (always fetch on boot/refresh)
  // Include todayDate in query key to force refetch when date changes
  const { data: previousDayEntries = [], isLoading: isLoadingPreviousDayEntries, isFetching: isFetchingPreviousDayEntries } = useQuery({
    queryKey: ["entries", currentGroupId, previousDate, todayDate],
    queryFn: () => (currentGroupId ? getEntriesForDate(currentGroupId, previousDate) : []),
    enabled: !!currentGroupId, // Enable as soon as group is available
    staleTime: 0, // Always refetch to ensure fresh data when date changes
  })
 
  // Check if user answered previous day (always fetch on boot/refresh)
  // Include todayDate in query key to force refetch when date changes
  const { data: previousDayUserEntry, isLoading: isLoadingPreviousDayUserEntry, isFetching: isFetchingPreviousDayUserEntry } = useQuery({
    queryKey: ["userEntry", currentGroupId, userId, previousDate, todayDate],
    queryFn: () => (currentGroupId && userId ? getUserEntryForDate(currentGroupId, userId, previousDate) : null),
    enabled: !!currentGroupId && !!userId, // Enable as soon as group and user are available
    staleTime: 0, // Always refetch to ensure fresh data when date changes
  })

  // Only show loading state when actually switching groups, not during normal date navigation
  const isLoadingGroupData = isGroupSwitching

  const currentGroup = groups.find((g) => g.id === currentGroupId)

  // Derive group creation date (local) and group age in days
  // Note: todayDate is already defined above for previousDate calculation
  const createdDateLocal = useMemo(() => {
    if (!currentGroup?.created_at) return todayDate
    try {
      // Convert Supabase UTC timestamp to local calendar date
      const localFromUtc = utcStringToLocalDate(currentGroup.created_at)

      // Heuristic: if the group was created very recently (within the last 24h),
      // always treat the creation day as "today" for the timeline, even if the
      // raw UTC->local conversion would land on "yesterday" due to timezone.
      const createdAtUtc = new Date(currentGroup.created_at)
      const now = new Date()
      const msSinceCreation = now.getTime() - createdAtUtc.getTime()
      const oneDayMs = 24 * 60 * 60 * 1000

      if (msSinceCreation >= 0 && msSinceCreation < oneDayMs) {
        return todayDate
      }

      return localFromUtc
    } catch {
      return todayDate
    }
  }, [currentGroup?.created_at, todayDate])

  const groupAgeDays = useMemo(() => {
    try {
      const created = new Date(createdDateLocal)
      const today = new Date(todayDate)
      const createdMidnight = new Date(created); createdMidnight.setHours(0, 0, 0, 0)
      const todayMidnight = new Date(today); todayMidnight.setHours(0, 0, 0, 0)
      const diffMs = todayMidnight.getTime() - createdMidnight.getTime()
      return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
    } catch {
      return 0
    }
  }, [createdDateLocal, todayDate])

  // Build 7-day timeline:
  // - If groupAgeDays < 7: [startDate .. startDate+6]
  // - Else: [today-6 .. today]
  const weekDates = useMemo(() => {
    const dates: { date: string; day: string; dayNum: number }[] = []
    if (!currentGroup) {
      return getWeekDates()
    }

    // For truly "brand new" groups (no full day of age yet), the timeline
    // should start at *today* even if created_at/UTC math might suggest
    // a previous calendar day. After the first full day, we respect
    // the real creation date.
    const startDateForTimeline =
      groupAgeDays === 0 ? todayDate : createdDateLocal

    if (groupAgeDays < 7) {
      // For very new groups, timeline starts at startDateForTimeline and shows 6 following days
      let cursor = new Date(`${startDateForTimeline}T00:00:00`)
      for (let i = 0; i < 7; i++) {
        const d = new Date(cursor)
        dates.push({
          date: formatDateAsLocalISO(d),
          day: d.toLocaleDateString(undefined, { weekday: "short" }),
          dayNum: d.getDate(),
        })
        cursor.setDate(cursor.getDate() + 1)
      }
    } else {
      // After 7 days, show rolling window: today-6 .. today
      const today = new Date(`${todayDate}T00:00:00`)
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(today.getDate() - i)
        dates.push({
          date: formatDateAsLocalISO(d),
          day: d.toLocaleDateString(undefined, { weekday: "short" }),
          dayNum: d.getDate(),
        })
      }
    }

    return dates
  }, [currentGroup, createdDateLocal, groupAgeDays, todayDate])

  // Fetch user entries for all week dates to show check marks
  const weekDatesList = weekDates.map((d) => d.date)
  const { data: userEntriesForWeek = [] } = useQuery({
    queryKey: ["userEntriesForWeek", currentGroupId, userId, weekDatesList.join(",")],
    queryFn: async () => {
      if (!currentGroupId || !userId) return []
      // Fetch entries for all week dates
      const entries = await Promise.all(
        weekDatesList.map((date) => getUserEntryForDate(currentGroupId, userId, date))
      )
      return entries.filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    },
    enabled: !!currentGroupId && !!userId && weekDatesList.length > 0,
  })
  
  // Create a Set of dates where user has entries for quick lookup
  const userEntryDates = useMemo(() => {
    return new Set(userEntriesForWeek.map((entry) => entry.date))
  }, [userEntriesForWeek])

  const { data: entries = [], isLoading: isLoadingEntries, isFetching: isFetchingEntries } = useQuery({
    queryKey: ["entries", currentGroupId, selectedDate],
    queryFn: () => (currentGroupId ? getEntriesForDate(currentGroupId, selectedDate) : []),
    enabled: !!currentGroupId, // Always enabled when group is available
    staleTime: 0, // Always refetch to ensure data matches database
    gcTime: 2 * 60 * 1000, // Keep cache for 2 minutes for smooth date navigation
    refetchOnMount: true, // Always refetch on mount to ensure fresh data
    refetchOnWindowFocus: true, // Refetch on focus to catch any updates
    // Never show placeholder data from different group/date
    placeholderData: undefined,
  })

  // Check for custom question opportunity (only on today's date)
  const isToday = selectedDate === todayDate
  const isFuture = selectedDate > todayDate
  const { data: customQuestionOpportunity } = useQuery({
    queryKey: ["customQuestionOpportunity", currentGroupId, selectedDate, userId],
    queryFn: () =>
      currentGroupId && userId && isToday
        ? getCustomQuestionOpportunity(userId, currentGroupId, selectedDate)
        : null,
    enabled: !!currentGroupId && !!userId && isToday,
  })

  // Check if user has seen onboarding
  const { data: hasSeenOnboarding } = useQuery({
    queryKey: ["hasSeenCustomQuestionOnboarding", userId],
    queryFn: () => (userId ? hasSeenCustomQuestionOnboarding(userId) : Promise.resolve(false)),
    enabled: !!userId,
  })

  // Check if current prompt is a custom question
  const isCustomQuestion = dailyPrompt?.prompt?.is_custom === true
  const customQuestionData = (dailyPrompt?.prompt as any)?.customQuestion

  // Get pending votes for deck voting
  const { data: pendingVotes = [] } = useQuery({
    queryKey: ["pendingVotes", currentGroupId, userId],
    queryFn: () => (currentGroupId && userId ? getPendingVotes(currentGroupId, userId) : []),
    enabled: !!currentGroupId && !!userId,
    staleTime: 0, // Always refetch to ensure fresh data
    refetchOnMount: true, // Refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when screen comes into focus
  })

  // Get deck info if prompt has deck_id
  const { data: deckInfo } = useQuery({
    queryKey: ["deckInfo", dailyPrompt?.deck_id],
    queryFn: () => (dailyPrompt?.deck_id ? getDeckDetails(dailyPrompt.deck_id) : null),
    enabled: !!dailyPrompt?.deck_id,
  })

  // In dev mode, show banner if force toggle is enabled
  const [devForceCustomQuestion, setDevForceCustomQuestion] = useState(false)
  
  useEffect(() => {
    async function loadDevSettings() {
      if (__DEV__) {
        const forceCustomQuestion = await AsyncStorage.getItem("dev_force_custom_question")
        setDevForceCustomQuestion(forceCustomQuestion === "true")
      }
    }
    loadDevSettings()
  }, [])

  // Reload dev settings when screen comes into focus (so toggle changes take effect immediately)
  useFocusEffect(
    useCallback(() => {
      async function reloadDevSettings() {
        if (__DEV__) {
          const forceCustomQuestion = await AsyncStorage.getItem("dev_force_custom_question")
          setDevForceCustomQuestion(forceCustomQuestion === "true")
        }
      }
      reloadDevSettings()
    }, [])
  )

  // Birthday Card Queries
  // Use today's date for upcoming birthday cards (not selectedDate) - banners should show based on actual today
  // Debug: Log query enablement
  useEffect(() => {
    console.log("[home] Birthday cards query params:", {
      currentGroupId,
      userId,
      todayDate,
      enabled: !!(currentGroupId && userId && todayDate)
    })
  }, [currentGroupId, userId, todayDate])
  
  const { data: upcomingBirthdayCards = [], error: upcomingCardsError, isLoading: upcomingCardsLoading } = useQuery({
    queryKey: ["upcomingBirthdayCards", currentGroupId, userId, todayDate],
    queryFn: async () => {
      console.log("[home] ⭐ Birthday cards queryFn called with:", { currentGroupId, userId, todayDate })
      if (!currentGroupId || !userId || !todayDate) {
        console.log("[home] ❌ Birthday cards query skipped - missing params:", { currentGroupId, userId, todayDate })
        return []
      }
      console.log("[home] ✅ Fetching upcoming birthday cards:", { currentGroupId, userId, todayDate })
      try {
        const cards = await getUpcomingBirthdayCards(currentGroupId, userId, todayDate)
        console.log("[home] ✅ Received upcoming birthday cards:", cards.length, cards)
        return cards
      } catch (error) {
        console.error("[home] ❌ Error fetching upcoming birthday cards:", error)
        throw error
      }
    },
    enabled: !!currentGroupId && !!userId && !!todayDate,
  })
  
  // Log query state
  useEffect(() => {
    console.log("[home] Birthday cards query state:", {
      isLoading: upcomingCardsLoading,
      error: upcomingCardsError,
      cardsCount: upcomingBirthdayCards?.length || 0,
      cards: upcomingBirthdayCards
    })
  }, [upcomingCardsLoading, upcomingCardsError, upcomingBirthdayCards])

  const { data: myCardEntries = [] } = useQuery({
    queryKey: ["myCardEntries", currentGroupId, userId, selectedDate],
    queryFn: () => (currentGroupId && userId && selectedDate ? getMyCardEntriesForDate(currentGroupId, userId, selectedDate) : []),
    enabled: !!currentGroupId && !!userId && !!selectedDate,
  })

  const { data: myBirthdayCard } = useQuery({
    queryKey: ["myBirthdayCard", currentGroupId, userId, selectedDate],
    queryFn: () => (currentGroupId && userId && selectedDate ? getMyBirthdayCard(currentGroupId, userId, selectedDate) : null),
    enabled: !!currentGroupId && !!userId && !!selectedDate,
  })

  // Get contributor avatars for "Your Card" banner
  const { data: cardEntries = [] } = useQuery({
    queryKey: ["birthdayCardEntries", myBirthdayCard?.id],
    queryFn: () => (myBirthdayCard?.id ? getBirthdayCardEntries(myBirthdayCard.id) : []),
    enabled: !!myBirthdayCard?.id,
  })

  // Show banner if:
  // 1. User has a real custom question opportunity (show regardless of whether they've posted daily entry), OR
  // 2. Dev mode is enabled (show even if user has posted, for testing)
  // The banner stays visible until the user creates the custom question (opportunity disappears when date_asked is set)
  const shouldShowCustomQuestionBanner = 
    isToday && 
    currentGroupId &&
    (
      customQuestionOpportunity || // Real opportunity - show until they create the question
      (__DEV__ && devForceCustomQuestion) // Dev mode: show regardless
    )

  async function handleCustomQuestionPress() {
    if (!currentGroupId || !userId) return

    // In dev mode, always show onboarding for testing
    if (__DEV__ && devForceCustomQuestion) {
      router.push({
        pathname: "/(main)/custom-question-onboarding",
        params: {
          groupId: currentGroupId,
          date: selectedDate,
        },
      })
      return
    }

    // Check if user has seen onboarding
    const seenOnboarding = await hasSeenCustomQuestionOnboarding(userId)
    if (!seenOnboarding) {
      router.push({
        pathname: "/(main)/custom-question-onboarding",
        params: {
          groupId: currentGroupId,
          date: selectedDate,
        },
      })
    } else {
      router.push({
        pathname: "/(main)/add-custom-question",
        params: {
          groupId: currentGroupId,
          date: selectedDate,
        },
      })
    }
  }

  const otherEntries = entries.filter((entry) => entry.user_id !== userId)
  const entryIdList = entries.map((item) => item.id)
  const basePrompt = dailyPrompt?.prompt ?? entries[0]?.prompt

  // Fetch memorials ALWAYS (needed to filter fallback prompts)
  const { data: memorials = [] } = useQuery({
    queryKey: ["memorials", currentGroupId],
    queryFn: () => (currentGroupId ? getMemorials(currentGroupId) : []),
    enabled: !!currentGroupId,
  })

  // Filter fallback prompts to exclude Remembering category for groups without memorials
  const availableFallbackPrompts = useMemo(() => {
    if (!allPrompts.length) return []
    
    // If group has memorials, all prompts are available
    // If group doesn't have memorials, filter out Remembering category
    if (memorials.length === 0) {
      return allPrompts.filter((p: any) => p.category !== "Remembering")
    }
    
    return allPrompts
  }, [allPrompts, memorials])

  const fallbackPrompt =
    basePrompt ??
    (availableFallbackPrompts.length > 0
      ? availableFallbackPrompts[Math.abs(getDayIndex(selectedDate, currentGroupId)) % availableFallbackPrompts.length]
      : undefined)

  const promptId = dailyPrompt?.prompt_id ?? entries[0]?.prompt_id ?? fallbackPrompt?.id

  const { data: groupMembersForVariables = [] } = useQuery({
    queryKey: ["membersForVariables", currentGroupId],
    queryFn: () => (currentGroupId ? getGroupMembers(currentGroupId) : []),
    enabled: !!currentGroupId && !!(fallbackPrompt?.question?.match(/\{.*member_name.*\}/i)),
  })

  // Personalize prompt question with variables
  const personalizedPromptQuestion = useMemo(() => {
    if (!fallbackPrompt?.question) return fallbackPrompt?.question
    
    // CRITICAL FIX: If this prompt came from getDailyPrompt, it's ALREADY personalized correctly
    // NEVER re-personalize it - this prevents switching memorial names after user answers
    // getDailyPrompt selects the correct memorial based on prompt_name_usage and deterministic logic
    // Re-personalizing here would overwrite the correct name with the wrong one
    
    // BULLETPROOF CHECK: If dailyPrompt exists, use its question directly - never re-personalize
    // This is the single most important safeguard against memorial name switching
    if (dailyPrompt?.prompt?.question) {
      // Check if the question is already personalized (no variables)
      const hasVariables = dailyPrompt.prompt.question.match(/\{.*memorial_name.*\}/i) || 
                          dailyPrompt.prompt.question.match(/\{.*member_name.*\}/i)
      
      if (!hasVariables) {
        // Already personalized correctly by getDailyPrompt - use it EXACTLY as-is
        // This prevents ANY possibility of name switching
        return dailyPrompt.prompt.question
      } else {
        // This is a bug in getDailyPrompt - it should have personalized but didn't
        // Log error but still use the question from getDailyPrompt (don't re-personalize)
        console.error(`[home] CRITICAL: getDailyPrompt returned unpersonalized question with variables. This is a bug in getDailyPrompt.`)
        // Still return the question from getDailyPrompt - don't re-personalize here
        // The bug needs to be fixed in getDailyPrompt, not worked around here
        return dailyPrompt.prompt.question
      }
    }
    
    // Only reach here if dailyPrompt doesn't exist (fallback prompt scenario)
    
    // Only personalize if this is a fallback prompt (not from getDailyPrompt)
    let question = fallbackPrompt.question
    const variables: Record<string, string> = {}
    
    // Handle memorial_name variable (only for fallback prompts)
    if (question.match(/\{.*memorial_name.*\}/i)) {
      if (memorials.length > 0) {
        // CRITICAL: Use the SAME deterministic logic as getDailyPrompt to select memorial
        // This ensures consistency - never use memorials[0] which could be wrong person
        // Match the exact logic from lib/db.ts getDailyPrompt function
        const dayIndex = getDayIndex(selectedDate, currentGroupId || "")
        
        // For fallback prompts, we don't have prompt_name_usage data easily accessible
        // So we use a simplified version: cycle through memorials based on date
        // This is deterministic and will match getDailyPrompt's selection if no usage data exists
        const memorialIndex = dayIndex % memorials.length
        const selectedMemorialName = memorials[memorialIndex]?.name
        
        if (selectedMemorialName) {
          question = personalizeMemorialPrompt(question, selectedMemorialName)
        } else {
          // This should never happen, but safety fallback
          console.error(`[home] Memorial selection failed - no memorials available`)
          return "Share a moment that made you smile today."
        }
      } else {
        // SAFETY CHECK: If we somehow have a memorial_name prompt but no memorials,
        // don't show the raw variable - return a fallback message
        console.warn(`[home] Found memorial_name prompt but group has no memorials. Showing fallback.`)
        return "Share a moment that made you smile today."
      }
    }
    
    // Handle member_name variable
    if (question.match(/\{.*member_name.*\}/i) && groupMembersForVariables.length > 0) {
      // For now, use first member (could be improved to cycle)
      variables.member_name = groupMembersForVariables[0].user?.name || "them"
      question = replaceDynamicVariables(question, variables)
    }
    
    return question
  }, [fallbackPrompt?.question, memorials, groupMembersForVariables, dailyPrompt, currentGroupId, selectedDate])

  // Check if CTA should show (load immediately, not waiting for scroll)
  // Only show when viewing today's date
  // Wait for queries to complete before evaluating (check both isLoading and isFetching)
  // Also verify previousDayUserEntry actually belongs to current user (safety check)
  const hasPreviousDayUserEntry = previousDayUserEntry && previousDayUserEntry.user_id === userId
  const shouldShowCTA = !isLoadingPreviousDayEntries &&
                       !isFetchingPreviousDayEntries &&
                       !isLoadingPreviousDayUserEntry &&
                       !isFetchingPreviousDayUserEntry &&
                       isToday &&
                       userEntry && 
                       !hasPreviousDayUserEntry && 
                       previousDayEntries.length > 0 && 
                       previousDayEntries.some(e => e.user_id !== userId)

  // Debug logging (remove after fixing)
  useEffect(() => {
    if (__DEV__ && isToday) {
      console.log("[CTA Debug]", {
        isLoadingPreviousDayEntries,
        isFetchingPreviousDayEntries,
        isLoadingPreviousDayUserEntry,
        isFetchingPreviousDayUserEntry,
        isToday,
        selectedDate,
        todayDate,
        hasUserEntry: !!userEntry,
        hasPreviousDayUserEntry: !!previousDayUserEntry,
        previousDayUserEntry: previousDayUserEntry ? {
          id: previousDayUserEntry.id,
          user_id: previousDayUserEntry.user_id,
          date: previousDayUserEntry.date,
          created_at: previousDayUserEntry.created_at,
        } : null,
        hasPreviousDayUserEntryCheck: hasPreviousDayUserEntry,
        currentUserId: userId,
        previousDayEntriesCount: previousDayEntries.length,
        previousDayEntries: previousDayEntries.map(e => ({ id: e.id, user_id: e.user_id, date: e.date })),
        previousDate,
        hasOtherUsersEntries: previousDayEntries.some(e => e.user_id !== userId),
        shouldShowCTA,
        conditionBreakdown: {
          queriesLoaded: !isLoadingPreviousDayEntries && !isFetchingPreviousDayEntries && !isLoadingPreviousDayUserEntry && !isFetchingPreviousDayUserEntry,
          isToday,
          hasUserEntry: !!userEntry,
          noPreviousDayUserEntry: !hasPreviousDayUserEntry,
          hasPreviousDayEntries: previousDayEntries.length > 0,
          hasOtherUsersEntries: previousDayEntries.some(e => e.user_id !== userId),
        },
      })
    }
  }, [isLoadingPreviousDayEntries, isFetchingPreviousDayEntries, isLoadingPreviousDayUserEntry, isFetchingPreviousDayUserEntry, isToday, selectedDate, todayDate, userEntry, previousDayUserEntry, previousDayEntries, previousDate, userId, shouldShowCTA, hasPreviousDayUserEntry])

  // Format names for CTA text
  const getPreviousDayCTAText = () => {
    if (!shouldShowCTA) return ""
    
    const otherUsersEntries = previousDayEntries.filter(e => e.user_id !== userId)
    const uniqueUsers = Array.from(new Set(otherUsersEntries.map(e => e.user?.name).filter(Boolean)))
    
    if (uniqueUsers.length === 0) return "See what others said yesterday."
    if (uniqueUsers.length === 1) return `See what ${uniqueUsers[0]} said yesterday.`
    if (uniqueUsers.length === 2) return `See what ${uniqueUsers[0]} and ${uniqueUsers[1]} said yesterday.`
    // 3 or more
    return `See what ${uniqueUsers.slice(0, -1).join(", ")}, and ${uniqueUsers[uniqueUsers.length - 1]} said yesterday.`
  }

  async function handleRefresh() {
    setRefreshing(true)
    // Show spinner immediately when refresh starts
    setShowRefreshIndicator(true)
    try {
      // Ensure session is valid before refreshing data
      const { ensureValidSession } = await import("../../lib/auth")
      await ensureValidSession()
      
      // Aggressively clear all caches and refetch for current group
      if (currentGroupId) {
        // Clear all queries for current group to ensure fresh data
        queryClient.removeQueries({ 
          queryKey: ["dailyPrompt", currentGroupId],
          exact: false 
        })
        queryClient.removeQueries({ 
          queryKey: ["entries", currentGroupId],
          exact: false 
        })
        queryClient.removeQueries({ 
          queryKey: ["userEntry", currentGroupId],
          exact: false 
        })
      }
      await queryClient.invalidateQueries()
      await queryClient.refetchQueries()
      
      // Keep spinner visible for at least 1 second total
      setTimeout(() => {
        setShowRefreshIndicator(false)
      }, 1000)
    } catch (error) {
      console.error("[home] Error during refresh:", error)
      // Don't block UI if refresh fails
      setShowRefreshIndicator(false)
    } finally {
      setRefreshing(false)
    }
  }

  async function handleShareInvite() {
    if (!currentGroupId || !userName) return
    try {
      const inviteLink = `https://thegoodtimes.app/join/${currentGroupId}`
      const inviteMessage = `I've created a group for us on this new app, Good Times. Join ${userName} here: ${inviteLink}`
      await Share.share({
        url: inviteLink,
        message: inviteMessage,
        title: "Good Times Invite",
      })
    } catch (error: any) {
      Alert.alert("Error", error.message)
    }
  }

  function handleAnswerPrompt() {
    if (!promptId || !currentGroupId) {
      Alert.alert("No prompt available", "Please check back shortly — today's prompt is still loading.")
      return
    }
    
    // Track opened_daily_question event
    safeCapture(posthog, "opened_daily_question")
    
    router.push({
      pathname: "/(main)/modals/entry-composer",
      params: {
        promptId,
        date: selectedDate,
        groupId: currentGroupId, // Pass current group ID explicitly
      },
    })
  }

  async function handleSelectGroup(groupId: string) {
    if (groupId !== currentGroupId) {
      const oldGroupId = currentGroupId
      
      // Track switched_group event
      safeCapture(posthog, "switched_group", {
        from_group_id: oldGroupId || "",
        to_group_id: groupId,
      })
      
      // Set loading state immediately to prevent flash
      setIsGroupSwitching(true)
      
      // Clear all cached data for the old group BEFORE switching
      if (oldGroupId) {
        queryClient.removeQueries({ 
          queryKey: ["dailyPrompt", oldGroupId],
          exact: false 
        })
        queryClient.removeQueries({ 
          queryKey: ["entries", oldGroupId],
          exact: false 
        })
        queryClient.removeQueries({ 
          queryKey: ["userEntry", oldGroupId],
          exact: false 
        })
      }
      
      // Switch to new group
      setCurrentGroupId(groupId)
      setSelectedDate(getTodayDate()) // Reset to today when switching groups
      
      // Persist current group ID to prevent loss on navigation
      await AsyncStorage.setItem("current_group_id", groupId)
      // Mark group as visited
      await AsyncStorage.setItem(`group_visited_${groupId}`, new Date().toISOString())
      
      // Clear and invalidate all queries for the new group to ensure fresh data
      queryClient.removeQueries({ 
        queryKey: ["dailyPrompt", groupId],
        exact: false 
      })
      queryClient.removeQueries({ 
        queryKey: ["entries", groupId],
        exact: false 
      })
      queryClient.removeQueries({ 
        queryKey: ["userEntry", groupId],
        exact: false 
      })
      
      // Force immediate refetch
      queryClient.refetchQueries({ 
        queryKey: ["dailyPrompt", groupId],
        exact: false 
      })
    }
    setGroupPickerVisible(false)
  }

  // Track previous group ID to detect actual switches (not initial load)
  const visitedGroupRef = useRef<string | undefined>(undefined)

  // Mark current group as visited when it becomes active (only on explicit switches)
  useEffect(() => {
    if (currentGroupId) {
      // Only set timestamp if this is an actual group switch (not initial load)
      if (visitedGroupRef.current !== undefined && visitedGroupRef.current !== currentGroupId) {
        // User switched from one group to another
      AsyncStorage.setItem(`group_visited_${currentGroupId}`, new Date().toISOString())
      }
      // Update ref for next comparison
      visitedGroupRef.current = currentGroupId
    }
  }, [currentGroupId])

  function handleCreateGroupSoon() {
    setGroupPickerVisible(false)
    router.push("/(onboarding)/start-new-group")
  }

  // Calculate full header height including day scroller
  // Reduced bottom spacing to minimize gap between header and content
  const headerHeight = useMemo(() => {
    return insets.top + spacing.xl + spacing.md + 36 + spacing.md + 32 + spacing.md + 48 + spacing.md + spacing.sm + 48 + spacing.xs
  }, [insets.top])

  useEffect(() => {
    // Set initial padding to header height minus extra bottom spacing
    // The header is absolutely positioned, so we need padding to account for it
    // but we reduce the bottom padding to minimize gap between header and content
    const reducedPadding = headerHeight - spacing.lg // Remove extra bottom spacing
    contentPaddingTop.setValue(reducedPadding)
  }, [headerHeight])

  // Reset scroll position and header when selectedDate changes (e.g., clicking CTA to view previous day)
  useEffect(() => {
    const reducedPadding = headerHeight - spacing.lg
    
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
        toValue: reducedPadding,
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
  }, [selectedDate, headerHeight, scrollY])

  // Reset animated values and scroll position when screen comes into focus (fixes content cut off when navigating back)
  useFocusEffect(
    useCallback(() => {
      const reducedPadding = headerHeight - spacing.lg
      
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
          toValue: reducedPadding,
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
            toValue: -(headerHeight + 100), // Hide entire header including day scroller
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(contentPaddingTop, {
            toValue: spacing.md, // Minimal padding when header hidden
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

  // Create dynamic styles based on theme
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.black,
    },
    header: {
      paddingTop: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingBottom: 0, // Remove bottom padding to minimize gap
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.gray[800] : "#000000",
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.black,
      zIndex: 10,
    },
    headerTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.md,
    },
    groupSelector: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    groupName: {
      ...typography.h2,
      fontSize: 22,
      color: colors.white,
    },
    chevron: {
      ...typography.body,
      fontSize: 12,
      color: isDark ? "#ffffff" : "#000000",
    },
    membersScroll: {
      marginBottom: spacing.md,
    },
    memberAvatar: {
      marginRight: spacing.sm,
    },
    addMemberButton: {
      marginRight: spacing.sm,
    },
    addMemberCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.gray[700],
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: colors.gray[600],
    },
    addMemberText: {
      ...typography.h2,
      fontSize: 20,
      color: colors.white,
    },
    dayScroller: {
      marginTop: spacing.sm,
      paddingVertical: spacing.sm,
    },
    dayButton: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      marginRight: spacing.xs,
      alignItems: "center",
      minWidth: 48,
    },
    dayButtonSelected: {
      borderWidth: 2,
      borderRadius: 4,
      borderColor: colors.white,
    },
    dayButtonFuture: {
      opacity: 0.5,
    },
    dayText: {
      ...typography.caption,
      fontSize: 12,
      marginBottom: spacing.xs,
      color: colors.white,
    },
    dayTextSelected: {
      color: colors.white,
    },
    dayTextFuture: {
      color: colors.gray[400],
    },
    dayNum: {
      ...typography.bodyBold,
      fontSize: 16,
      color: colors.white,
    },
    dayNumSelected: {
      color: colors.white,
    },
    dayNumFuture: {
      color: colors.gray[500],
    },
    content: {
      flex: 1,
      // No marginTop - header will overlay content when visible
    },
    contentContainer: {
      paddingTop: 0, // No static padding - animated contentPaddingTop handles it
      paddingBottom: spacing.xxl * 4, // Increased bottom padding for scrolling
    },
    promptCardWrapper: {
      marginBottom: 0, // No margin - entries start immediately after
      width: "100%",
    },
    promptDivider: {
      width: "100%",
      height: 1,
      backgroundColor: isDark ? "#3D3D3D" : "#E5E5E5", // Lighter divider in light mode
    },
    promptCard: {
      backgroundColor: colors.black,
      padding: spacing.lg,
    },
    futureImage: {
      width: "100%",
      height: 120,
      marginBottom: spacing.md,
      alignSelf: "center",
    },
    futurePromptQuestion: {
      textAlign: "center",
    },
    futurePromptDescription: {
      textAlign: "center",
    },
    promptQuestion: {
      ...typography.h3,
      fontSize: 22,
      marginBottom: spacing.sm,
      color: colors.white,
      fontFamily: "LibreBaskerville-Bold", // Explicitly set Baskerville Bold for Android compatibility
    },
  promptDescription: {
    ...typography.body,
    color: colors.gray[400],
    marginBottom: spacing.md,
  },
  customQuestionBanner: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[800],
  },
  customQuestionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  customQuestionLabel: {
    ...typography.bodyMedium,
    fontSize: 14,
    color: colors.gray[400],
    marginLeft: spacing.sm,
  },
  loadingContainer: {
      padding: spacing.lg,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 100,
    },
    loadingText: {
      ...typography.body,
      color: colors.gray[400],
    },
    answerButton: {
      marginTop: spacing.md,
    },
    lockedMessage: {
      padding: spacing.xl,
      alignItems: "center",
      gap: spacing.xs,
    },
    lockedText: {
      ...typography.body,
      textAlign: "center",
      color: colors.gray[500],
    },
    entriesContainer: {
      gap: spacing.lg,
      marginTop: -spacing.xl, // Large negative margin to pull entries right up to divider
    },
    entriesContainerWithBanners: {
      marginTop: spacing.lg, // Add padding when any banners are shown to prevent overlap
    },
    postingStatusContainer: {
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      alignItems: "center",
    },
    postingStatusText: {
      ...typography.body,
      color: colors.gray[400],
      textAlign: "center",
    },
    notice: {
      marginBottom: spacing.lg, // Add space between notice and question card divider
      paddingHorizontal: spacing.md,
    },
    noticeText: {
      ...typography.body,
      color: colors.gray[300],
    },
    groupModalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.85)",
      justifyContent: "flex-end",
    },
    groupModalSheet: {
      backgroundColor: colors.black,
      padding: spacing.lg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      gap: spacing.md,
      maxHeight: "70%",
    },
    groupModalTitle: {
      ...typography.h2,
      color: colors.white,
      fontSize: 24,
    },
    groupList: {
      gap: spacing.sm,
    },
    groupRowContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    groupRowFlex: {
      flex: 1,
    },
    groupRow: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderRadius: 12,
      backgroundColor: colors.gray[900],
      flex: 1,
    },
    groupRowActive: {
      borderWidth: 1,
      borderColor: colors.white,
    },
    groupRowContent: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      flex: 1,
    },
    groupSettingsButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.gray[900],
      justifyContent: "center",
      alignItems: "center",
    },
    groupRowText: {
      ...typography.bodyBold,
      color: colors.white,
      fontSize: 18,
      flex: 1,
    },
    unseenDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.accent,
      marginLeft: spacing.sm,
    },
    newAnswersText: {
      ...typography.body,
      color: colors.gray[400],
      fontSize: 14,
      marginLeft: spacing.sm,
      marginRight: spacing.md, // Extra padding between text and end of button
    },
    createGroupButton: {
      paddingVertical: spacing.md,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.gray[700],
      borderRadius: 12,
    },
    createGroupText: {
      ...typography.bodyBold,
      color: colors.white,
    },
    voteBannerWrapper: {
      marginBottom: spacing.md, // Reduced padding below banner (50% of xl)
      zIndex: 10, // Ensure banner renders above entries
      elevation: 10, // Android elevation
    },
    voteBanner: {
      backgroundColor: colors.gray[900],
      paddingRight: spacing.md,
      paddingLeft: spacing.md, // Add left padding
      paddingVertical: spacing.sm, // Reduced vertical padding (50% of md)
      borderRadius: 0, // Square edges
      borderWidth: 1,
      borderColor: isDark ? "#ffffff" : "#000000", // White in dark mode, black in light mode
      marginHorizontal: spacing.lg,
      marginTop: spacing.xs,
      flexDirection: "row",
      alignItems: "center", // Center content vertically
      justifyContent: "space-between",
      minHeight: 80, // Minimum height, can grow with content
    },
    voteBannerContent: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
    },
    voteBannerIconContainer: {
      marginRight: spacing.md,
      justifyContent: "center",
      alignItems: "center",
    },
    voteBannerIcon: {
      width: 60, // Smaller, not square - with padding
      height: 60,
      borderRadius: 4, // Slight rounding
    },
    voteBannerTextContainer: {
      flex: 1,
    },
    voteBannerSubtext: {
      ...typography.body,
      fontSize: 14,
      color: colors.gray[300],
      opacity: 0.9,
      marginBottom: spacing.xs,
    },
    voteBannerText: {
      ...typography.bodyBold,
      fontSize: 16,
      color: isDark ? "#ffffff" : "#000000",
    },
    voteBannerChevron: {
      marginLeft: spacing.md,
      alignSelf: "center", // Center chevron vertically
    },
    refreshIndicator: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: spacing.md, // Reduced by 50% from spacing.xl (32) to spacing.md (16)
      paddingBottom: spacing.lg,
      marginBottom: spacing.sm,
      minHeight: 60,
      width: "100%",
    },
    previousDayCTA: {
      marginTop: spacing.sm,
      marginBottom: spacing.lg + spacing.md, // Extra padding below CTA
      marginHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      paddingLeft: spacing.md,
      paddingRight: spacing.md,
      backgroundColor: isDark ? colors.gray[900] : colors.gray[800], // Light gray in light mode
      borderRadius: 0,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      minHeight: 80,
    },
    previousDayCTAText: {
      ...typography.body,
      color: isDark ? "#ffffff" : "#000000",
      fontSize: 14,
      textAlign: "center",
    },
  }), [colors, isDark])

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
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.groupSelector} onPress={() => setGroupPickerVisible(true)}>
            <Text style={styles.groupName}>{currentGroup?.name || "Loading..."}</Text>
            <Text style={styles.chevron}>▼</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/(main)/settings")}>
            <Avatar uri={userAvatarUrl} name={userName} size={36} />
          </TouchableOpacity>
        </View>

        {/* Member avatars with + button */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.membersScroll}>
          {members.map((member) => (
            <View key={member.id} style={styles.memberAvatar}>
              <Avatar uri={member.user.avatar_url} name={member.user.name || "User"} size={32} />
            </View>
          ))}
          <TouchableOpacity style={styles.addMemberButton} onPress={handleShareInvite}>
            <View style={styles.addMemberCircle}>
              <Text style={styles.addMemberText}>+</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>

        {/* Day scroller */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroller}>
          {weekDates.map((day) => {
            const hasEntry = userEntryDates.has(day.date)
            const isSelected = day.date === selectedDate
            const isFutureDay = day.date > todayDate
            return (
              <TouchableOpacity
                key={day.date}
                style={[
                  styles.dayButton,
                  isSelected && styles.dayButtonSelected,
                  !isSelected && isFutureDay && styles.dayButtonFuture,
                ]}
                onPress={() => {
                  const oldDate = selectedDate
                  setSelectedDate(day.date)
                  
                  // Track changed_dates event
                  if (oldDate !== day.date && currentGroupId) {
                    safeCapture(posthog, "changed_dates", {
                      from_date: oldDate,
                      to_date: day.date,
                      group_id: currentGroupId,
                    })
                  }
                }}
              >
                <Text
                  style={[
                    styles.dayText,
                    isSelected && styles.dayTextSelected,
                    !isSelected && isFutureDay && styles.dayTextFuture,
                  ]}
                >
                  {day.day}
                </Text>
                {hasEntry ? (
                  <FontAwesome name="check" size={12} color={colors.gray[400]} style={{ marginTop: spacing.xs }} />
                ) : (
                  <Text
                    style={[
                      styles.dayNum,
                      isSelected && styles.dayNumSelected,
                      !isSelected && isFutureDay && styles.dayNumFuture,
                    ]}
                  >
                    {day.dayNum}
                  </Text>
                )}
              </TouchableOpacity>
            )
          })}
        </ScrollView>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.white} />}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Refresh Indicator */}
        {showRefreshIndicator && (
          <View style={styles.refreshIndicator}>
            <ActivityIndicator size="small" color={colors.gray[400]} />
          </View>
        )}
        
        {/* Custom Question Banner (today only, not for future days) */}
        {shouldShowCustomQuestionBanner && !isFuture && (
          <CustomQuestionBanner
            groupId={currentGroupId!}
            date={selectedDate}
            onPress={handleCustomQuestionPress}
            reduceSpacing={
              // Reduce spacing if any birthday banners will be shown
              (myBirthdayCard && myBirthdayCard.birthday_date === selectedDate) ||
              upcomingBirthdayCards.length > 0 ||
              myCardEntries.length > 0
            }
          />
        )}
        
        {/* Birthday Card Banners (only for non-future days) */}
        {/* 1. Your Card Banner (highest priority - if it's user's birthday) */}
        {myBirthdayCard && myBirthdayCard.birthday_date === selectedDate && !isFuture && (
          <BirthdayCardYourCardBanner
            groupId={currentGroupId!}
            cardId={myBirthdayCard.id}
            birthdayDate={myBirthdayCard.birthday_date}
            contributorAvatars={cardEntries.map((e) => ({
              user_id: e.contributor_user_id,
              avatar_url: e.contributor?.avatar_url,
              name: e.contributor?.name,
            }))}
            onPress={() => {
              router.push({
                pathname: "/(main)/birthday-card-details",
                params: {
                  cardId: myBirthdayCard.id,
                  groupId: currentGroupId!,
                  returnTo: `/(main)/home?groupId=${currentGroupId}&date=${selectedDate}`,
                },
              })
            }}
          />
        )}

        {/* 2. Upcoming Birthday Banners (stacked vertically, non-future days only) */}
        {!isFuture && upcomingBirthdayCards.map((card) => {
          const birthdayUser = (card as any).birthday_user
          return (
            <BirthdayCardUpcomingBanner
              key={card.id}
              groupId={currentGroupId!}
              cardId={card.id}
              birthdayUserId={card.birthday_user_id}
              birthdayUserName={birthdayUser?.name || "Someone"}
              birthdayUserAvatar={birthdayUser?.avatar_url}
              birthdayDate={card.birthday_date}
              onPress={() => {
                router.push({
                  pathname: "/(main)/modals/birthday-card-composer",
                  params: {
                    cardId: card.id,
                    groupId: currentGroupId!,
                    birthdayUserId: card.birthday_user_id,
                    birthdayUserName: birthdayUser?.name || "Someone",
                    returnTo: `/(main)/home?groupId=${currentGroupId}&date=${selectedDate}`,
                  },
                })
              }}
            />
          )
        })}

        {/* 3. Edit Banners (for entries written on selectedDate, non-future days only) */}
        {!isFuture && myCardEntries.map((entry) => {
          const card = (entry as any).card
          const birthdayUser = card?.birthday_user
          return (
            <BirthdayCardEditBanner
              key={entry.id}
              groupId={currentGroupId!}
              cardId={card?.id || ""}
              entryId={entry.id}
              birthdayUserId={card?.birthday_user_id || ""}
              birthdayUserName={birthdayUser?.name || "Someone"}
              birthdayUserAvatar={birthdayUser?.avatar_url}
              birthdayDate={card?.birthday_date || ""}
              onPress={() => {
                router.push({
                  pathname: "/(main)/modals/birthday-card-composer",
                  params: {
                    cardId: card?.id || "",
                    groupId: currentGroupId!,
                    birthdayUserId: card?.birthday_user_id || "",
                    birthdayUserName: birthdayUser?.name || "Someone",
                    entryId: entry.id,
                    returnTo: `/(main)/home?groupId=${currentGroupId}&date=${selectedDate}`,
                  },
                })
              }}
            />
          )
        })}

        {/* Pending Vote Banner (today only, not for future days) */}
        {pendingVotes.length > 0 && isToday && !isFuture && (
          <View style={styles.voteBannerWrapper}>
            <TouchableOpacity
              style={styles.voteBanner}
              onPress={() => {
                if (pendingVotes.length === 1) {
                  router.push(`/(main)/deck-vote?deckId=${pendingVotes[0].deck_id}&groupId=${currentGroupId}`)
                } else {
                  router.push(`/(main)/explore-decks?groupId=${currentGroupId}`)
                }
              }}
              activeOpacity={0.8}
            >
              <View style={styles.voteBannerContent}>
                {/* Deck image on the left */}
                <View style={styles.voteBannerIconContainer}>
                  <Image
                    source={getDeckImageSource(pendingVotes[0].deck?.name, pendingVotes[0].deck?.icon_url)}
                    style={styles.voteBannerIcon}
                    resizeMode="cover"
                  />
                </View>
                {/* Text content */}
                <View style={styles.voteBannerTextContainer}>
                  <Text style={styles.voteBannerSubtext}>
                    {pendingVotes[0].requested_by_user?.name || "Someone"} wants to add a deck
                  </Text>
                  <Text style={styles.voteBannerText}>
                    {pendingVotes.length === 1
                      ? "Vote on it"
                      : "Multiple decks being voted on"}
                  </Text>
                </View>
              </View>
              {/* Chevron on the right */}
              <FontAwesome name="chevron-right" size={16} color={isDark ? "#ffffff" : "#000000"} style={styles.voteBannerChevron} />
            </TouchableOpacity>
          </View>
        )}
        {/* Notice above daily question - mutually exclusive messages */}
        {!userEntry && !isFuture && (
          <>
            {otherEntries.length === 0 ? (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>Nobody has shared today yet. Be the first.</Text>
              </View>
            ) : (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>People have shared today.</Text>
                <Text style={styles.noticeText}>Answer to see what they said.</Text>
              </View>
            )}
          </>
        )}
        {/* Future day empty state */}
        {!userEntry && isFuture && (
          <View style={styles.promptCardWrapper}>
            <View style={styles.promptCard}>
              <Image
                source={require("../../assets/images/future.png")}
                style={styles.futureImage}
                resizeMode="contain"
              />
              <Text style={[styles.promptQuestion, styles.futurePromptQuestion]}>
                This question isn't available for the group yet.
              </Text>
              <Text style={[styles.promptDescription, styles.futurePromptDescription]}>
                {(() => {
                  const selected = new Date(`${selectedDate}T00:00:00`)
                  const today = new Date(`${todayDate}T00:00:00`)
                  const diffMs = selected.getTime() - today.getTime()
                  const daysAhead = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)))
                  const unit = daysAhead === 1 ? "day" : "days"
                  return `Come back in ${daysAhead} ${unit} to answer it.`
                })()}
              </Text>
            </View>
          </View>
        )}

        {/* Daily prompt */}
        {!userEntry && !isFuture && (
          <View style={styles.promptCardWrapper}>
            <View style={styles.promptDivider} />
            <View style={styles.promptCard}>
              {isLoadingGroupData ? (
                // Show loading state during group switch
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Loading...</Text>
                </View>
              ) : (
                <>
                  {/* Custom Question Branding */}
                  {isCustomQuestion && customQuestionData && (
                    <View style={styles.customQuestionBanner}>
                      {customQuestionData.is_anonymous ? (
                        <View style={styles.customQuestionHeader}>
                          <FontAwesome name="question-circle" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                          <Text style={styles.customQuestionLabel}>
                            Custom question! Someone in your group asked everyone this:
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.customQuestionHeader}>
                          <Avatar
                            uri={customQuestionData.user?.avatar_url}
                            name={customQuestionData.user?.name || "User"}
                            size={24}
                          />
                          <Text style={styles.customQuestionLabel}>
                            {customQuestionData.user?.name || "Someone"} has a question for you
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.sm }}>
                    {fallbackPrompt?.category && (
                      <CategoryTag category={fallbackPrompt.category} />
                    )}
                    {dailyPrompt?.deck_id && deckInfo && (
                      <TouchableOpacity
                        onPress={() => router.push(`/(main)/deck-detail?deckId=${dailyPrompt.deck_id}&groupId=${currentGroupId}`)}
                        style={{
                          alignSelf: "flex-start",
                          paddingHorizontal: spacing.md,
                          paddingVertical: spacing.xs,
                          borderRadius: 16,
                          backgroundColor: isDark ? colors.white : colors.black,
                        }}
                      >
                        <Text style={{
                          ...typography.caption,
                          fontSize: 12,
                          fontWeight: "600",
                          color: isDark ? colors.black : colors.white,
                        }}>
                          {deckInfo.name}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.promptQuestion}>
                    {personalizedPromptQuestion || fallbackPrompt?.question || "Share a moment that made you smile today."}
                  </Text>
                  <Text style={styles.promptDescription}>
                    {fallbackPrompt?.description ?? "Tell your group about something meaningful or memorable from your day."}
                  </Text>
                  {promptId && (
                    <Button
                      title="Tell the Group"
                      onPress={handleAnswerPrompt}
                      style={styles.answerButton}
                    />
                  )}
                </>
              )}
            </View>
            <View style={styles.promptDivider} />
          </View>
        )}

        {/* Entries feed */}
        {userEntry ? (
          <View style={[
            styles.entriesContainer, 
            (pendingVotes.length > 0 && isToday) || shouldShowCustomQuestionBanner || 
            (myBirthdayCard && myBirthdayCard.birthday_date === selectedDate) ||
            upcomingBirthdayCards.length > 0 || myCardEntries.length > 0
              ? styles.entriesContainerWithBanners 
              : null
          ]}>
            {entries.map((entry, entryIndex) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                entryIds={entryIdList}
                index={entryIndex}
                returnTo="/(main)/home"
              />
            ))}
            {/* Show message if all members posted or if some haven't */}
            {(() => {
              const entriesForDate = entries.filter(e => e.date === selectedDate)
              const uniqueUserIds = new Set(entriesForDate.map(e => e.user_id))
              const allMembersPosted = members.length > 0 && uniqueUserIds.size === members.length
              const someMembersPosted = uniqueUserIds.size > 0 && uniqueUserIds.size < members.length
              
              if (allMembersPosted) {
                return (
                  <>
                    {/* Only show "Everyone in the group posted today" if CTA is not showing */}
                    {!shouldShowCTA && (
                      <View style={styles.postingStatusContainer}>
                        <Text style={styles.postingStatusText}>Everyone in the group posted today.</Text>
                      </View>
                    )}
                    {/* Previous Day CTA */}
                    {shouldShowCTA && (
                      <TouchableOpacity
                        style={styles.previousDayCTA}
                        onPress={() => {
                          setSelectedDate(previousDate)
                        }}
                      >
                        <FontAwesome name="history" size={16} color={isDark ? "#ffffff" : "#000000"} style={{ marginRight: spacing.sm }} />
                        <Text style={styles.previousDayCTAText}>
                          {getPreviousDayCTAText()}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                )
              } else if (someMembersPosted) {
                return (
                  <>
                    {/* Only show "Come back later" if CTA is not showing */}
                    {!shouldShowCTA && (
                      <View style={styles.postingStatusContainer}>
                        <Text style={styles.postingStatusText}>Come back later to see what the others said</Text>
                      </View>
                    )}
                    {/* Previous Day CTA */}
                    {shouldShowCTA && (
                      <TouchableOpacity
                        style={styles.previousDayCTA}
                        onPress={() => {
                          setSelectedDate(previousDate)
                        }}
                      >
                        <FontAwesome name="history" size={16} color={isDark ? "#ffffff" : "#000000"} style={{ marginRight: spacing.sm }} />
                        <Text style={styles.previousDayCTAText}>
                          {getPreviousDayCTAText()}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                )
              }
              return null
            })()}
          </View>
        ) : null}
      </Animated.ScrollView>

      <Modal visible={groupPickerVisible} transparent animationType="fade" onRequestClose={() => setGroupPickerVisible(false)}>
        <TouchableOpacity style={styles.groupModalBackdrop} activeOpacity={1} onPress={() => setGroupPickerVisible(false)}>
          <View style={[styles.groupModalSheet, Platform.OS === "android" && { paddingBottom: spacing.lg + insets.bottom }]}>
            <Text style={styles.groupModalTitle}>Switch group</Text>
            <ScrollView contentContainerStyle={styles.groupList}>
              {groups.map((group) => (
                <View key={group.id} style={styles.groupRowContainer}>
                  <TouchableOpacity
                    style={[
                      styles.groupRow,
                      group.id === currentGroupId && styles.groupRowActive,
                      styles.groupRowFlex,
                    ]}
                    onPress={() => handleSelectGroup(group.id)}
                  >
                    <View style={styles.groupRowContent}>
                      <Text style={styles.groupRowText}>{group.name}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                      {groupUnseenStatus[group.id] && (
                        <View style={styles.unseenDot} />
                      )}
                        {/* Only show count for non-current groups with multiple groups */}
                        {groups.length > 1 && 
                         group.id !== currentGroupId && 
                         groupUnseenCount[group.id]?.hasNew && 
                         groupUnseenCount[group.id]?.newCount > 0 && (
                          <Text style={styles.newAnswersText}>
                            {groupUnseenCount[group.id].newCount} new {groupUnseenCount[group.id].newCount === 1 ? "answer" : "answers"}
                          </Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.groupSettingsButton}
                    onPress={() => {
                      setGroupPickerVisible(false)
                      router.push({
                        pathname: "/(main)/group-settings",
                        params: { groupId: group.id },
                      })
                    }}
                  >
                    <FontAwesome name="cog" size={16} color={colors.gray[400]} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.createGroupButton} onPress={handleCreateGroupSoon}>
              <Text style={styles.createGroupText}>Create another group</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}
