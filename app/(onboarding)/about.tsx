"use client"

import { useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from "react-native"
import { useRouter } from "expo-router"
import * as ImagePicker from "expo-image-picker"
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker"
import { Modal } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { colors, spacing } from "../../lib/theme"
import { Input } from "../../components/Input"
import { Button } from "../../components/Button"
import { Avatar } from "../../components/Avatar"
import { OnboardingBack } from "../../components/OnboardingBack"
import { useOnboarding } from "../../components/OnboardingProvider"
import AsyncStorage from "@react-native-async-storage/async-storage"

const PENDING_GROUP_KEY = "pending_group_join"

export default function About() {
  const router = useRouter()
  const { data, setUserName, setUserBirthday, setUserPhoto } = useOnboarding()
  const [name, setName] = useState(data.userName || "")
  const [birthday, setBirthday] = useState(data.userBirthday || new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [photoUri, setPhotoUri] = useState<string | undefined>(data.userPhoto)
  const [loading, setLoading] = useState(false)
  const insets = useSafeAreaInsets()

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
      setPhotoUri(result.assets[0].uri)
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
    
    // Check if we're in a group join flow
    const pendingGroupId = await AsyncStorage.getItem(PENDING_GROUP_KEY)
    if (pendingGroupId) {
      // In group join flow - go to auth, then how-it-works
      router.push("/(onboarding)/auth")
    } else {
      // Normal onboarding - go to auth
      router.push("/(onboarding)/auth")
    }
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <View style={[styles.topBarWrapper, { paddingTop: insets.top + spacing.lg }]}>
        <OnboardingBack color={colors.black} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>You</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.prompt}>What does your group call you?</Text>
          <Input
            value={name}
            onChangeText={setName}
            placeholder="Lucy"
            autoCapitalize="words"
            placeholderTextColor={colors.gray[500]}
            style={styles.inlineInput}
          />

          <View style={styles.dateSection}>
            <Text style={styles.label}>When is your birthday? We'll make sure it's a good day for you here.</Text>
            <TouchableOpacity onPress={openDatePicker} style={styles.dateButton}>
              <Text style={styles.dateText}>
                {birthday.getDate()} {birthday.toLocaleString("default", { month: "short" })} {birthday.getFullYear()}
              </Text>
            </TouchableOpacity>
            {Platform.OS === "ios" && (
              <Modal transparent animationType="fade" visible={showDatePicker} onRequestClose={() => setShowDatePicker(false)}>
                <View style={styles.modalBackdrop}>
                  <View style={styles.modalContent}>
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
                    />
                    <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.modalButton}>
                      <Text style={styles.modalButtonText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>
            )}
          </View>

          <View style={styles.photoSection}>
            <Text style={styles.label}>Add a photo that will show next to your entries</Text>
            <TouchableOpacity onPress={pickImage} style={styles.photoButton}>
              {photoUri ? (
                <Avatar uri={photoUri} name={name || "User"} size={80} />
              ) : (
                <View style={styles.photoPlaceholder} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.ctaContainer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Button
          title="→"
          onPress={handleContinue}
          loading={loading}
          style={styles.button}
          textStyle={styles.buttonText}
        />
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.white,
  },
  topBarWrapper: {
    paddingHorizontal: spacing.lg,
  },
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    padding: spacing.lg,
  },
  topBar: {
    marginBottom: spacing.xl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: "LibreBaskerville-Bold",
    fontSize: 40,
    color: colors.black,
  },
  form: {
    marginBottom: spacing.xxl,
  },
  prompt: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    color: colors.black,
    marginBottom: spacing.xs,
  },
  inlineInput: {
    backgroundColor: "transparent",
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: spacing.xs,
    marginTop: spacing.md,
    minHeight: undefined,
    height: undefined,
    fontFamily: "LibreBaskerville-Regular",
    fontSize: 32,
    color: colors.black,
    lineHeight: 36,
  },
  label: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    lineHeight: 24,
    color: colors.black,
    marginBottom: spacing.md,
  },
  dateSection: {
    marginBottom: spacing.xl,
  },
  dateButton: {
    alignSelf: "flex-start",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderColor: colors.black,
  },
  dateText: {
    fontFamily: "LibreBaskerville-Regular",
    fontSize: 28,
    color: colors.black,
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
    backgroundColor: colors.gray[300],
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    width: "80%",
    borderRadius: 12,
    alignItems: "center",
  },
  iosPicker: {
    width: "100%",
  },
  modalButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.black,
  },
  modalButtonText: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    color: colors.black,
  },
  ctaContainer: {
    paddingHorizontal: spacing.lg,
    alignItems: "flex-end",
  },
  button: {
    width: 100,
    height: 60,
  },
  buttonText: {
    fontSize: 32,
  },
})
