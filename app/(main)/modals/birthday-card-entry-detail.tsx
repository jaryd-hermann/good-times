"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "../../../lib/supabase"
import { getBirthdayCardEntry, getBirthdayCardEntries } from "../../../lib/db"
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
import { usePostHog } from "posthog-react-native"
import { captureEvent } from "../../../lib/posthog"

export default function BirthdayCardEntryDetail() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const queryClient = useQueryClient()
  const { colors, isDark } = useTheme()
  const entryId = params.entryId as string
  const cardId = params.cardId as string
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
  const scrollViewRef = useRef<ScrollView>(null)
  const [userId, setUserId] = useState<string>()
  const audioRefs = useRef<Record<string, Audio.Sound>>({})
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null)
  const [audioProgress, setAudioProgress] = useState<Record<string, number>>({})
  const [audioDurations, setAudioDurations] = useState<Record<string, number>>({})
  const [audioLoading, setAudioLoading] = useState<Record<string, boolean>>({})
  const [imageDimensions, setImageDimensions] = useState<Record<number, { width: number; height: number }>>({})
  const [keyboardHeight, setKeyboardHeight] = useState(0)
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
    queryKey: ["birthdayCardEntry", entryId],
    queryFn: () => getBirthdayCardEntry(entryId),
    enabled: !!entryId,
  })

  // Track viewed_birthday_card_entry event when entry loads
  useEffect(() => {
    if (entry && entryId) {
      try {
        if (posthog) {
          posthog.capture("viewed_birthday_card_entry", {
            entry_id: entryId,
            card_id: cardId,
          })
        } else {
          captureEvent("viewed_birthday_card_entry", {
            entry_id: entryId,
            card_id: cardId,
          })
        }
      } catch (error) {
        if (__DEV__) console.error("[birthday-card-entry-detail] Failed to track viewed_birthday_card_entry:", error)
      }
    }
  }, [entry, entryId, cardId, posthog])

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
      }
    }
    loadUser()
  }, [])

  // Get all entries for the card for navigation
  const { data: cardEntries = [] } = useQuery({
    queryKey: ["birthdayCardEntries", cardId],
    queryFn: () => getBirthdayCardEntries(cardId),
    enabled: !!cardId,
  })

  // Build entry list for navigation (by created_at, order written)
  const chronologicalEntryIds = useMemo(() => {
    if (cardEntries.length === 0) {
      // Fallback to provided entryIds if available
      return entryIds.length > 0 ? entryIds : []
    }
    // Sort by created_at ascending (order written)
    const sorted = [...cardEntries].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime()
      const dateB = new Date(b.created_at).getTime()
      return dateA - dateB
    })
    return sorted.map((e) => e.id)
  }, [cardEntries, entryIds])

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
      fontSize: 14,
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
                      return (
                        <Image
                          key={index}
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

            </>
          )}
        </ScrollView>

      </View>
    </KeyboardAvoidingView>
  )
}

function formatMillis(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}
