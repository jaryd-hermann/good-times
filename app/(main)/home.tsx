"use client"

import { useState, useEffect, useRef, useMemo } from "react"
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
  Animated,
} from "react-native"
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { supabase } from "../../lib/supabase"
import AsyncStorage from "@react-native-async-storage/async-storage"
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
import { FontAwesome } from "@expo/vector-icons"
import { registerForPushNotifications, savePushToken } from "../../lib/notifications"

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
  const params = useLocalSearchParams()
  const focusGroupId = params.focusGroupId as string | undefined
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState(getTodayDate())
  const [currentGroupId, setCurrentGroupId] = useState<string>()
  const [userId, setUserId] = useState<string>()
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | undefined>()
  const [userName, setUserName] = useState<string>("User")
  const [refreshing, setRefreshing] = useState(false)
  const insets = useSafeAreaInsets()
  const [groupPickerVisible, setGroupPickerVisible] = useState(false)
  const scrollY = useRef(new Animated.Value(0)).current
  const headerTranslateY = useRef(new Animated.Value(0)).current
  const contentPaddingTop = useRef(new Animated.Value(0)).current
  const lastScrollY = useRef(0)

  useEffect(() => {
    loadUser()
  }, [])

  // Reload user profile when screen comes into focus (e.g., returning from settings)
  // But don't reset group - only update if focusGroupId param is provided
  useFocusEffect(
    useCallback(() => {
      // Only reload user profile, not group (preserve current group)
      async function reloadProfile() {
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
          // Only update group if focusGroupId param is provided
          if (focusGroupId) {
            const groups = await getUserGroups(user.id)
            if (groups.some((group) => group.id === focusGroupId)) {
              setCurrentGroupId(focusGroupId)
            }
          }
        }
      }
      reloadProfile()
    }, [focusGroupId])
  )

  // Request push notification permission on first visit to home
  useEffect(() => {
    async function requestNotificationsOnFirstVisit() {
      const hasRequestedNotifications = await AsyncStorage.getItem("has_requested_notifications")
      if (!hasRequestedNotifications && userId) {
        try {
          const token = await registerForPushNotifications()
          if (token) {
            await savePushToken(userId, token)
            console.log("[home] push notifications registered")
          }
          await AsyncStorage.setItem("has_requested_notifications", "true")
        } catch (error) {
          console.warn("[home] failed to register push notifications:", error)
          // Still mark as requested so we don't keep asking
          await AsyncStorage.setItem("has_requested_notifications", "true")
        }
      }
    }
    requestNotificationsOnFirstVisit()
  }, [userId])

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
      // Get user's groups
      const groups = await getUserGroups(user.id)
      if (groups.length > 0) {
        // Priority order:
        // 1. focusGroupId param (highest priority)
        // 2. Persisted group ID from AsyncStorage
        // 3. Current state (if already set)
        // 4. First group (fallback)
        
        if (focusGroupId && groups.some((group) => group.id === focusGroupId)) {
          setCurrentGroupId(focusGroupId)
          await AsyncStorage.setItem("current_group_id", focusGroupId)
        } else if (!currentGroupId) {
          // Try to restore from AsyncStorage
          const persistedGroupId = await AsyncStorage.getItem("current_group_id")
          if (persistedGroupId && groups.some((group) => group.id === persistedGroupId)) {
            setCurrentGroupId(persistedGroupId)
          } else {
            // Fallback to first group
            setCurrentGroupId(groups[0].id)
            await AsyncStorage.setItem("current_group_id", groups[0].id)
          }
        }
        // Otherwise, preserve the existing currentGroupId
      }
    }
  }

  const { data: groups = [] } = useQuery({
    queryKey: ["groups", userId],
    queryFn: () => (userId ? getUserGroups(userId) : []),
    enabled: !!userId,
  })

  useEffect(() => {
    if (focusGroupId && focusGroupId !== currentGroupId && groups.some((group) => group.id === focusGroupId)) {
      setCurrentGroupId(focusGroupId)
    }
  }, [focusGroupId, groups, currentGroupId])

  // Check for unseen updates in each group
  const { data: groupUnseenStatus = {} } = useQuery({
    queryKey: ["groupUnseenStatus", groups.map((g) => g.id).join(","), userId],
    queryFn: async () => {
      if (groups.length === 0 || !userId) return {}
      const status: Record<string, boolean> = {}
      for (const group of groups) {
        if (group.id === currentGroupId) {
          status[group.id] = false // Current group is always "seen"
          continue
        }
        // Get last visit time
        const lastVisitStr = await AsyncStorage.getItem(`group_visited_${group.id}`)
        const lastVisit = lastVisitStr ? new Date(lastVisitStr) : null

        // Check for new entries by others since last visit
        const { data: recentEntries } = await supabase
          .from("entries")
          .select("created_at")
          .eq("group_id", group.id)
          .neq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        // Check for new daily prompts since last visit
        const { data: recentPrompt } = await supabase
          .from("daily_prompts")
          .select("created_at")
          .eq("group_id", group.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        const latestActivity = (recentEntries as any)?.created_at || (recentPrompt as any)?.created_at
        if (latestActivity) {
          const latestActivityDate = new Date(latestActivity)
          status[group.id] = !lastVisit || latestActivityDate > lastVisit
        } else {
          status[group.id] = false
        }
      }
      return status
    },
    enabled: groups.length > 0 && !!userId,
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
    queryKey: ["dailyPrompt", currentGroupId, selectedDate, userId],
    queryFn: () => (currentGroupId ? getDailyPrompt(currentGroupId, selectedDate, userId) : null),
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
  const entryIdList = entries.map((item) => item.id)
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
      // Set message to URL so copy action copies just the URL
      await Share.share({
        url: inviteLink,
        message: inviteLink,
      })
    } catch (error: any) {
      Alert.alert("Error", error.message)
    }
  }

  function handleAnswerPrompt() {
    if (!promptId || !currentGroupId) {
      Alert.alert("No prompt available", "Please check back shortly — today's prompt is still loading.")
      return
    }
    router.push({
      pathname: "/(main)/modals/entry-composer",
      params: {
        promptId,
        date: selectedDate,
        groupId: currentGroupId, // Pass current group ID explicitly
      },
    })
  }

  async function handleSelectGroup(groupId: string) {
    if (groupId !== currentGroupId) {
      setCurrentGroupId(groupId)
      setSelectedDate(getTodayDate())
      // Persist current group ID to prevent loss on navigation
      await AsyncStorage.setItem("current_group_id", groupId)
      // Mark group as visited
      await AsyncStorage.setItem(`group_visited_${groupId}`, new Date().toISOString())
    }
    setGroupPickerVisible(false)
  }

  // Mark current group as visited when component mounts or group changes
  useEffect(() => {
    if (currentGroupId) {
      AsyncStorage.setItem(`group_visited_${currentGroupId}`, new Date().toISOString())
    }
  }, [currentGroupId])

  function handleCreateGroupSoon() {
    setGroupPickerVisible(false)
    router.push("/(onboarding)/start-new-group")
  }

  // Calculate full header height including day scroller
  const headerHeight = useMemo(() => {
    return insets.top + spacing.xl + spacing.md + 36 + spacing.md + 32 + spacing.md + 48 + spacing.md + spacing.sm + 48 + spacing.md
  }, [insets.top])

  useEffect(() => {
    contentPaddingTop.setValue(headerHeight)
  }, [headerHeight])

  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: false, // Need false for paddingTop animation
    listener: (event: any) => {
      const currentScrollY = event.nativeEvent.contentOffset.y
      const scrollDiff = currentScrollY - lastScrollY.current
      lastScrollY.current = currentScrollY

      if (scrollDiff > 5 && currentScrollY > 50) {
        // Scrolling down - hide header and reduce padding
        Animated.parallel([
          Animated.timing(headerTranslateY, {
            toValue: -(headerHeight + 100), // Hide entire header including day scroller
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(contentPaddingTop, {
            toValue: spacing.md, // Minimal padding when header hidden
            duration: 300,
            useNativeDriver: false,
          }),
        ]).start()
      } else if (scrollDiff < -5) {
        // Scrolling up - show header and restore padding
        Animated.parallel([
          Animated.timing(headerTranslateY, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(contentPaddingTop, {
            toValue: headerHeight,
            duration: 300,
            useNativeDriver: false,
          }),
        ]).start()
      }
    },
  })

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          { paddingTop: insets.top + spacing.md },
          {
            transform: [{ translateY: headerTranslateY }],
          },
        ]}
      >
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
      </Animated.View>

      {/* Content */}
      <Animated.ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: contentPaddingTop,
          },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.white} />}
        onScroll={handleScroll}
        scrollEventThrottle={16}
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
            {entries.map((entry, entryIndex) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                entryIds={entryIdList}
                index={entryIndex}
                returnTo="/(main)/home"
              />
            ))}
          </View>
        ) : null}
      </Animated.ScrollView>

      <Modal visible={groupPickerVisible} transparent animationType="fade" onRequestClose={() => setGroupPickerVisible(false)}>
        <TouchableOpacity style={styles.groupModalBackdrop} activeOpacity={1} onPress={() => setGroupPickerVisible(false)}>
          <View style={styles.groupModalSheet}>
            <Text style={styles.groupModalTitle}>Switch group</Text>
            <ScrollView contentContainerStyle={styles.groupList}>
              {groups.map((group) => (
                <View key={group.id} style={styles.groupRowContainer}>
                  <TouchableOpacity
                    style={[
                      styles.groupRow,
                      group.id === currentGroupId && styles.groupRowActive,
                      styles.groupRowFlex,
                    ]}
                    onPress={() => handleSelectGroup(group.id)}
                  >
                    <View style={styles.groupRowContent}>
                      <Text style={styles.groupRowText}>{group.name}</Text>
                      {groupUnseenStatus[group.id] && (
                        <View style={styles.unseenDot} />
                      )}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.groupSettingsButton}
                    onPress={() => {
                      setGroupPickerVisible(false)
                      router.push({
                        pathname: "/(main)/group-settings",
                        params: { groupId: group.id },
                      })
                    }}
                  >
                    <FontAwesome name="cog" size={16} color={colors.gray[400]} />
                  </TouchableOpacity>
                </View>
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
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.black,
    zIndex: 10,
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
    // No marginTop - header will overlay content when visible
  },
  contentContainer: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  promptCard: {
    marginBottom: spacing.lg,
    width: 399,
    alignSelf: "center",
    backgroundColor: "#0C0E1A",
  },
  promptInner: {
    margin: spacing.md,
    padding: spacing.lg,
    backgroundColor: "#0C0E1A",
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
  groupRowContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  groupRowFlex: {
    flex: 1,
  },
  groupRow: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.gray[900],
    flex: 1,
  },
  groupRowActive: {
    borderWidth: 1,
    borderColor: colors.white,
  },
  groupRowContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flex: 1,
  },
  groupSettingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray[900],
    justifyContent: "center",
    alignItems: "center",
  },
  groupRowText: {
    ...typography.bodyBold,
    color: colors.white,
    fontSize: 18,
    flex: 1,
  },
  unseenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginLeft: spacing.sm,
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
