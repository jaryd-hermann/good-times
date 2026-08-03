import { useEffect, useState } from "react"
import {
  View,
  Text,
  Image,
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
import * as WebBrowser from "expo-web-browser"
import * as AppleAuthentication from "expo-apple-authentication"
import Svg, { Path } from "react-native-svg"
import { supabase } from "../../lib/supabase"
import * as haptics from "../../lib/v2/haptics"
import { routeAfterAuth } from "../../lib/v2/onboarding"
import { v2Analytics } from "../../lib/v2/analytics"

const COLORS = {
  beige: "#E8E0D5",
  white: "#FFFFFF",
  text: "#000000",
  muted: "#808080",
  blue: "#3A5F8C",
  pink: "#D97393",
}

type Provider = "google" | "apple"

/**
 * Auth — Apple, Google, or email, same as v1.
 *
 * OAuth mirrors v1's flow exactly: ask Supabase for the URL with
 * skipBrowserRedirect, open it ourselves via WebBrowser, then turn the callback
 * into a session — hash tokens go through setSession, a `?code=` goes through
 * exchangeCodeForSession (PKCE).
 *
 * Google gets `prompt=select_account` and an ephemeral session so it always shows
 * the account picker; Apple must NOT be ephemeral or it loses the iCloud cookies
 * it needs. That asymmetry is deliberate and was learned the hard way in v1.
 *
 * The invite token travels as a route param, never AsyncStorage — that's what made
 * v1 silently drop pending group joins.
 */
export default function AuthScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ invite?: string }>()
  const [busy, setBusy] = useState<string | null>(null)
  const [emailMode, setEmailMode] = useState(false)

  useEffect(() => {
    v2Analytics.authViewed()
  }, [])

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  /**
   * Send the user where their data says they belong — never assume "new".
   * Only a user still missing a profile carries the invite onward; for everyone
   * else routeAfterAuth has already redeemed it.
   */
  async function next(userId: string) {
    const dest = await routeAfterAuth(userId, params.invite)
    router.replace(
      dest === "/(onboarding-v2)/profile" && params.invite
        ? { pathname: dest, params: { invite: params.invite } }
        : dest
    )
  }

  /**
   * Returns whether this was a first-ever sign-in.
   *
   * OAuth gives no reliable "new account" flag — Supabase returns a session either
   * way — and the upsert alone cannot tell us. Checking for the row first is the
   * one honest signal, and it is the difference between signed_up and signed_in
   * being meaningful for Apple and Google.
   */
  async function ensureUserRow(id: string, mail?: string | null) {
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("id", id)
      .maybeSingle()
    await supabase.from("users").upsert({ id, email: mail ?? "" }, { onConflict: "id" })
    return { isNew: !existing }
  }

  /**
   * Native Sign in with Apple — no browser, no domain prompt.
   *
   * The web flow made iOS show:
   *   "GoodTimes Wants to Use ytnnsykbgohiscfgomfe.supabase.co to Sign In"
   * because ASWebAuthenticationSession names the DOMAIN it is about to share
   * cookies with, and it can never be given an app name instead. Apple's native
   * sheet has no such prompt — it just shows the app.
   *
   * Falls back to the web flow if the native sheet is unavailable (simulator
   * without an iCloud account, or a device below iOS 13).
   */
  async function appleNative() {
    haptics.commit()
    setBusy("apple")
    try {
      if (!(await AppleAuthentication.isAvailableAsync())) return oauth("apple")

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      })
      if (!credential.identityToken) throw new Error("Apple did not return a token")

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      })
      if (error) throw error
      if (!data.user) throw new Error("No session after sign-in")

      // Apple only sends the name on the FIRST authorisation, ever. If we don't
      // capture it here it is gone for good.
      const appleName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(" ")
        .trim()
      const { isNew } = await ensureUserRow(data.user.id, data.user.email)
      if (appleName) {
        await supabase
          .from("users")
          .update({ name: appleName })
          .eq("id", data.user.id)
          .is("name", null)
      }

      if (isNew) v2Analytics.signedUp("apple")
      else v2Analytics.signedIn("apple")
      haptics.success()
      await next(data.user.id)
    } catch (e) {
      const msg = (e as Error).message ?? ""
      // The user tapping Cancel on Apple's sheet is not an error worth alerting.
      if (/ERR_REQUEST_CANCELED|canceled|cancelled/i.test(msg)) {
        setBusy(null)
        return
      }
      haptics.warn()
      Alert.alert("Apple sign-in failed", msg)
    } finally {
      setBusy(null)
    }
  }

  async function oauth(provider: Provider) {
    haptics.commit()
    setBusy(provider)
    const redirectTo = "goodtimes://"
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          ...(provider === "google" && {
            queryParams: { prompt: "select_account", access_type: "offline" },
          }),
        },
      })
      if (error) throw error
      if (!data?.url) throw new Error("No sign-in URL returned")

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo,
        Platform.OS === "ios" ? { preferEphemeralSession: provider === "google" } : undefined
      )
      if (result.type !== "success" || !("url" in result)) {
        setBusy(null)
        return // user dismissed
      }

      const url = result.url
      let session = null

      // Implicit flow: tokens arrive in the fragment.
      const hash = url.includes("#") ? url.split("#")[1] : ""
      const hashParams = new URLSearchParams(hash)
      const access_token = hashParams.get("access_token")
      const refresh_token = hashParams.get("refresh_token")

      if (access_token && refresh_token) {
        const { data: sd, error: se } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        })
        if (se) throw se
        session = sd.session
      } else {
        // PKCE flow: exchange the code.
        const code = new URL(url).searchParams.get("code")
        if (!code) throw new Error("Sign-in did not return a session")
        const { data: sd, error: se } = await supabase.auth.exchangeCodeForSession(code)
        if (se) throw se
        session = sd.session
      }

      if (!session?.user) throw new Error("No session after sign-in")
      const { isNew } = await ensureUserRow(session.user.id, session.user.email)
      const method = provider === "google" ? "google" : "apple"
      if (isNew) v2Analytics.signedUp(method)
      else v2Analytics.signedIn(method)
      haptics.success()
      await next(session.user.id)
    } catch (e) {
      haptics.warn()
      Alert.alert(
        `${provider === "google" ? "Google" : "Apple"} sign-in failed`,
        (e as Error).message
      )
    } finally {
      setBusy(null)
    }
  }

  /**
   * One email form — we work out new vs returning, the user doesn't.
   *
   * Sign IN first: if the account exists this succeeds and nothing else runs.
   * Only "Invalid login credentials" is ambiguous (no account, or wrong password),
   * so we then attempt sign-up. If THAT reports the user already exists, the
   * password was simply wrong — which is the message worth showing.
   *
   * Deliberately not v1's approach, which inferred the mode from AsyncStorage and
   * fell back to a "No Account Found" modal.
   */
  async function withEmail() {
    const mail = email.trim().toLowerCase()
    if (!mail || password.length < 6) {
      Alert.alert("Check your details", "Enter an email and a password of at least 6 characters.")
      return
    }
    haptics.commit()
    setBusy("email")
    try {
      const signIn = await supabase.auth.signInWithPassword({ email: mail, password })

      if (!signIn.error && signIn.data.user) {
        await ensureUserRow(signIn.data.user.id, signIn.data.user.email)
        v2Analytics.signedIn("email")
        haptics.success()
        return next(signIn.data.user.id)
      }

      const invalid = /invalid login credentials/i.test(signIn.error?.message ?? "")
      if (!invalid) throw signIn.error ?? new Error("Could not sign in")

      const signUp = await supabase.auth.signUp({ email: mail, password })
      if (signUp.error) {
        if (/already registered|already exists/i.test(signUp.error.message)) {
          throw new Error("That password doesn't match this email. Try again.")
        }
        throw signUp.error
      }
      if (!signUp.data.user) {
        throw new Error("Check your email to confirm your account, then come back.")
      }
      await ensureUserRow(signUp.data.user.id, signUp.data.user.email)
      // Only reached by falling through "invalid login credentials", which is the
      // one unambiguous signal this SDK gives that the account did not exist.
      v2Analytics.signedUp("email")
      haptics.success()
      await next(signUp.data.user.id)
    } catch (e) {
      haptics.warn()
      Alert.alert("Couldn't continue", (e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <SafeAreaView style={s.screen} edges={["top", "bottom"]}>
      {/* No padding-based KeyboardAvoidingView here.
          s.scroll centres its content, so re-padding on every keyboard-height
          change shifted everything by half the delta. iOS toggles the AutoFill
          suggestion bar as an email becomes plausible, changing that height on
          nearly every keystroke — hence the jitter on email but not password.
          Native keyboard insets adjust the scroll offset instead of the layout. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? undefined : "height"}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        >
          <Pressable onPress={() => { haptics.tap(); router.back() }} hitSlop={12} style={s.back}>
            <Text style={s.backText}>‹ Back</Text>
          </Pressable>

          <Image
            source={require("../../assets/images/wordmark.png")}
            style={s.wordmark}
            resizeMode="contain"
          />
          <Text style={s.tagline}>Answer one question a day with friends</Text>

          {!emailMode ? (
            <View style={s.providers}>
              <Pressable
                onPress={() => (Platform.OS === "ios" ? appleNative() : oauth("apple"))}
                disabled={!!busy}
                style={({ pressed }) => [s.provider, s.appleBtn, pressed ? s.pressed : null]}
              >
                {busy === "apple" ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <>
                    <AppleMark />
                    <Text style={s.appleText}>Continue with Apple</Text>
                  </>
                )}
              </Pressable>

              <Pressable
                onPress={() => oauth("google")}
                disabled={!!busy}
                style={({ pressed }) => [s.provider, s.googleBtn, pressed ? s.pressed : null]}
              >
                {busy === "google" ? (
                  <ActivityIndicator color={COLORS.text} />
                ) : (
                  <>
                    <GoogleMark />
                    <Text style={s.googleText}>Continue with Google</Text>
                  </>
                )}
              </Pressable>

              <View style={s.orRow}>
                <View style={s.orLine} />
                <Text style={s.orText}>or</Text>
                <View style={s.orLine} />
              </View>

              <Pressable
                onPress={() => { haptics.tap(); setEmailMode(true) }}
                disabled={!!busy}
                style={({ pressed }) => [s.provider, s.emailBtn, pressed ? s.pressed : null]}
              >
                <Text style={s.emailText}>Continue with Email</Text>
              </Pressable>
            </View>
          ) : (
            <View style={s.providers}>
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
              <TextInput
                style={s.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={COLORS.muted}
                secureTextEntry
                autoComplete="password"
                textContentType="password"
              />

              <Pressable
                onPress={withEmail}
                disabled={!!busy}
                style={({ pressed }) => [s.cta, pressed ? s.ctaPressed : null]}
              >
                {busy === "email" ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={s.ctaText}>Continue</Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => {
                  haptics.tap()
                  router.push("/(onboarding-v2)/forgot")
                }}
                hitSlop={8}
              >
                <Text style={s.forgot}>Forgot password?</Text>
              </Pressable>

              <Text style={s.emailHint}>
                New here? We&rsquo;ll create your account. Been here before? We&rsquo;ll sign you in.
              </Text>

              <Pressable onPress={() => { haptics.tap(); setEmailMode(false) }} hitSlop={8}>
                <Text style={s.backToProviders}>Use Google or Apple instead</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function GoogleMark() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.2-.4-4.6H24v9.1h12.4c-.5 2.9-2.1 5.4-4.6 7l7.6 5.9c4.4-4.1 6.7-10.1 6.7-17.4z" />
      <Path fill="#FBBC05" d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C1 16.4 0 20.1 0 24s1 7.6 2.6 10.8l7.8-6.1z" />
      <Path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.4-5.6l-7.6-5.9c-2.1 1.4-4.8 2.3-7.8 2.3-6.3 0-11.7-3.7-13.6-9.1l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </Svg>
  )
}

function AppleMark() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        fill="#FFFFFF"
        d="M16.365 1.43c0 1.14-.42 2.2-1.12 3.02-.85.99-2.23 1.76-3.38 1.66-.13-1.09.42-2.24 1.09-2.98.77-.87 2.13-1.55 3.41-1.7zM20.9 17.1c-.55 1.27-.82 1.83-1.53 2.95-1 1.56-2.4 3.5-4.14 3.51-1.55.02-1.95-1.01-4.05-1-2.1.01-2.54 1.02-4.09 1-1.74-.02-3.07-1.77-4.06-3.32C-.02 16.9-.32 11.7 1.44 8.95c1.02-1.6 2.63-2.62 4.36-2.65 1.66-.03 3.22 1.12 4.23 1.12 1.01 0 2.9-1.38 4.9-1.18.83.04 3.17.34 4.67 2.54-.12.08-2.79 1.63-2.76 4.87.03 3.87 3.39 5.16 3.43 5.18-.03.09-.54 1.85-1.37 3.27z"
      />
    </Svg>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.beige },
  scroll: { flexGrow: 1, padding: 20, justifyContent: "center" },
  back: { position: "absolute", top: 8, left: 20 },
  backText: { fontFamily: "Roboto-Bold", fontSize: 16, color: COLORS.text },

  wordmark: { width: 250, height: 82, alignSelf: "center", marginBottom: 4 },
  tagline: {
    fontFamily: "PMGothicLudington-Text115",
    fontSize: 19,
    color: COLORS.text,
    textAlign: "center",
    marginBottom: 28,
  },

  providers: { gap: 12 },
  provider: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: COLORS.text,
    minHeight: 56,
    paddingHorizontal: 20,
    shadowColor: COLORS.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  pressed: {
    transform: [{ translateY: 4 }],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    elevation: 0,
  },
  googleBtn: { backgroundColor: COLORS.white },
  googleText: { fontFamily: "Roboto-Bold", fontSize: 17, color: COLORS.text },
  appleBtn: { backgroundColor: COLORS.text },
  appleText: { fontFamily: "Roboto-Bold", fontSize: 17, color: COLORS.white },
  emailBtn: { backgroundColor: COLORS.beige },
  emailText: { fontFamily: "Roboto-Bold", fontSize: 17, color: COLORS.text },

  orRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 4 },
  orLine: { flex: 1, height: 1, backgroundColor: COLORS.text, opacity: 0.2 },
  orText: { color: COLORS.muted, fontFamily: "Roboto-Regular", fontSize: 13 },


  input: {
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.text,
    borderRadius: 14,
    padding: 15,
    fontSize: 16,
    color: COLORS.text,
    fontFamily: "Roboto-Regular",
  },
  cta: {
    backgroundColor: COLORS.pink,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: COLORS.text,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.text,
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
  ctaText: { fontFamily: "Roboto-Bold", fontSize: 18, color: COLORS.white },
  forgot: {
    color: COLORS.text,
    fontSize: 14,
    textAlign: "center",
    fontFamily: "Roboto-Bold",
    textDecorationLine: "underline",
  },
  emailHint: {
    color: COLORS.muted,
    fontSize: 13,
    textAlign: "center",
    fontFamily: "Roboto-Regular",
    lineHeight: 18,
  },
  backToProviders: {
    textAlign: "center",
    color: COLORS.text,
    textDecorationLine: "underline",
    fontFamily: "Roboto-Regular",
    marginTop: 4,
  },
})
