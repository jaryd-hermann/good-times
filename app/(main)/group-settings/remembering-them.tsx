"use client"

import { useEffect, useState } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Modal } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import * as ImagePicker from "expo-image-picker"
import * as FileSystem from "expo-file-system/legacy"
import { decode } from "base64-arraybuffer"
import { supabase } from "../../../lib/supabase"
import { getMemorials, createMemorial, deleteMemorial, updateMemorial, isGroupAdmin } from "../../../lib/db"
import { colors, spacing, typography } from "../../../lib/theme"
import { FontAwesome } from "@expo/vector-icons"
import { Avatar } from "../../../components/Avatar"
import { Button } from "../../../components/Button"

export default function RememberingThemSettings() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const groupId = params.groupId as string
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState<string>()
  const [isAdmin, setIsAdmin] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newMemorialName, setNewMemorialName] = useState("")
  const [newMemorialPhotoUri, setNewMemorialPhotoUri] = useState<string | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const { data: memorials = [], isLoading } = useQuery({
    queryKey: ["memorials", groupId],
    queryFn: () => getMemorials(groupId),
    enabled: !!groupId,
  })

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const admin = await isGroupAdmin(groupId, user.id)
        setIsAdmin(admin)
        if (!admin) {
          Alert.alert("Access Denied", "Only admins can manage memorials.")
          router.replace({
            pathname: "/(main)/group-settings",
            params: { groupId },
          })
        }
      }
    }
    if (groupId) {
      loadUser()
    }
  }, [groupId, router])

  async function uploadMemorialPhoto(localUri: string, memorialId: string): Promise<string> {
    // Read file as base64 - SDK 54 uses string literal
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: "base64" as any,
    })

    if (!base64 || base64.length === 0) {
      throw new Error("Failed to read image file")
    }

    const fileExt = localUri.split(".").pop() ?? "jpg"
    const fileName = `${memorialId}-${Date.now()}.${fileExt}`
    const filePath = `${groupId}/${memorialId}/${fileName}`

    const contentType = `image/${fileExt === "png" ? "png" : fileExt === "webp" ? "webp" : "jpeg"}`

    const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, decode(base64), {
      cacheControl: "3600",
      upsert: true,
      contentType,
    })

    if (uploadError) throw uploadError

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(filePath)

    return publicUrl
  }

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant photo library access")
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })

    if (!result.canceled) {
      setNewMemorialPhotoUri(result.assets[0].uri)
    }
  }

  async function handleAddMemorial() {
    if (!newMemorialName.trim() || !userId || !groupId) {
      Alert.alert("Error", "Please enter a name")
      return
    }

    setSaving(true)
    try {
      // Create memorial first
      const memorial = await createMemorial({
        user_id: userId,
        group_id: groupId,
        name: newMemorialName.trim(),
      })

      // Upload photo if provided
      let photoUrl: string | undefined = undefined
      if (newMemorialPhotoUri && newMemorialPhotoUri.startsWith("file")) {
        setUploadingPhoto(true)
        try {
          photoUrl = await uploadMemorialPhoto(newMemorialPhotoUri, memorial.id)
          // Update memorial with photo URL
          await updateMemorial(memorial.id, { photo_url: photoUrl }, userId)
        } catch (error: any) {
          console.error("Failed to upload photo:", error)
          Alert.alert("Warning", "Memorial created but photo upload failed: " + (error.message || "Unknown error"))
        } finally {
          setUploadingPhoto(false)
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["memorials", groupId] })
      setNewMemorialName("")
      setNewMemorialPhotoUri(undefined)
      setShowAddModal(false)
      Alert.alert("Success", "Memorial added successfully")
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to add memorial")
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateMemorialPhoto(memorialId: string) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant photo library access")
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })

    if (result.canceled || !userId) return

    setUploadingPhoto(true)
    try {
      const photoUrl = await uploadMemorialPhoto(result.assets[0].uri, memorialId)
      await updateMemorial(memorialId, { photo_url: photoUrl }, userId)
      await queryClient.invalidateQueries({ queryKey: ["memorials", groupId] })
      Alert.alert("Success", "Photo updated successfully")
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to update photo")
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function handleDeleteMemorial(memorialId: string, memorialName: string) {
    if (!userId) return

    Alert.alert(
      "Remove Memorial",
      `Are you sure you want to remove ${memorialName}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMemorial(memorialId, userId)
              await queryClient.invalidateQueries({ queryKey: ["memorials", groupId] })
              Alert.alert("Success", "Memorial removed successfully")
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to remove memorial")
            }
          },
        },
      ]
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Remembering Them</Text>
        <TouchableOpacity
          onPress={() =>
            router.replace({
              pathname: "/(main)/group-settings",
              params: { groupId },
            })
          }
          style={styles.closeButton}
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.description}>
          Manage the people your group is remembering. These names will be used in personalized prompts.
        </Text>

        {isLoading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : memorials.length === 0 ? (
          <View style={styles.emptyState}>
            <FontAwesome name="heart" size={48} color={colors.gray[600]} />
            <Text style={styles.emptyText}>No memorials added yet</Text>
            <Text style={styles.emptySubtext}>Add someone to personalize your prompts</Text>
          </View>
        ) : (
          <View style={styles.memorialsList}>
            {memorials.map((memorial) => (
              <View key={memorial.id} style={styles.memorialCard}>
                <TouchableOpacity
                  onPress={() => handleUpdateMemorialPhoto(memorial.id)}
                  disabled={uploadingPhoto}
                >
                  <Avatar uri={memorial.photo_url} name={memorial.name} size={48} />
                </TouchableOpacity>
                <View style={styles.memorialInfo}>
                  <Text style={styles.memorialName}>{memorial.name}</Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteMemorial(memorial.id, memorial.name)}
                >
                  <FontAwesome name="trash" size={18} color={colors.gray[400]} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <Button
          title="Add someone else"
          onPress={() => setShowAddModal(true)}
          style={styles.addButton}
        />
      </ScrollView>

      {/* Add Memorial Modal */}
      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Someone</Text>
            <Text style={styles.modalSubtitle}>Enter the name of the person you're remembering</Text>
            
            <TextInput
              value={newMemorialName}
              onChangeText={setNewMemorialName}
              placeholder="Name"
              placeholderTextColor={colors.gray[500]}
              style={styles.input}
              autoCapitalize="words"
              autoFocus
            />

            <View style={styles.photoSection}>
              <Text style={styles.photoLabel}>Add a photo (optional)</Text>
              <TouchableOpacity onPress={pickImage} style={styles.photoButton} disabled={uploadingPhoto}>
                <Text style={styles.photoButtonText}>
                  {newMemorialPhotoUri ? "Change Photo" : "Add Photo"}
                </Text>
              </TouchableOpacity>
              {newMemorialPhotoUri && (
                <View style={styles.photoPreviewContainer}>
                  <Avatar uri={newMemorialPhotoUri} name={newMemorialName || "Memorial"} size={80} />
                </View>
              )}
            </View>

            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                onPress={() => {
                  setShowAddModal(false)
                  setNewMemorialName("")
                  setNewMemorialPhotoUri(undefined)
                }}
                variant="secondary"
                style={styles.modalButton}
              />
              <Button
                title="Save"
                onPress={handleAddMemorial}
                loading={saving || uploadingPhoto}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
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
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.md,
    gap: spacing.md,
  },
  description: {
    ...typography.body,
    color: colors.gray[400],
    marginBottom: spacing.sm,
  },
  loadingText: {
    ...typography.body,
    color: colors.gray[400],
    textAlign: "center",
    padding: spacing.xl,
  },
  emptyState: {
    alignItems: "center",
    padding: spacing.xxl,
    gap: spacing.md,
  },
  emptyText: {
    ...typography.bodyBold,
    fontSize: 18,
    color: colors.gray[400],
  },
  emptySubtext: {
    ...typography.body,
    color: colors.gray[500],
    textAlign: "center",
  },
  memorialsList: {
    gap: spacing.sm,
  },
  memorialCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.gray[900],
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.md,
  },
  memorialInfo: {
    flex: 1,
  },
  memorialName: {
    ...typography.bodyBold,
    fontSize: 16,
  },
  deleteButton: {
    padding: spacing.sm,
  },
  addButton: {
    marginTop: spacing.md,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.black,
    borderRadius: 24,
    padding: spacing.lg,
    width: "100%",
    maxWidth: 400,
    gap: spacing.md,
  },
  modalTitle: {
    ...typography.h2,
    fontSize: 24,
  },
  modalSubtitle: {
    ...typography.body,
    color: colors.gray[400],
  },
  input: {
    ...typography.body,
    color: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[700],
    paddingVertical: spacing.sm,
    fontSize: 18,
  },
  modalButtons: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  modalButton: {
    flex: 1,
  },
  photoSection: {
    marginTop: spacing.md,
  },
  photoLabel: {
    ...typography.body,
    color: colors.gray[400],
    marginBottom: spacing.sm,
  },
  photoButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.gray[800],
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  photoButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
  photoPreviewContainer: {
    marginTop: spacing.md,
    alignItems: "flex-start",
  },
})

