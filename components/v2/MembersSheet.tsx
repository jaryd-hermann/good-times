import { useEffect, useState } from "react"
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, ActivityIndicator } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { Avatar } from "../Avatar"
import { supabase } from "../../lib/supabase"
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
  currentUserId?: string
  onClose: () => void
}) {
  const { c } = useV2Colors()
  const s = makeStyles(c)
  const [members, setMembers] = useState<Member[] | null>(null)

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
      </View>
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
