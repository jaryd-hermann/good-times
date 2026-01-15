"use client"

import { useState, useEffect, useRef } from "react"
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, InteractionManager } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Avatar } from "./Avatar"
import { typography, spacing } from "../lib/theme"
import { useTheme } from "../lib/theme-context"
import { FontAwesome } from "@expo/vector-icons"
import { getTodayDate } from "../lib/utils"
import { usePostHog } from "posthog-react-native"
import { safeCapture } from "../lib/posthog"

interface StatusModalProps {
  visible: boolean
  userId: string
  userName: string
  userAvatarUrl?: string
  groupId: string
  date: string // Date in yyyy-MM-dd format
  existingStatus?: string | null
  onClose: () => void
  onPost: (statusText: string) => Promise<void>
}

export function StatusModal({
  visible,
  userId,
  userName,
  userAvatarUrl,
  groupId,
  date,
  existingStatus,
  onClose,
  onPost,
}: StatusModalProps) {
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const [statusText, setStatusText] = useState("")
  const [isPosting, setIsPosting] = useState(false)
  const inputRef = useRef<TextInput>(null)
  const posthog = usePostHog()

  // Theme 2 color palette - dynamic based on dark/light mode
  const theme2Colors = {
    red: "#B94444",
    yellow: "#E8A037",
    green: "#2D6F4A",
    blue: "#3A5F8C",
    beige: isDark ? "#000000" : "#E8E0D5", // Black in dark mode, beige in light mode
    cream: isDark ? "#000000" : "#F5F0EA", // Black in dark mode
    white: isDark ? "#E8E0D5" : "#FFFFFF", // Beige in dark mode, white in light mode
    text: isDark ? "#F5F0EA" : "#000000", // Cream in dark mode, black in light mode
    textSecondary: isDark ? "#A0A0A0" : "#404040", // Light gray in dark mode
    onboardingPink: "#D97393", // Pink for onboarding CTAs (same in both modes)
  }

  // Check if this is today's date (can only edit today's status)
  const isToday = date === getTodayDate()
  const canEdit = isToday

  // Initialize with existing status or empty
  useEffect(() => {
    if (visible && canEdit) {
      setStatusText(existingStatus || "")
      // Focus input after modal animation and interactions complete
      InteractionManager.runAfterInteractions(() => {
        setTimeout(() => {
          inputRef.current?.focus()
        }, 100)
      })
    } else {
      setStatusText("")
    }
  }, [visible, existingStatus, canEdit])

  // Count words (split by spaces, filter empty strings)
  const wordCount = statusText.trim().split(/\s+/).filter((word) => word.length > 0).length
  const maxWords = 20
  const isAtMaxWords = wordCount >= maxWords

  const handlePost = async () => {
    const trimmedText = statusText.trim()
    if (!trimmedText || isPosting || !canEdit) return

    setIsPosting(true)
    try {
      await onPost(trimmedText)
      
      // Track PostHog event
      const wordCount = trimmedText.split(/\s+/).filter((word) => word.length > 0).length
      safeCapture(posthog, "posted_status", {
        group_id: groupId,
        date: date,
        word_count: wordCount,
        is_update: !!existingStatus,
      })
      
      onClose()
    } catch (error) {
      console.error("[StatusModal] Error posting status:", error)
      // You might want to show an error message to the user here
    } finally {
      setIsPosting(false)
    }
  }

  const handleClose = () => {
    if (!isPosting) {
      setStatusText("")
      onClose()
    }
  }

  const styles = StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: isDark ? "rgba(0, 0, 0, 0.8)" : "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end",
    },
    container: {
      backgroundColor: theme2Colors.beige,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      paddingTop: spacing.xl,
      paddingBottom: insets.bottom + spacing.xl,
      paddingHorizontal: spacing.lg,
      minHeight: 400,
    },
    closeButton: {
      position: "absolute",
      top: spacing.md,
      right: spacing.md,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? theme2Colors.beige : theme2Colors.white, // Match UserProfileModal style
      justifyContent: "center",
      alignItems: "center",
      zIndex: 10,
      borderWidth: 1,
      borderColor: theme2Colors.text,
    },
    avatarContainer: {
      alignItems: "center",
      marginBottom: spacing.xl,
    },
    avatar: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: theme2Colors.beige,
      overflow: "hidden",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 0, // Remove outline
    },
    speechBubble: {
      backgroundColor: isDark ? "#505050" : "#D0D0D0", // Lighter gray in light mode, keep dark mode same
      borderRadius: 24,
      paddingVertical: spacing.md, // Equal vertical padding
      paddingHorizontal: spacing.md,
      marginBottom: spacing.lg,
      minHeight: 60, // Smaller, 2 rows max
      maxHeight: 60, // Limit to 2 rows
      borderWidth: 2,
      borderColor: theme2Colors.text,
      position: "relative",
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      elevation: 3, // Android shadow
    },
    speechBubbleTail: {
      position: "absolute",
      bottom: -12,
      left: 40,
      width: 0,
      height: 0,
      borderLeftWidth: 12,
      borderRightWidth: 12,
      borderTopWidth: 12,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
      borderTopColor: isDark ? "#505050" : "#D0D0D0", // Match bubble background
    },
    speechBubbleTailBorder: {
      position: "absolute",
      bottom: -14,
      left: 40,
      width: 0,
      height: 0,
      borderLeftWidth: 13,
      borderRightWidth: 13,
      borderTopWidth: 13,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
      borderTopColor: theme2Colors.text,
      zIndex: -1,
    },
    input: {
      ...typography.body,
      fontSize: 16,
      color: theme2Colors.text,
      minHeight: 40,
      maxHeight: 40, // 2 rows max
      textAlignVertical: "top",
      paddingVertical: 0, // Remove default padding to ensure equal spacing
      paddingTop: 0,
      paddingBottom: 0,
    },
    placeholder: {
      ...typography.body,
      fontSize: 16,
      color: theme2Colors.textSecondary,
      position: "absolute",
      top: spacing.lg,
      left: spacing.lg,
    },
    wordCount: {
      ...typography.body,
      fontSize: 12,
      color: isAtMaxWords ? theme2Colors.red : theme2Colors.textSecondary,
      textAlign: "right",
      marginTop: spacing.xs,
    },
    shareButton: {
      backgroundColor: theme2Colors.onboardingPink,
      borderRadius: 25,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      alignItems: "center",
      borderWidth: 2,
      borderColor: theme2Colors.textSecondary,
      opacity: (!statusText.trim() || isPosting) ? 0.5 : 1,
    },
    shareButtonText: {
      ...typography.body,
      fontSize: 16,
      fontWeight: "600",
      color: theme2Colors.white,
    },
  })

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View style={styles.container}>
          {/* Close Button - positioned at top right */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <FontAwesome name="times" size={16} color={theme2Colors.text} />
          </TouchableOpacity>

          {/* Avatar */}
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Avatar
                uri={userAvatarUrl}
                name={userName}
                size={114}
              />
            </View>
          </View>

          {/* Speech Bubble Input */}
          <View style={styles.speechBubble}>
            {canEdit ? (
              <>
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  value={statusText}
                  onChangeText={(text) => {
                    // Prevent typing if at max words
                    const words = text.trim().split(/\s+/).filter((word) => word.length > 0)
                    if (words.length <= maxWords || text.length < statusText.length) {
                      setStatusText(text)
                    }
                  }}
                  placeholder="Today, I am..."
                  placeholderTextColor={theme2Colors.textSecondary}
                  multiline
                  maxLength={200} // Rough max for 20 words
                  editable={!isPosting}
                />
                {/* Word Count */}
                <Text style={styles.wordCount}>
                  {wordCount}/{maxWords} words
                </Text>
              </>
            ) : (
              <Text style={styles.input}>
                {existingStatus || "No status for this day"}
              </Text>
            )}
            {/* Speech bubble tail */}
            <View style={styles.speechBubbleTailBorder} />
            <View style={styles.speechBubbleTail} />
          </View>

          {/* Share Button - only show if can edit */}
          {canEdit && (
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handlePost}
              disabled={!statusText.trim() || isPosting}
              activeOpacity={0.8}
            >
              <Text style={styles.shareButtonText}>
                {isPosting ? "Sharing..." : "Share"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
