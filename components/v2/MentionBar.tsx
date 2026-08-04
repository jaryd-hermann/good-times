import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native"
import { Avatar } from "../Avatar"
import { useV2Colors, v2Spacing as sp } from "../../lib/v2/theme"
import type { Author } from "../../lib/v2/types"

/**
 * Member picker that sits directly above the composer while typing "@".
 *
 * Horizontal rather than a vertical list: it has to appear between the thread and
 * the keyboard, where there is one row of height available and no more. Faces
 * make it scannable at that size in a way names alone would not.
 */
export function MentionBar({
  members,
  onPick,
}: {
  members: Author[]
  onPick: (m: Author) => void
}) {
  const { c } = useV2Colors()
  const s = makeStyles(c)

  if (members.length === 0) return null

  return (
    <View style={s.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={s.row}
      >
        {members.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => onPick(m)}
            style={({ pressed }) => [s.chip, pressed ? s.chipPressed : null]}
          >
            <Avatar uri={m.avatar_url ?? undefined} name={m.name} size={24} />
            <Text style={s.name} numberOfLines={1}>
              {m.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useV2Colors>["c"]) {
  return StyleSheet.create({
    wrap: {
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.surface,
      paddingVertical: sp.sm,
    },
    row: { paddingHorizontal: sp.md, gap: sp.sm, alignItems: "center" },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      backgroundColor: c.surfaceAlt,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 999,
      paddingLeft: 4,
      paddingRight: sp.md,
      paddingVertical: 4,
      maxWidth: 200,
    },
    chipPressed: { transform: [{ translateY: 1 }], opacity: 0.85 },
    name: { fontSize: 14, fontWeight: "700", color: c.text, flexShrink: 1 },
  })
}
