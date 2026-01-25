"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Dimensions, PanResponder, ScrollView } from "react-native"
import { useRouter } from "expo-router"
import { Audio, Video, ResizeMode } from "expo-av"
import type { Entry } from "../lib/types"
import { typography, spacing } from "../lib/theme"
import { useTheme } from "../lib/theme-context"
import { Avatar } from "./Avatar"
import { FontAwesome } from "@expo/vector-icons"
import { supabase } from "../lib/supabase"
import { getComments, getMemorials, getReactions, toggleReaction, toggleEmojiReaction, getGroupMembers, getAllCommentReactionsForEntry, toggleCommentEmojiReaction, getUserStatus, createOrUpdateUserStatus } from "../lib/db"
import { EmojiPicker } from "./EmojiPicker"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { personalizeMemorialPrompt, replaceDynamicVariables } from "../lib/prompts"
import { MentionableText } from "./MentionableText"
import { UserProfileModal } from "./UserProfileModal"
import { PhotoLightbox } from "./PhotoLightbox"
import { StatusModal } from "./StatusModal"
import { getTodayDate, isSunday } from "../lib/utils"

const { width: SCREEN_WIDTH } = Dimensions.get("window")

interface EntryCardProps {
  entry: Entry
  entryIds?: string[]
  index?: number
  returnTo?: string
  showFuzzyOverlay?: boolean
  onEntryPress?: (entryDate: string) => void // Callback to store entry date before navigation
  // REMOVED: onRevealAnswers prop - tapping fuzzy card now navigates to entry-composer
  fuzzyOverlayPromptId?: string // Prompt ID to navigate to entry-composer when fuzzy overlay is tapped
  fuzzyOverlayDate?: string // Date to navigate to entry-composer when fuzzy overlay is tapped
  fuzzyOverlayGroupId?: string // Group ID to navigate to entry-composer when fuzzy overlay is tapped
}

