"use client"

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "../../../lib/supabase"
import { getEntryById, getReactions, getComments, toggleReaction, createComment } from "../../../lib/db"
import { colors, typography, spacing } from "../../../lib/theme"
import { Avatar } from "../../../components/Avatar"
import { formatTime } from "../../../lib/utils"
import { useState } from "react"
import { Input } from "../../../components/Input"
import { Button } from "../../../components/Button"

export default function EntryDetail() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const queryClient = useQueryClient()
  const entryId = params.entryId as string
  const [userId, setUserId] = useState<string>()
  const [commentText, setCommentText] = useState("")

  useState(() => {
    loadUser()
  })

  async function loadUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      setUserId(user.id)
    }
  }

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

  const toggleReactionMutation = useMutation({
    mutationFn: () => toggleReaction(entryId, userId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reactions", entryId] })
    },
  })

  const addCommentMutation = useMutation({
    mutationFn: (text: string) => createComment(entryId, userId!, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", entryId] })
      setCommentText("")
    },
  })

  const hasLiked = reactions.some((r) => r.user_id === userId)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
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

            {entry.media_urls && entry.media_urls.length > 0 && (
              <View style={styles.mediaContainer}>
                {entry.media_urls.map((url, index) => {
                  const mediaType = entry.media_types?.[index]
                  if (mediaType === "photo") {
                    return <Image key={index} source={{ uri: url }} style={styles.mediaImage} resizeMode="cover" />
                  } else if (mediaType === "audio") {
                    return (
                      <View key={index} style={styles.audioPlayer}>
                        <Text style={styles.audioText}>🎤 Voice Note</Text>
                      </View>
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
                onPress={() => toggleReactionMutation.mutate()}
              >
                <Text style={styles.reactionIcon}>{hasLiked ? "❤️" : "🤍"}</Text>
                <Text style={styles.reactionCount}>{reactions.length}</Text>
              </TouchableOpacity>
            </View>

            {/* Comments */}
            <View style={styles.commentsSection}>
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
                <Input
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder="Add a comment..."
                  style={styles.commentInput}
                />
                <Button
                  title="Post"
                  onPress={() => addCommentMutation.mutate(commentText)}
                  disabled={!commentText.trim()}
                  style={styles.commentButton}
                />
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
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
  backButton: {
    ...typography.bodyBold,
    color: colors.white,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
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
    fontSize: 18,
  },
  time: {
    ...typography.caption,
    fontSize: 14,
  },
  question: {
    ...typography.h2,
    fontSize: 24,
    marginBottom: spacing.md,
  },
  text: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 26,
    marginBottom: spacing.lg,
  },
  mediaContainer: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  mediaImage: {
    width: "100%",
    height: 300,
    borderRadius: 8,
  },
  audioPlayer: {
    padding: spacing.lg,
    backgroundColor: colors.gray[800],
    borderRadius: 8,
    alignItems: "center",
  },
  audioText: {
    ...typography.body,
    color: colors.white,
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
  reactionCount: {
    ...typography.bodyBold,
    fontSize: 14,
  },
  commentsSection: {
    marginTop: spacing.lg,
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
  },
  commentInput: {
    marginBottom: spacing.sm,
  },
  commentButton: {
    alignSelf: "flex-end",
  },
})
