import { useState } from "react"
import { View, Text, Image, StyleSheet, Pressable, ScrollView, useWindowDimensions } from "react-native"
import { useV2Colors, v2Spacing as sp } from "../../lib/v2/theme"
import { AudioPlayer } from "./AudioPlayer"
import { Lightbox } from "./Lightbox"
import { InlineVideo } from "./InlineVideo"
import type { MediaType } from "../../lib/v2/types"

/**
 * Swipeable media with dot indicators, an "n of N" counter and a per-photo
 * caption overlay (design 4A). Captions come from the existing `captions[]`
 * array, which is parallel to `media_urls`.
 */
export function MediaCarousel({
  urls,
  types,
  captions,
  days,
  width,
}: {
  urls: string[]
  types?: MediaType[] | null
  captions?: (string | null)[] | null
  /** Weekday tag per item, parallel to urls. */
  days?: (string | null)[] | null
  width?: number
}) {
  const { c } = useV2Colors()
  const win = useWindowDimensions()
  const [index, setIndex] = useState(0)
  const [lightbox, setLightbox] = useState<number | null>(null)
  const w = width ?? win.width - sp.lg * 2 - sp.md * 2 - 4
  // Square, matching the journal composer. A photo must not reframe itself
  // between composing and appearing in the thread.
  const h = w

  if (!urls?.length) return null

  /**
   * Audio is split out and stacked ABOVE the pager.
   *
   * It used to be a page inside the horizontal ScrollView, sized "100%" — which in
   * an unbounded horizontal content area resolved to no constraint at all, so the
   * player's container grew endlessly down the screen. A player is also not
   * something you swipe between; it wants the full width and its own row.
   */
  const audio = urls
    .map((url, i) => ({ url, i }))
    .filter(({ i }) => types?.[i] === "audio")
  const visual = urls
    .map((url, i) => ({ url, i }))
    .filter(({ i }) => types?.[i] !== "audio")
  const many = visual.length > 1

  /**
   * A plain function returning JSX, NOT a component.
   *
   * This was `const Tile = ({ url, i }) => …` declared in the render body, which
   * creates a NEW component type on every render. React cannot reconcile a changed
   * type, so it unmounted and remounted the whole tile — the <Image> was destroyed
   * and reloaded from scratch. Swiping calls setIndex from onMomentumScrollEnd,
   * which re-rendered and blanked every image: the white flash roughly half a
   * second after each swipe settled, exactly when momentum ended.
   *
   * Returning elements directly leaves no component boundary to remount; React
   * reconciles by position and key, and the images stay mounted.
   */
  const renderTile = (url: string, i: number) => {
    const caption = captions?.[i]
    const day = days?.[i]
    const isVideo = types?.[i] === "video"
    return (
      <Pressable
        key={`${url}-${i}`}
        style={{ width: w, height: h, marginRight: sp.sm }}
        // Video owns its taps (play/pause) and offers an expand control instead.
        // Leaving this handler on would swallow the play tap and jump to the
        // lightbox on every touch.
        onPress={isVideo ? undefined : () => setLightbox(i)}
      >
        <View style={[styles.frame, { height: h, borderColor: c.border, backgroundColor: c.surfaceAlt }]}>
          {/* Video needs a player, not an <Image>: feeding an mp4 to Image is what
              rendered an empty card with a play badge over nothing. */}
          {isVideo ? (
            <InlineVideo uri={url} width={w} height={h} onExpand={() => setLightbox(i)} />
          ) : (
            <Image
              source={{ uri: url }}
              style={styles.image}
              resizeMode="cover"
              // Android fades new images in by default, which reads as a flicker
              // inside a pager the user is actively swiping.
              fadeDuration={0}
            />
          )}
          {day ? (
            <View style={[styles.dayTag, { backgroundColor: c.accent }]}>
              <Text style={styles.dayTagText}>{day}</Text>
            </View>
          ) : null}
          {caption ? (
            <View style={styles.captionWrap}>
              <Text style={styles.caption} numberOfLines={2}>
                {caption}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    )
  }

  return (
    <View style={{ marginBottom: sp.sm }}>
      {audio.map(({ url, i }) => (
        <View key={`audio-${url}-${i}`}>
          <AudioPlayer uri={url} />
          {captions?.[i] ? (
            <Text style={[styles.caption, { color: c.textSecondary, marginBottom: sp.sm }]} numberOfLines={2}>
              {captions[i]}
            </Text>
          ) : null}
        </View>
      ))}

      {visual.length === 0 ? null : visual.length === 1 ? (
        /* One photo needs no pager. Dropping the ScrollView here removes the
           cross-axis stretch that was inflating chat bubbles to full height. */
        renderTile(visual[0].url, visual[0].i)
      ) : (
        <>
          {/* Height lives on this wrapper, not on the ScrollView. Setting it on the
              scroller left it free to stretch on the cross axis, which is what kept
              inflating multi-photo bubbles to full screen height. */}
          <View style={{ height: h }}>
          <ScrollView
            horizontal
            contentContainerStyle={{ alignItems: "flex-start" }}
            showsHorizontalScrollIndicator={false}
            // snapToInterval must equal the FULL item pitch (width + gap). With
            // pagingEnabled the page was the viewport width while items were
            // width+gap, so every swipe drifted a little further out of alignment.
            snapToInterval={w + sp.sm}
            snapToAlignment="start"
            decelerationRate="fast"
            disableIntervalMomentum
            onMomentumScrollEnd={(e) =>
              setIndex(Math.round(e.nativeEvent.contentOffset.x / (w + sp.sm)))
            }
          >
            {visual.map(({ url, i }) => renderTile(url, i))}
          </ScrollView>
          </View>

          <View style={styles.indicatorRow}>
            <View style={styles.dots}>
              {visual.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: i === index ? c.red : c.border,
                      opacity: i === index ? 1 : 0.3,
                      width: i === index ? 16 : 6,
                    },
                  ]}
                />
              ))}
            </View>
            <Text style={[styles.counter, { color: c.textSecondary }]}>
              {index + 1} of {visual.length}
            </Text>
          </View>
        </>
      )}

      {lightbox !== null ? (
        <Lightbox
          urls={visual.map((v) => v.url)}
          types={visual.map((v) => types?.[v.i] ?? "photo")}
          captions={visual.map((v) => captions?.[v.i] ?? null)}
          startIndex={visual.findIndex((v) => v.i === lightbox)}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { borderWidth: 1.5, borderRadius: 10, overflow: "hidden", justifyContent: "flex-end" },
  image: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  playBadge: {
    position: "absolute",
    alignSelf: "center",
    top: "40%",
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  playGlyph: { color: "#fff", fontSize: 20, marginLeft: 3 },
  dayTag: {
    position: "absolute",
    top: 8,
    left: 8,
    borderWidth: 2,
    borderColor: "#000000",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  dayTagText: { color: "#000000", fontSize: 12, fontWeight: "800", letterSpacing: 0.3 },
  captionWrap: {
    backgroundColor: "rgba(0,0,0,0.72)",
    alignSelf: "flex-start",
    margin: sp.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    maxWidth: "85%",
  },
  caption: { color: "#fff", fontSize: 12, fontWeight: "600" },
  indicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  dots: { flexDirection: "row", gap: 4, alignItems: "center" },
  dot: { height: 6, borderRadius: 3 },
  counter: { fontSize: 12, fontWeight: "600" },
})
