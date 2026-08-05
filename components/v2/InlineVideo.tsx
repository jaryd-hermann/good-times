import { useRef, useState } from "react"
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native"
import { Video, ResizeMode, type AVPlaybackStatus } from "expo-av"
import { enterPlaybackMode } from "../../lib/v2/audio-session"
import { MaterialCommunityIcons } from "@expo/vector-icons"

function clock(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

/**
 * Video inside a message card, and inside the lightbox.
 *
 * MediaCarousel used to render every url through <Image>, so a video produced a
 * blank frame with a play badge floating on nothing. expo-av draws the first
 * frame as its own poster, which is the thumbnail — no separate asset needed.
 *
 * Sound is ON by default: this is a person talking to their group, not an
 * autoplaying feed video. Nothing plays until you tap.
 */
export function InlineVideo({
  uri,
  width,
  height,
  onExpand,
  autoPlay = false,
}: {
  uri: string
  width: number
  height: number
  onExpand?: () => void
  autoPlay?: boolean
}) {
  const ref = useRef<Video>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  /**
   * Whether playback ran to the end.
   *
   * playAsync() on a player already sitting at its final frame does nothing, so
   * once a clip finished the play button stopped working and it could not be
   * rewatched. The restart badge did not cover it either — it required
   * progress < 0.99, which is false precisely when the video has ended.
   */
  const [finished, setFinished] = useState(false)

  async function toggle() {
    if (!ref.current) return
    if (playing) {
      await ref.current.pauseAsync()
      return
    }
    // Claim the speaker rather than inheriting whatever the last recorder left.
    // A voice note leaves the session in PlayAndRecord, which routes output to
    // the earpiece — video then plays at a volume you can only hear by holding
    // the phone to your ear, and stays that way for the rest of the session.
    await enterPlaybackMode()
    if (finished) {
      await ref.current.setPositionAsync(0)
      setFinished(false)
    }
    await ref.current.playAsync()
  }

  async function restart() {
    if (!ref.current) return
    await enterPlaybackMode()
    await ref.current.setPositionAsync(0)
    setFinished(false)
    await ref.current.playAsync()
  }

  const progress = duration > 0 ? position / duration : 0
  // Offer restart whenever there is something to rewind past — including at the
  // very end, which the old progress < 0.99 test excluded.
  const midway = !playing && (finished || position > 1000)

  return (
    <Pressable style={{ width, height }} onPress={toggle}>
      <Video
        ref={ref}
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        isLooping={false}
        isMuted={muted}
        shouldPlay={autoPlay}
        onLoad={(st) => {
          setLoaded(true)
          if ("durationMillis" in st && st.durationMillis) setDuration(st.durationMillis)
        }}
        onPlaybackStatusUpdate={(st: AVPlaybackStatus) => {
          if (!st.isLoaded) return
          setPlaying(st.isPlaying)
          setPosition(st.positionMillis ?? 0)
          if (st.durationMillis) setDuration(st.durationMillis)
          if (st.didJustFinish) setFinished(true)
        }}
      />

      {!loaded ? (
        <View style={s.center}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : !playing ? (
        <View style={s.center}>
          <View style={s.centerRow}>
            <View style={s.playBadge} pointerEvents="none">
              <Text style={s.playGlyph}>▶</Text>
            </View>
            {midway ? (
              <Pressable onPress={restart} hitSlop={10} style={s.restartBadge}>
                <MaterialCommunityIcons name="restart" size={22} color="#fff" />
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {loaded ? (
        <>
          {/* Duration top-left, elapsed once it's running. */}
          <View style={s.durationPill} pointerEvents="none">
            <Text style={s.durationText}>
              {playing || position > 0 ? `${clock(position)} / ${clock(duration)}` : clock(duration)}
            </Text>
          </View>

          <View style={s.controls}>
            <Pressable
              onPress={() => setMuted((m) => !m)}
              hitSlop={10}
              style={s.ctrlBtn}
              accessibilityLabel={muted ? "Unmute" : "Mute"}
            >
              <MaterialCommunityIcons
                name={muted ? "volume-off" : "volume-high"}
                size={16}
                color="#fff"
              />
            </Pressable>
            {onExpand ? (
              <Pressable
                onPress={onExpand}
                hitSlop={10}
                style={s.ctrlBtn}
                accessibilityLabel="Open full screen"
              >
                <MaterialCommunityIcons name="arrow-expand" size={16} color="#fff" />
              </Pressable>
            ) : null}
          </View>

          {/* Pink progress along the bottom edge of the frame. */}
          <View style={s.track} pointerEvents="none">
            <View style={[s.fill, { width: `${Math.min(100, progress * 100)}%` }]} />
          </View>
        </>
      ) : null}
    </Pressable>
  )
}

const s = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  centerRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  playBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  playGlyph: { color: "#fff", fontSize: 20, marginLeft: 3 },
  restartBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  durationPill: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  durationText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  controls: { position: "absolute", top: 8, right: 8, flexDirection: "row", gap: 6 },
  ctrlBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  track: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  fill: { height: 3, backgroundColor: "#D9788F" },
})
