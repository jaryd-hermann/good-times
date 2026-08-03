import { View, Text, Image, StyleSheet } from "react-native"
import { useV2Colors, v2Spacing as sp } from "../../lib/v2/theme"
import type { PreviewPerson } from "../../lib/v2/types"

const THUMB = 52

/**
 * Photo-journal preview: one small fanned stack per person.
 *
 * A flat strip of everyone's photos side by side hid WHO posted what, and one
 * heavy uploader could fill the whole row. Fanning per person keeps each
 * contributor visible at a glance and caps them at three.
 */
export function PreviewFans({ people }: { people: PreviewPerson[] }) {
  const { c } = useV2Colors()
  const s = makeStyles(c)
  if (!people?.length) return null

  return (
    <View style={s.row}>
      {people.slice(0, 4).map((p) => {
        const urls = (p.urls ?? []).slice(0, 3)
        // Fan width: first card full, each extra peeking out.
        const width = THUMB + (urls.length - 1) * 14
        return (
          <View key={p.user_id} style={s.person}>
            <View style={[s.fan, { width }]}>
              {urls.map((u, i) => (
                <Image
                  key={`${u}-${i}`}
                  source={{ uri: u }}
                  style={[
                    s.thumb,
                    {
                      left: i * 14,
                      // back cards tilt and sit slightly lower, front card is straight
                      transform: [{ rotate: `${(i - (urls.length - 1)) * 5}deg` }],
                      zIndex: i,
                    },
                  ]}
                />
              ))}
              {p.total > 3 ? (
                <View style={s.moreBadge}>
                  <Text style={s.moreText}>+{p.total - 3}</Text>
                </View>
              ) : null}
            </View>
            <Text style={s.name} numberOfLines={1}>
              {p.name?.split(" ")[0]}
            </Text>
          </View>
        )
      })}
      {people.length > 4 ? (
        <Text style={s.overflowText}>+{people.length - 4} more</Text>
      ) : null}
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useV2Colors>["c"]) {
  return StyleSheet.create({
    row: { flexDirection: "row", alignItems: "flex-start", gap: sp.md, marginTop: sp.sm },
    person: { alignItems: "center", gap: 4 },
    fan: { height: THUMB + 6 },
    thumb: {
      position: "absolute",
      top: 0,
      width: THUMB,
      height: THUMB,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: c.surfaceAlt,
      backgroundColor: c.surface,
    },
    moreBadge: {
      position: "absolute",
      right: -6,
      bottom: -2,
      backgroundColor: c.ink,
      borderRadius: 9,
      paddingHorizontal: 5,
      paddingVertical: 1,
      zIndex: 10,
    },
    moreText: { color: c.bg, fontSize: 10, fontWeight: "800" },
    name: { fontSize: 10, fontWeight: "700", color: c.textSecondary, maxWidth: THUMB + 16 },
    overflowText: { fontSize: 11, color: c.textSecondary, alignSelf: "center", fontWeight: "600" },
  })
}
