import { useState } from "react"
import { View, Text, StyleSheet, Pressable, Linking, Alert, ScrollView, Platform } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useAuth } from "../../components/AuthProvider"
import { useProfile } from "../../lib/v2/useProfile"
import { useV2Colors, v2Spacing as sp } from "../../lib/v2/theme"
import * as haptics from "../../lib/v2/haptics"
import { BackHeader } from "../../components/v2/AppHeader"
import { openAppStoreReview } from "../../lib/app-store-review"

const EMAIL = "hermannjaryd@gmail.com"
/** Child-safety point of contact. Keep in sync with the published standards at
 * getgoodtimes.app/child-safety and the contact declared in Play Console. */
const SAFETY_EMAIL = "hermannjaryd@gmail.com"
/** Digits only for the sms: URI; the pretty form is for display. */
const PHONE = "+19143836826"
const PHONE_DISPLAY = "+1 (914) 383-6826"

type Kind = {
  id: string
  icon: string
  label: string
  blurb: string
  subject: string
  email?: string
}

/**
 * Android-only in-app reporting path required by Google Play's Child Safety
 * Standards policy (Social apps must offer a way to report CSAE/abuse from
 * inside the app). Gated to Android so iOS keeps the lighter feedback list.
 */
const SAFETY: Kind = {
  id: "safety",
  icon: "shield-alert-outline",
  label: "Report abuse or a safety concern",
  blurb: "Harmful, illegal, or child-safety content. We review these first.",
  subject: "Good Times: Safety report",
  email: SAFETY_EMAIL,
}

const KINDS: Kind[] = [
  {
    id: "bug",
    icon: "bug-outline",
    label: "Something's broken",
    blurb: "A crash, a button that does nothing, wrong data.",
    subject: "Good Times: Bug",
  },
  {
    id: "idea",
    icon: "lightbulb-on-outline",
    label: "I've got an idea",
    blurb: "Something you wish the app did.",
    subject: "Good Times: Idea",
  },
  {
    id: "question",
    icon: "message-question-outline",
    label: "A question",
    blurb: "Anything about how it works.",
    subject: "Good Times: Question",
  },
  {
    id: "other",
    icon: "heart-outline",
    label: "Just saying hi",
    blurb: "Tell us how you're finding it.",
    subject: "Good Times: Hello",
  },
]

/**
 * Feedback — restyled for v2.
 *
 * Same behaviour as the v1 screen (Gmail first, then the system composer, then a
 * plain-address fallback), but picking a category pre-fills the subject so replies
 * arrive triageable instead of all landing as "Feedback".
 */
