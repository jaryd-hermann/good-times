"use client"

import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react"
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
  ImageBackground,
  ActivityIndicator,
} from "react-native"
import { useRouter, useLocalSearchParams, useFocusEffect, usePathname } from "expo-router"
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
  getMyBirthdayCards,
  hasReceivedBirthdayCards,
} from "../../lib/db"
import { getTodayDate, getWeekDates, getPreviousDay, utcStringToLocalDate, formatDateAsLocalISO } from "../../lib/utils"
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns"
import { typography, spacing } from "../../lib/theme"
import { useTheme } from "../../lib/theme-context"
import { Avatar } from "../../components/Avatar"
import { Button } from "../../components/Button"
import { EntryCard } from "../../components/EntryCard"
import { CategoryTag } from "../../components/CategoryTag"
import { PromptSkeleton } from "../../components/PromptSkeleton"
import { EntryCardSkeleton } from "../../components/EntryCardSkeleton"
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
import { NotificationBell } from "../../components/NotificationBell"
import { NotificationModal } from "../../components/NotificationModal"
import { getInAppNotifications, markNotificationsAsChecked, markEntryAsVisited, markGroupAsVisited, clearAllNotifications, markQuestionAsAnswered, markDeckAsVoted, markBirthdayCardAsAdded, markCustomQuestionAsSubmitted, type InAppNotification } from "../../lib/notifications-in-app"
import { updateBadgeCount } from "../../lib/notifications-badge"
import { UserProfileModal } from "../../components/UserProfileModal"
import { useAuth } from "../../components/AuthProvider"
import { OnboardingGallery } from "../../components/OnboardingGallery"
import { AppReviewModal } from "../../components/AppReviewModal"

const { width: SCREEN_WIDTH } = Dimensions.get("window")

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

