import { Modal, View, Text, StyleSheet, TouchableOpacity } from "react-native"
import { useV2Colors, v2Spacing as sp } from "../../lib/v2/theme"
import { Avatar } from "../Avatar"
import { Confetti } from "./Confetti"
import type { Author } from "../../lib/v2/types"

/**
 * "Thomas is in!" — shown once when you open a group chat and find that someone
 * joined it since you last looked.
 *
 * Someone new arriving is one of the few genuinely good moments in a group app,
 * and it used to pass by as a push notification you may well have missed. This
 * makes it something you walk into.
 *
 * Deliberately a tap-to-dismiss modal with no action: it is a moment, not a
 * decision. The same people also appear inline in the thread at the point they
 * joined, so nothing here is the only record of it.
 */
export function JoinCelebration({
  people,
  onClose,
}: {
  people: Author[]
  onClose: () => void
}) {
  const { c } = useV2Colors()
  const s = makeStyles(c)
  if (people.length === 0) return null

  const names = people.map((p) => p.name?.trim() || "Someone")
  // "Thomas", "Thomas and Ben", "Thomas, Ben and 2 others" — the plural forms
  // matter here because a bare join of names reads badly past two.
  const label =
    names.length === 1
      ? names[0]
      : names.length === 2
        ? `${names[0]} and ${names[1]}`
        : `${names.slice(0, 2).join(", ")} and ${names.length - 2} other${
            names.length - 2 === 1 ? "" : "s"
          }`

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={s.card}>
          <View style={s.faces}>
            {people.slice(0, 4).map((p, i) => (
              <View key={p.id ?? i} style={i > 0 ? s.overlap : null}>
                <Avatar
                  uri={p.avatar_url ?? undefined}
                  name={p.name ?? "?"}
                  size={64}
                  borderColor={c.border}
                />
              </View>
            ))}
          </View>

          <Text style={s.title}>
            {label} {names.length === 1 ? "is" : "are"} in!
          </Text>
          <Text style={s.sub}>
            {names.length === 1 ? "Say hi" : "Say hi to everyone"} in the group
          </Text>

          <View style={s.btn}>
            <Text style={s.btnText}>Nice</Text>
          </View>
        </View>
      </TouchableOpacity>
      {/* Above the card so pieces fall in front of it; pointerEvents="none"
          inside Confetti keeps the tap-to-dismiss working through it. */}
      <Confetti />
    </Modal>
  )
}

function makeStyles(c: ReturnType<typeof useV2Colors>["c"]) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      alignItems: "center",
      justifyContent: "center",
      padding: sp.xl,
    },
    card: {
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 20,
      paddingVertical: sp.xl,
      paddingHorizontal: sp.xl,
      alignItems: "center",
      width: "100%",
      maxWidth: 340,
    },
    faces: { flexDirection: "row", marginBottom: sp.lg },
    overlap: { marginLeft: -18 },
    title: {
      fontSize: 22,
      fontWeight: "800",
      color: c.text,
      textAlign: "center",
    },
    sub: {
      fontSize: 14,
      color: c.textSecondary,
      marginTop: 6,
      textAlign: "center",
    },
    btn: {
      marginTop: sp.lg,
      backgroundColor: c.pink,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 999,
      paddingHorizontal: sp.xl,
      paddingVertical: sp.sm,
    },
    btnText: { fontWeight: "800", color: "#fff", fontSize: 15 },
  })
}
