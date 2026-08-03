import { useEffect, useState } from "react"
import { View, Text, Image, StyleSheet, Pressable, ActivityIndicator } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { useAuth } from "../../components/AuthProvider"
import {
  registerForPushNotifications,
  savePushRegistrationToSupabase,
  markPushOptInRequested,
} from "../../lib/notifications"
import { markOnboarded } from "../../lib/v2/onboarding"
import { supabase } from "../../lib/supabase"
import * as haptics from "../../lib/v2/haptics"
import { v2Analytics } from "../../lib/v2/analytics"

const COLORS = {
  blue: "#4A6D9E",
  cream: "#F2EDE4",
  text: "#000000",
  white: "#FFFFFF",
  muted: "rgba(255,255,255,0.82)",
  pink: "#D97393",
  amber: "#E5A13C",
  red: "#B4534E",
  green: "#4A7A5C",
}

/**
 * Notification opt-in, immediately after the first answer.
 *
 * Placed here on purpose: they have just written something and the natural next
 * thought is "will I know when someone replies?". Asking before the first answer
 * is asking a stranger for a favour.
 *
 * Naming the three notifications is doing the work — iOS gives one shot at the
 * system prompt, and a denial is expensive to
 * reverse (Settings round-trip). "Not now" is deliberately available and plain: a
 * soft no here keeps the real prompt in reserve.
 */
const KINDS = [
  {
    // The app's own mark: this one is from Good Times, not from a person.
    image: require("../../assets/images/icon-ios.png"),
    title: "Today's question, 8am",
    sub: "Your local time, once a day",
  },
  {
    image: require("../../assets/images/julia.png"),
    title: "“Julia answered today's question”",
    sub: "When someone in your group posts",
  },
  {
    image: require("../../assets/images/shishir.png"),
    title: "“Shishir commented”",
    sub: "Replies and reactions to you",
  },
]

export default function NotificationsScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const params = useLocalSearchParams<{ stage?: string }>()
  /** "pre" = straight after profile, before any answer exists. */
  const preAnswer = params.stage === "pre"
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    v2Analytics.notificationsViewed(preAnswer ? "pre" : "post")
  }, [preAnswer])

  /**
   * They have a profile and a first answer — that is "onboarded", whether or not
   * they take the group step next. Only people with nobody to share with get sent
   * to group creation; an invited user already has a group and goes to the app.
   */
  async function done() {
    if (!user?.id) return router.replace("/(v2)/today")
    if (!preAnswer) markOnboarded(user.id)
    // Before the first answer there is nothing to share yet, so go straight to
    // Capture and let them answer. The group step comes after that answer.
    if (preAnswer) return router.replace("/(v2)/today")

    const { count } = await supabase
      .from("group_members")
      .select("group_id", { count: "exact", head: true })
      .eq("user_id", user.id)
    router.replace((count ?? 0) > 0 ? "/(v2)/today" : "/(onboarding-v2)/alone")
  }

  async function enable() {
    haptics.commit()
    setBusy(true)
    try {
      // Record the intent before asking, so that if they deny here and later
      // enable notifications from iOS Settings, the resume handler knows this
      // was something they wanted and picks the registration up.
      await markPushOptInRequested()

      if (user?.id) {
        const reg = await registerForPushNotifications({ linkSupabaseUserId: user.id })
        // registerForPushNotifications only RETURNS the tokens — persisting them is
        // a separate call. Without this the user accepted the prompt and nothing
        // was ever written to push_tokens.
        await savePushRegistrationToSupabase(user.id, reg)
      }
      v2Analytics.notificationsChoice(true)
      haptics.success()
    } catch (e) {
      // A denied or failed registration is not an error worth blocking on — they
      // can turn notifications on later from Settings.
      console.warn("[onboarding] push registration failed:", (e as Error).message)
    } finally {
      setBusy(false)
      await done()
    }
  }

  return (
    <SafeAreaView style={s.screen} edges={["top", "bottom"]}>
      <View style={s.body}>
        <Text style={s.title}>
          {preAnswer
            ? "Don't miss new questions\nand your group's answers"
            : "Want to know when\nthey answer?"}
        </Text>
        <Text style={s.sub}>You can turn any of these off in settings.</Text>

        <View style={s.list}>
          {KINDS.map((k) => (
            <View key={k.title} style={s.cardShadow}>
              <View style={s.card}>
                <Image source={k.image} style={s.swatch} resizeMode="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{k.title}</Text>
                  <Text style={s.cardSub}>{k.sub}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={s.footer}>
        {/* Bevel on the OUTER view — overflow:"hidden" on the shadow-caster clips it. */}
        <Pressable
          onPress={enable}
          disabled={busy}
          style={({ pressed }) => [s.ctaShadow, pressed ? s.ctaPressed : null]}
        >
          <View style={s.ctaInner}>
            {busy ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={s.ctaText}>Turn them on</Text>
            )}
          </View>
        </Pressable>

        <Pressable
          onPress={() => {
            haptics.tap()
            done()
          }}
          hitSlop={12}
          style={s.notNow}
        >
          <Text style={s.notNowText}>Not now</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.blue },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 28 },
  title: {
    fontFamily: "PMGothicLudington-Text115",
    fontSize: 34,
    lineHeight: 38,
    color: COLORS.white,
  },
  sub: {
    fontFamily: "Roboto-Regular",
    fontSize: 15,
    lineHeight: 21,
    color: COLORS.muted,
    marginTop: 10,
  },
  list: { marginTop: 26, gap: 14 },

  cardShadow: {
    borderRadius: 14,
    shadowColor: COLORS.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: COLORS.cream,
    borderWidth: 2,
    borderColor: COLORS.text,
    borderRadius: 14,
    padding: 14,
    overflow: "hidden",
  },
  swatch: {
    width: 42,
    height: 42,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.text,
    backgroundColor: COLORS.cream,
  },
  cardTitle: { fontFamily: "Roboto-Bold", fontSize: 15, color: COLORS.text },
  cardSub: { fontFamily: "Roboto-Regular", fontSize: 13, color: "#5A5A5A", marginTop: 2 },

  footer: { paddingHorizontal: 20, paddingBottom: 8 },
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
    borderWidth: 2,
    borderColor: COLORS.text,
    borderRadius: 28,
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

  notNow: { alignSelf: "center", marginTop: 18, marginBottom: 6 },
  notNowText: {
    fontFamily: "Roboto-Regular",
    fontSize: 15,
    color: COLORS.white,
    textDecorationLine: "underline",
  },
})
