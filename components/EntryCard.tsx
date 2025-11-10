"use client"

import { useEffect, useState } from "react"
import { View, Text, StyleSheet, Image, TouchableOpacity, TextInput } from "react-native"
import { useRouter } from "expo-router"
import type { Entry } from "../lib/types"
import { colors, typography, spacing } from "../lib/theme"
import { Avatar } from "./Avatar"
import { FilmFrame } from "./FilmFrame"
import { formatTime } from "../lib/utils"
import { FontAwesome } from "@expo/vector-icons"
import { supabase } from "../lib/supabase"
import { getCurrentUser } from "../lib/db"

interface EntryCardProps {
  entry: Entry
}

export function EntryCard({ entry }: EntryCardProps) {
  const router = useRouter()
  const [isCommenting, setIsCommenting] = useState(false)
  const [commentDraft, setCommentDraft] = useState("")
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | undefined>()
  const [currentUserName, setCurrentUserName] = useState("You")

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const profile = await getCurrentUser()
        setCurrentUserAvatar(profile?.avatar_url || undefined)
        setCurrentUserName(profile?.name || "You")
      }
    }
    loadProfile().catch(() => {
      // optional profile load failure is non-blocking
    })
  }, [])

  function handlePress() {
    router.push({
      pathname: "/(main)/modals/entry-detail",
      params: { entryId: entry.id },
    })
  }

  return (
    <View>
      <FilmFrame>
        <TouchableOpacity onPress={handlePress}>
          <View style={styles.header}>
            <Avatar uri={entry.user?.avatar_url} name={entry.user?.name || "User"} size={40} />
            <View style={styles.headerText}>
              <Text style={styles.userName}>{entry.user?.name}</Text>
              <Text style={styles.time}>{formatTime(entry.created_at)}</Text>
            </View>
          </View>

          <Text style={styles.question}>{entry.prompt?.question}</Text>

          {entry.text_content && <Text style={styles.text}>{entry.text_content}</Text>}

          {entry.media_urls && entry.media_urls.length > 0 && (
            <View style={styles.mediaContainer}>
              {entry.media_urls.slice(0, 2).map((url, index) => (
                <Image key={index} source={{ uri: url }} style={styles.media} resizeMode="cover" />
              ))}
            </View>
          )}
        </TouchableOpacity>
        {isCommenting && (
          <View style={styles.inlineComment}>
            <Avatar uri={currentUserAvatar} name={currentUserName} size={28} />
            <TextInput
              style={styles.commentInput}
              value={commentDraft}
              onChangeText={setCommentDraft}
              placeholder="Write a comment…"
              placeholderTextColor={colors.gray[500]}
              multiline
            />
          </View>
        )}
      </FilmFrame>

      {/* Reactions bar */}
      <View style={styles.reactionsBar}>
        <TouchableOpacity style={styles.reactionButton} onPress={() => setIsCommenting((prev) => !prev)}>
          <FontAwesome name="comment-o" size={16} color={colors.black} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.reactionButton}>
          <FontAwesome name="heart-o" size={16} color={colors.black} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  headerText: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  userName: {
    ...typography.bodyBold,
    fontSize: 16,
    flexShrink: 1,
  },
  time: {
    ...typography.caption,
    fontSize: 12,
  },
  question: {
    ...typography.h3,
    fontSize: 18,
    marginBottom: spacing.sm,
    flexShrink: 1,
  },
  text: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing.md,
    flexShrink: 1,
  },
  mediaContainer: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  media: {
    flex: 1,
    height: 200,
    borderRadius: 4,
  },
  reactionsBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  reactionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    justifyContent: "center",
    alignItems: "center",
  },
  inlineComment: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
    marginTop: spacing.md,
  },
  commentInput: {
    flex: 1,
    backgroundColor: colors.gray[900],
    color: colors.white,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    fontSize: 13,
    lineHeight: 18,
  },
})
