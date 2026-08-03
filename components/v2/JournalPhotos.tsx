import { useMemo, useRef } from "react"
import { View, Text, Image, StyleSheet, Pressable, TextInput } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useV2Colors, v2Spacing as sp } from "../../lib/v2/theme"
import * as haptics from "../../lib/v2/haptics"

export type JournalPhoto = { uri: string; day?: string | null }

/**
 * The Sunday weekly photo journal composer.
 *
 * This prompt is not a question, so the Talking head / Voice note / Write it fork
 * doesn't apply — it was being routed there anyway, which is the bug this fixes.
 * It is photo-first, exactly as it worked in v1: pick the week's photos from the
 * gallery, then caption each one.
 *
 * Captions sit directly under their photo rather than behind a full-screen pager
 * (v1's MediaCaptions). With a whole week of photos, seeing which ones are still
 * uncaptioned should not require paging through them one at a time.
 */
export function JournalPhotos({
  photos,
  captions,
  onAdd,
  onRemove,
  onCaption,
  onFocusRow,
}: {
  photos: JournalPhoto[]
  captions: (string | null)[]
  onAdd: () => void
  onRemove: (index: number) => void
  onCaption: (index: number, text: string) => void
  /** y-offset of the row being edited, so the parent can scroll it clear of the keyboard. */
  onFocusRow?: (y: number) => void
}) {
  const { c } = useV2Colors()
  const s = useMemo(() => makeStyles(c), [c])
  const inputs = useRef<Record<number, TextInput | null>>({})
  const rowTops = useRef<Record<number, number>>({})

  if (photos.length === 0) {
    return (
      <Pressable
        onPress={() => {
          haptics.tap()
          onAdd()
        }}
        style={({ pressed }) => [s.empty, pressed ? { transform: [{ translateY: 2 }] } : null]}
      >
        <FanPlaceholder />
        <Text style={s.emptyTitle}>Add this week&rsquo;s photos</Text>
        <Text style={s.emptySub}>
          Pick as many as you like from your gallery, then say what each one was.
        </Text>
      </Pressable>
    )
  }

  return (
    <View>
      {photos.map((p, i) => (
        <View
          key={`${p.uri}-${i}`}
          style={s.row}
          onLayout={(e) => {
            rowTops.current[i] = e.nativeEvent.layout.y
          }}
        >
          {/* Tapping the photo starts captioning it. Making the image itself the
              target means the obvious gesture works, rather than requiring a
              precise hit on the thin input below. */}
          <Pressable style={s.imageWrap} onPress={() => inputs.current[i]?.focus()}>
            <Image source={{ uri: p.uri }} style={s.image} resizeMode="cover" />
            <Pressable
              onPress={() => {
                haptics.tap()
                onRemove(i)
              }}
              hitSlop={8}
              style={s.remove}
            >
              <MaterialCommunityIcons name="close" size={15} color="#fff" />
            </Pressable>
            {/* The day this photo was taken beats a position number — the point of
                a weekly journal is which day it was, not which slot it sits in. */}
            {p.day ? (
              <View style={s.dayTag}>
                <Text style={s.dayTagText}>{p.day}</Text>
              </View>
            ) : null}
          </Pressable>

          <TextInput
            ref={(r) => {
              inputs.current[i] = r
            }}
            style={s.caption}
            value={captions[i] ?? ""}
            onChangeText={(t) => onCaption(i, t)}
            // Report where this row sits so the parent can lift it above the
            // keyboard — otherwise a photo near the bottom types out of sight.
            onFocus={() => onFocusRow?.(rowTops.current[i] ?? 0)}
            placeholder="What was this?"
            placeholderTextColor={c.textSecondary}
            multiline
          />
        </View>
      ))}

      <Pressable
        onPress={() => {
          haptics.tap()
          onAdd()
        }}
        style={({ pressed }) => [s.addMore, pressed ? { transform: [{ translateY: 2 }] } : null]}
      >
        <MaterialCommunityIcons name="plus" size={18} color={c.text} />
        <Text style={s.addMoreText}>Add more photos</Text>
      </Pressable>
    </View>
  )
}

/**
 * Fanned, day-labelled cards standing in for the gallery.
 *
 * A single generic image glyph said "attach a file"; this says "a week of photos",
 * which is the thing being asked for.
 */
function FanPlaceholder() {
  const { c } = useV2Colors()
  const s = useMemo(() => makeStyles(c), [c])
  const cards = [
    { day: "Mon", rotate: "-12deg", left: 0 },
    { day: "Tue", rotate: "0deg", left: 58 },
    { day: "Wed", rotate: "12deg", left: 116 },
  ]
  return (
    <View style={s.fan}>
      {cards.map((card, i) => (
        <View
          key={card.day}
          style={[
            s.fanCard,
            { left: card.left, transform: [{ rotate: card.rotate }], zIndex: i },
          ]}
        >
          <MaterialCommunityIcons name="image-outline" size={22} color={c.textSecondary} />
          <Text style={s.fanDay}>{card.day}</Text>
        </View>
      ))}
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useV2Colors>["c"]) {
  return StyleSheet.create({
    empty: {
      alignItems: "center",
      gap: 6,
      borderWidth: 2,
      borderStyle: "dashed",
      borderColor: c.border,
      borderRadius: 16,
      paddingVertical: sp.xl,
      paddingHorizontal: sp.lg,
    },
    emptyTitle: { fontSize: 17, fontWeight: "800", color: c.text, marginTop: sp.md },
    emptySub: { fontSize: 13, color: c.textSecondary, textAlign: "center", lineHeight: 19 },

    fan: { width: 174, height: 84, alignSelf: "center" },
    fanCard: {
      position: "absolute",
      top: 0,
      width: 58,
      height: 76,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: c.border,
      backgroundColor: c.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
    },
    fanDay: { fontSize: 10, fontWeight: "800", color: c.textSecondary },

    row: {
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 14,
      padding: sp.sm,
      marginBottom: sp.md,
    },
    // Square, matching the answer-card carousel — a photo should not reframe
    // itself between composing and posting.
    imageWrap: { position: "relative", borderRadius: 10, overflow: "hidden", aspectRatio: 1 },
    image: { width: "100%", height: "100%", backgroundColor: c.surfaceAlt },
    remove: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: "rgba(0,0,0,0.6)",
      alignItems: "center",
      justifyContent: "center",
    },
    dayTag: {
      position: "absolute",
      top: 8,
      left: 8,
      backgroundColor: c.accent,
      borderWidth: 2,
      borderColor: "#000000",
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    dayTagText: { color: "#000000", fontSize: 12, fontWeight: "800", letterSpacing: 0.3 },
    caption: {
      color: c.text,
      fontSize: 15,
      lineHeight: 20,
      paddingHorizontal: sp.sm,
      paddingTop: sp.sm,
      paddingBottom: 4,
      minHeight: 40,
    },

    addMore: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderWidth: 2,
      borderStyle: "dashed",
      borderColor: c.border,
      borderRadius: 14,
      paddingVertical: sp.md,
    },
    addMoreText: { fontSize: 15, fontWeight: "800", color: c.text },
  })
}
