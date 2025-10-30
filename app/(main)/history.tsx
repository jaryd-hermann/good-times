"use client"

import { useState } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from "react-native"
import { useRouter } from "expo-router"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "../../lib/supabase"
import { format } from "date-fns"
import { colors, typography, spacing } from "../../lib/theme"
import { FilmFrame } from "../../components/FilmFrame"
import { truncateText } from "../../lib/utils"

type ViewMode = "Days" | "Weeks" | "Months" | "Years"

export default function History() {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<ViewMode>("Days")
  const [currentGroupId, setCurrentGroupId] = useState<string>()
  const [userId, setUserId] = useState<string>()

  useState(() => {
    loadUserAndGroup()
  })

  async function loadUserAndGroup() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      setUserId(user.id)
      const { data: membership } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id)
        .limit(1)
        .single()
      if (membership) {
        setCurrentGroupId(membership.group_id)
      }
    }
  }

  const { data: entries = [] } = useQuery({
    queryKey: ["historyEntries", currentGroupId],
    queryFn: async () => {
      if (!currentGroupId) return []
      const { data } = await supabase
        .from("entries")
        .select("*, user:users(*), prompt:prompts(*)")
        .eq("group_id", currentGroupId)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50)
      return data || []
    },
    enabled: !!currentGroupId,
  })

  function handleEntryPress(entryId: string) {
    router.push({
      pathname: "/(main)/modals/entry-detail",
      params: { entryId },
    })
  }

  // Group entries by date for Days view
  const entriesByDate = entries.reduce(
    (acc, entry) => {
      const date = entry.date
      if (!acc[date]) {
        acc[date] = []
      }
      acc[date].push(entry)
      return acc
    },
    {} as Record<string, typeof entries>,
  )

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <View style={styles.viewModeSelector}>
          {(["Days", "Weeks", "Months", "Years"] as ViewMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.viewModeButton, viewMode === mode && styles.viewModeButtonActive]}
              onPress={() => setViewMode(mode)}
            >
              <Text style={[styles.viewModeText, viewMode === mode && styles.viewModeTextActive]}>{mode}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {viewMode === "Days" && (
          <>
            {Object.entries(entriesByDate).map(([date, dateEntries]) => (
              <View key={date} style={styles.daySection}>
                <Text style={styles.dateHeader}>{format(new Date(date), "EEEE, d MMMM yyyy")}</Text>
                {dateEntries.map((entry) => (
                  <TouchableOpacity key={entry.id} onPress={() => handleEntryPress(entry.id)}>
                    <FilmFrame style={styles.entryCard}>
                      <View style={styles.entryHeader}>
                        <Text style={styles.userName}>{entry.user?.name}</Text>
                        <Text style={styles.time}>{format(new Date(entry.created_at), "h:mm a")}</Text>
                      </View>
                      <Text style={styles.question}>{entry.prompt?.question}</Text>
                      {entry.text_content && (
                        <Text style={styles.entryText}>{truncateText(entry.text_content, 150)}</Text>
                      )}
                      {entry.media_urls && entry.media_urls.length > 0 && (
                        <View style={styles.mediaPreview}>
                          <Image source={{ uri: entry.media_urls[0] }} style={styles.mediaThumbnail} />
                          {entry.media_urls.length > 1 && (
                            <View style={styles.mediaCount}>
                              <Text style={styles.mediaCountText}>+{entry.media_urls.length - 1}</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </FilmFrame>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </>
        )}

        {viewMode === "Weeks" && (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderText}>Weeks view coming soon</Text>
          </View>
        )}

        {viewMode === "Months" && (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderText}>Months view coming soon</Text>
          </View>
        )}

        {viewMode === "Years" && (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderText}>Years view coming soon</Text>
          </View>
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
    paddingTop: spacing.xxl * 2,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[800],
  },
  title: {
    ...typography.h1,
    fontSize: 32,
    marginBottom: spacing.md,
  },
  viewModeSelector: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  viewModeButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.gray[800],
  },
  viewModeButtonActive: {
    backgroundColor: colors.accent,
  },
  viewModeText: {
    ...typography.bodyMedium,
    fontSize: 14,
    color: colors.gray[400],
  },
  viewModeTextActive: {
    color: colors.white,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.md,
  },
  daySection: {
    marginBottom: spacing.xl,
  },
  dateHeader: {
    ...typography.h3,
    fontSize: 18,
    marginBottom: spacing.md,
    color: colors.gray[300],
  },
  entryCard: {
    marginBottom: spacing.md,
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
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
  entryText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.gray[300],
  },
  mediaPreview: {
    marginTop: spacing.md,
    position: "relative",
  },
  mediaThumbnail: {
    width: "100%",
    height: 150,
    borderRadius: 4,
  },
  mediaCount: {
    position: "absolute",
    bottom: spacing.sm,
    right: spacing.sm,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
  },
  mediaCountText: {
    ...typography.caption,
    color: colors.white,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.xxl * 2,
  },
  placeholderText: {
    ...typography.body,
    color: colors.gray[500],
  },
})
