"use client"

import { useState } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import * as ImagePicker from "expo-image-picker"
import { colors, spacing } from "../../lib/theme"
import { Input } from "../../components/Input"
import { Button } from "../../components/Button"
import { OnboardingBack } from "../../components/OnboardingBack"
import { useOnboarding } from "../../components/OnboardingProvider"

export default function MemorialInput() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const mode = params.mode as string | undefined
  const { setMemorialName, setMemorialPhoto, data } = useOnboarding()
  // Don't pre-populate - start fresh for each new person
  const [name, setName] = useState("")
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined)

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
        <OnboardingBack color={colors.black} />
      </View>
      <View style={styles.header}>
        <Text style={styles.title}>Remembering them</Text>
        <Text style={styles.subtitle}>I'm sorry. I hope this space we make for them helps you all remember the Good Times together.</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.prompt}>What was their name?</Text>
        <Input
          value={name}
          onChangeText={setName}
          placeholder="Amelia"
          placeholderTextColor={colors.gray[500]}
          style={styles.inlineInput}
        />

        <View style={styles.photoSection}>
          <Text style={styles.label}>Add a photo (optional)</Text>
          <TouchableOpacity onPress={pickImage} style={styles.photoButton}>
            <Text style={styles.photoButtonText}>{photoUri ? "Change Photo" : "Add Photo"}</Text>
          </TouchableOpacity>
          {!!photoUri && <Image source={{ uri: photoUri }} style={styles.photoPreview} />}
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <Button title="→" onPress={handleContinue} style={styles.button} textStyle={styles.buttonText} />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xxl * 2,
    paddingBottom: spacing.xxl * 2,
  },
  topBar: {
    marginBottom: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: "LibreBaskerville-Bold",
    fontSize: 32,
    color: colors.black,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    lineHeight: 24,
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
    minHeight: undefined,
    height: undefined,
    fontFamily: "LibreBaskerville-Regular",
    fontSize: 28,
    lineHeight: 32,
    color: colors.black,
    marginTop: spacing.md,
  },
  label: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    color: colors.black,
    marginBottom: spacing.sm,
  },
  photoSection: {
    marginTop: spacing.lg,
  },
  photoButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray[300],
    alignSelf: "flex-start",
  },
  photoButtonText: {
    fontFamily: "Roboto-Bold",
    fontSize: 16,
    color: colors.black,
  },
  photoPreview: {
    width: 120,
    height: 120,
    borderRadius: 8,
    marginTop: spacing.md,
    alignSelf: "flex-start",
  },
  buttonContainer: {
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

