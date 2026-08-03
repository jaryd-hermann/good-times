import { useEffect, useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Switch,
  Alert,
  TextInput,
  ActivityIndicator,
} from "react-native"
import { useRouter } from "expo-router"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useV2Colors, v2Spacing as sp } from "../../lib/v2/theme"
import { AvatarStack } from "./AvatarStack"
import { supabase } from "../../lib/supabase"
import { InviteSheet } from "./InviteSheet"
import * as haptics from "../../lib/v2/haptics"
import type { ThreadGroup } from "../../lib/v2/types"

/**
 * Group info sheet — design 2E.
 *
 * Bottom sheet over the thread: members, invite, group history, mute, rename
 * (admin only), leave. Everything routes inside the (v2) stack.
 */
export function GroupSheet({
  visible,
  group,
  userId,
  threadDate,
  onClose,
}: {
  visible: boolean
  group: ThreadGroup & { is_admin?: boolean }
  userId?: string
  threadDate: string
  onClose: () => void
}) {
  const router = useRouter()
  const { c } = useV2Colors()
  // Was local useState that nothing read or persisted — the toggle did nothing at
  // all. It now reflects group_members.muted for THIS member; muting is per
  // membership, so one person silencing a group cannot silence it for everyone.
  const [muted, setMuted] = useState(false)
  const [explainMute, setExplainMute] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [newName, setNewName] = useState(group.name)
  const [busy, setBusy] = useState(false)
  const s = makeStyles(c)

  useEffect(() => {
    if (!visible || !userId || !group.id) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from("group_members")
        .select("muted")
        .eq("group_id", group.id)
        .eq("user_id", userId)
        .maybeSingle()
      if (!cancelled) setMuted(!!(data as { muted?: boolean } | null)?.muted)
    })()
    return () => {
      cancelled = true
    }
  }, [visible, userId, group.id])

  async function applyMute(next: boolean) {
    if (!userId) return
    setMuted(next) // optimistic — the switch must not lag the thumb
    const { error } = await supabase
      .from("group_members")
      .update({ muted: next })
      .eq("group_id", group.id)
      .eq("user_id", userId)
    if (error) {
      setMuted(!next)
      Alert.alert("Couldn't change that", error.message)
    }
  }

  const allAnswered = group.answered_count >= group.member_count

  function invite() {
    haptics.tap()
    setShowInvite(true)
  }

  async function rename() {
    const n = newName.trim()
    if (!n) return
    setBusy(true)
    try {
      const { error } = await supabase.from("groups").update({ name: n }).eq("id", group.id)
      if (error) throw error
      setRenaming(false)
      onClose()
    } catch (e) {
      Alert.alert("Couldn't rename", (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function leave() {
    Alert.alert("Leave this group?", "You'll stop seeing their answers.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          if (!userId) return
          setBusy(true)
          try {
            const { error } = await supabase
              .from("group_members")
              .delete()
              .eq("group_id", group.id)
              .eq("user_id", userId)
            if (error) throw error
            onClose()
            router.replace("/(v2)/today")
          } catch (e) {
            Alert.alert("Couldn't leave", (e as Error).message)
          } finally {
            setBusy(false)
          }
        },
      },
    ])
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />

        <View style={s.titleRow}>
          <Text style={s.title} numberOfLines={1}>
            {group.name}
          </Text>
          <Pressable onPress={onClose} hitSlop={10} style={s.close}>
            <Text style={s.closeText}>✕</Text>
          </Pressable>
        </View>

        <Text style={s.meta}>
          {group.member_count} MEMBER{group.member_count === 1 ? "" : "S"} ·{" "}
          {allAnswered ? "ALL ANSWERED TODAY" : `${group.answered_count} ANSWERED TODAY`}
        </Text>

        <View style={s.membersRow}>
          {/* Every member, not four. This is the screen you open to see who is in
                the group, so cropping it is the one thing it must not do. */}
            <AvatarStack members={group.members} size={34} max={group.members.length} />
          <Text style={s.memberNames} numberOfLines={1}>
            {group.members
              // "You", not "Jaryd (you)" — nobody needs their own name read back.
                .map((m) => (m.id === userId ? "You" : (m.name ?? "Someone")))
              .join(", ")}
          </Text>
        </View>

        {renaming ? (
          <View style={s.renameRow}>
            <TextInput
              style={s.renameInput}
              value={newName}
              onChangeText={setNewName}
              autoFocus
              placeholder="Group name"
              placeholderTextColor={c.textSecondary}
            />
            <Pressable style={s.renameSave} onPress={rename} disabled={busy}>
              <Text style={s.renameSaveText}>Save</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [s.primary, pressed ? s.primaryPressed : null]}
            onPress={invite}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.primaryText}>Invite someone</Text>
            )}
          </Pressable>
        )}

        <View style={s.grid}>
          <Tile
            icon="history"
            label="Group history"
            c={c}
            onPress={() => {
              onClose()
              router.push({ pathname: "/(v2)/history", params: { groupId: group.id } })
            }}
          />
          <Tile
            icon="bell-off-outline"
            label="Mute"
            c={c}
            right={
              <Switch
                value={muted}
                // Turning it ON explains itself first: this changes WHEN you hear
                // from the group, not just whether. Turning it OFF restores the
                // default and needs no dialog.
                onValueChange={(next) => {
                  haptics.tap()
                  if (next) setExplainMute(true)
                  else void applyMute(false)
                }}
                trackColor={{ true: c.green, false: c.textSecondary }}
              />
            }
          />
        </View>

        {/* Without Rename, a half-width Leave sat beside dead space. On its own it
            takes the full row instead of leaving a gap. */}
        <View style={s.grid}>
          {group.is_admin ? (
            <>
              <Tile icon="pencil-outline" label="Rename group" c={c} onPress={() => setRenaming(true)} />
              <Tile icon="exit-to-app" label="Leave group" c={c} danger onPress={leave} />
            </>
          ) : (
            <Tile icon="exit-to-app" label="Leave group" c={c} danger centered onPress={leave} />
          )}
        </View>
      </View>

      <InviteSheet
        visible={showInvite}
        groupId={group.id}
        groupName={group.name}
        userId={userId}
        onClose={() => setShowInvite(false)}
      />

      {/* Muting is not "no notifications" — it swaps a live stream for one summary
          a day. Said before it happens, because a toggle labelled "Mute" that
          still sends you something in the evening would otherwise read as broken. */}
      <Modal visible={explainMute} transparent animationType="fade" onRequestClose={() => setExplainMute(false)}>
        <Pressable style={s.backdrop} onPress={() => setExplainMute(false)} />
        <View style={s.explainCard}>
          <Text style={s.explainTitle}>Mute {group.name}?</Text>
          <Text style={s.explainBody}>
            You&rsquo;ll stop getting notifications as things happen — answers, messages and
            reactions.
          </Text>
          <Text style={s.explainBody}>
            Instead you&rsquo;ll get one summary at 7pm on days there was activity, like
            &ldquo;3 answers, 8 messages&rdquo;. Quiet days stay quiet.
          </Text>
          <Text style={s.explainNote}>
            Today&rsquo;s question still arrives as normal. You can turn this off any time.
          </Text>

          <Pressable
            onPress={() => {
              haptics.commit()
              setExplainMute(false)
              void applyMute(true)
            }}
            style={({ pressed }) => [s.primary, pressed ? s.primaryPressed : null]}
          >
            <Text style={s.primaryText}>Mute this group</Text>
          </Pressable>
          <Pressable onPress={() => setExplainMute(false)} style={s.explainCancel} hitSlop={8}>
            <Text style={s.explainCancelText}>Keep notifications on</Text>
          </Pressable>
        </View>
      </Modal>
    </Modal>
  )
}

