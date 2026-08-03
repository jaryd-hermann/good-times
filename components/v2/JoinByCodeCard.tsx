import { useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  type ViewStyle,
} from "react-native"
import { useRouter } from "expo-router"
import { useV2Colors, v2Spacing as sp } from "../../lib/v2/theme"
import { peekInvite, readInviteCodeFromClipboard } from "../../lib/v2/onboarding"
import * as haptics from "../../lib/v2/haptics"

/**
 * Paste-a-code-and-join, inline on Today.
 *
 * Most people arrive holding someone else's code rather than wanting to found a
 * group, but the only code entry lived behind the create/join card — two taps and
 * a screen away from where a groupless user actually lands. This puts the single
 * field they need directly under it.
 *
 * Joining still routes through /(onboarding-v2)/invite, so the confirmation
 * (who invited you, who is inside, an explicit way out) is the same one a tapped
 * link gets. A mistyped code has to be caught by seeing the wrong group's name,
 * not after you are already in a stranger's chat.
 *
 * The field is a plain text input on purpose: iOS QuickType offers the copied
 * code above the keyboard with no permission prompt and no paste banner, because
 * we never touch the clipboard unless the user taps "Paste".
 */
export function JoinByCodeCard({ style }: { style?: ViewStyle }) {
  const router = useRouter()
  const { c } = useV2Colors()
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const s = makeStyles(c)

  async function paste() {
    haptics.tap()
    const found = await readInviteCodeFromClipboard()
    if (found) setCode(found)
    else Alert.alert("Nothing to paste", "Copy the invite code or link first.")
  }

  async function join() {
    const t = code.trim()
    if (!t) return
    haptics.commit()
    setBusy(true)
    try {
      // Validate before navigating so a bad code fails here, next to the field
      // that produced it, instead of on a screen that says "that invite didn't
      // work" with no way to correct the typo.
      const peek = await peekInvite(t)
      if ("error" in peek) {
        haptics.warn()
        Alert.alert(
          "That code didn't work",
          peek.error === "expired"
            ? "This invite has expired. Ask for a new one."
            : peek.error === "revoked"
              ? "This invite was turned off."
              : "Check the code and try again.",
        )
        return
      }
      router.push({ pathname: "/(onboarding-v2)/invite", params: { token: t } })
    } catch (e) {
      haptics.warn()
      Alert.alert("Couldn't join", (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={[s.card, style]}>
      <Text style={s.title}>Got a code from a friend?</Text>
      <Text style={s.sub}>
        Paste it here to join their group. It looks like <Text style={s.mono}>GT-7F3K</Text>.
      </Text>

      <View style={s.row}>
        <TextInput
          style={s.input}
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          placeholder="GT-••••"
          placeholderTextColor={c.textSecondary}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={join}
        />
        <Pressable
          onPress={join}
          disabled={busy || !code.trim()}
          style={({ pressed }) => [
            s.cta,
            !code.trim() ? s.ctaDisabled : null,
            pressed ? s.ctaPressed : null,
          ]}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.ctaText}>Join</Text>}
        </Pressable>
      </View>

      <Pressable onPress={paste} hitSlop={8}>
        <Text style={s.pasteLink}>Paste invite code</Text>
      </Pressable>
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useV2Colors>["c"]) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 16,
      padding: sp.lg,
      gap: sp.sm,
    },
    title: { fontSize: 17, fontWeight: "800", color: c.text },
    sub: { fontSize: 14, color: c.textSecondary, lineHeight: 20 },
    mono: { fontWeight: "800", color: c.text },
    row: { flexDirection: "row", gap: sp.sm, alignItems: "stretch", marginTop: 2 },
    input: {
      flex: 1,
      backgroundColor: c.surfaceAlt,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: sp.md,
      paddingVertical: 12,
      fontSize: 18,
      fontWeight: "800",
      letterSpacing: 2,
      color: c.text,
    },
    cta: {
      backgroundColor: c.pink,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: sp.lg,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 84,
    },
    ctaDisabled: { opacity: 0.45 },
    ctaPressed: { transform: [{ translateY: 2 }] },
    ctaText: { color: "#fff", fontWeight: "800", fontSize: 16 },
    pasteLink: { color: c.blue, fontWeight: "700", fontSize: 14, marginTop: 2 },
  })
}
