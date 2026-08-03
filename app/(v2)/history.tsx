import { useEffect, useMemo, useState } from "react"
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  FlatList,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { v2Analytics } from "../../lib/v2/analytics"
import { useAuth } from "../../components/AuthProvider"
import { useHistory, useChatList, useMarkAllRead } from "../../lib/v2/queries"
import { NoGroupsCard } from "../../components/v2/NoGroupsCard"
import { useV2Colors, v2Spacing as sp } from "../../lib/v2/theme"
import { AvatarStack } from "../../components/v2/AvatarStack"
import { PreviewFans } from "../../components/v2/PreviewFans"
import { BackHeader } from "../../components/v2/AppHeader"
import { TexturedCard } from "../../components/v2/Texture"
import * as haptics from "../../lib/v2/haptics"
import type { HistoryRow } from "../../lib/v2/types"

/**
 * History — design 2F.
 *
 * Pushed from the header icon on Today, closes with the back arrow. No bottom tab
 * bar in v2. Rows are group-first: member collage, group + when, the question,
 * counts, and the last message as "Name: text".
 */
export default function HistoryScreen() {
  useEffect(() => {
    v2Analytics.historyViewed()
  }, [])

  const router = useRouter()
  const { user } = useAuth()
  const { c } = useV2Colors()
  const params = useLocalSearchParams<{ groupId?: string }>()

  const [groupId, setGroupId] = useState<string | null>(params.groupId ?? null)
  const [unseenOnly, setUnseenOnly] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  /**
   * Period filter. Defaults to the last 7 days rather than everything — History
   * is mostly "what did I miss", and an all-time list buries that under months of
   * older threads.
   */
  const PERIODS = [
    { key: "7d", label: "Last 7 days", days: 7 },
    { key: "1m", label: "The last month", days: 30 },
    { key: "1y", label: "This year", days: 365 },
    { key: "all", label: "All time", days: null as number | null },
  ]
  const [period, setPeriod] = useState(PERIODS[0])
  const [periodOpen, setPeriodOpen] = useState(false)
  const from = useMemo(() => {
    if (period.days === null) return null
    const d = new Date()
    d.setDate(d.getDate() - period.days)
    return d.toISOString().slice(0, 10)
  }, [period])


  const { data, isLoading, refetch, isRefetching } = useHistory(user?.id, {
    groupId,
    unseenOnly,
    from,
  })
  // Powers the All groups / per-group filter row.
  const { data: groups } = useChatList(user?.id)
  const markAllRead = useMarkAllRead(user?.id)

  const s = useMemo(() => makeStyles(c), [c])
  const unseenTotal = (data ?? []).filter((r) => r.unread_count > 0).length
  const selectedGroupName =
    groupId === null ? "All groups" : groups?.find((g) => g.id === groupId)?.name ?? "All groups"

  const renderRow = ({ item }: { item: HistoryRow }) => {
    const members = groups?.find((g) => g.id === item.group_id)
    // Weekly photo journal reads differently from a question day, so it gets its
    // own tint rather than being one more identical card in the list.
    const isPhotoDump = /photo journal|photo dump/i.test(item.question ?? "")
    const ink = item.unread_count > 0 ? { color: ON_VIOLET } : null
    return (
      <Pressable
        onPress={() => {
          haptics.tap()
          router.push({
            pathname: "/(v2)/thread",
            params: { groupId: item.group_id, date: item.thread_date },
          })
        }}
      >
        {({ pressed }) => (
        <TexturedCard
          radius={14}
          opacity={0.2}
          pressed={pressed}
          // Violet marks UNSEEN now — the photo journal is distinguished by its
          // image strip instead, so colour means one thing only.
          style={[s.row, item.unread_count > 0 ? s.rowUnseen : null]}
        >
        <View style={s.rowHead}>
          <AvatarStack members={members?.members ?? []} size={26} max={3} />
          <Text style={[s.rowGroup, ink]} numberOfLines={1}>
            {item.group_name} · {relativeDay(item.thread_date)}
          </Text>
          {item.unread_count > 0 ? (
            <View style={s.badge}>
              <Text style={s.badgeText}>{item.unread_count}</Text>
            </View>
          ) : null}
        </View>

        <Text style={[s.rowQuestion, ink]} numberOfLines={2}>
          {item.question}
        </Text>

        <PreviewFans people={item.preview_people ?? []} />

        <Text style={[s.rowCounts, ink]}>
          {item.answer_count} answer{item.answer_count === 1 ? "" : "s"} · {item.message_count}{" "}
          message{item.message_count === 1 ? "" : "s"}
          {item.video_count > 0 ? ` · ${item.video_count} video` : ""}
        </Text>

        {item.last_message?.text ? (
          <Text style={s.rowLast} numberOfLines={1}>
            <Text style={s.rowLastAuthor}>{item.last_message.author}: </Text>
            {item.last_message.text}
          </Text>
        ) : null}
        </TexturedCard>
        )}
      </Pressable>
    )
  }

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <BackHeader title="Group chat history" />

      {/* ---- filters: one group dropdown + unseen ---- */}
      <View style={s.filterRow2}>
        <Pressable
          onPress={() => setPickerOpen(true)}
          style={({ pressed }) => [s.dropdown, pressed ? { transform: [{ translateY: 1 }] } : null]}
        >
          <Text style={s.dropdownText} numberOfLines={1}>
            {selectedGroupName}
          </Text>
          <Text style={s.dropdownCaret}>▾</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            haptics.tap()
            setPeriodOpen(true)
          }}
          style={({ pressed }) => [s.dropdown, pressed ? { transform: [{ translateY: 1 }] } : null]}
        >
          <Text style={s.dropdownText} numberOfLines={1}>
            {period.label}
          </Text>
          <Text style={s.dropdownCaret}>▾</Text>
        </Pressable>
        <Chip
          label={`Unseen${unseenTotal > 0 ? ` ${unseenTotal}` : ""}`}
          on={unseenOnly}
          tone="violet"
          onPress={() => setUnseenOnly((v) => !v)}
          c={c}
        />
      </View>

      {/* Its own row, centred. Inline at the end of the filter row it sat past the
          right edge once three chips were present, so it was unreachable. */}
      {unseenOnly && unseenTotal > 0 ? (
        <Pressable
          onPress={() => {
            haptics.tap()
            markAllRead.mutate(groupId)
          }}
          hitSlop={8}
          style={s.clearUnseenRow}
        >
          <Text style={s.clearUnseen}>Clear unseen</Text>
        </Pressable>
      ) : null}

      <Modal visible={periodOpen} transparent animationType="fade" onRequestClose={() => setPeriodOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setPeriodOpen(false)} />
        <View style={s.picker}>
          <Text style={s.pickerTitle}>Period</Text>
          {PERIODS.map((p) => (
            <PickerRow
              key={p.key}
              label={p.label}
              on={p.key === period.key}
              onPress={() => {
                haptics.selection()
                setPeriod(p)
                setPeriodOpen(false)
              }}
              c={c}
            />
          ))}
        </View>
      </Modal>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setPickerOpen(false)} />
        <View style={s.picker}>
          <Text style={s.pickerTitle}>Show</Text>
          <ScrollView style={{ maxHeight: 380 }}>
            <PickerRow
              label="All groups"
              on={groupId === null}
              onPress={() => {
                setGroupId(null)
                setPickerOpen(false)
              }}
              c={c}
            />
            {(groups ?? []).map((g) => (
              <PickerRow
                key={g.id}
                label={g.name}
                on={groupId === g.id}
                onPress={() => {
                  setGroupId(g.id)
                  setPickerOpen(false)
                }}
                c={c}
              />
            ))}
          </ScrollView>
        </View>
      </Modal>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={c.text} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(r) => `${r.group_id}-${r.thread_date}`}
          renderItem={renderRow}
          contentContainerStyle={{ padding: sp.lg, paddingBottom: sp.xxl }}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={9}
          removeClippedSubviews
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.text} />
          }
          ListEmptyComponent={
            // An empty History with no groups isn't "nothing yet" — there is
            // nowhere for anything to arrive. Say that, and offer the fix.
            (groups?.length ?? 0) === 0 ? (
              <NoGroupsCard
                title="No one to share with yet"
                body="History fills up as your groups answer. Start one or join with a link and their answers land here."
              />
            ) : (
              <Text style={s.empty}>Nothing here yet.</Text>
            )
          }
        />
      )}
    </SafeAreaView>
  )
}

