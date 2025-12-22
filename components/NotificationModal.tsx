"use client"

import { useEffect, useState, useMemo } from "react"
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Dimensions, ScrollView } from "react-native"
import { useTheme } from "../lib/theme-context"
import { typography, spacing } from "../lib/theme"
import { Avatar } from "./Avatar"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { FontAwesome } from "@expo/vector-icons"
import type { InAppNotification } from "../lib/notifications-in-app"

const { height } = Dimensions.get("window")

interface NotificationModalProps {
  visible: boolean
  notifications: InAppNotification[]
  onClose: () => void
  onNotificationPress: (notification: InAppNotification) => void
  onClearAll?: () => void
}

export function NotificationModal({
  visible,
  notifications,
  onClose,
  onNotificationPress,
  onClearAll,
}: NotificationModalProps) {
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const slideAnim = useState(new Animated.Value(height))[0]
  const overlayOpacity = useState(new Animated.Value(0))[0]
  
  // Theme 2 color palette - dynamic based on dark/light mode
  const theme2Colors = useMemo(() => {
    if (isDark) {
      // Dark mode colors
      return {
        red: "#B94444",
        yellow: "#E8A037",
        green: "#2D6F4A",
        blue: "#3A5F8C",
        beige: "#000000", // Black (was beige) - page background
        cream: "#000000", // Black (was cream) - for card backgrounds
        white: "#E8E0D5", // Beige (was white)
        text: "#F5F0EA", // Cream (was black) - text color
        textSecondary: "#A0A0A0", // Light gray (was dark gray)
      }
    } else {
      // Light mode colors (current/default)
      return {
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
    }
  }, [isDark])

  useEffect(() => {
    if (visible) {
      // Reset animations to initial state before showing modal
      slideAnim.setValue(height)
      overlayOpacity.setValue(0)
      // Animate immediately without requestAnimationFrame delay
      // Animate overlay and content together
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 200, // Faster overlay fade
          useNativeDriver: true,
        }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300, // Smooth slide-up animation
            useNativeDriver: true,
          }),
      ]).start()
    }
  }, [visible])

  function closeModal() {
    // Animate out
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Hide modal after animation completes
      onClose()
    })
  }

  const styles = useMemo(() => StyleSheet.create({
    modalContainer: {
      flex: 1,
      justifyContent: "flex-end",
      alignItems: "stretch", // Full width
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "transparent", // Use transparent base, opacity handled by overlays
    },
    overlayBeige: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDark ? "rgba(0, 0, 0, 0.4)" : "rgba(232, 224, 213, 0.4)", // Dark overlay in dark mode, beige in light mode
    },
    overlayBlack: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDark ? "rgba(0, 0, 0, 0.3)" : "rgba(0, 0, 0, 0.1)", // Darker overlay in dark mode
    },
    content: {
      backgroundColor: theme2Colors.beige, // Beige background matching new theme
      borderTopLeftRadius: 32, // Rounded corners on top only
      borderTopRightRadius: 32,
      borderBottomLeftRadius: 0, // No rounding on bottom
      borderBottomRightRadius: 0,
      paddingTop: spacing.lg,
      paddingBottom: 0, // Remove padding bottom, let ScrollView handle it
      paddingHorizontal: spacing.lg,
      maxHeight: height * 0.5, // Max half screen height
      width: "100%",
      flex: 1, // Allow content to expand
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: -10, // Shadow above (for bottom sheet)
      },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 20,
      position: "relative",
      overflow: "visible", // Allow close button to overflow
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.md,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      gap: spacing.md,
    },
    title: {
      ...typography.h2,
      fontSize: 24,
      color: theme2Colors.text, // Black text matching new theme
      fontFamily: "PMGothicLudington-Text115", // Match question font
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? "#000000" : theme2Colors.white, // Black background in dark mode, white in light mode
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: isDark ? "#F5F0EA" : theme2Colors.text, // Cream outline in dark mode, black outline in light mode
    },
    notificationList: {
      gap: spacing.sm,
      paddingBottom: insets.bottom + spacing.lg, // Add padding at bottom for safe area
      flexGrow: 1, // Allow ScrollView to grow
    },
    notificationItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      backgroundColor: isDark ? "#111111" : theme2Colors.white, // Dark gray in dark mode, white in light mode
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme2Colors.text,
      marginBottom: spacing.sm,
    },
    notificationContent: {
      flex: 1,
      marginLeft: spacing.sm,
    },
    notificationText: {
      ...typography.body,
      fontSize: 16,
      color: theme2Colors.text, // Black text matching new theme
    },
    notificationArrow: {
      marginLeft: spacing.sm,
      color: theme2Colors.text, // Black arrow matching new theme
    },
    clearAllText: {
      ...typography.body,
      fontSize: 14,
      color: theme2Colors.textSecondary, // Gray text matching new theme
      textDecorationLine: "underline",
    },
  }), [isDark, theme2Colors, insets.bottom])

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={closeModal}>
      <View style={styles.modalContainer}>
        {/* Backdrop overlays matching Profile Modal opacity */}
        <Animated.View style={[styles.overlayBeige, { opacity: overlayOpacity }]} />
        <Animated.View style={[styles.overlayBlack, { opacity: overlayOpacity }]} />
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeModal}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.content,
            {
              transform: [{ translateY: slideAnim }],
              maxHeight: notifications.length === 0 ? height * 0.3 : height * 0.5,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.title}>
                {notifications.length === 0 ? "Nothing new for you" : "New for you"}
              </Text>
              {notifications.length > 0 && onClearAll && (
                <TouchableOpacity 
                  onPress={() => {
                    console.log("[NotificationModal] Clear all pressed")
                    onClearAll()
                  }} 
                  activeOpacity={0.7}
                >
                  <Text style={styles.clearAllText}>Clear all</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={closeModal} style={styles.closeButton} activeOpacity={0.7}>
              <FontAwesome name="times" size={16} color={theme2Colors.text} />
            </TouchableOpacity>
          </View>
          {notifications.length > 0 && (
            <ScrollView 
              style={styles.notificationList} 
              contentContainerStyle={styles.notificationList}
              showsVerticalScrollIndicator={false}
            >
              {notifications.map((notification) => {
                let notificationText = ""
                let avatarUrl: string | undefined
                let avatarName = ""

                if (notification.type === "new_question") {
                  notificationText = `New question in ${notification.groupName}`
                } else if (notification.type === "reply_to_entry") {
                  notificationText = `${notification.commenterName} replied to your answer`
                  avatarUrl = notification.commenterAvatarUrl
                  avatarName = notification.commenterName || "Someone"
                } else if (notification.type === "reply_to_thread") {
                  notificationText = `${notification.commenterName} replied to ${notification.entryAuthorName}'s answer`
                  avatarUrl = notification.commenterAvatarUrl
                  avatarName = notification.commenterName || "Someone"
                } else if (notification.type === "new_answers") {
                  // Format names: "Jaryd, Rose, and Emily answered in Arambrook"
                  const names = notification.answererNames || []
                  const namesText = names.length === 1
                    ? names[0]
                    : names.length === 2
                    ? `${names[0]} and ${names[1]}`
                    : `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`
                  notificationText = `${namesText} answered in ${notification.groupName}`
                } else if (notification.type === "deck_vote_requested") {
                  notificationText = `${notification.requesterName} wants to add "${notification.deckName}" to ${notification.groupName}`
                  avatarName = notification.requesterName || "Someone"
                } else if (notification.type === "mentioned_in_entry") {
                  notificationText = `${notification.authorName} mentioned you in their answer today`
                  avatarUrl = notification.authorAvatarUrl
                  avatarName = notification.authorName || "Someone"
                } else if (notification.type === "birthday_card") {
                  notificationText = `It's ${notification.birthdayPersonName}'s birthday, add to their card`
                  avatarName = notification.birthdayPersonName || "Someone"
                } else if (notification.type === "custom_question_opportunity") {
                  notificationText = `You have the power to ask a question today`
                }

                return (
                  <TouchableOpacity
                    key={notification.id}
                    style={styles.notificationItem}
                    onPress={() => {
                      closeModal()
                      // Small delay to ensure modal closes before navigation
                      setTimeout(() => {
                        onNotificationPress(notification)
                      }, 100)
                    }}
                    activeOpacity={0.7}
                  >
                    {(notification.type === "reply_to_entry" || notification.type === "reply_to_thread" || notification.type === "deck_vote_requested" || notification.type === "mentioned_in_entry" || notification.type === "birthday_card") && (
                      <Avatar uri={avatarUrl} name={avatarName} size={32} />
                    )}
                    <View style={styles.notificationContent}>
                      <Text style={styles.notificationText}>{notificationText}</Text>
                    </View>
                    <Text style={styles.notificationArrow}>→</Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  )
}

