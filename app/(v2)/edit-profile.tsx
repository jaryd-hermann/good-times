import { useEffect, useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import * as ImagePicker from "expo-image-picker"
import { useQueryClient } from "@tanstack/react-query"
import { useAuth } from "../../components/AuthProvider"
import { Avatar } from "../../components/Avatar"
import { useProfile } from "../../lib/v2/useProfile"
import { useV2Colors, v2Spacing as sp } from "../../lib/v2/theme"
import { BackHeader } from "../../components/v2/AppHeader"
import { BirthdayField } from "../../components/v2/BirthdayField"
import { supabase } from "../../lib/supabase"
import { uploadAvatar } from "../../lib/storage"

/**
 * Edit profile — name, birthday, photo.
 *
 * Email is shown but not editable here: changing it goes through Supabase Auth
 * (re-verification), which is a different flow from a profile-row update. Showing
 * it read-only is honest; a text box that silently did nothing would not be.
 */
export default function EditProfileScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const { c } = useV2Colors()
  const qc = useQueryClient()
  const { data: profile, isLoading } = useProfile(user?.id)

  const [name, setName] = useState("")
  const [bday, setBday] = useState<Date | null>(null)
  const [avatar, setAvatar] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const s = makeStyles(c)

  useEffect(() => {
    if (!profile) return
    setName(profile.name ?? "")
    setAvatar(profile.avatar_url ?? null)
    if (profile.birthday) setBday(new Date(profile.birthday + "T00:00:00"))
  }, [profile])

  function normalisedBirthday(): string | null {
    if (!bday) return null
    return `${bday.getFullYear()}-${String(bday.getMonth() + 1).padStart(2, "0")}-${String(
      bday.getDate()
    ).padStart(2, "0")}`
  }

  async function pickAvatar() {
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

  async function save() {
    if (!user?.id) return
    if (!name.trim()) return Alert.alert("Name required", "Your group sees this next to your answers.")
    const b = normalisedBirthday()

    setBusy(true)
    try {
      let avatarUrl = profile?.avatar_url ?? null
      if (avatar && avatar !== profile?.avatar_url && !avatar.startsWith("http")) {
        avatarUrl = await uploadAvatar(avatar, user.id)
      }
      const { error } = await supabase
        .from("users")
        .update({ name: name.trim(), birthday: b, avatar_url: avatarUrl })
        .eq("id", user.id)
      if (error) throw error

      await qc.invalidateQueries({ queryKey: ["v2", "profile", user.id] })
      router.back()
    } catch (e) {
      Alert.alert("Couldn't save", (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <BackHeader title="Edit profile" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: sp.lg }} keyboardShouldPersistTaps="handled">
          {isLoading ? (
            <ActivityIndicator color={c.text} />
          ) : (
            <>
              <Pressable onPress={pickAvatar} style={s.avatarWrap}>
                <Avatar uri={avatar ?? undefined} name={name} size={96} />
                <Text style={s.changePhoto}>Change photo</Text>
              </Pressable>

              <Text style={s.label}>Name</Text>
              <TextInput
                style={s.input}
                value={name}
                onChangeText={setName}
                placeholder="First name"
                placeholderTextColor={c.textSecondary}
                autoCapitalize="words"
              />

              <Text style={s.label}>Birthday</Text>
              <BirthdayField value={bday} onChange={setBday} />
              <Text style={s.hint}>
                Add it and your groups get a nudge to celebrate you. Leave it blank and nothing
                happens.
              </Text>

              <Text style={s.label}>Email</Text>
              <View style={[s.input, s.inputDisabled]}>
                <Text style={s.disabledText}>{user?.email}</Text>
              </View>
              <Text style={s.hint}>
                Changing your email goes through sign-in verification — contact us and we&rsquo;ll
                move it.
              </Text>

              <Pressable
                onPress={save}
                disabled={busy}
                style={({ pressed }) => [s.cta, pressed ? { transform: [{ translateY: 2 }] } : null]}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.ctaText}>Save</Text>}
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useV2Colors>["c"]) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    avatarWrap: { alignItems: "center", marginBottom: sp.lg, gap: sp.sm },
    changePhoto: { color: c.blue, fontWeight: "700" },
    label: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.6,
      color: c.textSecondary,
      marginTop: sp.md,
      marginBottom: sp.sm,
      textTransform: "uppercase",
    },
    input: {
      backgroundColor: c.surfaceAlt,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 12,
      padding: sp.md,
      fontSize: 16,
      color: c.text,
    },
    inputDisabled: { backgroundColor: c.surface, opacity: 0.7 },
    disabledText: { fontSize: 16, color: c.textSecondary },
    hint: { color: c.textSecondary, fontSize: 12, marginTop: 6, lineHeight: 17 },
    cta: {
      backgroundColor: c.pink,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 26,
      paddingVertical: 15,
      alignItems: "center",
      marginTop: sp.xl,
    },
    ctaText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  })
}
