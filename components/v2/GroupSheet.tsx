import { useState } from "react"
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
  const [muted, setMuted] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [newName, setNewName] = useState(group.name)
  const [busy, setBusy] = useState(false)
  const s = makeStyles(c)

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
              .map((m) => (m.id === userId ? `${m.name ?? "You"} (you)` : m.name ?? "Someone"))
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
                onValueChange={setMuted}
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
