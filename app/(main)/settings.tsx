"use client"

import { useEffect, useState } from "react"
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Image,
  Switch,
  Platform,
  Modal,
} from "react-native"
import { useRouter } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import * as ImagePicker from "expo-image-picker"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker"
import { format } from "date-fns"
import { supabase } from "../../lib/supabase"
import { getCurrentUser, updateUser, getUserGroups } from "../../lib/db"
import { colors, spacing, typography } from "../../lib/theme"
import { Input } from "../../components/Input"
import { Button } from "../../components/Button"

export default function SettingsScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [birthday, setBirthday] = useState<Date | undefined>()
  const [avatarUri, setAvatarUri] = useState<string | undefined>()
  const [initialAvatar, setInitialAvatar] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [dailyQuestionNotifications, setDailyQuestionNotifications] = useState(true)
  const [primaryGroupId, setPrimaryGroupId] = useState<string | undefined>()
  const [showBirthdayPicker, setShowBirthdayPicker] = useState(false)

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: getCurrentUser,
  })

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "")
      setEmail(profile.email ?? "")
      setBirthday(profile.birthday ? new Date(profile.birthday) : undefined)
      setAvatarUri(profile.avatar_url ?? undefined)
      setInitialAvatar(profile.avatar_url ?? undefined)
    }
  }, [profile])

  useEffect(() => {
    async function loadGroups() {
      if (!profile?.id) return
      try {
        const groups = await getUserGroups(profile.id)
        if (groups.length > 0) {
          setPrimaryGroupId(groups[0].id)
        }
      } catch (error) {
        console.warn("[settings] failed to load groups", error)
      }
    }
    loadGroups()
  }, [profile?.id])

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow photo access to update your picture.")
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })

    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri)
    }
  }

  async function uploadAvatar(localUri: string, userId: string) {
    const response = await fetch(localUri)
    const blob = await response.blob()
    const fileExt = localUri.split(".").pop() ?? "jpg"
    const fileName = `${userId}-${Date.now()}.${fileExt}`
    const filePath = `${userId}/${fileName}`

    const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, blob, {
      cacheControl: "3600",
      upsert: true,
      contentType: blob.type || `image/${fileExt}`,
    })

    if (uploadError) throw uploadError

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(filePath)

    return publicUrl
  }

  async function handleSave() {
    if (!profile?.id) return

    if (!name.trim() || !email.trim()) {
      Alert.alert("Hold on", "Name and email are required before saving.")
      return
    }

    setSaving(true)
    try {
      let avatarUrl = avatarUri
      if (avatarUri && avatarUri !== initialAvatar && avatarUri.startsWith("file")) {
        avatarUrl = await uploadAvatar(avatarUri, profile.id)
      }

      const birthdayISO = birthday ? birthday.toISOString().split("T")[0] : null

      await updateUser(profile.id, {
        name: name.trim(),
        email: email.trim(),
        avatar_url: avatarUrl,
        birthday: birthdayISO ?? undefined,
      })

      if (email.trim() !== (profile.email ?? "").trim()) {
        const { error: emailError } = await supabase.auth.updateUser({ email: email.trim() })
        if (emailError) throw emailError
        Alert.alert(
          "Verify your email",
          "We sent a confirmation link to your new address. Please verify to finish updating your account."
        )
      }

      await queryClient.invalidateQueries({ queryKey: ["profile"] })
      await queryClient.invalidateQueries({ queryKey: ["members"] })
      Alert.alert("Saved", "Profile updated successfully.")
      router.back()
    } catch (error: any) {
      Alert.alert("Error", error.message)
    } finally {
      setSaving(false)
    }
  }

  function openBirthdayPicker() {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: birthday ?? new Date(),
        mode: "date",
        maximumDate: new Date(),
        onChange: (_event, selectedDate) => {
          if (selectedDate) {
            setBirthday(selectedDate)
          }
        },
      })
    } else {
      setShowBirthdayPicker(true)
    }
  }

  async function handleInvite() {
    if (!primaryGroupId) {
      Alert.alert("No group yet", "Create a group first to share your invite link.")
      return
    }

    router.push({
      pathname: "/(onboarding)/create-group/invite",
      params: { groupId: primaryGroupId },
    })
  }

  async function handleSignOut() {
    try {
      await supabase.auth.signOut()
      await queryClient.invalidateQueries()
      router.replace("/(onboarding)/welcome-1")
    } catch (error: any) {
      Alert.alert("Error", error.message)
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileRow}>
          <TouchableOpacity onPress={pickImage} style={styles.avatarButton}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>Add Photo</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.nameField}>
            <Input label="Name" value={name} onChangeText={setName} placeholder="Your name" />
          </View>
        </View>
        <Input label="Email" value={email} onChangeText={setEmail} placeholder="you@email.com" keyboardType="email-address" />

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Birthday</Text>
          <TouchableOpacity onPress={openBirthdayPicker} style={styles.inlineField}>
            <Text style={styles.inlineFieldText}>
              {birthday ? format(birthday, "MMMM d, yyyy") : "Select your birthday"}
            </Text>
          </TouchableOpacity>
        </View>

        {Platform.OS === "ios" && (
          <Modal visible={showBirthdayPicker} transparent animationType="fade" onRequestClose={() => setShowBirthdayPicker(false)}>
            <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowBirthdayPicker(false)}>
              <View style={styles.modalSheet}>
                <DateTimePicker
                  value={birthday ?? new Date()}
                  mode="date"
                  display="spinner"
                  onChange={(_event, selectedDate) => {
                    if (selectedDate) {
                      setBirthday(selectedDate)
                    }
                  }}
                  maximumDate={new Date()}
                  style={styles.iosPicker}
                />
                <Button title="Done" onPress={() => setShowBirthdayPicker(false)} style={styles.modalButton} />
              </View>
            </TouchableOpacity>
          </Modal>
        )}

        <View style={styles.sectionCard}>
          <View style={styles.sectionRow}>
            <View>
              <Text style={styles.sectionTitle}>Notifications</Text>
              <Text style={styles.sectionSubtitle}>Stay updated when your group shares.</Text>
            </View>
            <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} trackColor={{ true: colors.accent }} />
          </View>
          <View style={styles.sectionRow}>
            <View>
              <Text style={styles.sectionTitle}>Daily question</Text>
              <Text style={styles.sectionSubtitle}>Get reminder each day to share.</Text>
            </View>
            <Switch
              value={dailyQuestionNotifications}
              onValueChange={setDailyQuestionNotifications}
              trackColor={{ true: colors.accent }}
            />
          </View>
        </View>

        <View style={styles.actions}>
          <Button title="Save changes" onPress={handleSave} loading={saving} />
          <Button title="Invite your group" onPress={handleInvite} variant="secondary" />
          <Button title="Log out" onPress={handleSignOut} variant="ghost" textStyle={styles.signOutText} />
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeButton: {
    padding: spacing.sm,
  },
  closeText: {
    ...typography.h2,
    color: colors.white,
  },
  title: {
    ...typography.h1,
    color: colors.white,
    fontSize: 32,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  fieldLabel: {
    ...typography.bodyMedium,
    color: colors.gray[400],
  },
  inlineField: {
    borderBottomWidth: 1,
    borderColor: colors.gray[700],
    paddingVertical: spacing.sm,
  },
  inlineFieldText: {
    ...typography.body,
    color: colors.white,
    fontSize: 18,
  },
  profileRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
  },
  nameField: {
    flex: 1,
  },
  avatarButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: colors.gray[700],
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarPlaceholder: {
    flex: 1,
    backgroundColor: colors.gray[800],
    justifyContent: "center",
    alignItems: "center",
  },
  avatarPlaceholderText: {
    ...typography.bodyMedium,
    color: colors.gray[400],
  },
  avatarHint: {
    ...typography.caption,
    color: colors.gray[500],
    marginTop: spacing.sm,
  },
  sectionCard: {
    backgroundColor: colors.gray[900],
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.bodyBold,
    color: colors.white,
    fontSize: 16,
  },
  sectionSubtitle: {
    ...typography.body,
    color: colors.gray[400],
    fontSize: 14,
  },
  actions: {
    gap: spacing.md,
  },
  signOutText: {
    color: colors.gray[300],
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.black,
    padding: spacing.lg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: spacing.lg,
  },
  iosPicker: {
    width: "100%",
  },
  modalButton: {
    width: "100%",
  },
})