function getDayIndex(dateString: string, groupId?: string) {
  const base = new Date(dateString)
  const start = new Date("2020-01-01")
  const diff = Math.floor((base.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  const groupOffset = groupId ? groupId.length : 0
  return diff + groupOffset
}

// Helper function to get memorial name for a prompt on a specific date (matches history.tsx logic)
function getMemorialForPrompt(promptId: string, date: string, groupId: string, memorials: any[], memorialUsageMap: Map<string, string>): string | null {
  if (!memorials || !memorialUsageMap) return null
  const normalizedDate = date.split('T')[0]
  const usageKey = `${promptId}-${normalizedDate}`
  const used = memorialUsageMap.get(usageKey)
  if (used) return used
  if (memorials.length === 0) return null
  const dayIndex = getDayIndex(date, groupId)
  const memorialIndex = dayIndex % memorials.length
  return memorials[memorialIndex]?.name || null
}

// Helper functions from history.tsx for period summaries
function getFirstMediaImage(entry: any): string | undefined {
  if (!entry?.media_urls || entry.media_urls.length === 0) {
    return undefined
  }

  if (entry.media_types && Array.isArray(entry.media_types)) {
    const photoIndex = entry.media_types.findIndex((type: string) => type === "photo")
    if (photoIndex >= 0 && entry.media_urls[photoIndex]) {
      return entry.media_urls[photoIndex]
    }
  }

  return entry.media_urls[0]
}

interface PeriodSummary {
  key: string
  start: string
  end: string
  title: string
  subtitle: string
  count: number
  image?: string
}

type PeriodMode = "Weeks" | "Months" | "Years"

function buildPeriodSummaries(entries: any[], mode: PeriodMode): PeriodSummary[] {
  const groups = new Map<
    string,
    {
      start: Date
      end: Date
      entries: any[]
      image?: string
    }
  >()

  entries.forEach((entry) => {
    if (!entry?.date) return
    const entryDate = parseISO(entry.date)
    if (Number.isNaN(entryDate.getTime())) return

    let start: Date
    let end: Date

    if (mode === "Weeks") {
      start = startOfWeek(entryDate, { weekStartsOn: 0 })
      end = endOfWeek(entryDate, { weekStartsOn: 0 })
    } else if (mode === "Months") {
      start = startOfMonth(entryDate)
      end = endOfMonth(entryDate)
    } else {
      start = startOfYear(entryDate)
      end = endOfYear(entryDate)
    }

    const key = start.toISOString()
    const existing = groups.get(key) ?? { start, end, entries: [], image: undefined }
    existing.entries.push(entry)

    if (!existing.image) {
      const image = getFirstMediaImage(entry)
      if (image) {
        existing.image = image
      }
    }

    groups.set(key, existing)
  })

  const ordered = Array.from(groups.values()).sort((a, b) => b.start.getTime() - a.start.getTime())

  return ordered.map((group, index) => {
    const order = ordered.length - index
    let title: string
    let subtitle: string

    if (mode === "Weeks") {
      title = format(group.start, "d-MMMM yyyy")
      subtitle = `Week ${order} of your history`
    } else if (mode === "Months") {
      title = format(group.start, "MMMM yyyy")
      subtitle = `Month ${order} of your history`
    } else {
      title = format(group.start, "yyyy")
      subtitle = `Year ${order} of your history`
    }

    return {
      key: `${mode}-${group.start.toISOString()}`,
      start: group.start.toISOString(),
      end: group.end.toISOString(),
      title,
      subtitle,
      count: group.entries.length,
      image: group.image,
    }
  })
}

export default function Home() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const focusGroupId = params.focusGroupId as string | undefined
  const queryClient = useQueryClient()
  const pathname = usePathname()
  const previousPathnameRef = useRef<string | null>(null)
  const { colors, isDark } = useTheme()
  const { user: authUser } = useAuth() // Get user from AuthProvider (works even with invalid session)
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
  const [notificationModalVisible, setNotificationModalVisible] = useState(false)
  const [userProfileModalVisible, setUserProfileModalVisible] = useState(false)
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string; avatar_url?: string } | null>(null)
  const [onboardingGalleryVisible, setOnboardingGalleryVisible] = useState(false)
  const [showAppReviewModal, setShowAppReviewModal] = useState(false)
  // REMOVED: revealedAnswersForToday state - users can no longer reveal answers before answering
  const scrollY = useRef(new Animated.Value(0)).current
  const headerTranslateY = useRef(new Animated.Value(0)).current
  // CRITICAL: Initialize with safe minimum padding to prevent content cropping before headerHeight is calculated
  // This ensures content never renders with 0 padding
  const contentPaddingTop = useRef(new Animated.Value(250)).current // Safe default, will be updated when headerHeight is known
  const lastScrollY = useRef(0)
  const lastScrollTime = useRef(0)
  const scrollViewRef = useRef<ScrollView>(null)
  const isResettingScroll = useRef(false)
  const savedScrollPosition = useRef<number | null>(null) // Save scroll position when loading more entries
  const { opacity: tabBarOpacity, showBackToTop, setShowBackToTop, backToTopOpacity } = useTabBar()
  const posthog = usePostHog()
  const loadingRotation = useRef(new Animated.Value(0)).current
  const loadingAnimationRef = useRef<Animated.CompositeAnimation | null>(null)
  
  // Filtering and view mode state - default to "Weeks" for History screen
  type ViewMode = "Days" | "Weeks" | "Months" | "Years"
  type PeriodMode = Exclude<ViewMode, "Days">
  const [viewMode, setViewMode] = useState<ViewMode>("Weeks")
  const [showFilter, setShowFilter] = useState(false)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const filterButtonRef = useRef<View>(null)
  const [filterButtonLayout, setFilterButtonLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [activePeriod, setActivePeriod] = useState<{ mode: PeriodMode; start: string; end: string; title: string; subtitle: string } | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [selectedMemorials, setSelectedMemorials] = useState<string[]>([])
  const [selectedDecks, setSelectedDecks] = useState<string[]>([])
  
  // Paginated loading state for Days view (infinite scroll)
  const [loadedDateRanges, setLoadedDateRanges] = useState<string[]>([]) // Array of dates that have been loaded
  const [isLoadingMoreEntries, setIsLoadingMoreEntries] = useState(false)
  const [hasMoreEntries, setHasMoreEntries] = useState(true) // Track if there are more entries to load
  const [showBirthdayCards, setShowBirthdayCards] = useState(false)
  const dateRefs = useRef<Record<string, any>>({}) // For scroll-to-day functionality
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(true) // Show overlay during initial load/group switch
  const previousGroupIdRef = useRef<string | undefined>(undefined) // Track previous group to detect switches
  const lastViewedEntryDateRef = useRef<string | null>(null) // Store entry date when navigating to entry-detail

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
      } else if (nextAppState === "active") {
        // App came back from background - check if we should show review modal
        checkAndShowReviewModal()
      }
    })

    return () => {
      subscription.remove()
    }
  }, [posthog, userId, currentGroupId])

  // Helper function to check entry count and show review modal if needed
  const checkAndShowReviewModal = useCallback(async () => {
    if (!userId || !currentGroupId) return
    
    try {
      // Check if dev tool is requesting to show the modal
      const devShowModal = await AsyncStorage.getItem("dev_show_app_review_modal")
      if (devShowModal === "true") {
        // Clear the flag
        await AsyncStorage.removeItem("dev_show_app_review_modal")
        // Show modal immediately
        setTimeout(() => {
          setShowAppReviewModal(true)
        }, 500)
        return
      }
      
      // Check if we've already shown the review modal
      const hasShownReviewModal = await AsyncStorage.getItem(`app_review_modal_shown_${userId}`)
      
      if (hasShownReviewModal) return // Already shown, don't check again
      
      // Count user's entries in this group
      const { count, error: countError } = await supabase
        .from("entries")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("group_id", currentGroupId)
      
      if (!countError && count !== null && count >= 5) {
        // Mark as shown so we don't show it again
        await AsyncStorage.setItem(`app_review_modal_shown_${userId}`, "true")
        // Show modal after a short delay
        setTimeout(() => {
          setShowAppReviewModal(true)
        }, 1000) // 1 second delay
      }
    } catch (error) {
      console.warn("[home] Error checking entry count for review modal:", error)
      // Silently fail - don't disrupt user flow
    }
  }, [userId, currentGroupId])

  useEffect(() => {
    loadUser()
  }, [authUser]) // Re-run when authUser changes (e.g., after session refresh)

  // Reload user profile when screen comes into focus (e.g., returning from settings)
  // But don't reset group - only update if focusGroupId param is provided
  useFocusEffect(
    useCallback(() => {
      // CRITICAL: Sync currentGroupId from AsyncStorage when screen comes into focus
      // This ensures history.tsx uses the same group as home.tsx when groups switch
      async function syncGroupFromStorage() {
        try {
          const storedGroupId = await AsyncStorage.getItem("current_group_id")
          if (storedGroupId && storedGroupId !== currentGroupId) {
            console.log(`[history] 🔄 Syncing group from storage: ${storedGroupId} (was ${currentGroupId})`)
            setCurrentGroupId(storedGroupId)
            // Clear cache for old group and new group to force fresh fetch
            if (currentGroupId) {
              queryClient.setQueryData(["allEntriesHistory", currentGroupId], [])
            }
            queryClient.setQueryData(["allEntriesHistory", storedGroupId], [])
            queryClient.invalidateQueries({ queryKey: ["allEntriesHistory", storedGroupId], exact: true })
          }
        } catch (error) {
          console.error("[history] Error syncing group from storage:", error)
        }
      }
      syncGroupFromStorage()
      
      // Check if we should show review modal when screen comes into focus
      checkAndShowReviewModal()
      
      // Only reload user profile, not group (preserve current group)
      async function reloadProfile() {
        try {
          // Ensure session is valid before loading data (with timeout)
          const { ensureValidSession } = await import("../../lib/auth")
          const sessionPromise = ensureValidSession()
          const sessionTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Session refresh timeout")), 5000)
          )
          
          try {
            await Promise.race([sessionPromise, sessionTimeout])
          } catch (sessionError: any) {
            console.warn("[home] Session refresh failed or timed out on focus:", sessionError?.message)
            // Continue anyway - might still work
          }
          
          // CRITICAL: Use user from AuthProvider first (works even with invalid session)
          let user = authUser
          if (!user) {
            const {
              data: { user: supabaseUser },
            } = await supabase.auth.getUser()
            user = supabaseUser
          }
          
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
      
      // Refetch notifications when screen comes into focus
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ["inAppNotifications", userId] })
        // Update badge count when screen comes into focus
        updateBadgeCount(userId)
      }
      
      // Scroll to last viewed entry date when returning from entry-detail
      if (lastViewedEntryDateRef.current) {
        const dateToScroll = lastViewedEntryDateRef.current
        lastViewedEntryDateRef.current = null // Clear after use
        // Delay to ensure feed is rendered
        setTimeout(() => {
          scrollToDate(dateToScroll)
        }, 300)
      }
      
      // CRITICAL: Invalidate all data queries when screen comes into focus
      // This ensures fresh data when app comes to foreground
      if (currentGroupId) {
        queryClient.invalidateQueries({ queryKey: ["dailyPrompt", currentGroupId] })
        queryClient.invalidateQueries({ queryKey: ["entries", currentGroupId] })
        queryClient.invalidateQueries({ queryKey: ["userEntry", currentGroupId] })
      }
    }, [focusGroupId, queryClient, userId, currentGroupId])
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
      // CRITICAL: Use user from AuthProvider first (works even with invalid session)
      // Fall back to Supabase if AuthProvider doesn't have user
      let user = authUser
      
      if (!user) {
        // Try to ensure session is valid before loading data
        const { ensureValidSession } = await import("../../lib/auth")
        await ensureValidSession()
        
        const {
          data: { user: supabaseUser },
        } = await supabase.auth.getUser()
        user = supabaseUser
      }
      
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

  // Fetch members for all groups to show avatars in switcher
  const { data: allGroupsMembers = {}, isLoading: isLoadingAllGroupsMembers } = useQuery({
    queryKey: ["allGroupsMembers", groups.map((g) => g.id).join(","), userId],
    queryFn: async () => {
      if (groups.length === 0 || !userId) return {}
      const membersByGroup: Record<string, any[]> = {}
      await Promise.all(
        groups.map(async (group) => {
          const members = await getGroupMembers(group.id)
          // Filter out current user
          const otherMembers = members.filter((m) => m.user_id !== userId)
          membersByGroup[group.id] = otherMembers
        })
      )
      return membersByGroup
    },
    enabled: groups.length > 0 && !!userId,
  })

  // Fetch in-app notifications
  const { data: notifications = [], refetch: refetchNotifications } = useQuery({
    queryKey: ["inAppNotifications", userId],
    queryFn: () => (userId ? getInAppNotifications(userId) : []),
    enabled: !!userId,
    staleTime: 0, // Always refetch to get fresh notifications
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })

  const hasNotifications = notifications.length > 0

  // Update badge count when notifications change
  useEffect(() => {
    if (userId) {
      updateBadgeCount(userId)
    }
  }, [notifications, userId])

  // When groups list changes (new group added), invalidate prompts for all groups
  useEffect(() => {
    if (groups.length > 0 && currentGroupId) {
      // Check if current group is in the list (might be a new group)
      const currentGroup = groups.find((g) => g.id === currentGroupId)
      if (currentGroup) {
        // Mark group as visited when user views it
        markGroupAsVisited(currentGroupId)
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
      // CRITICAL: Clear allEntriesHistory before switching groups
      queryClient.setQueryData(["allEntriesHistory", currentGroupId], [])
      queryClient.setQueryData(["allEntriesHistory", focusGroupId], [])
      
      // Set switching state to prevent stale data
      setIsGroupSwitching(true)
      
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
      queryClient.invalidateQueries({ 
        queryKey: ["allEntriesHistory", focusGroupId],
        exact: false 
      })
      
      // Set switching state to prevent stale data
      setIsGroupSwitching(true)
      setTimeout(() => {
        setIsGroupSwitching(false)
      }, 200)
    }
  }, [focusGroupId, groups, currentGroupId, queryClient])


  // Track previous group ID to clear its cache when switching
  const prevGroupIdRef = useRef<string | undefined>(undefined)

  // Invalidate queries ONLY when currentGroupId changes (group switch), not on date changes
  useEffect(() => {
    const prevGroupId = prevGroupIdRef.current
    
    // Only do this if group actually changed (not on initial mount or date changes)
    if (prevGroupId && prevGroupId !== currentGroupId) {
      console.log(`[history] CRITICAL: Group changed from ${prevGroupId} to ${currentGroupId}, clearing old group cache`)
      setIsGroupSwitching(true) // Set loading state immediately
      
      // CRITICAL: Immediately clear allEntriesHistory data to prevent showing wrong group's entries
      queryClient.setQueryData(["allEntriesHistory", prevGroupId], [])
      queryClient.setQueryData(["allEntriesHistory", currentGroupId], [])
      
      // CRITICAL: Immediately reset birthday card queries to prevent stale data from showing
      // Reset for ALL possible date combinations to ensure no stale data
      queryClient.setQueryData(["upcomingBirthdayCards", currentGroupId], undefined)
      queryClient.setQueryData(["myBirthdayCard", currentGroupId], undefined)
      queryClient.setQueryData(["myCardEntries", currentGroupId], undefined)
      
      // Also explicitly set to null/empty for current date
      if (userId && todayDate) {
        queryClient.setQueryData(["upcomingBirthdayCards", currentGroupId, userId, todayDate], [])
      }
      if (userId && selectedDate) {
        queryClient.setQueryData(["myBirthdayCard", currentGroupId, userId, selectedDate], null)
        queryClient.setQueryData(["myCardEntries", currentGroupId, userId, selectedDate], [])
      }
      
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
      queryClient.removeQueries({ 
        queryKey: ["upcomingBirthdayCards", prevGroupId],
        exact: false 
      })
      queryClient.removeQueries({ 
        queryKey: ["myBirthdayCard", prevGroupId],
        exact: false 
      })
      queryClient.removeQueries({ 
        queryKey: ["myCardEntries", prevGroupId],
        exact: false 
      })
      // CRITICAL: Remove allEntriesHistory for previous group to prevent group context bleeding
      queryClient.removeQueries({ 
        queryKey: ["allEntriesHistory", prevGroupId],
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
        queryClient.removeQueries({ 
          queryKey: ["upcomingBirthdayCards", currentGroupId],
          exact: false 
        })
        queryClient.removeQueries({ 
          queryKey: ["myBirthdayCard", currentGroupId],
          exact: false 
        })
        queryClient.removeQueries({ 
          queryKey: ["myCardEntries", currentGroupId],
          exact: false 
        })
        // CRITICAL: Remove allEntriesHistory for new group to ensure fresh fetch
        queryClient.removeQueries({ 
          queryKey: ["allEntriesHistory", currentGroupId],
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
        queryClient.invalidateQueries({ 
          queryKey: ["upcomingBirthdayCards", currentGroupId],
          exact: false 
        })
        queryClient.invalidateQueries({ 
          queryKey: ["myBirthdayCard", currentGroupId],
          exact: false 
        })
        queryClient.invalidateQueries({ 
          queryKey: ["myCardEntries", currentGroupId],
          exact: false 
        })
        // CRITICAL: Invalidate allEntriesHistory for new group
        queryClient.invalidateQueries({ 
          queryKey: ["allEntriesHistory", currentGroupId],
          exact: false 
        })
        
        // Force refetch immediately
        queryClient.refetchQueries({ 
          queryKey: ["dailyPrompt", currentGroupId],
          exact: false 
        })
        // CRITICAL: Force refetch allEntriesHistory immediately
        queryClient.refetchQueries({ 
          queryKey: ["allEntriesHistory", currentGroupId],
          exact: false 
        })
        
        // Clear switching state once data starts loading
        // Use a small delay to ensure queries have started and old data is cleared
        setTimeout(() => {
          setIsGroupSwitching(false)
        }, 200)
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

  // Check if user has seen app tutorial
  const { data: hasSeenAppTutorial } = useQuery({
    queryKey: ["appTutorialSeen", userId],
    queryFn: async () => {
      if (!userId) return false
      const user = await getCurrentUser()
      return user?.app_tutorial_seen ?? false
    },
    enabled: !!userId,
  })

  const { data: members = [], isLoading: isLoadingMembers } = useQuery({
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

  // CRITICAL: Refetch prompt when userId becomes available (fixes race condition)
  // This ensures prompt loads even if userId was undefined when query first ran
  useEffect(() => {
    if (currentGroupId && selectedDate && userId) {
      // Invalidate and refetch to ensure prompt loads with userId
      queryClient.invalidateQueries({
        queryKey: ["dailyPrompt", currentGroupId, selectedDate],
        exact: false, // Match all queries for this group/date regardless of userId
      })
    }
  }, [userId, currentGroupId, selectedDate, queryClient])

  const { data: dailyPrompt, isLoading: isLoadingPrompt, isFetching: isFetchingPrompt } = useQuery({
    queryKey: ["dailyPrompt", currentGroupId, selectedDate, userId],
    queryFn: () => (currentGroupId ? getDailyPrompt(currentGroupId, selectedDate, userId) : null),
    enabled: !!currentGroupId && !!selectedDate, // Always enabled when group and date are available
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes to prevent glitching during date navigation
    gcTime: 10 * 60 * 1000, // Keep cache for 10 minutes for smooth date navigation
    refetchOnMount: true, // Always refetch on mount to ensure fresh data (fixes stuck loading state)
    refetchOnWindowFocus: true, // Refetch on focus to ensure fresh data when returning to screen
    // Don't use placeholder data from different dates - this causes glitching
    placeholderData: undefined,
    // CRITICAL: Retry failed queries to handle transient network issues
    retry: 2,
    retryDelay: 1000,
  })

  const { data: userEntry } = useQuery({
    queryKey: ["userEntry", currentGroupId, userId, selectedDate],
    queryFn: () => (currentGroupId && userId ? getUserEntryForDate(currentGroupId, userId, selectedDate) : null),
    enabled: !!currentGroupId && !!userId,
  })

  // Get today's date - call directly to ensure fresh value
  const todayDate = getTodayDate()
  
  // REMOVED: Load revealed answers state - users can no longer reveal answers before answering
  
  // Helper function to generate date range (7 days going backwards from start date)
  const generateDateRange = useCallback((startDate: string, daysBack: number = 7): string[] => {
    const dates: string[] = []
    const start = new Date(`${startDate}T00:00:00`)
    for (let i = 0; i < daysBack; i++) {
      const date = new Date(start)
      date.setDate(start.getDate() - i)
      dates.push(formatDateAsLocalISO(date))
    }
    return dates
  }, [])
  
  // Initialize loaded date ranges on mount/group change (Days view only)
  // Start with today + 6 days back (7 days total)
  useEffect(() => {
    if (viewMode === "Days" && currentGroupId && todayDate) {
      const initialDates = generateDateRange(todayDate, 7)
      setLoadedDateRanges(initialDates)
      setHasMoreEntries(true) // Assume there are more entries until we check
    } else if (viewMode !== "Days") {
      // Clear loaded ranges when switching away from Days view
      setLoadedDateRanges([])
    }
  }, [currentGroupId, todayDate, viewMode, generateDateRange])
  
  // Query for today's user entry (always fetch, regardless of selectedDate)
  const { data: todayUserEntry } = useQuery({
    queryKey: ["userEntry", currentGroupId, userId, todayDate],
    queryFn: () => (currentGroupId && userId ? getUserEntryForDate(currentGroupId, userId, todayDate) : null),
    enabled: !!currentGroupId && !!userId,
  })

  // REMOVED: Clear revealed state logic - users can no longer reveal answers before answering
  
  // Query for today's prompt (always fetch, regardless of selectedDate)
  const { data: todayDailyPrompt, isLoading: isLoadingTodayPrompt, isFetching: isFetchingTodayPrompt } = useQuery({
    queryKey: ["dailyPrompt", currentGroupId, todayDate, userId],
    queryFn: () => (currentGroupId ? getDailyPrompt(currentGroupId, todayDate, userId) : null),
    enabled: !!currentGroupId && !!todayDate,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
  
  // Query for today's entries (always fetch, regardless of selectedDate)
  const { data: todayEntries = [], isLoading: isLoadingTodayEntries, isFetching: isFetchingTodayEntries } = useQuery({
    queryKey: ["entries", currentGroupId, todayDate],
    queryFn: () => (currentGroupId ? getEntriesForDate(currentGroupId, todayDate) : []),
    enabled: !!currentGroupId,
    staleTime: 0,
  })
  
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

  // Manage loading overlay - show during group switches and initial load
  useEffect(() => {
    // Detect group switch
    const groupChanged = previousGroupIdRef.current !== undefined && 
                         previousGroupIdRef.current !== currentGroupId
    
    // Show overlay if:
    // 1. Group is switching (using existing isGroupSwitching state)
    // 2. Initial load (no previous group and we have a current group)
    // 3. Critical data is still loading (prompt, entries, or members/avatars)
    const shouldShowOverlay = (isGroupSwitching || groupChanged || previousGroupIdRef.current === undefined) &&
                              currentGroupId &&
                              (isLoadingTodayPrompt || isLoadingTodayEntries || isLoadingMembers || isLoadingAllGroupsMembers || isGroupSwitching)
    
    if (shouldShowOverlay) {
      setShowLoadingOverlay(true)
    } else if (!isLoadingTodayPrompt && !isLoadingTodayEntries && !isLoadingMembers && !isLoadingAllGroupsMembers && !isGroupSwitching) {
      // Hide overlay when all critical data is loaded (prompt, entries, and members/avatars)
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setShowLoadingOverlay(false)
      }, 100)
      return () => clearTimeout(timer)
    }
    
    // Update previous group ID
    previousGroupIdRef.current = currentGroupId
  }, [currentGroupId, isLoadingTodayPrompt, isLoadingTodayEntries, isLoadingMembers, isLoadingAllGroupsMembers, isGroupSwitching])

  // Start/stop loading spinner rotation animation
  useEffect(() => {
    if (showLoadingOverlay) {
      // Start rotation animation
      loadingRotation.setValue(0)
      loadingAnimationRef.current = Animated.loop(
        Animated.timing(loadingRotation, {
          toValue: 1,
          duration: 2000, // 2 seconds per rotation
          useNativeDriver: true,
        })
      )
      loadingAnimationRef.current.start()
    } else {
      // Stop rotation animation
      if (loadingAnimationRef.current) {
        loadingAnimationRef.current.stop()
        loadingAnimationRef.current = null
      }
    }

    return () => {
      // Cleanup on unmount
      if (loadingAnimationRef.current) {
        loadingAnimationRef.current.stop()
        loadingAnimationRef.current = null
      }
    }
  }, [showLoadingOverlay, loadingRotation])

  // Calculate rotation transform for loading spinner
  const loadingSpin = loadingRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

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

  // Build 4-day timeline:
  // - If groupAgeDays < 4: [startDate .. startDate+3]
  // - Else: [today-3 .. today]
  const weekDates = useMemo(() => {
    const dates: { date: string; day: string; dayNum: number }[] = []
    if (!currentGroup) {
      // Fallback: return 4 days starting from today
      const today = new Date(`${todayDate}T00:00:00`)
      for (let i = 3; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(today.getDate() - i)
        dates.push({
          date: formatDateAsLocalISO(d),
          day: d.toLocaleDateString(undefined, { weekday: "short" }),
          dayNum: d.getDate(),
        })
      }
      return dates
    }

    // For truly "brand new" groups (no full day of age yet), the timeline
    // should start at *today* even if created_at/UTC math might suggest
    // a previous calendar day. After the first full day, we respect
    // the real creation date.
    const startDateForTimeline =
      groupAgeDays === 0 ? todayDate : createdDateLocal

    if (groupAgeDays < 4) {
      // For very new groups, timeline starts at startDateForTimeline and shows 3 following days (4 total)
      let cursor = new Date(`${startDateForTimeline}T00:00:00`)
      for (let i = 0; i < 4; i++) {
        const d = new Date(cursor)
        dates.push({
          date: formatDateAsLocalISO(d),
          day: d.toLocaleDateString(undefined, { weekday: "short" }),
          dayNum: d.getDate(),
        })
        cursor.setDate(cursor.getDate() + 1)
      }
    } else {
      // After 4 days, show rolling window: today-3 .. today (4 days total)
      const today = new Date(`${todayDate}T00:00:00`)
      for (let i = 3; i >= 0; i--) {
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

  // Fetch entries for selected date (for backward compatibility)
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

  // Fetch ALL entries for the group - History screen always loads all entries
  // CRITICAL: Query key includes currentGroupId, so React Query treats different groups as different queries
  // CRITICAL: Only create query key if currentGroupId exists - prevents undefined key caching issues
  const { data: allEntriesRaw = [], isLoading: allEntriesLoading, isFetching: allEntriesFetching } = useQuery({
    queryKey: currentGroupId ? ["allEntriesHistory", currentGroupId] : ["allEntriesHistory", "DISABLED"],
    queryFn: async (): Promise<any[]> => {
      // CRITICAL: Double-check currentGroupId is still valid (defense against race conditions)
      if (!currentGroupId) {
        console.error(`[history] 🚨 CRITICAL: queryFn called but currentGroupId is undefined!`)
        return []
      }
      console.log(`[history] 🔵 FETCHING entries for group: ${currentGroupId}`)
      // Use getAllEntriesForGroup function for History screen
      const { getAllEntriesForGroup } = await import("../../lib/db")
      const entries = await getAllEntriesForGroup(currentGroupId)
      console.log(`[history] 🔵 FETCHED ${entries?.length || 0} entries for group ${currentGroupId}`)
      
      // CRITICAL: Verify every entry belongs to currentGroupId
      const wrongGroupEntries = entries.filter((entry: any) => {
        if (!entry || !entry.group_id) {
          return true // Missing group_id counts as wrong
        }
        return entry.group_id !== currentGroupId
      })
      
      if (wrongGroupEntries.length > 0) {
        console.error(`[history] 🚨 CRITICAL: Found ${wrongGroupEntries.length} entries from WRONG group!`)
        console.error(`[history] Expected group: ${currentGroupId}`)
        console.error(`[history] Wrong entries:`, wrongGroupEntries.map((e: any) => ({ id: e.id, group_id: e.group_id })))
      }
      
      // CRITICAL: Double-check all entries belong to the correct group (safety filter)
      const filteredData = entries.filter((entry: any) => {
        if (!entry || !entry.group_id) {
          console.warn(`[history] Entry missing group_id:`, entry)
          return false
        }
        if (entry.group_id !== currentGroupId) {
          console.error(`[history] 🚨 CRITICAL: Entry ${entry.id} has group_id ${entry.group_id}, but query is for ${currentGroupId}`)
          return false
        }
        return true
      })
      
      if (filteredData.length !== entries.length) {
        console.error(`[history] 🚨 CRITICAL: Filtered out ${entries.length - filteredData.length} entries from wrong group!`)
      }
      
      console.log(`[history] 🔵 RETURNING ${filteredData.length} entries for group ${currentGroupId}`)
      return filteredData
    },
    enabled: !!currentGroupId, // Only enabled when group is available - matches home.tsx
    staleTime: 0, // Always fetch fresh data when group changes - matches home.tsx
    gcTime: 0, // Don't cache - always fetch fresh to prevent group context bleeding
    refetchOnMount: true, // Always refetch on mount - matches home.tsx
    refetchOnWindowFocus: true, // Refetch on focus - matches home.tsx
    placeholderData: undefined, // Never use placeholder data from different group - matches home.tsx
    // CRITICAL: Ensure query is completely reset when group changes
    structuralSharing: (oldData, newData) => {
      // If group changed, don't share structure - force complete re-render
      return oldData === newData ? oldData : newData
    },
  })

  // CRITICAL: Safety filter to ensure we NEVER show entries from a different group
  // This is a defense-in-depth measure to prevent group context bleeding
  // Match home.tsx approach - filter by group_id to ensure data integrity
  const allEntries = useMemo(() => {
    if (!currentGroupId) {
      console.log(`[history] ⚠️ No currentGroupId, returning empty array`)
      return []
    }
    
    console.log(`[history] 🔍 Filtering ${allEntriesRaw.length} entries for group ${currentGroupId}`)
    
    // CRITICAL: Filter out any entries that don't belong to the current group
    // This prevents group context bleeding even if cached data is wrong
    const filtered = allEntriesRaw.filter((entry: any) => {
      if (!entry || !entry.group_id) {
        console.warn(`[history] ⚠️ Entry missing group_id:`, entry?.id)
        return false
      }
      if (entry.group_id !== currentGroupId) {
        console.error(`[history] 🚨 CRITICAL: Entry ${entry.id} has group_id ${entry.group_id}, but current group is ${currentGroupId}`)
        return false
      }
      return true
    })
    
    if (filtered.length !== allEntriesRaw.length) {
      console.error(`[history] 🚨 CRITICAL: Found ${allEntriesRaw.length - filtered.length} entries from wrong group! Filtered out.`)
      console.error(`[history] Current group: ${currentGroupId}`)
      const wrongEntries = allEntriesRaw.filter((e: any) => e.group_id !== currentGroupId)
      console.error(`[history] Wrong entries:`, wrongEntries.map((e: any) => ({ id: e.id, group_id: e.group_id, date: e.date })))
    }
    
    console.log(`[history] ✅ Returning ${filtered.length} entries for group ${currentGroupId}`)
    return filtered
  }, [allEntriesRaw, currentGroupId])

  // History screen always uses allEntries (no pagination needed)
  // Keep paginatedEntries for compatibility but it's not used
  const paginatedEntries: any[] = []
  const isLoadingPaginatedEntries = false

  // Fetch all birthday cards for the user (for filtering) - must be before allDates
  const { data: myBirthdayCards = [] } = useQuery({
    queryKey: ["myBirthdayCards", currentGroupId, userId],
    queryFn: async () => {
      if (!currentGroupId || !userId) return []
      const cards = await getMyBirthdayCards(currentGroupId, userId)
      // CRITICAL: Double-check that all cards belong to the current group
      const filteredCards = cards.filter((card) => card.group_id === currentGroupId)
      if (filteredCards.length !== cards.length) {
        console.warn(`[home] ⚠️ Filtered out ${cards.length - filteredCards.length} birthday cards from wrong group`)
      }
      return filteredCards
    },
    enabled: !!currentGroupId && !!userId,
    staleTime: 0,
    refetchOnMount: true,
    placeholderData: undefined,
  })

  // Generate date range for fetching prompts (from group creation date to today, never before group creation)
  const dateRangeForPrompts = useMemo(() => {
    const dates: string[] = []
    const today = new Date(`${todayDate}T00:00:00`)
    const groupCreatedDate = currentGroup?.created_at 
      ? new Date(utcStringToLocalDate(currentGroup.created_at))
      : null
    
    // CRITICAL: Always start from group creation date, never before
    // If group was created more than 30 days ago, still only show dates from creation date
    if (!groupCreatedDate) {
      // No group creation date - fallback to 30 days ago (shouldn't happen in practice)
      const startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
      const currentDate = new Date(startDate)
      while (currentDate <= today) {
        dates.push(formatDateAsLocalISO(currentDate))
        currentDate.setDate(currentDate.getDate() + 1)
      }
      return dates
    }
    
    // Start from group creation date (never before)
    const startDate = new Date(groupCreatedDate)
    
    // Generate dates from startDate to today
    const currentDate = new Date(startDate)
    while (currentDate <= today) {
      dates.push(formatDateAsLocalISO(currentDate))
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    return dates
  }, [todayDate, currentGroup?.created_at])

  // Get all unique dates - use paginated data for Days view, allEntries for other views
  const allDates = useMemo(() => {
    const dates = new Set<string>()
    
    // History screen always uses allEntries (no pagination)
    allEntries.forEach((entry) => {
      if (entry.date) {
        dates.add(entry.date)
      }
    })
    
    // Also include dates from birthday cards
    myBirthdayCards.forEach((card) => {
      if (card.birthday_date && card.group_id === currentGroupId) {
        dates.add(card.birthday_date)
      }
    })
    
    // Include dates from the date range (for prompts even if no entries)
    dateRangeForPrompts.forEach((date) => {
      dates.add(date)
    })
    
    return Array.from(dates)
  }, [allEntries, myBirthdayCards, currentGroupId, dateRangeForPrompts])

  // Fetch user entries for all dates to check if user has answered
  const { data: userEntriesByDate = {} } = useQuery({
    queryKey: ["userEntriesForHomeDates", currentGroupId, userId, allDates.join(",")],
    queryFn: async () => {
      if (!currentGroupId || !userId || allDates.length === 0) return {}
      const entries: Record<string, any> = {}
      await Promise.all(
        allDates.map(async (date) => {
          const userEntry = await getUserEntryForDate(currentGroupId, userId, date)
          if (userEntry) {
            entries[date] = userEntry
          }
        })
      )
      return entries
    },
    enabled: !!currentGroupId && !!userId && allDates.length > 0,
    staleTime: 0, // Always consider stale to ensure fresh data
    refetchOnMount: true, // Always refetch on mount
    refetchOnWindowFocus: true, // Refetch when screen comes into focus
  })

  // Fetch prompts for dates where user hasn't answered (to show prompt card)
  // CRITICAL: Filter out dates before group creation
  const datesWithoutUserEntry = useMemo(() => {
    const groupCreatedDate = currentGroup?.created_at 
      ? utcStringToLocalDate(currentGroup.created_at)
      : null
    
    return allDates.filter((date) => {
      // Exclude dates before group creation
      if (groupCreatedDate && date < groupCreatedDate) {
        return false
      }
      return !userEntriesByDate[date]
    })
  }, [allDates, userEntriesByDate, currentGroup?.created_at])

  const { data: promptsForDatesWithoutEntry = {} } = useQuery({
    queryKey: ["promptsForHomeDates", currentGroupId, userId, datesWithoutUserEntry.join(",")],
    queryFn: async () => {
      if (!currentGroupId || !userId || datesWithoutUserEntry.length === 0) return {}
      const prompts: Record<string, any> = {}
      const groupCreatedDate = currentGroup?.created_at 
        ? utcStringToLocalDate(currentGroup.created_at)
        : null
      
      await Promise.all(
        datesWithoutUserEntry.map(async (date) => {
          // CRITICAL: Skip dates before group creation
          if (groupCreatedDate && date < groupCreatedDate) {
            return
          }
          try {
            const prompt = await getDailyPrompt(currentGroupId, date, userId)
            if (prompt) {
              prompts[date] = prompt
            }
          } catch (error) {
            console.warn(`[home] Failed to fetch prompt for date ${date}:`, error)
          }
        })
      )
      return prompts
    },
    enabled: !!currentGroupId && !!userId && datesWithoutUserEntry.length > 0,
  })

  // Fetch entries for dates where user hasn't answered (to show who answered)
  const { data: entriesForDatesWithoutUserEntry = {} } = useQuery({
    queryKey: ["entriesForHomeDatesWithoutUserEntry", currentGroupId, datesWithoutUserEntry.join(",")],
    queryFn: async () => {
      if (!currentGroupId || datesWithoutUserEntry.length === 0) return {}
      const entriesByDate: Record<string, any[]> = {}
      await Promise.all(
        datesWithoutUserEntry.map(async (date) => {
          try {
            const entries = await getEntriesForDate(currentGroupId, date)
            if (entries && entries.length > 0) {
              entriesByDate[date] = entries
            }
          } catch (error) {
            console.warn(`[home] Failed to fetch entries for date ${date}:`, error)
          }
        })
      )
      return entriesByDate
    },
    enabled: !!currentGroupId && datesWithoutUserEntry.length > 0,
  })

  // Fetch group for filtering
  const { data: group } = useQuery({
    queryKey: ["home-group", currentGroupId],
    queryFn: async () => {
      if (!currentGroupId) return null
      const { data } = await supabase
        .from("groups")
        .select("*")
        .eq("id", currentGroupId)
        .single()
      return data
    },
    enabled: !!currentGroupId,
  })

  // Fetch active decks for filtering
  const { data: activeDecks = [] } = useQuery({
    queryKey: ["home-activeDecks", currentGroupId],
    queryFn: async () => {
      if (!currentGroupId) return []
      try {
        const { getGroupActiveDecks } = await import("../../lib/db")
        return await getGroupActiveDecks(currentGroupId)
      } catch (error) {
        console.error("[home] Error fetching active decks:", error)
        return []
      }
    },
    enabled: !!currentGroupId,
  })

  const availableDecks = activeDecks.filter((deck: any) => deck.status === "active" || deck.status === "finished")

  const { data: hasReceivedCards } = useQuery({
    queryKey: ["hasReceivedBirthdayCards", currentGroupId, userId],
    queryFn: () => (currentGroupId && userId ? hasReceivedBirthdayCards(currentGroupId, userId) : false),
    enabled: !!currentGroupId && !!userId,
  })

  // Fetch entries for all birthday cards (myBirthdayCards is defined above)
  const cardIds = useMemo(() => myBirthdayCards.map((card) => card.id), [myBirthdayCards])
  const { data: allCardEntries = {} } = useQuery<Record<string, any[]>>({
    queryKey: ["birthdayCardEntriesForHome", cardIds.join(",")],
    queryFn: async () => {
      if (cardIds.length === 0) return {}
      // Fetch entries for all cards in parallel
      const entriesPromises = cardIds.map((cardId) => getBirthdayCardEntries(cardId))
      const entriesArrays = await Promise.all(entriesPromises)
      // Flatten and group by card_id
      const entriesByCardId: Record<string, any[]> = {}
      entriesArrays.forEach((entries, index) => {
        entriesByCardId[cardIds[index]] = entries
      })
      return entriesByCardId
    },
    enabled: cardIds.length > 0,
    staleTime: 0,
  })

  // Fetch categories for filtering
  const { data: categories = [] } = useQuery({
    queryKey: ["home-categories", currentGroupId, group?.type],
    queryFn: async () => {
      if (!currentGroupId || !group) return []
      
      // Fetch entries to get categories that are actually used
      const { data: entriesData } = await supabase
        .from("entries")
        .select("prompt:prompts(category, is_custom)")
        .eq("group_id", currentGroupId)
        .limit(1000)
      
      const entryCategories = new Set<string>()
      entriesData?.forEach((entry: any) => {
        if (entry.prompt) {
          const isCustom = entry.prompt.is_custom === true
          const category = isCustom ? "Custom" : (entry.prompt.category ?? "")
          if (category) {
            entryCategories.add(category)
          }
        }
      })
      
      const groupWithNSFW = group as any
      const enableNSFW = groupWithNSFW?.enable_nsfw === true
      
      let filteredCategories = Array.from(entryCategories)
      
      // Filter based on group type and NSFW settings
      // Both family and friends groups now use "Standard" category
      if (group.type === "family") {
        filteredCategories = filteredCategories.filter(
          (cat) => cat !== "Edgy/NSFW" && cat !== "Seasonal"
        )
      } else if (group.type === "friends") {
        filteredCategories = filteredCategories.filter((cat) => {
          if (cat === "Seasonal") return false
          if (cat === "Edgy/NSFW" && !enableNSFW) return false
          return true
        })
      } else {
        filteredCategories = filteredCategories.filter((cat) => cat !== "Seasonal")
      }
      
      if (memorials.length === 0) {
        filteredCategories = filteredCategories.filter((cat) => cat !== "Remembering")
      }
      
      return filteredCategories.sort()
    },
    enabled: !!currentGroupId && !!group,
  })

  // Filter entries by active period if set
  // History screen always uses allEntries (no pagination)
  const entriesWithinPeriod = useMemo(() => {
    const entriesToUse = allEntries
    
    if (!activePeriod) {
      return entriesToUse
    }
    const start = parseISO(activePeriod.start)
    const end = parseISO(activePeriod.end)
    return entriesToUse.filter((entry) => {
      if (!entry?.date) return false
      const entryDate = parseISO(entry.date)
      if (Number.isNaN(entryDate.getTime())) return false
      return entryDate >= start && entryDate <= end
    })
  }, [viewMode, paginatedEntries, allEntries, activePeriod])

  // Group entries by date for feed (will be filtered later after memorials load)
  const entriesByDateUnfiltered = useMemo(() => {
    const grouped = entriesWithinPeriod.reduce(
      (acc, entry) => {
        const date = entry.date
        if (!acc[date]) {
          acc[date] = []
        }
        acc[date].push(entry)
        return acc
      },
      {} as Record<string, any[]>,
    )
    return grouped
  }, [entriesWithinPeriod])

  // Build period summaries for filtering (Weeks/Months/Years) - will be updated after filteredEntries is defined
  // These are placeholders that will be replaced after filteredEntries is defined
  let weekSummaries = useMemo(() => buildPeriodSummaries(entriesWithinPeriod, "Weeks"), [entriesWithinPeriod])
  let monthSummaries = useMemo(() => buildPeriodSummaries(entriesWithinPeriod, "Months"), [entriesWithinPeriod])
  let yearSummaries = useMemo(() => buildPeriodSummaries(entriesWithinPeriod, "Years"), [entriesWithinPeriod])

  // Function to handle period selection (from period cards)
  function handlePeriodSelect(mode: PeriodMode, period: PeriodSummary) {
    setActivePeriod({
      mode,
      start: period.start,
      end: period.end,
      title: period.title,
      subtitle: period.subtitle,
    })
    setViewMode("Days")
    setShowFilter(false)
  }

  // Function to load next batch of dates (7 days going backwards)
  const loadNextBatch = useCallback(async () => {
    if (viewMode !== "Days" || isLoadingMoreEntries || !hasMoreEntries || !currentGroupId) {
      return
    }

    // CRITICAL: Save current scroll position before loading new data
    // This prevents scroll position from resetting when new content is added
    if (scrollViewRef.current) {
      // Get current scroll position from the scroll event handler's tracked value
      savedScrollPosition.current = lastScrollY.current
    }

    setIsLoadingMoreEntries(true)

    try {
      // Find the oldest loaded date
      const sortedDates = [...loadedDateRanges].sort((a, b) => b.localeCompare(a))
      const oldestLoadedDate = sortedDates[sortedDates.length - 1]

      // Check if we've reached group creation date
      const groupCreatedDate = currentGroup?.created_at 
        ? utcStringToLocalDate(currentGroup.created_at)
        : null

      if (groupCreatedDate && oldestLoadedDate <= groupCreatedDate) {
        // Reached group creation date, no more entries to load
        setHasMoreEntries(false)
        setIsLoadingMoreEntries(false)
        return
      }

      // Generate next 7 days going backwards from 1 day before oldest loaded date
      // Start from 1 day before oldest date to avoid overlap
      const startDate = new Date(`${oldestLoadedDate}T00:00:00`)
      startDate.setDate(startDate.getDate() - 1)
      const newDates = generateDateRange(formatDateAsLocalISO(startDate), 7)

      // Filter out dates that are already loaded and dates before group creation
      const datesToAdd = newDates.filter((date) => {
        if (!loadedDateRanges.includes(date)) {
          if (groupCreatedDate && date < groupCreatedDate) {
            return false
          }
          return true
        }
        return false
      })

      if (datesToAdd.length === 0) {
        // No new dates to add, we've reached the end
        setHasMoreEntries(false)
      } else {
        // Add new dates to loaded ranges
        setLoadedDateRanges((prev) => {
          const combined = [...prev, ...datesToAdd]
          // Sort and deduplicate
          return Array.from(new Set(combined)).sort((a, b) => b.localeCompare(a))
        })
      }
    } catch (error) {
      console.error("[home] Error loading next batch:", error)
    } finally {
      setIsLoadingMoreEntries(false)
    }
  }, [viewMode, isLoadingMoreEntries, hasMoreEntries, currentGroupId, loadedDateRanges, currentGroup, generateDateRange])

  // CRITICAL: Restore scroll position after content size changes (when new dates are loaded)
  // This prevents the scroll position from jumping to top when new content is added
  const handleContentSizeChange = useCallback((contentWidth: number, contentHeight: number) => {
    if (savedScrollPosition.current !== null && scrollViewRef.current && !isLoadingMoreEntries) {
      // Restore exact scroll position after content size has changed
      // Use multiple requestAnimationFrame calls to ensure layout is complete
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            if (scrollViewRef.current && savedScrollPosition.current !== null) {
              scrollViewRef.current.scrollTo({
                y: savedScrollPosition.current,
                animated: false, // Instant scroll to avoid visible jump
              })
              // Clear saved position after restoring
              savedScrollPosition.current = null
            }
          }, 50) // Small delay to ensure layout is fully complete
        })
      })
    }
  }, [isLoadingMoreEntries])

  // CRITICAL: Also restore scroll position when loadedDateRanges changes (backup to onContentSizeChange)
  // Use useLayoutEffect to restore synchronously before paint to prevent visible jump
  useLayoutEffect(() => {
    if (!isLoadingMoreEntries && savedScrollPosition.current !== null && scrollViewRef.current) {
      // Restore scroll position synchronously before paint
      // Use requestAnimationFrame to ensure ScrollView is ready
      requestAnimationFrame(() => {
        if (scrollViewRef.current && savedScrollPosition.current !== null) {
          scrollViewRef.current.scrollTo({
            y: savedScrollPosition.current,
            animated: false, // Instant scroll to avoid visible jump
          })
          // Clear saved position after restoring
          savedScrollPosition.current = null
        }
      })
    }
  }, [loadedDateRanges, isLoadingMoreEntries])

  // Function to scroll to a specific date in the feed
  function scrollToDate(date: string) {
    const ref = dateRefs.current[date]
    if (ref && scrollViewRef.current) {
      ref.measureLayout(
        scrollViewRef.current as any,
        (x: number, y: number) => {
          // Scroll to the date header position, accounting for the sticky header
          // Use headerHeight to ensure date header appears right below sticky header
          const reducedPadding = headerHeight - spacing.xl
          scrollViewRef.current?.scrollTo({ 
            y: Math.max(0, y - reducedPadding), 
            animated: true 
          })
        },
        () => {
          console.warn(`[home] Failed to measure layout for date ${date}`)
        }
      )
    }
  }

  // Function to handle day button press - scroll to date and clear filters
  function handleDayPress(date: string) {
    setSelectedDate(date)
    setActivePeriod(null) // Clear filters
    setViewMode("Days") // Return to Days view
    // Scroll to date after a brief delay to ensure feed is rendered
    setTimeout(() => {
      scrollToDate(date)
    }, 100)
  }

  // Function to render period grid (like history.tsx)
  function renderPeriodGrid(periods: PeriodSummary[], mode: PeriodMode) {
    // Show skeleton cards while loading - never show "No weeks captured" during initial load
    // Show skeleton if: no groupId yet, query is loading/fetching, or we have no entries yet (waiting for data)
    const shouldShowSkeleton = !currentGroupId || 
                               allEntriesLoading || 
                               allEntriesFetching || 
                               (currentGroupId && allEntries.length === 0)
    
    if (shouldShowSkeleton) {
      return (
        <View style={styles.periodGrid}>
          {[1, 2, 3, 4].map((i) => (
            <EntryCardSkeleton key={i} />
          ))}
        </View>
      )
    }
    
    // Only show "No weeks captured" if we've definitely finished loading and have no periods
    // This means: query completed (not loading/fetching), we have a groupId, and periods is empty
    if (periods.length === 0 && currentGroupId && !allEntriesLoading && !allEntriesFetching) {
      return (
        <View style={{ padding: spacing.xl, alignItems: "center" }}>
          <Text style={{ ...typography.body, color: theme2Colors.textSecondary }}>
            No {mode.toLowerCase()} captured yet
          </Text>
        </View>
      )
    }

    return (
      <View style={styles.periodGrid}>
        {periods.map((period) => {
          const textContent = (
            <View style={styles.periodOverlay}>
              <Text style={styles.periodTitle}>{period.title}</Text>
              <Text style={styles.periodSubtitle}>{period.subtitle}</Text>
              <Text style={styles.periodCount}>
                {period.count} {period.count === 1 ? "entry" : "entries"}
              </Text>
            </View>
          )

          return (
            <TouchableOpacity
              key={period.key}
              style={styles.periodCard}
              onPress={() => handlePeriodSelect(mode, period)}
              activeOpacity={0.85}
            >
              {period.image ? (
                <ImageBackground
                  source={{ uri: period.image }}
                  style={styles.periodBackground}
                  imageStyle={styles.periodImage}
                >
                  <View style={styles.periodShade} />
                  {textContent}
                </ImageBackground>
              ) : (
                <View style={[styles.periodBackground, styles.periodFallback]}>{textContent}</View>
              )}
            </TouchableOpacity>
          )
        })}
      </View>
    )
  }

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
        // CRITICAL: Double-check that all cards belong to the current group
        const filteredCards = cards.filter((card) => card.group_id === currentGroupId)
        if (filteredCards.length !== cards.length) {
          console.warn(`[home] ⚠️ Filtered out ${cards.length - filteredCards.length} cards from wrong group`)
        }
        console.log("[home] ✅ Received upcoming birthday cards:", filteredCards.length, filteredCards)
        return filteredCards
      } catch (error) {
        console.error("[home] ❌ Error fetching upcoming birthday cards:", error)
        throw error
      }
    },
    enabled: !!currentGroupId && !!userId && !!todayDate,
    staleTime: 0, // Always refetch to ensure fresh data when group changes
    gcTime: 0, // Immediately garbage collect old queries to prevent stale data
    refetchOnMount: true, // Refetch when component mounts to ensure correct group data
    placeholderData: undefined, // Don't show stale data from previous group
    refetchOnWindowFocus: true, // Always refetch on focus
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
    queryFn: async () => {
      if (!currentGroupId || !userId || !selectedDate) return []
      const entries = await getMyCardEntriesForDate(currentGroupId, userId, selectedDate)
      // CRITICAL: Double-check that all entries belong to cards in the current group
      const filteredEntries = entries.filter((entry: any) => entry.card?.group_id === currentGroupId)
      if (filteredEntries.length !== entries.length) {
        console.warn(`[home] ⚠️ Filtered out ${entries.length - filteredEntries.length} card entries from wrong group`)
      }
      return filteredEntries
    },
    enabled: !!currentGroupId && !!userId && !!selectedDate,
    staleTime: 0, // Always refetch to ensure fresh data when group changes
    refetchOnMount: true, // Refetch when component mounts to ensure correct group data
    placeholderData: undefined, // Don't show stale data from previous group
  })

  const { data: myBirthdayCardRaw } = useQuery({
    queryKey: ["myBirthdayCard", currentGroupId, userId, selectedDate],
    queryFn: async () => {
      if (!currentGroupId || !userId || !selectedDate) return null
      const card = await getMyBirthdayCard(currentGroupId, userId, selectedDate)
      // CRITICAL: Double-check that the card belongs to the current group
      if (card && card.group_id !== currentGroupId) {
        console.warn(`[home] ⚠️ Birthday card from wrong group detected, returning null. Card group: ${card.group_id}, Current group: ${currentGroupId}`)
        return null
      }
      return card
    },
    enabled: !!currentGroupId && !!userId && !!selectedDate,
    staleTime: 0, // Always refetch to ensure fresh data when group changes
    gcTime: 0, // Immediately garbage collect old queries to prevent stale data
    refetchOnMount: true, // Refetch when component mounts to ensure correct group data
    placeholderData: undefined, // Don't show stale data from previous group
    // CRITICAL: Don't use any cached data - always fetch fresh
    refetchOnWindowFocus: true,
  })

  // CRITICAL: Filter out any card that doesn't match current group (defensive check)
  // This ensures that even if React Query returns stale data, we filter it out
  const myBirthdayCard = useMemo(() => {
    // If no currentGroupId, always return null
    if (!currentGroupId) {
      if (myBirthdayCardRaw) {
        console.warn(`[home] ⚠️ No currentGroupId but card exists, returning null`)
      }
      return null
    }
    
    // If no card, return null
    if (!myBirthdayCardRaw) return null
    
    // CRITICAL: Always check group_id matches - this is the final safety check
    if (myBirthdayCardRaw.group_id !== currentGroupId) {
      console.warn(`[home] ⚠️ Filtered out birthday card from wrong group. Card group: ${myBirthdayCardRaw.group_id}, Current group: ${currentGroupId}, Card ID: ${myBirthdayCardRaw.id}`)
      return null
    }
    
    return myBirthdayCardRaw
  }, [myBirthdayCardRaw, currentGroupId])

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

  // Fetch memorials (needed for variable replacement if needed)
  const { data: memorials = [] } = useQuery({
    queryKey: ["memorials", currentGroupId],
    queryFn: () => (currentGroupId ? getMemorials(currentGroupId) : []),
    enabled: !!currentGroupId,
  })

  // Only use actual prompts from dailyPrompt or entries - NO fallback prompts
  const promptId = dailyPrompt?.prompt_id ?? entries[0]?.prompt_id
  const todayPromptId = todayDailyPrompt?.prompt_id ?? todayEntries[0]?.prompt_id

  const { data: groupMembersForVariables = [] } = useQuery({
    queryKey: ["membersForVariables", currentGroupId],
    queryFn: () => (currentGroupId ? getGroupMembers(currentGroupId) : []),
    enabled: !!currentGroupId && !!basePrompt?.question?.match(/\{.*member_name.*\}/i),
  })

  // Fetch prompt_name_usage for member_name to get the exact name that was stored
  // CRITICAL: Use the stored name from prompt_name_usage, not recalculate
  const { data: memberNameUsage = [] } = useQuery({
    queryKey: ["memberNameUsage", currentGroupId, selectedDate],
    queryFn: async () => {
      if (!currentGroupId || !promptId) return []
      const { data, error } = await supabase
        .from("prompt_name_usage")
        .select("prompt_id, date_used, name_used, created_at")
        .eq("group_id", currentGroupId)
        .eq("variable_type", "member_name")
        .order("created_at", { ascending: true })
      if (error) {
        console.error("[home] Error fetching member name usage:", error)
        return []
      }
      return (data || []) as Array<{ prompt_id: string; date_used: string; name_used: string; created_at: string }>
    },
    enabled: !!currentGroupId && !!promptId && !!basePrompt?.question?.match(/\{.*member_name.*\}/i),
    staleTime: 0,
    refetchOnMount: true,
  })

  // Fetch prompt_name_usage for memorial_name to get the exact name that was stored
  // CRITICAL: Use the stored name from prompt_name_usage, not recalculate
  const { data: memorialNameUsage = [] } = useQuery({
    queryKey: ["memorialNameUsage", currentGroupId, selectedDate],
    queryFn: async () => {
      if (!currentGroupId || !promptId) return []
      const { data, error } = await supabase
        .from("prompt_name_usage")
        .select("prompt_id, date_used, name_used, created_at")
        .eq("group_id", currentGroupId)
        .eq("variable_type", "memorial_name")
        .order("created_at", { ascending: true })
      if (error) {
        console.error("[home] Error fetching memorial name usage:", error)
        return []
      }
      return (data || []) as Array<{ prompt_id: string; date_used: string; name_used: string; created_at: string }>
    },
    enabled: !!currentGroupId && !!promptId && !!basePrompt?.question?.match(/\{.*memorial_name.*\}/i),
    staleTime: 0,
    refetchOnMount: true,
  })

  // Create a map of prompt_id + date -> member name used
  const memberUsageMap = useMemo(() => {
    const map = new Map<string, string>()
    memberNameUsage.forEach((usage) => {
      const normalizedDate = usage.date_used.split('T')[0]
      const key = `${usage.prompt_id}-${normalizedDate}`
      if (!map.has(key)) {
        map.set(key, usage.name_used)
      }
    })
    return map
  }, [memberNameUsage])

  // Create a map of prompt_id + date -> memorial name used
  const memorialUsageMap = useMemo(() => {
    const map = new Map<string, string>()
    memorialNameUsage.forEach((usage) => {
      const normalizedDate = usage.date_used.split('T')[0]
      const key = `${usage.prompt_id}-${normalizedDate}`
      if (!map.has(key)) {
        map.set(key, usage.name_used)
      }
    })
    return map
  }, [memorialNameUsage])

  // Filter entries by selected filters - must be defined after memorials and memorialUsageMap
  const filteredEntries = useMemo(() => {
    if (!memorials || !memorialUsageMap) {
      // If memorials haven't loaded yet, return entriesWithinPeriod (will re-filter when loaded)
      return entriesWithinPeriod
    }
    
    return entriesWithinPeriod.filter((entry) => {
      const isCustom = entry.prompt?.is_custom === true
      const category = isCustom ? "Custom" : (entry.prompt?.category ?? "")

      if (selectedCategories.length > 0 && (!category || !selectedCategories.includes(category))) {
        return false
      }

      if (selectedDecks.length > 0) {
        const entryDeckId = entry.prompt?.deck_id || null
        if (!entryDeckId || !selectedDecks.includes(entryDeckId)) {
          return false
        }
      }

      if (selectedMembers.length > 0 && !selectedMembers.includes(entry.user_id)) {
        return false
      }
      
      if (selectedMemorials.length > 0 && currentGroupId) {
        const entryQuestion = entry.prompt?.question || ""
        const prompt = entry.prompt
        
        const hasMemorialVariable = prompt?.dynamic_variables?.includes("memorial_name") || 
                                    entryQuestion.match(/\{.*memorial_name.*\}/i)
        
        if (hasMemorialVariable) {
          // Determine which memorial was used for this prompt on this date
          const memorialNameUsed = getMemorialForPrompt(entry.prompt_id, entry.date, currentGroupId, memorials, memorialUsageMap)
          
          if (memorialNameUsed) {
            const matchesSelectedMemorial = selectedMemorials.some((memorialId) => {
              const memorial = memorials.find((m) => m.id === memorialId)
              return memorial && memorial.name === memorialNameUsed
            })
            
            if (!matchesSelectedMemorial) {
              return false
            }
          } else {
            // Memorials are loaded but calculation returned null - exclude the entry
            return false
          }
        } else {
          // For prompts without memorial_name variable, check if question directly contains memorial name
          const containsMemorialName = selectedMemorials.some((memorialId) => {
            const memorial = memorials.find((m) => m.id === memorialId)
            return memorial && entryQuestion.includes(memorial.name)
          })
          
          if (!containsMemorialName) {
            return false
          }
        }
      }
      return true
    })
  }, [entriesWithinPeriod, selectedCategories, selectedMembers, selectedMemorials, selectedDecks, memorials, memorialUsageMap, currentGroupId])

  // Check if any filters are active (excluding birthday cards filter)
  const hasActiveFilters = useMemo(() => {
    return selectedCategories.length > 0 || 
           selectedMembers.length > 0 || 
           selectedMemorials.length > 0 || 
           selectedDecks.length > 0 ||
           activePeriod !== null
  }, [selectedCategories, selectedMembers, selectedMemorials, selectedDecks, activePeriod])

  // Mix birthday cards with regular entries (like history.tsx)
  // When showBirthdayCards filter is active, show ONLY birthday cards
  // CRITICAL: Only include cards that have entries
  // IMPORTANT: Only add birthday cards when showBirthdayCards is true OR when no other filters are active
  const entriesWithBirthdayCards = useMemo(() => {
    // Filter birthday cards to only include cards from the current group AND that have entries
    const filteredBirthdayCards = myBirthdayCards.filter((card) => {
      // Must belong to current group
      if (card.group_id !== currentGroupId) return false
      // Must have entries
      const cardEntries = allCardEntries[card.id] || []
      if (cardEntries.length === 0) return false
      return true
    })
    
    // Create a map of birthday cards by date
    const cardsByDate = new Map<string, typeof filteredBirthdayCards>()
    filteredBirthdayCards.forEach((card) => {
      if (!cardsByDate.has(card.birthday_date)) {
        cardsByDate.set(card.birthday_date, [])
      }
      cardsByDate.get(card.birthday_date)!.push(card)
    })
    
    // If birthday card filter is active, show ONLY birthday cards
    if (showBirthdayCards) {
      const entries: any[] = []
      cardsByDate.forEach((cards, date) => {
        cards.forEach((card) => {
          // Create a special entry-like object for the birthday card
          entries.push({
            id: `birthday-card-${card.id}`,
            group_id: card.group_id,
            user_id: card.birthday_user_id,
            prompt_id: null,
            date: card.birthday_date,
            text_content: null,
            media_urls: null,
            media_types: null,
            embedded_media: null,
            created_at: card.published_at || card.created_at,
            user: card.birthday_user,
            prompt: null,
            is_birthday_card: true, // Flag to identify birthday cards
            birthday_card_id: card.id,
          })
        })
      })
      
      // Sort by date descending, then by created_at descending
      return entries.sort((a, b) => {
        const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime()
        if (dateCompare !== 0) return dateCompare
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    }
    
    // Otherwise, only mix birthday cards with regular entries if NO other filters are active
    const entries: any[] = [...filteredEntries]
    if (!hasActiveFilters) {
      // Only add birthday cards when no other filters are active
      cardsByDate.forEach((cards, date) => {
        cards.forEach((card) => {
          // Create a special entry-like object for the birthday card
          entries.push({
            id: `birthday-card-${card.id}`,
            group_id: card.group_id,
            user_id: card.birthday_user_id,
            prompt_id: null,
            date: card.birthday_date,
            text_content: null,
            media_urls: null,
            media_types: null,
            embedded_media: null,
            created_at: card.published_at || card.created_at,
            user: card.birthday_user,
            prompt: null,
            is_birthday_card: true, // Flag to identify birthday cards
            birthday_card_id: card.id,
          })
        })
      })
    }
    
    // Sort by date descending, then by created_at descending
    return entries.sort((a, b) => {
      const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime()
      if (dateCompare !== 0) return dateCompare
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [filteredEntries, showBirthdayCards, myBirthdayCards, currentGroupId, allCardEntries, hasActiveFilters])

  // Group entries with birthday cards by date for feed
  const entriesByDate = useMemo(() => {
    const grouped = entriesWithBirthdayCards.reduce(
      (acc, entry) => {
        const date = entry.date
        if (!acc[date]) {
          acc[date] = []
        }
        acc[date].push(entry)
        return acc
      },
      {} as Record<string, any[]>,
    )
    return grouped
  }, [entriesWithBirthdayCards])

  // Update period summaries with filtered entries
  weekSummaries = useMemo(() => buildPeriodSummaries(filteredEntries, "Weeks"), [filteredEntries])
  monthSummaries = useMemo(() => buildPeriodSummaries(filteredEntries, "Months"), [filteredEntries])
  yearSummaries = useMemo(() => buildPeriodSummaries(filteredEntries, "Years"), [filteredEntries])

  // Check if today's prompt matches the active filters
  const promptMatchesFilters = useMemo(() => {
    // If no filters are active, show the prompt
    if (selectedCategories.length === 0 && selectedMembers.length === 0 && selectedMemorials.length === 0 && selectedDecks.length === 0) {
      return true
    }

    const prompt = dailyPrompt?.prompt
    if (!prompt) return false

    // Check category filter
    if (selectedCategories.length > 0) {
      const isCustom = prompt.is_custom === true
      const category = isCustom ? "Custom" : (prompt.category ?? "")
      if (!category || !selectedCategories.includes(category)) {
        return false
      }
    }

    // Check deck filter
    if (selectedDecks.length > 0) {
      const promptDeckId = prompt.deck_id || null
      if (!promptDeckId || !selectedDecks.includes(promptDeckId)) {
        return false
      }
    }

    // Check memorial filter
    if (selectedMemorials.length > 0 && currentGroupId && dailyPrompt?.prompt_id && selectedDate && memorials && memorialUsageMap) {
      const promptQuestion = prompt.question || ""
      const hasMemorialVariable = prompt.dynamic_variables?.includes("memorial_name") || 
                                  promptQuestion.match(/\{.*memorial_name.*\}/i)
      
      if (hasMemorialVariable) {
        const memorialNameUsed = getMemorialForPrompt(dailyPrompt.prompt_id, selectedDate, currentGroupId, memorials, memorialUsageMap)
        
        if (memorialNameUsed) {
          const matchesSelectedMemorial = selectedMemorials.some((memorialId) => {
            const memorial = memorials.find((m) => m.id === memorialId)
            return memorial && memorial.name === memorialNameUsed
          })
          
          if (!matchesSelectedMemorial) {
            return false
          }
        } else if (memorials.length > 0) {
          return false
        }
      } else {
        const containsMemorialName = selectedMemorials.some((memorialId) => {
          const memorial = memorials.find((m) => m.id === memorialId)
          return memorial && promptQuestion.includes(memorial.name)
        })
        
        if (!containsMemorialName) {
          return false
        }
      }
    }

    return true
  }, [dailyPrompt?.prompt, dailyPrompt?.prompt_id, selectedDate, selectedCategories, selectedMembers, selectedMemorials, selectedDecks, memorials, memorialUsageMap, currentGroupId])

  // Check if today's prompt matches the active filters (for showing prompt card at top)
  const todayPromptMatchesFilters = useMemo(() => {
    // If no filters are active, show the prompt
    if (selectedCategories.length === 0 && selectedMembers.length === 0 && selectedMemorials.length === 0 && selectedDecks.length === 0) {
      return true
    }

    const prompt = todayDailyPrompt?.prompt
    if (!prompt) return false

    // Check category filter
    if (selectedCategories.length > 0) {
      const isCustom = prompt.is_custom === true
      const category = isCustom ? "Custom" : (prompt.category ?? "")
      if (!category || !selectedCategories.includes(category)) {
        return false
      }
    }

    // Check deck filter
    if (selectedDecks.length > 0) {
      const promptDeckId = prompt.deck_id || null
      if (!promptDeckId || !selectedDecks.includes(promptDeckId)) {
        return false
      }
    }

    // Check memorial filter
    if (selectedMemorials.length > 0 && currentGroupId && todayDailyPrompt?.prompt_id && todayDate && memorials && memorialUsageMap) {
      const promptQuestion = prompt.question || ""
      const hasMemorialVariable = prompt.dynamic_variables?.includes("memorial_name") || 
                                  promptQuestion.match(/\{.*memorial_name.*\}/i)
      
      if (hasMemorialVariable) {
        const memorialNameUsed = getMemorialForPrompt(todayDailyPrompt.prompt_id, todayDate, currentGroupId, memorials, memorialUsageMap)
        
        if (memorialNameUsed) {
          const matchesSelectedMemorial = selectedMemorials.some((memorialId) => {
            const memorial = memorials.find((m) => m.id === memorialId)
            return memorial && memorial.name === memorialNameUsed
          })
          
          if (!matchesSelectedMemorial) {
            return false
          }
        } else if (memorials.length > 0) {
          return false
        }
      } else {
        const containsMemorialName = selectedMemorials.some((memorialId) => {
          const memorial = memorials.find((m) => m.id === memorialId)
          return memorial && promptQuestion.includes(memorial.name)
        })
        
        if (!containsMemorialName) {
          return false
        }
      }
    }

    return true
  }, [todayDailyPrompt?.prompt, todayDailyPrompt?.prompt_id, todayDate, selectedCategories, selectedMembers, selectedMemorials, selectedDecks, memorials, memorialUsageMap, currentGroupId])

  // Check if today's question is about the current user (member_name matches userName)
  // CRITICAL: Only check for member_name prompts, not memorial_name
  const isTodayQuestionAboutMe = useMemo(() => {
    // Only check if we have a prompt with member_name variable
    const promptQuestion = todayDailyPrompt?.prompt?.question
    if (!promptQuestion || !promptQuestion.match(/\{.*member_name.*\}/i)) {
      return false
    }
    
    // Need prompt ID and date to look up the member name used
    const currentPromptId = todayDailyPrompt?.prompt_id
    if (!currentPromptId || !todayDate || !userName) {
      return false
    }
    
    // Get the member name that was used for this prompt on today's date
    const normalizedDate = todayDate.split('T')[0]
    const usageKey = `${currentPromptId}-${normalizedDate}`
    const memberNameUsed = memberUsageMap.get(usageKey)
    
    if (!memberNameUsed) {
      // No usage record found - can't determine if it's about me
      return false
    }
    
    // Compare names (case-insensitive, trimmed)
    const normalizedUsedName = memberNameUsed.trim().toLowerCase()
    const normalizedUserName = userName.trim().toLowerCase()
    
    return normalizedUsedName === normalizedUserName
  }, [todayDailyPrompt?.prompt?.question, todayDailyPrompt?.prompt_id, todayDate, userName, memberUsageMap])

  // Check if selected date's question is about the current user (member_name matches userName)
  // CRITICAL: Only check for member_name prompts, not memorial_name
  const isQuestionAboutMe = useMemo(() => {
    // Only check if we have a prompt with member_name variable
    const promptQuestion = dailyPrompt?.prompt?.question || entries[0]?.prompt?.question
    if (!promptQuestion || !promptQuestion.match(/\{.*member_name.*\}/i)) {
      return false
    }
    
    // Need prompt ID and date to look up the member name used
    const currentPromptId = dailyPrompt?.prompt_id || entries[0]?.prompt_id
    if (!currentPromptId || !selectedDate || !userName) {
      return false
    }
    
    // Get the member name that was used for this prompt on this date
    const normalizedDate = selectedDate.split('T')[0]
    const usageKey = `${currentPromptId}-${normalizedDate}`
    const memberNameUsed = memberUsageMap.get(usageKey)
    
    if (!memberNameUsed) {
      // No usage record found - can't determine if it's about me
      return false
    }
    
    // Compare names (case-insensitive, trimmed)
    const normalizedUsedName = memberNameUsed.trim().toLowerCase()
    const normalizedUserName = userName.trim().toLowerCase()
    
    return normalizedUsedName === normalizedUserName
  }, [dailyPrompt?.prompt?.question, dailyPrompt?.prompt_id, entries, selectedDate, userName, memberUsageMap])

  // Personalize prompt question with variables
  // CRITICAL: Only work with actual prompts from dailyPrompt or entries - never fallback prompts
  const personalizedPromptQuestion = useMemo(() => {
    // If we have a prompt from dailyPrompt, use it directly (already personalized by getDailyPrompt)
    const dailyPromptQuestion = dailyPrompt?.prompt?.question?.trim()
    if (dailyPromptQuestion) {
      // Check if the question is already personalized (no variables)
      const hasVariables = dailyPromptQuestion.match(/\{.*memorial_name.*\}/i) || 
                          dailyPromptQuestion.match(/\{.*member_name.*\}/i)
      
      if (!hasVariables) {
        // Already personalized correctly by getDailyPrompt - use it EXACTLY as-is
        return dailyPromptQuestion
      } else {
        // This is a bug in getDailyPrompt - it should have personalized but didn't
        // But we should still check prompt_name_usage to get the correct name
        let question = dailyPromptQuestion
        const variables: Record<string, string> = {}
        
        // Handle memorial_name variable - check prompt_name_usage first
        if (question.match(/\{.*memorial_name.*\}/i) && dailyPrompt?.prompt_id && selectedDate) {
          const normalizedDate = selectedDate.split('T')[0]
          const usageKey = `${dailyPrompt.prompt_id}-${normalizedDate}`
          const memorialNameUsed = memorialUsageMap.get(usageKey)
          
          if (memorialNameUsed) {
            question = personalizeMemorialPrompt(question, memorialNameUsed)
            // Verify the replacement worked - if question still has variables, something went wrong
            if (question.match(/\{.*memorial_name.*\}/i)) {
              console.warn(`[home] personalizeMemorialPrompt failed to replace variables. Question: ${question}, Memorial: ${memorialNameUsed}`)
            }
          } else if (memorials.length > 0) {
            // Fallback: use deterministic logic to select memorial
            const dayIndex = getDayIndex(selectedDate, currentGroupId || "")
            const memorialIndex = dayIndex % memorials.length
            const selectedMemorialName = memorials[memorialIndex]?.name
            
            if (selectedMemorialName) {
              question = personalizeMemorialPrompt(question, selectedMemorialName)
              // Verify the replacement worked
              if (question.match(/\{.*memorial_name.*\}/i)) {
                console.warn(`[home] personalizeMemorialPrompt failed to replace variables (fallback). Question: ${question}, Memorial: ${selectedMemorialName}`)
              }
            } else {
              console.warn(`[home] getDailyPrompt returned unpersonalized memorial_name but no memorial found`)
            }
          } else {
            console.warn(`[home] getDailyPrompt returned unpersonalized memorial_name but no memorials available`)
          }
        }
        
        // Handle member_name variable - ONLY use prompt_name_usage, NO fallback
        // CRITICAL: Must use the exact name from prompt_name_usage that getDailyPrompt set
        if (question.match(/\{.*member_name.*\}/i) && dailyPrompt?.prompt_id && selectedDate) {
          const normalizedDate = selectedDate.split('T')[0]
          const usageKey = `${dailyPrompt.prompt_id}-${normalizedDate}`
          const memberNameUsed = memberUsageMap.get(usageKey)
          
          if (memberNameUsed) {
            variables.member_name = memberNameUsed
            question = replaceDynamicVariables(question, variables)
            // Verify the replacement worked
            if (question.match(/\{.*member_name.*\}/i)) {
              console.warn(`[home] replaceDynamicVariables failed to replace member_name. Question: ${question}, Member: ${memberNameUsed}`)
            }
          } else {
            // NO FALLBACK - if prompt_name_usage doesn't exist, that's a bug
            // Log error but don't replace the variable
            console.error(`[home] CRITICAL: No prompt_name_usage found for member_name. promptId: ${dailyPrompt.prompt_id}, date: ${selectedDate}, groupId: ${currentGroupId}`)
            // Leave {member_name} as-is - this indicates a bug that needs to be fixed
          }
        }
        
        // Final check: if question is empty or still has variables, return empty string (will show fallback)
        const finalQuestion = question.trim()
        if (!finalQuestion || finalQuestion.match(/\{.*(memorial_name|member_name).*\}/i)) {
          console.warn(`[home] Question is empty or still has variables after personalization: ${finalQuestion}`)
          return ""
        }
        
        return finalQuestion
      }
    }
    
    // If we have a prompt from entries, use it (may need personalization)
    if (entries[0]?.prompt?.question) {
      let question = entries[0].prompt.question
      const variables: Record<string, string> = {}
      
      // Handle memorial_name variable
      if (question.match(/\{.*memorial_name.*\}/i)) {
        if (memorials.length > 0) {
          // Use deterministic logic to select memorial
          const dayIndex = getDayIndex(selectedDate, currentGroupId || "")
          const memorialIndex = dayIndex % memorials.length
          const selectedMemorialName = memorials[memorialIndex]?.name
          
          if (selectedMemorialName) {
            question = personalizeMemorialPrompt(question, selectedMemorialName)
          }
        }
      }
      
      // Handle member_name variable - check prompt_name_usage first
      if (question.match(/\{.*member_name.*\}/i)) {
        const entryPromptId = entries[0].prompt_id
        if (entryPromptId && selectedDate) {
          const normalizedDate = selectedDate.split('T')[0]
          const usageKey = `${entryPromptId}-${normalizedDate}`
          const memberNameUsed = memberUsageMap.get(usageKey)
          
          if (memberNameUsed) {
            // Use the exact name from prompt_name_usage (ensures consistency)
            variables.member_name = memberNameUsed
            question = replaceDynamicVariables(question, variables)
          } else if (groupMembersForVariables.length > 0) {
            // Fallback: if no usage record exists, use first member
            console.warn(`[home] No prompt_name_usage found for member_name, using first member as fallback`)
            variables.member_name = groupMembersForVariables[0].user?.name || "them"
            question = replaceDynamicVariables(question, variables)
          }
        }
      }
      
      return question
    }
    
    // No valid prompt available - return empty string (skeleton will be shown)
    return ""
  }, [dailyPrompt?.prompt?.question, dailyPrompt?.prompt_id, entries, memorials, groupMembersForVariables, currentGroupId, selectedDate, memberUsageMap, memberNameUsage, memorialUsageMap, memorialNameUsage])

  // Fetch prompt_name_usage for today's member_name (for prompt card at top)
  const { data: todayMemberNameUsage = [] } = useQuery({
    queryKey: ["memberNameUsage", currentGroupId, todayDate],
    queryFn: async () => {
      if (!currentGroupId || !todayPromptId) return []
      const { data, error } = await supabase
        .from("prompt_name_usage")
        .select("prompt_id, date_used, name_used, created_at")
        .eq("group_id", currentGroupId)
        .eq("variable_type", "member_name")
        .order("created_at", { ascending: true })
      if (error) {
        console.error("[home] Error fetching today's member name usage:", error)
        return []
      }
      return (data || []) as Array<{ prompt_id: string; date_used: string; name_used: string; created_at: string }>
    },
    enabled: !!currentGroupId && !!todayPromptId && !!todayDailyPrompt?.prompt?.question?.match(/\{.*member_name.*\}/i),
    staleTime: 0,
    refetchOnMount: true,
  })

  // Fetch prompt_name_usage for today's memorial_name (for prompt card at top)
  const { data: todayMemorialNameUsage = [] } = useQuery({
    queryKey: ["memorialNameUsage", currentGroupId, todayDate],
    queryFn: async () => {
      if (!currentGroupId || !todayPromptId) return []
      const { data, error } = await supabase
        .from("prompt_name_usage")
        .select("prompt_id, date_used, name_used, created_at")
        .eq("group_id", currentGroupId)
        .eq("variable_type", "memorial_name")
        .order("created_at", { ascending: true })
      if (error) {
        console.error("[home] Error fetching today's memorial name usage:", error)
        return []
      }
      return (data || []) as Array<{ prompt_id: string; date_used: string; name_used: string; created_at: string }>
    },
    enabled: !!currentGroupId && !!todayPromptId && !!todayDailyPrompt?.prompt?.question?.match(/\{.*memorial_name.*\}/i),
    staleTime: 0,
    refetchOnMount: true,
  })

  // Create maps for today's name usage
  const todayMemberUsageMap = useMemo(() => {
    const map = new Map<string, string>()
    todayMemberNameUsage.forEach((usage) => {
      const normalizedDate = usage.date_used.split('T')[0]
      const key = `${usage.prompt_id}-${normalizedDate}`
      if (!map.has(key)) {
        map.set(key, usage.name_used)
      }
    })
    return map
  }, [todayMemberNameUsage])

  const todayMemorialUsageMap = useMemo(() => {
    const map = new Map<string, string>()
    todayMemorialNameUsage.forEach((usage) => {
      const normalizedDate = usage.date_used.split('T')[0]
      const key = `${usage.prompt_id}-${normalizedDate}`
      if (!map.has(key)) {
        map.set(key, usage.name_used)
      }
    })
    return map
  }, [todayMemorialNameUsage])

  // Personalize today's prompt question with variables (for prompt card at top)
  const todayPersonalizedPromptQuestion = useMemo(() => {
    // If we have a prompt from todayDailyPrompt, use it directly (already personalized by getDailyPrompt)
    const todayDailyPromptQuestion = todayDailyPrompt?.prompt?.question?.trim()
    if (todayDailyPromptQuestion) {
      // Check if the question is already personalized (no variables)
      const hasVariables = todayDailyPromptQuestion.match(/\{.*memorial_name.*\}/i) || 
                          todayDailyPromptQuestion.match(/\{.*member_name.*\}/i)
      
      if (!hasVariables) {
        // Already personalized correctly by getDailyPrompt - use it EXACTLY as-is
        return todayDailyPromptQuestion
      } else {
        // This is a bug in getDailyPrompt - it should have personalized but didn't
        // But we should still check prompt_name_usage to get the correct name
        let question = todayDailyPromptQuestion
        const variables: Record<string, string> = {}
        
        // Handle memorial_name variable - check prompt_name_usage first
        if (question.match(/\{.*memorial_name.*\}/i) && todayDailyPrompt?.prompt_id && todayDate) {
          const normalizedDate = todayDate.split('T')[0]
          const usageKey = `${todayDailyPrompt.prompt_id}-${normalizedDate}`
          const memorialNameUsed = todayMemorialUsageMap.get(usageKey)
          
          if (memorialNameUsed) {
            question = personalizeMemorialPrompt(question, memorialNameUsed)
            // Verify the replacement worked - if question still has variables, something went wrong
            if (question.match(/\{.*memorial_name.*\}/i)) {
              console.warn(`[home] personalizeMemorialPrompt failed to replace variables. Question: ${question}, Memorial: ${memorialNameUsed}`)
            }
          } else if (memorials.length > 0) {
            // Fallback: use deterministic logic to select memorial
            const dayIndex = getDayIndex(todayDate, currentGroupId || "")
            const memorialIndex = dayIndex % memorials.length
            const selectedMemorialName = memorials[memorialIndex]?.name
            
            if (selectedMemorialName) {
              question = personalizeMemorialPrompt(question, selectedMemorialName)
              // Verify the replacement worked
              if (question.match(/\{.*memorial_name.*\}/i)) {
                console.warn(`[home] personalizeMemorialPrompt failed to replace variables (fallback). Question: ${question}, Memorial: ${selectedMemorialName}`)
              }
            } else {
              console.warn(`[home] getDailyPrompt returned unpersonalized memorial_name but no memorial found`)
            }
          } else {
            console.warn(`[home] getDailyPrompt returned unpersonalized memorial_name but no memorials available`)
          }
        }
        
        // Handle member_name variable - ONLY use prompt_name_usage, NO fallback
        // CRITICAL: Must use the exact name from prompt_name_usage that getDailyPrompt set
        if (question.match(/\{.*member_name.*\}/i) && todayDailyPrompt?.prompt_id && todayDate) {
          const normalizedDate = todayDate.split('T')[0]
          const usageKey = `${todayDailyPrompt.prompt_id}-${normalizedDate}`
          const memberNameUsed = todayMemberUsageMap.get(usageKey)
          
          if (memberNameUsed) {
            variables.member_name = memberNameUsed
            question = replaceDynamicVariables(question, variables)
            // Verify the replacement worked
            if (question.match(/\{.*member_name.*\}/i)) {
              console.warn(`[home] replaceDynamicVariables failed to replace member_name. Question: ${question}, Member: ${memberNameUsed}`)
            }
          } else {
            // NO FALLBACK - if prompt_name_usage doesn't exist, that's a bug
            // Log error but don't replace the variable
            console.error(`[home] CRITICAL: No prompt_name_usage found for member_name. promptId: ${todayDailyPrompt.prompt_id}, date: ${todayDate}, groupId: ${currentGroupId}`)
            // Leave {member_name} as-is - this indicates a bug that needs to be fixed
          }
        }
        
        // Final check: if question is empty or still has variables, return empty string (will show fallback)
        const finalQuestion = question.trim()
        if (!finalQuestion || finalQuestion.match(/\{.*(memorial_name|member_name).*\}/i)) {
          console.warn(`[home] Question is empty or still has variables after personalization: ${finalQuestion}`)
          return ""
        }
        
        return finalQuestion
      }
    }
    
    // If we have a prompt from todayEntries, use it (may need personalization)
    if (todayEntries[0]?.prompt?.question) {
      let question = todayEntries[0].prompt.question
      const variables: Record<string, string> = {}
      
      // Handle memorial_name variable
      if (question.match(/\{.*memorial_name.*\}/i)) {
        if (memorials.length > 0) {
          // Use deterministic logic to select memorial
          const dayIndex = getDayIndex(todayDate, currentGroupId || "")
          const memorialIndex = dayIndex % memorials.length
          const selectedMemorialName = memorials[memorialIndex]?.name
          
          if (selectedMemorialName) {
            question = personalizeMemorialPrompt(question, selectedMemorialName)
          }
        }
      }
      
      // Handle member_name variable - check prompt_name_usage first
      if (question.match(/\{.*member_name.*\}/i)) {
        const entryPromptId = todayEntries[0].prompt_id
        if (entryPromptId && todayDate) {
          const normalizedDate = todayDate.split('T')[0]
          const usageKey = `${entryPromptId}-${normalizedDate}`
          const memberNameUsed = todayMemberUsageMap.get(usageKey)
          
          if (memberNameUsed) {
            // Use the exact name from prompt_name_usage (ensures consistency)
            variables.member_name = memberNameUsed
            question = replaceDynamicVariables(question, variables)
          } else if (groupMembersForVariables.length > 0) {
            // Fallback: if no usage record exists, use first member
            console.warn(`[home] No prompt_name_usage found for member_name, using first member as fallback`)
            variables.member_name = groupMembersForVariables[0].user?.name || "them"
            question = replaceDynamicVariables(question, variables)
          }
        }
      }
      
      return question
    }
    
    // No valid prompt available - return empty string (skeleton will be shown)
    return ""
  }, [todayDailyPrompt?.prompt?.question, todayDailyPrompt?.prompt_id, todayEntries, memorials, groupMembersForVariables, members, userId, currentGroupId, todayDate, todayMemberUsageMap, todayMemberNameUsage, todayMemorialUsageMap, todayMemorialNameUsage])

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
    
    // Set a maximum timeout for refresh (10 seconds)
    const refreshTimeout = setTimeout(() => {
      console.warn("[home] Refresh timeout - forcing completion")
      setShowRefreshIndicator(false)
      setRefreshing(false)
    }, 10000)
    
    try {
      // Ensure session is valid before refreshing data (with timeout)
      const { ensureValidSession } = await import("../../lib/auth")
      const sessionPromise = ensureValidSession()
      const sessionTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Session refresh timeout")), 8000)
      )
      
      try {
        await Promise.race([sessionPromise, sessionTimeout])
      } catch (sessionError: any) {
        console.warn("[home] Session refresh failed or timed out:", sessionError?.message)
        // Continue with refresh even if session refresh fails - data might still load
      }
      
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
      
      // Invalidate and refetch with timeout
      const invalidatePromise = queryClient.invalidateQueries()
      const invalidateTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Invalidate timeout")), 5000)
      )
      
      try {
        await Promise.race([invalidatePromise, invalidateTimeout])
      } catch (invalidateError) {
        console.warn("[home] Invalidate timed out, continuing...")
      }
      
      // Refetch queries with timeout
      const refetchPromise = queryClient.refetchQueries()
      const refetchTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Refetch timeout")), 5000)
      )
      
      try {
        await Promise.race([refetchPromise, refetchTimeout])
      } catch (refetchError) {
        console.warn("[home] Refetch timed out, continuing...")
      }
      
      // Update badge count after refresh (don't wait for it)
      if (userId) {
        updateBadgeCount(userId).catch((error) => {
          console.warn("[home] Failed to update badge count:", error)
        })
      }
      
      // Check if we should show review modal after refresh
      checkAndShowReviewModal()
      
      // Keep spinner visible for at least 1 second total
      const minDisplayTime = setTimeout(() => {
        setShowRefreshIndicator(false)
      }, 1000)
      
      // Clear timeout if we finish early
      clearTimeout(refreshTimeout)
      clearTimeout(minDisplayTime)
      setShowRefreshIndicator(false)
    } catch (error) {
      console.error("[home] Error during refresh:", error)
      // Don't block UI if refresh fails
      setShowRefreshIndicator(false)
    } finally {
      clearTimeout(refreshTimeout)
      setRefreshing(false)
    }
  }

  async function handleShareInvite() {
    if (!currentGroupId || !userName) return
    try {
      const inviteLink = `https://thegoodtimes.app/join/${currentGroupId}`
      const inviteMessage = `I've created a group for us on this new app, Good Times. Join ${userName} here: ${inviteLink}`
      
      // Platform-specific sharing to prevent duplicate URLs on iOS
      // iOS: Only use message (URL included in text) to avoid preview card duplication
      // Android: Use both url and message for better integration
      if (Platform.OS === "ios") {
        await Share.share({
          message: inviteMessage,
          title: "Invite someone",
        })
      } else {
        await Share.share({
          url: inviteLink,
          message: inviteMessage,
          title: "Invite someone",
        })
      }
    } catch (error: any) {
      Alert.alert("Error", error.message)
    }
  }

  async function handleNotificationPress(notification: InAppNotification) {
    // Mark specific notifications as cleared based on their type
    // Only clear the notification that was clicked, not all notifications
    
    if (notification.type === "new_question") {
      // Clear when user navigates to answer the question (they'll answer it)
      // Don't clear here - let it clear when they actually answer
      // But we can mark it as "seen" if they navigate to it
      if (notification.date && notification.promptId) {
        // Only mark as answered if they navigate to answer it
        // For now, we'll let it persist until they answer
      }
    } else if (notification.type === "reply_to_entry" || notification.type === "reply_to_thread" || notification.type === "mentioned_in_entry") {
      // Clear when user views the entry detail
      if (notification.entryId) {
        await markEntryAsVisited(notification.entryId)
      }
    } else if (notification.type === "new_answers") {
      // Clear when user actually views the group content (not just clicks notification)
      // Don't clear here - let it clear when they actually view the group
      // For now, we'll mark group as visited when they navigate
      await markGroupAsVisited(notification.groupId)
    } else if (notification.type === "deck_vote_requested") {
      // Clear when user votes (handled in deck-vote screen)
      // Don't clear here - let it clear when they vote
    } else if (notification.type === "birthday_card") {
      // Clear when user adds to birthday card (handled in birthday card screen)
      // Don't clear here - let it clear when they add to card
    } else if (notification.type === "custom_question_opportunity") {
      // Clear when user submits custom question (handled in entry-composer)
      // Don't clear here - let it clear when they submit
    }

    // Switch group if notification is for a different group
    if (notification.groupId !== currentGroupId) {
      setCurrentGroupId(notification.groupId)
      await AsyncStorage.setItem("current_group_id", notification.groupId)
      // Invalidate queries for the new group
      queryClient.invalidateQueries({ queryKey: ["dailyPrompt", notification.groupId] })
      queryClient.invalidateQueries({ queryKey: ["entries", notification.groupId] })
    }

    // Handle navigation based on notification type
    if (notification.type === "new_question") {
      // Navigate to home (group already switched above)
      router.replace("/(main)/home")
    } else if (notification.type === "new_answers") {
      // Navigate to home (group already switched above)
      router.replace("/(main)/home")
    } else if (notification.type === "mentioned_in_entry") {
      // Navigate to entry detail for the mentioned entry
      if (notification.entryId) {
        const { data: entries } = await supabase
          .from("entries")
          .select("id")
          .eq("group_id", notification.groupId)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(50)
        
        const entryIdList = entries?.map((e) => e.id) || []
        const entryIndex = entryIdList.indexOf(notification.entryId)
        
        router.push({
          pathname: "/(main)/modals/entry-detail",
          params: {
            entryId: notification.entryId,
            entryIds: JSON.stringify(entryIdList),
            index: entryIndex >= 0 ? String(entryIndex) : undefined,
            returnTo: "/(main)/history",
          },
        })
      }
    } else if (notification.type === "deck_vote_requested") {
      // Navigate to deck vote page
      if (notification.deckId) {
        router.push(`/(main)/deck-vote?deckId=${notification.deckId}&groupId=${notification.groupId}`)
      } else {
        // Fallback to explore decks if deckId is missing
        router.push(`/(main)/explore-decks?groupId=${notification.groupId}`)
      }
    } else if (notification.type === "birthday_card") {
      // Navigate to birthday card screen
      if (notification.birthdayPersonId && notification.birthdayDate) {
        router.push(`/(main)/birthday-card?userId=${notification.birthdayPersonId}&date=${notification.birthdayDate}&groupId=${notification.groupId}`)
      } else {
        router.replace("/(main)/home")
      }
    } else if (notification.type === "custom_question_opportunity") {
      // Navigate to explore decks to ask custom question
      router.push(`/(main)/explore-decks?groupId=${notification.groupId}&showCustomQuestion=true`)
    } else if (notification.entryId) {
      // Navigate to entry detail - get all entries for the group to build navigation list
      const { data: entries } = await supabase
        .from("entries")
        .select("id")
        .eq("group_id", notification.groupId)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50)
      
      const entryIdList = entries?.map((e) => e.id) || []
      const entryIndex = entryIdList.indexOf(notification.entryId)
      
      router.push({
        pathname: "/(main)/modals/entry-detail",
        params: {
          entryId: notification.entryId,
          entryIds: JSON.stringify(entryIdList),
          index: entryIndex >= 0 ? String(entryIndex) : undefined,
          returnTo: "/(main)/home",
        },
      })
    }

    // Refetch notifications after handling to update badge
    queryClient.invalidateQueries({ queryKey: ["inAppNotifications", userId] })
    // Update badge count after handling notification
    if (userId) {
      await updateBadgeCount(userId)
    }
  }

  async function handleNotificationBellPress() {
    // Show modal immediately for better UX
    setNotificationModalVisible(true)
    
    // Do NOT mark notifications as checked when opening modal
    // Notifications should persist until individually actioned
    // Only refetch to update badge count
    queryClient.invalidateQueries({ queryKey: ["inAppNotifications", userId] })
    // Update badge count
    if (userId) {
      updateBadgeCount(userId).catch((error) => {
        if (__DEV__) console.error("[home] Failed to update badge count:", error)
      })
    }
  }

  async function handleClearAllNotifications() {
    if (!userId) return
    
    try {
      console.log("[home] Clearing all notifications...")
      // Clear all notifications (marks everything as visited/checked)
      await clearAllNotifications(userId)
      console.log("[home] All notifications cleared")
      
      // Invalidate the query cache first to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["inAppNotifications", userId] })
      
      // Remove the cached data to force a fresh fetch
      queryClient.removeQueries({ queryKey: ["inAppNotifications", userId] })
      
      // Small delay to ensure AsyncStorage writes are complete
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Refetch using the refetch function from useQuery (more reliable than queryClient.refetchQueries)
      const { data: newNotifications } = await refetchNotifications()
      console.log("[home] Notifications refetched, new count:", newNotifications?.length ?? 0)
      
      // If there are still notifications, log for debugging
      if (newNotifications && newNotifications.length > 0) {
        console.warn("[home] ⚠️ Still showing notifications after clear:", newNotifications.map(n => ({ type: n.type, id: n.id })))
      }
      
      // Update badge count
      await updateBadgeCount(userId)
      console.log("[home] Badge count updated")
      
      // Close the modal after a brief delay to allow UI to update
      setTimeout(() => {
        setNotificationModalVisible(false)
      }, 200)
    } catch (error) {
      console.error("[home] Failed to clear all notifications:", error)
      // Close modal even on error
      setNotificationModalVisible(false)
    }
  }

  function handleAnswerPrompt(useToday = false) {
    const effectivePromptId = useToday ? todayPromptId : promptId
    const effectiveDate = useToday ? todayDate : selectedDate
    
    if (!effectivePromptId || !currentGroupId) {
      Alert.alert("No prompt available", "Please check back shortly — today's prompt is still loading.")
      return
    }
    
    // Track opened_daily_question event
    safeCapture(posthog, "opened_daily_question")
    
    router.push({
      pathname: "/(main)/modals/entry-composer",
      params: {
        promptId: effectivePromptId,
        date: effectiveDate,
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
      
      // CRITICAL: Immediately clear allEntriesHistory data BEFORE switching groups
      queryClient.setQueryData(["allEntriesHistory", oldGroupId], [])
      queryClient.setQueryData(["allEntriesHistory", groupId], [])
      
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
        queryClient.removeQueries({ 
          queryKey: ["upcomingBirthdayCards", oldGroupId],
          exact: false 
        })
        queryClient.removeQueries({ 
          queryKey: ["myBirthdayCard", oldGroupId],
          exact: false 
        })
        queryClient.removeQueries({ 
          queryKey: ["myCardEntries", oldGroupId],
          exact: false 
        })
        // CRITICAL: Remove allEntriesHistory for old group
        queryClient.removeQueries({ 
          queryKey: ["allEntriesHistory", oldGroupId],
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
      queryClient.removeQueries({ 
        queryKey: ["upcomingBirthdayCards", groupId],
        exact: false 
      })
      queryClient.removeQueries({ 
        queryKey: ["myBirthdayCard", groupId],
        exact: false 
      })
      queryClient.removeQueries({ 
        queryKey: ["myCardEntries", groupId],
        exact: false 
      })
      // CRITICAL: Remove allEntriesHistory for new group to force fresh fetch
      queryClient.removeQueries({ 
        queryKey: ["allEntriesHistory", groupId],
        exact: false 
      })
      
      // Force immediate refetch
      queryClient.refetchQueries({ 
        queryKey: ["dailyPrompt", groupId],
        exact: false 
      })
      // CRITICAL: Force immediate refetch of allEntriesHistory
      queryClient.refetchQueries({ 
        queryKey: ["allEntriesHistory", groupId],
        exact: false 
      })
      queryClient.invalidateQueries({ 
        queryKey: ["upcomingBirthdayCards", groupId],
        exact: false 
      })
      queryClient.invalidateQueries({ 
        queryKey: ["myBirthdayCard", groupId],
        exact: false 
      })
      queryClient.invalidateQueries({ 
        queryKey: ["myCardEntries", groupId],
        exact: false 
      })
      // CRITICAL: Invalidate allEntriesHistory for new group
      queryClient.invalidateQueries({ 
        queryKey: ["allEntriesHistory", groupId],
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

  // Calculate if prompt card should be shown at top
  // Always check today's question, regardless of selectedDate
  // History screen doesn't show prompt card
  const showPromptCardAtTop = false

  // Get today's entries excluding current user (to see who has answered)
  const todayEntriesExcludingUser = useMemo(() => {
    if (!todayEntries || !userId) return []
    return todayEntries.filter((entry) => entry.user_id !== userId)
  }, [todayEntries, userId])

  // Get names of people who have answered today's question
  const todayAnswererNames = useMemo(() => {
    if (!todayEntriesExcludingUser || todayEntriesExcludingUser.length === 0) return []
    
    // Get unique user names from entries
    const nameMap = new Map<string, string>()
    for (const entry of todayEntriesExcludingUser) {
      if (entry.user?.name && !nameMap.has(entry.user_id)) {
        nameMap.set(entry.user_id, entry.user.name)
      }
    }
    
    return Array.from(nameMap.values())
  }, [todayEntriesExcludingUser])

  // Format answerer names text
  const answererNamesText = useMemo(() => {
    if (todayAnswererNames.length === 0) return null
    
    if (todayAnswererNames.length === 1) {
      return `${todayAnswererNames[0]} has answered today's question`
    } else if (todayAnswererNames.length === 2) {
      return `${todayAnswererNames[0]} and ${todayAnswererNames[1]} have answered today's question`
    } else {
      const allButLast = todayAnswererNames.slice(0, -1).join(", ")
      const last = todayAnswererNames[todayAnswererNames.length - 1]
      return `${allButLast}, and ${last} have answered today's question`
    }
  }, [todayAnswererNames])

  // Check if today's prompt is a Remembering category question
  const isRememberingCategory = useMemo(() => {
    const category = todayDailyPrompt?.prompt?.category || todayEntries[0]?.prompt?.category
    return category === "Remembering"
  }, [todayDailyPrompt?.prompt?.category, todayEntries[0]?.prompt?.category])

  // Calculate full header height including all elements
  // Calculate header height for simplified History header
  // Header structure:
  // - insets.top + spacing.md (paddingTop from View inline style)
  // - spacing.sm (paddingTop from styles.header)
  // - 32px (title fontSize)
  // - spacing.md (title marginBottom)
  // - spacing.lg (header paddingBottom)
  // Note: Filter pills are in headerRight, aligned with title, so they don't add height
  const headerHeight = useMemo(() => {
    return insets.top + spacing.md + spacing.sm + 32 + spacing.md + spacing.lg
  }, [insets.top])

  // Calculate padding - content starts a fixed distance below header
  // Simple calculation for History screen (no divider)
  const contentPaddingValue = useMemo(() => {
    return headerHeight
  }, [headerHeight])

  // CRITICAL: Initialize padding synchronously on mount and whenever headerHeight changes
  // This ensures content never renders without proper padding
  useEffect(() => {
    // Set padding immediately (synchronously) to prevent content cropping
    contentPaddingTop.setValue(contentPaddingValue)
  }, [contentPaddingValue, contentPaddingTop])

  // Reset scroll position and header when selectedDate changes (e.g., clicking CTA to view previous day)
  useEffect(() => {
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
        toValue: contentPaddingValue,
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
  }, [selectedDate, contentPaddingValue, scrollY])

  // Register scroll to top callback with tab bar context
  const { setScrollToTopCallback } = useTabBar()
  
  // Use a ref to ensure callback always has latest scrollViewRef
  const scrollToTopCallbackRef = useRef<(() => void) | null>(null)
  
  useEffect(() => {
    // Update callback ref whenever scrollViewRef might change
    scrollToTopCallbackRef.current = () => {
      console.log("[home] scrollToTop callback called")
      const scrollView = scrollViewRef.current
      if (scrollView) {
        console.log("[home] scrollViewRef.current exists, scrolling...")
        scrollView.scrollTo({ y: 0, animated: true })
      } else {
        console.log("[home] scrollViewRef.current is null!")
      }
    }
    
    // Register the callback
    setScrollToTopCallback(() => {
      // Always call the latest callback from ref
      if (scrollToTopCallbackRef.current) {
        scrollToTopCallbackRef.current()
      }
    })
    
    return () => {
      scrollToTopCallbackRef.current = null
      setScrollToTopCallback(() => {}) // Clear callback on unmount
    }
  }, [setScrollToTopCallback])

  // Refetch entry-related queries when screen comes into focus to ensure fresh data
  // This is especially important after posting an entry
  useFocusEffect(
    useCallback(() => {
      // Refetch entry-related queries when screen comes into focus to ensure fresh data
      // This is especially important after posting an entry
      if (currentGroupId && userId) {
        const todayDate = getTodayDate()
        // CRITICAL: Refetch using the exact query keys that the useQuery hooks use
        // The entries query uses selectedDate (line 1179), and dailyPrompt uses selectedDate + userId (line 924)
        // Since selectedDate defaults to todayDate, we refetch both todayDate and selectedDate to be safe
        queryClient.refetchQueries({ queryKey: ["entries", currentGroupId, selectedDate] })
        queryClient.refetchQueries({ queryKey: ["entries", currentGroupId, todayDate] })
        queryClient.refetchQueries({ queryKey: ["userEntry", currentGroupId, userId, todayDate] })
        queryClient.refetchQueries({ queryKey: ["dailyPrompt", currentGroupId, selectedDate, userId] })
        queryClient.refetchQueries({ queryKey: ["dailyPrompt", currentGroupId, todayDate, userId] })
        // CRITICAL: Refetch allEntriesHistory for current group only
        queryClient.refetchQueries({ queryKey: ["allEntriesHistory", currentGroupId], exact: true })
        // Also refetch general entry queries
        queryClient.refetchQueries({ queryKey: ["entries", currentGroupId], exact: false })
        queryClient.refetchQueries({ queryKey: ["userEntry", currentGroupId], exact: false })
      }
    }, [currentGroupId, userId, selectedDate, queryClient])
  )

  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: false,
    listener: (event: any) => {
      const currentScrollY = event.nativeEvent.contentOffset.y
      const currentTime = Date.now()
      const scrollDiff = currentScrollY - lastScrollY.current
      const timeDiff = currentTime - lastScrollTime.current
      
      // Update refs for scroll tracking
      lastScrollY.current = currentScrollY
      lastScrollTime.current = currentTime

      // Tab bar fade/hide on scroll and "Back to top" button visibility
      const SCROLL_THRESHOLD = 600 // Show "Back to top" after scrolling 600px from top
      
      if (scrollDiff > 5 && currentScrollY > 50) {
        // Scrolling down - fade out tab bar
        Animated.timing(tabBarOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start()
        
        // Show "Back to top" button after scrolling past threshold
        if (currentScrollY > SCROLL_THRESHOLD && !showBackToTop) {
          console.log("[home] Setting showBackToTop to true, currentScrollY:", currentScrollY)
          setShowBackToTop(true)
        }
      } else if (scrollDiff < -5) {
        // Scrolling up - fade in tab bar
        Animated.timing(tabBarOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start()
        
        // Hide "Back to top" button when scrolling up
        if (showBackToTop && currentScrollY <= SCROLL_THRESHOLD) {
          setShowBackToTop(false)
        }
      } else if (currentScrollY <= 0) {
        // At the top - ensure tab bar is visible and hide "Back to top"
        Animated.timing(tabBarOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start()
        
        if (showBackToTop) {
          setShowBackToTop(false)
        }
      }

      // Infinite scroll detection for Days view
      if (viewMode === "Days" && hasMoreEntries && !isLoadingMoreEntries) {
        const { contentSize, layoutMeasurement } = event.nativeEvent
        const distanceFromBottom = contentSize.height - currentScrollY - layoutMeasurement.height
        
        // Start loading when user is 500px from bottom (gives time to load before reaching bottom)
        // This ensures smooth scrolling without visible loading delays
        if (distanceFromBottom < 500) {
          loadNextBatch()
        }
      }
    },
  })

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
        cream: "#000000", // Black (was cream) - for EntryCard backgrounds
        white: "#E8E0D5", // Beige (was white)
        text: "#F5F0EA", // Cream (was black) - text color
        textSecondary: "#A0A0A0", // Light gray (was dark gray)
        onboardingPink: "#D97393", // Pink for onboarding CTAs - unchanged
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
        onboardingPink: "#D97393", // Pink for onboarding CTAs
      }
    }
  }, [isDark])

  // Create dynamic styles based on theme
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme2Colors.beige,
      overflow: "visible", // Allow absolutely positioned children to receive touches
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
      overflow: "visible", // Allow dropdown to overflow header bounds
    },
    headerLeft: {
      flex: 1,
    },
    headerRight: {
      justifyContent: "flex-end",
      alignItems: "center", // Center align vertically with title
    },
    title: {
      fontFamily: "PMGothicLudington-Text115",
      fontSize: 32,
      color: theme2Colors.text,
      marginTop: spacing.sm, // More padding above title
      marginBottom: spacing.md, // More padding below title
    },
    filterButtonsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      justifyContent: "flex-end", // Align to right
    },
    filterPillButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: 20, // Rounded pill shape
      backgroundColor: theme2Colors.cream,
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
      marginLeft: spacing.xs,
      minHeight: 36, // Ensure consistent height for both pills
      height: 36, // Fixed height to match
    },
    filterPillText: {
      ...typography.bodyMedium,
      fontSize: 14,
      color: theme2Colors.text,
      marginRight: spacing.xs / 2,
    },
    avatarButton: {
      marginLeft: spacing.sm,
    },
    groupSelector: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    groupName: {
      ...typography.h2,
      fontSize: 22,
      color: theme2Colors.text,
      fontFamily: "PMGothicLudington-Text115",
    },
    chevron: {
      ...typography.body,
      fontSize: 12,
      color: theme2Colors.text,
    },
    membersScroll: {
      marginBottom: spacing.md,
      paddingVertical: 3, // Add vertical padding to prevent cropping from top/bottom
      paddingLeft: 3, // Add left padding to prevent cropping from left side
      paddingRight: spacing.sm, // Add right padding for last item
    },
    memberAvatar: {
      marginRight: -4, // Slight overlap
    },
    addMemberButton: {
      marginRight: spacing.sm,
    },
    addMemberCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme2Colors.cream,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: isDark ? theme2Colors.textSecondary : theme2Colors.yellow, // Gray in dark mode, yellow in light mode
    },
    addMemberText: {
      ...typography.h2,
      fontSize: 20,
      color: theme2Colors.text,
    },
    dayScrollerContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: spacing.xs,
      marginBottom: spacing.xs,
      overflow: "visible", // Allow dropdown to overflow bounds
    },
    dayScrollerContent: {
      flex: 1, // Take available space, leaving room for fixed buttons
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: spacing.xs,
    },
    dayNavigationDivider: {
      width: "60%", // Small divider, not spanning full screen
      height: 1,
      backgroundColor: isDark ? "#E8E0D5" : theme2Colors.blue, // Beige in dark mode, blue in light mode
      alignSelf: "center",
      marginTop: spacing.lg, // Padding above divider
      marginBottom: spacing.lg, // Equal padding below divider to match spacing above
    },
    dayButton: {
      flex: 1, // Make buttons fill available space evenly
      paddingVertical: spacing.xs / 2, // Reduced vertical padding for more rectangular shape
      paddingHorizontal: spacing.xs, // Horizontal padding
      marginRight: spacing.xs, // Match spacing between period filter and filter card
      alignItems: "center",
      justifyContent: "center",
      height: 36, // Reduced height for more rectangular shape
      backgroundColor: isDark ? "#000000" : theme2Colors.white, // Black fill in dark mode, white in light mode
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDark ? "#F5F0EA" : theme2Colors.text, // Cream outline in dark mode, black in light mode
    },
    dayButtonSelected: {
      borderWidth: 2,
      borderRadius: 8,
      borderColor: isDark ? "#F5F0EA" : theme2Colors.blue, // Cream outline in dark mode, blue in light mode
      backgroundColor: isDark ? "#F5F0EA" : theme2Colors.yellow, // Cream background in dark mode, yellow in light mode
    },
    dayButtonFuture: {
      opacity: 0.5,
    },
    dayText: {
      ...typography.caption,
      fontSize: 12,
      marginBottom: 0, // No spacing - check/dot should be very close to text
      color: theme2Colors.text,
    },
    dayTextSelected: {
      color: isDark ? "#000000" : theme2Colors.text, // Black text in dark mode when selected, normal text in light mode
    },
    dayTextFuture: {
      color: theme2Colors.textSecondary,
    },
    dayNum: {
      ...typography.bodyBold,
      fontSize: 16,
      color: theme2Colors.text,
    },
    dayNumSelected: {
      color: isDark ? "#000000" : theme2Colors.text, // Black text in dark mode when selected, normal text in light mode
    },
    dayNumFuture: {
      color: theme2Colors.textSecondary,
    },
    dayIndicator: {
      alignItems: "center",
      justifyContent: "center",
      marginTop: 0, // No margin - already reduced spacing in dayText
      paddingBottom: spacing.xs, // Add padding to prevent check/dot from touching bottom border
    },
    dayDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: isDark ? theme2Colors.text : "#E8E0D5", // Cream in dark mode, beige in light mode for unselected days
    },
    dayDotSelected: {
      backgroundColor: isDark ? "#000000" : theme2Colors.blue, // Black dot in dark mode when selected, blue in light mode
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
      marginBottom: spacing.xl, // Add padding below future question card
      width: "100%",
      alignItems: "center", // Center align content
    },
    // Removed futureCardFuzzyOverlay and futureCardFuzzyImage styles - no longer needed
    promptCard: {
      backgroundColor: theme2Colors.cream,
      padding: spacing.lg,
      borderRadius: 20, // More rounded edges
      borderWidth: 2,
      borderColor: theme2Colors.textSecondary, // Gray outline
      marginTop: spacing.md,
      marginHorizontal: spacing.lg, // Consistent width matching EntryCard and dateHeader
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 8, // Android shadow
      overflow: "hidden", // Ensure texture overlay stays within card bounds
      position: "relative", // For absolute positioning of texture
      width: SCREEN_WIDTH - (spacing.lg * 2), // Fixed width to match EntryCard
    },
    promptCardRemembering: {
      backgroundColor: "#1A1A1C", // Dark background for Remembering category
      borderColor: theme2Colors.white, // White outline for Remembering category
    },
    promptCardToday: {
      backgroundColor: isDark ? "#010514" : "#E8A037", // Dark blue-black in dark mode, yellow in light mode
      padding: spacing.lg,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: theme2Colors.blue, // Blue outline for today's card
      marginHorizontal: spacing.lg, // Match dateHeader and EntryCard margins
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 8,
      overflow: "hidden",
      position: "relative",
    },
    promptCardTodayRemembering: {
      backgroundColor: "#1A1A1C", // Dark background for Remembering category
      borderColor: theme2Colors.white, // White outline for Remembering category
    },
    promptCardTexture: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.4, // Adjust opacity to taste
      zIndex: 999, // Very high z-index to ensure it's on top of everything
      pointerEvents: "none", // Allow touches to pass through to TouchableOpacity
      borderRadius: 20, // Match card border radius exactly
      overflow: "hidden", // Ensure texture stays within bounds
    },
    birthdayCardEntryTexture: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.4, // Adjust opacity to taste
      zIndex: 999, // Very high z-index to ensure it's on top of everything
      pointerEvents: "none", // Allow touches to pass through to TouchableOpacity
      borderRadius: 20, // Match card border radius exactly
      overflow: "hidden", // Ensure texture stays within bounds
    },
    promptCardContent: {
      position: "relative",
      zIndex: 1, // Below texture overlay
    },
    promptQuestion: {
      ...typography.h3,
      fontSize: 22,
      marginBottom: spacing.sm,
      color: theme2Colors.text, // Keep white/cream in dark mode
      fontFamily: "PMGothicLudington-Text115",
      width: "100%", // Take full width of card to ensure consistent wrapping
    },
    promptQuestionRemembering: {
      color: theme2Colors.white, // White text for Remembering category
    },
    promptDescription: {
      ...typography.body,
      fontSize: 14,
      color: isDark ? theme2Colors.white : theme2Colors.textSecondary, // White in dark mode for card condition 1
      marginBottom: spacing.md,
    },
    promptDescriptionRemembering: {
      color: theme2Colors.white, // White text for Remembering category
    },
  customQuestionBanner: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme2Colors.blue, // Blue line instead of yellow
  },
  customQuestionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  customQuestionLabel: {
    ...typography.bodyMedium,
    fontSize: 14,
    color: theme2Colors.text, // Black font instead of textSecondary
    marginLeft: spacing.sm,
  },
  customQuestionIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  customQuestionIndicatorText: {
    ...typography.body,
    fontSize: 13,
    color: isDark ? theme2Colors.white : theme2Colors.textSecondary,
  },
  loadingContainer: {
      padding: spacing.lg,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 100,
    },
    loadingText: {
      ...typography.body,
      color: theme2Colors.textSecondary,
    },
    answerButton: {
      marginTop: spacing.md,
      backgroundColor: theme2Colors.blue,
      borderRadius: 25, // Rounded pill shape
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
    },
    answerButtonToday: {
      marginTop: spacing.md,
      backgroundColor: isDark ? "#D97393" : theme2Colors.cream, // Pink in dark mode, cream in light mode
      borderRadius: 25,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
    },
    lockedMessage: {
      padding: spacing.xl,
      alignItems: "center",
      gap: spacing.xs,
    },
    lockedText: {
      ...typography.body,
      textAlign: "center",
      color: theme2Colors.textSecondary,
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
      color: theme2Colors.textSecondary,
      textAlign: "center",
    },
    notice: {
      marginTop: spacing.xs, // Reduced spacing below day navigation
      marginBottom: spacing.lg, // Add space between notice and question card divider
      marginHorizontal: spacing.lg, // Match dateHeader alignment
    },
    noticeText: {
      ...typography.body,
      color: theme2Colors.text,
    },
    groupModalBackdrop: {
      flex: 1,
      backgroundColor: "transparent", // Use transparent base, opacity handled by overlays
      justifyContent: "flex-end", // Position at bottom
      alignItems: "stretch", // Full width
    },
    groupModalSheet: {
      backgroundColor: theme2Colors.beige, // #E8E0D5
      padding: spacing.lg,
      borderTopLeftRadius: 32, // Rounded corners on top only
      borderTopRightRadius: 32,
      borderBottomLeftRadius: 0, // No rounding on bottom
      borderBottomRightRadius: 0,
      gap: spacing.md,
      maxHeight: "70%",
      width: "100%",
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: -10, // Shadow above (for bottom sheet)
      },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 20,
      position: "relative",
      overflow: "visible", // Allow close button to overflow
    },
    groupModalCloseButton: {
      position: "absolute",
      top: spacing.md, // More padding from top corner
      right: spacing.md, // More padding from right corner
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? "#000000" : theme2Colors.white, // Black background in dark mode, white in light mode for X button
      justifyContent: "center",
      alignItems: "center",
      zIndex: 10,
      borderWidth: 1,
      borderColor: isDark ? "#F5F0EA" : theme2Colors.text, // Cream outline in dark mode, black outline in light mode
    },
    groupModalTitle: {
      ...typography.h2,
      color: theme2Colors.text,
      fontSize: 24,
      fontFamily: "PMGothicLudington-Text115", // Match question font
    },
    groupList: {
      gap: spacing.sm,
    },
    groupRowContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    groupRowContainerFullWidth: {
      width: "100%",
      marginBottom: spacing.sm,
    },
    groupRowFlex: {
      flex: 1,
    },
    groupRow: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderRadius: 12,
      backgroundColor: isDark ? "#000000" : theme2Colors.white, // Black in dark mode, white in light mode for non-selected groups
      flex: 1,
      borderWidth: 1,
      borderColor: isDark ? "#F5F0EA" : theme2Colors.textSecondary, // Cream outline in dark mode, gray stroke in light mode for non-selected
    },
    groupRowFullWidth: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: 12,
      backgroundColor: isDark ? "#000000" : theme2Colors.white, // Black in dark mode, white in light mode for non-selected groups
      width: "100%",
      borderWidth: 1,
      borderColor: isDark ? "#F5F0EA" : theme2Colors.textSecondary, // Cream outline in dark mode, gray stroke in light mode for non-selected
    },
    groupRowActive: {
      borderWidth: 2,
      borderColor: theme2Colors.onboardingPink, // Pink stroke for selected group
      backgroundColor: theme2Colors.cream, // Cream #F5F0EA for selected
    },
    groupRowContent: {
      flexDirection: "column",
      alignItems: "flex-start",
      justifyContent: "flex-start",
      flex: 1,
      gap: spacing.xs,
      minWidth: 0, // Allow content to shrink
    },
    groupAvatarsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    groupRowTextContainer: {
      flex: 1,
      minWidth: 0, // Allow content to shrink
    },
    groupNameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    groupRowText: {
      ...typography.bodyBold,
      color: theme2Colors.text,
      fontSize: 18,
    },
    groupAvatarSmall: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 0, // Remove border outline
      overflow: "hidden",
      backgroundColor: theme2Colors.beige,
    },
    groupAvatarSmallActive: {
      // No border for active state either
    },
    groupAvatarMore: {
      backgroundColor: theme2Colors.yellow,
      justifyContent: "center",
      alignItems: "center",
    },
    groupAvatarMoreText: {
      ...typography.caption,
      fontSize: 10,
      color: theme2Colors.text,
      fontWeight: "600",
    },
    groupSettingsButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme2Colors.white, // White fill
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme2Colors.text, // Black stroke
    },
    groupActionButtons: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.md,
      width: "100%",
    },
    groupActionButton: {
      flex: 1,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: 25, // Round buttons
      backgroundColor: theme2Colors.white, // Solid white
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary, // Light gray outline
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 3, // Android shadow
    },
    groupActionButtonSmall: {
      flex: 0, // Don't flex, use fixed width
      minWidth: 100, // Smaller fixed width for Settings
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: 25, // Round buttons
      backgroundColor: theme2Colors.white, // Solid white
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary, // Light gray outline
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 3, // Android shadow
    },
    groupActionButtonText: {
      ...typography.body,
      fontSize: 14,
      fontWeight: "600", // Increased font weight
      color: isDark ? "#000000" : theme2Colors.text, // Black text in dark mode (button is white)
    },
    unseenDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme2Colors.yellow,
    },
    newAnswersText: {
      ...typography.body,
      color: theme2Colors.textSecondary,
      fontSize: 14,
    },
    createGroupButton: {
      width: "100%",
      backgroundColor: theme2Colors.onboardingPink, // Pink matching onboarding CTAs
      borderRadius: 25,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderWidth: 2,
      borderColor: theme2Colors.textSecondary, // Gray border matching profile modal CTA
      position: "relative", // For absolute positioning of texture
      overflow: "hidden", // Ensure texture stays within bounds
    },
    createGroupButtonTexture: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.4, // Adjust opacity to taste
      zIndex: 1, // Above button background but below text
      pointerEvents: "none", // Allow touches to pass through
      borderRadius: 25, // Match button border radius
    },
    createGroupText: {
      color: theme2Colors.white,
      fontSize: 16,
      fontWeight: "600",
      textAlign: "center", // Center the text
      position: "relative",
      zIndex: 2, // Above texture overlay
    },
    voteBannerWrapper: {
      marginBottom: spacing.md, // Reduced padding below banner (50% of xl)
      zIndex: 10, // Ensure banner renders above entries
      elevation: 10, // Android elevation
    },
    voteBanner: {
      backgroundColor: theme2Colors.cream,
      paddingRight: spacing.md,
      paddingLeft: spacing.md, // Add left padding
      paddingVertical: spacing.sm, // Reduced vertical padding (50% of md)
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme2Colors.yellow,
      marginHorizontal: spacing.lg,
      marginTop: 0, // Reduced spacing below day navigation
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
      color: theme2Colors.textSecondary,
      opacity: 0.9,
      marginBottom: spacing.xs,
    },
    voteBannerText: {
      ...typography.bodyBold,
      fontSize: 16,
      color: theme2Colors.text,
    },
    voteBannerChevron: {
      marginLeft: spacing.md,
      alignSelf: "center", // Center chevron vertically
    },
    refreshIndicator: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: spacing.xs, // Minimal padding above indicator
      paddingBottom: spacing.lg,
      marginBottom: spacing.sm,
      minHeight: 60,
      width: "100%",
    },
    previousDayCTALink: {
      ...typography.body,
      color: theme2Colors.text,
      fontSize: 14,
      textAlign: "center",
      textDecorationLine: "underline",
      marginTop: spacing.sm,
      marginBottom: spacing.lg + spacing.md,
      marginHorizontal: spacing.lg,
    },
    appTutorialLinkContainer: {
      paddingVertical: spacing.md, // Reduced padding
      paddingHorizontal: spacing.lg,
      alignItems: "center",
      marginTop: spacing.md, // Reduced spacing between app tour and "Be the first to answer"
    },
    appTutorialCard: {
      backgroundColor: theme2Colors.cream,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: theme2Colors.textSecondary,
      width: "100%",
      alignItems: "center",
      position: "relative",
      overflow: "hidden",
    },
    appTutorialLink: {
      ...typography.body,
      color: theme2Colors.textSecondary,
      fontSize: 14,
      textAlign: "center",
      zIndex: 2,
      position: "relative",
    },
    appTutorialCardTexture: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.4,
      zIndex: 1,
      pointerEvents: "none",
      borderRadius: 20,
      overflow: "hidden",
    },
    appTutorialCardTextureImage: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: "100%",
      height: "100%",
    },
    filterButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.xs / 2,
      paddingHorizontal: spacing.md,
      borderRadius: 8,
      backgroundColor: theme2Colors.cream,
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
      marginRight: spacing.xs,
      height: 36, // Match dayButton height
      minWidth: 80,
    },
    filterButtonWrapper: {
      position: "relative",
      zIndex: 10000, // Ensure dropdown appears above everything
      elevation: 10000, // Android
      overflow: "visible", // Allow dropdown to overflow wrapper bounds
      marginLeft: spacing.xs, // Minimal spacing from day buttons
    },
    filterText: {
      ...typography.bodyMedium,
      color: theme2Colors.text,
    },
    filterChevron: {
      ...typography.caption,
      color: theme2Colors.textSecondary,
    },
    filterCTA: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.xs / 2,
      paddingHorizontal: spacing.md,
      borderRadius: 8,
      backgroundColor: theme2Colors.cream,
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
      height: 36, // Match dayButton height
      width: 36, // Square button
      marginLeft: spacing.xs,
    },
    filterMenu: {
      position: "absolute",
      top: "100%",
      right: 0,
      backgroundColor: theme2Colors.cream,
      borderRadius: 12,
      paddingVertical: spacing.xs,
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
      width: 140,
      zIndex: 10001, // Above wrapper and everything else
      elevation: 10001, // Android
      marginTop: spacing.xs,
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
    filterOption: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    filterOptionText: {
      ...typography.body,
      color: theme2Colors.textSecondary,
    },
    filterOptionTextActive: {
      color: theme2Colors.text,
      fontWeight: "600",
    },
    dateHeaderContainer: {
      marginBottom: spacing.xl,
      marginHorizontal: spacing.lg,
    },
    dateHeaderContainerPreviousDay: {
      marginBottom: spacing.sm, // Reduced padding for previous days
      marginHorizontal: spacing.lg,
    },
    dateHeader: {
      ...typography.h2,
      fontSize: 22,
      flexDirection: "row",
      alignItems: "center", // Align text vertically
      marginBottom: spacing.xs, // Reduced from spacing.md for previous days
    },
    dateHeaderDay: {
      fontFamily: "Roboto-Regular",
      fontSize: 22,
      lineHeight: 32,
      color: theme2Colors.text,
      fontWeight: "600",
    },
    dateHeaderDate: {
      fontFamily: "Roboto-Regular",
      fontSize: 22,
      color: theme2Colors.textSecondary,
    },
    revealAnswersContainer: {
      marginTop: spacing.xs,
    },
    revealAnswersText: {
      fontFamily: "Roboto-Regular",
      fontSize: 14,
      color: theme2Colors.textSecondary, // Changed to secondary text color (no pink/hyperlink)
      lineHeight: 20,
    },
    // REMOVED: revealAnswersLink style - no longer using pink/hyperlink
    daySection: {
      marginBottom: spacing.xl,
    },
    periodBanner: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginHorizontal: spacing.md,
      marginTop: 0, // Reduced spacing from divider
      marginBottom: spacing.lg, // Increased padding below filter banners
      backgroundColor: theme2Colors.cream,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme2Colors.textSecondary,
    },
    periodBannerTitle: {
      ...typography.bodyBold,
      color: theme2Colors.text,
    },
    periodBannerSubtitle: {
      ...typography.caption,
      color: theme2Colors.textSecondary,
    },
    periodBannerAction: {
      padding: spacing.xs,
    },
    periodBannerClear: {
      ...typography.bodyMedium,
      color: theme2Colors.blue,
    },
    periodGrid: {
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    periodCard: {
      overflow: "hidden",
      borderRadius: 20,
      borderWidth: 2,
      borderColor: theme2Colors.textSecondary,
      backgroundColor: theme2Colors.cream,
      marginBottom: spacing.md,
    },
    periodBackground: {
      height: 220,
      overflow: "hidden",
      justifyContent: "flex-end",
      borderRadius: 18, // Slightly smaller than card to account for border
    },
    periodImage: {
      borderRadius: 18, // Match periodBackground
    },
    periodFallback: {
      backgroundColor: theme2Colors.cream,
    },
    periodShade: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDark ? "rgba(0, 0, 0, 0.3)" : "rgba(232, 224, 213, 0.3)", // Light overlay (dark in dark mode, beige in light mode)
    },
    periodOverlay: {
      padding: spacing.xxl,
      gap: spacing.sm,
    },
    periodTitle: {
      ...typography.bodyBold,
      fontSize: 24,
      color: theme2Colors.white,
    },
    periodSubtitle: {
      ...typography.caption,
      fontSize: 16,
      color: theme2Colors.white,
    },
    periodCount: {
      ...typography.caption,
      fontSize: 14,
      color: theme2Colors.white,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: theme2Colors.beige,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    modalTitle: {
      ...typography.h1,
      fontSize: 32,
      color: theme2Colors.text,
      fontFamily: "PMGothicLudington-Text115",
    },
    modalCloseButton: {
      padding: spacing.sm,
    },
    modalClose: {
      ...typography.bodyBold,
      fontSize: 24,
      color: theme2Colors.text,
    },
    modalContent: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl * 2,
    },
    modalSection: {
      ...typography.bodyMedium,
      fontSize: 14,
      color: theme2Colors.textSecondary,
      marginTop: spacing.sm,
    },
    modalSectionSpacing: {
      marginTop: spacing.lg,
    },
    filterCTAContainer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg + insets.bottom,
      paddingTop: spacing.md,
      backgroundColor: theme2Colors.beige,
      borderTopWidth: 1,
      borderTopColor: theme2Colors.textSecondary,
    },
    filterSeeAnswersButton: {
      backgroundColor: theme2Colors.blue,
      borderRadius: 25,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
    },
    filterSeeAnswersText: {
      ...typography.bodyBold,
      fontSize: 16,
      color: theme2Colors.white,
    },
    selectionGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    selectionCard: {
      width: "48%",
      backgroundColor: theme2Colors.cream,
      borderRadius: 16,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      alignItems: "center",
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
    },
    selectionCardActive: {
      borderWidth: 2,
      borderColor: theme2Colors.blue,
    },
    selectionLabel: {
      ...typography.bodyMedium,
      color: theme2Colors.text,
      textAlign: "center",
    },
    memorialList: {
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    memorialRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: theme2Colors.cream,
      borderRadius: 16,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      width: "100%",
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
    },
    memorialRowActive: {
      borderWidth: 2,
      borderColor: theme2Colors.blue,
    },
    memorialName: {
      ...typography.bodyMedium,
      color: theme2Colors.text,
      fontSize: 16,
    },
    birthdayCardEntry: {
      backgroundColor: theme2Colors.cream,
      borderRadius: 20,
      padding: spacing.lg,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 2,
      borderColor: theme2Colors.green,
      minHeight: 200,
      position: "relative",
      overflow: "hidden",
    },
    birthdayCardEntryShapes: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    birthdayCardEntryQuarterCircle: {
      width: 40,
      height: 40,
      borderTopLeftRadius: 40,
      backgroundColor: theme2Colors.yellow,
    },
    birthdayCardEntryFullCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme2Colors.red,
    },
    birthdayCardEntryHalfCircle: {
      width: 40,
      height: 20,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      backgroundColor: theme2Colors.blue,
    },
    birthdayCardEntryContent: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      marginTop: spacing.md,
    },
    birthdayCardEntryTitle: {
      ...typography.h2,
      fontSize: 24,
      color: theme2Colors.text,
      fontFamily: "PMGothicLudington-Text115",
      marginBottom: spacing.xs,
      textAlign: "center",
    },
    birthdayCardEntrySubtitle: {
      ...typography.body,
      fontSize: 14,
      color: theme2Colors.textSecondary,
      textAlign: "center",
      marginBottom: spacing.lg,
    },
    birthdayCardEntryButton: {
      backgroundColor: theme2Colors.green,
      borderRadius: 25,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 120,
    },
    birthdayCardEntryButtonText: {
      ...typography.bodyBold,
      fontSize: 16,
      color: theme2Colors.white,
    },
    loadingOverlay: {
      flex: 1,
      width: "100%",
      height: "100%",
      backgroundColor: "transparent", // Transparent so home content shows through
    },
    loadingOverlayImage: {
      width: "100%",
      height: "100%",
      opacity: 0.6, // Add opacity to fuzzy.png so content behind is visible
    },
    loadingOverlayMask: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDark ? "rgba(0, 0, 0, 0.4)" : "rgba(232, 224, 213, 0.4)", // Reduced opacity since fuzzy.png now has opacity too
    },
    loadingSpinnerContainer: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000, // Above fuzzy overlay
    },
    loadingSpinner: {
      width: 80,
      height: 80,
    },
    backToTopButton: {
      position: "absolute",
      bottom: spacing.xs + insets.bottom, // Original position - tab bar is hidden when this shows
      right: spacing.md, // Right align instead of center
      zIndex: 99999, // Very high z-index to ensure it's above tab bar and everything else
      elevation: 99999, // Android elevation - must be higher than tab bar
    },
    backToTopButtonInner: {
      backgroundColor: theme2Colors.white,
      width: 48, // Fixed width for circle
      height: 48, // Fixed height for circle
      borderRadius: 24, // Perfect circle (half of width/height)
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 99999, // Match parent elevation
      zIndex: 99999, // Ensure TouchableOpacity itself is above everything
    },
  }), [theme2Colors, isDark, insets.bottom])

  return (
    <View style={styles.container}>
      {/* Loading Overlay Modal - shows during group switches and initial load */}
      {/* Uses Modal to ensure it covers tab bar and all content */}
      <Modal
        visible={showLoadingOverlay}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
      >
        <View style={styles.loadingOverlay}>
          <ImageBackground
            source={require("../../assets/images/fuzzy.png")}
            style={styles.loadingOverlayImage}
            resizeMode="cover"
          >
            {/* Semi-transparent overlay on top of fuzzy.png */}
            <View style={styles.loadingOverlayMask} />
            {/* Rotating loading spinner on top */}
            <View style={styles.loadingSpinnerContainer}>
              <Animated.Image
                source={require("../../assets/images/1.png")}
                style={[
                  styles.loadingSpinner,
                  {
                    transform: [{ rotate: loadingSpin }],
                  },
                ]}
                resizeMode="contain"
              />
            </View>
          </ImageBackground>
        </View>
      </Modal>
      
      {/* Header - positioned absolutely like explore-decks.tsx */}
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
          <Text style={styles.title}>History</Text>
        </View>
        <View style={styles.headerRight}>
          {/* Filter buttons row - side by side, center-aligned with title */}
          <View style={[styles.filterButtonsRow, { marginTop: spacing.sm }]}>
            {/* Days dropdown - rounded pill */}
            <View 
              style={styles.filterButtonWrapper}
              ref={filterButtonRef}
              onLayout={() => {
                filterButtonRef.current?.measureInWindow((x, y, width, height) => {
                  setFilterButtonLayout({ x, y, width, height })
                })
              }}
            >
              <TouchableOpacity 
                style={styles.filterPillButton} 
                onPress={() => {
                  // Re-measure button position when pressed to ensure accurate positioning
                  filterButtonRef.current?.measureInWindow((x, y, width, height) => {
                    setFilterButtonLayout({ x, y, width, height })
                    setShowFilter((prev) => !prev)
                  })
                }}
              >
                <Text style={styles.filterPillText}>{viewMode}</Text>
                <Text style={styles.filterChevron}>▼</Text>
              </TouchableOpacity>
            </View>
            
            {/* Filter button - rounded pill */}
            <TouchableOpacity style={styles.filterPillButton} onPress={() => setShowFilterModal(true)}>
              <FontAwesome name="sliders" size={16} color={theme2Colors.text} />
            </TouchableOpacity>
          </View>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme2Colors.text} />}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onContentSizeChange={handleContentSizeChange}
        showsVerticalScrollIndicator={false}
      >

      {/* Daily prompt card - removed for History screen */}
      {false && (
        <View style={{ 
          marginBottom: spacing.md,
          marginTop: spacing.lg, // Add spacing after divider
        }}>
          <TouchableOpacity 
            style={[
              styles.promptCardToday,
              isRememberingCategory && styles.promptCardTodayRemembering
            ]}
            onPress={() => handleAnswerPrompt(true)}
            activeOpacity={0.95}
          >
            <View style={styles.promptCardContent}>
            {isLoadingGroupData ? (
              // Show loading state during group switch
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            ) : (() => {
              // Use TODAY's data for the prompt card at top
              const hasValidPrompt = todayDailyPrompt?.prompt || todayEntries[0]?.prompt
              const hasValidQuestion = todayPersonalizedPromptQuestion || todayDailyPrompt?.prompt?.question || todayEntries[0]?.prompt?.question
              const isLoading = isLoadingTodayPrompt || isFetchingTodayPrompt || isLoadingTodayEntries || isFetchingTodayEntries
              
              // Show skeleton ONLY when actively loading and no valid prompt/question yet
              // CRITICAL: Don't show skeleton if query completed but returned null (no prompt scheduled)
              // This prevents infinite loading state when prompt doesn't exist for a date
              if (isLoading && !hasValidQuestion) {
                return <PromptSkeleton />
              }
              
              // If query completed but no valid question, check if we're still waiting for entries
              // Only show skeleton if we're still loading entries (might have prompt in entries)
              if (!hasValidQuestion && (isLoadingTodayEntries || isFetchingTodayEntries)) {
                return <PromptSkeleton />
              }
              
              // If query completed and no valid question found, don't show skeleton
              // (This means no prompt is scheduled for this date, which is valid)
              if (!hasValidQuestion) {
                // Return empty state instead of skeleton
                return null
              }
              
              // CRITICAL: If question is about the current user and no entries yet, show message
              if (isTodayQuestionAboutMe && todayEntries.length === 0) {
                // No entries yet - show message asking user to come back later
                return (
                  <View style={{ paddingVertical: spacing.xl, alignItems: "center" }}>
                    <Text style={[styles.promptQuestion, { textAlign: "center", marginBottom: spacing.md }]}>
                      Today's question is about you
                    </Text>
                    <Text style={[typography.body, { textAlign: "center", color: theme2Colors.textSecondary, paddingHorizontal: spacing.lg }]}>
                      Come back later to see what everyone said.
                    </Text>
                  </View>
                )
              }
              
              // Show actual prompt content (not about current user)
              return (
                <>
                  {/* Birthday Message - show above question text for birthday prompts */}
                  {(() => {
                    const prompt = todayDailyPrompt?.prompt || todayEntries[0]?.prompt
                    const birthdayType = (prompt as any)?.birthday_type
                    
                    if (birthdayType === "their_birthday" || birthdayType === "your_birthday") {
                      // Get members with birthdays today
                      const todayMonthDay = todayDate.substring(5) // MM-DD format
                      const birthdayMembers = members.filter((member) => {
                        // For "their_birthday", exclude current user (it's about other members)
                        if (birthdayType === "their_birthday" && member.user_id === userId) {
                          return false
                        }
                        const birthday = member.user?.birthday
                        if (!birthday) return false
                        return birthday.substring(5) === todayMonthDay
                      })
                      
                      if (birthdayType === "their_birthday" && birthdayMembers.length > 0) {
                        // Show avatars and "It's X's birthday today!"
                        const birthdayNames = birthdayMembers.map((m) => m.user?.name || "Someone").filter(Boolean)
                        const namesText = birthdayNames.length === 1 
                          ? `${birthdayNames[0]}'s`
                          : birthdayNames.length === 2
                          ? `${birthdayNames[0]} and ${birthdayNames[1]}'s`
                          : `${birthdayNames.slice(0, -1).join(", ")}, and ${birthdayNames[birthdayNames.length - 1]}'s`
                        
                        return (
                          <View style={styles.customQuestionIndicator}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                              {birthdayMembers.slice(0, 3).map((member, index) => (
                                <View key={member.user_id} style={{ marginLeft: index > 0 ? -8 : 0 }}>
                                  <Avatar
                                    uri={member.user?.avatar_url}
                                    name={member.user?.name || "User"}
                                    size={25}
                                  />
                                </View>
                              ))}
                            </View>
                            <Text style={styles.customQuestionIndicatorText}>
                              It's {namesText} birthday today!
                            </Text>
                          </View>
                        )
                      } else if (birthdayType === "your_birthday" && userId) {
                        // Check if current user has birthday today
                        const currentUser = members.find((m) => m.user_id === userId)
                        const userBirthday = currentUser?.user?.birthday
                        if (userBirthday && userBirthday.substring(5) === todayMonthDay) {
                          const userName = currentUser?.user?.name || "there"
                          return (
                            <View style={styles.customQuestionIndicator}>
                              <Text style={styles.customQuestionIndicatorText}>
                                Happy birthday, {userName}!
                              </Text>
                            </View>
                          )
                        }
                      }
                    }
                    return null
                  })()}
                  {/* Custom Question Indicator - show above question text */}
                  {todayDailyPrompt?.prompt?.is_custom && (todayDailyPrompt.prompt as any)?.customQuestion && !(todayDailyPrompt.prompt as any).customQuestion.is_anonymous && (
                    <View style={styles.customQuestionIndicator}>
                      <Avatar
                        uri={(todayDailyPrompt.prompt as any).customQuestion.user?.avatar_url}
                        name={(todayDailyPrompt.prompt as any).customQuestion.user?.name || "User"}
                        size={25}
                      />
                      <Text style={styles.customQuestionIndicatorText}>
                        {(todayDailyPrompt.prompt as any).customQuestion.user?.name || "Someone"} asked you this question
                      </Text>
                    </View>
                  )}
                  {/* Also show indicator for anonymous custom questions */}
                  {todayDailyPrompt?.prompt?.is_custom && (todayDailyPrompt.prompt as any)?.customQuestion && (todayDailyPrompt.prompt as any).customQuestion.is_anonymous && (
                    <View style={styles.customQuestionIndicator}>
                      <Text style={styles.customQuestionIndicatorText}>
                        Someone here asked this question
                      </Text>
                    </View>
                  )}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md }}>
                    {todayDailyPrompt?.prompt?.category && (
                      <CategoryTag category={todayDailyPrompt.prompt.category} />
                    )}
                    {todayEntries[0]?.prompt?.category && !todayDailyPrompt?.prompt?.category && (
                      <CategoryTag category={todayEntries[0].prompt.category} />
                    )}
                  </View>
                  <Text style={[
                    styles.promptQuestion,
                    isRememberingCategory && styles.promptQuestionRemembering
                  ]}>
                    {(() => {
                      const question = todayPersonalizedPromptQuestion || todayDailyPrompt?.prompt?.question || todayEntries[0]?.prompt?.question
                      // If question is empty or whitespace, log warning and show fallback
                      if (!question || !question.trim()) {
                        if (__DEV__) {
                          console.warn(`[home] Empty question detected. todayDailyPrompt: ${todayDailyPrompt?.prompt?.question}, todayEntries: ${todayEntries[0]?.prompt?.question}, personalized: ${todayPersonalizedPromptQuestion}`)
                        }
                        return "Question unavailable"
                      }
                      return question
                    })()}
                  </Text>
                  {/* Conditional description text */}
                  {todayAnswererNames.length === 0 ? (
                    <Text style={[
                      styles.promptDescription,
                      isRememberingCategory && styles.promptDescriptionRemembering
                    ]}>
                      Be the first to answer today's question and spark the conversation
                    </Text>
                  ) : answererNamesText ? (
                    <Text style={[
                      styles.promptDescription,
                      isRememberingCategory && styles.promptDescriptionRemembering
                    ]}>
                      {answererNamesText}
                    </Text>
                  ) : null}
                  {todayPromptId && (
                    <Button
                      title="Answer"
                      onPress={() => handleAnswerPrompt(true)}
                      style={styles.answerButtonToday}
                      textStyle={{ color: theme2Colors.text }}
                    />
                  )}
                </>
              )
            })()}
          </View>
            {/* Texture overlay - placed after content so it renders on top */}
            <View style={styles.promptCardTexture} pointerEvents="none">
              <Image
                source={require("../../assets/images/texture.png")}
                style={{ 
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  width: "100%",
                  height: "100%",
                }}
                resizeMode="stretch"
              />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Period dropdown modal - rendered outside ScrollView to avoid clipping */}
      <Modal
        visible={showFilter}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilter(false)}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={() => setShowFilter(false)}
        >
          <View style={{ flex: 1 }} />
        </TouchableOpacity>
        {filterButtonLayout && (
          <View
            style={{
              position: "absolute",
              top: filterButtonLayout.y + filterButtonLayout.height,
              left: filterButtonLayout.x, // Use left positioning for more reliable placement
              backgroundColor: theme2Colors.cream,
              borderRadius: 12,
              paddingVertical: spacing.xs,
              borderWidth: 1,
              borderColor: theme2Colors.textSecondary,
              width: 140,
              shadowColor: "#000",
              shadowOffset: {
                width: 0,
                height: 2,
              },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
              elevation: 10002,
            }}
          >
            {(["Days", "Weeks", "Months", "Years"] as ViewMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={styles.filterOption}
                onPress={() => {
                  if (mode !== "Days") {
                    setActivePeriod(null)
                  }
                  setViewMode(mode)
                  setShowFilter(false)
                }}
              >
                <Text style={[styles.filterOptionText, viewMode === mode && styles.filterOptionTextActive]}>
                  {mode}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Modal>
        {/* Refresh Indicator */}
        {showRefreshIndicator && (
          <View style={styles.refreshIndicator}>
            <ActivityIndicator size="small" color={theme2Colors.textSecondary} />
          </View>
        )}

        {/* Period Banner - show when filtering by period */}
        {activePeriod && (
          <View style={[styles.periodBanner, { marginTop: spacing.md }]}>
            <View>
              <Text style={styles.periodBannerTitle}>{activePeriod.title}</Text>
              <Text style={styles.periodBannerSubtitle}>{activePeriod.subtitle}</Text>
            </View>
            <TouchableOpacity onPress={() => setActivePeriod(null)} style={styles.periodBannerAction}>
              <Text style={styles.periodBannerClear}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Filter Banners - show when filtering */}
        {selectedMembers.length > 0 && (
          <View style={[styles.periodBanner, (!activePeriod && selectedMembers.length > 0) && { marginTop: spacing.md }]}>
            <View>
              <Text style={styles.periodBannerTitle}>
                {selectedMembers.length === 1 
                  ? members.find(m => m.user_id === selectedMembers[0])?.user?.name || "Member"
                  : `${selectedMembers.length} Members`}
              </Text>
              <Text style={styles.periodBannerSubtitle}>
                {selectedMembers.length === 1 ? "Showing entries from this member" : "Showing entries from these members"}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedMembers([])} style={styles.periodBannerAction}>
              <Text style={styles.periodBannerClear}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {selectedMemorials.length > 0 && (
          <View style={styles.periodBanner}>
            <View>
              <Text style={styles.periodBannerTitle}>
                {selectedMemorials.length === 1
                  ? memorials.find(m => m.id === selectedMemorials[0])?.name || "Memorial"
                  : `${selectedMemorials.length} Memorials`}
              </Text>
              <Text style={styles.periodBannerSubtitle}>
                {selectedMemorials.length === 1 ? "Showing entries about this memorial" : "Showing entries about these memorials"}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedMemorials([])} style={styles.periodBannerAction}>
              <Text style={styles.periodBannerClear}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {selectedCategories.length > 0 && (
          <View style={styles.periodBanner}>
            <View>
              <Text style={styles.periodBannerTitle}>
                {selectedCategories.length === 1
                  ? selectedCategories[0]
                  : `${selectedCategories.length} Categories`}
              </Text>
              <Text style={styles.periodBannerSubtitle}>
                {selectedCategories.length === 1 ? "Showing entries in this category" : "Showing entries in these categories"}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedCategories([])} style={styles.periodBannerAction}>
              <Text style={styles.periodBannerClear}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {selectedDecks.length > 0 && (
          <View style={styles.periodBanner}>
            <View>
              <Text style={styles.periodBannerTitle}>
                {selectedDecks.length === 1
                  ? availableDecks.find(d => d.deck_id === selectedDecks[0])?.deck?.name || "Deck"
                  : `${selectedDecks.length} Decks`}
              </Text>
              <Text style={styles.periodBannerSubtitle}>
                {selectedDecks.length === 1 ? "Showing entries from this deck" : "Showing entries from these decks"}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedDecks([])} style={styles.periodBannerAction}>
              <Text style={styles.periodBannerClear}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Birthday Cards Filter Banner - show when filtering by birthday cards */}
        {showBirthdayCards && (
          <View style={styles.periodBanner}>
            <View>
              <Text style={styles.periodBannerTitle}>Birthday Cards</Text>
              <Text style={styles.periodBannerSubtitle}>Showing your birthday cards</Text>
            </View>
            <TouchableOpacity onPress={() => setShowBirthdayCards(false)} style={styles.periodBannerAction}>
              <Text style={styles.periodBannerClear}>Clear</Text>
            </TouchableOpacity>
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
              // CRITICAL: Only count cards that have entries
              (myBirthdayCard && myBirthdayCard.group_id === currentGroupId && myBirthdayCard.birthday_date === selectedDate && cardEntries.length > 0) ||
              (upcomingBirthdayCards.filter((card) => card.group_id === currentGroupId).length > 0) ||
              myCardEntries.length > 0
            }
          />
        )}
        
        {/* Birthday Card Banners (only for non-future days) */}
        {/* 1. Your Card Banner (highest priority - if it's user's birthday) */}
        {/* CRITICAL: Only show banner if card exists AND has entries */}
        {myBirthdayCard && 
         myBirthdayCard.group_id === currentGroupId &&
         myBirthdayCard.birthday_date === selectedDate && 
         !isFuture &&
         cardEntries.length > 0 && (
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
                  returnTo: `/(main)/history?groupId=${currentGroupId}&date=${selectedDate}`,
                },
              })
            }}
          />
        )}

        {/* 2. Upcoming Birthday Banners (stacked vertically, non-future days only) */}
        {!isFuture && upcomingBirthdayCards
          .filter((card) => card.group_id === currentGroupId)
          .map((card) => {
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
                    returnTo: `/(main)/history?groupId=${currentGroupId}&date=${selectedDate}`,
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
                    returnTo: `/(main)/history?groupId=${currentGroupId}&date=${selectedDate}`,
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
              <FontAwesome name="chevron-right" size={16} color={theme2Colors.text} style={styles.voteBannerChevron} />
            </TouchableOpacity>
          </View>
        )}
        {/* Notice removed - now shown in prompt card at top */}
        {/* Future day empty state */}
        {!userEntry && isFuture && (
          <View style={styles.promptCardWrapper}>
            <View style={styles.promptCard}>
              <Text style={styles.promptQuestion}>
                This question isn't available for the group yet.
              </Text>
              <Text style={styles.promptDescription}>
                {(() => {
                  const selected = new Date(`${selectedDate}T00:00:00`)
                  const today = new Date(`${todayDate}T00:00:00`)
                  const diffMs = selected.getTime() - today.getTime()
                  const daysAhead = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)))
                  const unit = daysAhead === 1 ? "day" : "days"
                  return `Come back in ${daysAhead} ${unit} to answer it.`
                })()}
              </Text>
              {/* Removed fuzzy overlay for future questions */}
            </View>
          </View>
        )}


        {/* App tutorial link - show when no entries and user hasn't seen tutorial */}
        {!userEntry && entries.length === 0 && !isFuture && !hasSeenAppTutorial && viewMode === "Days" && (
          <View style={styles.appTutorialLinkContainer}>
            <TouchableOpacity 
              style={styles.appTutorialCard}
              onPress={() => setOnboardingGalleryVisible(true)} 
              activeOpacity={0.7}
            >
              <Text style={styles.appTutorialLink}>Need a quick app tour?</Text>
              {/* Texture overlay */}
              <View style={styles.appTutorialCardTexture} pointerEvents="none">
                <Image
                  source={require("../../assets/images/texture.png")}
                  style={styles.appTutorialCardTextureImage}
                  resizeMode="cover"
                />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Feed Content - Period Grid or Date-based Feed */}
        {viewMode === "Days" ? (
          <>
          {/* Date-based feed with headers */}
          {(() => {
            // Combine all dates: dates with entries + dates with prompts (user hasn't answered)
            // CRITICAL: Filter out dates before group creation
            const groupCreatedDate = currentGroup?.created_at 
              ? utcStringToLocalDate(currentGroup.created_at)
              : null
            
            const allDatesToShow = new Set([
              ...Object.keys(entriesByDate),
              ...datesWithoutUserEntry,
            ])
            
            // Filter out dates before group creation
            const filteredDatesToShow = groupCreatedDate
              ? Array.from(allDatesToShow).filter((date) => date >= groupCreatedDate)
              : Array.from(allDatesToShow)
            
            // Sort dates descending (most recent first)
            const sortedDates = filteredDatesToShow.sort((a, b) => {
              return new Date(b).getTime() - new Date(a).getTime()
            })
            
            // Use entriesWithBirthdayCards (which includes birthday cards mixed with regular entries)
            // Also merge entriesForDatesWithoutUserEntry for dates where user hasn't answered
            // This ensures entries are visible with fuzzy overlay even when user hasn't answered
            // CRITICAL: Filter out dates before group creation
            const entriesByDateFiltered: Record<string, any[]> = {}
            
            Object.keys(entriesByDate).forEach((date) => {
              // Skip dates before group creation
              if (groupCreatedDate && date < groupCreatedDate) {
                return
              }
              entriesByDateFiltered[date] = entriesByDate[date]
            })
            
            Object.keys(entriesForDatesWithoutUserEntry).forEach((date) => {
              // Skip dates before group creation
              if (groupCreatedDate && date < groupCreatedDate) {
                return
              }
              if (!entriesByDateFiltered[date]) {
                entriesByDateFiltered[date] = []
              }
              // Merge entries, avoiding duplicates
              const existingIds = new Set(entriesByDateFiltered[date].map((e: any) => e.id))
              entriesForDatesWithoutUserEntry[date].forEach((entry: any) => {
                if (!existingIds.has(entry.id)) {
                  entriesByDateFiltered[date].push(entry)
                }
              })
            })
            
            return sortedDates.map((date) => {
              // CRITICAL: Double-check date is not before group creation (safety check)
              if (groupCreatedDate && date < groupCreatedDate) {
                return null // Skip rendering dates before group creation
              }
              
              const dateEntries = entriesByDateFiltered[date] || []
              const hasUserEntry = !!userEntriesByDate[date]
              const promptForDate = promptsForDatesWithoutEntry[date]
              const isDateToday = date === todayDate
              
              // Show all entries (they will have fuzzy overlay if user hasn't answered)
              // Birthday cards always show without fuzzy overlay
              const visibleEntries = dateEntries
              
              return (
                <View 
                  key={date} 
                  style={styles.daySection}
                >
                  {/* Show "Today's answers" header for today if there are entries */}
                  {isDateToday && visibleEntries.length > 0 && (
                    <View 
                      style={styles.dateHeaderContainer}
                      ref={(ref) => {
                        if (ref) {
                          dateRefs.current[date] = ref
                        }
                      }}
                    >
                      <View style={styles.dateHeader}>
                        <Text style={styles.dateHeaderDay}>Today's answers</Text>
                      </View>
                      {/* Show helper text if user hasn't answered yet */}
                      {!hasUserEntry && (
                        <View style={styles.revealAnswersContainer}>
                          <Text style={styles.revealAnswersText}>
                            Answer today's question to reveal what they said
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                  {/* Show date header for past days */}
                  {!isDateToday && (
                    <View 
                      style={styles.dateHeaderContainerPreviousDay}
                      ref={(ref) => {
                        if (ref) {
                          dateRefs.current[date] = ref
                        }
                      }}
                    >
                      <View style={styles.dateHeader}>
                        <Text style={styles.dateHeaderDay}>{format(parseISO(date), "EEEE")}</Text>
                        <Text style={styles.dateHeaderDate}>
                          , {(() => {
                            const dateObj = parseISO(date)
                            const currentYear = new Date().getFullYear()
                            const dateYear = dateObj.getFullYear()
                            // Only show year if it's not the current year
                            if (dateYear !== currentYear) {
                              return format(dateObj, "d MMMM yyyy")
                            } else {
                              return format(dateObj, "d MMMM")
                            }
                          })()}
                        </Text>
                      </View>
                    </View>
                  )}
                  {/* For today with no entries, attach ref to a marker at the top */}
                  {isDateToday && visibleEntries.length === 0 && (
                    <View
                      ref={(ref) => {
                        if (ref) {
                          dateRefs.current[date] = ref
                        }
                      }}
                      style={{ height: 0, width: 0 }}
                    />
                  )}
                  
                  {/* Removed "Answer to see what they said" - users can now view entries without answering */}
                  
                  {/* Show prompt card if user hasn't answered (only show for today at top, or in feed for past dates) */}
                  {!hasUserEntry && promptForDate && !isDateToday && (() => {
                    // Check if this prompt is a Remembering category question
                    const isRememberingCategory = promptForDate.prompt?.category === "Remembering"
                    
                    return (
                      <View style={{ marginTop: spacing.xs, marginBottom: spacing.sm }}>
                        <View style={styles.promptCardWrapper}>
                          <TouchableOpacity
                            style={[
                              styles.promptCard,
                              isRememberingCategory && styles.promptCardRemembering
                            ]}
                            onPress={() => {
                              if (promptForDate.prompt_id && currentGroupId) {
                                router.push({
                                  pathname: "/(main)/modals/entry-composer",
                                  params: {
                                    promptId: promptForDate.prompt_id,
                                    date: date,
                                    returnTo: "/(main)/history",
                                    groupId: currentGroupId,
                                  },
                                })
                              }
                            }}
                            activeOpacity={0.95}
                          >
                            <View style={styles.promptCardContent}>
                              <Text style={[
                                styles.promptQuestion,
                                isRememberingCategory && styles.promptQuestionRemembering
                              ]}>
                                {promptForDate.prompt?.question || "Question"}
                              </Text>
                              <Button
                                title="Answer"
                                style={{ 
                                  backgroundColor: isRememberingCategory ? theme2Colors.white : theme2Colors.blue,
                                  borderRadius: 25,
                                  paddingVertical: spacing.md,
                                  paddingHorizontal: spacing.xl,
                                  marginTop: spacing.md,
                                }}
                                textStyle={{ 
                                  color: isRememberingCategory 
                                    ? (isDark ? "#000000" : theme2Colors.text) // Black in dark mode, normal text in light mode for Remembering
                                    : theme2Colors.white 
                                }}
                                onPress={() => {
                                  if (promptForDate.prompt_id && currentGroupId) {
                                    router.push({
                                      pathname: "/(main)/modals/entry-composer",
                                      params: {
                                        promptId: promptForDate.prompt_id,
                                        date: date,
                                        returnTo: "/(main)/history",
                                        groupId: currentGroupId,
                                      },
                                    })
                                  }
                                }}
                              />
                            </View>
                            {/* Texture overlay */}
                            <View style={styles.promptCardTexture} pointerEvents="none">
                              <Image
                                source={require("../../assets/images/texture.png")}
                                style={{ 
                                  position: "absolute",
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  width: "100%",
                                  height: "100%",
                                }}
                                resizeMode="stretch"
                              />
                            </View>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )
                  })()}
                  
                  {/* Show entries for this date (filtered to show birthday cards always, regular entries only if user answered) */}
                  {visibleEntries.length > 0 && visibleEntries.map((entry: any, entryIndex: number) => {
                    // Handle birthday card entries specially (styled like the image)
                    if (entry.is_birthday_card) {
                      return (
                        <View key={entry.id} style={{ position: "relative" }}>
                          <TouchableOpacity
                            style={styles.birthdayCardEntry}
                            onPress={() => {
                              if (hasUserEntry) {
                                router.push({
                                  pathname: "/(main)/birthday-card-details",
                                  params: {
                                    cardId: entry.birthday_card_id,
                                    groupId: currentGroupId!,
                                    returnTo: "/(main)/history",
                                  },
                                })
                              }
                            }}
                            disabled={!hasUserEntry}
                            activeOpacity={0.9}
                          >
                            {/* Geometric shapes at top left */}
                            <View style={styles.birthdayCardEntryShapes}>
                              <View style={styles.birthdayCardEntryQuarterCircle} />
                              <View style={styles.birthdayCardEntryFullCircle} />
                              <View style={styles.birthdayCardEntryHalfCircle} />
                            </View>
                            
                            {/* Content */}
                            <View style={styles.birthdayCardEntryContent}>
                              <Text style={styles.birthdayCardEntryTitle}>🎂 Your birthday card</Text>
                              <Text style={styles.birthdayCardEntrySubtitle}>Happy birthday, {userName}. Your group wrote you a card</Text>
                              
                              {/* CTA Button */}
                              {hasUserEntry && (
                                <TouchableOpacity
                                  style={styles.birthdayCardEntryButton}
                                  onPress={() => {
                                    router.push({
                                      pathname: "/(main)/birthday-card-details",
                                      params: {
                                        cardId: entry.birthday_card_id,
                                        groupId: currentGroupId!,
                                        returnTo: "/(main)/history",
                                      },
                                    })
                                  }}
                                >
                                  <Text style={styles.birthdayCardEntryButtonText}>Open card</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                            {/* Texture overlay */}
                            <View style={styles.birthdayCardEntryTexture} pointerEvents="none">
                              <Image
                                source={require("../../assets/images/texture.png")}
                                style={{ 
                                  position: "absolute",
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  width: "100%",
                                  height: "100%",
                                }}
                                resizeMode="stretch"
                              />
                            </View>
                          </TouchableOpacity>
                          {/* Removed fuzzy overlay - users can now view entries without answering */}
                        </View>
                      )
                    }
                    
                    // Regular entry card
                    const entryIdList = visibleEntries.map((item: any) => item.id)
                    // Show fuzzy overlay only for today if user hasn't answered
                    // For previous days, never show fuzzy overlay
                    const shouldShowFuzzy = isDateToday && !hasUserEntry && !entry.is_birthday_card
                    
                    // Get prompt ID for today to navigate to entry-composer (use existing todayPromptId or fallback)
                    const promptIdForNavigation = isDateToday 
                      ? (todayPromptId || todayDailyPrompt?.prompt_id || promptsForDatesWithoutEntry[date]?.prompt_id)
                      : null
                    
                    return (
                      <EntryCard
                        key={entry.id}
                        entry={entry}
                        entryIds={entryIdList}
                        index={entryIndex}
                        returnTo="/(main)/history"
                        showFuzzyOverlay={shouldShowFuzzy}
                        onEntryPress={(entryDate) => {
                          // Store entry date for scroll restoration when returning
                          lastViewedEntryDateRef.current = entryDate
                        }}
                        // REMOVED: onRevealAnswers prop - tapping fuzzy card now navigates to entry-composer
                        // Pass prompt info for navigation when fuzzy overlay is tapped
                        fuzzyOverlayPromptId={shouldShowFuzzy ? promptIdForNavigation : undefined}
                        fuzzyOverlayDate={shouldShowFuzzy ? todayDate : undefined}
                        fuzzyOverlayGroupId={shouldShowFuzzy ? currentGroupId : undefined}
                      />
                    )
                  })}
          </View>
              )
            })
          })()}
          
          {/* Loading indicator - removed for History screen (no pagination) */}
          {/* End of feed indicator - removed for History screen (no pagination) */}
          </>
        ) : viewMode === "Weeks" ? (
          renderPeriodGrid(weekSummaries, "Weeks")
        ) : viewMode === "Months" ? (
          renderPeriodGrid(monthSummaries, "Months")
        ) : (
          renderPeriodGrid(yearSummaries, "Years")
        )}
      </Animated.ScrollView>

      {/* Filter Modal */}
      <Modal
        animationType="slide"
        visible={showFilterModal}
        onRequestClose={() => setShowFilterModal(false)}
        presentationStyle="fullScreen"
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top + spacing.lg }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter your history</Text>
            <TouchableOpacity onPress={() => setShowFilterModal(false)} style={styles.modalCloseButton}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView 
            contentContainerStyle={[
              styles.modalContent,
              hasActiveFilters && { paddingBottom: spacing.xxl * 2 } // Add extra padding when CTA is visible
            ]}
          >
            <Text style={styles.modalSection}>Look back on their answers</Text>
            <View style={styles.selectionGrid}>
              {members.map((member) => {
                const isSelected = selectedMembers.includes(member.user_id)
                return (
                  <TouchableOpacity
                    key={member.id}
                    style={[styles.selectionCard, isSelected && styles.selectionCardActive]}
                    onPress={() =>
                      setSelectedMembers((prev) =>
                        prev.includes(member.user_id)
                          ? prev.filter((id) => id !== member.user_id)
                          : [...prev, member.user_id],
                      )
                    }
                  >
                    <Avatar uri={member.user?.avatar_url} name={member.user?.name || ""} size={40} />
                    <Text style={styles.selectionLabel}>{member.user?.name}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* Memorials filter - only show if group has memorials */}
            {memorials.length > 0 && (
              <>
                <Text style={[styles.modalSection, styles.modalSectionSpacing]}>See what you've all shared about them</Text>
                <View style={styles.memorialList}>
                  {memorials.map((memorial) => {
                    const isSelected = selectedMemorials.includes(memorial.id)
                    return (
                      <TouchableOpacity
                        key={memorial.id}
                        style={[styles.memorialRow, isSelected && styles.memorialRowActive]}
                        onPress={() =>
                          setSelectedMemorials((prev) =>
                            prev.includes(memorial.id)
                              ? prev.filter((id) => id !== memorial.id)
                              : [...prev, memorial.id],
                          )
                        }
                      >
                        <Avatar uri={memorial.photo_url} name={memorial.name} size={40} />
                        <Text style={styles.memorialName}>{memorial.name}</Text>
                      </TouchableOpacity>
                    )
                  })}
                      </View>
              </>
            )}

            <Text style={[styles.modalSection, styles.modalSectionSpacing]}>Question Categories</Text>
            <View style={styles.selectionGrid}>
              {categories.map((category, index) => {
                const isSelected = selectedCategories.includes(category)
                return (
                      <TouchableOpacity
                    key={`category-${category}-${index}`}
                    style={[styles.selectionCard, isSelected && styles.selectionCardActive]}
                    onPress={() =>
                      setSelectedCategories((prev) =>
                        prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
                      )
                    }
                  >
                    <Text style={styles.selectionLabel}>{category}</Text>
                      </TouchableOpacity>
                )
              })}
            </View>

            {/* Decks filter - only show if group has active decks */}
            {availableDecks.length > 0 && (
              <>
                <Text style={[styles.modalSection, styles.modalSectionSpacing]}>Answers by decks you added</Text>
                <View style={styles.selectionGrid}>
                  {availableDecks.map((deck: any, index) => {
                    const isSelected = selectedDecks.includes(deck.deck_id)
                    return (
                      <TouchableOpacity
                        key={`deck-${deck.deck_id}-${index}`}
                        style={[styles.selectionCard, isSelected && styles.selectionCardActive]}
                        onPress={() =>
                          setSelectedDecks((prev) =>
                            prev.includes(deck.deck_id)
                              ? prev.filter((id) => id !== deck.deck_id)
                              : [...prev, deck.deck_id],
                          )
                        }
                      >
                        <Text style={styles.selectionLabel}>{deck.deck?.name || "Unknown Deck"}</Text>
                      </TouchableOpacity>
                    )
                  })}
                      </View>
              </>
            )}

            {/* Birthday Cards filter - only show if user has received cards */}
            {hasReceivedCards && (
              <>
                <Text style={[styles.modalSection, styles.modalSectionSpacing]}>Birthday Cards</Text>
                      <TouchableOpacity
                  style={[styles.memorialRow, showBirthdayCards && styles.memorialRowActive]}
                  onPress={() => setShowBirthdayCards((prev) => !prev)}
                >
                  <Text style={[styles.memorialName, { textAlign: "center", width: "100%" }]}>Show my birthday cards</Text>
                      </TouchableOpacity>
              </>
            )}
          </ScrollView>
          
          {/* Floating "See answers" CTA - show when selections are applied */}
          {hasActiveFilters && (
            <View style={styles.filterCTAContainer}>
              <TouchableOpacity
                style={styles.filterSeeAnswersButton}
                onPress={() => setShowFilterModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.filterSeeAnswersText}>See answers</Text>
              </TouchableOpacity>
            </View>
          )}
          </View>
      </Modal>

      <Modal visible={groupPickerVisible} transparent animationType="fade" onRequestClose={() => setGroupPickerVisible(false)}>
        <TouchableOpacity style={styles.groupModalBackdrop} activeOpacity={1} onPress={() => setGroupPickerVisible(false)}>
          {/* Backdrop overlays matching Profile Modal opacity */}
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: isDark ? "rgba(0, 0, 0, 0.4)" : "rgba(232, 224, 213, 0.4)" }]} />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: isDark ? "rgba(0, 0, 0, 0.3)" : "rgba(0, 0, 0, 0.1)" }]} />
          <View style={[styles.groupModalSheet, Platform.OS === "android" && { paddingBottom: spacing.lg + insets.bottom }, { paddingBottom: spacing.lg + insets.bottom }]}>
            {/* Close Button - positioned at top right of card */}
            <TouchableOpacity
              style={styles.groupModalCloseButton}
              onPress={() => setGroupPickerVisible(false)}
              activeOpacity={0.7}
            >
              <FontAwesome name="times" size={16} color={isDark ? "#F5F0EA" : theme2Colors.text} />
            </TouchableOpacity>
            <Text style={styles.groupModalTitle}>Your groups</Text>
            <ScrollView contentContainerStyle={styles.groupList}>
              {groups.map((group) => {
                const groupMembers = allGroupsMembers[group.id] || []
                const isSelected = group.id === currentGroupId
                
                return (
                  <View key={group.id} style={styles.groupRowContainerFullWidth}>
                    <TouchableOpacity
                      style={[
                        styles.groupRowFullWidth,
                        isSelected && styles.groupRowActive,
                      ]}
                      onPress={() => handleSelectGroup(group.id)}
                    >
                      <View style={styles.groupRowContent}>
                        {/* Small avatar circles above group name - show all members */}
                        {groupMembers.length > 0 && (
                          <View style={styles.groupAvatarsRow}>
                            {groupMembers.map((member) => (
                              <View
                                key={member.id}
                                style={[
                                  styles.groupAvatarSmall,
                                  isSelected && styles.groupAvatarSmallActive
                                ]}
                              >
                                <Avatar
                                  uri={member.user?.avatar_url}
                                  name={member.user?.name || "User"}
                                  size={28}
                                />
                              </View>
                            ))}
                          </View>
                        )}
                        <View style={styles.groupRowTextContainer}>
                          <View style={styles.groupNameRow}>
                            <Text style={styles.groupRowText}>{group.name}</Text>
                            {/* Show yellow indicator next to group name if there are new answers */}
                            {groups.length > 1 && 
                             !isSelected && 
                             groupUnseenStatus[group.id] && (
                              <View style={styles.unseenDot} />
                            )}
                          </View>
                        </View>
                      </View>
                      
                      {/* Show buttons only for selected group */}
                      {isSelected && (
                        <View style={styles.groupActionButtons}>
                          <TouchableOpacity
                            style={styles.groupActionButton}
                            onPress={() => {
                              setGroupPickerVisible(false)
                              router.push({
                                pathname: "/(main)/group-interests",
                                params: { groupId: group.id },
                              })
                            }}
                          >
                            <Text style={styles.groupActionButtonText}>Edit what you're into</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.groupActionButtonSmall}
                            onPress={() => {
                              setGroupPickerVisible(false)
                              router.push({
                                pathname: "/(main)/group-settings",
                                params: { groupId: group.id },
                              })
                            }}
                          >
                            <Text style={styles.groupActionButtonText}>Settings</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                )
              })}
            </ScrollView>
            <TouchableOpacity style={styles.createGroupButton} onPress={handleCreateGroupSoon} activeOpacity={0.8}>
              {/* Texture overlay */}
              <View style={styles.createGroupButtonTexture} pointerEvents="none">
                <Image
                  source={require("../../assets/images/texture.png")}
                  style={{ 
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    width: "100%",
                    height: "100%",
                  }}
                  resizeMode="cover"
                />
              </View>
              <Text style={styles.createGroupText}>Create another group</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Notification Modal */}
      <NotificationModal
        visible={notificationModalVisible}
        notifications={notifications}
        onClose={() => setNotificationModalVisible(false)}
        onNotificationPress={handleNotificationPress}
        onClearAll={handleClearAllNotifications}
      />

      {/* User Profile Modal */}
      <UserProfileModal
        visible={userProfileModalVisible}
        userId={selectedMember?.id || null}
        userName={selectedMember?.name || null}
        userAvatarUrl={selectedMember?.avatar_url}
        groupId={currentGroupId}
        onClose={() => {
          setUserProfileModalVisible(false)
          setSelectedMember(null)
        }}
        onViewHistory={(userId) => {
          // Filter on Home screen instead of History
          setSelectedMembers([userId])
          setShowFilterModal(false)
          setUserProfileModalVisible(false)
          setSelectedMember(null)
          // Scroll to top to show filtered results
          scrollViewRef.current?.scrollTo({ y: 0, animated: true })
        }}
      />

      {/* App Review Modal */}
      <AppReviewModal
        visible={showAppReviewModal}
        onClose={() => setShowAppReviewModal(false)}
        onRate={async () => {
          // Track that user clicked rate
          safeCapture(posthog, "app_review_modal_rate_clicked", {
            user_id: userId,
            group_id: currentGroupId,
          })
        }}
      />

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
          { id: "8", source: require("../../assets/images/onboarding-7-set-your-vibe.png") },
        ]}
        onComplete={() => setOnboardingGalleryVisible(false)}
        returnRoute="/(main)/home"
      />
    </View>
  )
}

