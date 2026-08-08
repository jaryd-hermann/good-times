import { useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Image,
  Alert,
  Pressable,
  ActivityIndicator,
} from "react-native"
import { useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useAuth } from "../../components/AuthProvider"
import { Avatar } from "../../components/Avatar"
import { useTheme } from "../../lib/theme-context"
import { useProfile } from "../../lib/v2/useProfile"
import { useV2Colors, v2Spacing as sp } from "../../lib/v2/theme"
import { BackHeader } from "../../components/v2/AppHeader"
import { supabase } from "../../lib/supabase"

/**
 * Profile / menu — lives INSIDE the (v2) stack.
 *
 * This is deliberately not a link to `app/(main)/settings.tsx`. Pushing across
 * route groups mounts the other group's stack, so backing out of a `(main)`
 * screen returns you to v1's root instead of v2 — which is exactly the "closing
 * feedback drops me back into the old app" bug.
 *
 * Everything reachable from the v2 header therefore lives in (v2).
 */
export default function MenuScreen() {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const { c } = useV2Colors()
  const { theme, setTheme, isDark } = useTheme()
  const { data: profile, isLoading } = useProfile(user?.id)
  const [busy, setBusy] = useState(false)
  const [notificationsOn, setNotificationsOn] = useState(true)
  const s = makeStyles(c)

  async function onSignOut() {
    Alert.alert("Sign out?", "You'll need to sign in again.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          setBusy(true)
          try {
            await signOut()
            router.replace("/(onboarding-v2)/splash")
          } finally {
            setBusy(false)
          }
        },
      },
    ])
  }

  async function setNotifications(on: boolean) {
    if (!user?.id) return
    const { error } = await supabase
      .from("users")
      .update({ notifications_enabled: on })
      .eq("id", user.id)
    if (error) Alert.alert("Couldn't update", error.message)
  }

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <BackHeader title="You + Settings" />
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: sp.xxl }}>
        <Pressable
          onPress={() => router.push("/(v2)/edit-profile")}
          style={({ pressed }) => [s.profileCard, pressed ? { transform: [{ translateY: 2 }] } : null]}
        >
          {isLoading ? (
            <ActivityIndicator color={c.text} />
          ) : (
            <>
              <Avatar uri={profile?.avatar_url ?? undefined} name={profile?.name} size={64} />
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{profile?.name ?? "You"}</Text>
                <Text style={s.email}>{user?.email}</Text>
                {profile?.birthday ? (
                  <Text style={s.meta}>🎂 {formatBirthday(profile.birthday)}</Text>
                ) : (
                  <Text style={s.meta}>No birthday set</Text>
                )}
              </View>
              <Text style={s.chev}>›</Text>
            </>
          )}
        </Pressable>

        <Text style={s.sectionLabel}>NOTIFICATIONS</Text>
        <Row
          icon="bell-outline"
          label="Push notifications"
          c={c}
          right={
            <Switch
              value={notificationsOn}
              onValueChange={(v) => {
                setNotificationsOn(v)
                void setNotifications(v)
              }}
              trackColor={{ true: c.green, false: c.textSecondary }}
            />
          }
        />

        <Text style={s.sectionLabel}>APPEARANCE</Text>
        <Row
          icon={isDark ? "weather-night" : "white-balance-sunny"}
          label="Dark mode"
          c={c}
          right={
            <Switch
              value={isDark}
              onValueChange={(v) => setTheme(v ? "dark" : "light")}
              trackColor={{ true: c.green, false: c.textSecondary }}
            />
          }
        />

        <Text style={s.sectionLabel}>SUPPORT</Text>
        <Row
          icon="message-alert-outline"
          label="Send feedback"
          c={c}
          onPress={() => router.push("/(v2)/feedback")}
        />
        <Row
          icon="lightbulb-on-outline"
          label="Suggest a question"
          c={c}
          onPress={() => router.push("/(v2)/suggest-question")}
        />

        <View style={{ height: sp.xl }} />
        <Pressable
          onPress={onSignOut}
          disabled={busy}
          style={({ pressed }) => [s.signOut, pressed ? { opacity: 0.7 } : null]}
        >
          <Text style={s.signOutText}>{busy ? "Signing out…" : "Sign out"}</Text>
        </Pressable>

        <View style={s.wordmarkWrap}>
          <Image
            source={
              isDark
                ? require("../../assets/images/wordmark-light.png")
                : require("../../assets/images/wordmark.png")
            }
            style={s.wordmark}
            resizeMode="contain"
          />
          <Text style={s.memory}>
            Made in memory of our mom, Amelia.{"\n"}We do remember all the good times.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function Row({
  icon,
  label,
  right,
  onPress,
  c,
}: {
  icon: string
  label: string
  right?: React.ReactNode
  onPress?: () => void
  c: ReturnType<typeof useV2Colors>["c"]
}) {
  const s = makeStyles(c)
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [s.row, pressed && onPress ? { transform: [{ translateY: 2 }] } : null]}
    >
      <MaterialCommunityIcons name={icon as any} size={22} color={c.text} />
      <Text style={s.rowLabel}>{label}</Text>
      {right ?? (onPress ? <Text style={s.chev}>›</Text> : null)}
    </Pressable>
  )
}

function formatBirthday(b: string) {
  const d = new Date(b + "T00:00:00")
  return d.toLocaleDateString([], { day: "numeric", month: "long" })
}

function makeStyles(c: ReturnType<typeof useV2Colors>["c"]) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    profileCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: sp.md,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 16,
      padding: sp.lg,
      marginBottom: sp.lg,
    },
    name: { fontSize: 20, fontWeight: "800", color: c.text },
    email: { color: c.textSecondary, fontSize: 13, marginTop: 1 },
    meta: { color: c.textSecondary, fontSize: 12, marginTop: 4 },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.6,
      color: c.textSecondary,
      marginTop: sp.lg,
      marginBottom: sp.sm,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: sp.md,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 14,
      paddingHorizontal: sp.md,
      paddingVertical: sp.md,
      marginBottom: sp.sm,
    },
    rowLabel: { flex: 1, fontSize: 15, fontWeight: "700", color: c.text },
    chev: { fontSize: 20, color: c.textSecondary },
    signOut: {
      borderWidth: 2,
      borderColor: c.red,
      borderRadius: 26,
      paddingVertical: 14,
      alignItems: "center",
    },
    signOutText: { color: c.red, fontWeight: "800", fontSize: 15 },
    wordmarkWrap: { alignItems: "center", marginTop: sp.xxl, gap: sp.md },
    wordmark: { width: 300, height: 60 },
    memory: {
      textAlign: "center",
      color: c.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      fontStyle: "italic",
    },
  })
}
