import { useCallback, useMemo, useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native"
import { useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { BlurView } from "expo-blur"
import { useAuth } from "../../components/AuthProvider"
import { Avatar } from "../../components/Avatar"
import { useTodayHub, useQuestionRange, useUnseenTotal } from "../../lib/v2/queries"
import { useV2Colors, v2Spacing as sp } from "../../lib/v2/theme"
import { AvatarStack } from "../../components/v2/AvatarStack"
import { AppHeader } from "../../components/v2/AppHeader"
import { TexturedCard } from "../../components/v2/Texture"
import { NoGroupsCard } from "../../components/v2/NoGroupsCard"
import { JoinByCodeCard } from "../../components/v2/JoinByCodeCard"
import * as haptics from "../../lib/v2/haptics"
import { QuestionCard } from "../../components/v2/QuestionCard"
import { DaySelector, DAY_WINDOW, shiftDate } from "../../components/v2/DaySelector"
import { useProfile } from "../../lib/v2/useProfile"
import { getTodayDate } from "../../lib/utils"
import type { HubGroup } from "../../lib/v2/types"

/**
 * Violet marks unseen and is a LIGHT tint in both themes, so anything sitting on
 * it has to be dark regardless of theme. c.text is near-white in dark mode, which
 * is why unread cards became unreadable there.
 */
const ON_VIOLET = "#000000"

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m`
  const h = Math.round(mins / 60)
  if (h < 24) return `${h}h`
  return `${Math.round(h / 24)}d`
}

/**
 * Today — designs 2A / 2B.
 *
 * Today only. The day-carousel is gone: one question, today, everyone at once is
 * the premise, and past days belong in History.
 */
export default function TodayScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const { c, isDark } = useV2Colors()
  const today = getTodayDate()
  const { data: profile } = useProfile(user?.id)

  const [date, setDate] = useState(today)
  const { data, isLoading, refetch, isRefetching } = useTodayHub(user?.id, date)
  // Only powers the dropdown's answered ticks; the card itself reads from the hub.
  const { data: questions } = useQuestionRange(user?.id, shiftDate(today, -(DAY_WINDOW - 1)), today)

  const s = useMemo(() => makeStyles(c, isDark), [c, isDark])
  const answered = !!data?.my_answer
  const noGroups = (data?.groups?.length ?? 0) === 0
  // Total unseen across every group — the badge answers "is there anything in
  // History for me", which a per-group count on this screen doesn't.
  // Across all recent days — today's hub alone missed unseen on older threads.
  const { data: unseenTotal = 0 } = useUnseenTotal(user?.id)

  const answeredSoFar = useMemo(
    () => (data?.groups ?? []).reduce((n, g) => n + g.answer_count, 0),
    [data?.groups]
  )
  const answeredFaces = useMemo(
    () =>
      (data?.groups ?? [])
        .filter((g) => g.answer_count > 0)
        .flatMap((g) => g.members)
        .filter((m) => m.id !== user?.id)
        .slice(0, 3),
    [data?.groups, user?.id]
  )

  const openThread = useCallback(
    (groupId: string) => router.push({ pathname: "/(v2)/thread", params: { groupId, date } }),
    [router, date]
  )
  const openComposer = useCallback(() => {
    if (!data) return
    router.push({
      pathname: "/(v2)/compose",
      params: { promptId: data.question.prompt_id, date },
    })
  }, [router, data, date])

  const questionCard = data ? (
    <QuestionCard
      questionText={data.question.text}
      myAnswer={data.my_answer}
      answeredFaces={answeredFaces}
      answeredCount={answeredSoFar}
      profile={profile}
      groupCount={data.groups.length}
      onAnswer={openComposer}
      onEdit={openComposer}
    />
  ) : null

  if (isLoading || !data) {
    return (
      <SafeAreaView style={s.screen} edges={["top"]}>
        <AppHeader
        avatarUrl={profile?.avatar_url ?? undefined}
        name={profile?.name}
        unseenCount={unseenTotal}
        left={
          <DaySelector
            today={today}
            selectedDate={date}
            questions={questions ?? {}}
            onSelect={setDate}
          />
        }
      />
        <ActivityIndicator style={{ marginTop: 64 }} color={c.text} />
      </SafeAreaView>
    )
  }

  const renderGroup = ({ item }: { item: HubGroup }) => {
    const locked = !answered
    const onViolet = item.unread_count > 0 && !locked
    const ink = onViolet ? { color: ON_VIOLET } : null
    return (
      <Pressable
        // Locked taps open the BLURRED thread rather than jumping straight to the
        // composer, so there's context for why you're being asked to answer.
        onPress={() => {
          haptics.tap()
          openThread(item.id)
        }}
      >
        {({ pressed }) => (
        <TexturedCard
          radius={16}
          opacity={0.22}
          pressed={pressed}
          style={[s.groupRow, item.unread_count > 0 && !locked ? s.groupRowUnread : null]}
        >
        <View style={s.groupBody}>
          {/* Whole group above the name, as History does it — and the full member
              list, not "everyone except me", so the two screens show the same faces. */}
          <View style={s.groupFaces}>
            <AvatarStack members={item.members} size={26} max={4} />
          </View>
          <View style={s.groupTitleRow}>
            <Text style={[s.groupName, ink]} numberOfLines={1}>
              {item.name}
            </Text>
            {item.has_birthday ? <Text style={s.cake}>🎂</Text> : null}
            <View style={{ flex: 1 }} />
            {item.last_activity ? (
              <Text style={[s.timeAgo, ink]}>{timeAgo(item.last_activity)}</Text>
            ) : null}
            {!locked && item.unread_count > 0 ? (
              <View style={s.unreadBadge}>
                <Text style={s.unreadText}>{item.unread_count}</Text>
              </View>
            ) : null}
            {/* No "0" — an empty count next to a padlock reads as a score. */}
            {locked ? (
              <View style={s.lockBadge}>
                <Text style={s.lockBadgeText}>
                  🔒{item.answer_count > 0 ? ` ${item.answer_count}` : ""}
                </Text>
              </View>
            ) : null}
          </View>

          {locked ? (
            // Real blur over the real text, rather than bullet characters that
            // read as a loading state.
            <View style={s.blurWrap}>
              <Text style={[s.groupPreview, ink]} numberOfLines={1}>
                <Text style={[s.previewAuthor, ink]}>
                  {item.last_message?.author ?? "Someone"}:{" "}
                </Text>
                {item.last_message?.text || "hasn't answered yet"}
              </Text>
              <BlurView
                intensity={22}
                tint={isDark ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
            </View>
          ) : item.last_message ? (
            <Text style={[s.groupPreview, ink]} numberOfLines={1}>
              <Text style={[s.previewAuthor, ink]}>{item.last_message.author}: </Text>
              {item.last_message.text || "sent something"}
            </Text>
          ) : (
            <Text style={[s.groupPreviewDim, ink]}>Only you so far</Text>
          )}

          {!locked ? (
            <View style={s.countRow}>
              <Text style={[s.countPill, onViolet ? s.countPillOnViolet : null]}>
                {item.answer_count} answers
              </Text>
              {item.message_count > 0 ? (
                <Text style={[s.countPill, onViolet ? s.countPillOnViolet : null]}>
                  {item.message_count} messages
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
        </TexturedCard>
        )}
      </Pressable>
    )
  }

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <AppHeader
        avatarUrl={profile?.avatar_url ?? undefined}
        name={profile?.name}
        unseenCount={unseenTotal}
        left={
          <DaySelector
            today={today}
            selectedDate={date}
            questions={questions ?? {}}
            onSelect={setDate}
          />
        }
      />
      <FlatList
        data={data.groups}
        keyExtractor={(g) => g.id}
        renderItem={renderGroup}
        contentContainerStyle={{ padding: sp.lg, paddingBottom: sp.xxl }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.text} />
        }
        ListHeaderComponent={
          <View>
            {/* Once you have answered, the threads are the live thing and the
                question is just a record — so it moves below them. Before you
                answer it stays on top, because nothing else is unlocked yet. */}
            {answered ? null : questionCard}

            {/* Said once, to the only people who need it: a brand new user with
                nothing answered and nobody to share with. Naming them and naming
                the two next steps beats leaving them to infer both from cards. */}
            {noGroups && !answered ? (
              <Text style={s.welcomeLine}>
                Welcome to Good Times{profile?.name ? `, ${profile.name}` : ""}! Start by answering
                today&rsquo;s question and starting or joining your first group.
              </Text>
            ) : null}

            {/* With no groups there is no list to head — so the create/join card
                takes that slot instead of a heading pointing at nothing. */}
            {noGroups ? (
              <>
                <NoGroupsCard
                  style={{ marginTop: sp.lg }}
                  title={answered ? "Add your people. Start the chat" : "No one to share with yet"}
                  body={
                    answered
                      ? "Your answer is saved. Start a group or join one with a link and it shows up there."
                      : "Start a group or join one with a link — your answers go to everyone in it."
                  }
                />
                {/* Under it, not inside it: far more people arrive holding
                    somebody's code than set out to found a group, and that path
                    was two taps and a screen away. */}
                <JoinByCodeCard style={{ marginTop: sp.md }} />
              </>
            ) : (
              <Text style={[s.sectionHeading, answered ? { marginTop: 0 } : null]}>
                {answered ? "Today's answers" : "Waiting for you"}
              </Text>
            )}
          </View>
        }
        ListFooterComponent={
          <View>
            {noGroups ? null : (
              <Pressable
                onPress={() => {
                  haptics.tap()
                  router.push("/(onboarding-v2)/alone")
                }}
                style={({ pressed }) => [
                  s.newGroup,
                  pressed ? { transform: [{ translateY: 2 }] } : null,
                ]}
              >
                <View style={s.newGroupPlus}>
                  <MaterialCommunityIcons name="plus" size={20} color={c.bg} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.newGroupTitle}>Another group — new vibes</Text>
                  <Text style={s.newGroupSub}>Start one or join with a link</Text>
                </View>
              </Pressable>
            )}

            {/* Your answer, below the threads, once it exists. */}
            {answered ? (
              <View style={{ marginTop: sp.lg }}>
                <Text style={s.sectionHeading}>Your answer</Text>
                {questionCard}
              </View>
            ) : null}
          </View>
        }
      />
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useV2Colors>["c"], isDark: boolean) {
  const card = { borderWidth: 2, borderColor: c.border, borderRadius: 16, padding: sp.lg } as const
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },





    sectionHeading: {
      fontSize: 17,
      fontWeight: "800",
      color: c.text,
      marginTop: sp.lg,
      marginBottom: sp.sm,
    },
    welcomeLine: {
      fontSize: 15,
      lineHeight: 22,
      color: c.textSecondary,
      marginTop: sp.lg,
      marginBottom: -sp.xs,
    },

    groupRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 16,
      padding: sp.md,
      marginBottom: sp.md,
    },
    // Violet card + black badge, exactly as History marks unseen. Red-on-white
    // said "error" here while the same state said "unseen" one screen over.
    groupRowUnread: { backgroundColor: "#F0D7FF", borderColor: c.border },
    groupRowPressed: {
      transform: [{ translateY: 4 }],
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      elevation: 0,
    },
    groupBody: { flex: 1 },
    groupFaces: { marginBottom: 6 },
    groupTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    groupName: { fontSize: 17, fontWeight: "800", color: c.text, flexShrink: 1 },
    cake: { fontSize: 13 },
    timeAgo: { fontSize: 12, color: c.textSecondary, marginRight: 4 },
    groupPreview: { color: c.textSecondary, fontSize: 14, marginTop: 3 },
    previewAuthor: { fontWeight: "700", color: c.text },
    groupPreviewDim: { color: c.textSecondary, fontSize: 14, marginTop: 3, fontStyle: "italic" },
    blurWrap: { marginTop: 3, overflow: "hidden", borderRadius: 4, alignSelf: "flex-start" },
    countRow: { flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" },
    countPill: {
      fontSize: 12,
      fontWeight: "700",
      color: c.text,
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 3,
      overflow: "hidden",
    },
    // The pill needs its own light fill on violet: c.bg is black in dark mode, so
    // dark ink on it disappeared entirely.
    countPillOnViolet: { backgroundColor: "#FFFFFF", borderColor: ON_VIOLET, color: ON_VIOLET },
    lockBadge: {
      backgroundColor: c.accent,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    lockBadgeText: { fontSize: 12, fontWeight: "800", color: c.accentInk },
    unreadBadge: {
      backgroundColor: ON_VIOLET,
      minWidth: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6,
    },
    unreadText: { color: "#F0D7FF", fontWeight: "800", fontSize: 12 },

    // Lighter outline: this sits under the real groups and shouldn't compete with
    // them. The plus is solid instead, so there is still one firm affordance.
    newGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: sp.md,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: c.border,
      opacity: 0.85,
      borderRadius: 16,
      padding: sp.md,
      marginTop: sp.sm,
    },
    newGroupPlus: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: c.text,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyGroup: {
      borderWidth: 2,
      borderStyle: "dashed",
      borderColor: c.border,
      borderRadius: 16,
      padding: sp.lg,
      marginTop: sp.lg,
    },
    emptyTitle: { fontSize: 17, fontWeight: "800", color: c.text },
    emptySub: { fontSize: 14, color: c.textSecondary, marginTop: 4, lineHeight: 20 },
    // Inverted against the page rather than themed: on the cream background black
    // is the strongest thing available, and on the dark background the same job
    // needs a light fill. c.accent would go amber in both and compete with the
    // question card directly above it.
    emptyCta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: isDark ? "#F0D7FF" : "#000000",
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 24,
      paddingVertical: 12,
      marginTop: sp.md,
    },
    emptyCtaText: { fontSize: 15, fontWeight: "800", color: isDark ? "#000000" : "#FFFFFF" },
    newGroupTitle: { fontSize: 16, fontWeight: "800", color: c.text },
    newGroupSub: { fontSize: 13, color: c.textSecondary, marginTop: 1 },
  })
}
