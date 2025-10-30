"use client"

import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native"
import { useRouter } from "expo-router"
import type { Entry } from "../lib/types"
import { colors, typography, spacing } from "../lib/theme"
import { Avatar } from "./Avatar"
import { FilmFrame } from "./FilmFrame"
import { formatTime } from "../lib/utils"

interface EntryCardProps {
  entry: Entry
}

export function EntryCard({ entry }: EntryCardProps) {
  const router = useRouter()

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
      </FilmFrame>

      {/* Reactions bar */}
      <View style={styles.reactionsBar}>
        <TouchableOpacity style={styles.reactionButton}>
          <Text style={styles.reactionIcon}>💬</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.reactionButton}>
          <Text style={styles.reactionIcon}>❤️</Text>
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
  },
  time: {
    ...typography.caption,
    fontSize: 12,
  },
  question: {
    ...typography.h3,
    fontSize: 18,
    marginBottom: spacing.sm,
  },
  text: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing.md,
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
  reactionIcon: {
    fontSize: 20,
  },
})
