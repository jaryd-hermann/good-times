import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Pressable,
} from "react-native"
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import * as ImagePicker from "expo-image-picker"
import * as Notifications from "expo-notifications"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useAuth } from "../../components/AuthProvider"
import { useTodayHub, usePostAnswer } from "../../lib/v2/queries"
import { isOnboarded } from "../../lib/v2/onboarding"
import { useV2Colors, v2Spacing as sp } from "../../lib/v2/theme"
import { AvatarStack } from "../../components/v2/AvatarStack"
import { MediaCarousel } from "../../components/v2/MediaCarousel"
import { JournalPhotos } from "../../components/v2/JournalPhotos"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "../../lib/supabase"
import { useProfile } from "../../lib/v2/useProfile"
import { VideoRecorder } from "../../components/v2/VideoRecorder"
import { VoiceRecorder } from "../../components/v2/VoiceRecorder"
import { AudioPlayer } from "../../components/v2/AudioPlayer"
import { TexturedCard } from "../../components/v2/Texture"
import { v2Analytics } from "../../lib/v2/analytics"
import { questionTag } from "../../lib/v2/day-label"
import { transcribeAudioFromUri } from "../../lib/openai-transcribe"
import { getTodayDate } from "../../lib/utils"
import { uploadMedia } from "../../lib/storage"
import * as haptics from "../../lib/v2/haptics"
import type { MediaType } from "../../lib/v2/types"

type Step = "mode" | "write" | "video" | "voice" | "journal" | "review"
type Mode = "video" | "voice" | "text"
type Attachment = { uri: string; type: MediaType; day?: string | null }

/**
 * Weekday for a photo, from EXIF. Returns null when the tag is missing — plenty of
 * images (screenshots, saved/forwarded pictures) carry no DateTimeOriginal, and an
 * invented day would be worse than none.
 *
 * EXIF formats the date as "YYYY:MM:DD HH:MM:SS", which Date cannot parse; the
 * colons in the date portion have to become dashes first.
 */
function dayFromExif(exif: Record<string, any> | null | undefined): string | null {
  const raw = exif?.DateTimeOriginal ?? exif?.DateTime ?? exif?.DateTimeDigitized
  if (typeof raw !== "string") return null
  const iso = raw.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3").replace(" ", "T")
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString([], { weekday: "short" })
}

/**
 * Composer — designs 3A → 3B/3C/3D → 3E.
 *
 * Mode-first (decision 8). No bottom app menu anywhere in this flow.
 *
 * Transcription is POST-HOC (decision 22): the finished recording goes to Whisper
 * after you stop, not live while you speak. That removed the on-device speech
 * recogniser dependency entirely, which is what had video and voice blocked.
 */
