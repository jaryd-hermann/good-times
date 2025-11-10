"use client"

import { useMemo, useState, useEffect } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal } from "react-native"
import { useRouter } from "expo-router"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "../../lib/supabase"
import { format } from "date-fns"
import { colors, typography, spacing } from "../../lib/theme"
import { FilmFrame } from "../../components/FilmFrame"
import { truncateText } from "../../lib/utils"
import { getGroupMembers, getAllPrompts, getDailyPrompt } from "../../lib/db"
import { Avatar } from "../../components/Avatar"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Button } from "../../components/Button"
import { getTodayDate } from "../../lib/utils"

type ViewMode = "Days" | "Weeks" | "Months" | "Years"

export default function History() {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<ViewMode>("Days")
  const [showFilter, setShowFilter] = useState(false)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [currentGroupId, setCurrentGroupId] = useState<string>()
  const [userId, setUserId] = useState<string>()
  const insets = useSafeAreaInsets()

  useEffect(() => {
    loadUserAndGroup()
  }, [])

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
    queryFn: async (): Promise<any[]> => {
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

  const { data: members = [] } = useQuery({
    queryKey: ["history-members", currentGroupId],
    queryFn: () => (currentGroupId ? getGroupMembers(currentGroupId) : []),
    enabled: !!currentGroupId,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ["history-categories"],
    queryFn: async () => {
      const prompts = await getAllPrompts()
      const unique = new Set<string>()
      prompts.forEach((prompt) => {
        if (prompt.category) unique.add(prompt.category)
      })
      return Array.from(unique)
    },
  })

  const { data: todayPrompt } = useQuery({
    queryKey: ["history-today-prompt", currentGroupId],
    queryFn: () => (currentGroupId ? getDailyPrompt(currentGroupId, getTodayDate()) : null),
    enabled: !!currentGroupId,
  })

  function handleEntryPress(entryId: string) {
    router.push({
      pathname: "/(main)/modals/entry-detail",
      params: { entryId },
    })
  }

  const filteredEntries = useMemo(
    () =>
      entries.filter((entry) => {
        const category = entry.prompt?.category ?? ""

        if (selectedCategories.length > 0 && (!category || !selectedCategories.includes(category))) {
          return false
        }
        if (selectedMembers.length > 0 && !selectedMembers.includes(entry.user_id)) {
          return false
        }
        return true
      }),
    [entries, selectedCategories, selectedMembers],
  )

  function handleAnswerToday() {
    if (todayPrompt?.prompt_id) {
      router.push({
        pathname: "/(main)/modals/entry-composer",
        params: { promptId: todayPrompt.prompt_id, date: getTodayDate() },
      })
    } else {
      router.push("/(main)/home")
    }
  }

  function handleInvite() {
    if (!currentGroupId) {
      router.push("/(main)/home")
      return
    }
    router.push({
      pathname: "/(onboarding)/create-group/invite",
      params: { groupId: currentGroupId },
    })
  }

  // Group entries by date for Days view
  const entriesByDate = filteredEntries.reduce(
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
        <View style={styles.headerTop}>
          <Text style={styles.title}>History</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilter((prev) => !prev)}>
              <Text style={styles.filterText}>{viewMode}</Text>
              <Text style={styles.filterChevron}>▼</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterCTA} onPress={() => setShowFilterModal(true)}>
              <Text style={styles.filterCTAText}>Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
        {showFilter && (
          <View style={styles.filterMenu}>
            {(["Days", "Weeks", "Months", "Years"] as ViewMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={styles.filterOption}
                onPress={() => {
                  setViewMode(mode)
                  setShowFilter(false)
                }}
              >
                <Text style={[styles.filterOptionText, viewMode === mode && styles.filterOptionTextActive]}>{mode}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <Modal
        animationType="slide"
        visible={showFilterModal}
        onRequestClose={() => setShowFilterModal(false)}
        presentationStyle="fullScreen"
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top + spacing.lg }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filters</Text>
            <TouchableOpacity onPress={() => setShowFilterModal(false)} style={styles.modalCloseButton}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalSection}>Group Members</Text>
            <View style={styles.selectionGrid}>
              {members.map((member) => {
                const isSelected = selectedMembers.includes(member.user_id)
                return (
                  <TouchableOpacity
                    key={member.id}
                    style={[styles.selectionCard, isSelected && styles.selectionCardActive]}
                    onPress={() =>
                      setSelectedMembers((prev) =>
                        prev.includes(member.user_id)
                          ? prev.filter((id) => id !== member.user_id)
                          : [...prev, member.user_id],
                      )
                    }
                  >
                    <Avatar uri={member.user?.avatar_url} name={member.user?.name || ""} size={40} />
                    <Text style={styles.selectionLabel}>{member.user?.name}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <Text style={[styles.modalSection, styles.modalSectionSpacing]}>Question Categories</Text>
            <View style={styles.selectionGrid}>
              {categories.map((category) => {
                const isSelected = selectedCategories.includes(category)
                return (
                  <TouchableOpacity
                    key={category}
                    style={[styles.selectionCard, isSelected && styles.selectionCardActive]}
                    onPress={() =>
                      setSelectedCategories((prev) =>
                        prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
                      )
                    }
                  >
                    <Text style={styles.selectionLabel}>{category}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {filteredEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No history yet.</Text>
            <Text style={styles.emptySubtitle}>
              As you and your group answer questions we&apos;ll build your story here.
            </Text>
            <Button title="Answer Question" onPress={handleAnswerToday} style={styles.emptyButtonFull} />
            <Button title="Invite Group" onPress={handleInvite} variant="secondary" style={styles.emptyButtonFull} />
          </View>
        ) : viewMode === "Days" ? (
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
        ) : viewMode === "Weeks" ? (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderText}>Weeks view coming soon</Text>
          </View>
        ) : viewMode === "Months" ? (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderText}>Months view coming soon</Text>
          </View>
        ) : (
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
    position: "relative",
    gap: spacing.sm,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  title: {
    ...typography.h1,
    fontSize: 32,
  },
  headerActions: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.gray[800],
  },
  filterText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
  filterChevron: {
    ...typography.caption,
    color: colors.gray[400],
  },
  filterCTA: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.white,
  },
  filterCTAText: {
    ...typography.bodyBold,
    color: colors.black,
  },
  filterMenu: {
    position: "absolute",
    top: spacing.xxl * 2 + spacing.md,
    left: spacing.md,
    backgroundColor: colors.gray[900],
    borderRadius: 12,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.gray[700],
    width: 140,
  },
  filterOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  filterOptionText: {
    ...typography.body,
    color: colors.gray[400],
  },
  filterOptionTextActive: {
    color: colors.white,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: spacing.md,
  },
  daySection: {
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  dateHeader: {
    ...typography.h3,
    fontSize: 18,
    marginBottom: spacing.md,
    color: colors.gray[300],
  },
  entryCard: {
    marginBottom: spacing.md,
    marginHorizontal: 0,
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
  emptyState: {
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.white,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.gray[400],
    textAlign: "center",
  },
  emptyButtonFull: {
    width: "100%",
    marginTop: spacing.sm,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.black,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  modalTitle: {
    ...typography.h1,
    fontSize: 32,
  },
  modalCloseButton: {
    padding: spacing.sm,
  },
  modalClose: {
    ...typography.bodyBold,
    fontSize: 24,
    color: colors.white,
  },
  modalContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  modalSection: {
    ...typography.bodyMedium,
    fontSize: 14,
    color: colors.gray[500],
    marginTop: spacing.sm,
  },
  modalSectionSpacing: {
    marginTop: spacing.lg,
  },
  selectionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  selectionCard: {
    width: "48%",
    backgroundColor: colors.gray[900],
    borderRadius: 16,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    gap: spacing.sm,
  },
  selectionCardActive: {
    borderWidth: 1,
    borderColor: colors.white,
  },
  selectionLabel: {
    ...typography.bodyMedium,
    color: colors.white,
    textAlign: "center",
  },
})
