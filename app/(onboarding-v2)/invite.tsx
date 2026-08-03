import { useEffect, useState } from "react"
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { useAuth } from "../../components/AuthProvider"
import { AvatarStack } from "../../components/v2/AvatarStack"
import { useV2Colors, v2Spacing as sp } from "../../lib/v2/theme"
import { peekInvite, redeemInvite, type InvitePeek } from "../../lib/v2/onboarding"
import * as haptics from "../../lib/v2/haptics"
import { Confetti } from "../../components/v2/Confetti"
import { getTodayDate } from "../../lib/utils"

/**
 * Invite confirmation for a signed-in user.
 *
 * Opening a link used to redeem silently and drop you into the app — you were in a
 * group before you knew whose it was. Joining someone's private group is worth one
 * deliberate tap, so this shows who invited you and how many people are inside,
 * with an explicit way out.
 */
export default function InviteScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const { c } = useV2Colors()
  const params = useLocalSearchParams<{ token?: string }>()
  const s = makeStyles(c)

  const [peek, setPeek] = useState<InvitePeek | null>(null)
  const [busy, setBusy] = useState(false)
  const [celebrating, setCelebrating] = useState(false)

  useEffect(() => {
    if (!params.token) return
    peekInvite(params.token)
      .then(setPeek)
      .catch(() => setPeek({ error: "not_found" }))
  }, [params.token])

  const invite = peek && !("error" in peek) ? peek : null

  async function accept() {
    if (!params.token || !user?.id) return
    haptics.commit()
    setBusy(true)
    try {
      const res = await redeemInvite(params.token, user.id)
      haptics.celebrate()
      setCelebrating(true)

      // Land in the group's thread for today, not the hub — you joined to see
      // these people, so open on them. Short beat first so the confetti is
      // actually seen rather than unmounted by the navigation.
      setTimeout(() => {
        router.replace({
          pathname: "/(v2)/thread",
          params: { groupId: res.group_id, date: getTodayDate() },
        })
      }, 1100)
    } catch (e) {
      haptics.warn()
      Alert.alert("Couldn't join", (e as Error).message)
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={s.screen} edges={["top", "bottom"]}>
      <View style={s.body}>
        {!peek ? (
          <ActivityIndicator color={c.text} />
        ) : "error" in peek ? (
          <>
            <Text style={s.title}>That invite didn&rsquo;t work</Text>
            <Text style={s.sub}>
              {peek.error === "expired"
                ? "This link has expired. Ask them to send a new one."
                : peek.error === "revoked"
                  ? "This invite was turned off. Ask them to send a new one."
                  : "We couldn't find that invite. Check the link and try again."}
            </Text>
            <Pressable
              onPress={() => router.replace("/(v2)/today")}
              style={({ pressed }) => [s.ctaShadow, pressed ? s.ctaPressed : null]}
            >
              <View style={s.cta}>
                <Text style={s.ctaText}>Back to Good Times</Text>
              </View>
            </Pressable>
          </>
        ) : (
          <>
            {/* Faces first: "who is in here" is the actual decision, and a member
                count alone answers none of it. */}
            {invite!.members?.length ? (
              <View style={s.faces}>
                <AvatarStack members={invite!.members} size={44} max={6} />
              </View>
            ) : null}

            <Text style={s.lead}>{invite!.inviter} invited you to</Text>
            <Text style={s.groupName}>{invite!.group_name}</Text>
            <Text style={s.meta}>
              {invite!.member_count} {invite!.member_count === 1 ? "person" : "people"} inside
            </Text>

            <Pressable
              onPress={accept}
              disabled={busy}
              style={({ pressed }) => [s.ctaShadow, pressed ? s.ctaPressed : null]}
            >
              <View style={s.cta}>
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.ctaText}>Join them</Text>
                )}
              </View>
            </Pressable>

            <Pressable
              onPress={() => {
                haptics.tap()
                router.replace("/(v2)/today")
              }}
              hitSlop={10}
              style={s.decline}
            >
              <Text style={s.declineText}>Decline invite</Text>
            </Pressable>
          </>
        )}
      </View>

      {celebrating ? <Confetti /> : null}
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useV2Colors>["c"]) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    body: { flex: 1, justifyContent: "center", padding: sp.xl },
    title: { fontSize: 26, fontWeight: "800", color: c.text, textAlign: "center" },
    sub: {
      fontSize: 15,
      color: c.textSecondary,
      textAlign: "center",
      lineHeight: 21,
      marginTop: 8,
      marginBottom: sp.xl,
    },
    faces: { alignItems: "center", marginBottom: sp.lg },
    lead: { fontSize: 15, color: c.textSecondary, textAlign: "center" },
    groupName: {
      fontSize: 32,
      fontWeight: "800",
      color: c.text,
      textAlign: "center",
      marginTop: 4,
    },
    meta: {
      fontSize: 14,
      color: c.textSecondary,
      textAlign: "center",
      marginTop: 6,
      marginBottom: sp.xl,
    },
    ctaShadow: {
      borderRadius: 28,
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
      borderRadius: 28,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 58,
      overflow: "hidden",
    },
    ctaText: { color: "#fff", fontWeight: "800", fontSize: 17 },
    decline: { alignSelf: "center", marginTop: sp.lg },
    declineText: { color: c.textSecondary, fontWeight: "700", fontSize: 15 },
  })
}