function Chip({
  label,
  on,
  onPress,
  tone,
  c,
}: {
  label: string
  on: boolean
  onPress: () => void
  tone?: "red" | "violet"
  c: ReturnType<typeof useV2Colors>["c"]
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          borderWidth: 2,
          borderColor: c.border,
          borderRadius: 18,
          paddingHorizontal: sp.md,
          paddingVertical: 6,
          backgroundColor: on ? (tone === "violet" ? VIOLET : tone === "red" ? c.red : c.blue) : c.surface,
          marginRight: sp.sm,
          transform: [{ translateY: pressed ? 1 : 0 }],
        },
      ]}
    >
      {/* Violet is a LIGHT fill, so white text on it is unreadable — same reason
          the unseen cards pin their foreground dark. Red and blue fills stay white. */}
      <Text
        style={{
          fontWeight: "700",
          fontSize: 13,
          color: on ? (tone === "violet" ? ON_VIOLET : "#fff") : c.text,
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function PickerRow({
  label,
  on,
  onPress,
  c,
}: {
  label: string
  on: boolean
  onPress: () => void
  c: ReturnType<typeof useV2Colors>["c"]
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: sp.md,
        borderRadius: 12,
        backgroundColor: on ? c.surfaceAlt : "transparent",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ flex: 1, fontWeight: on ? "800" : "600", color: c.text, fontSize: 16 }}>
        {label}
      </Text>
      {on ? <Text style={{ color: c.green, fontWeight: "800" }}>✓</Text> : null}
    </Pressable>
  )
}

