import { View, Text, Image, StyleSheet, Pressable } from "react-native"
import { useV2Colors } from "../../lib/v2/theme"
import type { Author } from "../../lib/v2/types"

const RING = ["#3A5F8C", "#2F6B4F", "#E5A13C", "#B23B3B", "#D9788F"]

function initial(name: string | null) {
  return (name?.trim()?.[0] ?? "?").toUpperCase()
}

/**
 * Overlapping member faces.
 *
 * `max` used to truncate silently — a group of nine showed four faces and nothing
 * said the other five existed. `overflow` appends a "+N" disc so the cap reads as
 * a summary rather than as the whole group.
 *
 * Pass `max={members.length}` where the full set should show (the Today cards) and
 * a small `max` with `overflow` where space is tight (History, the thread header).
 */
export function AvatarStack({
  members,
  size = 32,
  max = 3,
  overflow = false,
  onPress,
}: {
  members: Author[]
  size?: number
  max?: number
  /** Append a "+N" disc for anyone beyond `max`. */
  overflow?: boolean
  /** Makes the whole stack tappable — used to open the member list. */
  onPress?: () => void
}) {
  const { c, isDark } = useV2Colors()
  const shown = members.slice(0, max)
  const remaining = members.length - shown.length

  const row = (
    <View style={styles.row}>
      {shown.map((m, i) => (
        <View
          key={m.id}
          style={[
            styles.avatar,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: RING[i % RING.length],
              borderColor: c.surface,
              marginLeft: i === 0 ? 0 : -size / 3,
              // Was `max - i`, so raising max pushed every face behind the next
              // one and the overlap stacked the wrong way round.
              zIndex: shown.length - i,
            },
          ]}
        >
          {m.avatar_url ? (
            <Image
              source={{ uri: m.avatar_url }}
              style={{ width: size, height: size, borderRadius: size / 2 }}
            />
          ) : (
            <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{initial(m.name)}</Text>
          )}
        </View>
      ))}

      {overflow && remaining > 0 ? (
        <View
          style={[
            styles.avatar,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              // Solid black in light mode, inverted in dark so it stays legible
              // against a near-black surface.
              backgroundColor: isDark ? "#FFFFFF" : "#000000",
              borderColor: c.surface,
              marginLeft: -size / 3,
              zIndex: 0,
            },
          ]}
        >
          <Text
            style={[styles.initial, { fontSize: size * 0.34, color: isDark ? "#000000" : "#FFFFFF" }]}
          >
            +{remaining}
          </Text>
        </View>
      ) : null}
    </View>
  )

  if (!onPress) return row
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      {row}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  avatar: { alignItems: "center", justifyContent: "center", borderWidth: 2, overflow: "hidden" },
  initial: { color: "#fff", fontWeight: "700" },
})
