"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "../../../lib/supabase"
import { getEntryById, getReactions, getComments, toggleReaction, createComment, getAllEntriesForGroup, getMemorials, getGroupMembers } from "../../../lib/db"
import { typography, spacing } from "../../../lib/theme"
import { useTheme } from "../../../lib/theme-context"
import { Avatar } from "../../../components/Avatar"
import { formatTime, getTodayDate } from "../../../lib/utils"
import { Video, Audio, ResizeMode } from "expo-av"
import { getCurrentUser } from "../../../lib/db"
import { FontAwesome } from "@expo/vector-icons"
import { EmbeddedPlayer } from "../../../components/EmbeddedPlayer"
import type { EmbeddedMedia } from "../../../lib/types"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { personalizeMemorialPrompt, replaceDynamicVariables } from "../../../lib/prompts"
import { usePostHog } from "posthog-react-native"
import { captureEvent } from "../../../lib/posthog"
import { PhotoLightbox } from "../../../components/PhotoLightbox"

export default function EntryDetail() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const queryClient = useQueryClient()
  const { colors, isDark } = useTheme()
  const entryId = params.entryId as string
  const rawEntryIds = params.entryIds as string | undefined
  const entryIds = useMemo(() => {
    if (!rawEntryIds) return []
    try {
      const parsed = JSON.parse(rawEntryIds)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }, [rawEntryIds])
  const currentIndex = params.index ? Number(params.index) : undefined
  const nextIndex = typeof currentIndex === "number" ? currentIndex + 1 : undefined
  const nextEntryId = typeof nextIndex === "number" && nextIndex < entryIds.length ? entryIds[nextIndex] : undefined
  const returnTo = (params.returnTo as string) || undefined
  const scrollToComments = params.scrollToComments === "true"
  const scrollViewRef = useRef<ScrollView>(null)
  const [userId, setUserId] = useState<string>()
  const [commentText, setCommentText] = useState("")
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | undefined>()
  const [currentUserName, setCurrentUserName] = useState("You")
  const audioRefs = useRef<Record<string, Audio.Sound>>({})
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null)
  const [audioProgress, setAudioProgress] = useState<Record<string, number>>({})
  const [audioDurations, setAudioDurations] = useState<Record<string, number>>({})
  const [audioLoading, setAudioLoading] = useState<Record<string, boolean>>({})
  const [imageDimensions, setImageDimensions] = useState<Record<number, { width: number; height: number }>>({})
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [lightboxVisible, setLightboxVisible] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const insets = useSafeAreaInsets()
  const posthog = usePostHog()

  // Listen to keyboard events to adjust comment input position on Android
  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", (e) => {
      setKeyboardHeight(e.endCoordinates.height)
    })
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardHeight(0)
    })

    return () => {
      showSubscription.remove()
      hideSubscription.remove()
    }
  }, [])

  // Load entry data first
  const { data: entry } = useQuery({
    queryKey: ["entry", entryId],
    queryFn: () => getEntryById(entryId),
    enabled: !!entryId,
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
  })

  // Invalidate memorial name usage cache when entry loads to ensure fresh data
  useEffect(() => {
    if (entry?.group_id) {
      queryClient.invalidateQueries({ 
        queryKey: ["memorialNameUsage", entry.group_id],
        exact: false 
      })
    }
  }, [entry?.group_id, queryClient])

  // Track viewed_entry event when entry loads
  useEffect(() => {
    if (entry && userId) {
      try {
        const isOwnEntry = entry.user_id === userId
        if (posthog) {
          posthog.capture("viewed_entry", {
            entry_id: entry.id,
            prompt_id: entry.prompt_id,
            group_id: entry.group_id,
            date: entry.date,
            is_own_entry: isOwnEntry,
          })
        } else {
          captureEvent("viewed_entry", {
            entry_id: entry.id,
            prompt_id: entry.prompt_id,
            group_id: entry.group_id,
            date: entry.date,
            is_own_entry: isOwnEntry,
          })
        }
      } catch (error) {
        if (__DEV__) console.error("[entry-detail] Failed to track viewed_entry:", error)
      }
    }
  }, [entry, userId, posthog])

  useEffect(() => {
    return () => {
      const sounds = Object.values(audioRefs.current)
      sounds.forEach((sound) => {
        sound.unloadAsync().catch(() => {
          /* noop */
        })
      })
    }
  }, [])

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const profile = await getCurrentUser()
        if (profile) {
          setCurrentUserAvatar(profile.avatar_url || undefined)
          setCurrentUserName(profile.name || "You")
        }
      }
    }
    loadUser()
  }, [])

  // Fetch all entries for the group to enable Next navigation through history
  const { data: allGroupEntries = [] } = useQuery({
    queryKey: ["allGroupEntries", entry?.group_id],
    queryFn: () => (entry?.group_id ? getAllEntriesForGroup(entry.group_id) : []),
    enabled: !!entry?.group_id,
  })

  // Build chronological entry list for navigation (newest first, then by created_at)
  const chronologicalEntryIds = useMemo(() => {
    if (allGroupEntries.length === 0) {
      // Fallback to provided entryIds if available
      return entryIds.length > 0 ? entryIds : []
    }
    // Sort: date descending, then created_at descending (newest first)
    const sorted = [...allGroupEntries].sort((a, b) => {
      const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime()
      if (dateCompare !== 0) return dateCompare
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return sorted.map((e) => e.id)
  }, [allGroupEntries, entryIds])

  // Find current entry index in chronological list
  const currentChronologicalIndex = useMemo(() => {
    if (!entryId || chronologicalEntryIds.length === 0) return undefined
    return chronologicalEntryIds.indexOf(entryId)
  }, [entryId, chronologicalEntryIds])

  // Determine next entry ID (use chronological list if available, otherwise fallback to provided entryIds)
  const effectiveEntryIds = chronologicalEntryIds.length > 0 ? chronologicalEntryIds : entryIds
  const effectiveCurrentIndex = currentChronologicalIndex !== undefined && currentChronologicalIndex >= 0 
    ? currentChronologicalIndex 
    : currentIndex
  const effectiveNextIndex = typeof effectiveCurrentIndex === "number" ? effectiveCurrentIndex + 1 : undefined
  const effectiveNextEntryId = typeof effectiveNextIndex === "number" && effectiveNextIndex < effectiveEntryIds.length 
    ? effectiveEntryIds[effectiveNextIndex] 
    : undefined

  const { data: reactions = [] } = useQuery({
    queryKey: ["reactions", entryId],
    queryFn: () => getReactions(entryId),
    enabled: !!entryId,
  })

  const { data: comments = [] } = useQuery({
    queryKey: ["comments", entryId],
    queryFn: () => getComments(entryId),
    enabled: !!entryId,
  })

  // Fetch memorials and members for variable replacement
  const { data: memorials = [] } = useQuery({
    queryKey: ["memorials", entry?.group_id],
    queryFn: () => (entry?.group_id ? getMemorials(entry.group_id) : []),
    enabled: !!entry?.group_id && !!entry?.prompt?.question?.match(/\{.*memorial_name.*\}/i),
  })

  const { data: members = [] } = useQuery({
    queryKey: ["members", entry?.group_id],
    queryFn: () => (entry?.group_id ? getGroupMembers(entry.group_id) : []),
    enabled: !!entry?.group_id && !!entry?.prompt?.question?.match(/\{.*member_name.*\}/i),
  })

  // Fetch prompt_name_usage to determine which memorial was actually used
  // Include entry.date in query key to ensure cache is date-specific and fresh
  const { data: memorialNameUsage = [] } = useQuery({
    queryKey: ["memorialNameUsage", entry?.group_id, entry?.date],
    queryFn: async () => {
      if (!entry?.group_id) return []
      const { data, error } = await supabase
        .from("prompt_name_usage")
        .select("prompt_id, date_used, name_used, created_at")
        .eq("group_id", entry.group_id)
        .eq("variable_type", "memorial_name")
        .order("created_at", { ascending: true }) // Order by creation time - prefer earliest (correct) record
      if (error) {
        console.error("[entry-detail] Error fetching memorial name usage:", error)
        return []
      }
      if (__DEV__) {
        console.log(`[entry-detail] Fetched ${data?.length || 0} memorial name usage records for group ${entry.group_id}`)
        console.log(`[entry-detail] Records:`, data)
      }
      return (data || []) as Array<{ prompt_id: string; date_used: string; name_used: string; created_at: string }>
    },
    enabled: !!entry?.group_id && !!entry?.prompt?.question?.match(/\{.*memorial_name.*\}/i),
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
    gcTime: 0, // Don't cache - always fetch fresh to prevent stale data
  })

  // Helper function to calculate day index (same logic as in lib/db.ts)
  const getDayIndex = (dateString: string, groupId: string): number => {
    const base = new Date(dateString)
    const start = new Date("2020-01-01")
    const diff = Math.floor((base.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    const groupOffset = groupId ? groupId.length : 0
    return diff + groupOffset
  }

  // Create a map of prompt_id + date -> memorial name used
  // CRITICAL: If multiple records exist for same key (duplicates), prefer the FIRST one encountered
  // Since we order by created_at ascending, the first one is the earliest (correct) record
  // This is a safety measure in case duplicate records exist in the database
  const memorialUsageMap = useMemo(() => {
    const map = new Map<string, string>()
    memorialNameUsage.forEach((usage) => {
      const normalizedDate = usage.date_used.split('T')[0]
      const key = `${usage.prompt_id}-${normalizedDate}`
      
      // Only set if key doesn't exist - this means we prefer the FIRST record (earliest created_at)
      // This ensures we use the correct memorial even if duplicates exist
      if (!map.has(key)) {
        map.set(key, usage.name_used)
      } else {
        // Duplicate detected - log warning but keep the first one (which is correct)
        if (__DEV__) {
          console.warn(`[entry-detail] Duplicate prompt_name_usage detected for ${key}. Using first record: ${map.get(key)} instead of ${usage.name_used}`)
        }
      }
    })
    return map
  }, [memorialNameUsage])

  // Function to determine which memorial was used for this prompt on this date
  const getMemorialForPrompt = useMemo(() => {
    return (promptId: string, date: string, groupId: string): string | null => {
      // First check if we have usage data
      const normalizedDate = date.split('T')[0]
      const usageKey = `${promptId}-${normalizedDate}`
      const memorialNameUsed = memorialUsageMap.get(usageKey)
      if (memorialNameUsed) {
        return memorialNameUsed
      }

      // Fallback: calculate which memorial would have been used using the same logic
      if (memorials.length === 0) return null

      const recentUsage = memorialNameUsage
        .filter(u => u.prompt_id === promptId)
        .sort((a, b) => {
          const dateA = new Date(a.date_used).getTime()
          const dateB = new Date(b.date_used).getTime()
          return dateB - dateA
        })
        .slice(0, memorials.length)
        .map(u => u.name_used)
      
      const usedNames = new Set(recentUsage)
      const unusedMemorials = memorials.filter((m) => !usedNames.has(m.name))
      const availableMemorials = unusedMemorials.length > 0 ? unusedMemorials : memorials
      
      const dayIndex = getDayIndex(date, groupId)
      const memorialIndex = dayIndex % availableMemorials.length
      const selectedMemorial = availableMemorials[memorialIndex]
      
      return selectedMemorial.name
    }
  }, [memorials, memorialNameUsage, memorialUsageMap])

  // Personalize prompt question with variables
  const personalizedQuestion = useMemo(() => {
    if (!entry?.prompt?.question) return entry?.prompt?.question
    
    let question = entry.prompt.question
    const variables: Record<string, string> = {}
    
    // Handle memorial_name variable - use the CORRECT memorial that was actually used
    if (question.match(/\{.*memorial_name.*\}/i) && entry?.group_id && entry?.prompt_id && entry?.date) {
      const memorialNameUsed = getMemorialForPrompt(entry.prompt_id, entry.date, entry.group_id)
      
      // Debug logging
      if (__DEV__) {
        console.log(`[entry-detail] Personalizing question:`, {
          promptId: entry.prompt_id,
          date: entry.date,
          groupId: entry.group_id,
          memorialNameUsed,
          memorialUsageMapSize: memorialUsageMap.size,
          memorialNameUsageCount: memorialNameUsage.length,
        })
      }
      
      if (memorialNameUsed) {
        question = personalizeMemorialPrompt(question, memorialNameUsed)
        if (__DEV__) {
          console.log(`[entry-detail] Personalized with: ${memorialNameUsed}`)
        }
      } else if (memorials.length > 0) {
        // Fallback if we can't determine (shouldn't happen, but safety)
        console.warn(`[entry-detail] Could not determine memorial for prompt ${entry.prompt_id} on ${entry.date}, using first memorial`)
        question = personalizeMemorialPrompt(question, memorials[0].name)
      }
    } else if (question.includes("Gumbo") || question.includes("Amelia")) {
      // CRITICAL: If the question already has a name in it (shouldn't happen, but if it does, log it)
      console.error(`[entry-detail] Question already contains a name! Question: ${question.substring(0, 100)}`)
    }
    
    // Handle member_name variable
    if (question.match(/\{.*member_name.*\}/i) && members.length > 0) {
      // For now, use first member (could be improved to cycle)
      variables.member_name = members[0].user?.name || "them"
      question = replaceDynamicVariables(question, variables)
    }
    
    return question
  }, [entry?.prompt?.question, entry?.group_id, entry?.prompt_id, entry?.date, memorials, members, getMemorialForPrompt, memorialUsageMap, memorialNameUsage])

  const commentsSectionRef = useRef<View>(null)

  // Scroll to comments section if scrollToComments is true
  useEffect(() => {
    if (scrollToComments && scrollViewRef.current && commentsSectionRef.current) {
      setTimeout(() => {
        commentsSectionRef.current?.measureLayout(
          scrollViewRef.current as any,
          (x, y) => {
            scrollViewRef.current?.scrollTo({ y: y - 100, animated: true })
          },
          () => {
            // Fallback to scrollToEnd if measureLayout fails
            scrollViewRef.current?.scrollToEnd({ animated: true })
          }
        )
      }, 800)
    }
  }, [scrollToComments, entry])

  const toggleReactionMutation = useMutation({
    mutationFn: () => toggleReaction(entryId, userId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reactions", entryId] })
    },
  })

  const addCommentMutation = useMutation({
    mutationFn: (text: string) => createComment(entryId, userId!, text.trim()),
    onSuccess: (_, text) => {
      queryClient.invalidateQueries({ queryKey: ["comments", entryId] })
      queryClient.invalidateQueries({ queryKey: ["historyComments"] })
      queryClient.invalidateQueries({ queryKey: ["historyEntries"] })
      queryClient.invalidateQueries({ queryKey: ["entries"] })
      
      // Track added_comment event
      if (entry) {
        try {
          if (posthog) {
            posthog.capture("added_comment", {
              entry_id: entryId,
              prompt_id: entry.prompt_id,
              group_id: entry.group_id,
              comment_length: text.trim().length,
            })
          } else {
            captureEvent("added_comment", {
              entry_id: entryId,
              prompt_id: entry.prompt_id,
              group_id: entry.group_id,
              comment_length: text.trim().length,
            })
          }
        } catch (error) {
          if (__DEV__) console.error("[entry-detail] Failed to track added_comment:", error)
        }
      }
      
      setCommentText("")
    },
  })

  const hasLiked = reactions.some((r) => r.user_id === userId)

  function handleBack() {
    if (returnTo) {
      router.replace(returnTo)
      return
    }
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace("/(main)/home")
    }
  }

  function handleNext() {
    if (!effectiveNextEntryId) return
    const params: Record<string, string> = { entryId: effectiveNextEntryId }
    if (returnTo) params.returnTo = returnTo
    // Use chronological entry IDs for navigation
    if (effectiveEntryIds.length > 0) {
      params.entryIds = JSON.stringify(effectiveEntryIds)
      if (typeof effectiveNextIndex === "number") {
        params.index = String(effectiveNextIndex)
      }
    }
    router.replace({
      pathname: "/(main)/modals/entry-detail",
      params,
    })
  }

  async function handleToggleReaction() {
    if (!userId) {
      Alert.alert("Hold on", "You need to be signed in to react to entries.")
      return
    }
    
    // Check if user is adding (not removing) a reaction
    const isAdding = !hasLiked
    
    try {
      await toggleReactionMutation.mutateAsync()
      
      // Track added_reaction event only when adding (not removing)
      if (isAdding && entry) {
        try {
          if (posthog) {
            posthog.capture("added_reaction", {
              entry_id: entryId,
              prompt_id: entry.prompt_id,
              group_id: entry.group_id,
              reaction_type: "heart", // From toggleReaction function
            })
          } else {
            captureEvent("added_reaction", {
              entry_id: entryId,
              prompt_id: entry.prompt_id,
              group_id: entry.group_id,
              reaction_type: "heart",
            })
          }
        } catch (error) {
          if (__DEV__) console.error("[entry-detail] Failed to track added_reaction:", error)
        }
      }
    } catch (error: any) {
      Alert.alert("Reaction error", error.message ?? "Something went wrong while updating your reaction.")
    }
  }

  const canSendComment = Boolean(userId && commentText.trim() && !addCommentMutation.isPending)

  async function handleToggleAudio(id: string, uri: string) {
    try {
      setAudioLoading((prev) => ({ ...prev, [id]: true }))
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      })

      if (activeAudioId && activeAudioId !== id) {
        const previous = audioRefs.current[activeAudioId]
        if (previous) {
          try {
            await previous.stopAsync()
            await previous.setPositionAsync(0)
          } catch {
            // ignore
          }
        }
        setActiveAudioId(null)
      }

      let sound = audioRefs.current[id]
      if (!sound) {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: false },
          (status) => {
            if (!status.isLoaded) return
            if (status.durationMillis) {
              setAudioDurations((prev) => ({ ...prev, [id]: status.durationMillis! }))
            }
            if (status.positionMillis !== undefined) {
              setAudioProgress((prev) => ({ ...prev, [id]: status.positionMillis! }))
            }
            if (status.didJustFinish) {
              setActiveAudioId((current) => (current === id ? null : current))
              setAudioProgress((prev) => ({ ...prev, [id]: status.durationMillis ?? 0 }))
            }
          },
        )
        audioRefs.current[id] = newSound
        sound = newSound
      }

      const status = await sound.getStatusAsync()
      if (status.isLoaded && status.isPlaying) {
        await sound.pauseAsync()
        setActiveAudioId(null)
      } else {
        if (status.isLoaded && status.positionMillis && status.durationMillis && status.positionMillis >= status.durationMillis) {
          await sound.setPositionAsync(0)
        }
        await sound.playAsync()
        setActiveAudioId(id)
      }
    } catch (error: any) {
      Alert.alert("Audio error", error.message ?? "We couldn’t play that memo right now.")
    } finally {
      setAudioLoading((prev) => ({ ...prev, [id]: false }))
    }
  }

  async function handleSubmitComment() {
    if (!userId || !commentText.trim()) return
    try {
      await addCommentMutation.mutateAsync(commentText)
    } catch (error: any) {
      Alert.alert("Comment error", error.message ?? "We couldn’t post your comment.")
    }
  }

  // Create dynamic styles based on theme
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.black,
    },
    containerInner: {
      flex: 1,
      ...(Platform.OS === "android" ? { position: "relative" as const } : {}),
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: spacing.md,
      paddingTop: spacing.xxl * 2,
    },
    navAction: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    navActionDisabled: {
      opacity: 0.4,
    },
    navActionDisabledText: {
      color: colors.gray[500],
    },
    backButton: {
      ...typography.bodyBold,
      color: colors.white,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: spacing.lg,
      paddingBottom: Platform.OS === "android" ? spacing.xxl * 2 + 80 : spacing.xxl * 2, // Extra padding for fixed comment input on Android
    },
    entryHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.lg,
    },
    headerText: {
      marginLeft: spacing.md,
      flex: 1,
    },
    headerTextRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.xs,
    },
    userName: {
      ...typography.bodyBold,
      fontSize: 16, // Match EntryCard size
      color: colors.white,
    },
    editLink: {
      ...typography.bodyMedium,
      fontSize: 14,
      color: colors.accent,
      textDecorationLine: "underline",
    },
    time: {
      ...typography.caption,
      fontSize: 12,
      color: colors.gray[400],
    },
    question: {
      ...typography.h2,
      fontSize: 20,
      marginBottom: spacing.md,
      color: colors.white,
    },
    text: {
      ...typography.body,
      fontSize: 14,
      lineHeight: 22,
      marginBottom: spacing.md,
      color: colors.white, // colors.white is #000000 (black) in light mode, #ffffff (white) in dark mode
    },
    mediaContainer: {
      gap: spacing.xl, // Increased by 150% (from spacing.sm to spacing.xl)
      marginTop: spacing.xs,
      marginBottom: spacing.md,
    },
    mediaImage: {
      width: "100%",
      height: 300, // Fallback height while loading dimensions
    },
    audioPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.gray[900],
      borderRadius: 16,
    },
    audioPillActive: {
      borderWidth: 1,
      borderColor: colors.accent,
    },
    audioIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.gray[800],
      justifyContent: "center",
      alignItems: "center",
    },
    audioInfo: {
      flex: 1,
      gap: spacing.xs,
    },
    audioLabel: {
      ...typography.bodyMedium,
      color: colors.white,
    },
    audioProgressTrack: {
      width: "100%",
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.gray[800],
      overflow: "hidden",
    },
    audioProgressFill: {
      height: "100%",
      backgroundColor: colors.accent,
    },
    audioTime: {
      ...typography.caption,
      color: colors.gray[400],
    },
    videoPlayer: {
      width: "100%",
      height: 280,
      backgroundColor: colors.gray[900],
    },
    reactionsSection: {
      flexDirection: "row",
      gap: spacing.md,
      paddingVertical: spacing.lg,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.gray[800],
    },
    reactionButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: 20,
      backgroundColor: colors.gray[800],
    },
    reactionButtonActive: {
      backgroundColor: colors.accent,
    },
    reactionCount: {
      ...typography.bodyBold,
      fontSize: 14,
      color: colors.white,
    },
    commentsSection: {
      marginTop: spacing.lg,
    },
    commentsTitle: {
      ...typography.h3,
      fontSize: 18,
      marginBottom: spacing.md,
      color: colors.white,
    },
    comment: {
      flexDirection: "row",
      marginBottom: spacing.md,
    },
    commentContent: {
      marginLeft: spacing.sm,
      flex: 1,
    },
    commentUser: {
      ...typography.bodyBold,
      fontSize: 14,
      marginBottom: spacing.xs,
      color: colors.white,
    },
    commentText: {
      ...typography.body,
      fontSize: 14,
      lineHeight: 20,
      color: colors.gray[300],
    },
    fixedCommentInput: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      backgroundColor: colors.black,
      borderTopWidth: 1,
      borderTopColor: colors.gray[800],
    },
    addComment: {
      marginTop: spacing.md,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
    },
    commentInput: {
      flex: 1,
      ...typography.body,
      color: colors.white,
      paddingVertical: 0,
      minHeight: 40,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
    },
    sendButtonDisabled: {
      backgroundColor: colors.gray[700],
    },
    embeddedMediaContainer: {
      marginTop: spacing.md,
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
  }), [colors])

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
      enabled={Platform.OS === "ios"}
    >
      <View style={styles.containerInner}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.navAction}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleNext}
            disabled={!effectiveNextEntryId}
            style={[styles.navAction, !effectiveNextEntryId && styles.navActionDisabled]}
          >
            <Text style={[styles.backButton, !effectiveNextEntryId && styles.navActionDisabledText]}>Next →</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          ref={scrollViewRef} 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {entry && (
            <>
              <View style={styles.entryHeader}>
                <Avatar uri={entry.user?.avatar_url} name={entry.user?.name || "User"} size={48} />
                <View style={styles.headerText}>
                  <View style={styles.headerTextRow}>
                  <Text style={styles.userName}>{entry.user?.name}</Text>
                    {userId === entry.user_id && entry.date === getTodayDate() && (
                      <TouchableOpacity
                        onPress={() => {
                          router.push({
                            pathname: "/(main)/modals/entry-composer",
                            params: {
                              entryId: entry.id,
                              editMode: "true",
                              promptId: entry.prompt_id,
                              date: entry.date,
                              groupId: entry.group_id,
                              returnTo: returnTo || `/(main)/modals/entry-detail?entryId=${entryId}${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ""}`,
                            },
                          })
                        }}
                      >
                        <Text style={styles.editLink}>Edit</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.time}>{formatTime(entry.created_at)}</Text>
                </View>
              </View>

              <Text style={styles.question}>{personalizedQuestion || entry.prompt?.question}</Text>

              {entry.text_content && <Text style={styles.text}>{entry.text_content}</Text>}

              {/* Embedded media (Spotify/Soundcloud) */}
              {entry.embedded_media && entry.embedded_media.length > 0 && (
                <View style={styles.embeddedMediaContainer}>
                  {entry.embedded_media.map((embed: EmbeddedMedia, index: number) => (
                    <EmbeddedPlayer
                      key={`${embed.platform}-${embed.embedId}-${index}`}
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

              {entry.media_urls && entry.media_urls.length > 0 && (
                <View style={styles.mediaContainer}>
                  {/* Voice memos first */}
                  {entry.media_urls.map((url, index) => {
                    const mediaType = entry.media_types?.[index]
                    if (mediaType === "audio") {
                      const audioId = `${entry.id}-audio-${index}`
                      const duration = audioDurations[audioId] ?? 0
                      const position = audioProgress[audioId] ?? 0
                      const progressRatio = duration > 0 ? Math.min(position / duration, 1) : 0
                      return (
                        <TouchableOpacity
                          key={audioId}
                          style={[styles.audioPill, activeAudioId === audioId && styles.audioPillActive]}
                          onPress={() => handleToggleAudio(audioId, url)}
                          activeOpacity={0.85}
                        >
                          <View style={styles.audioIcon}>
                            {audioLoading[audioId] ? (
                              <ActivityIndicator size="small" color={colors.white} />
                            ) : (
                              <FontAwesome
                                name={activeAudioId === audioId ? "pause" : "play"}
                                size={16}
                                color={colors.white}
                              />
                            )}
                          </View>
                          <View style={styles.audioInfo}>
                            <Text style={styles.audioLabel}>
                              Listen to what {entry.user?.name || "they"} said
                            </Text>
                            <View style={styles.audioProgressTrack}>
                              <View style={[styles.audioProgressFill, { width: `${Math.max(progressRatio, 0.02) * 100}%` }]} />
                            </View>
                            <Text style={styles.audioTime}>
                              {formatMillis(position)} / {duration ? formatMillis(duration) : "--:--"}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      )
                    }
                    return null
                  })}
                  {/* Photos and videos */}
                  {entry.media_urls.map((url, index) => {
                    const mediaType = entry.media_types?.[index]
                    if (mediaType === "photo") {
                      const dimensions = imageDimensions[index]
                      const imageStyle = dimensions
                        ? {
                            width: "100%" as const,
                            aspectRatio: dimensions.width / dimensions.height,
                          }
                        : styles.mediaImage
                      
                      // Get all photo URLs for lightbox
                      const photoUrls = entry.media_urls
                        .map((u, i) => entry.media_types?.[i] === "photo" ? u : null)
                        .filter((u): u is string => u !== null)
                      const photoIndex = photoUrls.indexOf(url)
                      
                      return (
                        <TouchableOpacity
                          key={index}
                          activeOpacity={0.9}
                          onPress={() => {
                            setLightboxIndex(photoIndex >= 0 ? photoIndex : 0)
                            setLightboxVisible(true)
                          }}
                        >
                          <Image
                            source={{ uri: url }}
                            style={imageStyle}
                            resizeMode="contain"
                            onLoad={(e) => {
                              const { width, height } = e.nativeEvent.source
                              if (width && height) {
                                setImageDimensions((prev) => ({
                                  ...prev,
                                  [index]: { width, height },
                                }))
                              }
                            }}
                          />
                        </TouchableOpacity>
                      )
                    }
                    if (mediaType === "video") {
                      return (
                        <Video
                          key={index}
                          source={{ uri: url }}
                          style={styles.videoPlayer}
                          useNativeControls
                          resizeMode={ResizeMode.COVER}
                        />
                      )
                    }
                    return null
                  })}
                </View>
              )}

              {/* Reactions */}
              <View style={styles.reactionsSection}>
                <TouchableOpacity
                  style={[styles.reactionButton, hasLiked && styles.reactionButtonActive]}
                  onPress={handleToggleReaction}
                >
                  <FontAwesome
                    name={hasLiked ? "heart" : "heart-o"}
                    size={20}
                    color={colors.white}
                  />
                  <Text style={styles.reactionCount}>{reactions.length}</Text>
                </TouchableOpacity>
              </View>

              {/* Comments */}
              <View ref={commentsSectionRef} style={styles.commentsSection}>
                <Text style={styles.commentsTitle}>Comments</Text>
                {comments.map((comment) => (
                  <View key={comment.id} style={styles.comment}>
                    <Avatar uri={comment.user?.avatar_url} name={comment.user?.name || "User"} size={32} />
                    <View style={styles.commentContent}>
                      <Text style={styles.commentUser}>{comment.user?.name}</Text>
                      <Text style={styles.commentText}>{comment.text}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>

        {/* Fixed comment input at bottom */}
        <View style={[
          styles.fixedCommentInput,
          Platform.OS === "android" && {
            position: "absolute",
            left: 0,
            right: 0,
            bottom: keyboardHeight > 0 ? keyboardHeight + spacing.xl : 0,
            paddingBottom: keyboardHeight > 0 ? spacing.md : insets.bottom + spacing.md,
          },
          Platform.OS === "ios" && {
            paddingBottom: insets.bottom + spacing.md,
          },
        ]}>
          <Avatar uri={currentUserAvatar} name={currentUserName} size={32} />
          <TextInput
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Add a comment..."
            placeholderTextColor={colors.gray[500]}
            style={styles.commentInput}
            multiline
            onFocus={() => {
              // Scroll to comments section when input is focused
              setTimeout(() => {
                if (scrollViewRef.current && commentsSectionRef.current) {
                  commentsSectionRef.current.measureLayout(
                    scrollViewRef.current as any,
                    (x, y) => {
                      scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 100), animated: true })
                    },
                    () => {
                      scrollViewRef.current?.scrollToEnd({ animated: true })
                    }
                  )
                }
              }, 300)
            }}
          />
          <TouchableOpacity
            style={[styles.sendButton, !canSendComment && styles.sendButtonDisabled]}
            disabled={!canSendComment}
            onPress={handleSubmitComment}
          >
            <FontAwesome
              name="paper-plane"
              size={16}
              color={canSendComment ? colors.white : colors.gray[500]}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Photo Lightbox */}
      {entry && (
        <PhotoLightbox
          visible={lightboxVisible}
          photos={
            entry.media_urls
              ?.map((url, index) => (entry.media_types?.[index] === "photo" ? url : null))
              .filter((url): url is string => url !== null) || []
          }
          initialIndex={lightboxIndex}
          onClose={() => setLightboxVisible(false)}
        />
      )}
    </KeyboardAvoidingView>
  )
}

function formatMillis(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}
