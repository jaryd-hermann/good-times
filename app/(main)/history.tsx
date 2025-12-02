"use client"

import { useMemo, useState, useEffect, useRef, useCallback } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, ImageBackground, Animated, Dimensions, RefreshControl, ActivityIndicator } from "react-native"
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "../../lib/supabase"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { usePostHog } from "posthog-react-native"
import { captureEvent } from "../../lib/posthog"
import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from "date-fns"
import { typography, spacing } from "../../lib/theme"
import { useTheme } from "../../lib/theme-context"
import { getGroupMembers, getAllPrompts, getDailyPrompt, getMemorials, getGroup, getGroupActiveDecks, hasReceivedBirthdayCards, getMyBirthdayCards } from "../../lib/db"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Button } from "../../components/Button"
import { getTodayDate } from "../../lib/utils"
import { FontAwesome } from "@expo/vector-icons"
import { EntryCard } from "../../components/EntryCard"
import { Avatar } from "../../components/Avatar"
import { useTabBar } from "../../lib/tab-bar-context"

type ViewMode = "Days" | "Weeks" | "Months" | "Years"
type PeriodMode = Exclude<ViewMode, "Days">

interface PeriodSummary {
  key: string
  start: string
  end: string
  title: string
  subtitle: string
  count: number
  image?: string
}

interface ActivePeriod {
  mode: PeriodMode
  start: string
  end: string
  title: string
  subtitle: string
}

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

