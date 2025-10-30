"use client"

import { useState, useEffect } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Share, Alert } from "react-native"
import { useRouter } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "../../lib/supabase"
import { getUserGroups, getGroupMembers, getDailyPrompt, getEntriesForDate, getUserEntryForDate } from "../../lib/db"
import { getTodayDate, getWeekDates } from "../../lib/utils"
import { colors, typography, spacing } from "../../lib/theme"
import { Avatar } from "../../components/Avatar"
import { FilmFrame } from "../../components/FilmFrame"
import { Button } from "../../components/Button"
import { EntryCard } from "../../components/EntryCard"

export default function Home() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState(getTodayDate())
  const [currentGroupId, setCurrentGroupId] = useState<string>()
  const [userId, setUserId] = useState<string>()
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadUser()
  }, [])

  async function loadUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      setUserId(user.id)
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
    enabled: !!currentGroupId && !!userEntry,
  })

  const weekDates = getWeekDates()
  const currentGroup = groups.find((g) => g.id === currentGroupId)

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
    if (!dailyPrompt) return
    router.push({
      pathname: "/(main)/modals/entry-composer",
      params: {
        promptId: dailyPrompt.prompt_id,
        date: selectedDate,
      },
    })
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.groupSelector}>
            <Text style={styles.groupName}>{currentGroup?.name || "Loading..."}</Text>
            <Text style={styles.chevron}>▼</Text>
          </TouchableOpacity>
          <TouchableOpacity>
            <Avatar uri={undefined} name="User" size={40} />
          </TouchableOpacity>
        </View>

        {/* Member avatars with + button */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.membersScroll}>
          {members.map((member) => (
            <View key={member.id} style={styles.memberAvatar}>
              <Avatar uri={member.user.avatar_url} name={member.user.name} size={40} />
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
        {/* Daily prompt */}
        {dailyPrompt && (
          <FilmFrame style={styles.promptCard}>
            <Text style={styles.promptQuestion}>{dailyPrompt.prompt?.question}</Text>
            <Text style={styles.promptDescription}>{dailyPrompt.prompt?.description}</Text>
            {!userEntry && <Button title="Tell the Group" onPress={handleAnswerPrompt} style={styles.answerButton} />}
          </FilmFrame>
        )}

        {/* Entries feed */}
        {!userEntry ? (
          <View style={styles.lockedMessage}>
            <Text style={styles.lockedText}>People have shared today.</Text>
            <Text style={styles.lockedText}>Add yours to see what they said.</Text>
          </View>
        ) : (
          <View style={styles.entriesContainer}>
            {entries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
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
    fontSize: 28,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray[700],
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.gray[600],
  },
  addMemberText: {
    ...typography.h2,
    fontSize: 24,
    color: colors.white,
  },
  dayScroller: {
    marginTop: spacing.sm,
  },
  dayButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
    alignItems: "center",
    minWidth: 60,
  },
  dayButtonSelected: {
    borderWidth: 2,
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
    padding: spacing.md,
  },
  promptCard: {
    marginBottom: spacing.lg,
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
  },
  lockedText: {
    ...typography.body,
    textAlign: "center",
    color: colors.gray[500],
  },
  entriesContainer: {
    gap: spacing.lg,
  },
})
