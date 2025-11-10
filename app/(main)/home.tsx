"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Share,
  Alert,
  Dimensions,
  Modal,
} from "react-native"
import { useRouter } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "../../lib/supabase"
import {
  getUserGroups,
  getGroupMembers,
  getDailyPrompt,
  getEntriesForDate,
  getUserEntryForDate,
  getCurrentUser,
  getAllPrompts,
} from "../../lib/db"
import { getTodayDate, getWeekDates } from "../../lib/utils"
import { colors, typography, spacing } from "../../lib/theme"
import { Avatar } from "../../components/Avatar"
import { FilmFrame } from "../../components/FilmFrame"
import { Button } from "../../components/Button"
import { EntryCard } from "../../components/EntryCard"
import { useSafeAreaInsets } from "react-native-safe-area-context"

const { width: SCREEN_WIDTH } = Dimensions.get("window")

function getDayIndex(dateString: string, groupId?: string) {
  const base = new Date(dateString)
  const start = new Date("2020-01-01")
  const diff = Math.floor((base.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  const groupOffset = groupId ? groupId.length : 0
  return diff + groupOffset
}

export default function Home() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState(getTodayDate())
  const [currentGroupId, setCurrentGroupId] = useState<string>()
  const [userId, setUserId] = useState<string>()
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | undefined>()
  const [userName, setUserName] = useState<string>("User")
  const [refreshing, setRefreshing] = useState(false)
  const insets = useSafeAreaInsets()
  const [groupPickerVisible, setGroupPickerVisible] = useState(false)

  useEffect(() => {
    loadUser()
  }, [])

  async function loadUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      setUserId(user.id)
      const profile = await getCurrentUser()
      if (profile) {
        setUserAvatarUrl(profile.avatar_url || undefined)
        setUserName(profile.name || "User")
      }
      // Get user's first group
      const groups = await getUserGroups(user.id)
      if (groups.length > 0) {
        setCurrentGroupId(groups[0].id)
      }
    }
  }

  const { data: groups = [] } = useQuery({
    queryKey: ["groups", userId],
    queryFn: () => (userId ? getUserGroups(userId) : []),
    enabled: !!userId,
  })

  const { data: allPrompts = [] } = useQuery({
    queryKey: ["allPrompts"],
    queryFn: getAllPrompts,
  })

  const { data: members = [] } = useQuery({
    queryKey: ["members", currentGroupId],
    queryFn: () => (currentGroupId ? getGroupMembers(currentGroupId) : []),
    enabled: !!currentGroupId,
  })

  const { data: dailyPrompt } = useQuery({
    queryKey: ["dailyPrompt", currentGroupId, selectedDate],
    queryFn: () => (currentGroupId ? getDailyPrompt(currentGroupId, selectedDate) : null),
    enabled: !!currentGroupId,
  })

  const { data: userEntry } = useQuery({
    queryKey: ["userEntry", currentGroupId, userId, selectedDate],
    queryFn: () => (currentGroupId && userId ? getUserEntryForDate(currentGroupId, userId, selectedDate) : null),
    enabled: !!currentGroupId && !!userId,
  })

  const { data: entries = [] } = useQuery({
    queryKey: ["entries", currentGroupId, selectedDate],
    queryFn: () => (currentGroupId ? getEntriesForDate(currentGroupId, selectedDate) : []),
    enabled: !!currentGroupId,
  })

  const weekDates = getWeekDates()
  const currentGroup = groups.find((g) => g.id === currentGroupId)
  const otherEntries = entries.filter((entry) => entry.user_id !== userId)
  const basePrompt = dailyPrompt?.prompt ?? entries[0]?.prompt

  const fallbackPrompt =
    basePrompt ??
    (allPrompts.length > 0
      ? allPrompts[Math.abs(getDayIndex(selectedDate, currentGroupId)) % allPrompts.length]
      : undefined)

  const promptId = dailyPrompt?.prompt_id ?? entries[0]?.prompt_id ?? fallbackPrompt?.id

  async function handleRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries()
    setRefreshing(false)
  }

  async function handleShareInvite() {
    if (!currentGroupId) return
    try {
      const inviteLink = `goodtimes://join/${currentGroupId}`
      await Share.share({
        message: `Join my Good Times group! ${inviteLink}`,
        url: inviteLink,
      })
    } catch (error: any) {
      Alert.alert("Error", error.message)
    }
  }

  function handleAnswerPrompt() {
    if (!promptId) {
      Alert.alert("No prompt available", "Please check back shortly — today's prompt is still loading.")
      return
    }
    router.push({
      pathname: "/(main)/modals/entry-composer",
      params: {
        promptId,
        date: selectedDate,
      },
    })
  }

  function handleSelectGroup(groupId: string) {
    if (groupId !== currentGroupId) {
      setCurrentGroupId(groupId)
      setSelectedDate(getTodayDate())
    }
    setGroupPickerVisible(false)
  }

  function handleCreateGroupSoon() {
    Alert.alert("Coming soon", "Creating a new group from here is on the way.")
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.xl }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.groupSelector} onPress={() => setGroupPickerVisible(true)}>
            <Text style={styles.groupName}>{currentGroup?.name || "Loading..."}</Text>
            <Text style={styles.chevron}>▼</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/(main)/settings")}>
            <Avatar uri={userAvatarUrl} name={userName} size={36} />
          </TouchableOpacity>
        </View>

        {/* Member avatars with + button */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.membersScroll}>
          {members.map((member) => (
            <View key={member.id} style={styles.memberAvatar}>
              <Avatar uri={member.user.avatar_url} name={member.user.name} size={32} />
            </View>
          ))}
          <TouchableOpacity style={styles.addMemberButton} onPress={handleShareInvite}>
            <View style={styles.addMemberCircle}>
              <Text style={styles.addMemberText}>+</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>

        {/* Day scroller */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroller}>
          {weekDates.map((day) => {
            const hasEntry = false // TODO: Check if user has entry for this day
            const isSelected = day.date === selectedDate
            return (
              <TouchableOpacity
                key={day.date}
                style={[styles.dayButton, isSelected && styles.dayButtonSelected]}
                onPress={() => setSelectedDate(day.date)}
              >
                <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>{day.day}</Text>
                <Text style={[styles.dayNum, isSelected && styles.dayNumSelected]}>{day.dayNum}</Text>
                {hasEntry && <View style={styles.dayCheck} />}
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.white} />}
      >
        {otherEntries.length === 0 && !userEntry && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>Nobody has shared today yet. Be the first.</Text>
          </View>
        )}
        {/* Daily prompt */}
        {!userEntry && (
          <FilmFrame style={styles.promptCard} contentStyle={styles.promptInner}>
            <Text style={styles.promptQuestion}>
              {fallbackPrompt?.question ?? "Share a moment that made you smile today."}
            </Text>
            <Text style={styles.promptDescription}>
              {fallbackPrompt?.description ?? "Tell your group about something meaningful or memorable from your day."}
            </Text>
            {promptId && (
              <Button
                title="Tell the Group"
                onPress={handleAnswerPrompt}
                style={styles.answerButton}
              />
            )}
          </FilmFrame>
        )}

        {/* Entries feed */}
        {!userEntry && otherEntries.length > 0 ? (
          <View style={styles.lockedMessage}>
            <Text style={styles.lockedText}>People have shared today.</Text>
            <Text style={styles.lockedText}>Add yours to see what they said.</Text>
          </View>
        ) : userEntry ? (
          <View style={styles.entriesContainer}>
            {entries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={groupPickerVisible} transparent animationType="fade" onRequestClose={() => setGroupPickerVisible(false)}>
        <TouchableOpacity style={styles.groupModalBackdrop} activeOpacity={1} onPress={() => setGroupPickerVisible(false)}>
          <View style={styles.groupModalSheet}>
            <Text style={styles.groupModalTitle}>Switch group</Text>
            <ScrollView contentContainerStyle={styles.groupList}>
              {groups.map((group) => (
                <TouchableOpacity
                  key={group.id}
                  style={[
                    styles.groupRow,
                    group.id === currentGroupId && styles.groupRowActive,
                  ]}
                  onPress={() => handleSelectGroup(group.id)}
                >
                  <Text style={styles.groupRowText}>{group.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.createGroupButton} onPress={handleCreateGroupSoon}>
              <Text style={styles.createGroupText}>Create another group</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  header: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[800],
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  groupSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  groupName: {
    ...typography.h2,
    fontSize: 22,
  },
  chevron: {
    ...typography.body,
    fontSize: 12,
  },
  membersScroll: {
    marginBottom: spacing.md,
  },
  memberAvatar: {
    marginRight: spacing.sm,
  },
  addMemberButton: {
    marginRight: spacing.sm,
  },
  addMemberCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gray[700],
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.gray[600],
  },
  addMemberText: {
    ...typography.h2,
    fontSize: 20,
    color: colors.white,
  },
  dayScroller: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
  },
  dayButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginRight: spacing.xs,
    alignItems: "center",
    minWidth: 48,
  },
  dayButtonSelected: {
    borderWidth: 2,
    borderRadius: 4,
    borderColor: colors.white,
  },
  dayText: {
    ...typography.caption,
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  dayTextSelected: {
    color: colors.white,
  },
  dayNum: {
    ...typography.bodyBold,
    fontSize: 16,
  },
  dayNumSelected: {
    color: colors.white,
  },
  dayCheck: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
    marginTop: spacing.xs,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  promptCard: {
    marginBottom: spacing.lg,
    width: SCREEN_WIDTH,
    alignSelf: "center",
  },
  promptInner: {
    margin: spacing.md,
    padding: spacing.lg,
  },
  promptQuestion: {
    ...typography.h3,
    fontSize: 22,
    marginBottom: spacing.sm,
  },
  promptDescription: {
    ...typography.body,
    color: colors.gray[400],
    marginBottom: spacing.md,
  },
  answerButton: {
    marginTop: spacing.md,
  },
  lockedMessage: {
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.xs,
  },
  lockedText: {
    ...typography.body,
    textAlign: "center",
    color: colors.gray[500],
  },
  entriesContainer: {
    gap: spacing.lg,
  },
  notice: {
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  noticeText: {
    ...typography.body,
    color: colors.gray[300],
  },
  groupModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  groupModalSheet: {
    backgroundColor: colors.black,
    padding: spacing.lg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: spacing.md,
    maxHeight: "70%",
  },
  groupModalTitle: {
    ...typography.h2,
    color: colors.white,
    fontSize: 24,
  },
  groupList: {
    gap: spacing.sm,
  },
  groupRow: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.gray[900],
  },
  groupRowActive: {
    borderWidth: 1,
    borderColor: colors.white,
  },
  groupRowText: {
    ...typography.bodyBold,
    color: colors.white,
    fontSize: 18,
  },
  createGroupButton: {
    paddingVertical: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.gray[700],
    borderRadius: 12,
  },
  createGroupText: {
    ...typography.bodyBold,
    color: colors.white,
  },
})
