import { useEffect, useRef, useState } from "react"
import { View, Text, StyleSheet, Pressable, Alert, Animated } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Audio } from "expo-av"
import { enterPlaybackMode, enterRecordingMode } from "../../lib/v2/audio-session"
import { AudioPlayer } from "./AudioPlayer"
import * as haptics from "../../lib/v2/haptics"
import { MaterialCommunityIcons } from "@expo/vector-icons"

const MAX_SECONDS = 5 * 60
const BARS = 21

type Phase = "idle" | "recording" | "paused"

/**
 * Voice note capture — full-bleed, matching voice.png.
 *
 * Recording starts when you tap the button, not on mount: opening the screen
 * shouldn't silently start capturing audio.
 *
 * Transcription is post-hoc (decision 22) and runs after Stop, so nothing here
 * mentions it.
 */
export function VoiceRecorder({
  question,
  onClose,
  onComplete,
  reviewBeforeSend = false,
}: {
  question: string
  onClose: () => void
  onComplete: (uri: string, seconds: number) => void
  /** Listen back with Send/Retake before completing. See VideoRecorder. */
  reviewBeforeSend?: boolean
}) {
  const recordingRef = useRef<Audio.Recording | null>(null)
  const [phase, setPhase] = useState<Phase>("idle")
  const [seconds, setSeconds] = useState(0)
  const [reviewUri, setReviewUri] = useState<string | null>(null)
  // Two separate cadences: the clock ticks once per second, the bars animate
  // faster. Driving both from one fast interval made the timer run ~4.5x real time.
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const waveRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const levels = useRef([...Array(BARS)].map(() => new Animated.Value(0.22))).current

  useEffect(
    () => () => {
      recordingRef.current?.stopAndUnloadAsync().catch(() => {})
      if (clockRef.current) clearInterval(clockRef.current)
      if (waveRef.current) clearInterval(waveRef.current)
      // Hand the session back however this screen is left — cancelled, swiped
      // away, or crashed out of. Leaving it in PlayAndRecord routes every later
      // video to the earpiece for the rest of the session.
      void enterPlaybackMode()
    },
    []
  )

  function startTickers() {
    if (clockRef.current) clearInterval(clockRef.current)
    if (waveRef.current) clearInterval(waveRef.current)
    clockRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) {
          void stop()
          return s
        }
        return s + 1
      })
    }, 1000)
    waveRef.current = setInterval(() => {
      levels.forEach((v, i) => {
        const mid = i > BARS / 2 - 3 && i < BARS / 2 + 3
        Animated.timing(v, {
          toValue: 0.2 + Math.random() * (mid ? 0.8 : 0.5),
          duration: 180,
          useNativeDriver: false,
        }).start()
      })
    }, 200)
  }

  function stopTickers() {
    if (clockRef.current) clearInterval(clockRef.current)
    if (waveRef.current) clearInterval(waveRef.current)
    clockRef.current = null
    waveRef.current = null
    levels.forEach((v) =>
      Animated.timing(v, { toValue: 0.22, duration: 180, useNativeDriver: false }).start()
    )
  }

  async function begin() {
    try {
      const perm = await Audio.requestPermissionsAsync()
      if (!perm.granted) {
        Alert.alert("Microphone needed", "Allow microphone access to record a voice note.")
        return
      }
      await enterRecordingMode()
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      )
      recordingRef.current = recording
      setSeconds(0)
      setPhase("recording")
      startTickers()
    } catch (e) {
      Alert.alert("Couldn't start recording", (e as Error).message)
    }
  }

  async function togglePause() {
    const r = recordingRef.current
    if (!r) return
    try {
      if (phase === "paused") {
        await r.startAsync()
        setPhase("recording")
        startTickers()
      } else {
        await r.pauseAsync()
        setPhase("paused")
        stopTickers()
      }
    } catch {
      /* some devices can't pause; keep going */
    }
  }

  async function restart() {
    stopTickers()
    const r = recordingRef.current
    if (r) await r.stopAndUnloadAsync().catch(() => {})
    // Discarding a take ends the capture just as much as finishing one does, so
    // the session goes back to playback here too.
    await enterPlaybackMode()
    recordingRef.current = null
    setSeconds(0)
    setPhase("idle")
  }

  async function stop() {
    const r = recordingRef.current
    if (!r) return
    stopTickers()
    try {
      await r.stopAndUnloadAsync()
      await enterPlaybackMode()
      const uri = r.getURI()
      recordingRef.current = null
      if (uri) {
        if (reviewBeforeSend) setReviewUri(uri)
        else onComplete(uri, seconds)
      }
      else onClose()
    } catch (e) {
      Alert.alert("Couldn't save recording", (e as Error).message)
      onClose()
    }
  }

  const mm = String(Math.floor(seconds / 60))
  const ss = String(seconds % 60).padStart(2, "0")
  const idle = phase === "idle"

  // ---- review: listen back, then Send or Retake --------------------------
  if (reviewUri) {
    return (
      <SafeAreaView style={s.screen} edges={["top", "bottom"]}>
        <View style={s.reviewBody}>
          <Text style={s.reviewTitle}>Happy with it?</Text>
          <AudioPlayer uri={reviewUri} seconds={seconds} />
        </View>

        <View style={s.reviewActions}>
          <Pressable
            onPress={() => {
              haptics.tap()
              setReviewUri(null)
              setSeconds(0)
              setPhase("idle")
            }}
            style={({ pressed }) => [s.retakeBtn, pressed ? { opacity: 0.7 } : null]}
          >
            <Text style={s.retakeText}>Re-record</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              haptics.commit()
              onComplete(reviewUri, seconds)
            }}
            style={({ pressed }) => [s.sendShadow, pressed ? s.sendPressed : null]}
          >
            <View style={s.sendBtn}>
              <Text style={s.sendText}>Send</Text>
            </View>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.screen} edges={["top", "bottom"]}>
      <View style={[s.blob, s.blobA]} pointerEvents="none" />
      <View style={[s.blob, s.blobB]} pointerEvents="none" />

      <View style={s.topRow}>
        <Pressable onPress={onClose} hitSlop={12} style={s.circleBtn}>
          <MaterialCommunityIcons name="close" size={20} color="#fff" />
        </Pressable>
        <View style={[s.recPill, idle ? s.recPillIdle : null]}>
          {!idle ? <View style={s.recDot} /> : null}
          <Text style={s.recText}>
            {idle ? "READY" : phase === "paused" ? "PAUSED" : "RECORDING"}
          </Text>
        </View>
        <View style={s.circleBtn} />
      </View>

      <View style={s.questionCard}>
        <Text style={s.answeringLabel}>ANSWERING</Text>
        <Text style={s.questionText}>{question}</Text>
      </View>

      <View style={s.middle}>
        <Text style={s.timer}>
          {mm}:{ss}
        </Text>
        <Text style={s.timerHint}>
          {idle ? "TAP TO START · 5 MIN MAX" : "TAP TO PAUSE · 5 MIN MAX"}
        </Text>

        <View style={s.wave}>
          {levels.map((v, i) => (
            <Animated.View
              key={i}
              style={[
                s.bar,
                {
                  height: v.interpolate({ inputRange: [0, 1], outputRange: [8, 96] }),
                  backgroundColor:
                    !idle && i === Math.floor(BARS / 2) ? "#E5A13C" : "rgba(255,255,255,0.45)",
                },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={s.controls}>
        <Pressable onPress={restart} style={s.sideBtn} disabled={idle}>
          <View style={[s.sideCircle, idle ? s.dim : null]}>
            <MaterialCommunityIcons name="restart" size={22} color="#fff" />
          </View>
          <Text style={[s.sideLabel, idle ? s.dim : null]}>RESTART</Text>
        </Pressable>

        <Pressable onPress={idle ? begin : stop} style={s.stopWrap}>
          <View style={s.stopOuter}>
            {idle ? (
              <View style={s.recordDotBig} />
            ) : (
              <View style={s.stopInner} />
            )}
          </View>
          <Text style={s.stopLabel}>{idle ? "START" : "STOP & REVIEW"}</Text>
        </Pressable>

        <Pressable onPress={togglePause} style={s.sideBtn} disabled={idle}>
          <View style={[s.sideCircle, idle ? s.dim : null]}>
            <MaterialCommunityIcons name={phase === "paused" ? "play" : "pause"} size={22} color="#fff" />
          </View>
          <Text style={[s.sideLabel, idle ? s.dim : null]}>
            {phase === "paused" ? "RESUME" : "PAUSE"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const GREEN = "#2C4A3B"
const GREEN_LIGHT = "#355644"

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: GREEN, justifyContent: "space-between" },
  blob: { position: "absolute", borderRadius: 999, backgroundColor: GREEN_LIGHT, opacity: 0.65 },
  blobA: { width: 340, height: 340, top: "36%", left: -120 },
  blobB: { width: 300, height: 300, bottom: "12%", right: -110 },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  recPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#B23B3B",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  recPillIdle: { backgroundColor: "rgba(255,255,255,0.18)" },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },
  recText: { color: "#fff", fontWeight: "800", fontSize: 12, letterSpacing: 0.6 },

  questionCard: {
    marginHorizontal: 20,
    marginTop: 18,
    backgroundColor: "#E5A13C",
    borderWidth: 2,
    borderColor: "#000",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  answeringLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: "#000", opacity: 0.7 },
  questionText: { fontSize: 19, fontWeight: "800", color: "#000", lineHeight: 24, marginTop: 5 },

  middle: { alignItems: "center", flex: 1, justifyContent: "center" },
  timer: { fontSize: 76, fontWeight: "800", color: "#fff", letterSpacing: -2 },
  timerHint: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 2,
  },
  wave: { flexDirection: "row", alignItems: "center", gap: 5, height: 110, marginTop: 34 },
  bar: { width: 5, borderRadius: 3 },

  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 24,
    paddingBottom: 18,
  },
  sideBtn: { alignItems: "center", gap: 7, width: 84 },
  sideCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  sideLabel: { color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  dim: { opacity: 0.35 },
  stopWrap: { alignItems: "center", gap: 8 },
  stopOuter: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 4,
    borderColor: "#fff",
    backgroundColor: "#B23B3B",
    alignItems: "center",
    justifyContent: "center",
  },
  stopInner: { width: 30, height: 30, borderRadius: 6, backgroundColor: "#fff" },
  recordDotBig: { width: 54, height: 54, borderRadius: 27, backgroundColor: "#fff", opacity: 0.9 },
  stopLabel: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
    reviewBody: { flex: 1, justifyContent: "center", paddingHorizontal: 20, gap: 16 },
    reviewTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "800", textAlign: "center" },
    reviewActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      paddingHorizontal: 20,
      paddingVertical: 20,
    },
    retakeBtn: {
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 28,
      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.5)",
    },
    retakeText: { color: "#FFFFFF", fontWeight: "800", fontSize: 16 },
    sendShadow: {
      flex: 1,
      borderRadius: 28,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 5,
    },
    sendPressed: {
      transform: [{ translateY: 5 }],
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      elevation: 0,
    },
    sendBtn: {
      backgroundColor: "#D9788F",
      borderWidth: 2,
      borderColor: "#000000",
      borderRadius: 28,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 56,
      overflow: "hidden",
    },
    sendText: { color: "#fff", fontWeight: "800", fontSize: 17 },
  })