function relativeDay(date: string) {
  const d = new Date(date + "T00:00:00")
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - d.getTime()) / 864e5)
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  if (diff < 7) return d.toLocaleDateString([], { weekday: "long" })
  return d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })
}

const VIOLET = "#F0D7FF"
/** Violet is light in both themes, so anything on it must be dark in both. */
const ON_VIOLET = "#000000"

function makeStyles(c: ReturnType<typeof useV2Colors>["c"]) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    filterRow2: {
      flexDirection: "row",
      gap: sp.sm,
      paddingHorizontal: sp.lg,
      paddingBottom: sp.md,
      alignItems: "center",
    },
    dropdown: {
      flexDirection: "row",
      alignItems: "center",
      gap: sp.sm,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 18,
      paddingHorizontal: sp.md,
      paddingVertical: 7,
      backgroundColor: c.surface,
      maxWidth: "62%",
    },
    dropdownText: { fontWeight: "800", color: c.text, fontSize: 14 },
    dropdownCaret: { color: c.textSecondary, fontWeight: "800" },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
    picker: {
      position: "absolute",
      left: sp.lg,
      right: sp.lg,
      top: "22%",
      backgroundColor: c.bg,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 20,
      padding: sp.md,
    },
    pickerTitle: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.6,
      color: c.textSecondary,
      marginBottom: sp.sm,
      paddingHorizontal: sp.md,
      textTransform: "uppercase",
    },

    row: {
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 14,
      padding: sp.md,
      marginBottom: sp.md,
    },
    rowUnseen: { backgroundColor: VIOLET, borderColor: c.border },
    previewStrip: { flexDirection: "row", gap: 5, marginTop: sp.sm },
    previewThumb: {
      width: 46,
      height: 46,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.surfaceAlt,
    },
    previewMore: { alignItems: "center", justifyContent: "center" },
    previewMoreText: { fontSize: 12, fontWeight: "800", color: c.text },
    clearUnseenRow: { alignItems: "center", paddingBottom: sp.md },
    clearUnseen: { color: c.blue, fontWeight: "800", fontSize: 13 },
    // Pressed: drop into the shadow rather than fade out.
    rowPressed: {
      transform: [{ translateY: 4 }],
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      elevation: 0,
    },

    rowHead: { flexDirection: "row", alignItems: "center", gap: sp.sm, marginBottom: 8 },
    rowGroup: { flex: 1, fontSize: 13, fontWeight: "700", color: c.textSecondary },
    badge: {
      backgroundColor: ON_VIOLET,
      minWidth: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6,
    },
    badgeText: { color: VIOLET, fontWeight: "800", fontSize: 12 },
    rowQuestion: { fontSize: 17, fontWeight: "800", color: c.text, lineHeight: 22 },
    rowCounts: { fontSize: 12, color: c.textSecondary, marginTop: 6 },
    rowLast: { fontSize: 13, color: c.textSecondary, marginTop: 6 },
    rowLastAuthor: { fontWeight: "800", color: c.text },
    empty: { color: c.textSecondary, textAlign: "center", marginTop: sp.xxl },
  })
}