export default function ComposeScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const { c, isDark } = useV2Colors()
  const params = useLocalSearchParams<{ promptId: string; date: string }>()
  const { data: hub } = useTodayHub(user?.id, params.date)

  /**
   * The prompt is taken from the hub for params.date — never from the navigation
   * param.
   *
   * An answer to yesterday's question was once written to today's date AND today's
   * prompt: the composer showed the right question but posted the wrong day. The
   * exact race (reused screen instance / params lagging a transition) was never
   * pinned down, so this removes the possibility instead of the symptom — the
   * prompt now comes from the same date-keyed fetch that renders the question, so
   * the two cannot disagree.
   */
  const composeDate = params.date
  const promptId = hub?.question.prompt_id ?? params.promptId
  const hubMatchesDate = !!hub && hub.date === composeDate
  const { data: profile } = useProfile(user?.id)
  const postAnswer = usePostAnswer(user?.id)

  const [rawStep, setStep] = useState<Step>("mode")
  const [mode, setMode] = useState<Mode>("text")
  const [text, setText] = useState("")
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [captions, setCaptions] = useState<(string | null)[]>([])
  const [transcript, setTranscript] = useState<string | null>(null)
  /**
   * Off by default.
   *
   * A voice note is the thing being sent; the transcript is an accessibility
   * extra. Whisper also hallucinates on near-silence — it emits "you" or "Thank
   * you." for a quiet clip — so defaulting to ON published machine guesses under
   * people's recordings without them asking.
   */
  const [includeTranscript, setIncludeTranscript] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [audioSeconds, setAudioSeconds] = useState(0)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [posting, setPosting] = useState(false)
  const journalScroll = useRef<ScrollView>(null)


  /**
   * The Sunday weekly photo journal is a different kind of entry, not a question.
   * v1 keyed off prompts.category = 'Journal'; do the same rather than pattern-
   * matching the question text, which breaks the moment the wording is edited.
   */
  const { data: isJournal } = useQuery({
    queryKey: ["v2", "prompt-category", promptId],
    enabled: !!promptId,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("prompts")
        .select("category")
        .eq("id", promptId)
        .maybeSingle()
      return (data as { category: string | null } | null)?.category === "Journal"
    },
  })

  const s = useMemo(() => makeStyles(c, isDark), [c, isDark])

  /**
   * Editing loads the existing answer.
   *
   * "Edit" previously opened an empty composer, so saving replaced a written
   * answer with whatever was retyped. Runs once per mount, guarded by a ref —
   * re-running would stamp on edits as the user makes them.
   */
  const hydrated = useRef(false)

  /**
   * Re-hydrate every time the composer is opened.
   *
   * expo-router reuses this screen instance, so a plain once-per-mount guard kept
   * the FIRST edit's local state around — tapping Edit again showed an older
   * version than the thread did. Resetting on focus means each entry reads the
   * answer as it currently stands.
   */
  useFocusEffect(
    useCallback(() => {
      hydrated.current = false
    }, [])
  )
  useEffect(() => {
    const mine = hub?.my_answer
    if (!mine || hydrated.current || hub?.date !== composeDate) return
    hydrated.current = true

    setMode(mine.mode)
    setText(mine.text_content ?? "")
    setTranscript(mine.transcript ?? null)
    setCaptions(mine.captions ?? [])
    setAttachments(
      (mine.media_urls ?? []).map((url, i) => ({
        uri: url,
        type: (mine.media_types?.[i] ?? "photo") as MediaType,
        day: mine.media_days?.[i] ?? null,
      }))
    )
    // Groups it is NOT currently shared with start deselected.
    const shared = new Set(mine.shared_group_ids ?? [])
    setExcluded(new Set((hub?.groups ?? []).map((g) => g.id).filter((id) => !shared.has(id))))
    setStep(mine.media_urls?.length && isJournal ? "journal" : mine.mode === "text" ? "write" : "review")
  }, [hub, composeDate, isJournal])

  // The journal prompt has no mode fork, so 3A never applies to it. Derived rather
  // than pushed into state: setting state during render is a side effect, and doing
  // it in an effect would flash the mode picker for a frame first.
  const [journalOptOut, setJournalOptOut] = useState(false)
  const step = isJournal && !journalOptOut && rawStep === "mode" ? "journal" : rawStep
  const groups = hub?.groups ?? []
  const selected = groups.filter((g) => !excluded.has(g.id))
  const question = hub?.question.text ?? ""

  function toggleGroup(id: string) {
    setExcluded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function pickPhotos() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert("Photos permission needed", "Allow photo access to attach media.")
      return
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      selectionLimit: 6,
      quality: 0.8,
    })
    if (res.canceled) return
    setAttachments((prev) => [
      ...prev,
      ...res.assets.map((a) => ({
        uri: a.uri,
        type: (a.type === "video" ? "video" : "photo") as MediaType,
      })),
    ])
  }

  /** Photos only, and no selection cap — a week's journal is not 6 pictures. */
  async function pickJournalPhotos() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert("Photos permission needed", "Allow photo access to add this week's photos.")
      return
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
      // Needed for the per-photo day tag. Without it every photo would be
      // untagged, which for a *weekly* journal loses the point.
      exif: true,
    })
    if (res.canceled) return
    setAttachments((prev) => [
      ...prev,
      ...res.assets.map((a) => ({
        uri: a.uri,
        type: "photo" as MediaType,
        day: dayFromExif(a.exif),
      })),
    ])
    // Keep captions index-aligned with attachments — a photo added without a
    // matching slot would shift every caption after it onto the wrong image.
    setCaptions((prev) => [...prev, ...res.assets.map(() => null)])
  }

  function removeJournalPhoto(i: number) {
    setAttachments((prev) => prev.filter((_, n) => n !== i))
    setCaptions((prev) => prev.filter((_, n) => n !== i))
  }

  function setCaption(i: number, text: string) {
    setCaptions((prev) => {
      const next = [...prev]
      next[i] = text
      return next
    })
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) {
      Alert.alert("Camera permission needed", "Allow camera access to take a photo.")
      return
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8 })
    if (res.canceled) return
    setAttachments((prev) => [...prev, { uri: res.assets[0].uri, type: "photo" }])
  }

  /** Whisper runs once, on the finished file. */
  async function runTranscription(uri: string) {
    setTranscribing(true)
    try {
      const t = await transcribeAudioFromUri(uri)
      setTranscript(t)
      if (!text.trim()) setText(t)
    } catch (e) {
      console.warn("[compose] transcription failed:", (e as Error).message)
      // Transcription is a bonus, not the answer. Failing it used to throw a modal
      // in the user's face for something they never asked for; the recording is
      // still fine without it.
      console.warn("[compose] transcription failed — posting without a transcript")
    } finally {
      setTranscribing(false)
    }
  }

  async function onPost() {
    if (!user?.id || !promptId) return
    // Refuse rather than guess. Posting before the hub for this exact date has
    // landed is what silently wrote an answer to the wrong day.
    if (!hubMatchesDate) {
      Alert.alert("One moment", "Still loading that day's question — try again in a second.")
      return
    }
    setPosting(true)
    try {
      // Media has to land in storage before the answer row references it.
      const uploaded: { url: string; type: MediaType }[] = []
      for (const a of attachments) {
        // Already in storage (we are editing) — reuse it. uploadMedia expects a
        // local file and would fail on an https URL.
        if (/^https?:\/\//.test(a.uri)) {
          uploaded.push({ url: a.uri, type: a.type })
          continue
        }
        // Folder MUST be a uuid: gt_upload_media_by_group casts this segment, so
        // the old "onboarding" placeholder raised a cast error rather than being
        // denied. With no group yet, the answer is simply the user's own — store
        // it under their id (see migration 107 for the matching policy).
        const url = await uploadMedia(
          selected[0]?.id ?? user.id,
          `answer-${Date.now()}`,
          a.uri,
          a.type
        )
        uploaded.push({ url, type: a.type })
      }

      await postAnswer.mutateAsync({
        promptId,
        date: composeDate,
        mode,
        textContent: text.trim() || null,
        transcript: includeTranscript ? transcript : null,
        mediaUrls: uploaded.map((u) => u.url),
        mediaTypes: uploaded.map((u) => u.type),
        captions: isJournal ? captions : undefined,
        mediaDays: isJournal ? attachments.filter((a) => a.type === "photo").map((a) => a.day ?? null) : undefined,
        groupIds: selected.map((g) => g.id),
      })
      v2Analytics.questionAnswered({
        method: mode,
        hasMedia: uploaded.length > 0,
        isEdit: !!hub?.my_answer,
        // 0 today, 1 yesterday, … — surfaces how much back-filling of missed days
        // actually happens, which the day picker exists to allow.
        dayOffset: Math.round(
          (new Date(getTodayDate() + "T00:00:00").getTime() -
            new Date(composeDate + "T00:00:00").getTime()) /
            86400000,
        ),
        groupCount: selected.length,
      })
      haptics.success()
      // The notification ask belongs right after the FIRST answer — not after a
      // groupless one. Gating on group count would skip anyone who arrived via an
      // invite link, and they need the ask most: they already have people to hear
      // from. onboarded_at is the honest "is this their first run" flag.
      const firstRun = user?.id ? !(await isOnboarded(user.id)) : false

      // Second chance only. They already saw this screen after creating their
      // profile; asking again once they've said yes is nagging.
      //
      // Gate on the OS permission, not on push_tokens. The token row is written
      // after OneSignal hands back a subscription id, which can lag the permission
      // grant by longer than it takes to answer the first question — so a user who
      // had just accepted notifications was asked a second time, with the row
      // arriving only afterwards. The permission itself is immediate and is the
      // thing the screen is actually asking for.
      let alreadySubscribed = false
      if (firstRun) {
        const { status } = await Notifications.getPermissionsAsync()
        alreadySubscribed = status === "granted"
      }

      if (firstRun && !alreadySubscribed) {
        router.replace("/(onboarding-v2)/notifications")
      } else if (router.canGoBack()) {
        // back(), not replace(): Capture stays mounted underneath with the day you
        // picked still selected. Replacing rebuilt it on today, so answering
        // Friday bounced you to Today.
        router.back()
      } else {
        router.replace("/(v2)/today")
      }
    } catch (e) {
      haptics.warn()
      Alert.alert("Couldn't post", (e as Error).message)
    } finally {
      setPosting(false)
    }
  }

  // ---- Sunday weekly photo journal ---------------------------------------
  if (step === "journal") {
    const photos = attachments.filter((a) => a.type === "photo")
    return (
      <SafeAreaView style={s.screen} edges={["top", "bottom"]}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Text style={s.topBarAction}>Cancel</Text>
          </TouchableOpacity>
          <Text style={s.topBarDate}>
            {new Date(params.date + "T00:00:00").toDateString().slice(0, 10)}
          </Text>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            ref={journalScroll}
            contentContainerStyle={{ padding: sp.lg, paddingBottom: 120 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={s.questionBanner}>
              <Text style={s.questionBannerText}>{question}</Text>
              <Text style={s.questionBannerSub}>
                Show some honest moments from your camera roll, big or small. Caption them for us!
              </Text>
            </View>

            <JournalPhotos
              photos={photos}
              captions={captions}
              onAdd={pickJournalPhotos}
              onRemove={removeJournalPhoto}
              onCaption={setCaption}
              // Lift the focused row to near the top so the photo AND its caption
              // stay visible above the keyboard. KeyboardAvoidingView alone only
              // shrinks the frame — it will happily leave the input just under the
              // keyboard's edge with the photo pushed off-screen.
              onFocusRow={(y) =>
                requestAnimationFrame(() =>
                  journalScroll.current?.scrollTo({ y: Math.max(0, y - 24), animated: true })
                )
              }
            />

            {/* Escape hatch. Without it, anyone with a photoless week is shut out of
                the day entirely — no answer, so no access to the group's thread.
                Sends them to the normal mode picker; the answer still posts against
                the journal prompt, it just isn't photos. */}
            {photos.length === 0 ? (
              <View style={s.journalFallback}>
                <Text style={s.journalFallbackText}>
                  Really have no pics from the week?{" "}
                  <Text
                    style={s.journalFallbackLink}
                    onPress={() => {
                      haptics.tap()
                      setJournalOptOut(true)
                      setStep("mode")
                    }}
                  >
                    Tell us something anyway
                  </Text>
                </Text>
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>

        <View style={s.postBar}>
          <Pressable
            onPress={() => {
              haptics.commit()
              if (photos.length === 0) return pickJournalPhotos()
              setStep("review")
            }}
            style={({ pressed }) => [s.ctaShadow, pressed ? s.ctaPressed : null]}
          >
            <View style={s.cta}>
              <Text style={s.ctaText}>
                {photos.length === 0
                  ? "Add photos to continue"
                  : `Review ${photos.length} photo${photos.length === 1 ? "" : "s"}`}
              </Text>
            </View>
          </Pressable>

          {/* d3: only while genuinely uncaptioned — a nag that never clears is noise. */}
          {photos.length > 0 && captions.every((cap) => !cap?.trim()) ? (
            <Text style={s.postHint}>p.s. you haven&rsquo;t captioned any yet!</Text>
          ) : null}
        </View>
      </SafeAreaView>
    )
  }

  // ---- 3A: pick how you answer -------------------------------------------
  if (step === "mode") {
    // Write first: it is the familiar one, and leading with a camera makes the
    // whole screen feel like more work than it is. The two that are new to people
    // carry a tag rather than being pushed to the top.
    const doors = [
      { m: "text" as Mode, icon: "format-text", title: "Write it", sub: "Type your answer, add pics and stuff", tint: c.blue, go: "write" as Step, isNew: false },
      { m: "video" as Mode, icon: "video-outline", title: "Talking head", sub: "Answer with no-pressure video", tint: c.red, go: "video" as Step, isNew: true },
      { m: "voice" as Mode, icon: "waveform", title: "Voice note", sub: "Everyone gets to hear you!", tint: c.green, go: "voice" as Step, isNew: true },
    ]
    return (
      <SafeAreaView style={s.screen} edges={["top", "bottom"]}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Text style={s.topBarAction}>Cancel</Text>
          </TouchableOpacity>
          <Text style={s.topBarDate}>
            {new Date(params.date + "T00:00:00").toDateString().slice(0, 10)}
          </Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: sp.lg }}>
          {/* TexturedCard, not a plain View: the texture has to sit in a clipped
              wrapper inside the shadow-casting view, which is exactly what this
              splits. Putting overflow:hidden on the card itself would clip the
              hard-offset bevel away. */}
          {/* Which day this is. v2 lets you answer past days, so the card alone
              left you guessing whether you were on today or catching up. */}
          <Text style={s.dayTag}>{questionTag(params.date).toUpperCase()}</Text>
          <TexturedCard style={s.modeBanner} radius={14} bevel={0}>
            <Text style={s.modeBannerText}>{question}</Text>
          </TexturedCard>
          <Text style={s.sectionLabel}>HOW DO YOU WANT TO ANSWER?</Text>
          {doors.map((d) => (
            <Pressable
              key={d.m}
              onPress={() => {
                setMode(d.m)
                setStep(d.go)
              }}
              style={({ pressed }) => [s.door, pressed ? s.doorPressed : null]}
            >
              <View style={[s.doorIcon, { backgroundColor: d.tint }]}>
                <MaterialCommunityIcons name={d.icon as any} size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.doorTitleRow}>
                  <Text style={s.doorTitle}>{d.title}</Text>
                  {d.isNew ? (
                    <View style={s.newTag}>
                      <Text style={s.newTagText}>NEW, TRY ME</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={s.doorSub}>{d.sub}</Text>
              </View>
              <Text style={s.doorChevron}>›</Text>
            </Pressable>
          ))}

          {/* Only with more than one group — with a single group there is nothing
              to change, and the note would just read as a warning about nothing.
              Said here rather than only on the send screen so the reach is known
              BEFORE recording, not after. */}
          {groups.length > 1 ? (
            <Text style={s.shareNote}>
              p.s. your answer is sent to all your groups unless you change that before
              you hit send.
            </Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    )
  }

  // ---- 3B: talking head ---------------------------------------------------
  if (step === "video") {
    return (
      <VideoRecorder
        question={question}
        onClose={() => setStep("mode")}
        onComplete={(uri) => {
          setAttachments([{ uri, type: "video" }])
          setMode("video")
          // A new take replaces the old one entirely. Editing hydrates `text`
          // from the saved answer, so without this a stale body — such as the
          // "you" Whisper produces from a silent clip — followed the
          // re-recording through review and got posted all over again.
          setText("")
          setTranscript(null)
          setStep("review")
          void runTranscription(uri)
        }}
      />
    )
  }

  // ---- 3C: voice note -----------------------------------------------------
  if (step === "voice") {
    return (
      <VoiceRecorder
        question={question}
        onClose={() => setStep("mode")}
        onComplete={(uri, secs) => {
          setAudioSeconds(secs)
          setAttachments([{ uri, type: "audio" }])
          setMode("voice")
          // As above: the previous take's text and transcript do not describe
          // this recording.
          setText("")
          setTranscript(null)
          setStep("review")
          void runTranscription(uri)
        }}
      />
    )
  }

  // ---- 3D: write it -------------------------------------------------------
  if (step === "write") {
    return (
      <SafeAreaView style={s.screen} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 4 : 0}
        >
          <View style={s.topBar}>
            <TouchableOpacity onPress={() => setStep("mode")} hitSlop={12}>
              <Text style={s.topBarAction}>‹ Back</Text>
            </TouchableOpacity>
            <Text style={s.topBarDate}>{text.length > 0 ? `${text.length}` : ""}</Text>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: sp.lg, paddingBottom: sp.md }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Full question, large, at the top — like v1's composer. */}
            <Text style={s.bigQuestion}>{question}</Text>

            <TextInput
              style={s.bodyInput}
              value={text}
              onChangeText={setText}
              placeholder="Type your answer…"
              placeholderTextColor={c.textSecondary}
              multiline
              autoFocus
              textAlignVertical="top"
              scrollEnabled={false}
            />

            {attachments.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: sp.md }}>
                {attachments.map((a, i) => (
                  <View key={`${a.uri}-${i}`} style={s.thumb}>
                    {a.type === "audio" ? (
                      <View style={s.audioThumb}>
                        <MaterialCommunityIcons name="waveform" size={26} color={c.text} />
                      </View>
                    ) : (
                      <Image source={{ uri: a.uri }} style={s.thumbImg} />
                    )}
                    <TouchableOpacity
                      style={s.thumbX}
                      onPress={() => setAttachments((p) => p.filter((_, j) => j !== i))}
                    >
                      <Text style={s.thumbXText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </ScrollView>

          {/* Attachment toolbar — the surface that was missing. */}
          {/* Media actions + Next sit above the keyboard; the answer itself is
              typed inline on the page above, not in a chat bar. */}
          <View style={s.toolbar}>
            <Pressable onPress={pickPhotos} style={s.toolBtn} accessibilityLabel="Photos">
              <MaterialCommunityIcons name="image-multiple-outline" size={22} color={c.text} />
            </Pressable>
            <Pressable onPress={takePhoto} style={s.toolBtn} accessibilityLabel="Camera">
              <MaterialCommunityIcons name="camera-outline" size={22} color={c.text} />
            </Pressable>
            <Text style={s.charCount}>{text.length}</Text>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={() => setStep("review")}
              disabled={!text.trim() && attachments.length === 0}
              style={({ pressed }) => [
                s.nextInline,
                !text.trim() && attachments.length === 0 ? s.nextInlineDisabled : null,
                pressed ? { transform: [{ translateY: 2 }] } : null,
              ]}
            >
              <Text style={s.nextInlineText}>Next</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    )
  }

  // ---- 3E: review & share ------------------------------------------------
  return (
    <SafeAreaView style={s.screen} edges={["top", "bottom"]}>
      <View style={s.topBar}>
        <TouchableOpacity
          onPress={() => setStep(isJournal ? "journal" : mode === "text" ? "write" : "mode")}
          hitSlop={12}
        >
          <Text style={s.topBarAction}>
            ‹ {isJournal ? "Photos" : mode === "text" ? "Edit" : "Retake"}
          </Text>
        </TouchableOpacity>
        <Text style={s.topBarDate}>Review</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: sp.lg }}>
        <View style={s.previewCard}>
          {/* Deliberately built like ThreadItem's own-answer card — same avatar
              size, same "You", same blue YOUR ANSWER badge — so the review screen
              is a true preview of what lands in the thread. */}
          <View style={s.previewHead}>
            <AvatarStack
              members={[
                {
                  id: user?.id ?? "me",
                  name: profile?.name ?? "You",
                  avatar_url: profile?.avatar_url ?? null,
                },
              ]}
              size={40}
            />
            <Text style={s.previewAuthor}>You</Text>
          </View>

          {attachments.some((a) => a.type === "audio") ? (
            <AudioPlayer
              uri={attachments.find((a) => a.type === "audio")!.uri}
              seconds={audioSeconds}
            />
          ) : null}

          {attachments.filter((a) => a.type !== "audio").length > 0 ? (
            <MediaCarousel
              urls={attachments.filter((a) => a.type !== "audio").map((a) => a.uri)}
              types={attachments.filter((a) => a.type !== "audio").map((a) => a.type)}
              captions={isJournal ? captions : undefined}
              days={isJournal ? attachments.filter((a) => a.type === "photo").map((a) => a.day ?? null) : undefined}
            />
          ) : null}

          {transcribing ? (
            <View style={s.transcribingRow}>
              <ActivityIndicator size="small" color={c.textSecondary} />
              <Text style={s.transcribingText}>Transcribing…</Text>
            </View>
          ) : null}

          {text ? <Text style={s.previewBody}>{text}</Text> : null}

          {/* The toggle existed but nothing ever rendered the transcript, so
              switching it on appeared to do nothing at all. */}
          {includeTranscript && transcript && mode !== "text" ? (
            <Text style={s.previewTranscript}>{transcript}</Text>
          ) : null}
        </View>

        {transcript && mode !== "text" ? (
          <View style={s.transcriptRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.transcriptLabel}>Include transcript</Text>
              <Text style={s.transcriptHint}>So people can read instead of listen.</Text>
            </View>
            <Switch
              value={includeTranscript}
              onValueChange={setIncludeTranscript}
              trackColor={{ true: c.green, false: c.textSecondary }}
            />
          </View>
        ) : null}

        <View style={s.shareHeader}>
          <Text style={s.shareTitle}>Sharing to</Text>
          <View style={s.shareRule} />
          <Text style={s.shareCount}>
            {selected.length} of {groups.length}
          </Text>
        </View>

        {groups.length === 0 ? (
          <View style={s.noGroups}>
            <Text style={s.noGroupsEmoji}>👋</Text>
            <Text style={s.noGroupsTitle}>We&rsquo;ll invite your group in a second!</Text>
            <Text style={s.noGroupsText}>
              Everyone will see your answer and add their own.
            </Text>
          </View>
        ) : (
          groups.map((g) => {
            const on = !excluded.has(g.id)
            return (
              <View key={g.id} style={[s.groupToggleRow, !on ? s.groupToggleRowOff : null]}>
                <AvatarStack members={g.members} size={30} />
                <Text style={[s.groupToggleName, !on ? s.groupToggleNameOff : null]}>{g.name}</Text>
                <Switch
                  value={on}
                  onValueChange={() => toggleGroup(g.id)}
                  trackColor={{ true: c.green, false: c.textSecondary }}
                />
              </View>
            )
          })
        )}
      </ScrollView>

      <View style={s.postBar}>
        {/* Bevel on the OUTER view — overflow:"hidden" on the shadow-caster clips it. */}
        <Pressable
          onPress={onPost}
          disabled={posting}
          style={({ pressed }) => [s.ctaShadow, pressed ? s.ctaPressed : null]}
        >
          <View style={s.cta}>
            {posting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.ctaText}>Post answer</Text>
            )}
          </View>
        </Pressable>
        <Text style={s.postHint}>
          {groups.length > 0 ? "Unlocks all your groups for today" : "Unlocks today for you"}
        </Text>
      </View>
    </SafeAreaView>
  )
}

function ToolBtn({
  icon,
  label,
  onPress,
  c,
}: {
  icon: string
  label: string
  onPress: () => void
  c: ReturnType<typeof useV2Colors>["c"]
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        paddingHorizontal: sp.sm,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <MaterialCommunityIcons name={icon as any} size={22} color={c.text} />
      <Text style={{ fontSize: 10, color: c.textSecondary, marginTop: 2, fontWeight: "600" }}>
        {label}
      </Text>
    </Pressable>
  )
}

function makeStyles(c: ReturnType<typeof useV2Colors>["c"], isDark: boolean) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: sp.lg,
      paddingVertical: sp.sm,
    },
    topBarAction: { color: c.text, fontWeight: "700", fontSize: 15 },
    topBarDate: { color: c.textSecondary, fontWeight: "600" },

    questionBanner: {
      backgroundColor: c.accent,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 14,
      padding: sp.lg,
      marginBottom: sp.lg,
    },
    questionBannerText: { fontSize: 20, fontWeight: "800", color: c.accentInk, lineHeight: 25 },
    // The mode step's own banner. Kept separate from questionBanner because the
    // Sunday journal screen shares that one and is not centred or logo'd.
    modeBanner: {
      backgroundColor: c.accent,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 14,
      padding: sp.lg,
      marginBottom: sp.lg,
      alignItems: "flex-start",
    },
    modeBannerText: {
      fontSize: 20,
      fontWeight: "800",
      color: c.accentInk,
      lineHeight: 25,
    },
    doorTitleRow: { flexDirection: "row", alignItems: "center", gap: sp.sm },
    newTag: {
      backgroundColor: "#F0D7FF",
      borderWidth: 1.5,
      borderColor: "#000000",
      borderRadius: 999,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    // Black on violet in both themes: the tint is a light violet either way, so
    // c.text (near-white in dark) would vanish on it.
    newTagText: { color: "#000000", fontWeight: "800", fontSize: 10, letterSpacing: 0.4 },
    journalFallback: { marginTop: sp.lg, alignItems: "center" },
    journalFallbackText: {
      fontSize: 13,
      color: c.textSecondary,
      textAlign: "center",
      lineHeight: 19,
    },
    journalFallbackLink: { color: c.blue, fontWeight: "800", textDecorationLine: "underline" },
    questionBannerSub: {
      fontSize: 13,
      fontWeight: "600",
      color: c.accentInk,
      opacity: 0.8,
      lineHeight: 18,
      marginTop: 6,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.6,
      color: c.textSecondary,
      marginBottom: sp.sm,
    },
    /** Sits directly above the question card, same weight as sectionLabel. */
    dayTag: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.8,
      color: c.textSecondary,
      marginBottom: 6,
    },
    /** Deliberately quiet — a reassurance, not an instruction. */
    shareNote: {
      fontSize: 12,
      lineHeight: 17,
      color: c.textSecondary,
      marginTop: sp.md,
      paddingHorizontal: 2,
    },

    door: {
      flexDirection: "row",
      alignItems: "center",
      gap: sp.md,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 14,
      padding: sp.md,
      marginBottom: sp.md,
      shadowColor: c.border,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 4,
    },
    doorPressed: {
      transform: [{ translateY: 4 }],
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      elevation: 0,
    },
    doorIcon: {
      width: 46,
      height: 46,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    doorTitle: { fontSize: 16, fontWeight: "800", color: c.text },
    doorSub: { fontSize: 12, color: c.textSecondary, marginTop: 1 },
    doorChevron: { fontSize: 22, color: c.textSecondary },

    hintBox: {
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: c.border,
      borderRadius: 12,
      padding: sp.md,
      marginTop: sp.sm,
    },
    hintText: { color: c.textSecondary, fontSize: 12, textAlign: "center" },

    bigQuestion: {
      fontSize: 24,
      fontWeight: "800",
      color: c.text,
      lineHeight: 30,
      letterSpacing: -0.4,
      marginBottom: sp.lg,
    },
    bodyInput: { color: c.text, fontSize: 17, lineHeight: 24, minHeight: 140 },

    toolbar: {
      flexDirection: "row",
      alignItems: "center",
      gap: sp.sm,
      paddingHorizontal: sp.md,
      paddingTop: sp.sm,
      paddingBottom: sp.lg,
      borderTopWidth: 2,
      borderTopColor: c.border,
      backgroundColor: c.surface,
    },
    toolBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    nextInline: {
      backgroundColor: c.pink,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 22,
      paddingHorizontal: 24,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: c.border,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    nextInlineDisabled: { opacity: 0.4 },
    nextInlineText: { color: "#fff", fontWeight: "800", fontSize: 16 },
    attachBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.bg,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 2,
    },
    sendInput: {
      flex: 1,
      maxHeight: 110,
      minHeight: 42,
      backgroundColor: c.surfaceAlt,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 21,
      paddingHorizontal: sp.md,
      paddingTop: 10,
      paddingBottom: 10,
      color: c.text,
      fontSize: 15,
    },
    sendBtn: {
      backgroundColor: c.pink,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 21,
      paddingHorizontal: 16,
      height: 42,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 2,
    },
    sendBtnDisabled: { opacity: 0.4 },
    sendBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
    charCount: { color: c.textSecondary, fontSize: 12, paddingRight: sp.sm },

    thumb: { marginRight: sp.sm, position: "relative" },
    thumbImg: {
      width: 84,
      height: 84,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.border,
    },
    audioThumb: {
      width: 84,
      height: 84,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.border,
      backgroundColor: c.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    thumbX: {
      position: "absolute",
      top: -6,
      right: 2,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: c.red,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    thumbXText: { color: "#fff", fontSize: 11, fontWeight: "800" },

    voiceWrap: { flex: 1, justifyContent: "center", paddingHorizontal: sp.lg },

    nextBtn: {
      backgroundColor: c.pink,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 18,
      paddingHorizontal: sp.lg,
      paddingVertical: 6,
    },
    nextBtnDisabled: { opacity: 0.4 },
    nextBtnText: { color: "#fff", fontWeight: "800" },

    // Mirrors ThreadItem card + cardMine exactly (blue border marks it as yours).
    previewCard: {
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.blue,
      borderRadius: 14,
      padding: sp.md,
      marginBottom: sp.lg,
    },
    previewHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: sp.sm },
    previewAuthor: { fontWeight: "800", color: c.text, fontSize: 14 },
    previewBadge: {
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0.4,
      backgroundColor: c.blue,
      color: "#fff",
      borderWidth: 1,
      borderColor: c.blue,
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 2,
      overflow: "hidden",
    },
    previewBody: { color: c.text, fontSize: 15, lineHeight: 21 },
    transcribingRow: { flexDirection: "row", alignItems: "center", gap: sp.sm, marginBottom: sp.sm },
    transcribingText: { color: c.textSecondary, fontSize: 13, fontStyle: "italic" },

    previewTranscript: {
      fontSize: 14,
      lineHeight: 20,
      color: c.textSecondary,
      fontStyle: "italic",
      marginTop: sp.sm,
    },
    transcriptRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: sp.md,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 14,
      padding: sp.md,
      marginBottom: sp.lg,
    },
    transcriptLabel: { fontWeight: "800", color: c.text },
    transcriptHint: { fontSize: 12, color: c.textSecondary, marginTop: 1 },

    shareHeader: { flexDirection: "row", alignItems: "center", gap: sp.sm, marginBottom: sp.sm },
    shareTitle: { fontWeight: "800", color: c.text, fontSize: 15 },
    shareRule: { flex: 1, height: 1, backgroundColor: c.border, opacity: 0.3 },
    shareCount: { color: c.textSecondary, fontSize: 12, fontWeight: "700" },

    groupToggleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: sp.md,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 14,
      padding: sp.md,
      marginBottom: sp.sm,
    },
    groupToggleRowOff: { opacity: 0.55 },
    groupToggleName: { flex: 1, fontSize: 16, fontWeight: "800", color: c.text },
    groupToggleNameOff: { color: c.textSecondary },

    // Solid and warm rather than a dashed grey box: this is good news, not a
    // validation warning about a missing group.
    // Inverted against the page — black on cream, violet on black — matching the
    // create/join CTA on Today so the two groupless moments look like one idea.
    noGroups: {
      backgroundColor: isDark ? "#F0D7FF" : "#000000",
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 14,
      padding: sp.lg,
      alignItems: "center",
    },
    noGroupsEmoji: { fontSize: 30, marginBottom: sp.sm },
    noGroupsTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: isDark ? "#000000" : "#FFFFFF",
      textAlign: "center",
    },
    noGroupsText: {
      color: isDark ? "#000000" : "#FFFFFF",
      opacity: 0.85,
      textAlign: "center",
      lineHeight: 21,
      fontSize: 14,
      marginTop: 4,
    },

    postBar: { padding: sp.lg, borderTopWidth: 1, borderTopColor: c.border },
    ctaShadow: {
      borderRadius: 26,
      shadowColor: c.border,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 5,
    },
    ctaPressed: {
      transform: [{ translateY: 5 }],
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      elevation: 0,
    },
    cta: {
      backgroundColor: c.pink,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 26,
      paddingVertical: 15,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 56,
      overflow: "hidden",
    },
    ctaText: { color: "#fff", fontWeight: "800", fontSize: 16 },
    postHint: { textAlign: "center", color: c.textSecondary, fontSize: 12, marginTop: sp.sm },
  })
}
