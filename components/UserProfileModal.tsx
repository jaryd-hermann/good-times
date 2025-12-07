"use client"

import { useEffect, useState, useRef } from "react"
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Dimensions, Image } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Avatar } from "./Avatar"
import { Button } from "./Button"
import { typography, spacing } from "../lib/theme"
import { useTheme } from "../lib/theme-context"
import { supabase } from "../lib/supabase"

const { width: SCREEN_WIDTH } = Dimensions.get("window")

interface UserProfileModalProps {
  visible: boolean
  userId: string | null
  userName: string | null
  userAvatarUrl: string | undefined
  groupId: string | undefined
  onClose: () => void
  onViewHistory: (userId: string) => void
}

export function UserProfileModal({
  visible,
  userId,
  userName,
  userAvatarUrl,
  groupId,
  onClose,
  onViewHistory,
}: UserProfileModalProps) {
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const [entryCount, setEntryCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const slideAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      // Slide up animation
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start()
      
      // Fetch entry count
      if (userId && groupId) {
        fetchEntryCount()
      }
    } else {
      // Reset animation
      slideAnim.setValue(0)
      setEntryCount(null)
    }
  }, [visible, userId, groupId])

  async function fetchEntryCount() {
    if (!userId || !groupId) return
    
    setLoading(true)
    try {
      const { count, error } = await supabase
        .from("entries")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("group_id", groupId)
      
      if (error) {
        console.error("[UserProfileModal] Error fetching entry count:", error)
        setEntryCount(0)
      } else {
        setEntryCount(count || 0)
      }
    } catch (error) {
      console.error("[UserProfileModal] Error fetching entry count:", error)
      setEntryCount(0)
    } finally {
      setLoading(false)
    }
  }

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  })

  const handleViewHistory = () => {
    if (userId) {
      onViewHistory(userId)
      onClose()
    }
  }

  if (!userId || !userName) return null

  const styles = StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end",
    },
    container: {
      backgroundColor: colors.gray[900],
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: spacing.xl,
      paddingBottom: insets.bottom + spacing.lg,
      paddingHorizontal: spacing.lg,
      alignItems: "center",
      minHeight: 300,
    },
    avatarContainer: {
      marginBottom: spacing.lg,
      alignItems: "center",
    },
    avatar: {
      width: 240,
      height: 240,
      borderRadius: 12, // Square with rounded corners
      backgroundColor: colors.gray[700],
      overflow: "hidden",
      justifyContent: "center",
      alignItems: "center",
    },
    name: {
      ...typography.h2,
      fontSize: 24,
      color: colors.white,
      marginBottom: spacing.sm,
      textAlign: "center",
    },
    entryCount: {
      ...typography.body,
      fontSize: 16,
      color: colors.gray[400],
      marginBottom: spacing.xl,
      textAlign: "center",
    },
    ctaButton: {
      width: "100%",
    },
  })

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ translateY }],
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={{ width: "100%", alignItems: "center" }}
          >
            {/* Avatar */}
            <View style={styles.avatarContainer}>
              {userAvatarUrl ? (
                <Image
                  source={{ uri: userAvatarUrl }}
                  style={styles.avatar}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.avatar}>
                  <Avatar
                    uri={userAvatarUrl}
                    name={userName}
                    size={240}
                  />
                </View>
              )}
            </View>

            {/* Name */}
            <Text style={styles.name}>{userName}</Text>

            {/* Entry Count */}
            {loading ? (
              <Text style={styles.entryCount}>Loading...</Text>
            ) : (
              <Text style={styles.entryCount}>
                {userName} has answered {entryCount ?? 0} {entryCount === 1 ? "question" : "questions"}
              </Text>
            )}

            {/* CTA Button */}
            <Button
              title={`See everything ${userName} has shared`}
              onPress={handleViewHistory}
              style={styles.ctaButton}
              variant="primary"
            />
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  )
}

