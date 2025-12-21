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
  Animated,
} from "react-native"
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router"
import * as ImagePicker from "expo-image-picker"
import { Audio, Video, ResizeMode } from "expo-av"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "../../../lib/supabase"
import { createBirthdayCardEntry, updateBirthdayCardEntry, getBirthdayCardEntry, getBirthdayCard } from "../../../lib/db"
import type { BirthdayCard, BirthdayCardEntry } from "../../../lib/types"
import { uploadMedia } from "../../../lib/storage"
import { typography, spacing } from "../../../lib/theme"
import { useTheme } from "../../../lib/theme-context"
import { Button } from "../../../components/Button"
import { FontAwesome } from "@expo/vector-icons"
import { parseEmbedUrl, extractEmbedUrls, type ParsedEmbed } from "../../../lib/embed-parser"
import { EmbeddedPlayer } from "../../../components/EmbeddedPlayer"
import * as Clipboard from "expo-clipboard"
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

export default function BirthdayCardComposer() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { colors, isDark } = useTheme()
  const cardId = params.cardId as string
  const groupIdParam = params.groupId as string | undefined
  const birthdayUserId = params.birthdayUserId as string
  const birthdayUserName = params.birthdayUserName as string
  const returnTo = (params.returnTo as string) || undefined
  const entryId = params.entryId as string | undefined
  const editMode = !!entryId

  // Theme 2 color palette matching new design system
  const theme2Colors = {
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
  const [card, setCard] = useState<BirthdayCard | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const soundRef = useRef<Audio.Sound | null>(null)
  const queryClient = useQueryClient()
  const [embeddedMedia, setEmbeddedMedia] = useState<ParsedEmbed[]>([])
  const [showSongModal, setShowSongModal] = useState(false)
  const [songUrlInput, setSongUrlInput] = useState("")
  const textInputRef = useRef<TextInput>(null)
  const scrollViewRef = useRef<ScrollView>(null)
  const inputContainerRef = useRef<View>(null)
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

  // Load card data
  const { data: cardData } = useQuery({
    queryKey: ["birthdayCard", cardId],
    queryFn: () => (cardId ? getBirthdayCard(cardId) : null),
    enabled: !!cardId,
  })

  useEffect(() => {
    if (cardData) {
      setCard(cardData)
    }
  }, [cardData])

  // Load existing entry when in edit mode
  const { data: existingEntry } = useQuery({
    queryKey: ["birthdayCardEntry", entryId],
    queryFn: () => (entryId ? getBirthdayCardEntry(entryId) : null),
    enabled: editMode && !!entryId,
  })

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
    }
  }, [editMode, existingEntry])

  // Reset form when cardId changes - but not in edit mode
  useEffect(() => {
    if (editMode) return // Don't reset form in edit mode
    
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
  }, [cardId, editMode])

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


  const handleRemoveMedia = useCallback((id: string) => {
    setMediaItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  function exitComposer() {
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
      Alert.alert("Error", "Please add some content to your birthday card message")
      return
    }

    if (!currentGroupId || !userId || !cardId) {
      Alert.alert("Error", "Unable to determine group or card")
      return
    }

    // Show confirmation dialog for edits
    if (editMode && entryId) {
      Alert.alert(
        "Save changes?",
        "Are you sure you want to update this birthday card message?",
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
    if (!currentGroupId || !userId || !cardId) {
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
        await updateBirthdayCardEntry(
          entryId,
          userId,
          {
            textContent: text.trim() || undefined,
            mediaUrls: uploadedMedia.map((item) => item.url),
            mediaTypes: uploadedMedia.map((item) => item.type),
            embeddedMedia: embeddedMediaForStorage.length > 0 ? embeddedMediaForStorage : undefined,
          }
        )

        // Track updated_birthday_card_entry event
        const hasMedia = uploadedMedia.length > 0 || embeddedMedia.length > 0
        const mediaTypes: string[] = uploadedMedia.map((item) => item.type)
        if (embeddedMedia.length > 0) {
          mediaTypes.push("embedded")
        }
        
        safeCapture(posthog, "updated_birthday_card_entry", {
          entry_id: entryId,
          card_id: cardId,
          group_id: currentGroupId,
          has_media: hasMedia,
          text_length: text.trim().length,
        })

        // Invalidate queries for the updated entry
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["birthdayCardEntry", entryId] }),
          queryClient.invalidateQueries({ queryKey: ["birthdayCardEntries", cardId] }),
          queryClient.invalidateQueries({ queryKey: ["myCardEntries", currentGroupId], exact: false }),
          queryClient.invalidateQueries({ queryKey: ["upcomingBirthdayCards", currentGroupId], exact: false }),
        ])
      } else {
        // Create new entry
        await createBirthdayCardEntry({
          cardId,
          contributorUserId: userId,
          textContent: text.trim() || undefined,
          mediaUrls: uploadedMedia.map((item) => item.url),
          mediaTypes: uploadedMedia.map((item) => item.type),
          embeddedMedia: embeddedMediaForStorage.length > 0 ? embeddedMediaForStorage : undefined,
        })

        // Track created_birthday_card_entry event
        const hasMedia = uploadedMedia.length > 0 || embeddedMedia.length > 0
        const mediaTypes: string[] = uploadedMedia.map((item) => item.type)
        if (embeddedMedia.length > 0) {
          mediaTypes.push("embedded")
        }
        
        safeCapture(posthog, "created_birthday_card_entry", {
          card_id: cardId,
          group_id: currentGroupId,
          has_media: hasMedia,
          media_types_added: mediaTypes,
          text_length: text.trim().length,
        })

        // Invalidate queries
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["birthdayCardEntries", cardId] }),
          queryClient.invalidateQueries({ queryKey: ["myCardEntries", currentGroupId], exact: false }),
          queryClient.invalidateQueries({ queryKey: ["upcomingBirthdayCards", currentGroupId], exact: false }),
        ])
      }

      // Hide uploading modal and navigate back
      setShowUploadingModal(false)
      exitComposer()
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
      backgroundColor: theme2Colors.beige,
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
      color: theme2Colors.text,
      flex: 1,
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
      paddingBottom: spacing.xxl * 2 + 80, // Extra padding at bottom for toolbar clearance (toolbar height ~80px)
    },
    question: {
      fontFamily: "PMGothicLudington-Text115",
      fontSize: 24,
      marginBottom: spacing.sm,
      marginTop: spacing.xxl,
      color: theme2Colors.text,
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
      borderColor: theme2Colors.blue,
      justifyContent: "center",
      alignItems: "center",
    },
    iconButtonDisabled: {
      opacity: 0.5,
    },
    closeButtonIcon: {
      marginLeft: spacing.sm,
      backgroundColor: theme2Colors.white,
      borderWidth: 1,
      borderColor: theme2Colors.text,
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
      backgroundColor: "rgba(232, 224, 213, 0.6)",
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
      borderColor: theme2Colors.textSecondary,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme2Colors.white,
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
      backgroundColor: "rgba(232, 224, 213, 0.6)",
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
        <Text style={styles.question}>Write {birthdayUserName} a birthday card</Text>
        <Text style={styles.description}>Share a special message, memory, or wish for their birthday</Text>

        {/* Media preview carousel - positioned between description and input */}
        {mediaItems.filter(item => item.type !== "audio").length > 0 && (
          <View style={styles.mediaCarouselContainer}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.mediaScrollContainer}
              contentContainerStyle={styles.mediaScrollContent}
            >
              {mediaItems.filter(item => item.type !== "audio").map((item) => (
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
          </View>
        )}

        <View ref={inputContainerRef} onLayout={handleInputLayout}>
          <TextInput
            ref={textInputRef}
            style={styles.input}
            value={text}
            onChangeText={setText}
            onBlur={handleTextBlur}
            placeholder="Start writing..."
            placeholderTextColor={theme2Colors.textSecondary}
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

      </ScrollView>
      </KeyboardAvoidingView>

      {/* Toolbar - positioned above keyboard */}
      <View style={[styles.toolbar, { bottom: Platform.OS === "android" ? keyboardHeight + spacing.xl + spacing.md : keyboardHeight }]}>
        <View style={styles.toolbarButtons}>
          <View style={styles.toolCluster}>
            <TouchableOpacity style={styles.iconButton} onPress={handleGalleryAction}>
              <FontAwesome name="image" size={18} color={theme2Colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={openCamera}>
              <FontAwesome name="camera" size={18} color={theme2Colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={startRecording}>
              <FontAwesome name="microphone" size={18} color={theme2Colors.text} />
            </TouchableOpacity>
            {/* Shuffle button commented out - everyone answers the same question */}
            {/* <TouchableOpacity 
              style={[styles.iconButton, editMode && styles.iconButtonDisabled]} 
              onPress={shufflePrompt}
              disabled={editMode}
            >
              <FontAwesome name="random" size={18} color={editMode ? theme2Colors.textSecondary : theme2Colors.text} />
            </TouchableOpacity> */}
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setShowSongModal(true)}
            >
              <FontAwesome name="music" size={18} color={theme2Colors.text} />
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
                  <ActivityIndicator size="small" color={theme2Colors.white} />
                ) : (
                  <FontAwesome name="arrow-right" size={18} color={theme2Colors.white} />
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.iconButton, styles.closeButtonIcon]} onPress={exitComposer}>
              <FontAwesome name="times" size={18} color={theme2Colors.text} />
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
              Paste a Spotify or Apple Music link to embed it in your entry
            </Text>
            <TextInput
              style={styles.songUrlInput}
              value={songUrlInput}
              onChangeText={setSongUrlInput}
              placeholder="https://open.spotify.com/track/..."
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
                <FontAwesome name={recording ? "stop" : "microphone"} size={22} color={theme2Colors.text} />
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
                  color={voiceUri ? theme2Colors.text : theme2Colors.textSecondary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.voiceIconButton, !voiceUri && styles.voiceIconDisabled]}
                disabled={!voiceUri}
                onPress={cleanupVoiceModal}
              >
                <FontAwesome name="trash" size={20} color={voiceUri ? theme2Colors.text : theme2Colors.textSecondary} />
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
          <View style={styles.successTexture} pointerEvents="none">
            <Image
              source={require("../../../assets/images/texture.png")}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
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
