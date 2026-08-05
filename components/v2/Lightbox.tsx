import { useState } from "react"
import {
  View,
  Text,
  Image,
  Modal,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { InlineVideo } from "./InlineVideo"
import type { MediaType } from "../../lib/v2/types"

/**
 * Full-screen media viewer.
 *
 * Deliberately not v1's MediaViewer — that renders inline inside a feed card and
 * has no modal or dismiss affordance. Here the point is to escape the card, so
 * this is a plain black overlay: tap anywhere or hit ✕ to leave.
 */
export function Lightbox({
  urls,
  types,
  captions,
  startIndex = 0,
  startPositionMillis = 0,
  onClose,
}: {
  urls: string[]
  types?: MediaType[] | null
  captions?: (string | null)[] | null
  startIndex?: number
  /** Resume point handed over by the inline player, so expanding continues. */
  startPositionMillis?: number
  onClose: () => void
}) {
  const win = useWindowDimensions()
  const [index, setIndex] = useState(startIndex)

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <Pressable style={s.close} onPress={onClose} hitSlop={12}>
          <MaterialCommunityIcons name="close" size={26} color="#fff" />
        </Pressable>

        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: startIndex * win.width, y: 0 }}
          onMomentumScrollEnd={(e) =>
            setIndex(Math.round(e.nativeEvent.contentOffset.x / win.width))
          }
        >
          {urls.map((url, i) => (
            // Each page centres its own content — the ScrollView alone left media
            // pinned to the top of the screen.
            <View key={`${url}-${i}`} style={[s.page, { width: win.width }]}>
              {types?.[i] === "video" ? (
                // Same component as the card, so full screen has the same
                // controls: mute, duration, progress, restart.
                <InlineVideo
                  uri={url}
                  width={win.width}
                  height={win.height * 0.72}
                  autoPlay
                  // Only the page we opened on resumes; the rest start at 0.
                  startPositionMillis={i === startIndex ? startPositionMillis : 0}
                />
              ) : (
                <Pressable onPress={onClose}>
                  <Image
                    source={{ uri: url }}
                    style={{ width: win.width, height: win.height * 0.72 }}
                    resizeMode="contain"
                  />
                </Pressable>
              )}
            </View>
          ))}
        </ScrollView>

        <View style={s.footer} pointerEvents="none">
          {captions?.[index] ? <Text style={s.caption}>{captions[index]}</Text> : null}
          {urls.length > 1 ? (
            <Text style={s.counter}>
              {index + 1} of {urls.length}
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.94)", justifyContent: "center" },
  page: { alignItems: "center", justifyContent: "center" },
  close: { position: "absolute", top: 56, right: 20, zIndex: 10 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 46, alignItems: "center", gap: 6 },
  caption: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    paddingHorizontal: 24,
  },
  counter: { color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: "700" },
})
