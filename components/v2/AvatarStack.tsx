import { View, Text, Image, StyleSheet } from "react-native"
import { useV2Colors } from "../../lib/v2/theme"
import type { Author } from "../../lib/v2/types"

const RING = ["#3A5F8C", "#2F6B4F", "#E5A13C", "#B23B3B", "#D9788F"]

function initial(name: string | null) {
  return (name?.trim()?.[0] ?? "?").toUpperCase()
}

export function AvatarStack({
  members,
  size = 32,
  max = 3,
}: {
  members: Author[]
  size?: number
  max?: number
}) {
  const { c } = useV2Colors()
  const shown = members.slice(0, max)

  return (
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
              zIndex: max - i,
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
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  avatar: { alignItems: "center", justifyContent: "center", borderWidth: 2, overflow: "hidden" },
  initial: { color: "#fff", fontWeight: "700" },
})
