"use client"

import { useEffect, useState, useRef } from "react"
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from "react-native"
import { useRouter } from "expo-router"
import { Audio } from "expo-av"
import { parseISO, format } from "date-fns"
import type { Entry } from "../lib/types"
import { colors, typography, spacing } from "../lib/theme"
import { Avatar } from "./Avatar"
import { FilmFrame } from "./FilmFrame"
import { FontAwesome } from "@expo/vector-icons"
import { supabase } from "../lib/supabase"
import { getComments } from "../lib/db"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { EmbeddedPlayer } from "./EmbeddedPlayer"
import type { EmbeddedMedia } from "../lib/types"

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
            <Text style={styles.question}>{entry.prompt?.question}</Text>
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
                (!entry.media_urls || entry.media_urls.length === 0) && (!entry.embedded_media || entry.embedded_media.length === 0) && styles.textContainerNoMedia
              ]}>
                <Text 
                  style={styles.entryText} 
                  numberOfLines={(entry.media_urls && entry.media_urls.length > 0) || (entry.embedded_media && entry.embedded_media.length > 0) ? 10 : undefined}
                  ellipsizeMode={(entry.media_urls && entry.media_urls.length > 0) || (entry.embedded_media && entry.embedded_media.length > 0) ? "tail" : undefined}
                >
                  {entry.text_content}
                </Text>
                {/* Show fade 2 lines above media if media exists */}
                {((entry.media_urls && entry.media_urls.length > 0) || (entry.embedded_media && entry.embedded_media.length > 0)) && entry.text_content && entry.text_content.length > 200 && (
                  <View style={styles.textFadeAboveMedia} pointerEvents="none" />
                )}
                {/* Show fade at bottom if no media and text is long */}
                {(!entry.media_urls || entry.media_urls.length === 0) && (!entry.embedded_media || entry.embedded_media.length === 0) && entry.text_content && entry.text_content.length > 200 && (
                  <View style={styles.textFadeBottom} pointerEvents="none" />
                )}
              </View>
            )}
            {/* Embedded media inline with text */}
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
                        <View key={`video-${idx}-${url}`} style={styles.videoThumbnailSquare}>
                          <FontAwesome name="video-camera" size={20} color={colors.white} />
                        </View>
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
              <Avatar uri={comment.user?.avatar_url} name={comment.user?.name || "User"} size={16} />
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
    justifyContent: "space-between",
  },
  touchableContent: {
    flex: 1,
    justifyContent: "space-between",
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
  },
  textContainerNoMedia: {
    flex: 1, // Allow text to fill available space when no media
  },
  entryText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.gray[300],
  },
  textFadeAboveMedia: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 40, // 2 lines worth of fade
    backgroundColor: "#0C0E1A",
    opacity: 0.9,
  },
  textFadeBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 40, // 2 lines worth of fade
    backgroundColor: "#0C0E1A",
    opacity: 0.9,
  },
  mediaContainer: {
    marginTop: "auto",
    alignSelf: "stretch",
    marginBottom: 0,
    position: "relative",
    marginLeft: -spacing.lg, // Negative margin to align with entryContent padding
    marginRight: -spacing.lg,
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
    marginBottom: spacing.sm,
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
    fontSize: 12,
    color: colors.gray[300],
  },
  commentPreviewText: {
    ...typography.body,
    fontSize: 12,
    color: colors.gray[400],
    flex: 1,
  },
  commentPreviewMore: {
    ...typography.caption,
    fontSize: 11,
    color: colors.gray[500],
    marginTop: spacing.xs,
  },
})
