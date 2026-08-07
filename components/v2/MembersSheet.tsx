import { useEffect, useState } from "react"
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, ActivityIndicator } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { Avatar } from "../Avatar"
import { InviteSheet } from "./InviteSheet"
import { supabase } from "../../lib/supabase"
import * as haptics from "../../lib/v2/haptics"
import { useV2Colors, v2Spacing as sp } from "../../lib/v2/theme"

type Member = { id: string; name: string | null; avatar_url: string | null; birthday: string | null }

/** "14 March" — year omitted deliberately; the group needs the day, not the age. */
function formatBirthday(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso + "T00:00:00")
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString([], { day: "numeric", month: "long" })
}

/**
 * Who is in this group — opened by tapping the faces in the thread header.
 *
 * Fetches its own rows rather than reusing the thread's `group.members`, because
 * that payload is the Author shape (id/name/avatar) and carries no birthday. One
 * query on open is cheaper than widening the thread RPC for a panel most people
 * will never open.
 */
export function MembersSheet({
  visible,
  groupId,
  groupName,
  currentUserId,
  onClose,
}: {
  visible: boolean
  groupId: string
  groupName: string
  /** Also the inviter for the nested InviteSheet. */
  currentUserId?: string
  onClose: () => void
}) {
  const { c } = useV2Colors()
  const s = makeStyles(c)
  const [members, setMembers] = useState<Member[] | null>(null)
  const [showInvite, setShowInvite] = useState(false)

  useEffect(() => {
    if (!visible || !groupId) return
    let cancelled = false
    setMembers(null)
    ;(async () => {
      const { data } = await supabase
        .from("group_members")
        .select("users ( id, name, avatar_url, birthday )")
        .eq("group_id", groupId)
      if (cancelled) return
      const rows = ((data ?? []) as { users: Member | null }[])
        .map((r) => r.users)
        .filter((u): u is Member => !!u)
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
      setMembers(rows)
    })()
    return () => {
      cancelled = true
    }
  }, [visible, groupId])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.header}>
          <Text style={s.title} numberOfLines={1}>
            {groupName}
          </Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <MaterialCommunityIcons name="close" size={22} color={c.text} />
          </Pressable>
        </View>
        <Text style={s.count}>
          {members ? `${members.length} ${members.length === 1 ? "member" : "members"}` : " "}
        </Text>

        {!members ? (
          <ActivityIndicator color={c.text} style={{ marginVertical: sp.xl }} />
        ) : (
          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            {members.map((m) => {
              const bday = formatBirthday(m.birthday)
              return (
                <View key={m.id} style={s.row}>
                  <Avatar
                    uri={m.avatar_url ?? undefined}
                    name={m.name}
                    size={40}
                    borderColor={c.border}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={s.name} numberOfLines={1}>
                      {m.name ?? "Someone"}
                      {m.id === currentUserId ? " (you)" : ""}
                    </Text>
                    {/* No birthday is a normal state — it is optional at signup —
                        so say nothing rather than showing an empty field. */}
                    {bday ? <Text style={s.bday}>{bday}</Text> : null}
                  </View>
                </View>
              )
            })}
          </ScrollView>
        )}

        {/* Bottom of the roster is exactly where "who's here" turns into "who's
            missing", so the invite lives here rather than only in the header. */}
        <Pressable
          onPress={() => {
            haptics.tap()
            setShowInvite(true)
          }}
          style={({ pressed }) => [s.ctaShadow, pressed ? s.ctaPressed : null]}
          accessibilityLabel={`Invite someone to ${groupName}`}
        >
          <View style={s.cta}>
            <MaterialCommunityIcons name="account-plus-outline" size={19} color="#fff" />
            <Text style={s.ctaText}>Invite someone</Text>
          </View>
        </Pressable>
      </View>

      {/* Nested inside this Modal, matching GroupSheet: closing the invite
          returns you to the roster you opened it from instead of dumping you
          back in the thread. */}
      <InviteSheet
        visible={showInvite}
        groupId={groupId}
        groupName={groupName}
        userId={currentUserId}
        onClose={() => setShowInvite(false)}
      />
    </Modal>
  )
}

function makeStyles(c: ReturnType<typeof useV2Colors>["c"]) {
  return StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
    sheet: {
      position: "absolute",
      left: sp.lg,
      right: sp.lg,
      top: "18%",
      backgroundColor: c.bg,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 18,
      padding: sp.lg,
    },
    header: { flexDirection: "row", alignItems: "center", gap: sp.md },
    title: { flex: 1, fontSize: 19, fontWeight: "800", color: c.text },

    /**
     * The same hard-edged bevel as the Invite and Answer CTAs: a zero-radius
     * shadow offset straight down, and a press that translates the button INTO
     * that offset so the block visibly depresses. shadowRadius must stay 0 —
     * any blur turns it into a soft drop shadow and the 3D read is gone.
     */
    ctaShadow: {
      marginTop: sp.md,
      borderRadius: 28,
      shadowColor: c.border,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 5,
    },
    ctaPressed: {
      transform: [{ translateY: 5 }],
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      elevation: 0,
    },
    cta: {
      flexDirection: "row",
      gap: 8,
      backgroundColor: c.pink,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 28,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 52,
      overflow: "hidden",
    },
    ctaText: { color: "#fff", fontWeight: "800", fontSize: 16 },
    count: {
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: c.textSecondary,
      marginTop: 2,
      marginBottom: sp.md,
    },
    row: { flexDirection: "row", alignItems: "center", gap: sp.md, paddingVertical: sp.sm },
    name: { fontSize: 16, fontWeight: "700", color: c.text },
    bday: { fontSize: 13, color: c.textSecondary, marginTop: 1 },
  })
}
