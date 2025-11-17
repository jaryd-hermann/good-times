"use client"

import { useMemo, useState, useEffect, useRef, useCallback } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, ImageBackground, Animated, Dimensions } from "react-native"
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "../../lib/supabase"
import AsyncStorage from "@react-native-async-storage/async-storage"
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
import { colors, typography, spacing } from "../../lib/theme"
import { FilmFrame } from "../../components/FilmFrame"
import { truncateText } from "../../lib/utils"
import { getGroupMembers, getAllPrompts, getDailyPrompt } from "../../lib/db"
import { Avatar } from "../../components/Avatar"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Button } from "../../components/Button"
import { getTodayDate } from "../../lib/utils"
import { FontAwesome } from "@expo/vector-icons"
import { EmbeddedPlayer } from "../../components/EmbeddedPlayer"
import type { EmbeddedMedia } from "../../lib/types"

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
  const [viewMode, setViewMode] = useState<ViewMode>("Days")
  const [showFilter, setShowFilter] = useState(false)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [currentGroupId, setCurrentGroupId] = useState<string>()
  const [userId, setUserId] = useState<string>()
  const [activePeriod, setActivePeriod] = useState<ActivePeriod | null>(null)
  const insets = useSafeAreaInsets()
  const scrollY = useRef(new Animated.Value(0)).current
  const headerTranslateY = useRef(new Animated.Value(0)).current
  const contentPaddingTop = useRef(new Animated.Value(0)).current
  const lastScrollY = useRef(0)

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

  const { data: members = [] } = useQuery({
    queryKey: ["history-members", currentGroupId],
    queryFn: () => (currentGroupId ? getGroupMembers(currentGroupId) : []),
    enabled: !!currentGroupId,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ["history-categories"],
    queryFn: async () => {
      const prompts = await getAllPrompts()
      const unique = new Set<string>()
      prompts.forEach((prompt) => {
        if (prompt.category) unique.add(prompt.category)
      })
      return Array.from(unique)
    },
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

  const filteredEntries = useMemo(
    () =>
      entriesWithinPeriod.filter((entry) => {
        const category = entry.prompt?.category ?? ""

        if (selectedCategories.length > 0 && (!category || !selectedCategories.includes(category))) {
          return false
        }
        if (selectedMembers.length > 0 && !selectedMembers.includes(entry.user_id)) {
          return false
        }
        return true
      }),
    [entriesWithinPeriod, selectedCategories, selectedMembers],
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
  const entriesByDate = filteredEntries.reduce(
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
        // Scrolling down - hide header and reduce padding
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
        ]).start()
      } else if (scrollDiff < -5) {
        // Scrolling up - show header and restore padding
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
        ]).start()
      }
    },
  })

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

            <Text style={[styles.modalSection, styles.modalSectionSpacing]}>Question Categories</Text>
            <View style={styles.selectionGrid}>
              {categories.map((category) => {
                const isSelected = selectedCategories.includes(category)
                return (
                  <TouchableOpacity
                    key={category}
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
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
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
                <Text style={styles.dateHeader}>{format(parseISO(date), "EEEE, d MMMM yyyy")}</Text>
                {entries.map((entry: any, entryIndex: number) => {
                  const entryIdList = entries.map((item: any) => item.id)
                  return (
                    <TouchableOpacity
                      key={entry.id}
                      onPress={() =>
                        handleEntryPress(entry.id, {
                          entryIds: entryIdList,
                          index: entryIndex,
                        })
                      }
                    >
                    <View style={styles.entryWrapper}>
                      <View style={styles.filmFrameWrapper}>
                        <Image source={require("../../assets/images/film-frame.png")} style={styles.filmFrameImage} />
                        <FilmFrame style={styles.entryCardInner} contentStyle={styles.entryContent}>
                          <View style={styles.entryHeader}>
                            <View style={styles.entryAuthor}>
                              <Avatar uri={entry.user?.avatar_url} name={entry.user?.name || "User"} size={28} />
                              <Text style={styles.userName}>{entry.user?.name}</Text>
                            </View>
                            <Text style={styles.time}>{format(parseISO(entry.created_at), "h:mm a")}</Text>
                          </View>
                          <Text style={styles.question}>{entry.prompt?.question}</Text>
                          {/* Song shared badge */}
                          {entry.embedded_media && entry.embedded_media.length > 0 && (
                            <View style={styles.songBadge}>
                              <FontAwesome name="play" size={12} color={colors.white} />
                              <Text style={styles.songBadgeText}>
                                {entry.user?.name || "User"} shared a song with you
                              </Text>
                            </View>
                          )}
                          {entry.text_content && (
                            <View style={[
                              styles.textContainer,
                              (!entry.media_urls || entry.media_urls.length === 0) && (!entry.embedded_media || entry.embedded_media.length === 0) && styles.textContainerNoMedia
                            ]}>
                              <Text 
                                style={styles.entryText} 
                                numberOfLines={(entry.media_urls && entry.media_urls.length > 0) || (entry.embedded_media && entry.embedded_media.length > 0) ? 10 : undefined}
                                ellipsizeMode={(entry.media_urls && entry.media_urls.length > 0) || (entry.embedded_media && entry.embedded_media.length > 0) ? "tail" : undefined}
                              >
                                {entry.text_content}
                              </Text>
                              {/* Show fade 2 lines above media if media exists */}
                              {((entry.media_urls && entry.media_urls.length > 0) || (entry.embedded_media && entry.embedded_media.length > 0)) && entry.text_content && entry.text_content.length > 200 && (
                                <View style={styles.textFadeAboveMedia} pointerEvents="none" />
                              )}
                              {/* Show fade at bottom if no media and text is long */}
                              {(!entry.media_urls || entry.media_urls.length === 0) && (!entry.embedded_media || entry.embedded_media.length === 0) && entry.text_content && entry.text_content.length > 200 && (
                                <View style={styles.textFadeBottom} pointerEvents="none" />
                              )}
                            </View>
                          )}
                          {/* Embedded media inline with text */}
                          {entry.embedded_media && entry.embedded_media.length > 0 && (
                            <View style={styles.embeddedMediaContainer}>
                              {entry.embedded_media.map((embed: EmbeddedMedia, embedIndex: number) => (
                                <EmbeddedPlayer
                                  key={`${embed.platform}-${embed.embedId}-${embedIndex}`}
                                  embed={{
                                    platform: embed.platform,
                                    url: embed.url,
                                    embedId: embed.embedId,
                                    embedType: embed.embedType,
                                    embedUrl: embed.embedUrl,
                                  }}
                                />
                              ))}
                            </View>
                          )}
                          <View style={styles.mediaContainer}>
                            {entry.media_urls && Array.isArray(entry.media_urls) && entry.media_urls.length > 0 && (
                              <ScrollView 
                                horizontal 
                                showsHorizontalScrollIndicator={false}
                                style={styles.mediaCarousel}
                                contentContainerStyle={styles.mediaCarouselContent}
                                nestedScrollEnabled={true}
                              >
                                {entry.media_urls.map((url: string, idx: number) => {
                                  const mediaType = entry.media_types && Array.isArray(entry.media_types) 
                                    ? entry.media_types[idx] 
                                    : undefined
                                  
                                  if (mediaType === "audio") {
                                    return (
                                      <View key={`audio-${idx}-${url}`} style={styles.audioThumbnailSquare}>
                                        {entry.user?.avatar_url ? (
                                          <>
                                            <Image 
                                              source={{ uri: entry.user.avatar_url }} 
                                              style={styles.audioThumbnailImage}
                                              resizeMode="cover"
                                            />
                                            <View style={styles.audioThumbnailOverlay} />
                                          </>
                                        ) : null}
                                        <View style={styles.audioThumbnailContent}>
                                          <FontAwesome name="play" size={20} color={colors.white} />
                                          <Text style={styles.audioThumbnailLabel} numberOfLines={2}>
                                            {entry.user?.name || "User"} left a voice message
                                          </Text>
                                        </View>
                                      </View>
                                    )
                                  }
                                  
                                  if (mediaType === "video") {
                                    return (
                                      <View key={`video-${idx}-${url}`} style={styles.videoThumbnailSquare}>
                                        <FontAwesome name="video-camera" size={20} color={colors.white} />
                                      </View>
                                    )
                                  }
                                  
                                  // Default to photo
                                  return (
                                    <Image
                                      key={`photo-${idx}-${url}`}
                                      source={{ uri: url }}
                                      style={styles.mediaThumbnail}
                                      resizeMode="cover"
                                    />
                                  )
                                })}
                              </ScrollView>
                            )}
                          </View>
                        </FilmFrame>
                      </View>
                      {commentsByEntry[entry.id] && commentsByEntry[entry.id].length > 0 && (
                        <TouchableOpacity 
                          style={styles.commentPreview}
                          onPress={() => {
                            handleEntryPress(entry.id, {
                              entryIds: entryIdList,
                              index: entryIndex,
                              scrollToComments: true,
                            })
                          }}
                        >
                          {commentsByEntry[entry.id].slice(0, 2).map((comment) => (
                            <View key={comment.id} style={styles.commentPreviewItem}>
                              <Avatar uri={comment.user?.avatar_url} name={comment.user?.name || "User"} size={16} />
                              <Text style={styles.commentPreviewUser}>{comment.user?.name}: </Text>
                              <Text style={styles.commentPreviewText} numberOfLines={1}>
                                {comment.text}
                              </Text>
                            </View>
                          ))}
                          {commentsByEntry[entry.id].length > 2 && (
                            <Text style={styles.commentPreviewMore}>
                              +{commentsByEntry[entry.id].length - 2} more
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                    </TouchableOpacity>
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

const styles = StyleSheet.create({
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
    backgroundColor: colors.gray[800],
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
    backgroundColor: colors.gray[800],
    minHeight: 40,
  },
  filterCTAText: {
    ...typography.bodyBold,
    color: colors.black,
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
    paddingHorizontal: spacing.md,
  },
  dateHeader: {
    ...typography.h3,
    fontSize: 18,
    marginBottom: spacing.xl,
    color: colors.gray[300],
  },
  entryCard: {
    marginBottom: spacing.lg,
    width: "100%",
    alignItems: "center",
  },
  entryWrapper: {
    marginBottom: spacing.lg,
    width: "100%",
  },
  entryCardInner: {
    width: 399,
    height: 485,
  },
  entryContent: {
    padding: spacing.lg,
    paddingBottom: 0, // Remove bottom padding so media touches bottom
    gap: spacing.sm,
    backgroundColor: "#0C0E1A",
    flex: 1,
    justifyContent: "space-between",
  },
  textContainer: {
    position: "relative",
    marginBottom: spacing.xl,
    paddingBottom: spacing.lg,
  },
  textContainerNoMedia: {
    flex: 1, // Allow text to fill available space when no media
  },
  textFadeAboveMedia: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 40, // 2 lines worth of fade
    backgroundColor: "#0C0E1A",
    opacity: 0.9,
  },
  textFadeBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 40, // 2 lines worth of fade
    backgroundColor: "#0C0E1A",
    opacity: 0.9,
  },
  mediaContainer: {
    marginTop: "auto",
    alignSelf: "stretch",
    marginBottom: 0,
    position: "relative",
    marginLeft: -spacing.lg, // Negative margin to align with entryContent padding
    marginRight: -spacing.lg,
  },
  mediaCarousel: {
    width: "100%",
  },
  mediaCarouselContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 2, // Very little gap between items
    paddingLeft: spacing.lg, // Start at left edge of entryContent
    paddingBottom: 0, // No bottom padding - touch bottom of container
  },
  audioThumbnail: {
    backgroundColor: colors.gray[900],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  audioThumbnailSquare: {
    width: 158, // Square thumbnail - same as other media
    height: 158, // Square thumbnail - same as width
    backgroundColor: colors.gray[800],
    justifyContent: "center",
    alignItems: "center",
    marginRight: 0,
    marginLeft: 0,
    flexShrink: 0, // Prevent shrinking in ScrollView
    position: "relative",
    overflow: "hidden",
  },
  audioThumbnailImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  audioThumbnailOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  audioThumbnailContent: {
    position: "relative",
    zIndex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
    gap: spacing.xs,
  },
  audioThumbnailLabel: {
    ...typography.caption,
    color: colors.white,
    fontSize: 10,
    textAlign: "center",
  },
  commentPreview: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  commentPreviewItem: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.xs,
  },
  commentPreviewUser: {
    ...typography.bodyMedium,
    fontSize: 12,
    color: colors.gray[300],
  },
  commentPreviewText: {
    ...typography.body,
    fontSize: 12,
    color: colors.gray[400],
    flex: 1,
  },
  commentPreviewMore: {
    ...typography.caption,
    fontSize: 11,
    color: colors.gray[500],
    marginTop: spacing.xs,
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  entryAuthor: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexShrink: 1,
  },
  userName: {
    ...typography.bodyBold,
    fontSize: 14,
  },
  time: {
    ...typography.caption,
    fontSize: 12,
  },
  question: {
    ...typography.h3,
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  entryText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.gray[300],
  },
  filmFrameWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginBottom: spacing.lg,
  },
  filmFrameImage: {
    position: "absolute",
    width: "135%",
    height: 501,
    resizeMode: "contain",
    zIndex: 1,
    pointerEvents: "none",
  },
  mediaThumbnail: {
    width: 158, // Square thumbnail
    height: 158, // Square thumbnail - same as width
    backgroundColor: colors.gray[900],
    marginRight: 0,
    marginLeft: 0,
    flexShrink: 0, // Prevent shrinking in ScrollView
    overflow: "hidden", // Ensure images are cropped to square
  },
  videoThumbnailSquare: {
    width: 158, // Square thumbnail - same as other media
    height: 158, // Square thumbnail - same as width
    backgroundColor: colors.gray[800],
    justifyContent: "center",
    alignItems: "center",
    marginRight: 0,
    marginLeft: 0,
    flexShrink: 0, // Prevent shrinking in ScrollView
  },
  mediaMoreIndicator: {
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  mediaMoreText: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.white,
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
  embeddedMediaContainer: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  songBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.black,
    borderWidth: 1,
    borderColor: colors.white,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 16,
    alignSelf: "flex-start",
    marginBottom: spacing.sm,
  },
  songBadgeText: {
    ...typography.caption,
    color: colors.white,
    fontSize: 11,
  },
})

