import { useEffect, useRef, useState } from "react"
import { View, Text, StyleSheet, Pressable, Alert } from "react-native"
import { Audio } from "expo-av"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useV2Colors, v2Spacing as sp } from "../../lib/v2/theme"

const BARS = 34

/**
 * Full-width inline audio player for reviewing a voice answer.
 *
 * The waveform doubles as a progress bar — bars ahead of the playhead are dim,
 * bars behind are filled. Heights are a stable pseudo-random pattern derived from
 * the index, so the shape doesn't change between renders (a real waveform would
 * need to decode the file, which isn't worth it for a review step).
 */
export function AudioPlayer({ uri, seconds }: { uri: string; seconds?: number }) {
  const { c } = useV2Colors()
  const soundRef = useRef<Audio.Sound | null>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState((seconds ?? 0) * 1000)
  const s = makeStyles(c)

  useEffect(
    () => () => {
      soundRef.current?.unloadAsync().catch(() => {})
    },
    []
  )

  async function load() {
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true })
    const { sound, status } = await Audio.Sound.createAsync({ uri }, { progressUpdateIntervalMillis: 120 })
    soundRef.current = sound
    if (status.isLoaded && status.durationMillis) setDuration(status.durationMillis)
    sound.setOnPlaybackStatusUpdate((st) => {
      if (!st.isLoaded) return
      setPosition(st.positionMillis)
      if (st.durationMillis) setDuration(st.durationMillis)
      if (st.didJustFinish) {
        setPlaying(false)
        setPosition(0)
        sound.setPositionAsync(0)
      }
    })
    return sound
  }

  async function toggle() {
    try {
      const sound = soundRef.current ?? (await load())
      if (playing) {
        await sound.pauseAsync()
        setPlaying(false)
      } else {
        await sound.playAsync()
        setPlaying(true)
      }
    } catch (e) {
      Alert.alert("Couldn't play", (e as Error).message)
    }
  }

  async function restart() {
    try {
      const sound = soundRef.current ?? (await load())
      await sound.setPositionAsync(0)
      setPosition(0)
      await sound.playAsync()
      setPlaying(true)
    } catch {
      /* ignore */
    }
  }

  const progress = duration > 0 ? position / duration : 0
  const totalSec = Math.floor(duration / 1000)
  const totalLabel = `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`
  // Show elapsed AND total. Previously only one number appeared, so a memo you
  // had not played yet read "0:00" and gave no idea how long it was.
  const shown = position
  const total = Math.round(shown / 1000)
  const mm = String(Math.floor(total / 60))
  const ss = String(total % 60).padStart(2, "0")

  return (
    <View style={s.wrap}>
      <Pressable onPress={toggle} style={s.playBtn} accessibilityLabel={playing ? "Pause" : "Play"}>
        <MaterialCommunityIcons name={playing ? "pause" : "play"} size={22} color="#fff" />
      </Pressable>

      <Pressable onPress={toggle} style={s.waveWrap}>
        {Array.from({ length: BARS }).map((_, i) => {
          // deterministic height so the shape is stable across renders
          const h = 10 + ((Math.sin(i * 1.7) + 1) / 2) * 26 + ((i * 37) % 11)
          const passed = i / BARS <= progress
          return (
            <View
              key={i}
              style={[
                s.bar,
                {
                  height: Math.min(h, 38),
                  backgroundColor: passed ? c.green : c.textSecondary,
                  opacity: passed ? 1 : 0.35,
                },
              ]}
            />
          )
        })}
      </Pressable>

      <View style={s.right}>
        <Text style={s.time}>
          {mm}:{ss}
          {duration > 0 ? <Text style={s.timeTotal}> / {totalLabel}</Text> : null}
        </Text>
        <Pressable onPress={restart} hitSlop={8} accessibilityLabel="Restart">
          <MaterialCommunityIcons name="restart" size={18} color={c.textSecondary} />
        </Pressable>
      </View>
      <View style={s.progressTrack} pointerEvents="none">
        <View style={[s.progressFill, { width: `${Math.min(100, progress * 100)}%` }]} />
      </View>
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useV2Colors>["c"]) {
  return StyleSheet.create({
    progressTrack: {
      position: "absolute",
      left: 10,
      right: 10,
      bottom: 5,
      height: 3,
      borderRadius: 2,
      backgroundColor: c.textSecondary,
      opacity: 0.25,
      overflow: "hidden",
    },
    progressFill: { height: 3, borderRadius: 2, backgroundColor: c.green, opacity: 1 },
    wrap: {
      position: "relative",
      flexDirection: "row",
      alignItems: "center",
      gap: sp.md,
      backgroundColor: c.surfaceAlt,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 14,
      padding: sp.md,
      marginBottom: sp.sm,
    },
    playBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.green,
      borderWidth: 2,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    waveWrap: {
      flex: 1,
      // Belt and braces: even if the bars cannot shrink further, they clip to the
      // player rather than spilling past its border.
      overflow: "hidden",
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      height: 44,
    },
    bar: { flex: 1, borderRadius: 2 },
    right: { alignItems: "center", gap: 4 },
    timeTotal: { fontWeight: "600", opacity: 0.6 },
    time: { fontSize: 12, fontWeight: "700", color: c.textSecondary, fontVariant: ["tabular-nums"] },
  })
}
