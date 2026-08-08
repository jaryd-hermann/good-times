import { useRef, useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useAuth } from "../../components/AuthProvider"
import { supabase } from "../../lib/supabase"
import { useV2Colors, v2Spacing as sp } from "../../lib/v2/theme"
import * as haptics from "../../lib/v2/haptics"
import { BackHeader } from "../../components/v2/AppHeader"

const MIN = 10
const MAX = 300

/**
 * Suggest a question.
 *
 * Goes through v2_suggest_question rather than inserting into the table, because
 * RLS is off on this database: a direct insert would let any client write any
 * name and email onto a submission. The RPC looks the submitter up server-side
 * from their user id, so attribution cannot be forged.
 *
 * Deliberately not a fire-and-forget: the confirmation state is the whole point
 * of the ask ("confirm with user their question was sent to us"), so the screen
 * switches to a sent state instead of just popping back.
 */
export default function SuggestQuestionScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const { c } = useV2Colors()
  const s = makeStyles(c)

  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const inputRef = useRef<TextInput>(null)

  const trimmed = text.trim()
  const canSend = trimmed.length >= MIN && trimmed.length <= MAX && !busy

  async function send() {
    if (!canSend || !user?.id) return
    setBusy(true)
    try {
      const { data, error } = await supabase.rpc("v2_suggest_question", {
        p_user_id: user.id,
        p_question: trimmed,
      })
      if (error) throw error
      const res = data as { ok?: boolean; error?: string } | null
      if (!res?.ok) {
        // Server-side rules, surfaced in the words they were written for rather
        // than as a raw error code.
        const msg =
          res?.error === "rate_limited"
            ? "That's a lot of ideas at once. Try again a bit later."
            : res?.error === "too_short"
              ? "Give us a little more to go on."
              : res?.error === "too_long"
                ? "That's a bit long for a question."
                : "That didn't send. Try again."
        Alert.alert("Couldn't send", msg)
        return
      }
      haptics.commit()
      setSent(true)
    } catch (e) {
      Alert.alert("Couldn't send", (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // ---- sent -------------------------------------------------------------
  if (sent) {
    return (
      <SafeAreaView style={s.screen} edges={["top", "bottom"]}>
        <BackHeader title="Suggest a question" />
        <View style={s.doneWrap}>
          <View style={s.doneIcon}>
            <MaterialCommunityIcons name="check" size={34} color="#fff" />
          </View>
          <Text style={s.doneTitle}>Got it — thank you</Text>
          <Text style={s.doneSub}>
            Your question is with us. If we use it, you&rsquo;ll see it come round as a
            daily question for everyone.
          </Text>
          <View style={s.quoteBox}>
            <Text style={s.quoteText}>{trimmed}</Text>
          </View>

          <Pressable
            onPress={() => {
              haptics.tap()
              setText("")
              setSent(false)
              inputRef.current?.focus()
            }}
            style={({ pressed }) => [s.secondary, pressed ? { opacity: 0.7 } : null]}
          >
            <Text style={s.secondaryText}>Suggest another</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              haptics.tap()
              router.back()
            }}
            style={({ pressed }) => [s.ctaShadow, pressed ? s.ctaPressed : null]}
          >
            <View style={s.cta}>
              <Text style={s.ctaText}>Done</Text>
            </View>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  // ---- compose ----------------------------------------------------------
  return (
    <SafeAreaView style={s.screen} edges={["top", "bottom"]}>
      <BackHeader title="Suggest a question" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: sp.lg }} keyboardShouldPersistTaps="handled">
          <Text style={s.lede}>
            What would you want your people to answer? The best ones are specific, easy
            to answer honestly, and hard to answer in one word.
          </Text>

          <TextInput
            ref={inputRef}
            style={s.input}
            value={text}
            onChangeText={setText}
            placeholder="e.g. What's the last thing that made you properly laugh?"
            placeholderTextColor={c.textSecondary}
            multiline
            autoFocus
            maxLength={MAX}
            textAlignVertical="top"
          />

          <View style={s.metaRow}>
            <Text style={s.hint}>
              {trimmed.length < MIN
                ? `${MIN - trimmed.length} more character${MIN - trimmed.length === 1 ? "" : "s"}`
                : "Looks good"}
            </Text>
            {/* Only near the ceiling — a counter from character one just adds noise. */}
            <Text style={[s.hint, trimmed.length > MAX - 40 ? s.hintWarn : null]}>
              {trimmed.length > MAX - 60 ? `${trimmed.length}/${MAX}` : ""}
            </Text>
          </View>

          <Pressable
            onPress={send}
            disabled={!canSend}
            style={({ pressed }) => [
              s.ctaShadow,
              { marginTop: sp.lg },
              pressed ? s.ctaPressed : null,
              !canSend ? { opacity: 0.45 } : null,
            ]}
          >
            <View style={s.cta}>
              <Text style={s.ctaText}>{busy ? "Sending…" : "Send it in"}</Text>
            </View>
          </Pressable>

          <Text style={s.fineprint}>
            We&rsquo;ll see your name with it so we can say thanks.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useV2Colors>["c"]) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    lede: { fontSize: 15, lineHeight: 22, color: c.textSecondary, marginBottom: sp.lg },
    input: {
      minHeight: 130,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 14,
      padding: sp.md,
      fontSize: 17,
      lineHeight: 24,
      color: c.text,
    },
    metaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: sp.sm,
    },
    hint: { fontSize: 12, color: c.textSecondary, fontWeight: "600" },
    hintWarn: { color: c.red },

    /** Same bevel as the other primary CTAs: hard shadow, press translates into it. */
    ctaShadow: {
      borderRadius: 28,
      shadowColor: c.border,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 5,
      alignSelf: "stretch",
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
      borderRadius: 28,
      paddingVertical: 15,
      alignItems: "center",
      minHeight: 54,
      justifyContent: "center",
    },
    ctaText: { color: "#fff", fontWeight: "800", fontSize: 17 },
    fineprint: {
      fontSize: 12,
      color: c.textSecondary,
      textAlign: "center",
      marginTop: sp.md,
    },

    doneWrap: { flex: 1, padding: sp.xl, alignItems: "center", justifyContent: "center" },
    doneIcon: {
      width: 62,
      height: 62,
      borderRadius: 31,
      backgroundColor: c.green,
      borderWidth: 2,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: sp.lg,
    },
    doneTitle: { fontSize: 24, fontWeight: "800", color: c.text, textAlign: "center" },
    doneSub: {
      fontSize: 15,
      lineHeight: 22,
      color: c.textSecondary,
      textAlign: "center",
      marginTop: sp.sm,
    },
    /** Reads their words back, so "sent" is evidenced rather than asserted. */
    quoteBox: {
      backgroundColor: c.surfaceAlt,
      borderLeftWidth: 3,
      borderLeftColor: c.pink,
      borderRadius: 8,
      padding: sp.md,
      marginTop: sp.lg,
      alignSelf: "stretch",
    },
    quoteText: { fontSize: 15, lineHeight: 22, color: c.text, fontStyle: "italic" },
    secondary: { paddingVertical: sp.md, marginTop: sp.lg },
    secondaryText: { color: c.blue, fontWeight: "700", fontSize: 15 },
  })
}
