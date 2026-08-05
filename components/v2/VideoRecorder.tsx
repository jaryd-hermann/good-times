import { useEffect, useRef, useState } from "react"
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera"
import { enterPlaybackMode, enterRecordingMode } from "../../lib/v2/audio-session"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { Video, ResizeMode } from "expo-av"
import * as haptics from "../../lib/v2/haptics"

const TARGET_SECONDS = 60
/** Hard ceiling well past the target — the 60s is guidance, not a guillotine. */
const HARD_CAP = 5 * 60

/**
 * Talking head capture — full-bleed, matching video.png.
 *
 * Camera fills the screen; the question stays pinned over the viewfinder so it is
 * never lost mid-take. Close top-left, timer pill top-centre, restart top-right,
 * record button bottom-centre with the duration cap beside it.
 *
 * expo-camera has no pause/resume, so this is a retake-only model — which is what
 * the design shows.
 */
export function VideoRecorder({
  question,
  onClose,
  onComplete,
  reviewBeforeSend = false,
}: {
  question: string
  onClose: () => void
  onComplete: (uri: string) => void
  /**
   * Show a playback + Send/Retake step before completing.
   *
   * Chat replies posted the instant you stopped recording, with no way to watch
   * it back or start over. The answer flow has its own review screen downstream,
   * so it leaves this off rather than reviewing twice.
   */
  reviewBeforeSend?: boolean
}) {
  const [camPerm, requestCam] = useCameraPermissions()
  const [micPerm, requestMic] = useMicrophonePermissions()
  const cameraRef = useRef<CameraView>(null)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [facing, setFacing] = useState<"front" | "back">("front")
  const [reviewUri, setReviewUri] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!camPerm?.granted) void requestCam()
    if (!micPerm?.granted) void requestMic()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current)
    // However this screen is left, hand the session back to playback.
    void enterPlaybackMode()
  }, [])

  async function start() {
    if (!cameraRef.current || recording) return
    setRecording(true)
    setSeconds(0)
    timerRef.current = setInterval(() => setSeconds((v) => v + 1), 1000)
    try {
      // Without this the camera inherits whatever the last component left. If
      // that was AudioPlayer (allowsRecordingIOS:false, category Playback) the
      // clip records with NO AUDIO TRACK — the "they couldn't hear me" reports.
      await enterRecordingMode()
      const res = await cameraRef.current.recordAsync({ maxDuration: HARD_CAP })
      if (timerRef.current) clearInterval(timerRef.current)
      setRecording(false)
      await enterPlaybackMode()
      if (res?.uri) {
        if (reviewBeforeSend) setReviewUri(res.uri)
        else onComplete(res.uri)
      }
    } catch (e) {
      if (timerRef.current) clearInterval(timerRef.current)
      setRecording(false)
      await enterPlaybackMode()
      Alert.alert("Couldn't record", (e as Error).message)
    }
  }

  function stop() {
    cameraRef.current?.stopRecording()
  }

  function restart() {
    if (recording) stop()
    setSeconds(0)
  }

  // ---- review: watch it back, then Send or Retake ------------------------
  if (reviewUri) {
  return (
    <View style={s.reviewRoot}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={s.reviewHeader}>
          <Text style={s.reviewTitle}>Happy with it?</Text>
        </View>

        <View style={s.reviewVideoWrap}>
          <Video
            source={{ uri: reviewUri }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.CONTAIN}
            useNativeControls
            isLooping
            shouldPlay
          />
        </View>

        <View style={s.reviewActions}>
          <Pressable
            onPress={() => {
              haptics.tap()
              setReviewUri(null)
              setSeconds(0)
            }}
            style={({ pressed }) => [s.retakeBtn, pressed ? { opacity: 0.7 } : null]}
          >
            <Text style={s.retakeText}>Retake</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              haptics.commit()
              onComplete(reviewUri)
            }}
            style={({ pressed }) => [s.sendShadow, pressed ? s.sendPressed : null]}
          >
            <View style={s.sendBtn}>
              <Text style={s.sendText}>Send</Text>
            </View>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  )
  }

  if (!camPerm) {
    return (
      <View style={s.permWrap}>
        <ActivityIndicator color="#fff" />
      </View>
    )
  }

  if (!camPerm.granted) {
    return (
      <SafeAreaView style={s.permWrap}>
        <Text style={s.permTitle}>Camera access needed</Text>
        <Text style={s.permBody}>Allow the camera to record a talking head answer.</Text>
        <Pressable style={s.permBtn} onPress={requestCam}>
          <Text style={s.permBtnText}>Allow camera</Text>
        </Pressable>
        <Pressable onPress={onClose}>
          <Text style={s.permCancel}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  // Counts DOWN from the 60s target, then keeps going negative.
  const remaining = TARGET_SECONDS - seconds
  const over = remaining < 0
  const abs = Math.abs(remaining)
  const mm = String(Math.floor(abs / 60))
  const ss = String(abs % 60).padStart(2, "0")
  const clock = recording ? `${over ? "-" : ""}${mm}:${ss}` : `${TARGET_SECONDS}s`

  return (
    <View style={s.screen}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} mode="video" />
      <SafeAreaView style={s.overlay} edges={["top", "bottom"]}>
        <View style={s.topRow}>
          <Pressable onPress={onClose} hitSlop={12} style={s.circleBtn}>
            <MaterialCommunityIcons name="close" size={20} color="#fff" />
          </Pressable>

          <View style={[s.timerPill, recording ? s.timerPillRec : null, over && recording ? s.timerPillOver : null]}>
            {recording ? <View style={s.recDot} /> : null}
            <Text style={s.timerText}>{clock}</Text>
          </View>

          <Pressable onPress={restart} hitSlop={12} style={s.circleBtn}>
            <MaterialCommunityIcons name="restart" size={20} color="#fff" />
          </Pressable>
        </View>

        <View style={s.questionCard}>
          <Text style={s.answeringLabel}>ANSWERING</Text>
          <Text style={s.questionText}>{question}</Text>
        </View>

        {over && recording ? (
          <Text style={s.wrapUp}>Wrap it up!</Text>
        ) : null}

        <View style={{ flex: 1 }} />

        <View style={s.controls}>
          {/* Disabled mid-recording rather than silently killing the take.
              expo-camera reconfigures the capture session when `facing` changes,
              which ends recordAsync() — there is no way to flip without cutting
              the video. Better to show it as unavailable than to lose the take. */}
          <Pressable
            onPress={() => {
              if (recording) return
              haptics.tap()
              setFacing((f) => (f === "front" ? "back" : "front"))
            }}
            disabled={recording}
            style={[s.flipBtn, recording ? { opacity: 0.35 } : null]}
            accessibilityLabel={recording ? "Can't flip while recording" : "Flip camera"}
          >
            <MaterialCommunityIcons name="camera-flip-outline" size={22} color="#fff" />
          </Pressable>

          <Pressable onPress={recording ? stop : start} style={s.recordWrap}>
            <View style={s.recordOuter}>
              <View style={[s.recordInner, recording ? s.recordInnerStop : null]} />
            </View>
          </Pressable>

          {/* Was hardcoded to TARGET_SECONDS, so it read "60s" while the top
              counter ticked down. Same clock, one source of truth. */}
          <View style={s.capPill}>
            <Text style={[s.capText, over ? { color: "#E5A13C" } : null]}>{clock}</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#111" },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-start" },

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
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  timerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  timerPillRec: { backgroundColor: "#B23B3B" },
  timerPillOver: { backgroundColor: "#8A2B2B" },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },
  timerText: { color: "#fff", fontWeight: "800", fontSize: 13 },

  questionCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: "#E5A13C",
    borderWidth: 2,
    borderColor: "#000",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  answeringLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: "#000", opacity: 0.7 },
  questionText: { fontSize: 19, fontWeight: "800", color: "#000", lineHeight: 24, marginTop: 5 },

  wrapUp: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 14,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 6,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 30,
    paddingBottom: 22,
  },
  flipBtn: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  recordWrap: { alignItems: "center" },
  recordOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  recordInner: { width: 62, height: 62, borderRadius: 14, backgroundColor: "#B23B3B" },
  recordInnerStop: { width: 30, height: 30, borderRadius: 5 },
  capPill: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  capText: { color: "#fff", fontWeight: "800", fontSize: 13 },

  permWrap: { flex: 1, backgroundColor: "#111", alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  permTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  permBody: { color: "rgba(255,255,255,0.7)", textAlign: "center", lineHeight: 21 },
  permBtn: {
    backgroundColor: "#D9788F",
    borderRadius: 26,
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginTop: 8,
  },
  permBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  permCancel: { color: "rgba(255,255,255,0.6)", fontWeight: "700", marginTop: 8 },
  reviewRoot: { flex: 1, backgroundColor: "#000000" },
  reviewHeader: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  reviewTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  reviewVideoWrap: { flex: 1, marginHorizontal: 20, borderRadius: 16, overflow: "hidden", backgroundColor: "#111" },
  reviewActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  retakeBtn: {
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
  },
  retakeText: { color: "#FFFFFF", fontWeight: "800", fontSize: 16 },
  // Bevel on the OUTER view — overflow:"hidden" on the shadow-caster clips it.
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
  sendText: { color: "#FFFFFF", fontWeight: "800", fontSize: 17 },
})
