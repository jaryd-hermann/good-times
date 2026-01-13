"use client"

import { useCallback, useEffect, useRef, useState, useMemo } from "react"
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  ActivityIndicator,
  Keyboard,
  AppState,
  PanResponder,
  Animated,
  Dimensions,
} from "react-native"
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router"
import * as ImagePicker from "expo-image-picker"
import { Audio, Video, ResizeMode } from "expo-av"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "../../../lib/supabase"
import { createEntry, updateEntry, getAllPrompts, getMemorials, getGroupMembers, getGroup, getEntryById, getEntriesForDate, getUserEntryForDate, getDailyPrompt } from "../../../lib/db"
import type { Prompt } from "../../../lib/types"
import { uploadMedia } from "../../../lib/storage"
import { typography, spacing } from "../../../lib/theme"
import { useTheme } from "../../../lib/theme-context"
import { getTodayDate } from "../../../lib/utils"
import { Button } from "../../../components/Button"
import { FontAwesome } from "@expo/vector-icons"
import { parseEmbedUrl, extractEmbedUrls, type ParsedEmbed } from "../../../lib/embed-parser"
import { EmbeddedPlayer } from "../../../components/EmbeddedPlayer"
import * as Clipboard from "expo-clipboard"
import { personalizeMemorialPrompt, replaceDynamicVariables } from "../../../lib/prompts"
import { MentionAutocomplete } from "../../../components/MentionAutocomplete"

