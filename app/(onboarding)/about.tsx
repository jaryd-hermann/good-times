"use client"

import { useState, useRef, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Image,
  TextInput,
} from "react-native"
import { useRouter } from "expo-router"
import * as ImagePicker from "expo-image-picker"
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker"
import { Modal } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { FontAwesome } from "@expo/vector-icons"
import { colors, spacing } from "../../lib/theme"
import { Avatar } from "../../components/Avatar"
import { useOnboarding } from "../../components/OnboardingProvider"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { usePostHog } from "posthog-react-native"
import { captureEvent } from "../../lib/posthog"

// Theme 2 color palette matching new design system
const theme2Colors = {
  red: "#B94444",
  yellow: "#E8A037",
  green: "#2D6F4A",
  blue: "#3A5F8C",
  beige: "#E8E0D5",
  cream: "#F5F0EA",
  white: "#FFFFFF",
  text: "#000000",
  textSecondary: "#404040",
  onboardingPink: "#D97393", // Pink for onboarding CTAs
}

const PENDING_GROUP_KEY = "pending_group_join"

export default function About() {
  const router = useRouter()
  const { data, setUserName, setUserBirthday, setUserPhoto } = useOnboarding()
  const [name, setName] = useState(data.userName || "")
  const [birthday, setBirthday] = useState(data.userBirthday || new Date(1969, 2, 15))
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [photoUri, setPhotoUri] = useState<string | undefined>(data.userPhoto)
  const [loading, setLoading] = useState(false)
  const [nameFocused, setNameFocused] = useState(false)
  const insets = useSafeAreaInsets()
  const nameInputRef = useRef<TextInput>(null)

  const posthog = usePostHog()

  // Track loaded_about event
  useEffect(() => {
    try {
      if (posthog) {
        posthog.capture("loaded_about")
      } else {
        captureEvent("loaded_about")
      }
    } catch (error) {
      if (__DEV__) console.error("[about] Failed to track event:", error)
    }
  }, [posthog])

  // Auto-focus the input when component mounts
  useEffect(() => {
    // Small delay to ensure the component is fully rendered
    const timer = setTimeout(() => {
      nameInputRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant photo library access to add a profile photo")
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })

    if (!result.canceled) {
      const uri = result.assets[0].uri
      setPhotoUri(uri)
      // Immediately save to onboarding provider so it persists
      setUserPhoto(uri)
    }
  }

  function openDatePicker() {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: birthday,
        mode: "date",
        onChange: (_event, selectedDate) => {
          if (selectedDate) {
            setBirthday(selectedDate)
          }
        },
        maximumDate: new Date(),
      })
    } else {
      setShowDatePicker(true)
    }
  }

  async function handleContinue() {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter your name")
      return
    }

    setLoading(true)
    setUserName(name.trim())
    setUserBirthday(birthday)
    setUserPhoto(photoUri)
    
    // Save onboarding data and continue to auth
    // Auth will handle group join if pending_group_join exists
    router.push("/(onboarding)/auth")
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <FontAwesome name="angle-left" size={18} color={theme2Colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>About You</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.prompt}>What does everyone call you?</Text>
          <View style={styles.fieldGroup}>
            <TextInput
              ref={nameInputRef}
              value={name}
              onChangeText={setName}
              placeholder="Lucy"
              autoCapitalize="words"
              autoFocus={true}
              placeholderTextColor={theme2Colors.textSecondary}
              style={[
                styles.fieldInput,
                nameFocused && styles.fieldInputFocused,
              ]}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
            />
          </View>

          <View style={styles.dateSection}>
            <Text style={styles.label}>When is your birthday? We'll make sure it's a good day for you here.</Text>
            <TouchableOpacity onPress={openDatePicker} style={styles.dateButton}>
              <Text style={styles.dateText}>
                {birthday.getDate()} {birthday.toLocaleString("default", { month: "short" })} {birthday.getFullYear()}
              </Text>
            </TouchableOpacity>
            {Platform.OS === "ios" && (
              <Modal transparent animationType="fade" visible={showDatePicker} onRequestClose={() => setShowDatePicker(false)}>
                <TouchableOpacity 
                  style={styles.modalBackdrop} 
                  activeOpacity={1} 
                  onPress={() => setShowDatePicker(false)}
                >
                  <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                    <DateTimePicker
                      value={birthday}
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
                    <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.modalButton}>
                      <Text style={styles.modalButtonText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </Modal>
            )}
          </View>

          <View style={styles.photoSection}>
            <Text style={styles.label}>Add a photo of yourself</Text>
            <TouchableOpacity onPress={pickImage} style={styles.photoButton}>
              {photoUri ? (
                <Avatar uri={photoUri} name={name || "User"} size={80} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <FontAwesome name="plus" size={24} color={theme2Colors.text} />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={handleContinue}
            activeOpacity={0.8}
            disabled={loading}
          >
            <Text style={styles.ctaButtonText}>→</Text>
            <View style={styles.buttonTexture} pointerEvents="none">
              <Image
                source={require("../../assets/images/texture.png")}
                style={styles.textureImage}
                resizeMode="cover"
              />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme2Colors.beige,
  },
  container: {
    flex: 1,
    backgroundColor: theme2Colors.beige,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xxl * 2,
    paddingBottom: spacing.xxl * 4,
  },
  topBar: {
    marginBottom: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme2Colors.white,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: "PMGothicLudington-Text115",
    fontSize: 40,
    lineHeight: 48,
    color: theme2Colors.text,
  },
  form: {
    marginBottom: spacing.lg,
  },
  prompt: {
    fontFamily: "Roboto-Regular",
    fontSize: 18,
    lineHeight: 26,
    color: theme2Colors.text,
    marginBottom: spacing.md,
  },
  fieldGroup: {
    marginBottom: spacing.xl,
  },
  fieldInput: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    color: theme2Colors.text,
    backgroundColor: theme2Colors.cream,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme2Colors.textSecondary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  fieldInputFocused: {
    borderColor: theme2Colors.blue,
  },
  label: {
    fontFamily: "Roboto-Regular",
    fontSize: 18,
    lineHeight: 26,
    color: theme2Colors.text,
    marginBottom: spacing.md,
  },
  dateSection: {
    marginBottom: spacing.xl,
  },
  dateButton: {
    alignSelf: "flex-start",
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    borderColor: theme2Colors.text,
  },
  dateText: {
    fontFamily: "PMGothicLudington-Text115",
    fontSize: 28,
    lineHeight: 36,
    color: theme2Colors.text,
  },
  photoSection: {
    marginBottom: spacing.xl,
  },
  photoButton: {
    alignSelf: "flex-start",
  },
  photoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme2Colors.cream,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: theme2Colors.textSecondary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: theme2Colors.beige,
    padding: spacing.lg,
    width: "100%",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    alignItems: "center",
    minHeight: 300,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: theme2Colors.textSecondary,
  },
  iosPicker: {
    width: "100%",
    height: 200,
  },
  modalButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: theme2Colors.blue,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
  },
  modalButtonText: {
    fontFamily: "Roboto-Bold",
    fontSize: 18,
    color: theme2Colors.white,
  },
  buttonContainer: {
    alignItems: "flex-end",
    marginTop: spacing.md,
  },
  ctaButton: {
    width: 100,
    height: 60,
    backgroundColor: theme2Colors.onboardingPink,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: theme2Colors.blue,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ctaButtonText: {
    fontFamily: "Roboto-Bold",
    fontSize: 32,
    color: theme2Colors.white,
    zIndex: 2,
  },
  buttonTexture: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.3,
    zIndex: 1,
  },
  textureImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
})
