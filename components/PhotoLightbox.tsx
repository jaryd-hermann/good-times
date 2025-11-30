"use client"

import { useState, useRef, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Alert,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import * as FileSystem from "expo-file-system/legacy"
import * as MediaLibrary from "expo-media-library"
import { typography, spacing } from "../lib/theme"
import { useTheme } from "../lib/theme-context"
import { FontAwesome } from "@expo/vector-icons"
import { Button } from "./Button"

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window")

interface PhotoLightboxProps {
  visible: boolean
  photos: string[]
  initialIndex: number
  onClose: () => void
}

export function PhotoLightbox({ visible, photos, initialIndex, onClose }: PhotoLightboxProps) {
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [saving, setSaving] = useState(false)
  const scrollViewRef = useRef<ScrollView>(null)

  // Reset to initial index when modal opens
  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex)
      // Scroll to initial photo after a brief delay
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          x: initialIndex * SCREEN_WIDTH,
          animated: false,
        })
      }, 100)
    }
  }, [visible, initialIndex])

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x
    const index = Math.round(offsetX / SCREEN_WIDTH)
    setCurrentIndex(index)
  }

  async function handleSave() {
    if (currentIndex < 0 || currentIndex >= photos.length) return

    const photoUrl = photos[currentIndex]
    setSaving(true)

    try {
      // Request media library permissions
      const { status } = await MediaLibrary.requestPermissionsAsync()
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "We need access to your photo library to save images."
        )
        return
      }

      // Download the image
      const fileUri = `${FileSystem.cacheDirectory}photo_${Date.now()}.jpg`
      const downloadResult = await FileSystem.downloadAsync(photoUrl, fileUri)

      if (!downloadResult.uri) {
        throw new Error("Failed to download image")
      }

      // Save to media library
      const asset = await MediaLibrary.createAssetAsync(downloadResult.uri)
      
      // Clean up temp file
      await FileSystem.deleteAsync(fileUri, { idempotent: true })

      Alert.alert("Saved", "Photo saved to your library!")
    } catch (error: any) {
      console.error("[PhotoLightbox] Error saving photo:", error)
      Alert.alert("Error", error.message || "Failed to save photo")
    } finally {
      setSaving(false)
    }
  }

  const styles = StyleSheet.create({
    modal: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.95)",
    },
    closeButton: {
      position: "absolute",
      top: insets.top + spacing.md,
      right: spacing.md,
      zIndex: 10,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    scrollView: {
      flex: 1,
    },
    photoContainer: {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      justifyContent: "center",
      alignItems: "center",
    },
    photo: {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      resizeMode: "contain",
    },
    footer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingBottom: insets.bottom + spacing.md,
      paddingTop: spacing.md,
      paddingHorizontal: spacing.lg,
      backgroundColor: "rgba(0, 0, 0, 0.7)",
    },
    counter: {
      ...typography.body,
      color: "#ffffff", // Always white for lightbox overlay
      textAlign: "center",
      marginBottom: spacing.md,
    },
    saveButton: {
      width: "100%",
    },
  })

  if (!visible || photos.length === 0) return null

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modal}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <FontAwesome name="times" size={20} color="#ffffff" />
        </TouchableOpacity>

        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={styles.scrollView}
        >
          {photos.map((photo, index) => (
            <View key={index} style={styles.photoContainer}>
              <Image source={{ uri: photo }} style={styles.photo} resizeMode="contain" />
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <Text style={styles.counter}>
            {currentIndex + 1} of {photos.length}
          </Text>
          <Button
            title={saving ? "Saving..." : "Save"}
            onPress={handleSave}
            disabled={saving}
            loading={saving}
            variant="ghost"
            style={[styles.saveButton, { borderColor: "#ffffff" }]}
            textStyle={{ color: "#ffffff" }}
          />
        </View>
      </View>
    </Modal>
  )
}

