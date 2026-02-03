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
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { typography, spacing } from "../lib/theme"
import { useTheme } from "../lib/theme-context"
import { FontAwesome } from "@expo/vector-icons"
import { Avatar } from "./Avatar"

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window")

interface MediaCaptionsProps {
  visible: boolean
  photos: Array<{ uri: string; id: string }> // Array of photo URIs with IDs
  initialIndex: number
  initialCaptions?: (string | null)[] // Array of captions parallel to photos
  userName: string
  userAvatar?: string
  onClose: () => void
  onSave: (captions: (string | null)[]) => void // Callback with updated captions array
  onComplete?: () => void // Called when user finishes (after last image)
}

export function MediaCaptions({
  visible,
  photos,
  initialIndex,
  initialCaptions = [],
  userName,
  userAvatar,
  onClose,
  onSave,
  onComplete,
}: MediaCaptionsProps) {
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [captions, setCaptions] = useState<(string | null)[]>(initialCaptions || [])
  const [editingCaptionIndex, setEditingCaptionIndex] = useState<number | null>(null)
  const [editingText, setEditingText] = useState("")
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const scrollViewRef = useRef<ScrollView>(null)
  const captionInputRef = useRef<TextInput>(null)
  const wasVisibleRef = useRef(false)

  // Theme 2 colors
  const theme2Colors = {
    red: "#B94444",
    yellow: "#E8A037",
    green: "#2D6F4A",
    blue: "#3A5F8C",
    beige: isDark ? "#000000" : "#E8E0D5",
    cream: isDark ? "#000000" : "#F5F0EA",
    white: isDark ? "#E8E0D5" : "#FFFFFF",
    text: isDark ? "#F5F0EA" : "#000000",
    textSecondary: isDark ? "#A0A0A0" : "#404040",
  }

  // Reset to initial index when modal opens (only when visible changes from false to true)
  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      // Modal just opened - reset everything
      setCurrentIndex(initialIndex)
      setCaptions(initialCaptions || [])
      setEditingCaptionIndex(null)
      setEditingText("")
      // Scroll to initial photo after a brief delay
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          x: initialIndex * SCREEN_WIDTH,
          animated: false,
        })
      }, 100)
      wasVisibleRef.current = true
    } else if (!visible) {
      // Modal closed - reset the ref
      wasVisibleRef.current = false
    }
    // Note: We don't update captions when initialCaptions changes while modal is open
    // because we're managing captions state internally and syncing via onSave callback
  }, [visible, initialIndex])
  
  // Sync captions when modal opens, but don't reset index
  useEffect(() => {
    if (visible && wasVisibleRef.current) {
      // Modal is already open - sync captions but preserve current index
      setCaptions(initialCaptions || [])
    }
  }, [initialCaptions, visible])

  // Listen to keyboard events
  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", (e) => {
      setKeyboardHeight(e.endCoordinates.height)
    })
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardHeight(0)
    })

    return () => {
      showSubscription.remove()
      hideSubscription.remove()
    }
  }, [])

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x
    const index = Math.round(offsetX / SCREEN_WIDTH)
    if (index !== currentIndex) {
      setCurrentIndex(index)
      setEditingCaptionIndex(null) // Close editing when navigating
      setEditingText("")
    }
  }

  const handleImagePress = (event: any) => {
    const { locationX } = event.nativeEvent
    const imageWidth = SCREEN_WIDTH
    const leftHalf = imageWidth / 2

    if (locationX < leftHalf) {
      // Tapped left side - go to previous
      handlePrevious()
    } else {
      // Tapped right side - go to next
      handleNext()
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1
      setCurrentIndex(newIndex)
      scrollViewRef.current?.scrollTo({
        x: newIndex * SCREEN_WIDTH,
        animated: true,
      })
      setEditingCaptionIndex(null)
      setEditingText("")
    }
  }

  const handleNext = (updatedCaptions?: (string | null)[]) => {
    // If currently editing and no updatedCaptions provided, save the caption first
    // Note: updatedCaptions being provided means we already saved (from handleSaveCaption)
    if (isEditing && !updatedCaptions) {
      // Save current caption before proceeding
      const newCaptions = [...captions]
      while (newCaptions.length < photos.length) {
        newCaptions.push(null)
      }
      newCaptions[currentIndex] = editingText.trim() || null
      setCaptions(newCaptions)
      setEditingCaptionIndex(null)
      setEditingText("")
      
      // Save to parent
      onSave(newCaptions)
      
      // Use updated captions for next step
      updatedCaptions = newCaptions
    }
    
    if (currentIndex < photos.length - 1) {
      // Move to next image
      const newIndex = currentIndex + 1
      setCurrentIndex(newIndex)
      scrollViewRef.current?.scrollTo({
        x: newIndex * SCREEN_WIDTH,
        animated: true,
      })
    } else {
      // Last image - save and complete
      // Use updatedCaptions if provided, otherwise use current state
      const captionsToSave = updatedCaptions || captions
      // Ensure we save the latest captions before completing
      if (captionsToSave !== captions) {
        setCaptions(captionsToSave)
      }
      handleSaveAndComplete(captionsToSave)
    }
  }

  const handleAddCaption = () => {
    setEditingCaptionIndex(currentIndex)
    setEditingText(captions[currentIndex] || "")
    // Focus input after a brief delay
    setTimeout(() => {
      captionInputRef.current?.focus()
    }, 300)
  }

  const handleEditCaption = () => {
    setEditingCaptionIndex(currentIndex)
    setEditingText(captions[currentIndex] || "")
    // Focus input after a brief delay
    setTimeout(() => {
      captionInputRef.current?.focus()
    }, 300)
  }

  const handleSaveCaption = () => {
    const newCaptions = [...captions]
    // Ensure array is long enough
    while (newCaptions.length < photos.length) {
      newCaptions.push(null)
    }
    newCaptions[currentIndex] = editingText.trim() || null
    
    // Update state first
    setCaptions(newCaptions)
    setEditingCaptionIndex(null)
    setEditingText("")
    
    // Save immediately to parent component
    onSave(newCaptions)
    
    // Auto-advance to next image after state updates
    // Use setTimeout to ensure state has updated before calling handleNext
    setTimeout(() => {
      handleNext(newCaptions)
    }, 0)
  }

  const handleCancelEdit = () => {
    setEditingCaptionIndex(null)
    setEditingText("")
  }

  const handleSaveAndComplete = (updatedCaptions?: (string | null)[]) => {
    // Save captions before completing - use updatedCaptions if provided, otherwise use current state
    const captionsToSave = updatedCaptions || captions
    
    // Ensure captions state is updated
    if (captionsToSave !== captions) {
      setCaptions(captionsToSave)
    }
    
    // Save to parent, then complete
    // Only call onSave if captions have actually changed to avoid unnecessary updates
    onSave(captionsToSave)
    
    // Complete - this will close the modal
    if (onComplete) {
      onComplete()
    } else {
      onClose()
    }
  }

  const handleClose = () => {
    // Save captions before closing
    onSave(captions)
    onClose()
  }

  const currentCaption = captions[currentIndex] || null
  const isEditing = editingCaptionIndex === currentIndex
  const isLastImage = currentIndex === photos.length - 1

  const styles = StyleSheet.create({
    modal: {
      flex: 1,
      backgroundColor: theme2Colors.beige,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      paddingTop: insets.top + spacing.md,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme2Colors.textSecondary,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    headerRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    counter: {
      ...typography.body,
      fontSize: 14,
      color: theme2Colors.text,
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme2Colors.cream,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
    },
    scrollView: {
      flex: 1,
    },
    photoContainer: {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT - 200, // Reserve space for header and footer
      justifyContent: "center",
      alignItems: "center",
    },
    photo: {
      width: SCREEN_WIDTH,
      height: "100%",
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
      backgroundColor: theme2Colors.beige,
      borderTopWidth: 1,
      borderTopColor: theme2Colors.textSecondary,
    },
    imageOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      zIndex: 1,
    },
    captionContainer: {
      marginBottom: spacing.md,
      minHeight: 60,
    },
    captionText: {
      ...typography.body,
      fontSize: 14,
      color: theme2Colors.text,
      lineHeight: 20,
    },
    captionInput: {
      ...typography.body,
      fontSize: 14,
      color: theme2Colors.text,
      backgroundColor: theme2Colors.cream,
      borderRadius: 8,
      padding: spacing.sm,
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
      minHeight: 60,
      textAlignVertical: "top",
    },
    footerActions: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: spacing.md,
    },
    addCaptionButton: {
      flex: 1,
      backgroundColor: theme2Colors.cream,
      borderRadius: 8,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
      alignItems: "center",
    },
    addCaptionButtonText: {
      ...typography.body,
      fontSize: 14,
      color: theme2Colors.text,
    },
    nextButton: {
      backgroundColor: theme2Colors.blue,
      borderRadius: 8,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      minWidth: 80,
      alignItems: "center",
    },
    nextButtonText: {
      ...typography.bodyBold,
      fontSize: 14,
      color: isDark ? "#FFFFFF" : "#000000",
    },
    saveButton: {
      backgroundColor: theme2Colors.blue,
      borderRadius: 8,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      alignItems: "center",
    },
    saveButtonText: {
      ...typography.bodyBold,
      fontSize: 14,
      color: theme2Colors.white,
    },
    cancelButton: {
      backgroundColor: theme2Colors.cream,
      borderRadius: 8,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
    },
    cancelButtonText: {
      ...typography.body,
      fontSize: 14,
      color: theme2Colors.text,
    },
    editActions: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
  })

  if (!visible || photos.length === 0) return null

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.modal}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Avatar uri={userAvatar} name={userName} size={32} />
            <Text style={[typography.bodyBold, { fontSize: 14, color: theme2Colors.text }]}>
              {userName}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.counter}>
              {String(currentIndex + 1)} of {String(photos.length)}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <FontAwesome name="times" size={18} color={theme2Colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Image Carousel */}
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
            <TouchableOpacity
              key={photo.id}
              style={styles.photoContainer}
              activeOpacity={1}
              onPress={handleImagePress}
              disabled={isEditing} // Disable image navigation when editing
            >
              <Image source={{ uri: photo.uri }} style={styles.photo} resizeMode="contain" />
              {/* Overlay when editing */}
              {isEditing && (
                <View style={styles.imageOverlay} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Footer */}
        <View style={[
          styles.footer, 
          { 
            bottom: keyboardHeight > 0 ? keyboardHeight : 0,
            paddingBottom: keyboardHeight > 0 ? spacing.md : insets.bottom + spacing.md,
          }
        ]}>
          {/* Caption Display/Edit */}
          {isEditing ? (
            <View>
              <TextInput
                ref={captionInputRef}
                style={styles.captionInput}
                value={editingText}
                onChangeText={setEditingText}
                placeholder="Add a caption..."
                placeholderTextColor={theme2Colors.textSecondary}
                multiline
                autoFocus
              />
              <View style={styles.editActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={handleCancelEdit}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleSaveCaption}>
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              {currentCaption ? (
                <TouchableOpacity
                  style={styles.captionContainer}
                  onPress={handleEditCaption}
                  activeOpacity={0.7}
                >
                  <Text style={styles.captionText}>{currentCaption}</Text>
                </TouchableOpacity>
              ) : null}
              <View style={styles.footerActions}>
                <TouchableOpacity style={styles.addCaptionButton} onPress={handleAddCaption}>
                  <Text style={styles.addCaptionButtonText}>
                    {currentCaption ? "Edit caption" : "Add a caption"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.nextButton}
                  onPress={() => handleNext()}
                >
                  <Text style={styles.nextButtonText}>
                    {isLastImage ? "Done" : "Next"}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
