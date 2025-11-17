"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
} from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import * as ImagePicker from "expo-image-picker"
import { Audio } from "expo-av"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "../../../lib/supabase"
import { createEntry, getAllPrompts } from "../../../lib/db"
import type { Prompt } from "../../../lib/types"
import { uploadMedia } from "../../../lib/storage"
import { colors, typography, spacing } from "../../../lib/theme"
import { Button } from "../../../components/Button"
import { FontAwesome } from "@expo/vector-icons"
import { parseEmbedUrl, extractEmbedUrls, type ParsedEmbed } from "../../../lib/embed-parser"
import { EmbeddedPlayer } from "../../../components/EmbeddedPlayer"
import * as Clipboard from "expo-clipboard"

type MediaItem = {
  id: string
  uri: string
  type: "photo" | "video" | "audio"
}

function createMediaId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export default function EntryComposer() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const promptId = params.promptId as string
  const date = params.date as string
  const returnTo = (params.returnTo as string) || undefined
  const groupIdParam = params.groupId as string | undefined

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
  const [showMediaOptions, setShowMediaOptions] = useState(false)
  const [voiceModalVisible, setVoiceModalVisible] = useState(false)
  const [voiceDuration, setVoiceDuration] = useState(0)
  const [voiceUri, setVoiceUri] = useState<string | undefined>()
  const [isPlayingVoice, setIsPlayingVoice] = useState(false)
  const [availablePrompts, setAvailablePrompts] = useState<Prompt[]>([])
  const [activePrompt, setActivePrompt] = useState<Prompt | undefined>()
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const soundRef = useRef<Audio.Sound | null>(null)
  const queryClient = useQueryClient()
  const [embeddedMedia, setEmbeddedMedia] = useState<ParsedEmbed[]>([])
  const [showSongModal, setShowSongModal] = useState(false)
  const [songUrlInput, setSongUrlInput] = useState("")
  const textInputRef = useRef<TextInput>(null)

  useEffect(() => {
    loadUserAndGroup()
  }, [groupIdParam])

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

  useEffect(() => {
    async function loadPrompts() {
      const prompts = await getAllPrompts()
      setAvailablePrompts(prompts)
    }
    loadPrompts()
  }, [])

  useEffect(() => {
    if (prompt?.id) {
      setActivePrompt(prompt as Prompt)
    }
  }, [prompt])

  // Reset form when promptId or date changes (new question)
  useEffect(() => {
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
  }, [promptId, date])

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

  async function pickImages() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant photo library access")
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      allowsEditing: false,
      quality: 0.8,
    })

    if (!result.canceled) {
      const newItems = result.assets.map((asset) => ({
        id: createMediaId(),
        uri: asset.uri,
        type: "photo" as const,
      }))
      setMediaItems((prev) => [...prev, ...newItems])
    }
  }

  async function takeVideo() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant camera access")
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.8,
    })

    if (!result.canceled) {
      const asset = result.assets[0]
      setMediaItems((prev) => [
        ...prev,
        {
          id: createMediaId(),
          uri: asset.uri,
          type: "video",
        },
      ])
    }
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
      setMediaItems((prev) => [
        ...prev,
        {
          id: createMediaId(),
          uri: asset.uri,
          type: asset.type === "video" ? "video" : "photo",
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
      Alert.alert("Error", error.message)
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

  function shufflePrompt() {
    if (availablePrompts.length === 0) return
    const others = availablePrompts.filter((p) => p.id !== activePrompt?.id)
    if (others.length === 0) return
    const next = others[Math.floor(Math.random() * others.length)]
    setActivePrompt(next)
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
      Alert.alert("Error", "Please add some content to your entry")
      return
    }

    if (!currentGroupId || !userId || !activePrompt?.id) {
      Alert.alert("Error", "Unable to determine group or user")
      return
    }

    setLoading(true)
    try {
      const storageKey = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

      const uploadedMedia = await Promise.all(
        mediaItems.map(async (item) => {
          if (item.uri.startsWith("http")) {
            return { url: item.uri, type: item.type }
          }
          const remoteUrl = await uploadMedia(currentGroupId, storageKey, item.uri, item.type)
          return { url: remoteUrl, type: item.type }
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

      // Invalidate queries scoped to the specific group to prevent cross-group contamination
      // Use prefix matching to invalidate all related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["entries", currentGroupId], exact: false }),
        queryClient.invalidateQueries({ queryKey: ["userEntry", currentGroupId], exact: false }),
        queryClient.invalidateQueries({ queryKey: ["historyEntries", currentGroupId], exact: false }),
        queryClient.invalidateQueries({ queryKey: ["dailyPrompt", currentGroupId], exact: false }),
        queryClient.invalidateQueries({ queryKey: ["historyComments"] }),
      ])

      Alert.alert("Success", "Your entry has been posted")
      exitComposer()
    } catch (error: any) {
      Alert.alert("Error", error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.question}>{activePrompt?.question}</Text>
        <Text style={styles.description}>{activePrompt?.description}</Text>

        <TextInput
          ref={textInputRef}
          style={styles.input}
          value={text}
          onChangeText={setText}
          onBlur={handleTextBlur}
          placeholder="Start writing..."
          placeholderTextColor={colors.gray[500]}
          multiline
          autoFocus
          showSoftInputOnFocus
        />

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

        {/* Media preview */}
        {mediaItems.length > 0 && (
          <View style={styles.mediaListContainer}>
            {mediaItems.map((item) => (
              <View key={item.id} style={styles.mediaItemWrapper}>
                <View style={styles.mediaItem}>
                  {item.type === "photo" ? (
                    <Image source={{ uri: item.uri }} style={styles.mediaImage} />
                  ) : item.type === "video" ? (
                    <View style={styles.videoThumb}>
                      <FontAwesome name="video-camera" size={24} color={colors.white} />
                      <Text style={styles.mediaLabel}>Video</Text>
                    </View>
                  ) : (
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
                  )}
                </View>
                <TouchableOpacity style={styles.mediaDelete} onPress={() => handleRemoveMedia(item.id)}>
                  <FontAwesome name="times" size={12} color={colors.white} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <View style={styles.toolbarButtons}>
          <View style={styles.toolCluster}>
            <View style={styles.toolButtonWrapper}>
              <TouchableOpacity
                style={[styles.toolButton, styles.addButton]}
                onPress={() => setShowMediaOptions((prev) => !prev)}
              >
                <Text style={styles.addButtonText}>+</Text>
              </TouchableOpacity>
              {showMediaOptions && (
                <View style={styles.mediaMenu}>
                  <TouchableOpacity
                    style={styles.mediaMenuItem}
                    onPress={() => {
                      takeVideo()
                      setShowMediaOptions(false)
                    }}
                  >
                    <Text style={styles.mediaMenuText}>Video</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.mediaMenuItem}
                    onPress={() => {
                      pickImages()
                      setShowMediaOptions(false)
                    }}
                  >
                    <Text style={styles.mediaMenuText}>Photos</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.mediaMenuItem}
                    onPress={() => {
                      openCamera()
                      setShowMediaOptions(false)
                    }}
                  >
                    <Text style={styles.mediaMenuText}>Open Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.mediaMenuItem}
                    onPress={() => {
                      startRecording()
                      setShowMediaOptions(false)
                    }}
                  >
                    <Text style={styles.mediaMenuText}>Voice Memo</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.iconButton} onPress={shufflePrompt}>
              <FontAwesome name="random" size={18} color={colors.white} />
            </TouchableOpacity>
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
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <FontAwesome name="arrow-right" size={18} color={colors.white} />
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
    </KeyboardAvoidingView>
  )
}

function formatDuration(totalSeconds: number) {
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
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
  },
  question: {
    ...typography.h2,
    fontSize: 24,
    marginBottom: spacing.sm,
    marginTop: spacing.xxl,
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
  mediaListContainer: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  mediaItemWrapper: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.gray[900],
    width: "100%",
    marginBottom: spacing.sm,
    position: "relative",
  },
  mediaItem: {
    width: "100%",
    minHeight: 200,
    justifyContent: "center",
    alignItems: "center",
  },
  mediaImage: {
    width: "100%",
    height: 200,
    resizeMode: "cover",
  },
  videoThumb: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.xs,
  },
  audioPillWrapper: {
    width: "100%",
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
    height: "auto",
    minHeight: 60,
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
  },
  toolbar: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray[800],
    backgroundColor: colors.black,
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
  toolButtonWrapper: {
    position: "relative",
  },
  toolButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.gray[800],
    justifyContent: "center",
    alignItems: "center",
  },
  addButton: {
    backgroundColor: colors.white,
  },
  addButtonText: {
    fontSize: 26,
    color: colors.black,
    fontFamily: "Roboto-Bold",
  },
  toolButtonText: {
    fontSize: 24,
  },
  mediaMenu: {
    position: "absolute",
    bottom: 56,
    left: 0,
    backgroundColor: colors.gray[900],
    borderRadius: 16,
    paddingVertical: spacing.xs,
    width: 140,
    borderWidth: 1,
    borderColor: colors.gray[700],
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  mediaMenuItem: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  mediaMenuText: {
    ...typography.body,
    color: colors.white,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.gray[800],
    justifyContent: "center",
    alignItems: "center",
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
})
