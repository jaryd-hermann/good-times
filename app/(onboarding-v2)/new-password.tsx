import { useEffect, useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { supabase } from "../../lib/supabase"
import * as haptics from "../../lib/v2/haptics"
import { routeAfterAuth } from "../../lib/v2/onboarding"

const COLORS = {
  beige: "#E8E0D5",
  white: "#FFFFFF",
  text: "#000000",
  muted: "#808080",
  pink: "#D97393",
  error: "#B23B3B",
}

/**
 * Set a new password from a recovery link.
 *
 * Opening the emailed link puts Supabase into a temporary recovery session, so
 * updateUser() is authenticated without the old password. If that session is
 * missing the link was already used or expired — say so plainly and send them back
 * to request another, rather than failing on submit.
 *
 * Tokens can arrive in the URL fragment as well, so `access_token`/`refresh_token`
 * params are honoured when the root deep-link handler hasn't already consumed them.
 */
export default function ResetPasswordScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ access_token?: string; refresh_token?: string }>()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (params.access_token && params.refresh_token) {
          await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          })
        }
        const { data } = await supabase.auth.getSession()
        if (!cancelled) setReady(!!data.session)
      } catch {
        if (!cancelled) setReady(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [params.access_token, params.refresh_token])

  async function submit() {
    if (password.length < 6) {
      Alert.alert("Too short", "Use at least 6 characters.")
      return
    }
    if (password !== confirm) {
      Alert.alert("Passwords don't match", "Please retype them.")
      return
    }
    haptics.commit()
    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      haptics.success()
      const { data } = await supabase.auth.getSession()
      // The recovery session is a real session — they're signed in already.
      router.replace(
        data.session?.user ? await routeAfterAuth(data.session.user.id) : "/(onboarding-v2)/auth"
      )
    } catch (e) {
      haptics.warn()
      Alert.alert("Couldn't update password", (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={s.screen} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Text style={s.title}>Set a new password</Text>

          {ready === null ? (
            <ActivityIndicator color={COLORS.text} style={{ marginTop: 24 }} />
          ) : ready === false ? (
            <>
              <Text style={s.error}>
                This reset link has expired or was already used. Request a new one and it&rsquo;ll
                work straight away.
              </Text>
              <Pressable
                onPress={() => {
                  haptics.tap()
                  router.replace("/(onboarding-v2)/forgot")
                }}
                style={({ pressed }) => [s.ctaShadow, pressed ? s.ctaPressed : null]}
              >
                <View style={s.ctaInner}>
                  <Text style={s.ctaText}>Request a new link</Text>
                </View>
              </Pressable>
            </>
          ) : (
            <>
              <TextInput
                style={s.input}
                value={password}
                onChangeText={setPassword}
                placeholder="New password"
                placeholderTextColor={COLORS.muted}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                autoFocus
              />
              <TextInput
                style={s.input}
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Confirm new password"
                placeholderTextColor={COLORS.muted}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
              />
              <Pressable
                onPress={submit}
                disabled={busy}
                style={({ pressed }) => [s.ctaShadow, pressed ? s.ctaPressed : null]}
              >
                <View style={s.ctaInner}>
                  {busy ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={s.ctaText}>Save password</Text>
                  )}
                </View>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.beige },
  scroll: { flexGrow: 1, padding: 20, paddingTop: 48 },
  title: {
    fontFamily: "PMGothicLudington-Text115",
    fontSize: 30,
    color: COLORS.text,
    marginBottom: 20,
  },
  error: {
    fontFamily: "Roboto-Regular",
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.error,
    marginBottom: 20,
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.text,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 16,
  },
  // Bevel on the OUTER view — overflow:"hidden" here would clip the shadow away.
  ctaShadow: {
    borderRadius: 28,
    shadowColor: COLORS.text,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  ctaInner: {
    backgroundColor: COLORS.pink,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: COLORS.text,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 58,
    overflow: "hidden",
  },
  ctaPressed: {
    transform: [{ translateY: 5 }],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaText: { fontFamily: "Roboto-Bold", fontSize: 18, color: COLORS.white },
})
