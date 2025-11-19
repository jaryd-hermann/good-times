"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from "react-native"
import { useRouter } from "expo-router"
import { Audio, Video, ResizeMode } from "expo-av"
import { parseISO, format } from "date-fns"
import type { Entry } from "../lib/types"
import { colors, typography, spacing } from "../lib/theme"
import { Avatar } from "./Avatar"
import { FilmFrame } from "./FilmFrame"
import { FontAwesome } from "@expo/vector-icons"
import { supabase } from "../lib/supabase"
import { getComments, getMemorials } from "../lib/db"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { EmbeddedPlayer } from "./EmbeddedPlayer"
import type { EmbeddedMedia } from "../lib/types"
import { personalizeMemorialPrompt, replaceDynamicVariables } from "../lib/prompts"

interface EntryCardProps {
  entry: Entry
  entryIds?: string[]
  index?: number
  returnTo?: string
}

export function EntryCard({ entry, entryIds, index = 0, returnTo = "/(main)/home" }: EntryCardProps) {
  const router = useRouter()
  const queryClient = useQueryClient()

  function handleEntryPress() {
    const params: Record<string, string> = {
      entryId: entry.id,
      returnTo,
    }
    if (entryIds && entryIds.length > 0) {
      params.entryIds = JSON.stringify(entryIds)
      params.index = String(index)
    }
    router.push({
      pathname: "/(main)/modals/entry-detail",
      params,
    })
  }

  // Calculate max lines based on media gallery and song badge presence
  const hasMediaGallery = entry.media_urls && entry.media_urls.length > 0
  const hasSongBadge = entry.embedded_media && entry.embedded_media.length > 0
  
  let maxLines: number
  if (hasMediaGallery) {
    maxLines = 7 // With media gallery: 7 lines max
  } else {
    maxLines = 15 // Without media gallery: 15 lines max
  }
  
  // Reduce by 2 lines if song badge exists (in either case)
  if (hasSongBadge) {
    maxLines -= 2
  }
  
  // Only show fade if text is long enough to potentially exceed the line limit
  // Rough estimate: ~50 characters per line (conservative estimate)
  const estimatedCharsPerLine = 50
  const minCharsForFade = maxLines * estimatedCharsPerLine
  const shouldShowFade = entry.text_content && entry.text_content.length >= minCharsForFade

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
      // Use first memorial (or could cycle based on date)
      question = personalizeMemorialPrompt(question, memorials[0].name)
    }
    
    return question
  }, [entry.prompt?.question, memorials])

  // Fetch comments for this entry (with user relation like history.tsx)
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

  return (
    <View style={styles.entryWrapper}>
      <View style={styles.filmFrameWrapper}>
        <Image source={require("../assets/images/film-frame.png")} style={styles.filmFrameImage} />
        <FilmFrame style={styles.entryCardInner} contentStyle={styles.entryContent}>
          <TouchableOpacity onPress={handleEntryPress} activeOpacity={0.9} style={styles.touchableContent}>
            <View style={styles.entryHeader}>
              <View style={styles.entryAuthor}>
                <Avatar uri={entry.user?.avatar_url} name={entry.user?.name || "User"} size={28} />
                <Text style={styles.userName}>{entry.user?.name}</Text>
              </View>
              <Text style={styles.time}>{format(parseISO(entry.created_at), "h:mm a")}</Text>
            </View>
            <Text style={styles.question}>{personalizedQuestion || entry.prompt?.question}</Text>
            {/* Song shared badge */}
            {entry.embedded_media && entry.embedded_media.length > 0 && (
              <View style={styles.songBadge}>
                <FontAwesome name="play" size={12} color={colors.white} />
                <Text style={styles.songBadgeText}>
                  {entry.user?.name || "User"} shared a song with you
                </Text>
              </View>
            )}
            {entry.text_content && (
              <View style={[
                styles.textContainer,
                hasMediaGallery && styles.textContainerWithMedia,
                !hasMediaGallery && styles.textContainerNoMedia
              ]}>
                <Text 
                  style={styles.entryText}
                  numberOfLines={maxLines}
                >
                  {entry.text_content}
                </Text>
                {/* Embedded media inline with text - moved inside text container */}
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
                {/* Fade overlay for last 2 lines */}
                {shouldShowFade && (
                  <View style={styles.textFadeOverlay} pointerEvents="none">
                    <View style={styles.fadeLine1} />
                    <View style={styles.fadeLine2} />
                  </View>
                )}
              </View>
            )}
            {/* Embedded media only if no text content */}
            {!entry.text_content && entry.embedded_media && entry.embedded_media.length > 0 && (
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
            <View style={styles.mediaContainer}>
              {entry.media_urls && Array.isArray(entry.media_urls) && entry.media_urls.length > 0 && (
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.mediaCarousel}
                  contentContainerStyle={styles.mediaCarouselContent}
                  nestedScrollEnabled={true}
                >
                  {entry.media_urls.map((url: string, idx: number) => {
                    const mediaType = entry.media_types && Array.isArray(entry.media_types) 
                      ? entry.media_types[idx] 
                      : undefined
                    
                    if (mediaType === "audio") {
                      return (
                        <View key={`audio-${idx}-${url}`} style={styles.audioThumbnailSquare}>
                          {entry.user?.avatar_url ? (
                            <>
                              <Image 
                                source={{ uri: entry.user.avatar_url }} 
                                style={styles.audioThumbnailImage}
                                resizeMode="cover"
                              />
                              <View style={styles.audioThumbnailOverlay} />
                            </>
                          ) : null}
                          <View style={styles.audioThumbnailContent}>
                            <FontAwesome name="play" size={20} color={colors.white} />
                            <Text style={styles.audioThumbnailLabel} numberOfLines={2}>
                              {entry.user?.name || "User"} left a voice message
                            </Text>
                          </View>
                        </View>
                      )
                    }
                    
                    if (mediaType === "video") {
                      return (
                        <VideoThumbnail key={`video-${idx}-${url}`} uri={url} style={styles.videoThumbnailSquare} />
                      )
                    }
                    
                    // Default to photo
                    return (
                      <Image
                        key={`photo-${idx}-${url}`}
                        source={{ uri: url }}
                        style={styles.mediaThumbnail}
                        resizeMode="cover"
                      />
                    )
                  })}
                </ScrollView>
              )}
            </View>
          </TouchableOpacity>
        </FilmFrame>
      </View>
      {comments && comments.length > 0 && (
        <TouchableOpacity 
          style={styles.commentPreview}
          onPress={() => {
            handleEntryPress()
          }}
        >
          {comments.slice(0, 2).map((comment) => (
            <View key={comment.id} style={styles.commentPreviewItem}>
              <Avatar uri={comment.user?.avatar_url} name={comment.user?.name || "User"} size={20} />
              <Text style={styles.commentPreviewUser}>{comment.user?.name}: </Text>
              <Text style={styles.commentPreviewText} numberOfLines={1}>
                {comment.text}
              </Text>
            </View>
          ))}
          {comments.length > 2 && (
            <Text style={styles.commentPreviewMore}>
              +{comments.length - 2} more
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  entryWrapper: {
    marginBottom: spacing.lg,
    width: "100%",
  },
  filmFrameWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginBottom: spacing.lg,
  },
  filmFrameImage: {
    position: "absolute",
    width: "133%", // Reduced by 2% from 135%
    height: 501,
    resizeMode: "contain",
    zIndex: 1,
    pointerEvents: "none",
  },
  entryCardInner: {
    width: 399,
    height: 485,
  },
  entryContent: {
    padding: spacing.lg,
    paddingBottom: 0, // Remove bottom padding so media touches bottom
    gap: spacing.sm,
    backgroundColor: "#0C0E1A",
    flex: 1,
    justifyContent: "flex-start", // Changed from "space-between" to allow absolute positioning
    position: "relative", // Enable absolute positioning for children
  },
  touchableContent: {
    flex: 1,
    justifyContent: "flex-start", // Changed to flex-start so question stays at top
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  entryAuthor: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexShrink: 1,
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
    ...typography.h3,
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  textContainer: {
    position: "relative",
    marginBottom: spacing.xl,
    paddingBottom: spacing.lg,
    zIndex: 1,
  },
  textContainerWithMedia: {
    marginBottom: 0, // Remove margin - media will be absolutely positioned
    paddingBottom: 0, // No padding - text ends before media
  },
  textContainerNoMedia: {
    flex: 1, // Allow text to fill available space when no media
    paddingBottom: spacing.lg,
  },
  entryText: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.gray[300],
  },
  textFadeOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 48, // 2 lines fade (2 * 24px line height)
    zIndex: 2, // Above text
  },
  fadeLine1: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 24, // Line 7 (or 15) - more opacity
    backgroundColor: "#0C0E1A",
    opacity: 0.85,
  },
  fadeLine2: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    height: 24, // Line 6 (or 14) - less opacity
    backgroundColor: "#0C0E1A",
    opacity: 0.6,
  },
  mediaContainer: {
    position: "absolute", // Absolutely position at bottom
    bottom: 0,
    left: 0,
    right: 0,
    height: 158, // Fixed height matching thumbnail height
    marginLeft: -spacing.lg, // Negative margin to align with entryContent padding
    marginRight: -spacing.lg,
    zIndex: 10, // Ensure it's above text
  },
  mediaCarousel: {
    width: "100%",
  },
  mediaCarouselContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 2, // Very little gap between items
    paddingLeft: spacing.lg, // Start at left edge of entryContent
    paddingBottom: 0, // No bottom padding - touch bottom of container
  },
  mediaThumbnail: {
    width: 158, // Square thumbnail
    height: 158, // Square thumbnail - same as width
    backgroundColor: colors.gray[900],
    marginRight: 0,
    marginLeft: 0,
    flexShrink: 0, // Prevent shrinking in ScrollView
    overflow: "hidden", // Ensure images are cropped to square
  },
  videoThumbnailSquare: {
    width: 158, // Square thumbnail - same as other media
    height: 158, // Square thumbnail - same as width
    backgroundColor: colors.gray[800],
    justifyContent: "center",
    alignItems: "center",
    marginRight: 0,
    marginLeft: 0,
    flexShrink: 0, // Prevent shrinking in ScrollView
    position: "relative",
    overflow: "hidden",
  },
  videoThumbnailOverlay: {
    position: "absolute",
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  audioThumbnailSquare: {
    width: 158, // Square thumbnail - same as other media
    height: 158, // Square thumbnail - same as width
    backgroundColor: colors.gray[800],
    justifyContent: "center",
    alignItems: "center",
    marginRight: 0,
    marginLeft: 0,
    flexShrink: 0, // Prevent shrinking in ScrollView
    position: "relative",
    overflow: "hidden",
  },
  audioThumbnailImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  audioThumbnailOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  audioThumbnailContent: {
    position: "relative",
    zIndex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
    gap: spacing.xs,
  },
  audioThumbnailLabel: {
    ...typography.caption,
    color: colors.white,
    fontSize: 10,
    textAlign: "center",
  },
  embeddedMediaContainer: {
    marginTop: spacing.sm,
    marginBottom: 0, // Remove bottom margin to prevent gap
    gap: spacing.xs,
  },
  songBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.black,
    borderWidth: 1,
    borderColor: colors.white,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 16,
    alignSelf: "flex-start",
    marginBottom: spacing.sm,
  },
  songBadgeText: {
    ...typography.caption,
    color: colors.white,
    fontSize: 11,
  },
  commentPreview: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.md,
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
})

// Component to render video thumbnail
function VideoThumbnail({ uri, style }: { uri: string; style?: any }) {
  const videoRef = useRef<Video>(null)

  return (
    <View style={[styles.videoThumbnailSquare, style]}>
      <Video
        ref={videoRef}
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        shouldPlay={false}
        isMuted={true}
        isLooping={false}
        useNativeControls={false}
      />
      <View style={styles.videoThumbnailOverlay}>
        <FontAwesome name="play-circle" size={24} color={colors.white} />
      </View>
    </View>
  )
}
