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
import { getComments, getMemorials, getReactions, toggleReaction, toggleEmojiReaction, getGroupMembers } from "../lib/db"
import { EmojiPicker } from "./EmojiPicker"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { personalizeMemorialPrompt, replaceDynamicVariables } from "../lib/prompts"
import { MentionableText } from "./MentionableText"
import { UserProfileModal } from "./UserProfileModal"
import { PhotoLightbox } from "./PhotoLightbox"

const { width: SCREEN_WIDTH } = Dimensions.get("window")

interface EntryCardProps {
  entry: Entry
  entryIds?: string[]
  index?: number
  returnTo?: string
  showFuzzyOverlay?: boolean
  onEntryPress?: (entryDate: string) => void // Callback to store entry date before navigation
}

export function EntryCard({ entry, entryIds, index = 0, returnTo = "/(main)/home", showFuzzyOverlay = false, onEntryPress }: EntryCardProps) {
  const router = useRouter()
  const { colors, isDark } = useTheme()
  const audioRefs = useRef<Record<string, Audio.Sound>>({})
  const videoRefs = useRef<Record<string, Video>>({})
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null)
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null)
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
    // Removed fuzzy overlay logic - users can now view entries without answering
    
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

  // Personalize prompt question if it has placeholders
  const personalizedQuestion = useMemo(() => {
    if (!entry.prompt?.question) return entry.prompt?.question
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
    queryFn: async () => {
      const { data } = await supabase
        .from("comments")
        .select("*, user:users(*)")
        .eq("entry_id", entry.id)
        .order("created_at", { ascending: true })
      return data || []
    },
    enabled: !!entry.id,
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
    onSuccess: () => {
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
    // Removed fuzzyOverlay style - no longer needed
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
    photoCarouselItem: {
      width: SCREEN_WIDTH * 0.75, // Smaller to show part of next image
      height: SCREEN_WIDTH * 0.75,
      overflow: "hidden",
      backgroundColor: theme2Colors.beige,
      marginRight: spacing.xs, // Reduced margin
      borderRadius: 12,
    },
    photoCarouselItemLast: {
      marginRight: 0, // Remove margin from last item
    },
    photoCarouselImage: {
      width: "100%",
      height: "100%",
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
      gap: spacing.xs,
      flexWrap: "wrap",
      marginLeft: -5, // Move 20% closer to comment icon (20% of spacing.lg = 24 * 0.2 = 4.8, rounded to 5)
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
    borderColor: theme2Colors.textSecondary,
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
    width: "100%", // Take full width of container
  },
  commentMediaThumbnail: {
    width: 230,
    height: 230, // Fixed height to ensure square
    borderRadius: 12,
    backgroundColor: colors.gray[900],
    position: "relative",
  },
  commentMediaThumbnailVideo: {
    width: "100%",
    height: "100%",
  },
  commentVideoOverlay: {
    position: "absolute",
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 12,
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
    alignSelf: "flex-start",
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
          <FontAwesome name="chevron-right" size={14} color={theme2Colors.textSecondary} style={styles.arrowIcon} />
        </View>

        {/* Question */}
        <Text style={styles.question}>{personalizedQuestion || entry.prompt?.question}</Text>

        {/* Text Content */}
        {entry.text_content && (
          <View style={styles.textContainer}>
            <MentionableText 
              text={entry.text_content} 
              textStyle={styles.entryText} 
              linkStyle={styles.link} 
              mentionStyle={styles.mention}
              groupId={entry.group_id}
              onMentionPress={handleMentionPress}
              numberOfLines={MAX_TEXT_LINES}
            />
            {/* Fade overlay for last 2 lines (only when exceeding 14 lines) */}
            {shouldShowFade && (
              <View style={styles.textFadeOverlay} pointerEvents="none">
                <View style={styles.fadeLine1} />
                <View style={styles.fadeLine2} />
              </View>
            )}
          </View>
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
              {photoVideoMedia.map((item, idx) => (
                <TouchableOpacity
                  key={item.index}
                  onPress={(e) => {
                    e.stopPropagation()
                    handleEntryPress()
                  }}
                  activeOpacity={0.9}
                  style={[
                    styles.photoCarouselItem,
                    idx === photoVideoMedia.length - 1 && styles.photoCarouselItemLast
                  ]}
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
              ))}
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
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation()
              handleEntryPress()
            }}
            activeOpacity={0.9}
            style={styles.mediaWrapper}
          >
            {firstPhotoVideo.type === "photo" ? (
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
            ) : (
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
            )}
          </TouchableOpacity>
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
                  name={comments.length > 0 ? "comment" : "comment-o"} 
                  size={20} 
                  color={theme2Colors.text}
                  style={comments.length > 0 ? styles.iconSolid : styles.iconOutline}
                />
                {comments.length > 0 && <Text style={styles.actionCount}>{comments.length}</Text>}
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
                
                {/* Reactions inline with React button */}
                {Object.entries(reactionsByEmoji).map(([emoji, data]) => (
                  <TouchableOpacity
                    key={emoji}
                    style={styles.reactionBadge}
                    onPress={(e) => {
                      e.stopPropagation()
                      if (userId) {
                        handleSelectEmoji(emoji)
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                    {data.count > 1 && (
                      <Text style={styles.reactionCount}>{data.count}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Comments Preview - Inside the card */}
        {comments.length > 0 && (
          <View style={styles.commentsContainer}>
          {comments.length <= 10 ? (
            // Show all comments if 10 or fewer
            comments.map((comment: any) => (
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
                    <Text style={styles.commentPreviewUser}>{comment.user?.name}: </Text>
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
                        {comment.media_type === "video" && (
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation()
                              // For videos, navigate to entry detail (lightbox doesn't support videos well)
                              handleEntryPress(true)
                            }}
                            activeOpacity={0.9}
                          >
                            <View style={styles.commentMediaThumbnail}>
                              <Video
                                source={{ uri: comment.media_url }}
                                style={styles.commentMediaThumbnailVideo}
                                resizeMode={ResizeMode.COVER}
                                isMuted={true}
                                shouldPlay={false}
                                useNativeControls={false}
                              />
                              <View style={styles.commentVideoOverlay}>
                                <FontAwesome name="play-circle" size={20} color={colors.white} />
                              </View>
                            </View>
                          </TouchableOpacity>
                        )}
                        {comment.media_type === "audio" && (
                          <TouchableOpacity
                            style={styles.commentAudioPill}
                            onPress={(e) => {
                              e.stopPropagation()
                              const audioId = `comment-${comment.id}`
                              handleToggleAudio(audioId, comment.media_url!)
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
            ))
          ) : (
            // Show first 10 comments and "+N comments" if more than 10
            <>
              {comments.slice(0, 10).map((comment: any) => (
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
                      <Text style={styles.commentPreviewUser}>{comment.user?.name}: </Text>
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
                          {comment.media_type === "video" && (
                            <TouchableOpacity
                              onPress={(e) => {
                                e.stopPropagation()
                                // For videos, navigate to entry detail (lightbox doesn't support videos well)
                                handleEntryPress(true)
                              }}
                              activeOpacity={0.9}
                            >
                              <View style={styles.commentMediaThumbnail}>
                                <Video
                                  source={{ uri: comment.media_url }}
                                  style={styles.commentMediaThumbnailVideo}
                                  resizeMode={ResizeMode.COVER}
                                  isMuted={true}
                                  shouldPlay={false}
                                  useNativeControls={false}
                                />
                                <View style={styles.commentVideoOverlay}>
                                  <FontAwesome name="play-circle" size={20} color={colors.white} />
                                </View>
                              </View>
                            </TouchableOpacity>
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
              ))}
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation()
                  handleEntryPress(true) // Scroll to comments
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.commentPreviewMore}>+{comments.length - 10} comments</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        )}
        
        {/* Fuzzy overlay when user hasn't answered */}
        {/* Removed fuzzy overlay - users can now view entries without answering */}
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
  const [isMuted, setIsMuted] = useState(true)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isSeeking, setIsSeeking] = useState(false)
  
  // PanResponder for scrubbing progress bar
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsSeeking(true)
      },
      onPanResponderMove: (evt) => {
        if (!progressContainerRef.current || !duration) return
        progressContainerRef.current.measure((x, y, width) => {
          const touchX = evt.nativeEvent.locationX
          const percentage = Math.max(0, Math.min(1, touchX / width))
          const seekPosition = percentage * duration
          setProgress(seekPosition)
        })
      },
      onPanResponderRelease: async (evt) => {
        if (!progressContainerRef.current || !duration || !videoRef.current) {
          setIsSeeking(false)
          return
        }
        progressContainerRef.current.measure(async (x, y, width) => {
          const touchX = evt.nativeEvent.locationX
          const percentage = Math.max(0, Math.min(1, touchX / width))
          const seekPosition = percentage * duration
          try {
            await videoRef.current.setPositionAsync(seekPosition)
            setProgress(seekPosition)
          } catch (error) {
            console.error("[VideoPlayer] Error seeking:", error)
          }
          setIsSeeking(false)
        })
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
    
    // Autoplay when component mounts
    const timer = setTimeout(() => {
      handlePlayPause()
    }, 500) // Small delay to ensure video is loaded
    
    return () => {
      clearTimeout(timer)
      if (videoRef.current) {
        videoRef.current.pauseAsync().catch(() => {})
        videoRef.current.unloadAsync().catch(() => {})
      }
    }
  }, [])
  
  async function handlePlayPause() {
    if (!videoRef.current) return
    
    try {
      setIsLoading(true)
      const status = await videoRef.current.getStatusAsync()
      
      if (status.isLoaded) {
        if (status.isPlaying) {
          await videoRef.current.pauseAsync()
          setIsPlaying(false)
        } else {
          await videoRef.current.playAsync()
          setIsPlaying(true)
        }
      } else {
        // Video not loaded yet, load and play
        await videoRef.current.loadAsync({ uri })
        await videoRef.current.playAsync()
        setIsPlaying(true)
      }
    } catch (error) {
      console.error("[VideoPlayer] Error toggling playback:", error)
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
      position: "absolute",
      top: "50%",
      left: "50%",
      marginTop: -24,
      marginLeft: -24,
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      justifyContent: "center",
      alignItems: "center",
    },
    progressContainer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: 20, // Increased height for easier touch target
      backgroundColor: "rgba(0, 0, 0, 0.3)",
      justifyContent: "center",
    },
    progressBarTrack: {
      height: 4,
      width: "100%",
      backgroundColor: "rgba(255, 255, 255, 0.2)",
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
  }), [theme2Colors, containerStyle])

  return (
    <TouchableOpacity 
      style={videoStyles.videoContainer}
      activeOpacity={1}
      onPress={(e) => {
        e.stopPropagation()
        handlePlayPause()
      }}
    >
      <Video
        ref={videoRef}
        source={{ uri }}
        style={videoStyles.video}
        resizeMode={ResizeMode.COVER}
        shouldPlay={isPlaying}
        isMuted={isMuted}
        isLooping={true}
        useNativeControls={false}
        onLoad={(status) => {
          if (status.isLoaded) {
            if (status.durationMillis) {
              setDuration(status.durationMillis)
            }
            if (!dimensions) {
              onLoad({ width: SCREEN_WIDTH, height: SCREEN_WIDTH })
            }
            // Auto-play after load
            if (!isPlaying) {
              videoRef.current?.playAsync().then(() => setIsPlaying(true)).catch(() => {})
            }
          }
        }}
        onPlaybackStatusUpdate={(status) => {
          if (status.isLoaded) {
            if (status.positionMillis !== undefined) {
              setProgress(status.positionMillis)
            }
            if (status.durationMillis && !duration) {
              setDuration(status.durationMillis)
            }
            if (status.didJustFinish) {
              // Loop video
              videoRef.current?.setPositionAsync(0).then(() => {
                videoRef.current?.playAsync().catch(() => {})
              }).catch(() => {})
            }
          }
        }}
      />
      <View style={videoStyles.controlsOverlay} pointerEvents="box-none">
        {/* Volume control - top right */}
        <TouchableOpacity
          style={videoStyles.volumeButton}
          onPress={(e) => {
            e.stopPropagation()
            handleToggleMute()
          }}
        >
          <FontAwesome 
            name={isMuted ? "volume-off" : "volume-up"} 
            size={16} 
            color={theme2Colors.white} 
          />
        </TouchableOpacity>
        
        {/* Play/Pause button - center */}
        {!isPlaying && (
          <TouchableOpacity
            style={videoStyles.playPauseButton}
            onPress={(e) => {
              e.stopPropagation()
              handlePlayPause()
            }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={theme2Colors.white} />
            ) : (
              <FontAwesome name="play" size={20} color={theme2Colors.white} />
            )}
          </TouchableOpacity>
        )}
        
        {/* Progress bar - bottom (scrubbable) */}
        <View 
          ref={progressContainerRef}
          style={videoStyles.progressContainer}
          {...panResponder.panHandlers}
        >
          <View style={videoStyles.progressBarTrack}>
            <View 
              style={[
                videoStyles.progressBar,
                { width: duration > 0 ? `${(progress / duration) * 100}%` : "0%" }
              ]} 
            />
          </View>
        </View>
        
        {/* Time display - bottom right */}
        {duration > 0 && (
          <Text style={videoStyles.progressTime}>
            {formatTime(progress)} / {formatTime(duration)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  )
}
