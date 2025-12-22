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
  ActivityIndicator,
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
import { FontAwesome } from "@expo/vector-icons"
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
  const [focusedInput, setFocusedInput] = useState<string | null>(null)
  const posthog = usePostHog()

  // Theme 2 color palette - dynamic based on dark/light mode
  const theme2Colors = useMemo(() => ({
    red: "#B94444",
    yellow: "#E8A037",
    green: "#2D6F4A",
    blue: "#3A5F8C",
    beige: isDark ? "#000000" : "#E8E0D5", // Black in dark mode
    cream: isDark ? "#000000" : "#F5F0EA", // Black in dark mode
    white: isDark ? "#E8E0D5" : "#FFFFFF", // Beige in dark mode
    text: isDark ? "#F5F0EA" : "#000000", // Cream in dark mode
    textSecondary: isDark ? "#A0A0A0" : "#404040", // Light gray in dark mode
  }), [isDark])

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
      backgroundColor: theme2Colors.beige,
    },
    header: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? theme2Colors.beige : theme2Colors.white, // Black in dark mode
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme2Colors.text, // Cream in dark mode
    },
    title: {
      fontFamily: "PMGothicLudington-Text115",
      fontSize: 32,
      color: theme2Colors.text,
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
    avatarImage: {
      width: "100%",
      height: "100%",
    },
    fieldGroup: {
      marginBottom: spacing.xl,
      gap: spacing.xs,
    },
    inlineFieldGroup: {
      gap: spacing.xs,
      marginBottom: spacing.xl,
    },
    inlineInput: {
      ...typography.body,
      color: theme2Colors.text,
      backgroundColor: isDark ? "#111111" : theme2Colors.white, // Dark gray in dark mode
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme2Colors.textSecondary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      fontSize: 16,
    },
    inlineInputFocused: {
      borderColor: theme2Colors.blue,
    },
    inlineField: {
      backgroundColor: isDark ? "#111111" : theme2Colors.white, // Dark gray in dark mode
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme2Colors.textSecondary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    inlineFieldFocused: {
      borderColor: theme2Colors.blue,
    },
    inlineFieldText: {
      ...typography.body,
      color: theme2Colors.text,
      fontSize: 16,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: theme2Colors.beige,
      padding: spacing.lg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      gap: spacing.lg,
    },
    iosPicker: {
      width: "100%",
    },
    doneButton: {
      backgroundColor: theme2Colors.blue,
      borderRadius: 25,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
    },
    doneButtonText: {
      ...typography.bodyBold,
      fontSize: 18,
      color: theme2Colors.white,
      textAlign: "center",
    },
    saveButton: {
      backgroundColor: theme2Colors.blue,
      borderRadius: 25,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      alignItems: "center",
      justifyContent: "center",
      marginTop: spacing.md,
    },
    saveButtonText: {
      ...typography.bodyBold,
      fontSize: 18,
      color: theme2Colors.white,
      textAlign: "center",
    },
    fieldLabel: {
      ...typography.bodyMedium,
      color: theme2Colors.text,
      fontSize: 14,
      fontWeight: "600",
      marginBottom: spacing.xs,
    },
    avatarButton: {
      width: 180,
      height: 180,
      borderRadius: 20, // Square with rounded edges matching Mini Profile
      overflow: "hidden",
      borderWidth: 3,
      borderColor: theme2Colors.red, // Red border matching Mini Profile
      backgroundColor: theme2Colors.beige,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarPlaceholder: {
      flex: 1,
      backgroundColor: theme2Colors.textSecondary,
      justifyContent: "center",
      alignItems: "center",
      width: "100%",
      height: "100%",
    },
    avatarPlaceholderText: {
      ...typography.bodyMedium,
      color: theme2Colors.white,
    },
    avatarHint: {
      ...typography.caption,
      color: theme2Colors.textSecondary,
    },
  }), [colors, isDark, theme2Colors])

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Edit Profile</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton} activeOpacity={0.7}>
          <FontAwesome name="times" size={16} color={theme2Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileSection}>
          <TouchableOpacity onPress={pickImage} style={styles.avatarButton}>
            {avatarUri ? (
              <Image 
                source={{ uri: avatarUri }} 
                style={{ width: 174, height: 174, borderRadius: 17 }}
                resizeMode="cover"
              />
            ) : (
              <Avatar
                uri={avatarUri}
                name={profile?.name || "User"}
                size={174}
                borderColor={theme2Colors.red}
                square={true}
              />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.inlineFieldGroup}>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
            placeholderTextColor={theme2Colors.textSecondary}
            style={[
              styles.inlineInput,
              focusedInput === "name" && styles.inlineInputFocused,
            ]}
            onFocus={() => setFocusedInput("name")}
            onBlur={() => setFocusedInput(null)}
          />
        </View>

        <View style={styles.inlineFieldGroup}>
          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            placeholderTextColor={theme2Colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            style={[
              styles.inlineInput,
              focusedInput === "email" && styles.inlineInputFocused,
            ]}
            onFocus={() => setFocusedInput("email")}
            onBlur={() => setFocusedInput(null)}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Birthday</Text>
          <TouchableOpacity 
            onPress={openBirthdayPicker} 
            style={[
              styles.inlineField,
              focusedInput === "birthday" && styles.inlineFieldFocused,
            ]}
            onPressIn={() => setFocusedInput("birthday")}
            onPressOut={() => setFocusedInput(null)}
          >
            <Text style={styles.inlineFieldText}>
              {birthday 
                ? (() => {
                    // Format using local date components to avoid timezone issues
                    const monthNames = ["January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December"]
                    const month = monthNames[birthday.getMonth()]
                    const day = birthday.getDate()
                    const year = birthday.getFullYear()
                    return `${month} ${day}, ${year}`
                  })()
                : "Select your birthday"}
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
                  textColor={theme2Colors.text}
                />
                <TouchableOpacity 
                  style={styles.doneButton} 
                  onPress={() => setShowBirthdayPicker(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        )}

        <TouchableOpacity 
          style={styles.saveButton} 
          onPress={handleSave} 
          disabled={saving}
          activeOpacity={0.7}
        >
          {saving ? (
            <ActivityIndicator color={theme2Colors.white} />
          ) : (
            <Text style={styles.saveButtonText}>Save changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

