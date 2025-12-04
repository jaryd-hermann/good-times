"use client"

import { useEffect, useState } from "react"
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
}

export function NotificationModal({
  visible,
  notifications,
  onClose,
  onNotificationPress,
}: NotificationModalProps) {
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const slideAnim = useState(new Animated.Value(height))[0]
  const overlayOpacity = useState(new Animated.Value(0))[0]

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

  const styles = StyleSheet.create({
    modalContainer: {
      flex: 1,
      justifyContent: "flex-end",
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0, 0, 0, 0.75)",
    },
    content: {
      backgroundColor: colors.black,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: spacing.lg,
      paddingBottom: insets.bottom + spacing.lg,
      paddingHorizontal: spacing.lg,
      maxHeight: height * 0.7,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.md,
    },
    title: {
      ...typography.h2,
      fontSize: 24,
      color: colors.white,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.gray[800],
      justifyContent: "center",
      alignItems: "center",
    },
    notificationList: {
      gap: spacing.sm,
    },
    notificationItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.gray[800],
    },
    notificationContent: {
      flex: 1,
      marginLeft: spacing.sm,
    },
    notificationText: {
      ...typography.body,
      fontSize: 16,
      color: colors.white,
      textDecorationLine: "underline",
    },
    notificationArrow: {
      marginLeft: spacing.sm,
      color: colors.white,
    },
  })

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={closeModal}>
      <View style={styles.modalContainer}>
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
              maxHeight: notifications.length === 0 ? height * 0.3 : height * 0.7,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.header}>
            <Text style={styles.title}>
              {notifications.length === 0 ? "Nothing new for you" : "New for you"}
            </Text>
            <TouchableOpacity onPress={closeModal} style={styles.closeButton} activeOpacity={0.7}>
              <FontAwesome name="times" size={16} color={colors.white} />
            </TouchableOpacity>
          </View>
          {notifications.length > 0 && (
            <ScrollView style={styles.notificationList} showsVerticalScrollIndicator={false}>
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
                    {(notification.type === "reply_to_entry" || notification.type === "reply_to_thread" || notification.type === "deck_vote_requested") && (
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

