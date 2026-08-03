import { useEffect, useState } from "react"
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { peekInvite, type InvitePeek } from "../../lib/v2/onboarding"
import * as haptics from "../../lib/v2/haptics"

/**
 * Splash — v1's screen, with a single bevelled Continue.
 *
 * Keeps v1's identity verbatim: marketing panel up top, left-aligned wordmark,
 * "Answer one question a day with friends", "No AI. No Algorithms. No Ads. No Strangers.".
 * v1's Login/Join pair collapses to one Continue: v2 has no sign-in/sign-up fork
 * and no invite code here. Joining a group happens after profile + first answer,
 * so an invited user signs up like anyone else and lands in the group after.
 *
 * Invited arrivals swap the tagline for who invited you — the friend IS the pitch,
 * so they shouldn't have to read the positioning first.
 */

const COLORS = {
  beige: "#E8E0D5",
  white: "#FFFFFF",
  text: "#000000",
  muted: "#808080",
  blue: "#3A5F8C",
  pink: "#D97393",
  accent: "#E5A13C",
}

export default function SplashScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ invite?: string }>()
  const [peek, setPeek] = useState<InvitePeek | null>(null)
  const [loading, setLoading] = useState(!!params.invite)

  useEffect(() => {
    if (!params.invite) return
    peekInvite(params.invite)
      .then(setPeek)
      .catch(() => setPeek({ error: "not_found" }))
      .finally(() => setLoading(false))
  }, [params.invite])

  const invited = peek && !("error" in peek) ? peek : null

  function go() {
    haptics.commit()
    router.push({
      pathname: "/(onboarding-v2)/auth",
      params: params.invite ? { invite: params.invite } : {},
    })
  }

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* v1's hero: welcome-home.png in a bordered 0.8-aspect frame with the
            paper texture over it. (v1 could swap this for a WebView video; the
            still is what shipped by default.) */}
        <View style={s.imageContainer}>
          <View style={s.imageWrapper}>
            <Image
              source={require("../../assets/images/welcome-home.png")}
              style={s.image}
              resizeMode="cover"
            />
            <View style={s.imageTexture} pointerEvents="none">
              <Image
                source={require("../../assets/images/texture.png")}
                style={s.textureImage}
                resizeMode="cover"
              />
            </View>
          </View>
        </View>

        <View style={s.content}>
          <Image
            source={require("../../assets/images/wordmark.png")}
            style={s.wordmark}
            resizeMode="contain"
          />

          {loading ? (
            <ActivityIndicator color={COLORS.text} style={{ alignSelf: "flex-start" }} />
          ) : invited ? (
            <View style={s.inviteCard}>
              <Text style={s.inviteLead}>{invited.inviter} invited you to</Text>
              <Text style={s.inviteGroup}>{invited.group_name}</Text>
              <Text style={s.inviteMeta}>
                {invited.member_count} {invited.member_count === 1 ? "person" : "people"} inside
              </Text>
            </View>
          ) : (
            <>
              <Text style={s.subtitle}>Answer one question a day with friends</Text>
              <Text style={s.subTagline}>No AI. No Algorithms. No Ads. No Strangers.</Text>
            </>
          )}

          {peek && "error" in peek ? (
            <Text style={s.inviteError}>
              That invite link has {peek.error === "expired" ? "expired" : "gone"}. You can still
              join with a code after signing in.
            </Text>
          ) : null}

          {/* Bevel lives on the OUTER view. Putting overflow:"hidden" on the
              shadow-casting view (needed to clip the texture to the radius) clips
              the shadow too — that is why this button had no bevel. */}
          <Pressable onPress={go} style={({ pressed }) => [s.ctaShadow, pressed ? s.ctaPressed : null]}>
            <View style={s.ctaInner}>
              <View style={s.ctaTexture} pointerEvents="none">
                <Image
                  source={require("../../assets/images/texture.png")}
                  style={s.textureImage}
                  resizeMode="cover"
                />
              </View>
              <Text style={s.ctaText}>{invited ? "Join them" : "Continue"}</Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.beige },
  scroll: { flexGrow: 1 },
  imageContainer: {
    // Narrower gutter + less top padding = a bigger hero without pushing the
    // wordmark and CTA off a small screen.
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 0,
    alignItems: "center",
  },
  imageWrapper: {
    width: "100%",
    // welcome-home.png is 910x1378. The frame must match that ratio exactly or
    // resizeMode="cover" crops to fill — which is what was clipping the top and
    // bottom of the artwork.
    aspectRatio: 910 / 1378,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: COLORS.beige,
  },
  image: { width: "100%", height: "100%" },
  imageTexture: { ...StyleSheet.absoluteFillObject, opacity: 0.3, zIndex: 1 },

  content: {
    padding: 20,
    paddingTop: 0,
    // Negative pull, not just less padding: the artwork carries its own beige
    // margin at the bottom, so the visible gap was mostly inside the image. This
    // closes it and lifts the CTA clear of the screen edge.
    marginTop: -44,
    paddingBottom: 34,
  },
  wordmark: {
    width: 240,
    height: 78,
    marginLeft: -8,
    alignSelf: "flex-start",
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: "PMGothicLudington-Text115",
    fontSize: 22,
    lineHeight: 30,
    color: COLORS.text,
    marginBottom: 8,
  },
  subTagline: {
    fontFamily: "PMGothicLudington-Text115",
    fontSize: 18,
    lineHeight: 26,
    color: COLORS.muted,
    marginBottom: 12,
  },

  inviteCard: {
    backgroundColor: COLORS.accent,
    borderWidth: 2,
    borderColor: COLORS.text,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  inviteLead: { fontFamily: "Roboto-Regular", color: COLORS.text, fontSize: 14 },
  inviteGroup: {
    fontFamily: "PMGothicLudington-Text115",
    fontSize: 26,
    color: COLORS.text,
    marginVertical: 2,
  },
  inviteMeta: { fontFamily: "Roboto-Regular", color: COLORS.text, opacity: 0.7, fontSize: 13 },
  inviteError: { color: "#B23B3B", marginBottom: 8, fontFamily: "Roboto-Regular" },

  // shadow only — must NOT clip
  ctaShadow: {
    marginTop: 16,
    borderRadius: 28,
    shadowColor: COLORS.text,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  // clipping + fill, inside the shadow view
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
  ctaText: { fontFamily: "Roboto-Bold", fontSize: 18, color: COLORS.white, zIndex: 2 },
  ctaTexture: { ...StyleSheet.absoluteFillObject, opacity: 0.18 },
  textureImage: { width: "100%", height: "100%" },
})
