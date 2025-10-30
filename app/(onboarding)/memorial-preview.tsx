"use client"

import { useState } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ImageBackground, Dimensions } from "react-native"
import { useRouter } from "expo-router"
import * as ImagePicker from "expo-image-picker"
import { supabase } from "../../lib/supabase"
import { colors, typography, spacing } from "../../lib/theme"
import { Input } from "../../components/Input"
import { Button } from "../../components/Button"

const { width, height } = Dimensions.get("window")

export default function MemorialPreview() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [photoUri, setPhotoUri] = useState<string>()
  const [loading, setLoading] = useState(false)

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

  async function handleContinue() {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a name")
      return
    }

    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // We'll save the memorial after group is created
      // For now, just store in local state and pass to next screen
      router.push({
        pathname: "/(onboarding)/create-group/name-type",
        params: { memorialName: name, memorialPhoto: photoUri || "" },
      })
    } catch (error: any) {
      Alert.alert("Error", error.message)
    } finally {
      setLoading(false)
    }
  }

  const backgroundSource = photoUri ? { uri: photoUri } : require("../../assets/images/memorial-bg.png")

  return (
    <ImageBackground source={backgroundSource} style={styles.container} resizeMode="cover">
      <View style={styles.overlay} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Good Times, with Amelia</Text>
          <Text style={styles.body}>
            Each week, you'll get a prompt to share a memory, story, or thought about them. A way to keep their spirit
            alive in your group.
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="What was their name?"
            value={name}
            onChangeText={setName}
            placeholder="Amelia"
            style={styles.input}
          />

          <View style={styles.photoSection}>
            <Text style={styles.label}>Add a photo (optional)</Text>
            <TouchableOpacity onPress={pickImage} style={styles.photoButton}>
              <Text style={styles.photoButtonText}>{photoUri ? "Change Photo" : "Add Photo"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <Button
            title="→"
            onPress={handleContinue}
            loading={loading}
            style={styles.button}
            textStyle={styles.buttonText}
          />
        </View>
      </ScrollView>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width,
    height,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xxl * 3,
    paddingBottom: spacing.xxl * 2,
  },
  textContainer: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    fontSize: 32,
    marginBottom: spacing.md,
  },
  body: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.white,
  },
  form: {
    marginBottom: spacing.xxl,
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    color: colors.black,
  },
  label: {
    ...typography.body,
    color: colors.white,
    marginBottom: spacing.sm,
  },
  photoSection: {
    marginTop: spacing.lg,
  },
  photoButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 1,
    borderColor: colors.white,
    alignSelf: "flex-start",
  },
  photoButtonText: {
    ...typography.bodyBold,
    color: colors.white,
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
