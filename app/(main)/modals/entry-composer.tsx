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
} from "react-native"
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router"
import * as ImagePicker from "expo-image-picker"
import { Audio, Video, ResizeMode } from "expo-av"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "../../../lib/supabase"
import { createEntry, updateEntry, getAllPrompts, getMemorials, getGroupMembers, getGroup, getEntryById } from "../../../lib/db"
import type { Prompt } from "../../../lib/types"
import { uploadMedia } from "../../../lib/storage"
import { typography, spacing } from "../../../lib/theme"
import { useTheme } from "../../../lib/theme-context"
import { Button } from "../../../components/Button"
import { FontAwesome } from "@expo/vector-icons"
import { parseEmbedUrl, extractEmbedUrls, type ParsedEmbed } from "../../../lib/embed-parser"
import { EmbeddedPlayer } from "../../../components/EmbeddedPlayer"
import * as Clipboard from "expo-clipboard"
import { personalizeMemorialPrompt, replaceDynamicVariables } from "../../../lib/prompts"
import * as FileSystem from "expo-file-system/legacy"
import { usePostHog } from "posthog-react-native"
import { captureEvent, safeCapture } from "../../../lib/posthog"

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
  const date = params.date as string
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
  const textInputRef = useRef<TextInput>(null)
  const scrollViewRef = useRef<ScrollView>(null)
  const inputContainerRef = useRef<View>(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [uploadingMedia, setUploadingMedia] = useState<Record<string, boolean>>({})
  const [showUploadingModal, setShowUploadingModal] = useState(false)
  const [showFileSizeModal, setShowFileSizeModal] = useState(false)
  const posthog = usePostHog()
  
  // File size limit: 2GB = 2 * 1024 * 1024 * 1024 bytes
  const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024

  useEffect(() => {
    loadUserAndGroup()
  }, [groupIdParam])

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

  // Personalize prompt question with variables
  const personalizedQuestion = useMemo(() => {
    if (!activePrompt?.question) return activePrompt?.question
    
    let question = activePrompt.question
    const variables: Record<string, string> = {}
    
    // Handle memorial_name variable
    if (question.match(/\{.*memorial_name.*\}/i) && memorials.length > 0) {
      // Use first memorial (or could cycle based on date)
      question = personalizeMemorialPrompt(question, memorials[0].name)
    }
    
    // Handle member_name variable
    if (question.match(/\{.*member_name.*\}/i) && members.length > 0) {
      // For now, use first member (could be improved to cycle)
      variables.member_name = members[0].user?.name || "them"
      question = replaceDynamicVariables(question, variables)
    }
    
    return question
  }, [activePrompt?.question, memorials, members])

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
      Alert.alert("Invalid URL", "Please enter a valid Spotify or Apple Music URL.")
    }
  }

  // Remove embedded media
  function handleRemoveEmbed(index: number) {
    setEmbeddedMedia((prev) => prev.filter((_, i) => i !== index))
  }

  async function checkFileSize(uri: string): Promise<boolean> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri)
      if (fileInfo.exists && fileInfo.size !== undefined) {
        if (fileInfo.size > MAX_FILE_SIZE) {
          setShowFileSizeModal(true)
          return false
        }
      }
      return true
    } catch (error) {
      console.warn("[entry-composer] Failed to check file size:", error)
      // If we can't check size, allow it (better than blocking)
      return true
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
      for (const asset of result.assets) {
        const isValid = await checkFileSize(asset.uri)
        if (isValid) {
          validAssets.push(asset)
        }
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
    Alert.alert(
      "Add Media",
      "Choose how you'd like to add photos or videos",
      [
        {
          text: "Take Photo/Video",
          onPress: openCamera,
        },
        {
          text: "Choose from Gallery",
          onPress: openGallery,
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ],
      { cancelable: true }
    )
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
      const isValid = await checkFileSize(asset.uri)
      if (!isValid) {
        return // File size modal already shown
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
      }, 300)
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
        if (group.type === "family" && p.category === "Friends") return false
        if (group.type === "friends" && p.category === "Family") return false
        
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

  function exitComposer() {
    // Reset to original prompt when closing (if user didn't post)
    // This ensures that if user shuffles but doesn't answer, they see original prompt next time
    if (originalPromptIdRef.current && prompt && prompt.id === originalPromptIdRef.current) {
      setActivePrompt(prompt as Prompt)
    }
    
    if (returnTo) {
      router.replace(returnTo)
    } else if (router.canGoBack()) {
      router.back()
    } else {
      router.replace("/(main)/home")
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
      const uploadedMedia = await Promise.all(
        mediaItems.map(async (item) => {
          if (item.uri.startsWith("http")) {
            // Existing URL, keep as-is
            return { url: item.uri, type: item.type }
          }
          // New local file, upload it
          try {
            const remoteUrl = await uploadMedia(currentGroupId, storageKey, item.uri, item.type)
            setUploadingMedia(prev => ({ ...prev, [item.id]: false }))
            return { url: remoteUrl, type: item.type }
          } catch (error: any) {
            setUploadingMedia(prev => ({ ...prev, [item.id]: false }))
            // Log error but don't throw immediately - let other uploads complete
            console.error(`[entry-composer] Failed to upload ${item.type}:`, error)
            throw new Error(`Failed to upload ${item.type}: ${error.message || "Unknown error"}`)
          }
        }),
      )

      // Prepare embedded media for storage
      const embeddedMediaForStorage = embeddedMedia.map((embed) => ({
        platform: embed.platform,
        url: embed.url,
        embedId: embed.embedId,
        embedType: embed.embedType,
        embedUrl: embed.embedUrl,
      }))

      if (editMode && entryId) {
        // Update existing entry
        await updateEntry(
          entryId,
          userId,
          {
            text_content: text.trim() || undefined,
            media_urls: uploadedMedia.map((item) => item.url),
            media_types: uploadedMedia.map((item) => item.type),
            embedded_media: embeddedMediaForStorage.length > 0 ? embeddedMediaForStorage : undefined,
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
          queryClient.invalidateQueries({ queryKey: ["historyEntries", currentGroupId], exact: false }),
          queryClient.invalidateQueries({ queryKey: ["historyComments"] }),
        ])
      } else {
        // Create new entry
        await createEntry({
          group_id: currentGroupId,
          user_id: userId,
          prompt_id: activePrompt.id,
          date,
          text_content: text.trim() || undefined,
          media_urls: uploadedMedia.map((item) => item.url),
          media_types: uploadedMedia.map((item) => item.type),
          embedded_media: embeddedMediaForStorage.length > 0 ? embeddedMediaForStorage : undefined,
        })

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

        // Invalidate queries scoped to the specific group to prevent cross-group contamination
        // Use prefix matching to invalidate all related queries
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["entries", currentGroupId], exact: false }),
          queryClient.invalidateQueries({ queryKey: ["userEntry", currentGroupId], exact: false }),
          queryClient.invalidateQueries({ queryKey: ["historyEntries", currentGroupId], exact: false }),
          queryClient.invalidateQueries({ queryKey: ["dailyPrompt", currentGroupId], exact: false }),
          queryClient.invalidateQueries({ queryKey: ["historyComments"] }),
        ])
      }

      // Hide uploading modal and show success
      setShowUploadingModal(false)
      setShowSuccessModal(true)
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

  // Auto-focus input when component mounts
  useEffect(() => {
    // Multiple attempts to ensure focus works
    const timers = [
      setTimeout(() => textInputRef.current?.focus(), 100),
      setTimeout(() => textInputRef.current?.focus(), 250),
      setTimeout(() => textInputRef.current?.focus(), 500),
    ]
    
    return () => {
      timers.forEach(timer => clearTimeout(timer))
    }
  }, [])

  // Also focus when screen comes into focus (handles navigation back to this screen)
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => {
        textInputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }, [])
  )

  // Handle input layout to ensure focus after render
  const handleInputLayout = useCallback(() => {
    setTimeout(() => {
      textInputRef.current?.focus()
    }, 50)
  }, [])

  // Create dynamic styles based on theme
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.black,
    },
    keyboardAvoidingView: {
      flex: 1,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: spacing.md,
      paddingTop: spacing.xxl,
      gap: spacing.md,
    },
    headerTitle: {
      ...typography.h3,
      color: colors.white,
      flex: 1,
    },
    closeButton: {
      ...typography.h2,
      fontSize: 28,
      color: colors.white,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: spacing.lg,
      paddingBottom: spacing.xxl * 2 + 80, // Extra padding at bottom for toolbar clearance (toolbar height ~80px)
    },
    question: {
      ...typography.h2,
      fontSize: 24,
      marginBottom: spacing.sm,
      marginTop: spacing.xxl,
      color: colors.white,
    },
    description: {
      ...typography.body,
      color: colors.gray[400],
      marginBottom: spacing.xl,
    },
    input: {
      ...typography.body,
      fontSize: 16,
      lineHeight: 24,
      color: colors.white,
      minHeight: 200,
      textAlignVertical: "top",
    },
    mediaScrollContainer: {
      marginTop: spacing.md,
      marginBottom: spacing.md,
    },
    mediaScrollContent: {
      gap: spacing.sm,
      paddingRight: spacing.lg,
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
      borderTopColor: colors.gray[800],
      backgroundColor: colors.black,
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
      backgroundColor: isDark ? colors.gray[800] : colors.black,
      justifyContent: "center",
      alignItems: "center",
    },
    iconButtonDisabled: {
      opacity: 0.5,
    },
    closeButtonIcon: {
      marginLeft: spacing.sm,
    },
    postButtonInline: {
      backgroundColor: colors.accent,
      marginLeft: spacing.sm,
    },
    postButton: {
      width: "100%",
    },
    voiceBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.9)",
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.lg,
    },
    voiceSheet: {
      width: "100%",
      backgroundColor: colors.black,
      borderRadius: 24,
      padding: spacing.xl,
      gap: spacing.md,
    },
    voiceTitle: {
      ...typography.h2,
      fontSize: 22,
      color: colors.white,
    },
    voiceTimer: {
      ...typography.h1,
      fontSize: 32,
      color: colors.white,
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
      borderColor: colors.gray[700],
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.gray[900],
    },
    voiceSendButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.accent,
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
      color: colors.gray[400],
    },
    voiceDescription: {
      ...typography.body,
      color: colors.gray[400],
      textAlign: "center",
      marginBottom: spacing.md,
    },
    songUrlInput: {
      ...typography.body,
      color: colors.white,
      backgroundColor: colors.gray[900],
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.gray[700],
    },
    voiceButtonLabel: {
      ...typography.caption,
      color: colors.white,
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
    },
    successBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.95)",
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.xl,
    },
    successContainer: {
      width: "100%",
      maxWidth: 400,
      alignItems: "center",
      gap: spacing.xl,
    },
    successTitle: {
      ...typography.h1,
      fontSize: 32,
      color: "#ffffff", // Always white since modal background is black
      textAlign: "center",
    },
    successButton: {
      width: "100%",
    },
    uploadingSubtitle: {
      ...typography.body,
      color: colors.gray[400],
      textAlign: "center",
      marginTop: spacing.md,
    },
  }), [colors, isDark])

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
        enabled={true}
      >
        <ScrollView 
          ref={scrollViewRef}
          style={styles.content} 
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
        <Text style={styles.question}>{personalizedQuestion || activePrompt?.question}</Text>
        <Text style={styles.description}>{activePrompt?.description}</Text>

        <View ref={inputContainerRef} onLayout={handleInputLayout}>
          <TextInput
            ref={textInputRef}
            style={styles.input}
            value={text}
            onChangeText={setText}
            onBlur={handleTextBlur}
            placeholder="Start writing..."
            placeholderTextColor={colors.gray[500]}
            multiline
            autoFocus={true}
            showSoftInputOnFocus={true}
            keyboardType="default"
            returnKeyType="default"
            blurOnSubmit={false}
          />
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

        {/* Media preview - horizontal scrollable feed (photos/videos only, newest first) */}
        {mediaItems.filter(item => item.type !== "audio").length > 0 && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.mediaScrollContainer}
            contentContainerStyle={styles.mediaScrollContent}
          >
            {[...mediaItems.filter(item => item.type !== "audio")].reverse().map((item) => (
              <View key={item.id} style={styles.mediaThumbnailWrapper}>
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
                {!uploadingMedia[item.id] && (
                  <TouchableOpacity style={styles.mediaDelete} onPress={() => handleRemoveMedia(item.id)}>
                    <FontAwesome name="times" size={12} color={colors.white} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Toolbar - positioned above keyboard */}
      <View style={[styles.toolbar, { bottom: Platform.OS === "android" ? keyboardHeight + spacing.lg : keyboardHeight }]}>
        <View style={styles.toolbarButtons}>
          <View style={styles.toolCluster}>
            <TouchableOpacity style={styles.iconButton} onPress={handleGalleryAction}>
              <FontAwesome name="image" size={18} color={colors.white} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={startRecording}>
              <FontAwesome name="microphone" size={18} color={colors.white} />
            </TouchableOpacity>
            {/* Shuffle button commented out - everyone answers the same question */}
            {/* <TouchableOpacity 
              style={[styles.iconButton, editMode && styles.iconButtonDisabled]} 
              onPress={shufflePrompt}
              disabled={editMode}
            >
              <FontAwesome name="random" size={18} color={editMode ? colors.gray[600] : colors.white} />
            </TouchableOpacity> */}
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setShowSongModal(true)}
            >
              <FontAwesome name="music" size={18} color={colors.white} />
            </TouchableOpacity>
          </View>
          <View style={styles.toolbarRight}>
            {text.trim().length > 0 && (
              <TouchableOpacity 
                style={[styles.iconButton, styles.postButtonInline]} 
                onPress={handlePost}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <FontAwesome name="arrow-right" size={18} color="#ffffff" />
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.iconButton, styles.closeButtonIcon]} onPress={exitComposer}>
              <FontAwesome name="times" size={18} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Add Song Modal */}
      <Modal
        visible={showSongModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSongModal(false)}
      >
        <View style={styles.voiceBackdrop}>
          <View style={styles.voiceSheet}>
            <Text style={styles.voiceTitle}>Add a song</Text>
            <Text style={styles.voiceDescription}>
              Paste a Spotify or Apple Music link to embed it in your entry
            </Text>
            <TextInput
              style={styles.songUrlInput}
              value={songUrlInput}
              onChangeText={setSongUrlInput}
              placeholder="https://open.spotify.com/track/..."
              placeholderTextColor={colors.gray[500]}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Button
              title="Add Song"
              onPress={handleAddSong}
              disabled={!songUrlInput.trim()}
              style={styles.addSongButton}
            />
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
                <FontAwesome name={recording ? "stop" : "microphone"} size={22} color={colors.white} />
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
                  color={voiceUri ? colors.white : colors.gray[600]}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.voiceIconButton, !voiceUri && styles.voiceIconDisabled]}
                disabled={!voiceUri}
                onPress={cleanupVoiceModal}
              >
                <FontAwesome name="trash" size={20} color={voiceUri ? colors.white : colors.gray[600]} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.voiceSendButton, !voiceUri && styles.voiceIconDisabled]}
                disabled={!voiceUri}
                onPress={addVoiceMemoToEntry}
              >
                <FontAwesome name="paper-plane" size={18} color={voiceUri ? colors.white : colors.gray[600]} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.voiceCancel} onPress={() => (!recording ? cleanupVoiceModal() : null)}>
              <Text style={styles.voiceCancelText}>{recording ? "Stop recording to close" : "Close"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setShowSuccessModal(false)
          exitComposer()
        }}
      >
        <View style={styles.successBackdrop}>
          <View style={styles.successContainer}>
            <Text style={styles.successTitle}>You've answered today's question!</Text>
            <Button
              title="See what everyone else said"
              onPress={() => {
                setShowSuccessModal(false)
                exitComposer()
              }}
              style={styles.successButton}
            />
          </View>
        </View>
      </Modal>

      {/* Uploading Modal */}
      <Modal
        visible={showUploadingModal}
        animationType="fade"
        transparent
        onRequestClose={() => {}}
      >
        <View style={styles.successBackdrop}>
          <View style={styles.successContainer}>
            <ActivityIndicator size="large" color={colors.white} />
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
          <View style={styles.successContainer}>
            <Text style={styles.successTitle}>File too large</Text>
            <Text style={styles.uploadingSubtitle}>
              The file you selected is larger than 2GB. Please choose a smaller file.
            </Text>
            <Button
              title="OK"
              onPress={() => setShowFileSizeModal(false)}
              style={styles.successButton}
            />
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
