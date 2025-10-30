"use client"

import { useState } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from "react-native"
import { useRouter } from "expo-router"
import * as ImagePicker from "expo-image-picker"
import DateTimePicker from "@react-native-community/datetimepicker"
import { supabase } from "../../lib/supabase"
import { colors, spacing } from "../../lib/theme"
import { Input } from "../../components/Input"
import { Button } from "../../components/Button"
import { Avatar } from "../../components/Avatar"

export default function About() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [birthday, setBirthday] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [photoUri, setPhotoUri] = useState<string>()
  const [loading, setLoading] = useState(false)

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

  async function handleContinue() {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter your name")
      return
    }

    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // TODO: Upload photo to storage if provided
      const avatarUrl = photoUri // For now, just use the local URI

      const { error } = await supabase
        .from("users")
        .update({
          name: name.trim(),
          birthday: birthday.toISOString().split("T")[0],
          avatar_url: avatarUrl,
        })
        .eq("id", user.id)

      if (error) throw error

      router.push("/(onboarding)/memorial")
    } catch (error: any) {
      Alert.alert("Error", error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>You</Text>
      </View>

      <View style={styles.form}>
        <Input
          label="What name should your group see?"
          value={name}
          onChangeText={setName}
          placeholder="Lucy"
          autoCapitalize="words"
        />

        <View style={styles.dateSection}>
          <Text style={styles.label}>When is your birthday? We'll make sure that day is special for you here.</Text>
          <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateButton}>
            <Text style={styles.dateText}>
              {birthday.getDate()} {birthday.toLocaleString("default", { month: "short" })} {birthday.getFullYear()}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={birthday}
              mode="date"
              display="spinner"
              onChange={(event, selectedDate) => {
                setShowDatePicker(Platform.OS === "ios")
                if (selectedDate) {
                  setBirthday(selectedDate)
                }
              }}
              maximumDate={new Date()}
            />
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
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  dateText: {
    fontFamily: "LibreBaskerville-Regular",
    fontSize: 32,
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
