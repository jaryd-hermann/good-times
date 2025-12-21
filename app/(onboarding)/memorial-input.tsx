"use client"

import { useState } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, TextInput } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import * as ImagePicker from "expo-image-picker"
import { colors, spacing } from "../../lib/theme"
import { useOnboarding } from "../../components/OnboardingProvider"
import { usePostHog } from "posthog-react-native"
import { captureEvent } from "../../lib/posthog"
import { FontAwesome } from "@expo/vector-icons"

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
  darkBackground: "#1A1A1C", // Dark background for memorial screen
}

export default function MemorialInput() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const mode = params.mode as string | undefined
  const { setMemorialName, setMemorialPhoto, data } = useOnboarding()
  // Don't pre-populate - start fresh for each new person
  const [name, setName] = useState("")
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined)
  const [nameFocused, setNameFocused] = useState(false)
  const posthog = usePostHog()

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant photo library access")
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    })
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri)
    }
  }

  function handleContinue() {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a name")
      return
    }
    
    // Track added_memorial event
    try {
      const hasPhoto = !!photoUri
      if (posthog) {
        posthog.capture("added_memorial", { has_photo: hasPhoto })
      } else {
        captureEvent("added_memorial", { has_photo: hasPhoto })
      }
    } catch (error) {
      if (__DEV__) console.error("[memorial-input] Failed to track event:", error)
    }
    
    setMemorialName(name.trim())
    setMemorialPhoto(photoUri)
    router.push({
      pathname: "/(onboarding)/memorial-preview",
      params: mode ? { mode } : undefined,
    })
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <FontAwesome name="angle-left" size={18} color={theme2Colors.white} />
        </TouchableOpacity>
      </View>
      <View style={styles.header}>
        <Text style={styles.title}>Remembering them</Text>
        <Text style={styles.subtitle}>I'm sorry. I hope this space we make for them helps you all remember the Good Times together.</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.prompt}>What was their name?</Text>
        <View style={styles.fieldGroup}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Amelia"
            placeholderTextColor={theme2Colors.textSecondary}
            style={[
              styles.fieldInput,
              nameFocused && styles.fieldInputFocused,
            ]}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
          />
        </View>

        <View style={styles.photoSection}>
          <Text style={styles.label}>Add a photo (optional)</Text>
          <TouchableOpacity onPress={pickImage} style={styles.photoButton}>
            <Text style={styles.photoButtonText}>{photoUri ? "Change Photo" : "Add Photo"}</Text>
          </TouchableOpacity>
          {!!photoUri && <Image source={{ uri: photoUri }} style={styles.photoPreview} />}
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={handleContinue}
          activeOpacity={0.8}
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
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme2Colors.darkBackground,
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
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: "PMGothicLudington-Text115",
    fontSize: 40,
    lineHeight: 48,
    color: theme2Colors.white,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    lineHeight: 24,
    color: theme2Colors.white,
  },
  form: {
    marginBottom: spacing.lg,
  },
  prompt: {
    fontFamily: "Roboto-Regular",
    fontSize: 18,
    lineHeight: 26,
    color: theme2Colors.white,
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
    color: theme2Colors.white,
    marginBottom: spacing.sm,
  },
  photoSection: {
    marginTop: spacing.lg,
  },
  photoButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: theme2Colors.white,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme2Colors.textSecondary,
    alignSelf: "flex-start",
  },
  photoButtonText: {
    fontFamily: "Roboto-Bold",
    fontSize: 16,
    color: theme2Colors.text,
  },
  photoPreview: {
    width: 120,
    height: 120,
    borderRadius: 12,
    marginTop: spacing.md,
    alignSelf: "flex-start",
    borderWidth: 2,
    borderColor: theme2Colors.white,
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

