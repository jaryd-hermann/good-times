"use client"

import { useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import * as ImagePicker from "expo-image-picker"
import { Audio } from "expo-av"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "../../../lib/supabase"
import { createEntry } from "../../../lib/db"
import { uploadMedia } from "../../../lib/storage"
import { colors, typography, spacing } from "../../../lib/theme"
import { Button } from "../../../components/Button"

export default function EntryComposer() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const promptId = params.promptId as string
  const date = params.date as string

  const [text, setText] = useState("")
  const [mediaUris, setMediaUris] = useState<string[]>([])
  const [mediaTypes, setMediaTypes] = useState<("photo" | "video" | "audio")[]>([])
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState<Audio.Recording>()
  const [currentGroupId, setCurrentGroupId] = useState<string>()
  const [userId, setUserId] = useState<string>()

  useState(() => {
    loadUserAndGroup()
  })

  async function loadUserAndGroup() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      setUserId(user.id)
      const { data: membership } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id)
        .limit(1)
        .single()
      if (membership) {
        setCurrentGroupId(membership.group_id)
      }
    }
  }

  const { data: prompt } = useQuery({
    queryKey: ["prompt", promptId],
    queryFn: async () => {
      const { data } = await supabase.from("prompts").select("*").eq("id", promptId).single()
      return data
    },
    enabled: !!promptId,
  })

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
      setMediaUris([...mediaUris, result.assets[0].uri])
      setMediaTypes([...mediaTypes, "photo"])
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant camera access")
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    })

    if (!result.canceled) {
      setMediaUris([...mediaUris, result.assets[0].uri])
      setMediaTypes([...mediaTypes, "photo"])
    }
  }

  async function startRecording() {
    try {
      const { status } = await Audio.requestPermissionsAsync()
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant microphone access")
        return
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })

      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
      setRecording(recording)
    } catch (error: any) {
      Alert.alert("Error", error.message)
    }
  }

  async function stopRecording() {
    if (!recording) return

    try {
      await recording.stopAndUnloadAsync()
      const uri = recording.getURI()
      if (uri) {
        setMediaUris([...mediaUris, uri])
        setMediaTypes([...mediaTypes, "audio"])
      }
      setRecording(undefined)
    } catch (error: any) {
      Alert.alert("Error", error.message)
    }
  }

  async function handlePost() {
    if (!text.trim() && mediaUris.length === 0) {
      Alert.alert("Error", "Please add some content to your entry")
      return
    }

    if (!currentGroupId || !userId) {
      Alert.alert("Error", "Unable to determine group or user")
      return
    }

    setLoading(true)
    try {
      // Create entry first to get ID
      const entry = await createEntry({
        group_id: currentGroupId,
        user_id: userId,
        prompt_id: promptId,
        date,
        text_content: text.trim() || undefined,
      })

      // Upload media if any
      if (mediaUris.length > 0) {
        const uploadedUrls = await Promise.all(
          mediaUris.map((uri, index) => uploadMedia(currentGroupId, entry.id, uri, mediaTypes[index])),
        )

        // Update entry with media URLs
        await supabase
          .from("entries")
          .update({
            media_urls: uploadedUrls,
            media_types: mediaTypes,
          })
          .eq("id", entry.id)
      }

      Alert.alert("Success", "Your entry has been posted")
      router.back()
    } catch (error: any) {
      Alert.alert("Error", error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={100}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.question}>{prompt?.question}</Text>
        <Text style={styles.description}>{prompt?.description}</Text>

        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Start writing..."
          placeholderTextColor={colors.gray[500]}
          multiline
          autoFocus
        />

        {/* Media preview */}
        {mediaUris.length > 0 && (
          <View style={styles.mediaPreview}>
            {mediaUris.map((uri, index) => (
              <View key={index} style={styles.mediaItem}>
                <Text style={styles.mediaType}>{mediaTypes[index]}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <View style={styles.toolbarButtons}>
          <TouchableOpacity style={styles.toolButton} onPress={pickImage}>
            <Text style={styles.toolButtonText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolButton} onPress={takePhoto}>
            <Text style={styles.toolButtonText}>📷</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolButton} onPress={recording ? stopRecording : startRecording}>
            <Text style={styles.toolButtonText}>{recording ? "⏹" : "🎤"}</Text>
          </TouchableOpacity>
        </View>
        <Button title="Post Entry" onPress={handlePost} loading={loading} style={styles.postButton} />
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: spacing.md,
    paddingTop: spacing.xxl * 2,
  },
  closeButton: {
    ...typography.h2,
    fontSize: 28,
    color: colors.white,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  question: {
    ...typography.h2,
    fontSize: 24,
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    color: colors.gray[400],
    marginBottom: spacing.xl,
  },
  input: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.white,
    minHeight: 200,
    textAlignVertical: "top",
  },
  mediaPreview: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  mediaItem: {
    width: 80,
    height: 80,
    backgroundColor: colors.gray[800],
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 4,
  },
  mediaType: {
    ...typography.caption,
    color: colors.white,
  },
  toolbar: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray[800],
  },
  toolbarButtons: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  toolButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.gray[800],
    justifyContent: "center",
    alignItems: "center",
  },
  toolButtonText: {
    fontSize: 24,
  },
  postButton: {
    width: "100%",
  },
})
