import { useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
} from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import * as ImagePicker from "expo-image-picker"
import { supabase } from "../../lib/supabase"
import { uploadAvatar } from "../../lib/storage"
import { Avatar } from "../../components/Avatar"
import { BirthdayField } from "../../components/v2/BirthdayField"
import { useV2Colors, v2Spacing as sp } from "../../lib/v2/theme"
import { saveProfile, redeemInvite } from "../../lib/v2/onboarding"
import * as haptics from "../../lib/v2/haptics"

/**
 * Screen 3 of 5 — Profile.
 *
 * Photo, name, birthday. Name is required (the boot gate keys off it); the other
 * two are skippable, and the birthday wheel is the same BirthdayField used in
 * Settings so there is one picker and one format in the whole app.
 *
 * Last onboarding-only screen: from here they land on Today and answer in the real
 * composer, so the first thing they learn is the app itself.
 */
export default function ProfileScreen() {
  const router = useRouter()
  const { c } = useV2Colors()
  const params = useLocalSearchParams<{ invite?: string }>()
  const [name, setName] = useState("")
  const [bday, setBday] = useState<Date | null>(null)
  const [avatar, setAvatar] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const s = makeStyles(c)

  function normalisedBirthday(): string | null {
    if (!bday) return null
    return `${bday.getFullYear()}-${String(bday.getMonth() + 1).padStart(2, "0")}-${String(
      bday.getDate()
    ).padStart(2, "0")}`
  }

  async function pickAvatar() {
    haptics.tap()
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) return Alert.alert("Photos permission needed")
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (!res.canceled) setAvatar(res.assets[0].uri)
  }

  async function next() {
    if (!name.trim()) {
      Alert.alert("What should we call you?", "A first name is enough.")
      return
    }
    haptics.commit()
    setBusy(true)
    try {
      const { data } = await supabase.auth.getUser()
      const uid = data.user?.id
      if (!uid) throw new Error("Not signed in")

      // Upload before saving so the row is written once, with its photo already on it.
      let avatarUrl: string | null = null
      if (avatar && !avatar.startsWith("http")) {
        try {
          avatarUrl = await uploadAvatar(avatar, uid)
        } catch (e) {
          // A failed upload must not block onboarding — they can add it in Settings.
          console.warn("[onboarding] avatar upload failed:", (e as Error).message)
        }
      }

      await saveProfile(uid, {
        name: name.trim(),
        birthday: normalisedBirthday(),
        avatar_url: avatarUrl,
      })

      // Redeeming here (not later) means the group exists before the first answer,
      // so the answer fans out immediately instead of relying on retro-share.
      if (params.invite) {
        try {
          await redeemInvite(params.invite, uid)
        } catch (e) {
          console.warn("[onboarding] invite redeem failed:", (e as Error).message)
        }
      }

      haptics.success()
      // Ask for notifications BEFORE the first answer. Waiting until after meant a
      // user who never got round to answering could never be re-engaged — the one
      // group we most need to reach. If they decline, the post-answer pass asks
      // once more.
      router.replace({ pathname: "/(onboarding-v2)/notifications", params: { stage: "pre" } })
    } catch (e) {
      haptics.warn()
      Alert.alert("Couldn't save", (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <Text style={s.title}>Add your profile</Text>
          <Text style={s.sub}>This is what your groups will see.</Text>

          <Pressable onPress={pickAvatar} style={s.avatarWrap}>
            <Avatar uri={avatar ?? undefined} name={name} size={96} />
            <Text style={s.changePhoto}>{avatar ? "Change photo" : "Add a photo"}</Text>
          </Pressable>

          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="First name"
            placeholderTextColor={c.textSecondary}
            autoCapitalize="words"
            textContentType="givenName"
          />

          {/* Spacing lives here, not in BirthdayField: Settings still gets its gap
              from the field labels, which this screen no longer has. */}
          <View style={{ marginTop: sp.md }}>
            <BirthdayField value={bday} onChange={setBday} />
          </View>
          <Text style={s.hint}>
            Add it and your groups get a nudge to celebrate you. Leave it blank and nothing
            happens — you can add it later in Settings.
          </Text>

          {/* Bevel on the OUTER view. overflow:"hidden" on the shadow-casting view
              clips the shadow away — that is what killed this bevel elsewhere. */}
          <Pressable
            onPress={next}
            disabled={busy}
            style={({ pressed }) => [s.ctaShadow, pressed ? s.ctaPressed : null]}
          >
            <View style={s.ctaInner}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.ctaText}>Continue</Text>}
            </View>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useV2Colors>["c"]) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    body: { flexGrow: 1, justifyContent: "center", padding: sp.xl },
    title: { fontSize: 26, fontWeight: "800", color: c.text, textAlign: "center" },
    sub: { color: c.textSecondary, marginTop: 4, marginBottom: sp.lg, textAlign: "center" },
    avatarWrap: { alignItems: "center", gap: sp.sm, marginBottom: sp.md },
    changePhoto: { color: c.blue, fontWeight: "700" },
    input: {
      backgroundColor: c.surfaceAlt,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 12,
      padding: sp.md,
      fontSize: 16,
      color: c.text,
      marginTop: sp.md,
    },
    hint: { color: c.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 6 },
    ctaShadow: {
      marginTop: sp.xl,
      borderRadius: 28,
      shadowColor: c.border,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 5,
    },
    ctaInner: {
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
    ctaPressed: {
      transform: [{ translateY: 5 }],
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      elevation: 0,
    },
    ctaText: { color: "#fff", fontWeight: "800", fontSize: 17 },
  })
}