// Helper function to get day index (matches home.tsx logic)
function getDayIndex(dateString: string, groupId?: string) {
  const base = new Date(dateString)
  const start = new Date("2020-01-01")
  const diff = Math.floor((base.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  const groupOffset = groupId ? groupId.length : 0
  return diff + groupOffset
}
import { UserProfileModal } from "../../../components/UserProfileModal"
import { VideoMessageModal } from "../../../components/VideoMessageModal"
import * as FileSystem from "expo-file-system/legacy"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { usePostHog } from "posthog-react-native"
import { captureEvent, safeCapture } from "../../../lib/posthog"
import { updateBadgeCount } from "../../../lib/notifications-badge"

type MediaItem = {
  id: string
  uri: string
  type: "photo" | "video" | "audio"
  thumbnailUri?: string // For video thumbnails
}

function createMediaId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export default function EntryComposer() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { colors, isDark } = useTheme()
  const promptId = params.promptId as string
  // Ensure date is always a valid string - handle null, undefined, or empty string
  const dateParam = params.date as string | null | undefined
  const date = (dateParam && typeof dateParam === 'string' && dateParam.trim() !== '') ? dateParam : getTodayDate()
  const returnTo = (params.returnTo as string) || undefined
  const groupIdParam = params.groupId as string | undefined
  const entryId = params.entryId as string | undefined
  const editMode = params.editMode === "true"

  const [text, setText] = useState("")
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState<Audio.Recording>()
  const [currentGroupId, setCurrentGroupId] = useState<string>()
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null)
  const [audioProgress, setAudioProgress] = useState<Record<string, number>>({})
  const [audioDurations, setAudioDurations] = useState<Record<string, number>>({})
  const [audioLoading, setAudioLoading] = useState<Record<string, boolean>>({})
  const audioRefs = useRef<Record<string, Audio.Sound>>({})
  const [userId, setUserId] = useState<string>()
  const [voiceModalVisible, setVoiceModalVisible] = useState(false)
  const [voiceDuration, setVoiceDuration] = useState(0)
  const [voiceUri, setVoiceUri] = useState<string | undefined>()
  const [isPlayingVoice, setIsPlayingVoice] = useState(false)
  const [availablePrompts, setAvailablePrompts] = useState<Prompt[]>([])
  const [activePrompt, setActivePrompt] = useState<Prompt | undefined>()
  const originalPromptIdRef = useRef<string | undefined>(promptId) // Store original promptId
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const soundRef = useRef<Audio.Sound | null>(null)
  const queryClient = useQueryClient()
  const [embeddedMedia, setEmbeddedMedia] = useState<ParsedEmbed[]>([])
  const [showSongModal, setShowSongModal] = useState(false)
  const [songUrlInput, setSongUrlInput] = useState("")
  const [showVideoModal, setShowVideoModal] = useState(false)
  const [showVideoTooltip, setShowVideoTooltip] = useState(false)
  const videoButtonRef = useRef<View>(null)
  const [videoButtonLayout, setVideoButtonLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const textInputRef = useRef<TextInput>(null)
  const scrollViewRef = useRef<ScrollView>(null)
  const inputContainerRef = useRef<View>(null)
  const mediaCarouselRef = useRef<View>(null)
  const previousMediaCountRef = useRef<number>(0)
  const mediaCarouselYRef = useRef<number | null>(null)
  const inputContainerYRef = useRef<number | null>(null)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [uploadingMedia, setUploadingMedia] = useState<Record<string, boolean>>({})
  const currentScrollYRef = useRef<number>(0)
  const [showUploadingModal, setShowUploadingModal] = useState(false)
  const [showFileSizeModal, setShowFileSizeModal] = useState(false)
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const dragPosition = useRef(new Animated.ValueXY()).current
  const posthog = usePostHog()
  const scrollViewHeightRef = useRef<number>(0)
  
  // Mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState("")
  const [showMentionAutocomplete, setShowMentionAutocomplete] = useState(false)
  const [selectedMentionUser, setSelectedMentionUser] = useState<{ id: string; name: string; avatar_url?: string } | null>(null)
  const [userProfileModalVisible, setUserProfileModalVisible] = useState(false)
  const cursorPositionRef = useRef<number>(0)
  const [isNavigating, setIsNavigating] = useState(false) // Track when navigating to hide content immediately
  const draftSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Draft saving functionality
  const getDraftKey = useCallback(() => {
    if (!promptId || !date || !currentGroupId) return null
    return `entry_draft_${promptId}_${date}_${currentGroupId}`
  }, [promptId, date, currentGroupId])
  
  // Save draft to AsyncStorage (debounced)
  const saveDraft = useCallback(async (draftText: string) => {
    const draftKey = getDraftKey()
    if (!draftKey) return
    
    try {
      await AsyncStorage.setItem(draftKey, draftText)
    } catch (error) {
      console.warn("[entry-composer] Failed to save draft:", error)
    }
  }, [getDraftKey])
  
  // Load draft from AsyncStorage
  const loadDraft = useCallback(async () => {
    if (editMode) return // Don't load draft in edit mode
    
    const draftKey = getDraftKey()
    if (!draftKey) return
    
    try {
      const draftText = await AsyncStorage.getItem(draftKey)
      if (draftText && draftText.trim().length > 0) {
        setText(draftText)
      }
    } catch (error) {
      console.warn("[entry-composer] Failed to load draft:", error)
    }
  }, [getDraftKey, editMode])
  
  // Clear draft from AsyncStorage
  const clearDraft = useCallback(async () => {
    const draftKey = getDraftKey()
    if (!draftKey) return
    
    try {
      await AsyncStorage.removeItem(draftKey)
    } catch (error) {
      console.warn("[entry-composer] Failed to clear draft:", error)
    }
  }, [getDraftKey])
  
  // CRITICAL: Reasonable file size limits to prevent memory crashes
  // Large files loaded entirely into memory can crash the app
  // Videos are most problematic, so stricter limit
  const MAX_VIDEO_SIZE = 100 * 1024 * 1024 // 100MB for videos
  const MAX_PHOTO_SIZE = 50 * 1024 * 1024 // 50MB for photos
  const MAX_AUDIO_SIZE = 50 * 1024 * 1024 // 50MB for audio

  useEffect(() => {
    loadUserAndGroup()
  }, [groupIdParam])

  // Load draft when component mounts or when promptId/date/groupId changes
  useEffect(() => {
    if (currentGroupId && !editMode && promptId && date) {
      // Small delay to ensure form reset has completed
      const timer = setTimeout(() => {
        loadDraft()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [currentGroupId, promptId, date, loadDraft, editMode])

  // Save draft when text changes (debounced)
  useEffect(() => {
    if (editMode || !currentGroupId) return // Don't save draft in edit mode
    
    // Clear existing timeout
    if (draftSaveTimeoutRef.current) {
      clearTimeout(draftSaveTimeoutRef.current)
    }
    
    // Save draft after 1 second of no changes
    draftSaveTimeoutRef.current = setTimeout(() => {
      if (text.trim().length > 0) {
        saveDraft(text)
      } else {
        // Clear draft if text is empty
        clearDraft()
      }
    }, 1000) as unknown as NodeJS.Timeout
    
    return () => {
      if (draftSaveTimeoutRef.current) {
        clearTimeout(draftSaveTimeoutRef.current)
      }
    }
  }, [text, saveDraft, clearDraft, editMode, currentGroupId])

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "background" || nextAppState === "inactive") {
        // Save draft immediately when app goes to background
        if (text.trim().length > 0 && !editMode && currentGroupId) {
          saveDraft(text)
        }
      } else if (nextAppState === "active") {
        // Reload draft when app comes back to foreground
        if (!editMode && currentGroupId) {
          loadDraft()
        }
      }
    })
    
    return () => {
      subscription.remove()
    }
  }, [text, saveDraft, loadDraft, editMode, currentGroupId])

  // Reset isNavigating when composer opens (promptId or date changes)
  useEffect(() => {
    setIsNavigating(false)
  }, [promptId, date])

  // Also reset isNavigating when screen comes into focus (handles case where user reopens without params changing)
  useFocusEffect(
    useCallback(() => {
      setIsNavigating(false)
    }, [])
  )

  // Check if video tooltip should be shown
  useEffect(() => {
    async function checkVideoTooltip() {
      if (!userId) return
      const hasSeenTooltip = await AsyncStorage.getItem(`video_tooltip_seen_${userId}`)
      if (!hasSeenTooltip) {
        // Small delay to ensure layout is ready
        setTimeout(() => {
          setShowVideoTooltip(true)
        }, 500)
      }
    }
    checkVideoTooltip()
  }, [userId])

  // Dismiss tooltip
  async function dismissVideoTooltip() {
    if (!userId) return
    setShowVideoTooltip(false)
    await AsyncStorage.setItem(`video_tooltip_seen_${userId}`, "true")
  }

  // Listen to keyboard events to adjust toolbar position
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

  async function loadUserAndGroup() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      setUserId(user.id)
      
      // If groupId is passed as param, use it (most reliable)
      if (groupIdParam) {
        // Verify user is a member of this group
        const { data: membership } = await supabase
          .from("group_members")
          .select("group_id")
          .eq("user_id", user.id)
          .eq("group_id", groupIdParam)
          .single()
        if (membership) {
          setCurrentGroupId(groupIdParam)
          return
        }
      }
      
      // Fallback: get the most recently joined group (not just first)
      const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id)
        .order("joined_at", { ascending: false })
        .limit(1)
      if (memberships && memberships.length > 0) {
        setCurrentGroupId(memberships[0].group_id)
      }
    }
  }

  const { data: prompt } = useQuery({
    queryKey: ["prompt", promptId],
    queryFn: async () => {
      const { data } = await supabase.from("prompts").select("*").eq("id", promptId).single()
      return data
    },
    enabled: !!promptId,
  })

  // Load existing entry when in edit mode
  const { data: existingEntry } = useQuery({
    queryKey: ["entry", entryId],
    queryFn: () => (entryId ? getEntryById(entryId) : null),
    enabled: editMode && !!entryId,
  })

  useEffect(() => {
    async function loadPrompts() {
      const prompts = await getAllPrompts()
      setAvailablePrompts(prompts)
    }
    loadPrompts()
  }, [])

  useEffect(() => {
    if (prompt?.id) {
      // Only set active prompt if it matches the original promptId
      // This ensures that when user reopens composer, they see the original prompt
      if (prompt.id === originalPromptIdRef.current) {
        setActivePrompt(prompt as Prompt)
      }
    }
  }, [prompt])
  
  // Reset to original prompt when component unmounts (user closes without posting)
  useEffect(() => {
    return () => {
      // On unmount, reset to original prompt
      // This ensures that shuffled prompts don't persist if user closes without posting
      originalPromptIdRef.current = promptId
    }
  }, [promptId])

  // Fetch memorials and members for variable replacement
  const { data: memorials = [] } = useQuery({
    queryKey: ["memorials", currentGroupId],
    queryFn: () => (currentGroupId ? getMemorials(currentGroupId) : []),
    enabled: !!currentGroupId && !!activePrompt?.question?.match(/\{.*memorial_name.*\}/i),
  })

  const { data: members = [] } = useQuery({
    queryKey: ["members", currentGroupId],
    queryFn: () => (currentGroupId ? getGroupMembers(currentGroupId) : []),
    enabled: !!currentGroupId && !!activePrompt?.question?.match(/\{.*member_name.*\}/i),
  })

  // Fetch all members for mention autocomplete (exclude current user)
  const { data: mentionUsers = [] } = useQuery({
    queryKey: ["mentionUsers", currentGroupId, userId],
    queryFn: async () => {
      if (!currentGroupId || !userId) return []
      const members = await getGroupMembers(currentGroupId)
      // Filter out current user and map to MentionUser format
      return members
        .filter((m) => m.user_id !== userId)
        .map((m) => ({
          id: m.user_id,
          name: m.user?.name || "User",
          avatar_url: m.user?.avatar_url,
        }))
    },
    enabled: !!currentGroupId && !!userId,
  })

  // Fetch prompt_name_usage for member_name to get the exact name that was stored
  // CRITICAL: Use the stored name from prompt_name_usage, not recalculate
  const { data: memberNameUsage = [] } = useQuery({
    queryKey: ["memberNameUsage", currentGroupId, date, promptId],
    queryFn: async () => {
      if (!currentGroupId || !promptId || !date) return []
      const { data, error } = await supabase
        .from("prompt_name_usage")
        .select("prompt_id, date_used, name_used, created_at")
        .eq("group_id", currentGroupId)
        .eq("variable_type", "member_name")
        .order("created_at", { ascending: true })
      if (error) {
        console.error("[entry-composer] Error fetching member name usage:", error)
        return []
      }
      return (data || []) as Array<{ prompt_id: string; date_used: string; name_used: string; created_at: string }>
    },
    enabled: !!currentGroupId && !!promptId && !!date && !!activePrompt?.question?.match(/\{.*member_name.*\}/i),
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
  })

  // Fetch prompt_name_usage for memorial_name to get the exact name that was stored
  // CRITICAL: Use the stored name from prompt_name_usage, not recalculate
  const { data: memorialNameUsage = [] } = useQuery({
    queryKey: ["memorialNameUsage", currentGroupId, date, promptId],
    queryFn: async () => {
      if (!currentGroupId || !promptId || !date) return []
      const { data, error } = await supabase
        .from("prompt_name_usage")
        .select("prompt_id, date_used, name_used, created_at")
        .eq("group_id", currentGroupId)
        .eq("variable_type", "memorial_name")
        .order("created_at", { ascending: true })
      if (error) {
        console.error("[entry-composer] Error fetching memorial name usage:", error)
        return []
      }
      return (data || []) as Array<{ prompt_id: string; date_used: string; name_used: string; created_at: string }>
    },
    enabled: !!currentGroupId && !!promptId && !!date && !!activePrompt?.question?.match(/\{.*memorial_name.*\}/i),
    staleTime: 0, // Always fetch fresh data
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

  // Personalize prompt question with variables
  // CRITICAL: Use prompt_name_usage to ensure consistency with home screen
  const personalizedQuestion = useMemo(() => {
    if (!activePrompt?.question) return activePrompt?.question
    
    let question = activePrompt.question
    const variables: Record<string, string> = {}
    
    // Handle memorial_name variable - check prompt_name_usage first
    // CRITICAL: Use the stored name from prompt_name_usage to ensure consistency with home screen
    if (question.match(/\{.*memorial_name.*\}/i)) {
      if (promptId && date && memorials.length > 0) {
        const normalizedDate = date.split('T')[0]
        const usageKey = `${promptId}-${normalizedDate}`
        const memorialNameUsed = memorialUsageMap.get(usageKey)
        
        if (memorialNameUsed) {
          // Use the exact name from prompt_name_usage (ensures consistency)
          question = personalizeMemorialPrompt(question, memorialNameUsed)
        } else {
          // Fallback: if no usage record exists, use deterministic logic to match home screen
          console.warn(`[entry-composer] No prompt_name_usage found for memorial_name, using fallback logic`)
          // Use the same logic as home screen: getDayIndex based selection
          const dayIndex = getDayIndex(date, currentGroupId || "")
          const memorialIndex = dayIndex % memorials.length
          const selectedMemorialName = memorials[memorialIndex]?.name
          if (selectedMemorialName) {
            question = personalizeMemorialPrompt(question, selectedMemorialName)
          }
        }
      } else if (memorials.length > 0) {
        // Fallback if we don't have promptId/date
        console.warn(`[entry-composer] Missing promptId/date for memorial_name, using first memorial as fallback`)
        question = personalizeMemorialPrompt(question, memorials[0].name)
      }
    }
    
    // Handle member_name variable - ONLY use prompt_name_usage, NO fallback
    // CRITICAL: Must use the exact name from prompt_name_usage that getDailyPrompt set
    if (question.match(/\{.*member_name.*\}/i)) {
      if (promptId && date && currentGroupId) {
        const normalizedDate = date.split('T')[0]
        const usageKey = `${promptId}-${normalizedDate}`
        const memberNameUsed = memberUsageMap.get(usageKey)
        
        if (memberNameUsed) {
          // Use the exact name from prompt_name_usage (ensures consistency)
          variables.member_name = memberNameUsed
          question = replaceDynamicVariables(question, variables)
        } else {
          // Missing record - create it using the SAME deterministic logic as getDailyPrompt
          // This ensures consistency and fixes data inconsistencies
          console.warn(`[entry-composer] No prompt_name_usage found for member_name, will create it. promptId: ${promptId}, date: ${date}, groupId: ${currentGroupId}`)
          // Don't replace variable here - useEffect will create the record and refetch
        }
      } else {
        // Missing required data - log error
        console.error(`[entry-composer] Missing data for member_name replacement. promptId: ${promptId}, date: ${date}, currentGroupId: ${currentGroupId}`)
        // Leave {member_name} as-is
      }
    }
    
    return question
  }, [activePrompt?.question, memorials, members, memberUsageMap, memorialUsageMap, promptId, date, currentGroupId, userId])

  // Create missing prompt_name_usage record if needed (matches getDailyPrompt logic)
  useEffect(() => {
    async function createMissingMemberNameRecord() {
      if (!activePrompt?.question?.match(/\{.*member_name.*\}/i)) return
      if (!promptId || !date || !currentGroupId || !userId) return
      
      const normalizedDate = date.split('T')[0]
      const usageKey = `${promptId}-${normalizedDate}`
      const memberNameUsed = memberUsageMap.get(usageKey)
      
      // If record already exists, nothing to do
      if (memberNameUsed) return
      
      // Check if record exists in database (might not be in cache yet)
      const { data: existingUsage } = await supabase
        .from("prompt_name_usage")
        .select("name_used")
        .eq("group_id", currentGroupId)
        .eq("prompt_id", promptId)
        .eq("variable_type", "member_name")
        .eq("date_used", normalizedDate)
        .maybeSingle()
      
      if (existingUsage?.name_used) {
        // Record exists, just refetch to update cache
        queryClient.invalidateQueries({ queryKey: ["memberNameUsage", currentGroupId, date, promptId] })
        return
      }
      
      // Record doesn't exist - create it using same logic as getDailyPrompt
      try {
        const allMembers = await getGroupMembers(currentGroupId)
        const otherMembers = allMembers.filter((m) => m.user_id !== userId)
        
        if (otherMembers.length > 0) {
          // Get recently used member names
          const { data: recentUsage } = await supabase
            .from("prompt_name_usage")
            .select("name_used")
            .eq("group_id", currentGroupId)
            .eq("variable_type", "member_name")
            .neq("date_used", normalizedDate)
            .order("date_used", { ascending: false })
            .limit(otherMembers.length)

          const usedNames = new Set(recentUsage?.map((u) => u.name_used) || [])
          
          const unusedMembers = otherMembers.filter((m) => {
            const memberName = m.user?.name || "Unknown"
            return !usedNames.has(memberName)
          })
          
          const availableMembers = unusedMembers.length > 0 ? unusedMembers : otherMembers
          
          // Use same deterministic logic as getDailyPrompt
          const dayIndex = getDayIndex(normalizedDate, currentGroupId)
          const memberIndex = dayIndex % availableMembers.length
          const selectedMember = availableMembers[memberIndex]
          
          const selectedName = selectedMember.user?.name || "them"

          // Create the record
          const { error: insertError } = await supabase.from("prompt_name_usage").insert({
            group_id: currentGroupId,
            prompt_id: promptId,
            variable_type: "member_name",
            name_used: selectedName,
            date_used: normalizedDate,
          })
          
          if (insertError) {
            if (insertError.code !== '23505') {
              console.error(`[entry-composer] Failed to create prompt_name_usage:`, insertError.message)
            } else {
              // Duplicate - another call created it, just refetch
              console.log(`[entry-composer] Record already exists, refetching`)
            }
          } else {
            console.log(`[entry-composer] Created missing prompt_name_usage record: ${selectedName}`)
          }
          
          // Refetch to update cache
          queryClient.invalidateQueries({ queryKey: ["memberNameUsage", currentGroupId, date, promptId] })
        }
      } catch (error) {
        console.error(`[entry-composer] Error creating prompt_name_usage:`, error)
      }
    }
    
    createMissingMemberNameRecord()
  }, [activePrompt?.question, promptId, date, currentGroupId, userId, memberUsageMap, queryClient])

  // Load existing entry data when in edit mode
  useEffect(() => {
    if (editMode && existingEntry && existingEntry.id) {
      // Pre-fill text
      setText(existingEntry.text_content || "")
      
      // Pre-fill media items (existing URLs)
      if (existingEntry.media_urls && existingEntry.media_urls.length > 0) {
        const existingMediaItems: MediaItem[] = existingEntry.media_urls.map((url, index) => {
          const mediaType = existingEntry.media_types?.[index] || "photo"
          return {
            id: `existing-${index}-${Date.now()}`,
            uri: url,
            type: mediaType as "photo" | "video" | "audio",
          }
        })
        setMediaItems(existingMediaItems)
        
        // Load audio durations for existing audio items
        existingMediaItems.forEach((item) => {
          if (item.type === "audio") {
            Audio.Sound.createAsync({ uri: item.uri })
              .then(({ sound }) => {
                sound.getStatusAsync().then((status) => {
                  if (status.isLoaded && status.durationMillis) {
                    setAudioDurations((prev) => ({ ...prev, [item.id]: status.durationMillis! }))
                  }
                  sound.unloadAsync().catch(() => {})
                })
              })
              .catch(() => {})
          }
        })
      }
      
      // Pre-fill embedded media
      if (existingEntry.embedded_media && existingEntry.embedded_media.length > 0) {
        setEmbeddedMedia(existingEntry.embedded_media as ParsedEmbed[])
      }
      
      // Set the prompt (cannot be changed in edit mode)
      if (existingEntry.prompt && existingEntry.prompt_id) {
        setActivePrompt(existingEntry.prompt as Prompt)
        originalPromptIdRef.current = existingEntry.prompt_id
      }
    }
  }, [editMode, existingEntry])

  // Reset form when promptId or date changes (new question) - but not in edit mode
  useEffect(() => {
    if (editMode) return // Don't reset form in edit mode
    
    // Store original promptId when component mounts or promptId changes
    originalPromptIdRef.current = promptId
    
    // Clear text first - draft will be loaded by loadDraft effect if it exists
    setText("")
    setMediaItems([])
    setVoiceUri(undefined)
    setVoiceDuration(0)
    setIsPlayingVoice(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (soundRef.current) {
      soundRef.current.unloadAsync().catch(() => {})
      soundRef.current = null
    }
    // Clean up audio refs
    Object.values(audioRefs.current).forEach((sound) => {
      sound.unloadAsync().catch(() => {})
    })
    audioRefs.current = {}
    setPlayingAudioId(null)
    setAudioProgress({})
    setAudioDurations({})
    setAudioLoading({})
    
    // Reset to original prompt when promptId changes (user reopened composer)
    if (promptId && promptId === originalPromptIdRef.current && prompt?.id) {
      setActivePrompt(prompt as Prompt)
    }
  }, [promptId, date, prompt, editMode])

  // Keyboard listener removed to prevent push animation

  // Detect embed URLs on blur - preserve existing embeds
  function handleTextBlur() {
    const newEmbeds = extractEmbedUrls(text)
    // Merge with existing embeds, avoiding duplicates
    setEmbeddedMedia((prev) => {
      const merged = [...prev]
      newEmbeds.forEach((newEmbed) => {
        const exists = merged.some((e) => e.url === newEmbed.url || e.embedId === newEmbed.embedId)
        if (!exists) {
          merged.push(newEmbed)
        }
      })
      return merged
    })
  }

  // Handle paste in text input
  async function handlePaste() {
    try {
      const clipboardText = await Clipboard.getStringAsync()
      if (clipboardText) {
        const parsed = parseEmbedUrl(clipboardText.trim())
        if (parsed) {
          // Add to embedded media if not already present
          setEmbeddedMedia((prev) => {
            const exists = prev.some((e) => e.url === parsed.url)
            if (exists) return prev
            return [...prev, parsed]
          })
        }
      }
    } catch (error) {
      // Ignore clipboard errors
    }
  }

  // Add song from modal
  function handleAddSong() {
    const parsed = parseEmbedUrl(songUrlInput.trim())
    if (parsed) {
      setEmbeddedMedia((prev) => {
        const exists = prev.some((e) => e.url === parsed.url || e.embedId === parsed.embedId)
        if (exists) {
          Alert.alert("Already added", "This song is already in your entry.")
          return prev
        }
        return [...prev, parsed]
      })
      setSongUrlInput("")
      setShowSongModal(false)
    } else {
      Alert.alert("Invalid URL", "Please enter a valid Spotify, Apple Music, or Soundcloud URL.")
    }
  }

  // Remove embedded media
  function handleRemoveEmbed(index: number) {
    setEmbeddedMedia((prev) => prev.filter((_, i) => i !== index))
  }

  async function checkFileSize(uri: string, fileType?: "photo" | "video" | "audio"): Promise<{ valid: boolean; error?: string }> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri)
      if (!fileInfo.exists) {
        return { valid: false, error: "File does not exist" }
      }
      
      if (fileInfo.size === undefined) {
        // Can't determine size - warn but allow (some URIs don't expose size)
        console.warn("[entry-composer] Cannot determine file size for:", uri)
        return { valid: true }
      }
      
      // Determine appropriate limit based on file type
      let maxSize: number
      let typeLabel: string
      
      if (fileType === "video") {
        maxSize = MAX_VIDEO_SIZE
        typeLabel = "video"
      } else if (fileType === "audio") {
        maxSize = MAX_AUDIO_SIZE
        typeLabel = "audio"
      } else {
        maxSize = MAX_PHOTO_SIZE
        typeLabel = "photo"
      }
      
      if (fileInfo.size > maxSize) {
        const sizeMB = (fileInfo.size / (1024 * 1024)).toFixed(1)
        const maxMB = (maxSize / (1024 * 1024)).toFixed(0)
        return {
          valid: false,
          error: `File is too large (${sizeMB}MB). Maximum size for ${typeLabel}s is ${maxMB}MB. Please choose a smaller file.`
        }
      }
      
      return { valid: true }
    } catch (error) {
      console.warn("[entry-composer] Failed to check file size:", error)
      // If we can't check size, warn but allow (some URIs don't expose size)
      return { valid: true }
    }
  }

  async function openGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant photo library access")
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All, // Both photos and videos
      allowsMultipleSelection: true,
      allowsEditing: false,
      quality: 0.8,
    })

    if (!result.canceled) {
      // Check file sizes before adding
      const validAssets = []
      const errors: string[] = []
      
      for (const asset of result.assets) {
        const fileType = asset.type === "video" ? "video" : asset.type === "image" ? "photo" : "audio"
        const sizeCheck = await checkFileSize(asset.uri, fileType)
        
        if (sizeCheck.valid) {
          validAssets.push(asset)
        } else if (sizeCheck.error) {
          errors.push(sizeCheck.error)
        }
      }
      
      // Show errors if any files were rejected
      if (errors.length > 0) {
        Alert.alert(
          "File Too Large",
          errors.length === 1 
            ? errors[0]
            : `${errors.length} files were too large:\n\n${errors.slice(0, 3).join("\n")}${errors.length > 3 ? `\n...and ${errors.length - 3} more` : ""}`,
          [{ text: "OK" }]
        )
      }
      
      if (validAssets.length > 0) {
        const newItems = validAssets.map((asset) => {
          const isVideo = asset.type === "video"
          return {
            id: createMediaId(),
            uri: asset.uri,
            type: (isVideo ? "video" : "photo") as "photo" | "video",
            thumbnailUri: isVideo ? asset.uri : undefined, // Will generate thumbnail for video
          }
        })
        setMediaItems((prev) => [...prev, ...newItems])
      }
    }
  }

  async function handleGalleryAction() {
    // Open gallery directly (no modal)
    openGallery()
  }

  async function openCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant camera access")
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.8,
    })

    if (!result.canceled) {
      const asset = result.assets[0]
      
      // Check file size before adding
      const fileType = asset.type === "video" ? "video" : "photo"
      const sizeCheck = await checkFileSize(asset.uri, fileType)
      
      if (!sizeCheck.valid) {
        if (sizeCheck.error) {
          Alert.alert("File Too Large", sizeCheck.error)
        }
        return
      }
      
      const isVideo = asset.type === "video"
      const mediaId = createMediaId()
      
      setMediaItems((prev) => [
        ...prev,
        {
          id: mediaId,
          uri: asset.uri,
          type: isVideo ? "video" : "photo",
          thumbnailUri: isVideo ? asset.uri : undefined, // Will generate thumbnail for video
        },
      ])
    }
  }

  async function startRecording() {
    try {
      const { status } = await Audio.requestPermissionsAsync()
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant microphone access")
        return
      }

      // Ensure app is in foreground before activating audio session
      const appState = AppState.currentState
      if (appState !== "active") {
        // Wait for app to become active
        return new Promise<void>((resolve) => {
          const subscription = AppState.addEventListener("change", (nextAppState) => {
            if (nextAppState === "active") {
              subscription.remove()
              // Retry after a brief delay to ensure audio session can activate
              setTimeout(() => {
                startRecording().then(resolve).catch(() => resolve())
              }, 300)
            }
          })
          // Also try immediately in case app becomes active quickly
          setTimeout(() => {
            if (AppState.currentState === "active") {
              subscription.remove()
              startRecording().then(resolve).catch(() => resolve())
            }
          }, 100)
        })
      }

      // Small delay to ensure app is fully in foreground
      await new Promise((resolve) => setTimeout(resolve, 100))

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })

      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
      setRecording(recording)
      setVoiceUri(undefined)
      setVoiceDuration(0)
      setVoiceModalVisible(true)
      timerRef.current = setInterval(async () => {
        const status = await recording.getStatusAsync()
        if (status.isRecording) {
          setVoiceDuration(Math.floor(status.durationMillis / 1000))
        }
      }, 300) as unknown as NodeJS.Timeout
    } catch (error: any) {
      // If error is about background state, show helpful message
      if (error.message?.includes("background")) {
        Alert.alert(
          "Please try again",
          "The app needs to be in the foreground to start recording. Please try again."
        )
      } else {
        Alert.alert("Error", error.message || "Failed to start recording")
      }
    }
  }

  async function stopRecording() {
    if (!recording) return

    try {
      await recording.stopAndUnloadAsync()
      const uri = recording.getURI()
      if (uri) {
        setVoiceUri(uri)
      }
      setRecording(undefined)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    } catch (error: any) {
      Alert.alert("Error", error.message)
    }
  }

  async function playVoiceMemo() {
    if (!voiceUri) return
    if (isPlayingVoice && soundRef.current) {
      await soundRef.current.stopAsync()
      setIsPlayingVoice(false)
      return
    }
    const { sound } = await Audio.Sound.createAsync({ uri: voiceUri })
    soundRef.current = sound
    setIsPlayingVoice(true)
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        setIsPlayingVoice(false)
      }
    })
    await sound.playAsync()
  }

  function addVoiceMemoToEntry() {
    if (!voiceUri) return
    const audioId = createMediaId()
    setMediaItems((prev) => [
      ...prev,
      {
        id: audioId,
        uri: voiceUri,
        type: "audio",
      },
    ])
    // Get duration for the audio
    Audio.Sound.createAsync({ uri: voiceUri })
      .then(({ sound }) => {
        sound.getStatusAsync().then((status) => {
          if (status.isLoaded && status.durationMillis) {
            setAudioDurations((prev) => ({ ...prev, [audioId]: status.durationMillis! }))
          }
          sound.unloadAsync().catch(() => {})
        })
      })
      .catch(() => {})
    cleanupVoiceModal()
  }

  function handleAddVideo(videoUri: string) {
    const videoId = createMediaId()
    setMediaItems((prev) => [
      ...prev,
      {
        id: videoId,
        uri: videoUri,
        type: "video",
        thumbnailUri: videoUri, // Will generate thumbnail for video
      },
    ])
  }

  async function handleToggleAudio(id: string, uri: string) {
    try {
      setAudioLoading((prev) => ({ ...prev, [id]: true }))
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      })

      if (playingAudioId && playingAudioId !== id) {
        const previous = audioRefs.current[playingAudioId]
        if (previous) {
          try {
            await previous.stopAsync()
            await previous.setPositionAsync(0)
          } catch {
            // ignore
          }
        }
        setPlayingAudioId(null)
      }

      if (playingAudioId === id) {
        // Pause
        const sound = audioRefs.current[id]
        if (sound) {
          await sound.pauseAsync()
          setPlayingAudioId(null)
        }
      } else {
        // Play
        if (!audioRefs.current[id]) {
          const { sound } = await Audio.Sound.createAsync({ uri })
          audioRefs.current[id] = sound

          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded) {
              setAudioProgress((prev) => ({ ...prev, [id]: status.positionMillis || 0 }))
              if (status.durationMillis && !audioDurations[id]) {
                setAudioDurations((prev) => ({ ...prev, [id]: status.durationMillis! }))
              }
              if (status.didJustFinish) {
                setPlayingAudioId(null)
                setAudioProgress((prev) => ({ ...prev, [id]: 0 }))
              }
            }
          })
        }

        const sound = audioRefs.current[id]
        await sound.playAsync()
        setPlayingAudioId(id)
      }
    } catch (error: any) {
      console.error("[audio] playback error:", error)
      Alert.alert("Error", "Could not play audio")
    } finally {
      setAudioLoading((prev) => ({ ...prev, [id]: false }))
    }
  }

  function formatMillis(ms: number) {
    if (!ms || isNaN(ms)) return "0:00"
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  function cleanupVoiceModal() {
    setVoiceModalVisible(false)
    setVoiceUri(undefined)
    setVoiceDuration(0)
    setIsPlayingVoice(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (soundRef.current) {
      soundRef.current.unloadAsync().catch(() => {})
      soundRef.current = null
    }
  }

  async function shufflePrompt() {
    if (availablePrompts.length === 0 || !currentGroupId) return
    
    try {
      // Get group info to check NSFW preference and type
      const group = await getGroup(currentGroupId)
      if (!group) return
      
      // Get group NSFW preference (may not be in TypeScript type, but exists in DB)
      const groupWithNSFW = group as any
      const enableNSFW = groupWithNSFW?.enable_nsfw === true
      
      // Get memorials to filter "Remembering" category
      const groupMemorials = await getMemorials(currentGroupId)
      const hasMemorials = groupMemorials.length > 0
      
      // Filter prompts based on group settings
      const validPrompts = availablePrompts.filter((p) => {
        // Exclude current prompt
        if (p.id === activePrompt?.id) return false
        
        // Filter out NSFW if group doesn't allow it
        if (!enableNSFW && p.category === "Edgy/NSFW") return false
        
        // Filter out "Remembering" category if no memorials
        if (p.category === "Remembering" && !hasMemorials) return false
        
        // Filter by group type
        // Note: Friends/Family categories have been merged to Standard
        // No need to filter by group type anymore
        
        // Filter prompts that require memorials but group has none
        if (p.dynamic_variables?.includes("memorial_name") && !hasMemorials) return false
        
        // Exclude Birthday category questions
        if (p.birthday_type) return false
        
        // Exclude questions with {member_name} dynamic variables
        if (p.dynamic_variables?.includes("member_name")) return false
        
        return true
      })
      
      if (validPrompts.length === 0) {
        // No valid prompts to shuffle to, keep current one
        return
      }
      
      const next = validPrompts[Math.floor(Math.random() * validPrompts.length)]
      setActivePrompt(next)
    } catch (error) {
      console.error("[entry-composer] Error shuffling prompt:", error)
      // Fallback to simple shuffle if filtering fails
      const others = availablePrompts.filter((p) => p.id !== activePrompt?.id)
      if (others.length > 0) {
        const next = others[Math.floor(Math.random() * others.length)]
        setActivePrompt(next)
      }
    }
  }

  const handleRemoveMedia = useCallback((id: string) => {
    setMediaItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  // Handle drag and drop reordering
  function handleDragStart(itemId: string) {
    setDraggedItemId(itemId)
  }

  function handleDragEnd() {
    if (draggedItemId === null || dragOverIndex === null) {
      setDraggedItemId(null)
      setDragOverIndex(null)
      dragPosition.setValue({ x: 0, y: 0 })
      return
    }

    // Get photo/video items in their current order (not reversed)
    const photoVideoItems = mediaItems.filter(item => item.type !== "audio")
    const draggedIndex = photoVideoItems.findIndex(item => item.id === draggedItemId)
    
    if (draggedIndex === -1 || draggedIndex === dragOverIndex) {
      setDraggedItemId(null)
      setDragOverIndex(null)
      dragPosition.setValue({ x: 0, y: 0 })
      return
    }

    // Reorder photo/video items
    const newPhotoVideoItems = [...photoVideoItems]
    const [removed] = newPhotoVideoItems.splice(draggedIndex, 1)
    newPhotoVideoItems.splice(dragOverIndex, 0, removed)
    
    // Rebuild the full mediaItems array maintaining audio positions
    const audioItems = mediaItems.filter(item => item.type === "audio")
    const reorderedItems: MediaItem[] = []
    let photoVideoIdx = 0
    let audioIdx = 0
    
    // Rebuild array maintaining original structure (audio items stay where they were)
    for (let i = 0; i < mediaItems.length; i++) {
      if (mediaItems[i].type === "audio") {
        reorderedItems.push(audioItems[audioIdx++])
      } else {
        reorderedItems.push(newPhotoVideoItems[photoVideoIdx++])
      }
    }
    
    setMediaItems(reorderedItems)
    setDraggedItemId(null)
    setDragOverIndex(null)
    dragPosition.setValue({ x: 0, y: 0 })
  }

  async function handleNavigateToHome(entryDate?: string) {
    // Ensure we always have a valid date - use multiple fallbacks
    const dateToNavigate = entryDate || date || getTodayDate()
    
    if (!currentGroupId) {
      // Fallback: just navigate if we don't have group info
      setIsNavigating(true)
      exitComposer(dateToNavigate)
      return
    }
    
    try {
      // Invalidate queries for the specific date to ensure fresh data
      // This is more efficient than invalidating everything
      // Safety check: ensure dateToNavigate is a string before calling split
      if (!dateToNavigate || typeof dateToNavigate !== 'string') {
        console.error("[entry-composer] Invalid dateToNavigate in handleNavigateToHome:", dateToNavigate, "entryDate:", entryDate, "date:", date)
        // Fallback to today's date
        const todayDate = getTodayDate()
        setIsNavigating(true)
        exitComposer(todayDate)
        return
      }
      const normalizedDate = dateToNavigate.split('T')[0]
      
      // Invalidate queries for the specific date
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["entries", currentGroupId, normalizedDate] }),
        queryClient.invalidateQueries({ queryKey: ["userEntry", currentGroupId, userId, normalizedDate] }),
        queryClient.invalidateQueries({ queryKey: ["dailyPrompt", currentGroupId, normalizedDate] }),
        queryClient.invalidateQueries({ queryKey: ["entries", currentGroupId], exact: false }), // Also invalidate all entries for this group
        queryClient.invalidateQueries({ queryKey: ["userEntry", currentGroupId], exact: false }),
      ])
      
      // Now navigate - queries will refetch automatically
      setIsNavigating(true)
      exitComposer(dateToNavigate)
    } catch (error) {
      console.error("[entry-composer] Error refreshing home data:", error)
      // Still navigate even if refresh fails
      setIsNavigating(true)
      exitComposer(dateToNavigate)
    }
  }

  async function exitComposer(entryDate?: string) {
    // Hide composer content immediately to prevent flash
    setIsNavigating(true)
    
    // Save draft before exiting (if there's text)
    if (text.trim().length > 0 && !editMode && currentGroupId) {
      await saveDraft(text)
    }
    
    // Reset to original prompt when closing (if user didn't post)
    // This ensures that if user shuffles but doesn't answer, they see original prompt next time
    if (originalPromptIdRef.current && prompt && prompt.id === originalPromptIdRef.current) {
      setActivePrompt(prompt as Prompt)
    }
    
    // Navigate to home with the date they answered
    // Ensure we always have a valid date - use multiple fallbacks
    const dateToNavigate = entryDate || date || getTodayDate()
    // Safety check: ensure dateToNavigate is a string before calling split
    if (!dateToNavigate || typeof dateToNavigate !== 'string') {
      console.error("[entry-composer] Invalid dateToNavigate:", dateToNavigate, "entryDate:", entryDate, "date:", date)
      // Fallback to today's date
      const todayDate = getTodayDate()
      router.replace(`/(main)/home?date=${todayDate}&groupId=${currentGroupId || ''}`)
      return
    }
    const normalizedDate = dateToNavigate.split('T')[0] // Normalize date format
    
    if (returnTo && returnTo.includes("home")) {
      router.replace(`/(main)/home?date=${normalizedDate}&groupId=${currentGroupId || ''}`)
    } else if (returnTo) {
      // If returnTo has date param, preserve it, otherwise add it
      const hasDate = returnTo.includes('date=')
      const hasGroupId = returnTo.includes('groupId=')
      let newReturnTo = returnTo
      
      if (!hasDate) {
        newReturnTo += (returnTo.includes('?') ? '&' : '?') + `date=${normalizedDate}`
      }
      if (!hasGroupId && currentGroupId) {
        newReturnTo += (newReturnTo.includes('?') ? '&' : '?') + `groupId=${currentGroupId}`
      }
      
      router.replace(newReturnTo)
    } else {
      // Always navigate to home with date
      router.replace(`/(main)/home?date=${normalizedDate}&groupId=${currentGroupId || ''}`)
    }
  }

  async function handlePost() {
    if (!text.trim() && mediaItems.length === 0) {
      Alert.alert("Error", "Please add some content to your entry")
      return
    }

    if (!currentGroupId || !userId || !activePrompt?.id) {
      Alert.alert("Error", "Unable to determine group or user")
      return
    }

    // Show confirmation dialog for edits
    if (editMode && entryId) {
      Alert.alert(
        "Save changes?",
        "Are you sure you want to update this entry?",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Save",
            onPress: () => performPost(),
          },
        ]
      )
      return
    }

    // For new entries, proceed directly
    performPost()
  }

  async function performPost() {
    if (!currentGroupId || !userId || !activePrompt?.id) {
      return
    }

    // Check if any media is still uploading
    const localMediaItems = mediaItems.filter(item => !item.uri.startsWith("http"))
    const isUploading = Object.values(uploadingMedia).some(status => status === true)
    
    if (isUploading && localMediaItems.length > 0) {
      setShowUploadingModal(true)
      return
    }

    setLoading(true)
    try {
      const storageKey = editMode && entryId ? entryId : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

      // Set uploading state for all local media items
      localMediaItems.forEach(item => {
        setUploadingMedia(prev => ({ ...prev, [item.id]: true }))
      })
      
      // Show uploading modal if we have media to upload
      if (localMediaItems.length > 0) {
        setShowUploadingModal(true)
      }

      // Upload only new media (local files), keep existing URLs
      // Use Promise.allSettled to handle individual failures gracefully
      const uploadResults = await Promise.allSettled(
        mediaItems.map(async (item) => {
          if (item.uri.startsWith("http")) {
            // Existing URL, keep as-is
            return { url: item.uri, type: item.type }
          }
          // New local file, upload it
          try {
            // CRITICAL: Check file size BEFORE attempting upload to prevent memory crashes
            // This prevents the app from crashing when trying to load large files into memory
            const sizeCheck = await checkFileSize(item.uri, item.type)
            if (!sizeCheck.valid) {
              setUploadingMedia(prev => ({ ...prev, [item.id]: false }))
              throw new Error(sizeCheck.error || `File is too large for ${item.type}`)
            }
            
            const remoteUrl = await uploadMedia(currentGroupId, storageKey, item.uri, item.type)
            setUploadingMedia(prev => ({ ...prev, [item.id]: false }))
            return { url: remoteUrl, type: item.type }
          } catch (error: any) {
            setUploadingMedia(prev => ({ ...prev, [item.id]: false }))
            // Log error but don't throw immediately - let other uploads complete
            console.error(`[entry-composer] Failed to upload ${item.type}:`, error)
            // Provide more specific error messages
            const errorMessage = error.message?.includes("too large") 
              ? error.message 
              : `Failed to upload ${item.type}: ${error.message || "Unknown error"}`
            throw new Error(errorMessage)
          }
        }),
      )
      
      // Process results and collect any errors
      const uploadedMedia: Array<{ url: string; type: string }> = []
      const uploadErrors: string[] = []
      
      uploadResults.forEach((result, index) => {
        if (result.status === "fulfilled") {
          uploadedMedia.push(result.value)
        } else {
          uploadErrors.push(result.reason?.message || `Failed to upload media item ${index + 1}`)
          // Mark this item as failed
          const item = mediaItems[index]
          if (item) {
            setUploadingMedia(prev => ({ ...prev, [item.id]: false }))
          }
        }
      })
      
      // If any uploads failed, show error
      if (uploadErrors.length > 0) {
        throw new Error(uploadErrors.join("\n"))
      }

      // Prepare embedded media for storage
      const embeddedMediaForStorage = embeddedMedia.map((embed) => ({
        platform: embed.platform,
        url: embed.url,
        embedId: embed.embedId,
        embedType: embed.embedType,
        embedUrl: embed.embedUrl,
      }))

      // Parse mentions from text
      const mentionedUserIds = parseMentions(text.trim())
      
      if (editMode && entryId) {
        // Update existing entry
        await updateEntry(
          entryId,
          userId,
          {
            text_content: text.trim() || undefined,
            media_urls: uploadedMedia.map((item) => item.url),
            media_types: uploadedMedia.map((item) => item.type) as ("photo" | "video" | "audio")[],
            embedded_media: embeddedMediaForStorage.length > 0 ? embeddedMediaForStorage : undefined,
            mentions: mentionedUserIds.length > 0 ? mentionedUserIds : undefined,
          }
        )

        // Track edited_entry event
        const hasMedia = uploadedMedia.length > 0 || embeddedMedia.length > 0
        const mediaTypes = uploadedMedia.map((item) => item.type)
        if (embeddedMedia.length > 0) {
          mediaTypes.push("embedded")
        }
        
        safeCapture(posthog, "edited_entry", {
          entry_id: entryId,
          prompt_id: activePrompt.id,
          group_id: currentGroupId,
          date: date,
          has_media: hasMedia,
          text_length: text.trim().length,
        })

        // Invalidate queries for the updated entry
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["entry", entryId] }),
          queryClient.invalidateQueries({ queryKey: ["entries", currentGroupId], exact: false }),
          queryClient.invalidateQueries({ queryKey: ["userEntry", currentGroupId], exact: false }),
          queryClient.invalidateQueries({ queryKey: ["userEntriesForHistoryDates", currentGroupId], exact: false }), // CRITICAL: Invalidate history user entries query
          queryClient.invalidateQueries({ queryKey: ["historyEntries", currentGroupId], exact: false }),
          queryClient.invalidateQueries({ queryKey: ["historyComments"] }),
        ])
      } else {
        // Create new entry
        const newEntry = await createEntry({
          group_id: currentGroupId,
          user_id: userId,
          prompt_id: activePrompt.id,
          date,
          text_content: text.trim() || undefined,
          media_urls: uploadedMedia.map((item) => item.url),
          media_types: uploadedMedia.map((item) => item.type) as ("photo" | "video" | "audio")[],
          embedded_media: embeddedMediaForStorage.length > 0 ? embeddedMediaForStorage : undefined,
          mentions: mentionedUserIds.length > 0 ? mentionedUserIds : undefined,
        })
        
        // Create notifications for mentioned users
        if (mentionedUserIds.length > 0 && newEntry) {
          await createMentionNotifications(newEntry.id, currentGroupId, userId, mentionedUserIds)
        }

        // Track answered_daily_question event
        const hasMedia = uploadedMedia.length > 0 || embeddedMedia.length > 0
        const mediaTypes = uploadedMedia.map((item) => item.type)
        if (embeddedMedia.length > 0) {
          mediaTypes.push("embedded")
        }
        
        safeCapture(posthog, "answered_daily_question", {
          prompt_id: activePrompt.id,
          group_id: currentGroupId,
          date: date,
          has_media: hasMedia,
          media_types_added: mediaTypes,
          text_length: text.trim().length,
        })

        // CRITICAL: Update cache for BOTH todayDate and selectedDate query keys
        // home.tsx uses both ["entries", currentGroupId, todayDate] and ["entries", currentGroupId, selectedDate]
        // selectedDate defaults to todayDate, but we need to update both to ensure consistency
        if (date && newEntry) {
          const todayDate = getTodayDate() // Use same function as home.tsx to ensure date format matches
          const normalizedDate = date.split('T')[0] // Normalize date format
          
          if (normalizedDate === todayDate) {
            // Update entries cache for todayDate (home.tsx line 992)
            const todayEntriesKey = ["entries", currentGroupId, todayDate]
            const existingTodayEntries = queryClient.getQueryData<any[]>(todayEntriesKey) || []
            const todayEntryExists = existingTodayEntries.some(e => e.id === newEntry.id)
            if (!todayEntryExists) {
              queryClient.setQueryData(todayEntriesKey, [newEntry, ...existingTodayEntries])
            }
            
            // Update entries cache for selectedDate (home.tsx line 1217) - selectedDate defaults to todayDate
            // But we update both to be safe in case selectedDate is different
            const selectedEntriesKey = ["entries", currentGroupId, todayDate] // Same as todayDate since selectedDate defaults to it
            const existingSelectedEntries = queryClient.getQueryData<any[]>(selectedEntriesKey) || []
            const selectedEntryExists = existingSelectedEntries.some(e => e.id === newEntry.id)
            if (!selectedEntryExists) {
              queryClient.setQueryData(selectedEntriesKey, [newEntry, ...existingSelectedEntries])
            }
            
            // CRITICAL: Update userEntry cache for todayDate (home.tsx line 976)
            // This is what determines if the question card shows or not
            const todayUserEntryKey = ["userEntry", currentGroupId, userId, todayDate]
            queryClient.setQueryData(todayUserEntryKey, newEntry)
            
            // CRITICAL: Update userEntry cache for selectedDate (home.tsx line 941)
            // selectedDate defaults to todayDate, but update both to be safe
            const selectedUserEntryKey = ["userEntry", currentGroupId, userId, todayDate] // Same as todayDate
            queryClient.setQueryData(selectedUserEntryKey, newEntry)
          }
        }
        
        // Invalidate queries scoped to the specific group to prevent cross-group contamination
        // Use prefix matching to invalidate all related queries
        // Note: We invalidate AFTER updating cache so background refetch will merge properly
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["entries", currentGroupId], exact: false }),
          queryClient.invalidateQueries({ queryKey: ["userEntry", currentGroupId], exact: false }),
          queryClient.invalidateQueries({ queryKey: ["userEntriesForHistoryDates", currentGroupId], exact: false }), // CRITICAL: Invalidate history user entries query
          queryClient.invalidateQueries({ queryKey: ["historyEntries", currentGroupId], exact: false }),
          queryClient.invalidateQueries({ queryKey: ["dailyPrompt", currentGroupId], exact: false }),
          queryClient.invalidateQueries({ queryKey: ["historyComments"] }),
        ])
      }

      // Hide uploading modal and navigate directly to home
      setShowUploadingModal(false)
      
      // Clear draft after successful post
      await clearDraft()
      
      // Navigate to home with the date they answered
      // This will automatically reload that day's content
      await handleNavigateToHome(date)
    } catch (error: any) {
      // Clear all uploading states on error
      setUploadingMedia({})
      setShowUploadingModal(false)
      // Show user-friendly error message
      const errorMessage = error.message || (editMode ? "Failed to update entry. Please try again." : "Failed to post entry. Please try again.")
      Alert.alert("Error", errorMessage)
    } finally {
      setLoading(false)
      // Clear uploading states after successful upload
      setUploadingMedia({})
    }
  }

  // Handle mention selection
  function handleMentionSelect(user: { id: string; name: string; avatar_url?: string }) {
    const cursorPosition = cursorPositionRef.current
    const textBeforeCursor = text.substring(0, cursorPosition)
    const lastAtIndex = textBeforeCursor.lastIndexOf("@")
    
    if (lastAtIndex !== -1) {
      // Replace "@query" with "@UserName" (bold formatting will be handled in display)
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1)
      const newText = 
        text.substring(0, lastAtIndex) + 
        `@${user.name}` + 
        text.substring(cursorPosition)
      
      setText(newText)
      setShowMentionAutocomplete(false)
      
      // Move cursor after the mention
      setTimeout(() => {
        const newCursorPosition = lastAtIndex + user.name.length + 1
        cursorPositionRef.current = newCursorPosition
        textInputRef.current?.setNativeProps({
          selection: { start: newCursorPosition, end: newCursorPosition },
        })
      }, 0)
    }
  }

  // Parse mentions from text content
  // Returns array of user IDs that were mentioned
  function parseMentions(textContent: string): string[] {
    if (!textContent || !currentGroupId) return []
    
    // Find all @mentions in text (format: @Name)
    // Match @ followed by word characters (letters, numbers, underscore)
    // Stop at whitespace, punctuation, or end of string
    const mentionRegex = /@(\w+)/g
    const matches = Array.from(textContent.matchAll(mentionRegex))
    const mentionedNames = matches.map((match) => match[1])
    
    // Find user IDs for mentioned names
    const mentionedUserIds: string[] = []
    for (const name of mentionedNames) {
      const member = members.find((m) => 
        m.user?.name?.toLowerCase() === name.toLowerCase()
      )
      if (member && member.user_id !== userId) {
        mentionedUserIds.push(member.user_id)
      }
    }
    
    // Remove duplicates
    return Array.from(new Set(mentionedUserIds))
  }

  // Create notifications for mentioned users
  async function createMentionNotifications(
    entryId: string,
    groupId: string,
    authorUserId: string,
    mentionedUserIds: string[]
  ) {
    if (!mentionedUserIds.length) return
    
    try {
      // Get author's name
      const { data: author } = await supabase
        .from("users")
        .select("name")
        .eq("id", authorUserId)
        .single()
      
      const authorName = author?.name || "Someone"
      
      // Create notifications for each mentioned user
      const notifications = mentionedUserIds.map((mentionedUserId) => ({
        user_id: mentionedUserId,
        type: "mentioned_in_entry",
        title: `${authorName} mentioned you in their answer today`,
        body: "See what they said about you",
        data: {
          entry_id: entryId,
          group_id: groupId,
          author_user_id: authorUserId,
        },
        read: false,
      }))
      
      // Insert notifications (for in-app display)
      const { error: notificationsError } = await supabase
        .from("notifications")
        .insert(notifications)
      
      if (notificationsError) {
        console.error("[entry-composer] Failed to create mention notifications:", notificationsError)
      }
      
      // Also insert into notification_queue for push notifications
      const { error: queueError } = await supabase
        .from("notification_queue")
        .insert(notifications.map(n => ({
          user_id: n.user_id,
          type: n.type,
          title: n.title,
          body: n.body,
          data: n.data,
        })))
      
      if (queueError) {
        console.error("[entry-composer] Failed to add mention notifications to queue:", queueError)
      }
    } catch (error) {
      console.error("[entry-composer] Error creating mention notifications:", error)
    }
  }

  // Auto-focus text input on mount so users can start typing immediately
  useEffect(() => {
    // Small delay to ensure component is fully mounted and layout is ready
    const focusTimer = setTimeout(() => {
      textInputRef.current?.focus()
    }, 300) as unknown as NodeJS.Timeout
    
    return () => clearTimeout(focusTimer)
  }, [])

  // Handle input layout to capture position
  const handleInputLayout = useCallback((event: any) => {
    const { y, height } = event.nativeEvent.layout
    inputContainerYRef.current = y
  }, [])

  // Helper function to scroll input into view above keyboard
  // Only scrolls if cursor is close to or below the keyboard
  const scrollInputIntoView = useCallback((contentHeight?: number, forceScroll: boolean = false) => {
    if (!scrollViewRef.current || inputContainerYRef.current === null) return
    
    // Use requestAnimationFrame to ensure layout is updated
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (!scrollViewRef.current || inputContainerYRef.current === null) return
          
          // Get screen dimensions
          const screenHeight = Dimensions.get('window').height
          
          // Use contentHeight if provided, otherwise estimate based on text length
          // Average line height is ~24px, min height is 200px
          const estimatedHeight = contentHeight || Math.max(200, (text.split('\n').length * 24))
          
          // Calculate the bottom position of the text input (where cursor is)
          const inputTop = inputContainerYRef.current
          const inputBottom = inputTop + estimatedHeight
          
          // Calculate visible area above keyboard
          const toolbarHeight = 80
          const padding = 60 // Reduced padding - only keep cursor slightly above keyboard
          const visibleAreaTop = keyboardHeight > 0 
            ? screenHeight - keyboardHeight - toolbarHeight - padding
            : screenHeight - 300 // Fallback when keyboard not visible
          
          // Calculate where the cursor would be relative to the visible viewport
          // Current scroll position is tracked in currentScrollYRef
          const cursorPositionInViewport = inputBottom - currentScrollYRef.current
          
          // Only scroll if cursor is close to or below the keyboard threshold
          // Or if forceScroll is true (for newlines)
          const needsScroll = forceScroll || cursorPositionInViewport > visibleAreaTop
          
          if (needsScroll) {
            // Scroll so that the bottom of the text input (cursor position) is visible above keyboard
            // We want: inputBottom - scrollOffset <= visibleAreaTop
            // So: scrollOffset >= inputBottom - visibleAreaTop
            const scrollOffset = Math.max(0, inputBottom - visibleAreaTop)
            currentScrollYRef.current = scrollOffset // Update tracked scroll position
            scrollViewRef.current.scrollTo({ y: scrollOffset, animated: true })
          }
        }, 150) // Delay to ensure layout has updated
      })
    })
  }, [keyboardHeight, text])

  // Auto-scroll to keep text input cursor visible when content size changes
  const handleTextContentSizeChange = useCallback((event: any) => {
    // When text content size changes (user types/returns), only scroll if cursor is close to keyboard
    const contentHeight = event.nativeEvent.contentSize.height
    scrollInputIntoView(contentHeight, false)
  }, [scrollInputIntoView])


  // Handle media carousel layout to capture its Y position
  const handleMediaCarouselLayout = useCallback((event: any) => {
    const { y } = event.nativeEvent.layout
    mediaCarouselYRef.current = y
  }, [])

  // Auto-scroll to media carousel when media is added (not removed)
  useEffect(() => {
    const photoVideoItems = mediaItems.filter(item => item.type !== "audio")
    const currentCount = photoVideoItems.length
    const previousCount = previousMediaCountRef.current
    
    // Only scroll if media count increased (new media added) and we have a position
    if (currentCount > previousCount && currentCount > 0 && mediaCarouselYRef.current !== null) {
      // Wait for layout to update, then scroll
      setTimeout(() => {
        // Scroll to position carousel near top (with offset for header/padding)
        const scrollOffset = Math.max(0, mediaCarouselYRef.current! - 120)
        scrollViewRef.current?.scrollTo({ y: scrollOffset, animated: true })
      }, 300)
    }
    
    previousMediaCountRef.current = currentCount
  }, [mediaItems.filter(item => item.type !== "audio").length])

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

  // Create dynamic styles based on theme
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme2Colors.beige,
    },
    keyboardAvoidingView: {
      flex: 1,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: spacing.md,
      marginTop: 0, // No top margin since contentContainer has paddingTop
      gap: spacing.md,
      width: "100%",
    },
    headerTitle: {
      ...typography.h3,
      color: theme2Colors.text,
      flex: 1,
    },
    headerCloseButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme2Colors.cream,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
      flexShrink: 0,
      marginTop: 0,
    },
    closeButton: {
      ...typography.h2,
      fontSize: 28,
      color: theme2Colors.text,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: spacing.lg,
      paddingTop: spacing.xxl + spacing.md, // Extra top padding for header
      paddingBottom: spacing.xxl * 2 + 80, // Extra padding at bottom for toolbar clearance (toolbar height ~80px)
    },
    question: {
      ...typography.h2,
      fontSize: 24,
      color: theme2Colors.text,
      fontFamily: "PMGothicLudington-Text115",
      flex: 1,
      flexShrink: 1,
      marginRight: spacing.md,
    },
    description: {
      ...typography.body,
      color: theme2Colors.textSecondary,
      marginBottom: spacing.xl,
    },
    input: {
      ...typography.body,
      fontSize: 16,
      lineHeight: 24,
      color: theme2Colors.text,
      minHeight: 200,
      textAlignVertical: "top",
    },
    mediaCarouselContainer: {
      marginTop: spacing.md,
      marginBottom: spacing.md,
      height: 140,
    },
    mediaScrollContainer: {
      flex: 1,
    },
    mediaScrollContent: {
      gap: spacing.sm,
      paddingRight: spacing.lg,
      alignItems: "center",
    },
    mediaThumbnailWrapper: {
      width: 120,
      height: 120,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: colors.gray[900],
      position: "relative",
      marginRight: spacing.sm,
    },
    mediaThumbnailDragOver: {
      borderWidth: 2,
      borderColor: colors.accent,
      borderStyle: "dashed",
    },
    mediaThumbnail: {
      width: "100%",
      height: "100%",
    },
    audioThumbnail: {
      width: "100%",
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.xs,
    },
    videoThumb: {
      width: 120,
      height: 120,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.gray[900],
      position: "relative",
      overflow: "hidden",
    },
    videoThumbVideo: {
      width: "100%",
      height: "100%",
    },
    videoThumbImage: {
      width: "100%",
      height: "100%",
    },
    videoThumbOverlay: {
      position: "absolute",
      width: "100%",
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.3)",
    },
    audioPillWrapper: {
      width: "100%",
      position: "relative",
    },
    inlineAudioContainer: {
      marginTop: spacing.md,
      marginBottom: spacing.md,
      position: "relative",
    },
    audioPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.gray[900],
      borderRadius: 16,
      width: "100%",
    },
    inlineAudioDelete: {
      position: "absolute",
      top: spacing.xs,
      right: spacing.xs,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 10,
    },
    inlineAudioUploadOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.7)",
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
    },
    audioDelete: {
      position: "absolute",
      top: spacing.xs,
      right: spacing.xs,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
    },
    audioIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.gray[800],
      justifyContent: "center",
      alignItems: "center",
      flexShrink: 0,
    },
    audioInfo: {
      flex: 1,
      gap: spacing.xs,
      minWidth: 0,
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
    mediaLabel: {
      ...typography.caption,
      color: colors.white,
    },
    mediaDelete: {
      position: "absolute",
      top: spacing.xs,
      right: spacing.xs,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 10,
    },
    uploadOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 12,
      gap: spacing.xs,
    },
    uploadText: {
      ...typography.caption,
      color: colors.white,
      fontSize: 12,
    },
    toolbar: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme2Colors.textSecondary,
      backgroundColor: theme2Colors.beige,
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
    },
    toolbarButtons: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    toolbarRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    toolCluster: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    iconButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme2Colors.cream,
      borderWidth: 2,
      borderColor: isDark ? theme2Colors.text : theme2Colors.blue, // Cream outline in dark mode
      justifyContent: "center",
      alignItems: "center",
    },
    videoIconButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme2Colors.cream,
      borderWidth: 2,
      borderColor: "#D97393", // Pink outline in both light and dark mode
      justifyContent: "center",
      alignItems: "center",
    },
    iconButtonDisabled: {
      opacity: 0.5,
    },
    closeButtonIcon: {
      marginLeft: spacing.sm,
      backgroundColor: isDark ? theme2Colors.beige : theme2Colors.white, // Black in dark mode
      borderWidth: 1,
      borderColor: isDark ? theme2Colors.text : theme2Colors.text, // Cream in dark mode
    },
    postButtonInline: {
      backgroundColor: theme2Colors.blue,
      marginLeft: spacing.sm,
      borderWidth: 0,
    },
    postButton: {
      width: "100%",
    },
    voiceBackdrop: {
      flex: 1,
      backgroundColor: "transparent",
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.lg,
    },
    voiceBackdropOverlay1: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDark ? "rgba(0, 0, 0, 0.6)" : "rgba(232, 224, 213, 0.6)", // Dark overlay in dark mode, beige in light mode
    },
    voiceBackdropOverlay2: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0, 0, 0, 0.2)",
    },
    voiceSheet: {
      width: "100%",
      backgroundColor: theme2Colors.beige,
      borderRadius: 24,
      padding: spacing.xl,
      gap: spacing.md,
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
    },
    voiceTitle: {
      fontFamily: "PMGothicLudington-Text115",
      fontSize: 22,
      color: theme2Colors.text,
    },
    voiceTimer: {
      ...typography.h1,
      fontSize: 32,
      color: theme2Colors.text,
      textAlign: "center",
    },
    voiceControlRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: spacing.lg,
      marginTop: spacing.md,
    },
    voiceIconButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: isDark ? theme2Colors.text : theme2Colors.textSecondary, // Cream outline in dark mode
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: isDark ? theme2Colors.beige : theme2Colors.white, // Black fill in dark mode
    },
    voiceSendButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme2Colors.blue,
    },
    voiceIconDisabled: {
      opacity: 0.4,
    },
    voiceCancel: {
      marginTop: spacing.lg,
      alignSelf: "center",
    },
    voiceCancelText: {
      ...typography.caption,
      color: theme2Colors.textSecondary,
    },
    voiceDescription: {
      ...typography.body,
      color: theme2Colors.textSecondary,
      textAlign: "center",
      marginBottom: spacing.md,
    },
    songUrlInput: {
      ...typography.body,
      color: theme2Colors.text,
      backgroundColor: theme2Colors.white,
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
    },
    voiceButtonLabel: {
      ...typography.caption,
      color: theme2Colors.text,
      marginTop: spacing.xs,
      fontSize: 12,
    },
    embeddedMediaContainer: {
      marginTop: spacing.md,
      gap: spacing.sm,
    },
    embeddedMediaItem: {
      position: "relative",
    },
    embeddedMediaRemove: {
      position: "absolute",
      top: spacing.xs,
      right: spacing.xs,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 10,
    },
    addSongButton: {
      marginTop: spacing.md,
      width: "100%",
      backgroundColor: theme2Colors.blue,
      borderRadius: 25,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 56,
    },
    addSongButtonText: {
      ...typography.bodyBold,
      fontSize: 18,
      color: theme2Colors.white,
      textAlign: "center",
    },
    successBackdrop: {
      flex: 1,
      backgroundColor: theme2Colors.beige,
    },
    successBackdropOverlay1: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDark ? "rgba(0, 0, 0, 0.6)" : "rgba(232, 224, 213, 0.6)", // Dark overlay in dark mode, beige in light mode
    },
    successBackdropOverlay2: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0, 0, 0, 0.2)",
    },
    successContainer: {
      flex: 1,
      backgroundColor: theme2Colors.beige,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.xl,
      gap: spacing.xl,
      zIndex: 0,
    },
    successTexture: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.3,
      zIndex: 1,
      pointerEvents: "none" as const,
    },
    successTitle: {
      fontFamily: "PMGothicLudington-Text115",
      fontSize: 24,
      color: theme2Colors.text,
      textAlign: "center",
    },
    successButton: {
      width: "100%",
      backgroundColor: theme2Colors.blue,
      borderRadius: 25,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 56,
    },
    successButtonText: {
      ...typography.bodyBold,
      fontSize: 18,
      color: theme2Colors.white,
      textAlign: "center",
    },
    uploadingSubtitle: {
      ...typography.body,
      color: theme2Colors.textSecondary,
      textAlign: "center",
      marginTop: spacing.md,
    },
    tooltipContainer: {
      position: "absolute",
      zIndex: 10000,
      elevation: 10000,
    },
    tooltipBubble: {
      backgroundColor: theme2Colors.cream,
      borderRadius: 12,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: theme2Colors.blue,
      maxWidth: 200,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    tooltipText: {
      ...typography.body,
      fontSize: 14,
      color: theme2Colors.text,
      textAlign: "center",
    },
    tooltipPointer: {
      width: 0,
      height: 0,
      borderLeftWidth: 8,
      borderRightWidth: 8,
      borderTopWidth: 8,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
      borderTopColor: theme2Colors.blue,
      alignSelf: "center",
      marginTop: -1,
    },
    tooltipPointerInner: {
      width: 0,
      height: 0,
      borderLeftWidth: 7,
      borderRightWidth: 7,
      borderTopWidth: 7,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
      borderTopColor: theme2Colors.cream,
      alignSelf: "center",
      marginTop: -8,
    },
  }), [colors, isDark, theme2Colors])

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
        enabled={true} // Keep enabled - it only activates when keyboard appears (after user taps)
      >
        {!isNavigating && (
        <ScrollView 
          ref={scrollViewRef}
          style={styles.content} 
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          onLayout={(event) => {
            scrollViewHeightRef.current = event.nativeEvent.layout.height
          }}
          onScroll={(event) => {
            // Track current scroll position to determine if we need to scroll
            currentScrollYRef.current = event.nativeEvent.contentOffset.y
          }}
          scrollEventThrottle={16}
        >
        {/* Header with question and close button */}
        <View style={styles.header}>
          <Text style={styles.question}>{personalizedQuestion || activePrompt?.question}</Text>
          <TouchableOpacity style={styles.headerCloseButton} onPress={exitComposer}>
            <FontAwesome name="times" size={18} color={theme2Colors.text} />
          </TouchableOpacity>
        </View>

        {/* Media preview carousel - positioned between description and input */}
        {mediaItems.filter(item => item.type !== "audio").length > 0 && (
          <View 
            ref={mediaCarouselRef} 
            style={styles.mediaCarouselContainer}
            onLayout={handleMediaCarouselLayout}
          >
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.mediaScrollContainer}
              contentContainerStyle={styles.mediaScrollContent}
            >
              {mediaItems.filter(item => item.type !== "audio").map((item, index) => {
                const photoVideoItems = mediaItems.filter(item => item.type !== "audio")
                const itemIndex = photoVideoItems.findIndex(i => i.id === item.id)
                
                return (
                  <DraggableMediaThumbnail
                    key={item.id}
                    item={item}
                    itemIndex={itemIndex}
                    totalItems={photoVideoItems.length}
                    draggedItemId={draggedItemId}
                    dragOverIndex={dragOverIndex}
                    dragPosition={dragPosition}
                    uploadingMedia={uploadingMedia}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onSetDragOverIndex={setDragOverIndex}
                    onRemoveMedia={handleRemoveMedia}
                    colors={colors}
                    styles={styles}
                  />
                )
              })}
            </ScrollView>
          </View>
        )}

        <View ref={inputContainerRef} onLayout={handleInputLayout} style={{ position: 'relative' }}>
          <TextInput
            ref={textInputRef}
            style={styles.input}
            value={text}
            onChangeText={(newText) => {
              setText(newText)
              
              // Detect "@" mention trigger using current cursor position
              const cursorPosition = cursorPositionRef.current || newText.length
              const textBeforeCursor = newText.substring(0, cursorPosition)
              const lastAtIndex = textBeforeCursor.lastIndexOf("@")
              
              if (lastAtIndex !== -1) {
                // Check if there's a space or newline after @ (mention ended)
                const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1)
                const hasSpaceOrNewline = /[\s\n]/.test(textAfterAt)
                
                if (!hasSpaceOrNewline) {
                  // We're in a mention - show autocomplete
                  const query = textAfterAt.toLowerCase()
                  setMentionQuery(query)
                  setShowMentionAutocomplete(true)
                } else {
                  setShowMentionAutocomplete(false)
                }
              } else {
                setShowMentionAutocomplete(false)
              }
              
              // Check if a newline was just added - only scroll if cursor would be below keyboard
              if (newText.length > text.length && newText.endsWith('\n')) {
                // Newline detected - check if we need to scroll (forceScroll = true)
                setTimeout(() => {
                  scrollInputIntoView(undefined, true)
                }, 50) // Short delay to allow text to render
              }
            }}
            onBlur={handleTextBlur}
            onContentSizeChange={handleTextContentSizeChange}
            onFocus={() => {
              // When input is focused, ensure it's visible above keyboard
              setTimeout(() => {
                scrollInputIntoView()
              }, 300) // Wait for keyboard animation
            }}
            onSelectionChange={(event) => {
              // Track cursor position
              const { start } = event.nativeEvent.selection
              cursorPositionRef.current = start
              
              // When cursor position changes, only scroll if cursor is close to keyboard
              // This handles cases where user moves cursor or text wraps
              setTimeout(() => {
                scrollInputIntoView(undefined, false)
              }, 100)
              
              // Check for "@" mention trigger at new cursor position
              const textBeforeCursor = text.substring(0, start)
              const lastAtIndex = textBeforeCursor.lastIndexOf("@")
              
              if (lastAtIndex !== -1) {
                const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1)
                const hasSpaceOrNewline = /[\s\n]/.test(textAfterAt)
                
                if (!hasSpaceOrNewline) {
                  const query = textAfterAt.toLowerCase()
                  setMentionQuery(query)
                  setShowMentionAutocomplete(true)
                } else {
                  setShowMentionAutocomplete(false)
                }
              } else {
                setShowMentionAutocomplete(false)
              }
            }}
            placeholder="Tell the group what you think..."
            placeholderTextColor={theme2Colors.textSecondary}
            multiline
            autoFocus={true}
            showSoftInputOnFocus={true}
            keyboardType="default"
            returnKeyType="default"
            blurOnSubmit={false}
            editable={true}
          />
          
          {/* Mention Autocomplete - positioned absolutely within input container */}
          {showMentionAutocomplete && (
            <View style={{ position: 'absolute', top: '100%', left: 0, marginTop: 8, zIndex: 1000, width: 280 }}>
              <MentionAutocomplete
                visible={showMentionAutocomplete}
                query={mentionQuery}
                users={mentionUsers}
                onSelect={handleMentionSelect}
                position={null}
              />
            </View>
          )}
        </View>

        {/* Embedded media preview - show inline where they appear in text */}
        {embeddedMedia.length > 0 && (
          <View style={styles.embeddedMediaContainer}>
            {embeddedMedia.map((embed, index) => (
              <View key={`${embed.platform}-${embed.embedId}-${index}`} style={styles.embeddedMediaItem}>
                <EmbeddedPlayer embed={embed} />
                <TouchableOpacity
                  style={styles.embeddedMediaRemove}
                  onPress={() => handleRemoveEmbed(index)}
                >
                  <FontAwesome name="times" size={14} color={colors.white} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Voice memos inline (not in carousel) */}
        {mediaItems.filter(item => item.type === "audio").map((item) => (
          <View key={item.id} style={styles.inlineAudioContainer}>
            <TouchableOpacity
              style={styles.audioPill}
              onPress={() => handleToggleAudio(item.id, item.uri)}
              activeOpacity={0.85}
            >
              <View style={styles.audioIcon}>
                {audioLoading[item.id] ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <FontAwesome
                    name={playingAudioId === item.id ? "pause" : "play"}
                    size={16}
                    color={colors.white}
                  />
                )}
              </View>
              <View style={styles.audioInfo}>
                <Text style={styles.audioLabel}>Voice memo</Text>
                <View style={styles.audioProgressTrack}>
                  <View
                    style={[
                      styles.audioProgressFill,
                      {
                        width: `${
                          audioDurations[item.id] > 0
                            ? Math.max((audioProgress[item.id] || 0) / audioDurations[item.id], 0.02) * 100
                            : 2
                        }%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.audioTime}>
                  {formatMillis(audioProgress[item.id] || 0)} /{" "}
                  {audioDurations[item.id] ? formatMillis(audioDurations[item.id]) : "--:--"}
                </Text>
              </View>
            </TouchableOpacity>
            {!uploadingMedia[item.id] && (
              <TouchableOpacity style={styles.inlineAudioDelete} onPress={() => handleRemoveMedia(item.id)}>
                <FontAwesome name="times" size={12} color={colors.white} />
              </TouchableOpacity>
            )}
            {uploadingMedia[item.id] && (
              <View style={styles.inlineAudioUploadOverlay}>
                <ActivityIndicator size="small" color={colors.white} />
              </View>
            )}
          </View>
        ))}

      </ScrollView>
        )}
      </KeyboardAvoidingView>

      {/* User Profile Modal */}
      <UserProfileModal
        visible={userProfileModalVisible}
        userId={selectedMentionUser?.id || null}
        userName={selectedMentionUser?.name || null}
        userAvatarUrl={selectedMentionUser?.avatar_url}
        groupId={currentGroupId}
        onClose={() => {
          setUserProfileModalVisible(false)
          setSelectedMentionUser(null)
        }}
        onViewHistory={(userId) => {
          router.push({
            pathname: "/(main)/history",
            params: {
              focusGroupId: currentGroupId,
              filterMemberId: userId,
            },
          })
        }}
      />

      {/* Video Message Modal */}
      <VideoMessageModal
        visible={showVideoModal}
        question={personalizedQuestion || activePrompt?.question || ""}
        onClose={() => setShowVideoModal(false)}
        onAddVideo={handleAddVideo}
      />

      {/* Video Tooltip */}
      {showVideoTooltip && videoButtonLayout && (
        <View
          style={[
            styles.tooltipContainer,
            {
              bottom: Platform.OS === "android" 
                ? keyboardHeight + spacing.xl + spacing.md + 60 + 10
                : keyboardHeight + 60 + 10,
              left: videoButtonLayout.x + (videoButtonLayout.width / 2) - 100,
            },
          ]}
        >
          <View style={styles.tooltipBubble}>
            <Text style={styles.tooltipText}>You can now record a video answer</Text>
            <TouchableOpacity
              style={{ marginTop: spacing.xs, alignItems: "center" }}
              onPress={dismissVideoTooltip}
            >
              <Text style={[styles.tooltipText, { fontSize: 12, color: theme2Colors.blue }]}>Got it</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.tooltipPointer} />
          <View style={styles.tooltipPointerInner} />
        </View>
      )}

      {/* Toolbar - positioned above keyboard */}
      {!isNavigating && (
      <View style={[styles.toolbar, { bottom: Platform.OS === "android" ? keyboardHeight + spacing.xl + spacing.md : keyboardHeight }]}>
        <View style={styles.toolbarButtons}>
          <View style={styles.toolCluster}>
            <TouchableOpacity style={styles.iconButton} onPress={handleGalleryAction}>
              <FontAwesome name="image" size={18} color={theme2Colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={openCamera}>
              <FontAwesome name="camera" size={18} color={theme2Colors.text} />
            </TouchableOpacity>
            <View
              ref={videoButtonRef}
              onLayout={(event) => {
                const { x, y, width, height } = event.nativeEvent.layout
                setVideoButtonLayout({ x, y, width, height })
              }}
            >
              <TouchableOpacity style={styles.videoIconButton} onPress={() => {
                dismissVideoTooltip()
                setShowVideoModal(true)
              }}>
                <FontAwesome name="video-camera" size={18} color={theme2Colors.text} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.iconButton} onPress={startRecording}>
              <FontAwesome name="microphone" size={18} color={theme2Colors.text} />
            </TouchableOpacity>
            {/* Shuffle button commented out - everyone answers the same question */}
            {/* <TouchableOpacity 
              style={[styles.iconButton, editMode && styles.iconButtonDisabled]} 
              onPress={shufflePrompt}
              disabled={editMode}
            >
              <FontAwesome name="random" size={18} color={editMode ? colors.gray[600] : theme2Colors.text} />
            </TouchableOpacity> */}
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setShowSongModal(true)}
            >
              <FontAwesome name="music" size={18} color={theme2Colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.toolbarRight}>
            {(text.trim().length > 0 || mediaItems.length > 0) && (
              <TouchableOpacity 
                style={[styles.iconButton, styles.postButtonInline]} 
                onPress={handlePost}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={theme2Colors.white} />
                ) : (
                  <FontAwesome name="arrow-right" size={18} color={theme2Colors.white} />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
      )}

      {/* Add Song Modal */}
      <Modal
        visible={showSongModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSongModal(false)}
      >
        <View style={styles.voiceBackdrop}>
          <Animated.View style={styles.voiceBackdropOverlay1} />
          <Animated.View style={styles.voiceBackdropOverlay2} />
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setShowSongModal(false)}
          />
          <View style={styles.voiceSheet}>
            <Text style={styles.voiceTitle}>Add a song</Text>
            <Text style={styles.voiceDescription}>
              Paste a Spotify, Apple Music, or Soundcloud link to embed it in your entry
            </Text>
            <TextInput
              style={styles.songUrlInput}
              value={songUrlInput}
              onChangeText={setSongUrlInput}
              placeholder="https://open.spotify.com/track/... or soundcloud.com/..."
              placeholderTextColor={theme2Colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <TouchableOpacity
              style={[styles.addSongButton, !songUrlInput.trim() && styles.voiceIconDisabled]}
              onPress={handleAddSong}
              disabled={!songUrlInput.trim()}
              activeOpacity={0.7}
            >
              <Text style={styles.addSongButtonText}>Add Song</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.voiceCancel} onPress={() => setShowSongModal(false)}>
              <Text style={styles.voiceCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={voiceModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!recording) cleanupVoiceModal()
        }}
      >
        <View style={styles.voiceBackdrop}>
          <Animated.View style={styles.voiceBackdropOverlay1} />
          <Animated.View style={styles.voiceBackdropOverlay2} />
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => {
              if (!recording) cleanupVoiceModal()
            }}
          />
          <View style={styles.voiceSheet}>
            <Text style={styles.voiceTitle}>Voice memo</Text>
            <Text style={styles.voiceTimer}>{formatDuration(voiceDuration)}</Text>
            <View style={styles.voiceControlRow}>
              <TouchableOpacity
                style={styles.voiceIconButton}
                onPress={() => {
                  if (recording) {
                    stopRecording()
                  } else {
                    cleanupVoiceModal()
                    startRecording()
                  }
                }}
              >
                <FontAwesome name={recording ? "stop" : "microphone"} size={22} color={isDark ? colors.white : theme2Colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.voiceIconButton, !voiceUri && styles.voiceIconDisabled]}
                disabled={!voiceUri}
                onPress={() => {
                  if (!voiceUri) return
                  playVoiceMemo()
                }}
              >
                <FontAwesome
                  name={isPlayingVoice ? "pause" : "play"}
                  size={22}
                  color={voiceUri ? (isDark ? colors.white : theme2Colors.text) : theme2Colors.textSecondary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.voiceIconButton, !voiceUri && styles.voiceIconDisabled]}
                disabled={!voiceUri}
                onPress={cleanupVoiceModal}
              >
                <FontAwesome name="trash" size={20} color={voiceUri ? (isDark ? colors.white : theme2Colors.text) : theme2Colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.voiceSendButton, !voiceUri && styles.voiceIconDisabled]}
                disabled={!voiceUri}
                onPress={addVoiceMemoToEntry}
              >
                <FontAwesome name="paper-plane" size={18} color={voiceUri ? theme2Colors.white : theme2Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.voiceCancel} onPress={() => (!recording ? cleanupVoiceModal() : null)}>
              <Text style={styles.voiceCancelText}>{recording ? "Stop recording to close" : "Close"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Uploading Modal */}
      <Modal
        visible={showUploadingModal}
        animationType="fade"
        transparent={false}
        onRequestClose={() => {}}
      >
        <View style={styles.successBackdrop}>
          <View style={styles.successContainer}>
            <ActivityIndicator size="large" color={theme2Colors.text} />
            <Text style={styles.successTitle}>Uploading your media</Text>
            <Text style={styles.uploadingSubtitle}>Posting soon...</Text>
          </View>
        </View>
      </Modal>

      {/* File Size Too Large Modal */}
      <Modal
        visible={showFileSizeModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowFileSizeModal(false)}
      >
        <View style={styles.successBackdrop}>
          <Animated.View style={styles.successBackdropOverlay1} />
          <Animated.View style={styles.successBackdropOverlay2} />
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setShowFileSizeModal(false)}
          />
          <View style={styles.successContainer}>
            <Text style={styles.successTitle}>File too large</Text>
            <Text style={styles.uploadingSubtitle}>
              The file you selected is larger than 2GB. Please choose a smaller file.
            </Text>
            <TouchableOpacity
              style={styles.successButton}
              onPress={() => setShowFileSizeModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.successButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function formatDuration(totalSeconds: number) {
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

// Separate component for draggable media thumbnail to avoid hooks violation
function DraggableMediaThumbnail({
  item,
  itemIndex,
  totalItems,
  draggedItemId,
  dragOverIndex,
  dragPosition,
  uploadingMedia,
  onDragStart,
  onDragEnd,
  onSetDragOverIndex,
  onRemoveMedia,
  colors,
  styles,
}: {
  item: MediaItem
  itemIndex: number
  totalItems: number
  draggedItemId: string | null
  dragOverIndex: number | null
  dragPosition: Animated.ValueXY
  uploadingMedia: Record<string, boolean>
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onSetDragOverIndex: (index: number | null) => void
  onRemoveMedia: (id: string) => void
  colors: any
  styles: any
}) {
  const isDragging = draggedItemId === item.id
  const isDragOver = dragOverIndex === itemIndex && draggedItemId !== item.id
  
  // PanResponder for drag and drop - only active when this item is being dragged
  const panResponder = useMemo(
    () => {
      if (draggedItemId !== item.id) {
        // Return empty pan responder when not dragging this item
        return PanResponder.create({
          onStartShouldSetPanResponder: () => false,
          onMoveShouldSetPanResponder: () => false,
        })
      }
      
      // Active pan responder for the item being dragged
      return PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_, gestureState) => {
          dragPosition.setValue({ x: gestureState.dx, y: gestureState.dy })
          // Calculate which index we're dragging over based on horizontal position
          const thumbWidth = 120 + spacing.sm
          const newIndex = Math.round(gestureState.dx / thumbWidth) + itemIndex
          if (newIndex >= 0 && newIndex < totalItems && newIndex !== itemIndex) {
            onSetDragOverIndex(newIndex)
          }
        },
        onPanResponderRelease: () => {
          onDragEnd()
        },
      })
    },
    [item.id, itemIndex, totalItems, draggedItemId, dragPosition, onSetDragOverIndex, onDragEnd]
  )

  return (
    <Animated.View
      style={[
        styles.mediaThumbnailWrapper,
        isDragging && {
          transform: [{ translateX: dragPosition.x }, { translateY: dragPosition.y }],
          opacity: 0.7,
          zIndex: 1000,
          elevation: 10,
        },
        isDragOver && styles.mediaThumbnailDragOver,
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onLongPress={() => {
          if (!draggedItemId && !uploadingMedia[item.id]) {
            onDragStart(item.id)
            dragPosition.setValue({ x: 0, y: 0 })
          }
        }}
        delayLongPress={300}
        style={{ flex: 1 }}
      >
        {item.type === "photo" ? (
          <>
            <Image source={{ uri: item.uri }} style={styles.mediaThumbnail} resizeMode="cover" />
            {uploadingMedia[item.id] && (
              <View style={styles.uploadOverlay}>
                <ActivityIndicator size="large" color={colors.white} />
                <Text style={styles.uploadText}>Uploading...</Text>
              </View>
            )}
          </>
        ) : item.type === "video" ? (
          <>
            <VideoThumbnail uri={item.uri} />
            {uploadingMedia[item.id] && (
              <View style={styles.uploadOverlay}>
                <ActivityIndicator size="large" color={colors.white} />
                <Text style={styles.uploadText}>Uploading...</Text>
              </View>
            )}
          </>
        ) : null}
      </TouchableOpacity>
      {!uploadingMedia[item.id] && (
        <TouchableOpacity 
          style={styles.mediaDelete} 
          onPress={(e) => {
            e.stopPropagation()
            onRemoveMedia(item.id)
          }}
        >
          <FontAwesome name="times" size={12} color={colors.white} />
        </TouchableOpacity>
      )}
    </Animated.View>
  )
}

// Component to render video thumbnail
function VideoThumbnail({ uri }: { uri: string }) {
  const { colors } = useTheme()
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null)
  const videoRef = useRef<Video>(null)

  const thumbnailStyles = StyleSheet.create({
    videoThumb: {
      width: 120,
      height: 120,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.gray[900],
      position: "relative",
      overflow: "hidden",
    },
    videoThumbVideo: {
      width: "100%",
      height: "100%",
    },
    videoThumbImage: {
      width: "100%",
      height: "100%",
    },
    videoThumbOverlay: {
      position: "absolute",
      width: "100%",
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.3)",
    },
  })

  useEffect(() => {
    // Generate thumbnail by loading video and capturing first frame
    const generateThumbnail = async () => {
      try {
        // Create a hidden video element to capture thumbnail
        // We'll use a workaround: render Video component off-screen
        // For now, just show the video icon - we'll improve this
        setThumbnailUri(null)
      } catch (error) {
        console.warn("[VideoThumbnail] Failed to generate thumbnail:", error)
      }
    }
    generateThumbnail()
  }, [uri])

  // Use Video component to render thumbnail
  return (
    <View style={thumbnailStyles.videoThumb}>
      {thumbnailUri ? (
        <Image source={{ uri: thumbnailUri }} style={thumbnailStyles.videoThumbImage} />
      ) : (
        <>
          <Video
            ref={videoRef}
            source={{ uri }}
            style={thumbnailStyles.videoThumbVideo}
            resizeMode={ResizeMode.COVER}
            shouldPlay={false}
            isMuted={true}
            isLooping={false}
            useNativeControls={false}
            onLoad={() => {
              // Video loaded, it will show first frame
            }}
          />
          <View style={thumbnailStyles.videoThumbOverlay}>
            <FontAwesome name="play-circle" size={32} color={colors.white} />
          </View>
        </>
      )}
    </View>
  )
}