export default function FeedbackScreen() {
  const { user } = useAuth()
  const { c } = useV2Colors()
  const { data: profile } = useProfile(user?.id)
  const [sending, setSending] = useState<string | null>(null)
  const s = makeStyles(c)

  async function send(kind: Kind) {
    setSending(kind.id)
    const to = kind.email ?? EMAIL
    const subject = encodeURIComponent(kind.subject)
    const body = encodeURIComponent(
      `\n\n\n---\nFrom: ${profile?.name ?? "a user"} (${user?.email ?? "no email"})`
    )
    const gmail = `googlegmail://co?to=${to}&subject=${subject}&body=${body}`
    const mailto = `mailto:${to}?subject=${subject}&body=${body}`
    try {
      if (await Linking.canOpenURL(gmail)) await Linking.openURL(gmail)
      else if (await Linking.canOpenURL(mailto)) await Linking.openURL(mailto)
      else Alert.alert("No mail app found", `Email us directly at ${to}`)
    } catch {
      Alert.alert("No mail app found", `Email us directly at ${to}`)
    } finally {
      setSending(null)
    }
  }

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <BackHeader title="Feedback" />
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: sp.xxl }}>
        <Text style={s.title}>Tell us anything</Text>
        <Text style={s.sub}>
          Good Times is small and we read everything. Pick what fits and it opens your mail
          app.
        </Text>

        {Platform.OS === "android" && (
          <Pressable
            onPress={() => send(SAFETY)}
            disabled={!!sending}
            style={({ pressed }) => [s.card, s.safetyCard, pressed ? s.cardPressed : null]}
          >
            <View style={[s.icon, s.safetyIcon]}>
              <MaterialCommunityIcons
                name={SAFETY.icon as any}
                size={22}
                color={c.accentInk}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{SAFETY.label}</Text>
              <Text style={s.cardBlurb}>{SAFETY.blurb}</Text>
            </View>
            <Text style={s.chev}>›</Text>
          </Pressable>
        )}

        {KINDS.map((k) => (
          <Pressable
            key={k.id}
            onPress={() => send(k)}
            disabled={!!sending}
            style={({ pressed }) => [s.card, pressed ? s.cardPressed : null]}
          >
            <View style={s.icon}>
              <MaterialCommunityIcons name={k.icon as any} size={22} color={c.accentInk} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{k.label}</Text>
              <Text style={s.cardBlurb}>{k.blurb}</Text>
            </View>
            <Text style={s.chev}>›</Text>
          </Pressable>
        ))}

        <Pressable
          onPress={() => openAppStoreReview()}
          style={({ pressed }) => [s.card, s.rateCard, pressed ? s.cardPressed : null]}
        >
          <View style={[s.icon, s.rateIcon]}>
            <MaterialCommunityIcons name="star-outline" size={22} color={c.accentInk} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>Share an app rating</Text>
            <Text style={s.cardBlurb}>Takes ten seconds and genuinely helps.</Text>
          </View>
          <Text style={s.chev}>›</Text>
        </Pressable>

        <View style={s.directBox}>
          <Text style={s.directLabel}>Or email us directly</Text>
          <Pressable onPress={() => Linking.openURL(`mailto:${EMAIL}`)}>
            <Text style={s.directEmail}>{EMAIL}</Text>
          </Pressable>

          <Text style={[s.directLabel, { marginTop: sp.md }]}>
            Or shoot me (Jaryd) a text
          </Text>
          <Pressable
            onPress={async () => {
              haptics.tap()
              // iOS wants sms:&body=, Android wants sms:?body= — open the bare
              // number so both land in the composer with the thread started.
              const url = `sms:${PHONE}`
              if (await Linking.canOpenURL(url)) Linking.openURL(url)
              else Alert.alert("No messaging app", `Text me on ${PHONE_DISPLAY}`)
            }}
          >
            <Text style={s.directEmail}>{PHONE_DISPLAY}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useV2Colors>["c"]) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    title: { fontSize: 26, fontWeight: "800", color: c.text, letterSpacing: -0.5 },
    sub: { color: c.textSecondary, lineHeight: 21, marginTop: 6, marginBottom: sp.lg },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: sp.md,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 16,
      padding: sp.md,
      marginBottom: sp.md,
      shadowColor: c.border,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 4,
    },
    cardPressed: {
      transform: [{ translateY: 4 }],
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      elevation: 0,
    },
    icon: {
      width: 46,
      height: 46,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: c.border,
      backgroundColor: c.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    cardTitle: { fontSize: 16, fontWeight: "800", color: c.text },
    cardBlurb: { fontSize: 13, color: c.textSecondary, marginTop: 1 },
    chev: { fontSize: 22, color: c.textSecondary },
    rateCard: { marginTop: sp.md },
    rateIcon: { backgroundColor: c.pink },
    safetyCard: { borderColor: c.pink },
    safetyIcon: { backgroundColor: c.pink },
    directBox: {
      borderWidth: 2,
      borderStyle: "dashed",
      borderColor: c.border,
      borderRadius: 16,
      padding: sp.lg,
      alignItems: "center",
      marginTop: sp.md,
      gap: 4,
    },
    directLabel: { color: c.textSecondary, fontSize: 13 },
    directEmail: { color: c.blue, fontWeight: "800", fontSize: 15 },
  })
}
