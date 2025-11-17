"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput, Alert, ActivityIndicator } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "../../../lib/supabase"
import { getEntryById, getReactions, getComments, toggleReaction, createComment } from "../../../lib/db"
import { colors, typography, spacing } from "../../../lib/theme"
import { Avatar } from "../../../components/Avatar"
import { formatTime } from "../../../lib/utils"
import { Video, Audio, ResizeMode } from "expo-av"
import { getCurrentUser } from "../../../lib/db"
import { FontAwesome } from "@expo/vector-icons"
import { EmbeddedPlayer } from "../../../components/EmbeddedPlayer"
import type { EmbeddedMedia } from "../../../lib/types"

export default function EntryDetail() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const queryClient = useQueryClient()
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

  const { data: entry } = useQuery({
    queryKey: ["entry", entryId],
    queryFn: () => getEntryById(entryId),
    enabled: !!entryId,
  })

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", entryId] })
      queryClient.invalidateQueries({ queryKey: ["historyComments"] })
      queryClient.invalidateQueries({ queryKey: ["historyEntries"] })
      queryClient.invalidateQueries({ queryKey: ["entries"] })
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
    if (!nextEntryId) return
    const params: Record<string, string> = { entryId: nextEntryId }
    if (returnTo) params.returnTo = returnTo
    if (rawEntryIds) {
      params.entryIds = rawEntryIds
      if (typeof nextIndex === "number") {
        params.index = String(nextIndex)
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
    try {
      await toggleReactionMutation.mutateAsync()
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.navAction}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleNext}
          disabled={!nextEntryId}
          style={[styles.navAction, !nextEntryId && styles.navActionDisabled]}
        >
          <Text style={[styles.backButton, !nextEntryId && styles.navActionDisabledText]}>Next →</Text>
        </TouchableOpacity>
      </View>

      <ScrollView ref={scrollViewRef} style={styles.content}>
        {entry && (
          <>
            <View style={styles.entryHeader}>
              <Avatar uri={entry.user?.avatar_url} name={entry.user?.name || "User"} size={48} />
              <View style={styles.headerText}>
                <Text style={styles.userName}>{entry.user?.name}</Text>
                <Text style={styles.time}>{formatTime(entry.created_at)}</Text>
              </View>
            </View>

            <Text style={styles.question}>{entry.prompt?.question}</Text>

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
                    return <Image key={index} source={{ uri: url }} style={styles.mediaImage} resizeMode="cover" />
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
                <Text style={[styles.reactionIcon, hasLiked && styles.reactionIconActive]}>{hasLiked ? "❤️" : "🤍"}</Text>
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

              <View style={styles.addComment}>
                <Avatar uri={currentUserAvatar} name={currentUserName} size={32} />
                <TextInput
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder="Add a comment..."
                  placeholderTextColor={colors.gray[500]}
                  style={styles.commentInput}
                  multiline
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
          </>
        )}
      </ScrollView>
    </View>
  )
}

function formatMillis(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
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
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 6,
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
  userName: {
    ...typography.bodyBold,
    fontSize: 14,
  },
  time: {
    ...typography.caption,
    fontSize: 12,
  },
  question: {
    ...typography.h2,
    fontSize: 20,
    marginBottom: spacing.md,
  },
  text: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: spacing.md,
  },
  mediaContainer: {
    gap: spacing.xl, // Increased by 150% (from spacing.sm to spacing.xl)
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  mediaImage: {
    width: "100%",
    height: 300,
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
  reactionIcon: {
    fontSize: 20,
  },
  reactionIconActive: {
    color: colors.accent,
  },
  reactionCount: {
    ...typography.bodyBold,
    fontSize: 14,
  },
  commentsSection: {
    marginTop: spacing.lg,
    marginBottom: spacing.xxl * 2,
  },
  commentsTitle: {
    ...typography.h3,
    fontSize: 18,
    marginBottom: spacing.md,
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
  },
  commentText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
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
})
