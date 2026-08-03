import { useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native"
import { useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { supabase } from "../../lib/supabase"
import * as haptics from "../../lib/v2/haptics"

const COLORS = {
  beige: "#E8E0D5",
  white: "#FFFFFF",
  text: "#000000",
  muted: "#808080",
  pink: "#D97393",
}

/**
 * Request a password reset email.
 *
 * Always reports success, even for an address with no account — telling a stranger
 * which emails are registered is an account-enumeration leak, and Supabase itself
 * returns the same response either way.
 */
export default function ForgotPasswordScreen() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function send() {
    const mail = email.trim().toLowerCase()
    if (!mail) return
    haptics.commit()
    setBusy(true)
    try {
      await supabase.auth.resetPasswordForEmail(mail, {
        redirectTo: "goodtimes://new-password",
      })
      haptics.success()
    } catch {
      // Deliberately swallowed — see the enumeration note above.
    } finally {
      setBusy(false)
      setSent(true)
    }
  }

  return (
    <SafeAreaView style={s.screen} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={() => {
              haptics.tap()
              router.back()
            }}
            hitSlop={12}
            style={s.back}
          >
            <Text style={s.backText}>‹ Back</Text>
          </Pressable>

          <Text style={s.title}>Reset your password</Text>

          {sent ? (
            <>
              <Text style={s.body}>
                If an account exists for {email.trim().toLowerCase()}, a reset link is on its way.
                Open it on this device and you&rsquo;ll be able to set a new password.
              </Text>
              <Pressable
                onPress={() => {
                  haptics.tap()
                  router.back()
                }}
                style={({ pressed }) => [s.ctaShadow, pressed ? s.ctaPressed : null]}
              >
                <View style={s.ctaInner}>
                  <Text style={s.ctaText}>Back to sign in</Text>
                </View>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={s.body}>
                Enter your email and we&rsquo;ll send you a link to set a new one.
              </Text>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={COLORS.muted}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                autoFocus
              />
              <Pressable
                onPress={send}
                disabled={busy || !email.trim()}
                style={({ pressed }) => [
                  s.ctaShadow,
                  pressed ? s.ctaPressed : null,
                  !email.trim() ? s.ctaDisabled : null,
                ]}
              >
                <View style={s.ctaInner}>
                  {busy ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={s.ctaText}>Send reset link</Text>
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
  scroll: { flexGrow: 1, padding: 20 },
  back: { alignSelf: "flex-start", marginBottom: 24 },
  backText: { fontFamily: "Roboto-Bold", fontSize: 17, color: COLORS.text },
  title: {
    fontFamily: "PMGothicLudington-Text115",
    fontSize: 30,
    color: COLORS.text,
    marginBottom: 8,
  },
  body: {
    fontFamily: "Roboto-Regular",
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.muted,
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
  ctaDisabled: { opacity: 0.5 },
  ctaText: { fontFamily: "Roboto-Bold", fontSize: 18, color: COLORS.white },
})
