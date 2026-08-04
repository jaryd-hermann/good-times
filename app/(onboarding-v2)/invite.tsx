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
import { supabase } from "../../lib/supabase"
import { getTodayDate } from "../../lib/utils"
import { useQueryClient } from "@tanstack/react-query"
import { v2Analytics } from "../../lib/v2/analytics"

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
  const qc = useQueryClient()
  const { c } = useV2Colors()
  const params = useLocalSearchParams<{ token?: string; via?: string }>()
  const s = makeStyles(c)

  const [peek, setPeek] = useState<InvitePeek | null>(null)
  const [busy, setBusy] = useState(false)
  const [celebrating, setCelebrating] = useState(false)

  useEffect(() => {
    if (!params.token) return
    let cancelled = false

    ;(async () => {
      let result: InvitePeek
      try {
        result = await peekInvite(params.token!)
      } catch {
        if (!cancelled) setPeek({ error: "not_found" })
        return
      }
      if (cancelled) return

      // Already in this group? Then there is nothing to accept or decline, and
      // offering the choice implies they might not be in it. Open the
      // conversation instead — which is what they were trying to reach by
      // tapping the link.
      if (!("error" in result) && user?.id) {
        const { data: membership } = await supabase
          .from("group_members")
          .select("group_id")
          .eq("group_id", result.group_id)
          .eq("user_id", user.id)
          .maybeSingle()

        if (cancelled) return
        if (membership) {
          // The latest day that actually has messages, not today — a group whose
          // last activity was Friday should open on Friday, not on an empty
          // thread for a day nobody has posted in.
          const { data: latest } = await supabase
            .from("messages")
            .select("thread_date")
            .eq("group_id", result.group_id)
            .order("thread_date", { ascending: false })
            .limit(1)
            .maybeSingle()

          const date =
            (latest as { thread_date?: string } | null)?.thread_date ?? getTodayDate()
          router.replace({
            pathname: "/(v2)/thread",
            params: { groupId: result.group_id, date },
          })
          return
        }
      }

      if (!cancelled) setPeek(result)
    })()

    return () => {
      cancelled = true
    }
  }, [params.token, user?.id, router])

  const invite = peek && !("error" in peek) ? peek : null

  async function accept() {
    if (!params.token || !user?.id) return
    haptics.commit()
    setBusy(true)
    try {
      const res = await redeemInvite(params.token, user.id)
      // `via` is set by whoever sent us here: the inline paste card passes
      // "code", a tapped invite link leaves it unset.
      v2Analytics.groupJoined({
        groupId: res.group_id,
        via: params.via === "code" ? "code" : "link",
      })
      // The hub caches for 30s and nothing invalidated it on join, so answering
      // within that window read groups:[] — the composer showed "you'll add a
      // group soon" and, worse, posted with groupIds:[] so the answer was saved
      // with no shares and never reached the group just joined.
      await qc.invalidateQueries({ queryKey: ["v2"] })

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
