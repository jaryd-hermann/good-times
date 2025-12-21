"use client"

import { useEffect, useState, useMemo } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Modal, ActivityIndicator, Image } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import * as ImagePicker from "expo-image-picker"
import * as FileSystem from "expo-file-system/legacy"
import { decode } from "base64-arraybuffer"
import { supabase } from "../../../lib/supabase"
import { getMemorials, createMemorial, deleteMemorial, updateMemorial, isGroupAdmin, getQuestionCategoryPreferences, updateQuestionCategoryPreference, clearQuestionCategoryPreference } from "../../../lib/db"
import { uploadMemorialPhoto, isLocalFileUri } from "../../../lib/storage"
import { spacing, typography } from "../../../lib/theme"
import { useTheme } from "../../../lib/theme-context"
import { FontAwesome } from "@expo/vector-icons"
import { Avatar } from "../../../components/Avatar"

export default function RememberingThemSettings() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { colors, isDark } = useTheme()
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
  const [savingPreference, setSavingPreference] = useState<string | null>(null)
  const [focusedInput, setFocusedInput] = useState(false)

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
  }

  // Load question category preferences for "Remembering" category
  const { data: preferences = [] } = useQuery({
    queryKey: ["questionPreferences", groupId],
    queryFn: () => getQuestionCategoryPreferences(groupId),
    enabled: !!groupId,
  })

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
      if (newMemorialPhotoUri && isLocalFileUri(newMemorialPhotoUri)) {
        setUploadingPhoto(true)
        try {
          photoUrl = await uploadMemorialPhoto(newMemorialPhotoUri, userId, groupId)
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
      const photoUrl = await uploadMemorialPhoto(result.assets[0].uri, userId, groupId)
      await updateMemorial(memorialId, { photo_url: photoUrl }, userId)
      await queryClient.invalidateQueries({ queryKey: ["memorials", groupId] })
      Alert.alert("Success", "Photo updated successfully")
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to update photo")
    } finally {
      setUploadingPhoto(false)
    }
  }

  type Preference = "more" | "less" | "none" | null

  function getPreferenceForRemembering(): Preference {
    // Category name is "Remembering" in the database
    const pref = preferences.find((p) => p.category === "Remembering")
    return (pref?.preference as Preference) || null
  }

  async function handlePreferenceChange(preference: "more" | "less" | "none") {
    if (!userId || !groupId) return

    const currentPreference = getPreferenceForRemembering()
    const categoryName = "Remembering" // Category name in database
    
    // If clicking the same preference, unselect it (clear the preference)
    if (currentPreference === preference) {
      setSavingPreference(categoryName)
      try {
        await clearQuestionCategoryPreference(groupId, categoryName, userId)
        await queryClient.invalidateQueries({ queryKey: ["questionPreferences", groupId] })
        await queryClient.invalidateQueries({ queryKey: ["dailyPrompt"] })
      } catch (error: any) {
        Alert.alert("Error", error.message || "Failed to clear preference")
      } finally {
        setSavingPreference(null)
      }
      return
    }

    setSavingPreference(categoryName)
    try {
      await updateQuestionCategoryPreference(groupId, categoryName, preference, userId)
      await queryClient.invalidateQueries({ queryKey: ["questionPreferences", groupId] })
      await queryClient.invalidateQueries({ queryKey: ["dailyPrompt"] })
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to update preference")
    } finally {
      setSavingPreference(null)
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

  // Create dynamic styles based on theme (must be before conditional return)
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme2Colors.beige,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme2Colors.white,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme2Colors.text,
    },
    title: {
      fontFamily: "PMGothicLudington-Text115",
      fontSize: 32,
      color: theme2Colors.text,
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
      color: theme2Colors.textSecondary,
      marginBottom: spacing.sm,
    },
    loadingText: {
      ...typography.body,
      color: theme2Colors.textSecondary,
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
      color: theme2Colors.textSecondary,
    },
    emptySubtext: {
      ...typography.body,
      color: theme2Colors.textSecondary,
      textAlign: "center",
    },
    memorialsList: {
      gap: spacing.sm,
    },
    memorialCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme2Colors.cream,
      borderRadius: 16,
      padding: spacing.md,
      gap: spacing.md,
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
    },
    memorialInfo: {
      flex: 1,
    },
    memorialName: {
      ...typography.bodyBold,
      fontSize: 16,
      color: theme2Colors.text,
    },
    deleteButton: {
      padding: spacing.sm,
    },
    addButton: {
      marginTop: spacing.md,
      backgroundColor: theme2Colors.blue,
      borderRadius: 25,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      alignItems: "center",
      justifyContent: "center",
    },
    addButtonText: {
      ...typography.bodyBold,
      fontSize: 18,
      color: theme2Colors.white,
      textAlign: "center",
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "transparent",
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.lg,
    },
    modalContent: {
      backgroundColor: theme2Colors.beige,
      borderRadius: 24,
      padding: spacing.lg,
      width: "100%",
      maxWidth: 400,
      gap: spacing.md,
      borderWidth: 2,
      borderColor: theme2Colors.textSecondary,
    },
    modalTitle: {
      fontFamily: "PMGothicLudington-Text115",
      fontSize: 24,
      color: theme2Colors.text,
    },
    modalSubtitle: {
      ...typography.body,
      color: theme2Colors.textSecondary,
    },
    input: {
      ...typography.body,
      color: theme2Colors.text,
      backgroundColor: theme2Colors.white,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: focusedInput ? theme2Colors.blue : theme2Colors.textSecondary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
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
    modalButtonSecondary: {
      backgroundColor: theme2Colors.white,
      borderRadius: 25,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
    },
    modalButtonSecondaryText: {
      ...typography.bodyBold,
      fontSize: 18,
      color: theme2Colors.text,
      textAlign: "center",
    },
    modalButtonPrimary: {
      backgroundColor: theme2Colors.blue,
      borderRadius: 25,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      alignItems: "center",
      justifyContent: "center",
    },
    modalButtonPrimaryText: {
      ...typography.bodyBold,
      fontSize: 18,
      color: theme2Colors.white,
      textAlign: "center",
    },
    photoSection: {
      marginTop: spacing.md,
    },
    photoLabel: {
      ...typography.body,
      color: theme2Colors.textSecondary,
      marginBottom: spacing.sm,
    },
    photoButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: theme2Colors.textSecondary,
      borderRadius: 8,
      alignSelf: "flex-start",
    },
    photoButtonText: {
      ...typography.bodyMedium,
      color: theme2Colors.white,
    },
    photoPreviewContainer: {
      marginTop: spacing.md,
      alignItems: "flex-start",
    },
    preferenceSection: {
      backgroundColor: theme2Colors.cream,
      borderRadius: 16,
      padding: spacing.md,
      gap: spacing.sm,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
    },
    preferenceTitle: {
      ...typography.bodyBold,
      fontSize: 16,
      color: theme2Colors.text,
    },
    preferenceDescription: {
      ...typography.caption,
      color: theme2Colors.textSecondary,
      fontSize: 13,
      marginBottom: spacing.xs,
    },
    preferenceButtons: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    preferenceButton: {
      flex: 1,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: 8,
      backgroundColor: theme2Colors.textSecondary,
      alignItems: "center",
    },
    preferenceButtonActive: {
      backgroundColor: theme2Colors.blue,
    },
    preferenceButtonDisabled: {
      opacity: 0.5,
    },
    preferenceButtonText: {
      ...typography.bodyMedium,
      color: theme2Colors.text,
    },
    preferenceButtonTextActive: {
      color: theme2Colors.white,
    },
  }), [colors, isDark, focusedInput])

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
          activeOpacity={0.7}
        >
          <FontAwesome name="times" size={16} color={theme2Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.description}>
          Manage the people your group is remembering. These names will be used in personalized prompts.
        </Text>

        {/* Remembering Question Category Controls - only show if group has memorials */}
        {memorials.length > 0 && (
          <View style={styles.preferenceSection}>
            <Text style={styles.preferenceTitle}>Remembering Questions</Text>
            <Text style={styles.preferenceDescription}>
              Control how often "Remembering" questions appear in your daily prompts.
            </Text>
            <View style={styles.preferenceButtons}>
              <TouchableOpacity
                style={[
                  styles.preferenceButton,
                  getPreferenceForRemembering() === "more" && styles.preferenceButtonActive,
                  savingPreference && styles.preferenceButtonDisabled,
                ]}
                onPress={() => handlePreferenceChange("more")}
                disabled={!!savingPreference}
              >
                <Text
                  style={[
                    styles.preferenceButtonText,
                    getPreferenceForRemembering() === "more" && styles.preferenceButtonTextActive,
                  ]}
                >
                  More
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.preferenceButton,
                  getPreferenceForRemembering() === "less" && styles.preferenceButtonActive,
                  savingPreference && styles.preferenceButtonDisabled,
                ]}
                onPress={() => handlePreferenceChange("less")}
                disabled={!!savingPreference}
              >
                <Text
                  style={[
                    styles.preferenceButtonText,
                    getPreferenceForRemembering() === "less" && styles.preferenceButtonTextActive,
                  ]}
                >
                  Less
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.preferenceButton,
                  getPreferenceForRemembering() === "none" && styles.preferenceButtonActive,
                  savingPreference && styles.preferenceButtonDisabled,
                ]}
                onPress={() => handlePreferenceChange("none")}
                disabled={!!savingPreference}
              >
                <Text
                  style={[
                    styles.preferenceButtonText,
                    getPreferenceForRemembering() === "none" && styles.preferenceButtonTextActive,
                  ]}
                >
                  None
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isLoading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : memorials.length === 0 ? (
          <View style={styles.emptyState}>
            <Image 
              source={require("../../../assets/images/memorial.png")} 
              style={{ width: 48, height: 48 }}
              resizeMode="contain"
            />
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
                  activeOpacity={0.7}
                >
                  <Avatar uri={memorial.photo_url} name={memorial.name} size={48} borderColor={theme2Colors.text} />
                </TouchableOpacity>
                <View style={styles.memorialInfo}>
                  <Text style={styles.memorialName}>{memorial.name}</Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteMemorial(memorial.id, memorial.name)}
                  activeOpacity={0.7}
                >
                  <FontAwesome name="trash" size={18} color={theme2Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.addButtonText}>Add someone else</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Add Memorial Modal */}
      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalBackdrop}>
          {/* Warm fuzzy blur effect matching settings modal */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: theme2Colors.beige, opacity: 0.3 }]} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(232, 224, 213, 0.4)" }]} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0, 0, 0, 0.1)" }]} />
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowAddModal(false)}
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Someone</Text>
            <Text style={styles.modalSubtitle}>Enter the name of the person you're remembering</Text>
            
            <TextInput
              value={newMemorialName}
              onChangeText={setNewMemorialName}
              placeholder="Name"
              placeholderTextColor={theme2Colors.textSecondary}
              style={styles.input}
              onFocus={() => setFocusedInput(true)}
              onBlur={() => setFocusedInput(false)}
              autoCapitalize="words"
              autoFocus
            />

            <View style={styles.photoSection}>
              <Text style={styles.photoLabel}>Add a photo (optional)</Text>
              <TouchableOpacity onPress={pickImage} style={styles.photoButton} disabled={uploadingPhoto} activeOpacity={0.7}>
                <Text style={styles.photoButtonText}>
                  {newMemorialPhotoUri ? "Change Photo" : "Add Photo"}
                </Text>
              </TouchableOpacity>
              {newMemorialPhotoUri && (
                <View style={styles.photoPreviewContainer}>
                  <Avatar uri={newMemorialPhotoUri} name={newMemorialName || "Memorial"} size={80} borderColor={theme2Colors.text} />
                </View>
              )}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={() => {
                  setShowAddModal(false)
                  setNewMemorialName("")
                  setNewMemorialPhotoUri(undefined)
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonPrimary}
                onPress={handleAddMemorial}
                disabled={saving || uploadingPhoto}
                activeOpacity={0.7}
              >
                {saving || uploadingPhoto ? (
                  <ActivityIndicator color={theme2Colors.white} />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

