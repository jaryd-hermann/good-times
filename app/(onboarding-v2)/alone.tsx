import { useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Share,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { useRouter } from "expo-router"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import * as Clipboard from "expo-clipboard"
import { supabase } from "../../lib/supabase"
import { useV2Colors, v2Spacing as sp } from "../../lib/v2/theme"
import { createGroup, inviteUrl } from "../../lib/v2/onboarding"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { Avatar } from "../../components/Avatar"
import { useAuth } from "../../components/AuthProvider"
import { useProfile } from "../../lib/v2/useProfile"

/**
 * Screen 5 of 5 — "You're alone here".
 *
 * Deliberately AFTER the first answer. Group creation stops being homework and
 * becomes motivated: you've written something and now you want someone to see it.
 */
export default function AloneScreen() {
  const router = useRouter()
  const { c } = useV2Colors()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id)
  const firstName = (profile?.name ?? "").trim().split(" ")[0]
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<{ id: string; name: string; token: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const s = makeStyles(c)

  async function make() {
    if (!name.trim()) {
      Alert.alert("Name it something", "You can change this later.")
      return
    }
    setBusy(true)
    try {
      const { data } = await supabase.auth.getUser()
      const uid = data.user?.id
      if (!uid) throw new Error("Not signed in")
      const res = await createGroup(name.trim(), uid)
      setCreated({ id: res.group_id, name: res.group_name, token: res.invite?.token })
    } catch (e) {
      Alert.alert("Couldn't create the group", (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function shareInvite() {
    if (!created) return
    const url = inviteUrl(created.token)
    await Share.share({
      message: `Join ${created.name} on Good Times — one question a day. ${url}\n\nOr enter code ${created.token} in the app.`,
    })
  }

  async function copyCode() {
    if (!created) return
    await Clipboard.setStringAsync(created.token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (created) {
    return (
      <SafeAreaView style={s.screen}>
        {/* Explicit exit. "I'll do this later" is the wrong label once you have
            already copied the code. */}
        <TouchableOpacity
          // Positioned against the real inset rather than trusting SafeAreaView's
          // padding to contain an absolutely-positioned child — it was landing
          // under the notch.
          style={[s.closeX, { top: insets.top + 8 }]}
          hitSlop={16}
          onPress={() => router.replace("/(v2)/today")}
        >
          <MaterialCommunityIcons name="close" size={24} color={c.text} />
        </TouchableOpacity>
        <View style={s.body}>
          <Text style={s.title}>You just made {created.name}!</Text>
          <Text style={s.sub}>Now invite them!</Text>

          {/* Whole block copies — a small link under the code was a needlessly
              precise tap for the main action on this screen. */}
          <TouchableOpacity style={s.codeCard} onPress={copyCode} activeOpacity={0.75}>
            <Text style={s.codeLabel}>INVITE CODE · TAP TO COPY</Text>
            <Text style={s.code}>{created.token}</Text>
            <Text style={s.copyLink}>{copied ? "Copied ✓" : " "}</Text>
          </TouchableOpacity>

          {/* Bevel on the OUTER view — overflow:"hidden" on the shadow-caster clips it. */}
          <Pressable
            onPress={shareInvite}
            style={({ pressed }) => [s.ctaShadow, pressed ? s.ctaPressed : null]}
          >
            <View style={s.cta}>
              <Text style={s.ctaText}>Share invite link</Text>
            </View>
          </Pressable>
          <Text style={s.ctaHelper}>Send to your group. One tap join</Text>
          <TouchableOpacity onPress={() => router.replace("/(v2)/today")}>
            <Text style={s.skip}>I&rsquo;ll do this later</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={s.body}>
          {/* You, then the empty seats. Showing the gap as three blank slots makes
              "you are the only one here" a picture rather than a sentence. */}
          <View style={s.faces}>
            {/* You sit on top of the stack — the empty seats overlap behind, not
                across your face. */}
            <View style={{ zIndex: 4 }}>
              <Avatar
                uri={profile?.avatar_url ?? undefined}
                name={profile?.name}
                size={62}
                borderColor={c.border}
              />
            </View>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[s.emptyFace, { marginLeft: -14, zIndex: 3 - i }]} />
            ))}
          </View>

          <Text style={s.title}>
            {firstName ? `${firstName}, let’s add your people` : "Let’s add your people"}
          </Text>
          <Text style={s.sub}>
            Good Times is one question a day with the people you like and love — it only works
            in private groups. Create one and forward them, it&rsquo;s free and super easy for
            them to join.
          </Text>

          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="Group name — The Fam, Sunday Roast…"
            placeholderTextColor={c.textSecondary}
            autoFocus
          />

          {/* Bevel on the OUTER view — overflow:"hidden" on the shadow-caster clips it. */}
          <Pressable
            onPress={make}
            disabled={busy}
            style={({ pressed }) => [s.ctaShadow, pressed ? s.ctaPressed : null]}
          >
            <View style={s.cta}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.ctaText}>Create group</Text>
              )}
            </View>
          </Pressable>

          <View style={s.orRow}>
            <View style={s.orLine} />
            <Text style={s.orText}>or</Text>
            <View style={s.orLine} />
          </View>

          <TouchableOpacity
            style={s.secondary}
            onPress={() => router.push("/(onboarding-v2)/join")}
          >
            <Text style={s.secondaryText}>Join with an invite code</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace("/(v2)/today")}>
            <Text style={s.skip}>Skip for now</Text>
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
    closeX: {
      position: "absolute",
      right: sp.lg,
      zIndex: 10,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.border,
    },
    faces: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: sp.lg,
    },
    emptyFace: {
      width: 62,
      height: 62,
      borderRadius: 31,
      borderWidth: 2,
      borderStyle: "dashed",
      borderColor: c.border,
      backgroundColor: c.surfaceAlt,
      opacity: 0.6,
    },
    title: { textAlign: "center", fontSize: 26, fontWeight: "800", color: c.text },
    sub: { textAlign: "center", color: c.textSecondary, lineHeight: 21, marginBottom: sp.md, marginTop: 6 },
    input: {
      backgroundColor: c.surfaceAlt,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 12,
      padding: sp.md,
      fontSize: 16,
      color: c.text,
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
    ctaHelper: {
      textAlign: "center",
      color: c.textSecondary,
      fontSize: 13,
      fontWeight: "600",
      marginTop: sp.sm,
    },
    secondary: {
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 28,
      paddingVertical: 15,
      alignItems: "center",
    },
    secondaryText: { color: c.text, fontWeight: "800", fontSize: 16 },
    orRow: { flexDirection: "row", alignItems: "center", gap: sp.md },
    orLine: { flex: 1, height: 1, backgroundColor: c.border, opacity: 0.3 },
    orText: { color: c.textSecondary, fontSize: 12 },
    skip: { textAlign: "center", color: c.textSecondary, fontWeight: "600", marginTop: sp.sm },

    codeCard: {
      backgroundColor: c.accent,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 16,
      padding: sp.lg,
      alignItems: "center",
      gap: 4,
    },
    codeLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8, color: c.accentInk },
    code: { fontSize: 32, fontWeight: "800", color: c.accentInk, letterSpacing: 2 },
    copyLink: { color: c.accentInk, fontWeight: "700", textDecorationLine: "underline" },
  })
}
