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
import { getComments, getMemorials, getReactions, toggleReaction } from "../lib/db"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { personalizeMemorialPrompt } from "../lib/prompts"

const { width: SCREEN_WIDTH } = Dimensions.get("window")

interface EntryCardProps {
  entry: Entry
  entryIds?: string[]
  index?: number
  returnTo?: string
}

export function EntryCard({ entry, entryIds, index = 0, returnTo = "/(main)/home" }: EntryCardProps) {
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
    const params: Record<string, string> = {
      entryId: entry.id,
      returnTo,
    }
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

  // Calculate if text exceeds 14 lines (for fade overlay)
  const MAX_TEXT_LINES = 14
  const estimatedCharsPerLine = 50
  const minCharsForFade = MAX_TEXT_LINES * estimatedCharsPerLine
  const shouldShowFade = entry.text_content && entry.text_content.length >= minCharsForFade

  // Determine if we should show CTA button
  const hasMultipleMedia = entry.media_urls && entry.media_urls.length > 1
  const hasTextCropped = shouldShowFade
  const shouldShowCTA = hasMultipleMedia || hasTextCropped

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

  // Personalize prompt question if it has placeholders
  const personalizedQuestion = useMemo(() => {
    if (!entry.prompt?.question) return entry.prompt?.question
    let question = entry.prompt.question
    
    // Check for memorial_name placeholder
    if (question.match(/\{.*memorial_name.*\}/i) && memorials.length > 0) {
      question = personalizeMemorialPrompt(question, memorials[0].name)
    }
    
    return question
  }, [entry.prompt?.question, memorials])

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

  const toggleReactionMutation = useMutation({
    mutationFn: () => toggleReaction(entry.id, userId!),
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

  // Create dynamic styles based on theme
  const styles = useMemo(() => StyleSheet.create({
  entryWrapper: {
    width: "100%",
      marginBottom: spacing.md,
      paddingHorizontal: 0,
  },
    entryCard: {
      backgroundColor: colors.black,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      borderRadius: 0,
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
    flexDirection: "row",
    alignItems: "center",
      gap: spacing.sm,
    flexShrink: 1,
  },
  userName: {
    ...typography.bodyBold,
    fontSize: 16, // Increased from 14
      color: colors.white,
  },
  question: {
    fontFamily: "Roboto-Regular",
    fontSize: 14,
      marginBottom: spacing.md,
      color: colors.gray[400],
  },
  textContainer: {
    position: "relative",
      marginBottom: spacing.md,
  },
  entryText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 22,
    color: colors.white, // colors.white is #000000 (black) in light mode, #ffffff (white) in dark mode
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
      backgroundColor: colors.black,
    opacity: 0.85,
  },
  fadeLine2: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
      height: 24,
      backgroundColor: colors.black,
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
    backgroundColor: colors.gray[900],
      borderRadius: 16,
  },
    voiceMemoIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
    backgroundColor: colors.gray[800],
    justifyContent: "center",
    alignItems: "center",
    },
    voiceMemoInfo: {
      flex: 1,
      gap: spacing.xs,
    },
    voiceMemoLabel: {
      ...typography.bodyMedium,
      color: colors.white,
    },
    voiceMemoProgressTrack: {
      width: "100%",
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.gray[800],
    overflow: "hidden",
  },
    voiceMemoProgressFill: {
      height: "100%",
      backgroundColor: colors.accent,
    },
    voiceMemoTime: {
      ...typography.caption,
      color: colors.gray[400],
    },
    mediaWrapper: {
      width: SCREEN_WIDTH,
      marginLeft: -spacing.lg,
      marginRight: -spacing.lg,
      marginBottom: spacing.md,
      alignSelf: "stretch",
      paddingLeft: 0,
      paddingRight: 0,
    },
    mediaImage: {
    width: "100%",
      height: 300, // Fallback height while loading dimensions
      backgroundColor: colors.gray[900],
  },
    photoCarouselContent: {
      paddingLeft: spacing.lg,
      paddingRight: spacing.lg,
      gap: spacing.sm,
    },
    photoCarouselItem: {
      width: SCREEN_WIDTH * 0.75,
      height: SCREEN_WIDTH * 0.75,
      overflow: "hidden",
      backgroundColor: colors.gray[900],
      marginRight: spacing.sm,
    },
    photoCarouselImage: {
      width: "100%",
      height: "100%",
    },
    videoContainer: {
      width: "100%",
      minHeight: 200,
      backgroundColor: colors.gray[900],
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
      alignSelf: "stretch",
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
    ctaButton: {
      backgroundColor: colors.white,
      borderRadius: 8,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    ctaText: {
      ...typography.bodyBold,
      color: colors.black,
      fontSize: 14,
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
    color: colors.white,
  },
    commentsContainer: {
      paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
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
    fontSize: 14,
    color: colors.gray[300],
  },
  commentPreviewText: {
    ...typography.body,
    fontSize: 14,
    color: colors.gray[400],
    flex: 1,
  },
  commentPreviewMore: {
    ...typography.caption,
    fontSize: 13,
    color: colors.gray[500],
    marginTop: spacing.xs,
  },
    separator: {
      width: "100%",
      height: 1,
      backgroundColor: isDark ? "#3D3D3D" : "#E5E5E5", // Lighter separator in light mode
      marginTop: spacing.md,
    },
  }), [colors, isDark])

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
            <Avatar uri={entry.user?.avatar_url} name={entry.user?.name || "User"} size={32} />
            <Text style={styles.userName}>{entry.user?.name}</Text>
          </View>
          <FontAwesome name="chevron-right" size={14} color={colors.gray[400]} style={styles.arrowIcon} />
        </View>

        {/* Question */}
        <Text style={styles.question}>{personalizedQuestion || entry.prompt?.question}</Text>

        {/* Text Content */}
        {entry.text_content && (
          <View style={styles.textContainer}>
            <Text style={styles.entryText} numberOfLines={MAX_TEXT_LINES}>
              {entry.text_content}
            </Text>
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
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <FontAwesome
                        name={activeAudioId === audioId ? "pause" : "play"}
                        size={16}
                        color={colors.white}
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
              horizontal
              showsHorizontalScrollIndicator={false}
              pagingEnabled={false}
              snapToInterval={SCREEN_WIDTH * 0.75 + spacing.sm}
              decelerationRate="fast"
              contentContainerStyle={styles.photoCarouselContent}
            >
              {photoVideoMedia.map((item) => (
                <TouchableOpacity
                  key={item.index}
                  onPress={(e) => {
                    e.stopPropagation()
                    handleEntryPress()
                  }}
                  activeOpacity={0.9}
                  style={styles.photoCarouselItem}
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
                  backgroundColor: colors.gray[900],
                } : styles.mediaImage}
                resizeMode="contain"
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

        {/* Heart, Comment Icons, and CTA Button */}
        <View style={styles.actionsRow}>
          <View style={styles.actionsLeft}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleToggleReaction}
              disabled={!userId || toggleReactionMutation.isPending}
              activeOpacity={0.7}
            >
              <FontAwesome 
                name={hasLiked ? "heart" : "heart-o"} 
                size={20} 
                color={hasLiked ? colors.white : colors.white}
                style={hasLiked ? styles.iconSolid : styles.iconOutline}
              />
              {reactionCount > 0 && <Text style={styles.actionCount}>{reactionCount}</Text>}
            </TouchableOpacity>
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
                color={colors.white}
                style={comments.length > 0 ? styles.iconSolid : styles.iconOutline}
              />
              {comments.length > 0 && <Text style={styles.actionCount}>{comments.length}</Text>}
            </TouchableOpacity>
          </View>
          {shouldShowCTA && (
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={(e) => {
                e.stopPropagation()
                handleEntryPress()
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.ctaText}>
                See everything {entry.user?.name || "they"} shared →
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>

      {/* Comments Preview */}
      {comments.length > 0 && (
        <View style={styles.commentsContainer}>
          {comments.slice(0, 2).map((comment: any) => (
            <View key={comment.id} style={styles.commentPreviewItem}>
              <Avatar uri={comment.user?.avatar_url} name={comment.user?.name || "User"} size={20} />
              <Text style={styles.commentPreviewUser}>{comment.user?.name}: </Text>
              <Text style={styles.commentPreviewText} numberOfLines={1}>
                {comment.text}
              </Text>
            </View>
          ))}
          {comments.length > 2 && (
            <Text style={styles.commentPreviewMore}>+{comments.length - 2} more</Text>
          )}
        </View>
      )}

      {/* Separator */}
      <View style={styles.separator} />
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
  const { colors } = useTheme()
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
  
  function handleToggleMute() {
    if (!videoRef.current) return
    setIsMuted(prev => {
      videoRef.current?.setIsMutedAsync(!prev).catch(() => {})
      return !prev
    })
  }
  
  function formatTime(ms: number) {
    if (!ms || isNaN(ms)) return "0:00"
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }
  
  const videoStyles = useMemo(() => StyleSheet.create({
    videoContainer: {
      width: "100%",
      height: containerStyle?.height || SCREEN_WIDTH, // Square aspect ratio (1:1) for gallery-like appearance
      backgroundColor: colors.gray[900],
      justifyContent: "center",
      alignItems: "center",
      position: "relative",
      overflow: "hidden",
      alignSelf: "stretch",
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
      backgroundColor: colors.accent,
    },
    progressTime: {
      position: "absolute",
      bottom: spacing.sm,
      right: spacing.sm,
      ...typography.caption,
      fontSize: 10,
      color: colors.white,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      borderRadius: 4,
    },
  }), [colors, containerStyle])

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
            color={colors.white} 
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
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <FontAwesome name="play" size={20} color={colors.white} />
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
