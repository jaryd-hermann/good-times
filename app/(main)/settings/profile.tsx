"use client"

import { useEffect, useState, useMemo } from "react"
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
  TextInput,
} from "react-native"
import { useRouter } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import * as ImagePicker from "expo-image-picker"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker"
import { format } from "date-fns"
import { supabase } from "../../../lib/supabase"
import { getCurrentUser, updateUser } from "../../../lib/db"
import { uploadAvatar } from "../../../lib/storage"
import { spacing, typography } from "../../../lib/theme"
import { useTheme } from "../../../lib/theme-context"
import { Button } from "../../../components/Button"
import { Avatar } from "../../../components/Avatar"
import { usePostHog } from "posthog-react-native"
import { captureEvent } from "../../../lib/posthog"

export default function ProfileSettings() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()
  const { colors, isDark } = useTheme()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [birthday, setBirthday] = useState<Date | undefined>()
  const [avatarUri, setAvatarUri] = useState<string | undefined>()
  const [initialAvatar, setInitialAvatar] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)
  const [showBirthdayPicker, setShowBirthdayPicker] = useState(false)
  const posthog = usePostHog()

  // Track loaded_profile_settings event
  useEffect(() => {
    try {
      if (posthog) {
        posthog.capture("loaded_profile_settings")
      } else {
        captureEvent("loaded_profile_settings")
      }
    } catch (error) {
      if (__DEV__) console.error("[profile-settings] Failed to track loaded_profile_settings:", error)
    }
  }, [posthog])

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: getCurrentUser,
  })

  // Helper function to parse date string as local date (not UTC)
  // Prevents timezone shift issues where "1969-03-15" becomes March 14 in some timezones
  function parseLocalDate(dateString: string): Date {
    const [year, month, day] = dateString.split("-").map(Number)
    // Month is 0-indexed in Date constructor, so subtract 1
    return new Date(year, month - 1, day)
  }

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "")
      setEmail(profile.email ?? "")
      // Parse birthday as local date to avoid timezone shift issues
      setBirthday(profile.birthday ? parseLocalDate(profile.birthday) : undefined)
      setAvatarUri(profile.avatar_url ?? undefined)
      setInitialAvatar(profile.avatar_url ?? undefined)
    }
  }, [profile])

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

  // Import uploadAvatar from storage.ts instead of defining locally

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

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.black,
    },
    header: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: colors.gray[800],
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
      fontSize: 28,
      color: colors.white,
    },
    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    profileSection: {
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.xl,
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
    },
    fieldGroup: {
      marginBottom: spacing.xl,
      gap: spacing.xs,
    },
    fieldLabel: {
      ...typography.bodyMedium,
      color: colors.gray[400],
    },
    inlineFieldGroup: {
      gap: spacing.xs,
      marginBottom: spacing.xl,
    },
    inlineInput: {
      ...typography.body,
      color: colors.white,
      borderBottomWidth: 1,
      borderColor: colors.gray[700],
      paddingVertical: spacing.sm,
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
  }), [colors, isDark])

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Edit Profile</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileSection}>
          <TouchableOpacity onPress={pickImage} style={styles.avatarButton}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>Add Photo</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Tap to update</Text>
        </View>

        <View style={styles.inlineFieldGroup}>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={colors.gray[500]}
            style={styles.inlineInput}
          />
        </View>

        <View style={styles.inlineFieldGroup}>
          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@email.com"
            placeholderTextColor={colors.gray[500]}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.inlineInput}
          />
        </View>

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

        <Button title="Save changes" onPress={handleSave} loading={saving} />
      </ScrollView>
    </View>
  )
}