export default function History() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const focusGroupId = params.focusGroupId as string | undefined
  const { colors, isDark } = useTheme()
  const [viewMode, setViewMode] = useState<ViewMode>("Days")
  const [showFilter, setShowFilter] = useState(false)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const posthog = usePostHog()

  // Track loaded_history_screen event
  useEffect(() => {
    try {
      if (posthog) {
        posthog.capture("loaded_history_screen")
      } else {
        captureEvent("loaded_history_screen")
      }
    } catch (error) {
      if (__DEV__) console.error("[history] Failed to track loaded_history_screen:", error)
    }
  }, [posthog])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [selectedMemorials, setSelectedMemorials] = useState<string[]>([])
  const [selectedDecks, setSelectedDecks] = useState<string[]>([])
  const [showBirthdayCards, setShowBirthdayCards] = useState(false)
  const [currentGroupId, setCurrentGroupId] = useState<string>()
  const [userId, setUserId] = useState<string>()
  const [activePeriod, setActivePeriod] = useState<ActivePeriod | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showRefreshIndicator, setShowRefreshIndicator] = useState(false)
  const insets = useSafeAreaInsets()
  const scrollY = useRef(new Animated.Value(0)).current
  const headerTranslateY = useRef(new Animated.Value(0)).current
  const contentPaddingTop = useRef(new Animated.Value(0)).current
  const lastScrollY = useRef(0)
  const { opacity: tabBarOpacity } = useTabBar()
  const queryClient = useQueryClient()

  useEffect(() => {
    loadUserAndGroup()
  }, [])

  // CRITICAL: Sync group ID with AsyncStorage on focus to match home.tsx
  useFocusEffect(
    useCallback(() => {
      async function syncGroupId() {
        const persistedGroupId = await AsyncStorage.getItem("current_group_id")
        if (persistedGroupId && persistedGroupId !== currentGroupId) {
          console.log(`[history] Syncing group ID from AsyncStorage: ${persistedGroupId}`)
          setCurrentGroupId(persistedGroupId)
          // Reset filters when switching groups
          setActivePeriod(null)
          setSelectedCategories([])
          setSelectedMembers([])
        }
      }
      syncGroupId()
    }, [currentGroupId])
  )

  useEffect(() => {
    if (focusGroupId && focusGroupId !== currentGroupId) {
      setCurrentGroupId(focusGroupId)
      AsyncStorage.setItem("current_group_id", focusGroupId).catch(() => {})
      // Reset filters when switching groups
      setActivePeriod(null)
      setSelectedCategories([])
      setSelectedMembers([])
      setSelectedMemorials([])
      setSelectedDecks([])
      setShowBirthdayCards(false)
    }
  }, [focusGroupId, currentGroupId])

  async function loadUserAndGroup() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      setUserId(user.id)
      // Get all user's groups
      const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id)
        .order("joined_at", { ascending: false })
      
      if (memberships && memberships.length > 0) {
        const groupIds = memberships.map((m: { group_id: string }) => m.group_id)
        
        // Priority order:
        // 1. focusGroupId param (highest priority)
        // 2. Persisted group ID from AsyncStorage
        // 3. Current state (if already set)
        // 4. First group (fallback)
        
        if (focusGroupId && groupIds.includes(focusGroupId)) {
          setCurrentGroupId(focusGroupId)
          await AsyncStorage.setItem("current_group_id", focusGroupId)
        } else if (!currentGroupId) {
          // Try to restore from AsyncStorage
          const persistedGroupId = await AsyncStorage.getItem("current_group_id")
          if (persistedGroupId && groupIds.includes(persistedGroupId)) {
            setCurrentGroupId(persistedGroupId)
          } else {
            // Fallback to first group
            const firstGroup = memberships[0] as { group_id: string }
            setCurrentGroupId(firstGroup.group_id)
            await AsyncStorage.setItem("current_group_id", firstGroup.group_id)
          }
        }
        // Otherwise, preserve the existing currentGroupId
      }
    }
  }

  const { data: entries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ["historyEntries", currentGroupId],
    queryFn: async (): Promise<any[]> => {
      if (!currentGroupId) return []
      console.log(`[history] Fetching entries for group: ${currentGroupId}`)
      const { data, error } = await supabase
        .from("entries")
        .select("*, user:users(*), prompt:prompts(*)")
        .eq("group_id", currentGroupId)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50)
      if (error) {
        console.error("[history] entries query error:", error)
        return []
      }
      // CRITICAL: Double-check all entries belong to the correct group (safety filter)
      const filteredData = (data || []).filter((entry: any) => entry.group_id === currentGroupId)
      if (filteredData.length !== (data?.length || 0)) {
        console.warn(`[history] Found ${(data?.length || 0) - filteredData.length} entries with wrong group_id - filtered out`)
      }
      console.log(`[history] Loaded ${filteredData.length} entries for group: ${currentGroupId}`)
      return filteredData
    },
    enabled: !!currentGroupId,
    staleTime: 0, // Always fetch fresh data when group changes
    gcTime: 1000 * 60 * 60 * 24, // Keep in cache for 24 hours (longer to preserve across group switches)
    placeholderData: (previousData, query) => {
      // CRITICAL: Preserve data when switching groups to prevent history from appearing wiped
      // React Query automatically caches by queryKey, so data for each group is preserved separately
      if (query && query.queryKey && query.queryKey[1]) {
        const queryGroupId = query.queryKey[1] as string | undefined
        // If this query is for the current group and we have cached data, use it
        if (queryGroupId === currentGroupId && previousData && Array.isArray(previousData) && previousData.length > 0) {
          console.log(`[history] Using cached data for group: ${currentGroupId} (${previousData.length} entries)`)
          return previousData
        }
      }
      // Return undefined to trigger fresh fetch, but React Query keeps old data in cache
      return undefined
    },
  })

  // Fetch prompt_name_usage to determine which memorial was actually used for each entry
  // Only fetch for entries that have memorial_name variable
  const entriesWithMemorialVariable = useMemo(() => {
    return entries.filter((entry: any) => {
      const prompt = entry.prompt
      return prompt?.dynamic_variables?.includes("memorial_name") || 
             (prompt?.question && /\{.*memorial_name.*\}/i.test(prompt.question))
    })
  }, [entries])

  const { data: memorialNameUsage = [] } = useQuery({
    queryKey: ["memorialNameUsage", currentGroupId],
    queryFn: async () => {
      if (!currentGroupId) return []
      
      // Fetch ALL prompt_name_usage records for this group with memorial_name variable
      // Order by created_at to prefer earliest (correct) records if duplicates exist
      const { data, error } = await supabase
        .from("prompt_name_usage")
        .select("prompt_id, date_used, name_used, created_at")
        .eq("group_id", currentGroupId)
        .eq("variable_type", "memorial_name")
        .order("created_at", { ascending: true }) // Prefer earliest records (correct ones)
      
      if (error) {
        console.error("[history] Error fetching memorial name usage:", error)
        return []
      }
      
      return (data || []) as Array<{ prompt_id: string; date_used: string; name_used: string; created_at: string }>
    },
    enabled: !!currentGroupId,
  })

  // Helper function to calculate day index (same logic as in lib/db.ts)
  const getDayIndex = (dateString: string, groupId: string): number => {
    const base = new Date(dateString)
    const start = new Date("2020-01-01")
    const diff = Math.floor((base.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    const groupOffset = groupId ? groupId.length : 0
    return diff + groupOffset
  }

  // Function to determine which memorial would have been used for a prompt on a given date
  // Uses the same logic as getDailyPrompt in lib/db.ts
  const getMemorialForPrompt = useCallback((promptId: string, date: string, groupId: string): string | null => {
    // First check if we have usage data
    const normalizedDate = date.split('T')[0]
    const usageKey = `${promptId}-${normalizedDate}`
    const memorialNameUsed = memorialUsageMap.get(usageKey)
    if (memorialNameUsed) {
      return memorialNameUsed
    }

    // Fallback: calculate which memorial would have been used using the same logic
    // This matches the logic in lib/db.ts getDailyPrompt
    // If memorials haven't loaded yet, return null (will be recalculated when they load)
    if (memorials.length === 0) return null

    // Get recently used memorial names for this prompt (from usage data we have)
    // Match the logic in lib/db.ts: order by date_used descending and limit to memorials.length
    const recentUsage = memorialNameUsage
      .filter(u => u.prompt_id === promptId)
      .sort((a, b) => {
        // Sort by date_used descending (most recent first)
        const dateA = new Date(a.date_used).getTime()
        const dateB = new Date(b.date_used).getTime()
        return dateB - dateA
      })
      .slice(0, memorials.length) // Limit to memorials.length (same as lib/db.ts)
      .map(u => u.name_used)
    
    const usedNames = new Set(recentUsage)
    
    // Find unused memorials first
    const unusedMemorials = memorials.filter((m) => !usedNames.has(m.name))
    
    // If all have been used, reset and start fresh
    const availableMemorials = unusedMemorials.length > 0 ? unusedMemorials : memorials
    
    // Select next memorial (cycle through) - same logic as lib/db.ts
    const dayIndex = getDayIndex(date, groupId)
    const memorialIndex = dayIndex % availableMemorials.length
    const selectedMemorial = availableMemorials[memorialIndex]
    
    return selectedMemorial.name
  }, [memorials, memorialNameUsage, memorialUsageMap])

  const { data: members = [] } = useQuery({
    queryKey: ["history-members", currentGroupId],
    queryFn: () => (currentGroupId ? getGroupMembers(currentGroupId) : []),
    enabled: !!currentGroupId,
  })

  // Fetch group to get type
  const { data: group } = useQuery({
    queryKey: ["history-group", currentGroupId],
    queryFn: () => (currentGroupId ? getGroup(currentGroupId) : null),
    enabled: !!currentGroupId,
  })

  // Fetch memorials for personalizing prompt questions
  const { data: memorials = [] } = useQuery({
    queryKey: ["history-memorials", currentGroupId],
    queryFn: () => (currentGroupId ? getMemorials(currentGroupId) : []),
    enabled: !!currentGroupId,
  })

  // Fetch active decks for filtering
  const { data: activeDecks = [] } = useQuery({
    queryKey: ["history-activeDecks", currentGroupId],
    queryFn: () => (currentGroupId ? getGroupActiveDecks(currentGroupId) : []),
    enabled: !!currentGroupId,
  })

  // Get only active decks (for filtering)
  const availableDecks = activeDecks.filter((deck) => deck.status === "active" || deck.status === "finished")

  // Check if user has received birthday cards (for filter option)
  const { data: hasReceivedCards } = useQuery({
    queryKey: ["hasReceivedBirthdayCards", currentGroupId, userId],
    queryFn: () => (currentGroupId && userId ? hasReceivedBirthdayCards(currentGroupId, userId) : false),
    enabled: !!currentGroupId && !!userId,
  })

  // Get user's birthday cards (only their own) - always fetch to show in feed
  const { data: myBirthdayCards = [] } = useQuery({
    queryKey: ["myBirthdayCards", currentGroupId, userId],
    queryFn: () => (currentGroupId && userId ? getMyBirthdayCards(currentGroupId, userId) : []),
    enabled: !!currentGroupId && !!userId, // Always fetch, not just when filter is active
  })

  const { data: categories = [] } = useQuery({
    queryKey: ["history-categories", currentGroupId, group?.type, memorials.length],
    queryFn: async () => {
      if (!currentGroupId || !group) return []
      
      // Fetch entries to get categories that are actually used
      const { data: entriesData } = await supabase
        .from("entries")
        .select("prompt:prompts(category, is_custom)")
        .eq("group_id", currentGroupId)
        .limit(1000) // Get enough entries to cover all categories
      
      // Get categories from actual entries in this group
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
      
      // Get group NSFW status (may not be in TypeScript type but exists in DB)
      const groupWithNSFW = group as any
      const enableNSFW = groupWithNSFW?.enable_nsfw === true
      
      // Start with categories from entries
      let filteredCategories = Array.from(entryCategories)
      
      // Filter based on group type and NSFW status
      if (group.type === "family") {
        // Family groups: exclude "Edgy/NSFW", "Friends", "Seasonal"
        filteredCategories = filteredCategories.filter(
          (cat) => cat !== "Edgy/NSFW" && cat !== "Friends" && cat !== "Seasonal"
        )
      } else if (group.type === "friends") {
        // Friends groups: exclude "Family", "Seasonal", and "Edgy/NSFW" unless NSFW is enabled
        filteredCategories = filteredCategories.filter((cat) => {
          if (cat === "Family" || cat === "Seasonal") return false
          if (cat === "Edgy/NSFW" && !enableNSFW) return false
          return true
        })
      } else {
        // No group yet: exclude "Seasonal"
        filteredCategories = filteredCategories.filter((cat) => cat !== "Seasonal")
      }
      
      // Exclude "Remembering" unless group has memorials
      if (memorials.length === 0) {
        filteredCategories = filteredCategories.filter((cat) => cat !== "Remembering")
      }
      
      return filteredCategories.sort()
    },
    enabled: !!currentGroupId && !!group,
  })

  const { data: todayPrompt } = useQuery({
    queryKey: ["history-today-prompt", currentGroupId],
    queryFn: () => (currentGroupId ? getDailyPrompt(currentGroupId, getTodayDate()) : null),
    enabled: !!currentGroupId,
  })

  function handleEntryPress(entryId: string, context?: { entryIds?: string[]; index?: number; scrollToComments?: boolean }) {
    const params: Record<string, string> = {
      entryId,
      returnTo: "/(main)/history",
    }
    if (context?.entryIds) {
      params.entryIds = JSON.stringify(context.entryIds)
    }
    if (typeof context?.index === "number") {
      params.index = String(context.index)
    }
    router.push({
      pathname: "/(main)/modals/entry-detail",
      params,
    })
  }

  const entriesWithinPeriod = useMemo(() => {
    if (!activePeriod) {
      return entries
    }
    const start = parseISO(activePeriod.start)
    const end = parseISO(activePeriod.end)
    return entries.filter((entry) => {
      if (!entry?.date) return false
      const entryDate = parseISO(entry.date)
      if (Number.isNaN(entryDate.getTime())) return false
      return entryDate >= start && entryDate <= end
    })
  }, [entries, activePeriod])

  // Create a map of prompt_id + date -> memorial name used
  // Normalize dates to ensure matching (both should be YYYY-MM-DD format)
  // CRITICAL: If multiple records exist for same key (duplicates), prefer the FIRST one encountered
  // Since we order by created_at ascending, the first one is the earliest (correct) record
  const memorialUsageMap = useMemo(() => {
    const map = new Map<string, string>()
    memorialNameUsage.forEach((usage) => {
      // Normalize date to YYYY-MM-DD format (remove time if present)
      const normalizedDate = usage.date_used.split('T')[0]
      const key = `${usage.prompt_id}-${normalizedDate}`
      
      // Only set if key doesn't exist - this means we prefer the FIRST record (earliest created_at)
      // This ensures we use the correct memorial even if duplicates exist
      if (!map.has(key)) {
        map.set(key, usage.name_used)
      } else {
        // Duplicate detected - log warning but keep the first one (which is correct)
        if (__DEV__) {
          console.warn(`[history] Duplicate prompt_name_usage detected for ${key}. Using first record: ${map.get(key)} instead of ${usage.name_used}`)
        }
      }
    })
    return map
  }, [memorialNameUsage])

  const filteredEntries = useMemo(
    () =>
      entriesWithinPeriod.filter((entry) => {
        const isCustom = entry.prompt?.is_custom === true
        const category = isCustom ? "Custom" : (entry.prompt?.category ?? "")

        if (selectedCategories.length > 0 && (!category || !selectedCategories.includes(category))) {
          return false
        }

        // Filter by deck
        if (selectedDecks.length > 0) {
          const entryDeckId = entry.prompt?.deck_id || null
          if (!entryDeckId || !selectedDecks.includes(entryDeckId)) {
            return false
          }
        }

        if (selectedMembers.length > 0 && !selectedMembers.includes(entry.user_id)) {
          return false
        }
        
        // Filter by memorial: check which memorial was actually used for this entry
        if (selectedMemorials.length > 0 && currentGroupId) {
          const entryQuestion = entry.prompt?.question || ""
          const prompt = entry.prompt
          
          // Check if prompt has memorial_name variable
          const hasMemorialVariable = prompt?.dynamic_variables?.includes("memorial_name") || 
                                      entryQuestion.match(/\{.*memorial_name.*\}/i)
          
          if (hasMemorialVariable) {
            // Determine which memorial was used for this prompt on this date
            // This uses the same logic as getDailyPrompt to calculate which memorial would have been selected
            const memorialNameUsed = getMemorialForPrompt(entry.prompt_id, entry.date, currentGroupId)
            
            if (memorialNameUsed) {
              // Check if the memorial name used matches any of the selected memorials
              const matchesSelectedMemorial = selectedMemorials.some((memorialId) => {
                const memorial = memorials.find((m) => m.id === memorialId)
                return memorial && memorial.name === memorialNameUsed
              })
              
              if (!matchesSelectedMemorial) {
                return false
              }
            } else {
              // If we can't determine which memorial was used (memorials not loaded yet or calculation failed),
              // don't filter out the entry - let it show until memorials load and we can recalculate
              // This prevents filtering out entries prematurely when data is still loading
              if (memorials.length === 0) {
                // Memorials haven't loaded yet - don't filter, show all entries
                // The filter will re-run when memorials load
                return true
              }
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
      }),
    [entriesWithinPeriod, selectedCategories, selectedMembers, selectedMemorials, selectedDecks, memorials, memorialUsageMap, getMemorialForPrompt, currentGroupId],
  )

  // Fetch comments for all entries to show previews
  const entryIdsString = useMemo(() => {
    return filteredEntries.map((e) => e.id).join(",")
  }, [filteredEntries])

  interface CommentWithUser {
    id: string
    entry_id: string
    text: string
    user?: {
      id: string
      name?: string
      avatar_url?: string
    }
    created_at: string
  }

  const { data: allComments = [] } = useQuery<CommentWithUser[]>({
    queryKey: ["historyComments", entryIdsString],
    queryFn: async () => {
      if (filteredEntries.length === 0) return []
      const entryIds = filteredEntries.map((e) => e.id)
      const { data } = await supabase
        .from("comments")
        .select("*, user:users(*), entry_id")
        .in("entry_id", entryIds)
        .order("created_at", { ascending: true })
      return (data || []) as CommentWithUser[]
    },
    enabled: filteredEntries.length > 0 && entryIdsString.length > 0,
  })

  // Group comments by entry_id
  const commentsByEntry = useMemo(() => {
    const grouped: Record<string, CommentWithUser[]> = {}
    allComments.forEach((comment) => {
      if (!grouped[comment.entry_id]) {
        grouped[comment.entry_id] = []
      }
      grouped[comment.entry_id].push(comment)
    })
    return grouped
  }, [allComments])

  const weekSummaries = useMemo(() => buildPeriodSummaries(entries, "Weeks"), [entries])
  const monthSummaries = useMemo(() => buildPeriodSummaries(entries, "Months"), [entries])
  const yearSummaries = useMemo(() => buildPeriodSummaries(entries, "Years"), [entries])

  async function handleRefresh() {
    setRefreshing(true)
    // Show spinner immediately when refresh starts
    setShowRefreshIndicator(true)
    try {
      // Invalidate all queries to ensure fresh data
      await queryClient.invalidateQueries()
      await queryClient.refetchQueries()
      
      // Keep spinner visible for at least 1 second total
      setTimeout(() => {
        setShowRefreshIndicator(false)
      }, 1000)
    } catch (error) {
      console.error("[history] Error during refresh:", error)
      setShowRefreshIndicator(false)
    } finally {
      setRefreshing(false)
    }
  }

  function handleAnswerToday() {
    if (todayPrompt?.prompt_id && currentGroupId) {
      router.push({
        pathname: "/(main)/modals/entry-composer",
        params: { 
          promptId: todayPrompt.prompt_id, 
          date: getTodayDate(), 
          returnTo: "/(main)/history",
          groupId: currentGroupId, // Pass current group ID explicitly
        },
      })
    } else {
      router.push("/(main)/home")
    }
  }

  function handleInvite() {
    if (!currentGroupId) {
      router.push("/(main)/home")
      return
    }
    router.push({
      pathname: "/(onboarding)/create-group/invite",
      params: { groupId: currentGroupId },
    })
  }

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

  function renderPeriodGrid(periods: PeriodSummary[], mode: PeriodMode) {
    if (periods.length === 0) {
      return (
        <View style={styles.placeholderContainer}>
          <Text style={styles.placeholderText}>No {mode.toLowerCase()} captured yet</Text>
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

  // Group entries by date for Days view
  // Always add birthday cards as special entries (mixed with regular entries)
  // When showBirthdayCards filter is active, show ONLY birthday cards
  const entriesWithBirthdayCards = useMemo(() => {
    // Create a map of birthday cards by date
    const cardsByDate = new Map<string, typeof myBirthdayCards>()
    myBirthdayCards.forEach((card) => {
      if (!cardsByDate.has(card.birthday_date)) {
        cardsByDate.set(card.birthday_date, [])
      }
      cardsByDate.get(card.birthday_date)!.push(card)
    })
    
    // If filter is active, show ONLY birthday cards
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
    
    // Otherwise, mix birthday cards with regular entries
    const entries: any[] = [...filteredEntries]
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
  }, [filteredEntries, showBirthdayCards, myBirthdayCards])

  const entriesByDate = entriesWithBirthdayCards.reduce(
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

  useEffect(() => {
    // Calculate header height and set initial padding
    const headerHeight = spacing.xxl * 2 + spacing.md + 40 + spacing.md
    contentPaddingTop.setValue(headerHeight)
  }, [])

  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: false, // Need false for paddingTop animation
    listener: (event: any) => {
      const currentScrollY = event.nativeEvent.contentOffset.y
      const scrollDiff = currentScrollY - lastScrollY.current
      lastScrollY.current = currentScrollY

      // Calculate header height
      const headerHeight = spacing.xxl * 2 + spacing.md + 40 + spacing.md

      if (scrollDiff > 5 && currentScrollY > 50) {
        // Scrolling down - hide header and reduce padding, fade tab bar
        Animated.parallel([
          Animated.timing(headerTranslateY, {
            toValue: -200,
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
    paddingTop: spacing.xxl * 2,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[800],
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.black,
    gap: spacing.sm,
    zIndex: 20,
    elevation: 20,
    overflow: "visible",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  title: {
    ...typography.h1,
    fontSize: 32,
      color: colors.white,
  },
  headerActions: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
      backgroundColor: isDark ? colors.gray[800] : colors.black,
  },
  filterButtonWrapper: {
    position: "relative",
  },
  filterText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
  filterChevron: {
    ...typography.caption,
    color: colors.gray[400],
  },
  filterCTA: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
      backgroundColor: isDark ? colors.gray[800] : colors.black,
    minHeight: 40,
  },
  filterCTAText: {
    ...typography.bodyBold,
      color: colors.white,
  },
  filterMenu: {
    position: "absolute",
    top: "100%",
    right: 0,
    backgroundColor: colors.gray[900],
    borderRadius: 12,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.gray[700],
    width: 140,
    zIndex: 1000,
    elevation: 12,
    marginTop: spacing.xs,
  },
  filterOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  filterOptionText: {
    ...typography.body,
    color: colors.gray[400],
  },
  filterOptionTextActive: {
    color: colors.white,
  },
  content: {
    flex: 1,
    // No marginTop - header overlays content
  },
  contentContainer: {
    paddingBottom: spacing.xxl * 3,
  },
  daySection: {
    marginBottom: spacing.xl,
  },
  dateHeader: {
      ...typography.h2,
      fontSize: 22,
    marginBottom: spacing.xl,
      marginHorizontal: spacing.lg,
    flexDirection: "row",
  },
  dateHeaderDay: {
      fontFamily: "LibreBaskerville-Bold",
      fontSize: 22,
      lineHeight: 32,
      color: isDark ? colors.white : colors.white, // In light mode, colors.white is #000000 (black), in dark mode it's white
  },
  dateHeaderDate: {
      ...typography.h2,
      fontSize: 22,
    color: colors.gray[300],
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.xxl * 2,
  },
  placeholderText: {
    ...typography.body,
    color: colors.gray[500],
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.white,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.gray[400],
    textAlign: "center",
  },
  emptyButtonFull: {
    width: "100%",
    marginTop: spacing.sm,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.black,
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
      color: colors.white,
  },
  modalCloseButton: {
    padding: spacing.sm,
  },
  modalClose: {
    ...typography.bodyBold,
    fontSize: 24,
    color: colors.white,
  },
  modalContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  modalSection: {
    ...typography.bodyMedium,
    fontSize: 14,
    color: colors.gray[500],
    marginTop: spacing.sm,
  },
  modalSectionSpacing: {
    marginTop: spacing.lg,
  },
  selectionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  selectionCard: {
    width: "48%",
    backgroundColor: colors.gray[900],
    borderRadius: 16,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    gap: spacing.sm,
  },
  selectionCardActive: {
    borderWidth: 1,
    borderColor: colors.white,
  },
  selectionLabel: {
    ...typography.bodyMedium,
    color: colors.white,
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
    backgroundColor: colors.gray[900],
    borderRadius: 16,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    width: "100%",
  },
  memorialRowActive: {
    borderWidth: 1,
    borderColor: colors.white,
  },
  memorialName: {
    ...typography.bodyMedium,
    color: colors.white,
    fontSize: 16,
  },
  periodBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.gray[900],
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[800],
  },
  periodBannerTitle: {
    ...typography.bodyBold,
    color: colors.white,
  },
  periodBannerSubtitle: {
    ...typography.caption,
    color: colors.gray[400],
  },
  periodBannerAction: {
    padding: spacing.xs,
  },
  periodBannerClear: {
    ...typography.bodyMedium,
    color: colors.accent,
  },
  periodGrid: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  periodCard: {
    overflow: "hidden",
  },
  periodBackground: {
    height: 220,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  periodImage: {
    // No borderRadius - square edges
  },
  periodFallback: {
    backgroundColor: colors.gray[800],
  },
  periodShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  periodOverlay: {
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  periodTitle: {
    ...typography.bodyBold,
    fontSize: 24,
    color: colors.white,
  },
  periodSubtitle: {
    ...typography.caption,
    fontSize: 16,
    color: colors.gray[100],
  },
  periodCount: {
    ...typography.caption,
    fontSize: 14,
    color: colors.gray[200],
  },
  birthdayCardEntry: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.gray[900],
    borderRadius: 12,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  birthdayCardEntryContent: {
    flex: 1,
  },
  birthdayCardEntryTitle: {
    ...typography.bodyBold,
    fontSize: 16,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  birthdayCardEntrySubtitle: {
    ...typography.body,
    fontSize: 14,
    color: colors.gray[400],
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
  }), [colors, isDark])

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            transform: [{ translateY: headerTranslateY }],
          },
        ]}
      >
        <View style={styles.headerTop}>
          <Text style={styles.title}>History</Text>
          <View style={styles.headerActions}>
            <View style={styles.filterButtonWrapper}>
              <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilter((prev) => !prev)}>
                <Text style={styles.filterText}>{viewMode}</Text>
                <Text style={styles.filterChevron}>▼</Text>
              </TouchableOpacity>
              {showFilter && (
                <View style={styles.filterMenu}>
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
            </View>
            <TouchableOpacity style={styles.filterCTA} onPress={() => setShowFilterModal(true)}>
              <FontAwesome name="sliders" size={16} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {activePeriod && (
        <View style={styles.periodBanner}>
          <View>
            <Text style={styles.periodBannerTitle}>{activePeriod.title}</Text>
            <Text style={styles.periodBannerSubtitle}>{activePeriod.subtitle}</Text>
          </View>
          <TouchableOpacity onPress={() => setActivePeriod(null)} style={styles.periodBannerAction}>
            <Text style={styles.periodBannerClear}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal
        animationType="slide"
        visible={showFilterModal}
        onRequestClose={() => setShowFilterModal(false)}
        presentationStyle="fullScreen"
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top + spacing.lg }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filters</Text>
            <TouchableOpacity onPress={() => setShowFilterModal(false)} style={styles.modalCloseButton}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalSection}>Group Members</Text>
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
                <Text style={[styles.modalSection, styles.modalSectionSpacing]}>Memorials</Text>
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
                <Text style={[styles.modalSection, styles.modalSectionSpacing]}>Question Decks</Text>
                <View style={styles.selectionGrid}>
                  {availableDecks.map((deck, index) => {
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
        </View>
      </Modal>

      {/* Content */}
      <Animated.ScrollView
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
        
        {entriesLoading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Loading...</Text>
          </View>
        ) : filteredEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No history yet.</Text>
            <Text style={styles.emptySubtitle}>
              As you and your group answer questions we&apos;ll build your story here.
            </Text>
            <Button title="Answer Question" onPress={handleAnswerToday} style={styles.emptyButtonFull} />
            <Button title="Invite Group" onPress={handleInvite} variant="secondary" style={styles.emptyButtonFull} />
          </View>
        ) : viewMode === "Days" ? (
          <>
            {Object.entries(entriesByDate).map(([date, dateEntries]) => {
              const entries = dateEntries as any[]
              return (
              <View key={date} style={styles.daySection}>
                <View style={styles.dateHeader}>
                  <Text style={styles.dateHeaderDay}>{format(parseISO(date), "EEEE")}</Text>
                  <Text style={styles.dateHeaderDate}>, {format(parseISO(date), "d MMMM yyyy")}</Text>
                </View>
                {entries.map((entry: any, entryIndex: number) => {
                  // Handle birthday card entries specially
                  if (entry.is_birthday_card) {
                    return (
                      <TouchableOpacity
                        key={entry.id}
                        style={styles.birthdayCardEntry}
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
                        <View style={styles.birthdayCardEntryContent}>
                          <Text style={styles.birthdayCardEntryTitle}>🎂 Birthday Card</Text>
                          <Text style={styles.birthdayCardEntrySubtitle}>Tap to view your birthday card</Text>
                        </View>
                        <FontAwesome name="chevron-right" size={16} color={colors.gray[400]} />
                      </TouchableOpacity>
                    )
                  }
                  
                  const entryIdList = entries.map((item: any) => item.id)
                  return (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      entryIds={entryIdList}
                      index={entryIndex}
                      returnTo="/(main)/history"
                    />
                  )
                })}
      </View>
              )
            })}
          </>
        ) : viewMode === "Weeks" ? (
          renderPeriodGrid(weekSummaries, "Weeks")
        ) : viewMode === "Months" ? (
          renderPeriodGrid(monthSummaries, "Months")
        ) : (
          renderPeriodGrid(yearSummaries, "Years")
        )}
      </Animated.ScrollView>
    </View>
  )
}