function Tile({
  icon,
  label,
  onPress,
  right,
  danger,
  centered,
  c,
}: {
  icon: string
  label: string
  onPress?: () => void
  right?: React.ReactNode
  danger?: boolean
  /** Fills the row and centres its contents when it is the only tile present. */
  centered?: boolean
  c: ReturnType<typeof useV2Colors>["c"]
}) {
  const s = makeStyles(c)
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        s.tile,
        centered ? { justifyContent: "center" } : null,
        pressed && onPress ? { transform: [{ translateY: 2 }] } : null,
      ]}
    >
      <MaterialCommunityIcons name={icon as any} size={18} color={danger ? c.red : c.text} />
      {/* flex:0 when centred — tileText's flex:1 fills the row, leaving
          justifyContent no free space to centre with. */}
      <Text
        style={[s.tileText, centered ? { flex: 0 } : null, danger ? { color: c.red } : null]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {right}
    </Pressable>
  )
}

function makeStyles(c: ReturnType<typeof useV2Colors>["c"]) {
  return StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
    sheet: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: c.bg,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      borderWidth: 2,
      borderColor: c.border,
      padding: sp.lg,
      paddingBottom: sp.xxl,
      gap: sp.md,
    },
    handle: {
      alignSelf: "center",
      width: 44,
      height: 5,
      borderRadius: 3,
      backgroundColor: c.textSecondary,
      opacity: 0.4,
      marginBottom: sp.sm,
    },
    titleRow: { flexDirection: "row", alignItems: "center" },
    title: { flex: 1, fontSize: 24, fontWeight: "800", color: c.text, letterSpacing: -0.5 },
    close: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    closeText: { color: c.text, fontWeight: "800" },
    meta: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.6,
      color: c.textSecondary,
      marginTop: -sp.sm,
    },
    membersRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: sp.md,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 14,
      padding: sp.md,
    },
    memberNames: { flex: 1, color: c.text, fontWeight: "600" },
    primary: {
      backgroundColor: c.pink,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 26,
      paddingVertical: 15,
      alignItems: "center",
      // Same hard-offset bevel as every other primary CTA. shadowRadius 0 is what
      // makes it a solid block rather than a blur.
      shadowColor: c.border,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 4,
    },
    primaryPressed: {
      transform: [{ translateY: 4 }],
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      elevation: 0,
    },
    primaryText: { color: "#fff", fontWeight: "800", fontSize: 16 },
    explainCard: {
      position: "absolute",
      left: sp.lg,
      right: sp.lg,
      top: "26%",
      backgroundColor: c.bg,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 18,
      padding: sp.xl,
      gap: sp.sm,
    },
    explainTitle: { fontSize: 20, fontWeight: "800", color: c.text, marginBottom: 2 },
    explainBody: { fontSize: 15, color: c.text, lineHeight: 21 },
    explainNote: {
      fontSize: 13,
      color: c.textSecondary,
      lineHeight: 19,
      marginTop: 2,
      marginBottom: sp.sm,
    },
    explainCancel: { alignSelf: "center", marginTop: sp.md },
    explainCancelText: { color: c.textSecondary, fontWeight: "700", fontSize: 15 },
    grid: { flexDirection: "row", gap: sp.md },
    tile: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: sp.sm,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 14,
      paddingHorizontal: sp.md,
      paddingVertical: sp.md,
    },
    tileText: { flex: 1, fontWeight: "700", color: c.text, fontSize: 14 },
    renameRow: { flexDirection: "row", gap: sp.sm },
    renameInput: {
      flex: 1,
      backgroundColor: c.surfaceAlt,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 14,
      padding: sp.md,
      color: c.text,
      fontSize: 16,
    },
    renameSave: {
      backgroundColor: c.green,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 14,
      paddingHorizontal: sp.lg,
      justifyContent: "center",
    },
    renameSaveText: { color: "#fff", fontWeight: "800" },
  })
}