export function EntryCard({ entry, entryIds, index = 0, returnTo = "/(main)/home", showFuzzyOverlay = false, onEntryPress, fuzzyOverlayPromptId, fuzzyOverlayDate, fuzzyOverlayGroupId }: EntryCardProps) {
  const router = useRouter()
  const { colors, isDark } = useTheme()
  const audioRefs = useRef<Record<string, Audio.Sound>>({})
  const videoRefs = useRef<Record<string, Video>>({})
  const commentVideoRefs = useRef<Record<string, Video>>({})
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null)
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null)
  const [activeCommentVideoId, setActiveCommentVideoId] = useState<string | null>(null)
  const [commentVideoMuted, setCommentVideoMuted] = useState<Record<string, boolean>>({}) // Default to unmuted (false)
  const [commentVideoProgress, setCommentVideoProgress] = useState<Record<string, number>>({})
  const [commentVideoDurations, setCommentVideoDurations] = useState<Record<string, number>>({})
  const [commentVideoPlaying, setCommentVideoPlaying] = useState<Record<string, boolean>>({})
  const [commentVideoLoading, setCommentVideoLoading] = useState<Record<string, boolean>>({})
  const [audioProgress, setAudioProgress] = useState<Record<string, number>>({})
  const [audioDurations, setAudioDurations] = useState<Record<string, number>>({})
  const [audioLoading, setAudioLoading] = useState<Record<string, boolean>>({})
  const [videoProgress, setVideoProgress] = useState<Record<string, number>>({})
  const [videoDurations, setVideoDurations] = useState<Record<string, number>>({})
  const [videoMuted, setVideoMuted] = useState<Record<string, boolean>>({})
  const [imageDimensions, setImageDimensions] = useState<Record<number, { width: number; height: number }>>({})
  const [videoDimensions, setVideoDimensions] = useState<Record<number, { width: number; height: number }>>({})
  const [userId, setUserId] = useState<string>()
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string; avatar_url?: string } | null>(null)
  const [userProfileModalVisible, setUserProfileModalVisible] = useState(false)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const carouselScrollViewRef = useRef<ScrollView>(null)
  const [commentLightboxVisible, setCommentLightboxVisible] = useState(false)
  const [commentLightboxIndex, setCommentLightboxIndex] = useState(0)
  const [commentLightboxPhotos, setCommentLightboxPhotos] = useState<string[]>([])
  const [commentEmojiPickerCommentId, setCommentEmojiPickerCommentId] = useState<string | null>(null)
  const [statusModalVisible, setStatusModalVisible] = useState(false)
  const [isTextExpanded, setIsTextExpanded] = useState(false)

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    }
    loadUser()
  }, [])

  useEffect(() => {
    return () => {
      const sounds = Object.values(audioRefs.current)
      sounds.forEach((sound) => {
        sound.unloadAsync().catch(() => {
          /* noop */
        })
      })
      // Clean up video refs
      const videos = Object.values(videoRefs.current)
      videos.forEach((video) => {
        video.unloadAsync().catch(() => {
          /* noop */
        })
      })
    }
  }, [])

  function handleEntryPress(scrollToComments = false) {
    // If fuzzy overlay is shown, navigate to entry-composer instead of showing entry detail
    if (showFuzzyOverlay && fuzzyOverlayPromptId && fuzzyOverlayDate && fuzzyOverlayGroupId) {
      router.push({
        pathname: "/(main)/modals/entry-composer",
        params: {
          promptId: fuzzyOverlayPromptId,
          date: fuzzyOverlayDate,
          returnTo: returnTo,
          groupId: fuzzyOverlayGroupId,
        },
      })
      return
    }
    
    // Store entry date before navigation for scroll restoration
    if (onEntryPress && entry.date) {
      onEntryPress(entry.date)
    }
    
    const params: Record<string, string> = {
      entryId: entry.id,
      returnTo,
    }
    
    // Check if this is a birthday card entry
    const isBirthdayCardEntry = (entry as any).isBirthdayCardEntry === true
    const cardId = (entry as any).cardId
    
    if (isBirthdayCardEntry && cardId) {
      // Navigate to birthday card entry detail
      if (entryIds && entryIds.length > 0) {
        params.entryIds = JSON.stringify(entryIds)
        params.index = String(index)
      }
      params.cardId = cardId
      router.push({
        pathname: "/(main)/modals/birthday-card-entry-detail",
        params,
      })
    } else {
      // Regular entry navigation
      if (entryIds && entryIds.length > 0) {
        params.entryIds = JSON.stringify(entryIds)
        params.index = String(index)
      }
      if (scrollToComments) {
        params.scrollToComments = "true"
      }
      router.push({
        pathname: "/(main)/modals/entry-detail",
        params,
      })
    }
  }

  // Handle mention press
  function handleMentionPress(userId: string, userName: string, avatarUrl?: string) {
    setSelectedMember({ id: userId, name: userName, avatar_url: avatarUrl })
    setUserProfileModalVisible(true)
  }

  // Calculate if text exceeds 14 lines (for fade overlay)
  const MAX_TEXT_LINES = 14
  const estimatedCharsPerLine = 50
  const minCharsForFade = MAX_TEXT_LINES * estimatedCharsPerLine
  const shouldShowFade = entry.text_content && entry.text_content.length >= minCharsForFade
  const isTextTruncated = shouldShowFade && !isTextExpanded

  // Handle text area tap
  function handleTextPress() {
    if (isTextTruncated) {
      // Expand text
      setIsTextExpanded(true)
    } else if (isTextExpanded) {
      // All text is revealed, navigate to entry detail
      handleEntryPress()
    }
  }


  // Separate media types
  const audioMedia = useMemo(() => {
    if (!entry.media_urls || !entry.media_types) return []
    return entry.media_urls
      .map((url, idx) => ({
        url,
        type: entry.media_types?.[idx],
        index: idx,
      }))
      .filter((item) => item.type === "audio")
  }, [entry.media_urls, entry.media_types])

  const photoVideoMedia = useMemo(() => {
    if (!entry.media_urls || !entry.media_types) return []
    return entry.media_urls
      .map((url, idx) => ({
        url,
        type: entry.media_types?.[idx],
        index: idx,
      }))
      .filter((item) => item.type === "photo" || item.type === "video")
  }, [entry.media_urls, entry.media_types])

  // Separate photos and videos
  const photos = useMemo(() => {
    return photoVideoMedia.filter((item) => item.type === "photo")
  }, [photoVideoMedia])

  const videos = useMemo(() => {
    return photoVideoMedia.filter((item) => item.type === "video")
  }, [photoVideoMedia])

  // Get first photo/video for display (for single media)
  const firstPhotoVideo = photoVideoMedia[0]
  const hasMultiplePhotoVideo = photoVideoMedia.length > 1

  // Fetch memorials for personalizing prompt questions
  const { data: memorials = [] } = useQuery({
    queryKey: ["memorials", entry.group_id],
    queryFn: () => getMemorials(entry.group_id),
    enabled: !!entry.group_id && !!entry.prompt?.question?.match(/\{.*memorial_name.*\}/i),
  })

  // Fetch prompt_name_usage to determine which memorial was actually used
  // Include entry.date in query key to ensure cache is date-specific and fresh
  const { data: memorialNameUsage = [] } = useQuery({
    queryKey: ["memorialNameUsage", entry.group_id, entry.date],
    queryFn: async () => {
      if (!entry.group_id) return []
      const { data, error } = await supabase
        .from("prompt_name_usage")
        .select("prompt_id, date_used, name_used, created_at")
        .eq("group_id", entry.group_id)
        .eq("variable_type", "memorial_name")
        .order("created_at", { ascending: true }) // Order by creation time - prefer earliest (correct) record
      if (error) {
        console.error("[EntryCard] Error fetching memorial name usage:", error)
        return []
      }
      if (__DEV__) {
        console.log(`[EntryCard] Fetched ${data?.length || 0} memorial name usage records`)
      }
      return (data || []) as Array<{ prompt_id: string; date_used: string; name_used: string; created_at: string }>
    },
    enabled: !!entry.group_id && !!entry.prompt?.question?.match(/\{.*memorial_name.*\}/i),
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
          console.warn(`[EntryCard] Duplicate prompt_name_usage detected for ${key}. Using first record: ${map.get(key)} instead of ${usage.name_used}`)
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

  // Fetch prompt_name_usage for member_name to get the exact name that was stored
  // CRITICAL: Use the stored name from prompt_name_usage, not recalculate
  const { data: memberNameUsage = [] } = useQuery({
    queryKey: ["memberNameUsage", entry.group_id, entry.date],
    queryFn: async () => {
      if (!entry.group_id) return []
      const { data, error } = await supabase
        .from("prompt_name_usage")
        .select("prompt_id, date_used, name_used, created_at")
        .eq("group_id", entry.group_id)
        .eq("variable_type", "member_name")
        .order("created_at", { ascending: true })
      if (error) {
        console.error("[EntryCard] Error fetching member name usage:", error)
        return []
      }
      return (data || []) as Array<{ prompt_id: string; date_used: string; name_used: string; created_at: string }>
    },
    enabled: !!entry.group_id && !!entry.prompt?.question?.match(/\{.*member_name.*\}/i),
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

  // Fetch members for fallback
  const { data: members = [] } = useQuery({
    queryKey: ["members", entry.group_id],
    queryFn: () => getGroupMembers(entry.group_id),
    enabled: !!entry.group_id && !!entry.prompt?.question?.match(/\{.*member_name.*\}/i),
  })

  // Query to get week number for Journal entries
  const { data: journalWeekNumber = 1 } = useQuery({
    queryKey: ["journalWeekNumberForEntry", entry.group_id, entry.date],
    queryFn: async () => {
      if (!entry.group_id || !entry.date || entry.prompt?.category !== "Journal") return 1

      // Get Journal prompt ID
      const { data: journalPrompt } = await supabase
        .from("prompts")
        .select("id")
        .eq("category", "Journal")
        .limit(1)
        .maybeSingle()

      if (!journalPrompt) return 1

      // Count how many VALID Sunday Journal prompts have been asked for this group up to and including this entry's date
      // Only count prompts that were asked on Sundays (valid Journal prompts)
      const { data: journalPrompts, error } = await supabase
        .from("daily_prompts")
        .select("id, date")
        .eq("group_id", entry.group_id)
        .eq("prompt_id", journalPrompt.id)
        .lte("date", entry.date)
        .order("date", { ascending: true })

      if (error) {
        console.error("[EntryCard] Error counting Journal prompts:", error)
        return 1
      }

      // Filter to only count valid Sunday Journal prompts (exclude invalid ones scheduled on non-Sunday dates)
      const validSundayPrompts = (journalPrompts || []).filter((dp: any) => {
        return isSunday(dp.date)
      })

      // Week number is the count of valid Sunday Journal prompts up to this date
      return validSundayPrompts.length || 1
    },
    enabled: !!entry.group_id && !!entry.date && entry.prompt?.category === "Journal",
  })

  // Personalize prompt question if it has placeholders
  // For Journal prompts, show "X's week N photo journal" instead of the question
  const personalizedQuestion = useMemo(() => {
    if (!entry.prompt?.question) return entry.prompt?.question
    
    // For Journal category, show "X's week N photo journal"
    if (entry.prompt.category === "Journal") {
      const userName = entry.user?.name || "Their"
      return `${userName}'s week ${journalWeekNumber} photo journal`
    }
    
    let question = entry.prompt.question
    const variables: Record<string, string> = {}
    
    // Check for memorial_name placeholder - use the CORRECT memorial that was actually used
    if (question.match(/\{.*memorial_name.*\}/i) && entry.group_id && entry.prompt_id && entry.date) {
      const memorialNameUsed = getMemorialForPrompt(entry.prompt_id, entry.date, entry.group_id)
      
      // Debug logging
      if (__DEV__) {
        console.log(`[EntryCard] Personalizing question:`, {
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
          console.log(`[EntryCard] Personalized with: ${memorialNameUsed}`)
        }
      } else if (memorials.length > 0) {
        // Fallback if we can't determine (shouldn't happen, but safety)
        console.warn(`[EntryCard] Could not determine memorial for prompt ${entry.prompt_id} on ${entry.date}, using first memorial`)
        question = personalizeMemorialPrompt(question, memorials[0].name)
      }
    }
    
    // Check for member_name placeholder - use the CORRECT member name that was actually used
    if (question.match(/\{.*member_name.*\}/i) && entry.group_id && entry.prompt_id && entry.date) {
      const normalizedDate = entry.date.split('T')[0]
      const usageKey = `${entry.prompt_id}-${normalizedDate}`
      const memberNameUsed = memberUsageMap.get(usageKey)
      
      if (memberNameUsed) {
        // Use the exact name from prompt_name_usage (ensures consistency)
        variables.member_name = memberNameUsed
        question = replaceDynamicVariables(question, variables)
        if (__DEV__) {
          console.log(`[EntryCard] Using member name from prompt_name_usage: ${memberNameUsed}`)
        }
      } else if (members.length > 0) {
        // Fallback: if no usage record exists, use first member
        console.warn(`[EntryCard] No prompt_name_usage found for member_name, using first member as fallback`)
        variables.member_name = members[0].user?.name || "them"
        question = replaceDynamicVariables(question, variables)
      }
    }
    
    // Note: We removed the check for "Gumbo" or "Amelia" in the question text because
    // these names can legitimately appear in questions (e.g., "What is a story about Gumbo...")
    // The check was causing false positives for questions that mention names directly
    
    return question
  }, [entry.prompt?.question, entry.group_id, entry.prompt_id, entry.date, memorials, getMemorialForPrompt, memorialUsageMap, memorialNameUsage])

  // Fetch reactions
  const { data: reactions = [] } = useQuery({
    queryKey: ["reactions", entry.id],
    queryFn: () => getReactions(entry.id),
    enabled: !!entry.id,
  })

  // Fetch comments
  const { data: comments = [] } = useQuery({
    queryKey: ["comments", entry.id],
    queryFn: () => getComments(entry.id),
    enabled: !!entry.id,
  })

  // Fetch all comment reactions for this entry
  const { data: commentReactionsMap = {} } = useQuery({
    queryKey: ["commentReactions", entry.id],
    queryFn: () => getAllCommentReactionsForEntry(entry.id),
    enabled: !!entry.id,
  })

  // Fetch status for this entry's user and date
  const { data: userStatus } = useQuery({
    queryKey: ["userStatus", entry.user_id, entry.group_id, entry.date],
    queryFn: () => getUserStatus(entry.user_id, entry.group_id, entry.date),
    enabled: !!entry.user_id && !!entry.group_id && !!entry.date,
  })

  // Check if this is the logged-in user's entry
  const isCurrentUser = userId === entry.user_id
  const isToday = entry.date === getTodayDate()
  const canEditStatus = isCurrentUser && isToday

  // Mutation for posting/updating status
  const statusMutation = useMutation({
    mutationFn: async (statusText: string) => {
      if (!userId || !entry.group_id || !entry.date) {
        throw new Error("Missing required fields")
      }
      return createOrUpdateUserStatus(userId, entry.group_id, entry.date, statusText)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userStatus", entry.user_id, entry.group_id, entry.date] })
      setStatusModalVisible(false)
    },
  })

  const hasLiked = reactions.some((r) => r.user_id === userId)
  const reactionCount = reactions.length
  const queryClient = useQueryClient()
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  // Group reactions by emoji type and count them
  const reactionsByEmoji = useMemo(() => {
    const grouped: Record<string, { count: number; userReacted: boolean }> = {}
    reactions.forEach((reaction) => {
      const emoji = reaction.type || "❤️" // Fallback to heart for old reactions
      if (!grouped[emoji]) {
        grouped[emoji] = { count: 0, userReacted: false }
      }
      grouped[emoji].count++
      if (reaction.user_id === userId) {
        grouped[emoji].userReacted = true
      }
    })
    return grouped
  }, [reactions, userId])

  // Get current user's reactions (emojis they've used)
  const currentUserReactions = useMemo(() => {
    return reactions
      .filter((r) => r.user_id === userId)
      .map((r) => r.type || "❤️")
  }, [reactions, userId])

  const toggleReactionMutation = useMutation({
    mutationFn: () => toggleReaction(entry.id, userId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reactions", entry.id] })
    },
  })

  const toggleEmojiReactionMutation = useMutation({
    mutationFn: (emoji: string) => toggleEmojiReaction(entry.id, userId!, emoji),
    onMutate: async (emoji: string) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["reactions", entry.id] })

      // Snapshot the previous value
      const previousReactions = queryClient.getQueryData<any[]>(["reactions", entry.id]) || []

      // Optimistically update the cache
      const existingReactionIndex = previousReactions.findIndex(
        (r) => r.user_id === userId && r.type === emoji
      )
      const otherReactionIndex = previousReactions.findIndex(
        (r) => r.user_id === userId && r.type !== emoji
      )

      let optimisticReactions: any[]

      if (existingReactionIndex >= 0) {
        // User already has this emoji - remove it
        optimisticReactions = previousReactions.filter((_, i) => i !== existingReactionIndex)
      } else if (otherReactionIndex >= 0) {
        // User has a different reaction - replace it
        optimisticReactions = previousReactions.map((reaction, i) =>
          i === otherReactionIndex
            ? { ...reaction, type: emoji }
            : reaction
        )
      } else {
        // User has no reaction - add new one (we'll use a temporary ID)
        optimisticReactions = [
          ...previousReactions,
          {
            id: `temp-${Date.now()}`,
            entry_id: entry.id,
            user_id: userId,
            type: emoji,
            user: null, // Will be populated on refetch
          },
        ]
      }

      queryClient.setQueryData(["reactions", entry.id], optimisticReactions)

      // Return context with previous reactions for rollback
      return { previousReactions }
    },
    onError: (err, emoji, context) => {
      // Rollback on error
      if (context?.previousReactions) {
        queryClient.setQueryData(["reactions", entry.id], context.previousReactions)
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["reactions", entry.id] })
    },
  })

  async function handleToggleReaction(e: any) {
    e.stopPropagation()
    if (!userId) return
    try {
      await toggleReactionMutation.mutateAsync()
    } catch (error) {
      // Silently fail - user can try again
    }
  }

  async function handleSelectEmoji(emoji: string) {
    if (!userId) return
    try {
      await toggleEmojiReactionMutation.mutateAsync(emoji)
    } catch (error) {
      // Silently fail - user can try again
    }
  }

  const toggleCommentEmojiReactionMutation = useMutation({
    mutationFn: ({ commentId, emoji }: { commentId: string; emoji: string }) => 
      toggleCommentEmojiReaction(commentId, userId!, emoji),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commentReactions", entry.id] })
    },
  })

  async function handleSelectCommentEmoji(commentId: string, emoji: string) {
    if (!userId) return
    try {
      await toggleCommentEmojiReactionMutation.mutateAsync({ commentId, emoji })
      setCommentEmojiPickerCommentId(null)
    } catch (error) {
      // Silently fail - user can try again
    }
  }

  async function handleToggleAudio(audioId: string, uri: string) {
    try {
      setAudioLoading((prev) => ({ ...prev, [audioId]: true }))
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      })

      if (activeAudioId && activeAudioId !== audioId) {
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

      let sound = audioRefs.current[audioId]
      if (!sound) {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: false },
          (status) => {
            if (!status.isLoaded) return
            if (status.durationMillis) {
              setAudioDurations((prev) => ({ ...prev, [audioId]: status.durationMillis! }))
            }
            if (status.positionMillis !== undefined) {
              setAudioProgress((prev) => ({ ...prev, [audioId]: status.positionMillis! }))
            }
            if (status.didJustFinish) {
              setActiveAudioId((current) => (current === audioId ? null : current))
              setAudioProgress((prev) => ({ ...prev, [audioId]: status.durationMillis ?? 0 }))
            }
          },
        )
        audioRefs.current[audioId] = newSound
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
        setActiveAudioId(audioId)
      }
    } catch (error: any) {
      console.error("Audio error:", error)
    } finally {
      setAudioLoading((prev) => ({ ...prev, [audioId]: false }))
                  }
  }

  async function handleCommentVideoPlayPause(commentId: string, videoUri: string) {
    const videoId = `comment-${commentId}`
    const video = commentVideoRefs.current[videoId]
    
    if (!video) return
    
    try {
      setCommentVideoLoading((prev) => ({ ...prev, [commentId]: true }))
      
      // Stop any other playing comment video
      if (activeCommentVideoId && activeCommentVideoId !== videoId) {
        const previousVideo = commentVideoRefs.current[activeCommentVideoId]
        if (previousVideo) {
          try {
            await previousVideo.pauseAsync()
            await previousVideo.setPositionAsync(0)
          } catch {
            // ignore
          }
        }
        const prevCommentId = activeCommentVideoId.replace("comment-", "")
        setCommentVideoPlaying((prev) => ({ ...prev, [prevCommentId]: false }))
        setActiveCommentVideoId(null)
      }
      
      const status = await video.getStatusAsync()
      const isCurrentlyPlaying = commentVideoPlaying[commentId] || false
      
      if (status.isLoaded) {
        if (isCurrentlyPlaying) {
          await video.pauseAsync()
          setCommentVideoPlaying((prev) => ({ ...prev, [commentId]: false }))
          setActiveCommentVideoId(null)
        } else {
          // Ensure video is unmuted when playing (default to unmuted)
          const isMuted = commentVideoMuted[commentId] ?? false
          if (isMuted) {
            await Audio.setAudioModeAsync({
              allowsRecordingIOS: false,
              playsInSilentModeIOS: true,
            })
            await video.setIsMutedAsync(false)
            setCommentVideoMuted((prev) => ({ ...prev, [commentId]: false }))
          } else {
            // Initialize as unmuted if not set
            await video.setIsMutedAsync(false)
            setCommentVideoMuted((prev) => ({ ...prev, [commentId]: false }))
          }
          await video.playAsync()
          setCommentVideoPlaying((prev) => ({ ...prev, [commentId]: true }))
          setActiveCommentVideoId(videoId)
        }
      } else {
        // Video not loaded yet, load and play (default to unmuted)
        await video.loadAsync({ uri: videoUri })
        // Initialize as unmuted
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        })
        await video.setIsMutedAsync(false)
        setCommentVideoMuted((prev) => ({ ...prev, [commentId]: false }))
        await video.playAsync()
        setCommentVideoPlaying((prev) => ({ ...prev, [commentId]: true }))
        setActiveCommentVideoId(videoId)
      }
    } catch (error: any) {
      console.error("[EntryCard] Error toggling comment video:", error)
    } finally {
      setCommentVideoLoading((prev) => ({ ...prev, [commentId]: false }))
    }
  }

  async function handleCommentVideoRestart(commentId: string) {
    const videoId = `comment-${commentId}`
    const video = commentVideoRefs.current[videoId]
    
    if (!video) return
    
    try {
      setCommentVideoLoading((prev) => ({ ...prev, [commentId]: true }))
      await video.setPositionAsync(0)
      // Ensure video is unmuted (default to unmuted)
      const isMuted = commentVideoMuted[commentId] ?? false
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      })
      await video.setIsMutedAsync(false)
      setCommentVideoMuted((prev) => ({ ...prev, [commentId]: false }))
      await video.playAsync()
      setCommentVideoPlaying((prev) => ({ ...prev, [commentId]: true }))
      setCommentVideoProgress((prev) => ({ ...prev, [commentId]: 0 }))
      setActiveCommentVideoId(videoId)
    } catch (error: any) {
      console.error("[EntryCard] Error restarting comment video:", error)
    } finally {
      setCommentVideoLoading((prev) => ({ ...prev, [commentId]: false }))
    }
  }

  async function handleCommentVideoToggleMute(commentId: string) {
    const videoId = `comment-${commentId}`
    const video = commentVideoRefs.current[videoId]
    
    if (!video) return
    
    const newMutedState = !(commentVideoMuted[commentId] ?? false)
    
    try {
      if (!newMutedState) {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        })
      }
      await video.setIsMutedAsync(newMutedState)
      setCommentVideoMuted((prev) => ({ ...prev, [commentId]: newMutedState }))
    } catch (error: any) {
      console.error("[EntryCard] Error toggling comment video mute:", error)
    }
  }

  async function handleCommentVideoSeek(commentId: string, position: number) {
    const videoId = `comment-${commentId}`
    const video = commentVideoRefs.current[videoId]
    
    if (!video) return
    
    try {
      const wasPlaying = commentVideoPlaying[commentId] || false
      if (wasPlaying) {
        await video.pauseAsync()
      }
      await video.setPositionAsync(position)
      setCommentVideoProgress((prev) => ({ ...prev, [commentId]: position }))
      if (wasPlaying) {
        await video.playAsync()
      }
    } catch (error: any) {
      console.error("[EntryCard] Error seeking comment video:", error)
    }
  }

  function formatMillis(ms: number) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  // Theme 2 color palette - dynamic based on dark/light mode
  const theme2Colors = useMemo(() => {
    if (isDark) {
      // Dark mode colors
      return {
        red: "#B94444",
        yellow: "#E8A037",
        green: "#2D6F4A",
        blue: "#3A5F8C",
        beige: "#000000", // Black (was beige)
        cream: "#111111", // Dark gray (was cream) - for EntryCard backgrounds
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

  // Create dynamic styles based on theme
  const styles = useMemo(() => StyleSheet.create({
  entryWrapper: {
    width: "100%",
      marginBottom: spacing.md,
      paddingHorizontal: spacing.md,
  },
    entryCard: {
      backgroundColor: theme2Colors.cream, // Black in dark mode, cream in light mode
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
      position: "relative",
      overflow: "hidden",
  },
    fuzzyOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 10,
      borderRadius: 16,
      overflow: "hidden",
    },
    fuzzyOverlayBackground: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0, 0, 0, 0.5)", // Dark semi-transparent background to increase opacity and hide text completely
      zIndex: 1,
    },
    fuzzyOverlayImage: {
      width: "100%",
      height: "100%",
      opacity: 1.0, // 100% opacity
      zIndex: 2, // Above background overlay
    },
  entryHeader: {
    flexDirection: "row",
      justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  arrowIcon: {
    opacity: 0.5,
  },
  entryAuthor: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: spacing.xs,
    flex: 1, // Take available space but allow shrinking if needed
    minWidth: 0, // Allow flex item to shrink below content size
  },
  statusBubble: {
    backgroundColor: isDark ? "#505050" : "#D0D0D0", // Lighter gray in light mode, keep dark mode same
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
    maxWidth: SCREEN_WIDTH - (spacing.md * 2) - (spacing.lg * 2) - 40, // Max width: screen width minus padding and chevron space
    alignSelf: "flex-start", // Allow bubble to shrink to content width
    borderWidth: 1,
    borderColor: theme2Colors.textSecondary,
    position: "relative",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3, // Android shadow
  },
  statusBubbleTailBorder: {
    position: "absolute",
    bottom: -9,
    left: 20,
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 9,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: theme2Colors.textSecondary, // Match bubble border color
    zIndex: -1,
  },
  statusBubbleTail: {
    position: "absolute",
    bottom: -8,
    left: 20,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: isDark ? "#505050" : "#D0D0D0", // Match bubble background
  },
  statusBubbleText: {
    ...typography.body,
    fontSize: 13,
    color: theme2Colors.text,
    lineHeight: 18,
  },
  entryAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexShrink: 1,
  },
  userName: {
    ...typography.bodyBold,
    fontSize: 16, // Increased from 14
      color: theme2Colors.text,
  },
  songTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginLeft: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme2Colors.textSecondary,
  },
  songTagText: {
    ...typography.caption,
    fontSize: 12,
    color: theme2Colors.textSecondary,
  },
  question: {
    fontFamily: "Roboto-Regular",
    fontSize: 14,
      marginBottom: spacing.md,
      color: theme2Colors.textSecondary,
  },
  textContainer: {
    position: "relative",
      marginBottom: spacing.md,
  },
  entryText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 22,
    color: theme2Colors.text,
  },
  link: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 22,
    color: theme2Colors.blue,
    textDecorationLine: "underline",
  },
  mention: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 22,
    color: isDark ? "#D97393" : theme2Colors.blue, // Onboarding pink in dark mode
    fontWeight: "bold",
  },
  textFadeOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 48, // 2 lines fade (2 * 24px line height)
      zIndex: 2,
  },
  fadeLine1: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
      height: 24,
      backgroundColor: theme2Colors.cream,
    opacity: 0.85,
  },
  fadeLine2: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
      height: 24,
      backgroundColor: theme2Colors.cream,
    opacity: 0.6,
  },
    voiceMemoContainer: {
      marginBottom: spacing.md,
      gap: spacing.sm,
  },
    voiceMemoPill: {
    flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.md,
    backgroundColor: theme2Colors.beige,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
  },
    voiceMemoIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
    backgroundColor: theme2Colors.cream,
    justifyContent: "center",
    alignItems: "center",
    },
    voiceMemoInfo: {
      flex: 1,
      gap: spacing.xs,
    },
    voiceMemoLabel: {
      ...typography.bodyMedium,
      color: theme2Colors.text,
    },
    voiceMemoProgressTrack: {
      width: "100%",
      height: 4,
      borderRadius: 2,
      backgroundColor: theme2Colors.textSecondary,
    overflow: "hidden",
  },
    voiceMemoProgressFill: {
      height: "100%",
      backgroundColor: theme2Colors.blue,
    },
    voiceMemoTime: {
      ...typography.caption,
      color: theme2Colors.textSecondary,
    },
    mediaWrapper: {
      width: "100%",
      marginLeft: -spacing.xs, // Negative margin to extend beyond card padding
      marginRight: -spacing.xs, // Negative margin to extend beyond card padding
      marginBottom: spacing.md,
      alignSelf: "stretch",
      paddingLeft: 0,
      paddingRight: 0,
      borderRadius: 12,
      overflow: "hidden", // Keep overflow hidden for rounded corners
    },
    mediaImage: {
    width: "100%",
      height: 300, // Fallback height while loading dimensions
      backgroundColor: theme2Colors.beige,
  },
    photoCarouselContent: {
      paddingLeft: spacing.xs, // Reduced padding so images span more width
      paddingRight: spacing.xs, // Reduced padding so images span more width
      gap: spacing.xs, // Reduced gap between images
    },
    photoCarouselItemContainer: {
      width: SCREEN_WIDTH * 0.75, // Smaller to show part of next image
      marginRight: spacing.xs, // Reduced margin
    },
    photoCarouselItem: {
      width: "100%",
      height: SCREEN_WIDTH * 0.75,
      overflow: "hidden",
      backgroundColor: theme2Colors.beige,
      borderRadius: 12,
    },
    photoCarouselItemLast: {
      marginRight: 0, // Remove margin from last item
    },
    photoCarouselImage: {
      width: "100%",
      height: "100%",
    },
    captionText: {
      ...typography.body,
      fontSize: 14,
      color: theme2Colors.text,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
      paddingHorizontal: spacing.xs,
      lineHeight: 20,
    },
    paginationDots: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginTop: spacing.sm,
      gap: spacing.xs,
    },
    paginationDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme2Colors.textSecondary,
      opacity: 0.3,
    },
    paginationDotActive: {
      backgroundColor: theme2Colors.red,
      opacity: 1,
    },
    videoContainer: {
      width: "100%",
      minHeight: 200,
      backgroundColor: theme2Colors.beige,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
      alignSelf: "stretch",
      borderRadius: 12,
  },
    videoOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.3)",
      zIndex: 1,
    },
    actionsRow: {
      flexDirection: "row",
    alignItems: "center",
      justifyContent: "space-between",
    marginTop: spacing.sm,
    },
    actionsLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.lg,
  },
    actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    },
    iconOutline: {
      // Outline icon - white stroke, transparent fill
    },
    iconSolid: {
      // Solid icon - white fill
    },
    actionCount: {
      ...typography.bodyMedium,
      fontSize: 14,
    color: theme2Colors.text,
  },
    reactionsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      flexWrap: "wrap",
      marginLeft: -5, // Move 20% closer to comment icon (20% of spacing.lg = 24 * 0.2 = 4.8, rounded to 5)
    },
    reactionAvatarContainer: {
      position: "relative",
    },
    reactionAvatarWrapper: {
      opacity: 0.7, // 70% opacity for avatars
    },
    reactionEmojiOverlay: {
      position: "absolute",
      top: -4,
      right: -8,
      backgroundColor: theme2Colors.cream,
      borderRadius: 10,
      width: 20,
      height: 20,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
      zIndex: 1,
    },
    reactionEmojiOverlayText: {
      fontSize: 12,
    },
    reactionBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: 16,
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
    },
    reactionEmoji: {
      fontSize: 16,
    },
    reactionCount: {
      ...typography.bodyMedium,
      fontSize: 12,
      color: theme2Colors.text,
      fontWeight: "600",
    },
    reactIcon: {
      width: 25,
      height: 25,
    },
    commentReactionsAndButtonContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md, // Increased gap between reactions and react icon
    },
    commentReactionsContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    commentReactionsContainerNoButton: {
      // When user has reacted (no react button), add padding to left and right
      paddingLeft: spacing.xs,
      paddingRight: spacing.xs,
    },
    commentReactButton: {
      padding: spacing.xs,
    },
    commentReactIcon: {
      width: 20,
      height: 20,
    },
    commentReactionAvatarContainer: {
      position: "relative",
    },
    commentReactionAvatarWrapper: {
      opacity: 0.7, // 70% opacity for avatars
    },
    commentReactionEmojiOverlay: {
      position: "absolute",
      top: -4,
      right: -8,
      backgroundColor: theme2Colors.cream,
      borderRadius: 10,
      width: 20,
      height: 20,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
      zIndex: 1,
    },
    commentReactionEmojiOverlayText: {
      fontSize: 12,
    },
    commentsContainer: {
      paddingHorizontal: 0,
    paddingTop: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  commentPreviewItem: {
    backgroundColor: theme2Colors.cream, // Black in dark mode, white in light mode (same as entryCard)
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: isDark ? "#1F1F1F" : "#CFCFCF",
    overflow: "hidden", // Clip negative margins from media thumbnails
  },
  commentPreviewContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  commentPreviewTextContainer: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0, // Allow flex item to shrink below its content size
  },
  commentPreviewUserRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  commentPreviewUser: {
    ...typography.bodyMedium,
    fontSize: 14,
    color: theme2Colors.text,
    fontWeight: "600",
  },
  commentPreviewText: {
    ...typography.body,
    fontSize: 14,
    color: theme2Colors.text,
    flex: 1,
  },
  commentMediaThumbnailContainer: {
    marginTop: spacing.md,
    marginLeft: -(32 + spacing.sm), // Negative margin to align with avatar start (avatar width + gap from commentPreviewContent)
    marginRight: -spacing.sm, // Negative margin to align with reactions end (extends to right edge of commentPreviewContent)
    width: SCREEN_WIDTH - (spacing.md * 2) - (spacing.lg * 2) - (spacing.sm * 2), // Full width from avatar start to reactions end (screen width - entryWrapper padding - entryCard padding - commentPreviewItem padding)
  },
  commentMediaThumbnail: {
    width: "100%", // Use full width of container
    aspectRatio: 1, // Maintain square aspect ratio
    borderRadius: 12,
    backgroundColor: colors.gray[900],
    position: "relative",
    overflow: "hidden",
  },
  commentVideoPlayButton: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  commentVideoControls: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
  },
  commentVideoMuteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  commentAudioThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: colors.gray[900],
    justifyContent: "center",
    alignItems: "center",
  },
  commentAudioPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.gray[900],
    borderRadius: 16,
    width: "100%", // Use full width of container
  },
  commentAudioIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.gray[800],
    justifyContent: "center",
    alignItems: "center",
  },
  commentAudioLabel: {
    ...typography.bodyMedium,
    fontSize: 12,
    color: colors.white,
  },
  commentPreviewMore: {
    ...typography.caption,
    fontSize: 13,
    color: theme2Colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: "center",
  },
    separator: {
      display: "none", // Remove separator - cards have their own borders
    },
  }), [theme2Colors, isDark])

  return (
    <View style={styles.entryWrapper}>
      {/* Entry Card */}
      <TouchableOpacity
        onPress={() => handleEntryPress()}
        activeOpacity={0.9}
        style={styles.entryCard}
      >
        {/* Header */}
        <View style={styles.entryHeader}>
          <View style={styles.entryAuthor}>
            {/* Status Speech Bubble */}
            {/* Show for logged-in user on today (always, with placeholder), or if status exists (any user, any day) */}
            {((isCurrentUser && isToday) || userStatus) && (
              <TouchableOpacity
                style={styles.statusBubble}
                onPress={() => {
                  // Only allow opening modal if it's the current user and (it's today OR status exists for viewing)
                  // But prevent editing on previous days
                  if (isCurrentUser && (canEditStatus || userStatus)) {
                    setStatusModalVisible(true)
                  }
                }}
                activeOpacity={0.7}
                disabled={!isCurrentUser}
              >
                <Text style={styles.statusBubbleText}>
                  {userStatus?.status_text || (isCurrentUser && isToday ? "Today, I am..." : "")}
                </Text>
                {/* Speech bubble tail border */}
                <View style={styles.statusBubbleTailBorder} />
                <View style={styles.statusBubbleTail} />
              </TouchableOpacity>
            )}
            <View style={styles.entryAuthorRow}>
              <Avatar uri={entry.user?.avatar_url} name={entry.user?.name || "User"} size={36} borderColor={theme2Colors.text} />
              <Text style={styles.userName}>{entry.user?.name}</Text>
              {entry.embedded_media && entry.embedded_media.length > 0 && (() => {
                // Get the first platform to determine icon (or use first if multiple)
                const firstPlatform = entry.embedded_media[0]?.platform
                let iconName = "music" // fallback
                if (firstPlatform === "spotify") {
                  iconName = "spotify"
                } else if (firstPlatform === "apple_music") {
                  iconName = "apple"
                } else if (firstPlatform === "soundcloud") {
                  iconName = "soundcloud"
                }
                return (
                  <View style={styles.songTag}>
                    <FontAwesome name={iconName as any} size={12} color={theme2Colors.textSecondary} />
                    <Text style={styles.songTagText}>Added a song</Text>
                  </View>
                )
              })()}
            </View>
          </View>
          <FontAwesome name="chevron-right" size={14} color={theme2Colors.textSecondary} style={styles.arrowIcon} />
        </View>

        {/* Question */}
        <Text style={styles.question}>{personalizedQuestion || entry.prompt?.question}</Text>

        {/* Text Content */}
        {entry.text_content && (
          shouldShowFade ? (
            <TouchableOpacity 
              style={styles.textContainer}
              onPress={(e) => {
                e.stopPropagation()
                handleTextPress()
              }}
              activeOpacity={0.7}
            >
              <MentionableText 
                text={entry.text_content} 
                textStyle={styles.entryText} 
                linkStyle={styles.link} 
                mentionStyle={styles.mention}
                groupId={entry.group_id}
                onMentionPress={handleMentionPress}
                numberOfLines={isTextExpanded ? undefined : MAX_TEXT_LINES}
              />
              {/* Fade overlay for last 2 lines (only when exceeding 14 lines and not expanded) */}
              {isTextTruncated && (
                <View style={styles.textFadeOverlay} pointerEvents="none">
                  <View style={styles.fadeLine1} />
                  <View style={styles.fadeLine2} />
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.textContainer}>
              <MentionableText 
                text={entry.text_content} 
                textStyle={styles.entryText} 
                linkStyle={styles.link} 
                mentionStyle={styles.mention}
                groupId={entry.group_id}
                onMentionPress={handleMentionPress}
              />
            </View>
          )
        )}

        {/* Voice Memos (after text, before embedded media) */}
        {audioMedia.length > 0 && (
          <View style={styles.voiceMemoContainer}>
            {audioMedia.map((audio, idx) => {
              const audioId = `${entry.id}-audio-${audio.index}`
              const duration = audioDurations[audioId] ?? 0
              const position = audioProgress[audioId] ?? 0
              const progressRatio = duration > 0 ? Math.min(position / duration, 1) : 0
              return (
                <TouchableOpacity
                  key={audioId}
                  style={styles.voiceMemoPill}
                  onPress={(e) => {
                    e.stopPropagation()
                    handleToggleAudio(audioId, audio.url)
                  }}
                  activeOpacity={0.85}
                >
                  <View style={styles.voiceMemoIcon}>
                    {audioLoading[audioId] ? (
                      <ActivityIndicator size="small" color={theme2Colors.text} />
                    ) : (
                      <FontAwesome
                        name={activeAudioId === audioId ? "pause" : "play"}
                        size={16}
                        color={theme2Colors.text}
                      />
                    )}
                  </View>
                  <View style={styles.voiceMemoInfo}>
                    <Text style={styles.voiceMemoLabel}>
                      Listen to what {entry.user?.name || "they"} said
                    </Text>
                    <View style={styles.voiceMemoProgressTrack}>
                      <View style={[styles.voiceMemoProgressFill, { width: `${Math.max(progressRatio, 0.02) * 100}%` }]} />
                    </View>
                    <Text style={styles.voiceMemoTime}>
                      {formatMillis(position)} / {duration ? formatMillis(duration) : "--:--"}
                    </Text>
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        )}


        {/* Multiple Photos/Videos Carousel (square grid, showing 1.33 items) */}
        {hasMultiplePhotoVideo && (
          <View style={styles.mediaWrapper}>
            <ScrollView
              ref={carouselScrollViewRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              pagingEnabled={false}
              snapToInterval={SCREEN_WIDTH * 0.75 + spacing.xs}
              decelerationRate="fast"
              contentContainerStyle={styles.photoCarouselContent}
              onScroll={(event) => {
                const scrollPosition = event.nativeEvent.contentOffset.x
                const itemWidth = SCREEN_WIDTH * 0.75 + spacing.xs
                const currentIndex = Math.round(scrollPosition / itemWidth)
                setCarouselIndex(currentIndex)
              }}
              scrollEventThrottle={16}
            >
              {photoVideoMedia.map((item, idx) => {
                // Get caption for this photo (only for Journal entries)
                const caption = entry.prompt?.category === "Journal" && item.type === "photo" && entry.captions?.[item.index]
                  ? entry.captions[item.index]
                  : null
                
                return (
                  <View
                    key={item.index}
                    style={[
                      styles.photoCarouselItemContainer,
                      idx === photoVideoMedia.length - 1 && styles.photoCarouselItemLast
                    ]}
                  >
                    <View
                      style={styles.photoCarouselItem}
                    >
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation()
                          handleEntryPress()
                        }}
                        activeOpacity={0.9}
                        style={{ flex: 1 }}
                      >
                        {item.type === "photo" ? (
                          <Image
                            source={{ uri: item.url }}
                            style={styles.photoCarouselImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <VideoPlayer 
                            uri={item.url} 
                            index={item.index}
                            videoId={`${entry.id}-video-${item.index}`}
                            dimensions={videoDimensions[item.index]}
                            containerStyle={{ height: SCREEN_WIDTH * 0.75 }}
                            onLoad={(dimensions) => {
                              setVideoDimensions((prev) => ({
                                ...prev,
                                [item.index]: dimensions,
                              }))
                            }}
                          />
                        )}
                      </TouchableOpacity>
                    </View>
                    {/* Caption below image (only for Journal photos) */}
                    {caption && (
                      <Text style={styles.captionText}>{caption}</Text>
                    )}
                  </View>
                )
              })}
            </ScrollView>
            {/* Pagination dots */}
            <View style={styles.paginationDots}>
              {photoVideoMedia.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.paginationDot,
                    idx === carouselIndex && styles.paginationDotActive
                  ]}
                />
              ))}
            </View>
          </View>
        )}

        {/* Single Photo or Video (full width, respect aspect ratio) */}
        {!hasMultiplePhotoVideo && firstPhotoVideo && (
          firstPhotoVideo.type === "photo" ? (
            <View style={styles.mediaWrapper}>
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation()
                  handleEntryPress()
                }}
                activeOpacity={0.9}
              >
                <Image
                  source={{ uri: firstPhotoVideo.url }}
                  style={imageDimensions[firstPhotoVideo.index] ? {
                    width: "100%",
                    height: undefined,
                    aspectRatio: imageDimensions[firstPhotoVideo.index].width / imageDimensions[firstPhotoVideo.index].height,
                    backgroundColor: theme2Colors.beige,
                    borderRadius: 12,
                  } : styles.mediaImage}
                  resizeMode="cover"
                  onLoad={(e) => {
                    const { width, height } = e.nativeEvent.source
                    if (width && height) {
                      setImageDimensions((prev) => ({
                        ...prev,
                        [firstPhotoVideo.index]: { width, height },
                      }))
                    }
                  }}
                />
              </TouchableOpacity>
              {/* Caption below image (only for Journal photos) */}
              {entry.prompt?.category === "Journal" && entry.captions?.[firstPhotoVideo.index] && (
                <Text style={styles.captionText}>{entry.captions[firstPhotoVideo.index]}</Text>
              )}
            </View>
          ) : (
            <View style={styles.mediaWrapper}>
              <VideoPlayer 
                uri={firstPhotoVideo.url} 
                index={firstPhotoVideo.index}
                videoId={`${entry.id}-video-${firstPhotoVideo.index}`}
                dimensions={videoDimensions[firstPhotoVideo.index]}
                onLoad={(dimensions) => {
                  setVideoDimensions((prev) => ({
                    ...prev,
                    [firstPhotoVideo.index]: dimensions,
                  }))
                }}
              />
            </View>
          )
        )}

        {/* Comment Icons, React Button with Reactions, and CTA Button */}
        <View style={styles.actionsRow}>
          <View style={styles.actionsLeft}>
            <View style={styles.actionsLeft}>
              {/* Comment Icon - moved to left */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={(e) => {
                  e.stopPropagation()
                  handleEntryPress(true) // Scroll to comments
                }}
                activeOpacity={0.7}
              >
                <FontAwesome 
                  name={(comments || []).length > 0 ? "comment" : "comment-o"} 
                  size={20} 
                  color={theme2Colors.text}
                  style={(comments || []).length > 0 ? styles.iconSolid : styles.iconOutline}
                />
                {(comments || []).length > 0 && <Text style={styles.actionCount}>{(comments || []).length}</Text>}
              </TouchableOpacity>

              {/* React Button and Reactions - moved to right of comment */}
              <View style={styles.reactionsRow}>
                {/* Only show React Button if user hasn't reacted yet */}
                {currentUserReactions.length === 0 && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={(e) => {
                      e.stopPropagation()
                      if (userId) {
                        setShowEmojiPicker(true)
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Image
                      source={require("../assets/images/react.png")}
                      style={styles.reactIcon}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                )}
                
                {/* Reactions as avatars with emojis */}
                {reactions.map((reaction) => {
                  const emoji = reaction.type || "❤️"
                  const user = (reaction as any).user
                  return (
                    <TouchableOpacity
                      key={reaction.id}
                      style={styles.reactionAvatarContainer}
                      onPress={(e) => {
                        e.stopPropagation()
                        if (userId) {
                          handleSelectEmoji(emoji)
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.reactionAvatarWrapper}>
                        <Avatar
                          uri={user?.avatar_url}
                          name={user?.name || "User"}
                          size={25}
                        />
                      </View>
                      <View style={styles.reactionEmojiOverlay}>
                        <Text style={styles.reactionEmojiOverlayText}>{emoji}</Text>
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          </View>
        </View>

        {/* Comments Preview - Inside the card */}
        {(comments || []).length > 0 && (
          <View style={styles.commentsContainer}>
          {(comments || []).length <= 10 ? (
            // Show all comments if 10 or fewer
            <>
              {(comments || []).map((comment: any) => {
              const commentReactions = commentReactionsMap[comment.id] || []
              const currentUserCommentReactions = commentReactions.filter((r: any) => r.user_id === userId).map((r: any) => r.type || "❤️")
              
              return (
                <TouchableOpacity
                key={comment.id}
                style={styles.commentPreviewItem}
                onPress={(e) => {
                  e.stopPropagation()
                  handleEntryPress(true) // Scroll to comments
                }}
                activeOpacity={0.7}
              >
                <View style={styles.commentPreviewContent}>
                  {(() => {
                    // Cycle through theme colors for comment avatars
                    const avatarColors = [theme2Colors.red, theme2Colors.yellow, theme2Colors.green, theme2Colors.blue]
                    const colorIndex = comment.id ? parseInt(comment.id.slice(-1), 16) % 4 : 0
                    const borderColor = avatarColors[colorIndex]
                    return (
                      <Avatar uri={comment.user?.avatar_url} name={comment.user?.name || "User"} size={32} borderColor={isDark ? borderColor : undefined} />
                    )
                  })()}
                  <View style={styles.commentPreviewTextContainer}>
                    <View style={styles.commentPreviewUserRow}>
                      <Text style={styles.commentPreviewUser}>{comment.user?.name} </Text>
                      {/* Spacer to push reactions/react button to the right */}
                      <View style={{ flex: 1 }} />
                      {/* Reactions and React Button - Right aligned */}
                      <View style={styles.commentReactionsAndButtonContainer}>
                        {/* Comment Reactions - On right side, next to React button */}
                        {commentReactions.length > 0 && (
                          <View style={[styles.commentReactionsContainer, currentUserCommentReactions.length > 0 && styles.commentReactionsContainerNoButton]}>
                            {commentReactions.map((reaction: any) => {
                              const emoji = reaction.type || "❤️"
                              const user = reaction.user
                              return (
                                <TouchableOpacity
                                  key={reaction.id}
                                  style={styles.commentReactionAvatarContainer}
                                  onPress={(e) => {
                                    e.stopPropagation()
                                    if (userId) {
                                      handleSelectCommentEmoji(comment.id, emoji)
                                    }
                                  }}
                                  activeOpacity={0.7}
                                >
                                  <View style={styles.commentReactionAvatarWrapper}>
                                    <Avatar
                                      uri={user?.avatar_url}
                                      name={user?.name || "User"}
                                      size={25}
                                    />
                                  </View>
                                  <View style={styles.commentReactionEmojiOverlay}>
                                    <Text style={styles.commentReactionEmojiOverlayText}>{emoji}</Text>
                                  </View>
                                </TouchableOpacity>
                              )
                            })}
                          </View>
                        )}
                        {/* React Button - Top right corner */}
                        {currentUserCommentReactions.length === 0 && (
                          <TouchableOpacity
                            style={styles.commentReactButton}
                            onPress={(e) => {
                              e.stopPropagation()
                              if (userId) {
                                setCommentEmojiPickerCommentId(comment.id)
                              }
                            }}
                            activeOpacity={0.7}
                          >
                            <Image
                              source={require("../assets/images/react.png")}
                              style={styles.commentReactIcon}
                              resizeMode="contain"
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    {comment.text && (
                      <Text style={styles.commentPreviewText} numberOfLines={2}>
                        {comment.text}
                      </Text>
                    )}
                    {comment.media_url && comment.media_type && (
                      <View style={styles.commentMediaThumbnailContainer}>
                        {comment.media_type === "photo" && (
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation()
                              if (comment.media_type === "photo") {
                                // Get all comment photos for lightbox
                                const commentPhotos = comments
                                  .map((c: any) => c.media_url && c.media_type === "photo" ? c.media_url : null)
                                  .filter((url): url is string => url !== null)
                                const photoIndex = commentPhotos.indexOf(comment.media_url)
                                setCommentLightboxPhotos(commentPhotos)
                                setCommentLightboxIndex(photoIndex >= 0 ? photoIndex : 0)
                                setCommentLightboxVisible(true)
                              }
                            }}
                            activeOpacity={0.9}
                          >
                            <Image
                              source={{ uri: comment.media_url }}
                              style={styles.commentMediaThumbnail}
                              resizeMode="cover"
                            />
                          </TouchableOpacity>
                        )}
                        {comment.media_type === "video" && comment.media_url && (
                          <CommentVideoPlayer
                            commentId={comment.id}
                            uri={comment.media_url}
                            onVideoRef={(ref) => {
                              if (ref) {
                                commentVideoRefs.current[`comment-${comment.id}`] = ref
                              }
                            }}
                            isPlaying={commentVideoPlaying[comment.id] || false}
                            isMuted={commentVideoMuted[comment.id] ?? false}
                            progress={commentVideoProgress[comment.id] || 0}
                            duration={commentVideoDurations[comment.id] || 0}
                            isLoading={commentVideoLoading[comment.id] || false}
                            onPlayPause={() => handleCommentVideoPlayPause(comment.id, comment.media_url)}
                            onRestart={() => handleCommentVideoRestart(comment.id)}
                            onToggleMute={() => handleCommentVideoToggleMute(comment.id)}
                            onProgressChange={(progress) => setCommentVideoProgress((prev) => ({ ...prev, [comment.id]: progress }))}
                            onDurationChange={(duration) => setCommentVideoDurations((prev) => ({ ...prev, [comment.id]: duration }))}
                            onSeek={(position) => handleCommentVideoSeek(comment.id, position)}
                          />
                        )}
                        {comment.media_type === "audio" && comment.media_url && (
                          <TouchableOpacity
                            style={styles.commentAudioPill}
                            onPress={(e) => {
                              e.stopPropagation()
                              const audioId = `comment-${comment.id}`
                              handleToggleAudio(audioId, comment.media_url)
                            }}
                            activeOpacity={0.85}
                          >
                            <View style={styles.commentAudioIcon}>
                              {audioLoading[`comment-${comment.id}`] ? (
                                <ActivityIndicator size="small" color={colors.white} />
                              ) : (
                                <FontAwesome
                                  name={activeAudioId === `comment-${comment.id}` ? "pause" : "play"}
                                  size={14}
                                  color={colors.white}
                                />
                              )}
                            </View>
                            <Text style={styles.commentAudioLabel}>
                              {formatMillis(audioProgress[`comment-${comment.id}`] || 0)} /{" "}
                              {audioDurations[`comment-${comment.id}`] ? formatMillis(audioDurations[`comment-${comment.id}`]) : "--:--"}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                </View>
                </TouchableOpacity>
              )
              })}
            </>
          ) : (
            // Show first 10 comments and "+N comments" if more than 10
            <>
              {(comments || []).slice(0, 10).map((comment: any) => {
                const commentReactions = commentReactionsMap[comment.id] || []
                const currentUserCommentReactions = commentReactions.filter((r: any) => r.user_id === userId).map((r: any) => r.type || "❤️")
                
                return (
                  <TouchableOpacity
                  key={comment.id}
                  style={styles.commentPreviewItem}
                  onPress={(e) => {
                    e.stopPropagation()
                    handleEntryPress(true) // Scroll to comments
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.commentPreviewContent}>
                    {(() => {
                      // Cycle through theme colors for comment avatars
                      const avatarColors = [theme2Colors.red, theme2Colors.yellow, theme2Colors.green, theme2Colors.blue]
                      const colorIndex = comment.id ? parseInt(comment.id.slice(-1), 16) % 4 : 0
                      const borderColor = avatarColors[colorIndex]
                      return (
                        <Avatar uri={comment.user?.avatar_url} name={comment.user?.name || "User"} size={40} borderColor={borderColor} />
                      )
                    })()}
                    <View style={styles.commentPreviewTextContainer}>
                      <View style={styles.commentPreviewUserRow}>
                        <Text style={styles.commentPreviewUser}>{comment.user?.name} </Text>
                        {/* Spacer to push reactions/react button to the right */}
                        <View style={{ flex: 1 }} />
                        {/* Reactions and React Button - Right aligned */}
                        <View style={styles.commentReactionsAndButtonContainer}>
                          {/* Comment Reactions - On right side, next to React button */}
                          {commentReactions.length > 0 && (
                            <View style={[styles.commentReactionsContainer, currentUserCommentReactions.length > 0 && styles.commentReactionsContainerNoButton]}>
                              {commentReactions.map((reaction: any) => {
                                const emoji = reaction.type || "❤️"
                                const user = reaction.user
                                return (
                                  <TouchableOpacity
                                    key={reaction.id}
                                    style={styles.commentReactionAvatarContainer}
                                    onPress={(e) => {
                                      e.stopPropagation()
                                      if (userId) {
                                        handleSelectCommentEmoji(comment.id, emoji)
                                      }
                                    }}
                                    activeOpacity={0.7}
                                  >
                                    <View style={styles.commentReactionAvatarWrapper}>
                                      <Avatar
                                        uri={user?.avatar_url}
                                        name={user?.name || "User"}
                                        size={25}
                                      />
                                    </View>
                                    <View style={styles.commentReactionEmojiOverlay}>
                                      <Text style={styles.commentReactionEmojiOverlayText}>{emoji}</Text>
                                    </View>
                                  </TouchableOpacity>
                                )
                              })}
                            </View>
                          )}
                          {/* React Button - Top right corner */}
                          {currentUserCommentReactions.length === 0 && (
                            <TouchableOpacity
                              style={styles.commentReactButton}
                              onPress={(e) => {
                                e.stopPropagation()
                                if (userId) {
                                  setCommentEmojiPickerCommentId(comment.id)
                                }
                              }}
                              activeOpacity={0.7}
                            >
                              <Image
                                source={require("../assets/images/react.png")}
                                style={styles.commentReactIcon}
                                resizeMode="contain"
                              />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                      {comment.text && (
                        <Text style={styles.commentPreviewText} numberOfLines={2}>
                          {comment.text}
                        </Text>
                      )}
                      {comment.media_url && comment.media_type && (
                        <View style={styles.commentMediaThumbnailContainer}>
                          {comment.media_type === "photo" && (
                            <TouchableOpacity
                              onPress={(e) => {
                                e.stopPropagation()
                                if (comment.media_type === "photo") {
                                  // Get all comment photos for lightbox
                                  const commentPhotos = comments
                                    .map((c: any) => c.media_url && c.media_type === "photo" ? c.media_url : null)
                                    .filter((url): url is string => url !== null)
                                  const photoIndex = commentPhotos.indexOf(comment.media_url)
                                  setCommentLightboxPhotos(commentPhotos)
                                  setCommentLightboxIndex(photoIndex >= 0 ? photoIndex : 0)
                                  setCommentLightboxVisible(true)
                                }
                              }}
                              activeOpacity={0.9}
                            >
                              <Image
                                source={{ uri: comment.media_url }}
                                style={styles.commentMediaThumbnail}
                                resizeMode="cover"
                              />
                            </TouchableOpacity>
                          )}
                          {comment.media_type === "video" && comment.media_url && (
                            <CommentVideoPlayer
                              commentId={comment.id}
                              uri={comment.media_url}
                              onVideoRef={(ref) => {
                                if (ref) {
                                  commentVideoRefs.current[`comment-${comment.id}`] = ref
                                }
                              }}
                              isPlaying={commentVideoPlaying[comment.id] || false}
                              isMuted={commentVideoMuted[comment.id] ?? false}
                              progress={commentVideoProgress[comment.id] || 0}
                              duration={commentVideoDurations[comment.id] || 0}
                              isLoading={commentVideoLoading[comment.id] || false}
                              onPlayPause={() => handleCommentVideoPlayPause(comment.id, comment.media_url)}
                              onRestart={() => handleCommentVideoRestart(comment.id)}
                              onToggleMute={() => handleCommentVideoToggleMute(comment.id)}
                              onProgressChange={(progress) => setCommentVideoProgress((prev) => ({ ...prev, [comment.id]: progress }))}
                              onDurationChange={(duration) => setCommentVideoDurations((prev) => ({ ...prev, [comment.id]: duration }))}
                              onSeek={(position) => handleCommentVideoSeek(comment.id, position)}
                            />
                          )}
                          {comment.media_type === "audio" && (
                            <TouchableOpacity
                              onPress={(e) => {
                                e.stopPropagation()
                                // For audio, navigate to entry detail
                                handleEntryPress(true)
                              }}
                              activeOpacity={0.9}
                            >
                              <View style={styles.commentAudioThumbnail}>
                                <FontAwesome name="microphone" size={14} color={theme2Colors.textSecondary} />
                              </View>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                  </TouchableOpacity>
                )
              })}
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation()
                  handleEntryPress(true) // Scroll to comments
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.commentPreviewMore}>+{(comments || []).length - 10} comments</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        )}
        
        {/* Fuzzy overlay when user hasn't answered */}
        {showFuzzyOverlay && (
          <View style={styles.fuzzyOverlay} pointerEvents="none">
            {/* Dark background overlay to increase opacity and hide text completely */}
            <View style={styles.fuzzyOverlayBackground} />
            <Image
              source={require("../assets/images/fuzzy.png")}
              style={styles.fuzzyOverlayImage}
              resizeMode="cover"
            />
          </View>
        )}
      </TouchableOpacity>

      {/* Separator */}
      <View style={styles.separator} />

      {/* Emoji Picker Modal */}
      <EmojiPicker
        visible={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onSelectEmoji={handleSelectEmoji}
        currentReactions={currentUserReactions}
      />

      {/* Comment Emoji Picker Modal */}
      {commentEmojiPickerCommentId && (
        <EmojiPicker
          visible={!!commentEmojiPickerCommentId}
          onClose={() => setCommentEmojiPickerCommentId(null)}
          onSelectEmoji={(emoji) => handleSelectCommentEmoji(commentEmojiPickerCommentId, emoji)}
          currentReactions={commentReactionsMap[commentEmojiPickerCommentId]?.filter((r: any) => r.user_id === userId).map((r: any) => r.type || "❤️") || []}
        />
      )}

      {/* User Profile Modal */}
      <UserProfileModal
        visible={userProfileModalVisible}
        userId={selectedMember?.id || null}
        userName={selectedMember?.name || null}
        userAvatarUrl={selectedMember?.avatar_url}
        groupId={entry.group_id}
        onClose={() => {
          setUserProfileModalVisible(false)
          setSelectedMember(null)
        }}
        onViewHistory={(userId) => {
          router.push({
            pathname: "/(main)/history",
            params: {
              focusGroupId: entry.group_id,
              filterMemberId: userId,
            },
          })
        }}
      />

      {/* Comment Photo Lightbox */}
      <PhotoLightbox
        visible={commentLightboxVisible}
        photos={commentLightboxPhotos}
        initialIndex={commentLightboxIndex}
        onClose={() => setCommentLightboxVisible(false)}
      />

      {/* Status Modal - only show for current user */}
      {isCurrentUser && (
        <StatusModal
          visible={statusModalVisible}
          userId={entry.user_id}
          userName={entry.user?.name || "User"}
          userAvatarUrl={entry.user?.avatar_url}
          groupId={entry.group_id}
          date={entry.date}
          existingStatus={userStatus?.status_text || null}
          onClose={() => setStatusModalVisible(false)}
          onPost={async (statusText: string) => {
            await statusMutation.mutateAsync(statusText)
          }}
        />
      )}
    </View>
  )
}

// Component to render video player with controls
function VideoPlayer({ 
  uri, 
  index,
  videoId,
  dimensions,
  onLoad,
  containerStyle
}: {
  uri: string
  index: number
  videoId: string
  dimensions?: { width: number; height: number }
  onLoad: (dimensions: { width: number; height: number }) => void
  containerStyle?: any
}) {
  const videoRef = useRef<Video>(null)
  const progressContainerRef = useRef<View>(null)
  const { colors, isDark } = useTheme()
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false) // Unmuted by default
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isSeeking, setIsSeeking] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  // Handle tap/seek on progress bar
  const handleProgressTap = async (evt: any) => {
    if (!progressContainerRef.current || !duration || !videoRef.current) return
    
    // Extract touch position before async operation to avoid event pooling issues
    const touchX = evt.nativeEvent.locationX
    
    progressContainerRef.current.measure(async (x, y, width) => {
      const percentage = Math.max(0, Math.min(1, touchX / width))
      const seekPosition = percentage * duration
      try {
        const wasPlaying = isPlaying
        if (wasPlaying) {
          await videoRef.current.pauseAsync()
        }
        await videoRef.current.setPositionAsync(seekPosition)
        setProgress(seekPosition)
        if (wasPlaying) {
          await videoRef.current.playAsync()
        }
      } catch (error) {
        console.error("[VideoPlayer] Error seeking:", error)
      }
    })
  }

  // PanResponder for scrubbing progress bar
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsSeeking(true)
        // Pause video while seeking
        if (videoRef.current && isPlaying) {
          videoRef.current.pauseAsync().catch(() => {})
        }
      },
      onPanResponderMove: (evt) => {
        if (!progressContainerRef.current || !duration) return
        // Extract touch position before async operation
        const touchX = evt.nativeEvent.locationX
        progressContainerRef.current.measure((x, y, width) => {
          const percentage = Math.max(0, Math.min(1, touchX / width))
          const seekPosition = percentage * duration
          setProgress(seekPosition)
        })
      },
      onPanResponderRelease: async (evt) => {
        if (!progressContainerRef.current || !duration) {
          setIsSeeking(false)
          return
        }
        // Extract touch position before async operation
        const touchX = evt.nativeEvent.locationX
        progressContainerRef.current.measure(async (x, y, width) => {
          const percentage = Math.max(0, Math.min(1, touchX / width))
          const seekPosition = percentage * duration
          try {
            if (videoRef.current) {
              await videoRef.current.setPositionAsync(seekPosition)
              setProgress(seekPosition)
              // Resume playing if it was playing before
              if (isPlaying) {
                await videoRef.current.playAsync()
              }
            }
          } catch (error) {
            console.error("[VideoPlayer] Error seeking:", error)
          }
          setIsSeeking(false)
        })
      },
      onPanResponderTerminate: () => {
        setIsSeeking(false)
      },
    })
  ).current
  
  useEffect(() => {
    // Configure audio session for video playback
    async function setupAudioSession() {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        })
      } catch (error) {
        console.error("[VideoPlayer] Error setting up audio session:", error)
      }
    }
    
    setupAudioSession()
    
    // No autoplay - user must click play button
    
    return () => {
      if (videoRef.current) {
        videoRef.current.pauseAsync().catch(() => {})
        videoRef.current.unloadAsync().catch(() => {})
      }
    }
  }, [])
  
  async function handlePlayPause() {
    if (!videoRef.current) {
      // Video ref not ready yet, wait a bit and try again
      setTimeout(() => {
        if (videoRef.current) {
          handlePlayPause()
        }
      }, 100)
      return
    }
    
    try {
      setIsLoading(true)
      const status = await videoRef.current.getStatusAsync()
      
      if (status.isLoaded) {
        if (status.isPlaying) {
          await videoRef.current.pauseAsync()
          setIsPlaying(false)
        } else {
          // Ensure video is unmuted when playing
          if (isMuted) {
            await Audio.setAudioModeAsync({
              allowsRecordingIOS: false,
              playsInSilentModeIOS: true,
            })
            await videoRef.current.setIsMutedAsync(false)
            setIsMuted(false)
          }
          await videoRef.current.playAsync()
          setIsPlaying(true)
        }
      } else {
        // Video not loaded yet, load and play
        if (videoRef.current) {
          await videoRef.current.loadAsync({ uri })
          // Ensure video is unmuted when playing
          if (isMuted) {
            await Audio.setAudioModeAsync({
              allowsRecordingIOS: false,
              playsInSilentModeIOS: true,
            })
            await videoRef.current.setIsMutedAsync(false)
            setIsMuted(false)
          }
          await videoRef.current.playAsync()
          setIsPlaying(true)
        }
      }
    } catch (error: any) {
      console.error("[VideoPlayer] Error toggling playback:", error)
      // Handle AVFoundation errors (e.g., -11800 = corrupted/inaccessible video)
      setHasError(true)
      setErrorMessage("Unable to play video. The file may be corrupted or unavailable.")
      setIsPlaying(false)
      setIsLoading(false)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleRestart() {
    if (!videoRef.current) return
    
    try {
      setIsLoading(true)
      setHasError(false) // Clear any previous errors when retrying
      setErrorMessage(null)
      await videoRef.current.setPositionAsync(0)
      // Ensure video is unmuted when playing
      if (isMuted) {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        })
        await videoRef.current.setIsMutedAsync(false)
        setIsMuted(false)
      }
      await videoRef.current.playAsync()
      setIsPlaying(true)
      setProgress(0)
    } catch (error: any) {
      console.error("[VideoPlayer] Error restarting:", error)
      setHasError(true)
      setErrorMessage("Unable to play video. The file may be corrupted or unavailable.")
      setIsPlaying(false)
      setIsLoading(false)
    } finally {
      setIsLoading(false)
    }
  }
  
  async function handleToggleMute() {
    if (!videoRef.current) return
    const newMutedState = !isMuted
    
    try {
      // Configure audio session when unmuting (important for iOS devices)
      if (!newMutedState) {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        })
      }
      await videoRef.current.setIsMutedAsync(newMutedState)
      setIsMuted(newMutedState)
    } catch (error) {
      console.error("[VideoPlayer] Error toggling mute:", error)
    }
  }
  
  function formatTime(ms: number) {
    if (!ms || isNaN(ms)) return "0:00"
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }
  
  // Theme 2 color palette - dynamic based on dark/light mode
  const theme2Colors = useMemo(() => {
    if (isDark) {
      // Dark mode colors
      return {
        red: "#B94444",
        yellow: "#E8A037",
        green: "#2D6F4A",
        blue: "#3A5F8C",
        beige: "#000000", // Black (was beige)
        cream: "#111111", // Dark gray (was cream)
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

  const videoStyles = useMemo(() => StyleSheet.create({
    videoContainer: {
      width: "100%",
      height: containerStyle?.height || SCREEN_WIDTH, // Square aspect ratio (1:1) for gallery-like appearance
      backgroundColor: theme2Colors.beige,
      justifyContent: "center",
      alignItems: "center",
      position: "relative",
      overflow: "hidden",
      alignSelf: "stretch",
      borderRadius: 12,
      ...containerStyle,
    },
    video: {
      width: "100%",
      height: "100%",
    },
    controlsOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 2,
    },
    volumeButton: {
      position: "absolute",
      top: spacing.md,
      right: spacing.md,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      justifyContent: "center",
      alignItems: "center",
    },
    playPauseButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      justifyContent: "center",
      alignItems: "center",
    },
    restartButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      justifyContent: "center",
      alignItems: "center",
    },
    controlsRow: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.md,
    },
    progressContainer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: 40, // Doubled height for easier touch target and dragging
      backgroundColor: "rgba(0, 0, 0, 0.3)",
      justifyContent: "center",
      paddingVertical: spacing.xs, // Add padding for better touch area
    },
    progressBarTrack: {
      height: 8, // Doubled height for better visibility and dragging
      width: "100%",
      backgroundColor: "rgba(255, 255, 255, 0.2)",
      borderRadius: 4,
    },
    progressBar: {
      height: "100%",
      backgroundColor: theme2Colors.blue,
    },
    progressTime: {
      position: "absolute",
      bottom: spacing.sm,
      right: spacing.sm,
      ...typography.caption,
      fontSize: 10,
      color: theme2Colors.white,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      borderRadius: 4,
    },
    errorOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 10,
      padding: spacing.lg,
    },
    errorText: {
      ...typography.body,
      color: theme2Colors.white,
      textAlign: "center",
      marginBottom: spacing.sm,
    },
    errorIcon: {
      marginBottom: spacing.md,
    },
  }), [theme2Colors, containerStyle])

  return (
    <View 
      style={videoStyles.videoContainer}
    >
      <Video
        ref={videoRef}
        source={{ uri }}
        style={videoStyles.video}
        resizeMode={ResizeMode.COVER}
        shouldPlay={isPlaying}
        isMuted={isMuted}
        isLooping={false}
        useNativeControls={false}
        onLoad={(status) => {
          if (status.isLoaded) {
            if (status.durationMillis) {
              setDuration(status.durationMillis)
            }
            if (!dimensions) {
              onLoad({ width: SCREEN_WIDTH, height: SCREEN_WIDTH })
            }
            // Don't auto-play - user must click play button
          }
        }}
        onPlaybackStatusUpdate={(status) => {
          if (status.isLoaded) {
            // Clear error state if video loads successfully
            if (hasError) {
              setHasError(false)
              setErrorMessage(null)
            }
            if (status.positionMillis !== undefined) {
              setProgress(status.positionMillis)
            }
            if (status.durationMillis && !duration) {
              setDuration(status.durationMillis)
            }
            if (status.didJustFinish) {
              // Video finished - pause and reset to start position
              videoRef.current?.pauseAsync().then(() => {
                videoRef.current?.setPositionAsync(0).then(() => {
                  setProgress(0)
                  setIsPlaying(false)
                }).catch(() => {})
              }).catch(() => {})
            }
          } else if ((status as any).error) {
            // Handle playback errors from status
            const error = (status as any).error
            console.error("[VideoPlayer] Playback error:", error)
            setHasError(true)
            setErrorMessage("Unable to play video. The file may be corrupted or unavailable.")
            setIsPlaying(false)
            setIsLoading(false)
          }
        }}
        onError={(error) => {
          console.error("[VideoPlayer] Video error:", error)
          setHasError(true)
          setErrorMessage("Unable to load video. The file may be corrupted or unavailable.")
          setIsPlaying(false)
          setIsLoading(false)
        }}
      />
      {/* Error overlay - show when video fails to load/play */}
      {hasError && (
        <View style={videoStyles.errorOverlay}>
          <FontAwesome 
            name="exclamation-triangle" 
            size={32} 
            color={theme2Colors.white}
            style={videoStyles.errorIcon}
          />
          <Text style={videoStyles.errorText}>
            {errorMessage || "Unable to play video"}
          </Text>
        </View>
      )}
      
      <View 
        style={videoStyles.controlsOverlay}
        pointerEvents="box-none"
      >
        {/* Volume control - top right */}
        {!hasError && (
          <TouchableOpacity
            style={videoStyles.volumeButton}
            onPress={(e) => {
              e.stopPropagation()
              handleToggleMute()
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <FontAwesome 
              name={isMuted ? "volume-off" : "volume-up"} 
              size={16} 
              color={theme2Colors.white} 
            />
          </TouchableOpacity>
        )}
        
        {/* Play/Pause and Restart buttons - center */}
        {!isPlaying && !hasError && (
          <View style={videoStyles.controlsRow} pointerEvents="box-none">
            {/* Restart button - left of play button (only show if progress > 1s) */}
            {progress > 1000 && (
              <TouchableOpacity
                style={videoStyles.restartButton}
                onPress={(e) => {
                  e.stopPropagation()
                  handleRestart()
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={theme2Colors.white} />
                ) : (
                  <FontAwesome name="refresh" size={18} color={theme2Colors.white} />
                )}
              </TouchableOpacity>
            )}
            
            {/* Play button */}
            <TouchableOpacity
              style={videoStyles.playPauseButton}
              onPress={(e) => {
                e.stopPropagation()
                handlePlayPause()
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={theme2Colors.white} />
              ) : (
                <FontAwesome name="play" size={20} color={theme2Colors.white} />
              )}
            </TouchableOpacity>
          </View>
        )}
        
        {/* Full-screen tap area for play/pause - covers video area, not controls - hide when error */}
        {!hasError && (
          <TouchableOpacity
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 40, // Leave space for progress bar at bottom
            }}
            activeOpacity={1}
            onPress={(e) => {
              e.stopPropagation()
              // When playing, tap to pause; when paused, tap to play
              handlePlayPause()
            }}
            pointerEvents="auto"
          />
        )}
        
        {/* Progress bar - bottom (scrubbable) - hide when error */}
        {!hasError && (
          <TouchableOpacity
            ref={progressContainerRef}
            style={videoStyles.progressContainer}
            {...panResponder.panHandlers}
            onPress={(e) => {
              e.stopPropagation()
              handleProgressTap(e)
            }}
            activeOpacity={1}
          >
            <View 
              style={videoStyles.progressBarTrack}
              pointerEvents="none"
            >
              <View 
                style={[
                  videoStyles.progressBar,
                  { width: duration > 0 ? `${(progress / duration) * 100}%` : "0%" }
                ]} 
                pointerEvents="none"
              />
            </View>
            <Text style={videoStyles.progressTime}>
              {formatTime(progress)} / {formatTime(duration)}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

// Component to render comment video player with controls (similar to VideoPlayer)
function CommentVideoPlayer({
  commentId,
  uri,
  onVideoRef,
  isPlaying,
  isMuted,
  progress,
  duration,
  isLoading,
  onPlayPause,
  onRestart,
  onToggleMute,
  onProgressChange,
  onDurationChange,
  onSeek,
}: {
  commentId: string
  uri: string
  onVideoRef: (ref: Video | null) => void
  isPlaying: boolean
  isMuted: boolean
  progress: number
  duration: number
  isLoading: boolean
  onPlayPause: () => void
  onRestart: () => void
  onToggleMute: () => void
  onProgressChange: (progress: number) => void
  onDurationChange: (duration: number) => void
  onSeek: (position: number) => void
}) {
  const videoRef = useRef<Video>(null)
  const progressContainerRef = useRef<View>(null)
  const { colors, isDark } = useTheme()
  const [isSeeking, setIsSeeking] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    onVideoRef(videoRef.current)
    return () => {
      onVideoRef(null)
    }
  }, [])

  // Theme 2 color palette
  const theme2Colors = useMemo(() => {
    if (isDark) {
      return {
        red: "#B94444",
        yellow: "#E8A037",
        green: "#2D6F4A",
        blue: "#3A5F8C",
        beige: "#000000",
        cream: "#111111",
        white: "#E8E0D5",
        text: "#F5F0EA",
        textSecondary: "#A0A0A0",
      }
    } else {
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

  // Handle tap/seek on progress bar
  const handleProgressTap = async (evt: any) => {
    if (!progressContainerRef.current || !duration || !videoRef.current) return
    
    const touchX = evt.nativeEvent.locationX
    
    progressContainerRef.current.measure(async (x, y, width) => {
      const percentage = Math.max(0, Math.min(1, touchX / width))
      const seekPosition = percentage * duration
      onSeek(seekPosition)
    })
  }

  // PanResponder for scrubbing progress bar
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsSeeking(true)
        if (videoRef.current && isPlaying) {
          videoRef.current.pauseAsync().catch(() => {})
        }
      },
      onPanResponderMove: (evt) => {
        if (!progressContainerRef.current || !duration) return
        const touchX = evt.nativeEvent.locationX
        progressContainerRef.current.measure((x, y, width) => {
          const percentage = Math.max(0, Math.min(1, touchX / width))
          const seekPosition = percentage * duration
          onProgressChange(seekPosition)
        })
      },
      onPanResponderRelease: async (evt) => {
        if (!progressContainerRef.current || !duration) {
          setIsSeeking(false)
          return
        }
        const touchX = evt.nativeEvent.locationX
        progressContainerRef.current.measure(async (x, y, width) => {
          const percentage = Math.max(0, Math.min(1, touchX / width))
          const seekPosition = percentage * duration
          try {
            if (videoRef.current) {
              await videoRef.current.setPositionAsync(seekPosition)
              onProgressChange(seekPosition)
              if (isPlaying) {
                await videoRef.current.playAsync()
              }
            }
          } catch (error) {
            console.error("[CommentVideoPlayer] Error seeking:", error)
          }
          setIsSeeking(false)
        })
      },
      onPanResponderTerminate: () => {
        setIsSeeking(false)
      },
    })
  ).current

  const commentVideoStyles = useMemo(() => StyleSheet.create({
    videoContainer: {
      width: "100%",
      aspectRatio: 1,
      backgroundColor: theme2Colors.beige,
      justifyContent: "center",
      alignItems: "center",
      position: "relative",
      overflow: "hidden",
      borderRadius: 12,
    },
    video: {
      width: "100%",
      height: "100%",
    },
    controlsOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 2,
    },
    volumeButton: {
      position: "absolute",
      top: spacing.md,
      right: spacing.md,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      justifyContent: "center",
      alignItems: "center",
    },
    playPauseButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      justifyContent: "center",
      alignItems: "center",
    },
    restartButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      justifyContent: "center",
      alignItems: "center",
    },
    controlsRow: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.md,
    },
    progressContainer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: 40,
      backgroundColor: "rgba(0, 0, 0, 0.3)",
      justifyContent: "center",
      paddingVertical: spacing.xs,
    },
    progressBarTrack: {
      height: 8,
      width: "100%",
      backgroundColor: "rgba(255, 255, 255, 0.2)",
      borderRadius: 4,
    },
    progressBar: {
      height: "100%",
      backgroundColor: theme2Colors.blue,
    },
    errorOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.8)",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 10,
    },
    errorText: {
      ...typography.body,
      color: theme2Colors.white,
      textAlign: "center",
      marginTop: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    errorIcon: {
      marginBottom: spacing.xs,
    },
  }), [theme2Colors])

  return (
    <View style={commentVideoStyles.videoContainer}>
      <Video
        ref={(ref) => {
          videoRef.current = ref
          onVideoRef(ref)
        }}
        source={{ uri }}
        style={commentVideoStyles.video}
        resizeMode={ResizeMode.COVER}
        shouldPlay={isPlaying}
        isMuted={isMuted}
        isLooping={false}
        useNativeControls={false}
        onLoad={(status) => {
          if (status.isLoaded && status.durationMillis) {
            // Clear error state if video loads successfully
            if (hasError) {
              setHasError(false)
              setErrorMessage(null)
            }
            onDurationChange(status.durationMillis)
          }
        }}
        onPlaybackStatusUpdate={(status) => {
          if (status.isLoaded) {
            // Clear error state if video loads successfully
            if (hasError) {
              setHasError(false)
              setErrorMessage(null)
            }
            if (status.positionMillis !== undefined) {
              if (!isSeeking) {
                onProgressChange(status.positionMillis)
              }
            }
            if (status.durationMillis && !duration) {
              onDurationChange(status.durationMillis)
            }
            if (status.didJustFinish) {
              // Video finished - pause and reset to start position
              videoRef.current?.pauseAsync().then(() => {
                videoRef.current?.setPositionAsync(0).then(() => {
                  onProgressChange(0)
                  onPlayPause() // This will set isPlaying to false
                }).catch(() => {})
              }).catch(() => {})
            }
          } else if ((status as any).error) {
            // Handle playback errors from status
            const error = (status as any).error
            console.error("[CommentVideoPlayer] Playback error:", error)
            setHasError(true)
            setErrorMessage("Unable to play video. The file may be corrupted or unavailable.")
            onPlayPause() // This will set isPlaying to false
          }
        }}
        onError={(error) => {
          console.error("[CommentVideoPlayer] Video error:", error)
          setHasError(true)
          setErrorMessage("Unable to load video. The file may be corrupted or unavailable.")
          onPlayPause() // This will set isPlaying to false
        }}
      />
      <View 
        style={commentVideoStyles.controlsOverlay}
        pointerEvents="box-none"
      >
        {/* Volume control - top right */}
        <TouchableOpacity
          style={commentVideoStyles.volumeButton}
          onPress={(e) => {
            e.stopPropagation()
            onToggleMute()
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <FontAwesome 
            name={isMuted ? "volume-off" : "volume-up"} 
            size={16} 
            color={theme2Colors.white} 
          />
        </TouchableOpacity>
        
        {/* Play/Pause and Restart buttons - center */}
        {!isPlaying && (
          <View style={commentVideoStyles.controlsRow} pointerEvents="box-none">
            {/* Restart button - only show if progress > 1s */}
            {progress > 1000 && (
              <TouchableOpacity
                style={commentVideoStyles.restartButton}
                onPress={(e) => {
                  e.stopPropagation()
                  onRestart()
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={theme2Colors.white} />
                ) : (
                  <FontAwesome name="refresh" size={18} color={theme2Colors.white} />
                )}
              </TouchableOpacity>
            )}
            
            {/* Play button */}
            <TouchableOpacity
              style={commentVideoStyles.playPauseButton}
              onPress={(e) => {
                e.stopPropagation()
                onPlayPause()
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={theme2Colors.white} />
              ) : (
                <FontAwesome name="play" size={20} color={theme2Colors.white} />
              )}
            </TouchableOpacity>
          </View>
        )}
        
        {/* Full-screen tap area for play/pause - covers video area, not controls */}
        <TouchableOpacity
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 40, // Leave space for progress bar at bottom
          }}
          activeOpacity={1}
          onPress={(e) => {
            e.stopPropagation()
            // When playing, tap to pause; when paused, tap to play
            onPlayPause()
          }}
          pointerEvents="auto"
        />
        
        {/* Progress bar - bottom (scrubbable) */}
        <TouchableOpacity
          ref={progressContainerRef}
          style={commentVideoStyles.progressContainer}
          {...panResponder.panHandlers}
          onPress={(e) => {
            e.stopPropagation()
            handleProgressTap(e)
          }}
          activeOpacity={1}
          hitSlop={{ top: 10, bottom: 10, left: 0, right: 0 }}
        >
          <View 
            style={commentVideoStyles.progressBarTrack}
            pointerEvents="none"
          >
            <View 
              style={[
                commentVideoStyles.progressBar,
                { width: duration > 0 ? `${(progress / duration) * 100}%` : "0%" }
              ]} 
              pointerEvents="none"
            />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  )
}
