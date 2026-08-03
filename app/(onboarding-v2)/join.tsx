import { useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { supabase } from "../../lib/supabase"
import { useV2Colors, v2Spacing as sp } from "../../lib/v2/theme"
import { peekInvite, readInviteCodeFromClipboard } from "../../lib/v2/onboarding"

/**
 * Invite code entry — the universal fallback for the App Store round-trip.
 *
 * An install from the store strips all link context, so this is the path that
 * works 100% of the time without Branch/AppsFlyer. It also fixes v1's dead-end
 * "Join Group" button, which opened an explainer modal with no code entry anywhere
 * in the app.
 *
 * Two ways in:
 *  1. The OS paste suggestion above the keyboard. The field is a plain text input,
 *     so iOS QuickType / Gboard offer the copied code as a tap — no permission
 *     prompt and no paste banner, because WE never read the clipboard.
 *     (`textContentType="oneTimeCode"` deliberately NOT used: that mechanism is
 *     SMS-driven and our code comes from a web page.)
 *  2. The explicit "Paste invite code" button below, which does read the clipboard
 *     — user-initiated, so iOS's paste banner appears in a context that makes sense.
 *     Never on launch.
 */
export default function JoinScreen() {
  const router = useRouter()
  const { c } = useV2Colors()
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const s = makeStyles(c)

  async function pasteFromClipboard() {
    const found = await readInviteCodeFromClipboard()
    if (found) setCode(found)
    else Alert.alert("Nothing to paste", "Copy the invite code or link first.")
  }

  async function join() {
    const t = code.trim()
    if (!t) return
    setBusy(true)
    try {
      const peek = await peekInvite(t)
      if ("error" in peek) {
        Alert.alert(
          "That code didn't work",
          peek.error === "expired"
            ? "This invite has expired. Ask for a new one."
            : peek.error === "revoked"
              ? "This invite was turned off."
              : "Check the code and try again."
        )
        return
      }

      const { data } = await supabase.auth.getUser()
      const uid = data.user?.id
      if (!uid) {
        // Not signed in yet — carry the code through auth as a param so nothing
        // can silently drop it (v1 lost pending joins via an AsyncStorage key).
        router.replace({ pathname: "/(onboarding-v2)/splash", params: { invite: t } })
        return
      }

      // Confirm before joining, exactly as a tapped link does. A mistyped or
      // mis-pasted code should be caught by seeing the wrong group's name, not
      // after you are already in someone else's chat.
      router.replace({ pathname: "/(onboarding-v2)/invite", params: { token: t } })
    } catch (e) {
      Alert.alert("Couldn't join", (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={s.body}>
          <Text style={s.title}>Have an invite code?</Text>
          <Text style={s.sub}>
            It looks like <Text style={s.mono}>GT-7F3K</Text>. It&rsquo;s on the invite page
            you opened, or in the message your friend sent.
          </Text>

          <TextInput
            style={s.input}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="GT-••••"
            placeholderTextColor={c.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            returnKeyType="go"
            onSubmitEditing={join}
          />

          <TouchableOpacity onPress={pasteFromClipboard}>
            <Text style={s.pasteLink}>Paste invite code</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.cta, !code.trim() ? s.ctaDisabled : null]}
            onPress={join}
            disabled={busy || !code.trim()}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.ctaText}>Join group</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.skip}>Back</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useV2Colors>["c"]) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    body: { flex: 1, justifyContent: "center", padding: sp.xl, gap: sp.md },
    title: { fontSize: 26, fontWeight: "800", color: c.text },
    sub: { color: c.textSecondary, lineHeight: 21 },
    mono: { fontWeight: "800", color: c.text },
    input: {
      backgroundColor: c.surfaceAlt,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 12,
      padding: sp.md,
      fontSize: 24,
      fontWeight: "800",
      letterSpacing: 3,
      textAlign: "center",
      color: c.text,
    },
    pasteLink: { textAlign: "center", color: c.blue, fontWeight: "700" },
    cta: {
      backgroundColor: c.pink,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 28,
      paddingVertical: 16,
      alignItems: "center",
    },
    ctaDisabled: { opacity: 0.45 },
    ctaText: { color: "#fff", fontWeight: "800", fontSize: 17 },
    skip: { textAlign: "center", color: c.textSecondary, fontWeight: "600" },
  })
}
