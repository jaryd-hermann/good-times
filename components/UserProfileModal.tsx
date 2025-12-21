"use client"

import { useEffect, useState, useRef } from "react"
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Dimensions, Image, Platform } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Avatar } from "./Avatar"
import { Button } from "./Button"
import { typography, spacing } from "../lib/theme"
import { useTheme } from "../lib/theme-context"
import { supabase } from "../lib/supabase"
import { FontAwesome } from "@expo/vector-icons"
import Svg, { Path, Circle, Polygon } from "react-native-svg"

// Conditionally import BlurView - fallback if native module not available
// Note: expo-blur requires native rebuild. Fallback will be used until rebuild.
let BlurView: any = null
let blurAvailable = false
try {
  const blurModule = require("expo-blur")
  if (blurModule && blurModule.BlurView) {
    BlurView = blurModule.BlurView
    blurAvailable = true
  }
} catch (e) {
  // BlurView not available, will use fallback
  blurAvailable = false
}

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
  const fadeAnim = useRef(new Animated.Value(0)).current

  // Theme 2 color palette
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
    onboardingPink: "#D97393", // Pink for onboarding CTAs
  }

  useEffect(() => {
    if (visible) {
      // Fade in backdrop
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start()
      
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
      // Reset animations
      slideAnim.setValue(0)
      fadeAnim.setValue(0)
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
    outputRange: [500, 0], // Slide up from bottom
  })

  const opacity = fadeAnim

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
      justifyContent: "flex-end", // Position at bottom
      alignItems: "center",
      paddingBottom: spacing.lg, // Padding below modal
      paddingHorizontal: spacing.md, // Padding on sides
    },
    blurBackdrop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    container: {
      backgroundColor: theme2Colors.beige, // Beige background for profile card
      borderRadius: 32, // More rounded edges
      paddingTop: spacing.xl + spacing.lg + spacing.xl + spacing.md, // Extra padding to prevent name cropping
      paddingBottom: insets.bottom + spacing.xl,
      paddingHorizontal: spacing.lg,
      alignItems: "center",
      minHeight: 400,
      width: "100%",
      maxWidth: SCREEN_WIDTH - spacing.md * 2, // Account for side padding
      borderWidth: 2,
      borderColor: theme2Colors.yellow, // Darker yellow stroke
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 10, // Shadow below for floating effect
      },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 20,
      position: "relative",
      overflow: "visible", // Changed to visible to prevent text clipping
    },
    closeButton: {
      position: "absolute",
      top: spacing.md, // More padding from top corner
      right: spacing.md, // More padding from right corner
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme2Colors.white, // White background for X button
      justifyContent: "center",
      alignItems: "center",
      zIndex: 10,
      borderWidth: 1,
      borderColor: theme2Colors.text, // Black outline
    },
    geometricShapes: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 0,
    },
    starburst: {
      position: "absolute",
      top: spacing.md,
      left: spacing.md,
      width: 40,
      height: 40,
    },
    orangeCircle: {
      position: "absolute",
      top: spacing.md + 8, // Adjust to account for X button padding
      right: spacing.lg + 40, // Move further right to avoid X button
      width: 16,
      height: 16,
    },
    greenTriangle: {
      position: "absolute",
      right: spacing.md,
      top: "50%",
      width: 30,
      height: 30,
    },
    content: {
      zIndex: 1,
      alignItems: "center",
      width: "100%",
    },
    avatarContainer: {
      marginBottom: spacing.xl + spacing.md, // Even more space below avatar to prevent name cropping
      alignItems: "center",
    },
    avatar: {
      width: 180, // Larger square image
      height: 180,
      borderRadius: 20, // Square with rounded edges
      backgroundColor: theme2Colors.beige,
      overflow: "hidden",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 3,
      borderColor: theme2Colors.onboardingPink,
    },
    name: {
      ...typography.h2,
      fontSize: 48, // 2x larger (was 24)
      lineHeight: 56, // Add line height to prevent clipping
      color: theme2Colors.text,
      marginTop: spacing.xs, // Extra margin top to prevent cropping
      marginBottom: spacing.sm,
      textAlign: "center",
      fontFamily: "PMGothicLudington-Text115",
      includeFontPadding: true, // Android: include font padding to prevent clipping
    },
    entryCount: {
      ...typography.body,
      fontSize: 16,
      color: theme2Colors.textSecondary,
      marginBottom: spacing.xl,
      textAlign: "center",
    },
    ctaButton: {
      width: "100%",
      backgroundColor: theme2Colors.onboardingPink,
      borderRadius: 25,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderWidth: 2,
      borderColor: theme2Colors.textSecondary,
      position: "relative", // For absolute positioning of texture
      overflow: "hidden", // Ensure texture stays within bounds
    },
    ctaButtonTexture: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.4, // Adjust opacity to taste
      zIndex: 1, // Above button background but below text
      pointerEvents: "none", // Allow touches to pass through
      borderRadius: 25, // Match button border radius
    },
    ctaButtonText: {
      color: theme2Colors.white,
      fontSize: 16,
      fontWeight: "600",
      textAlign: "center", // Center the text
      position: "relative",
      zIndex: 2, // Above texture overlay
    },
  })

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.backdrop, { opacity }]}>
        {/* Warm fuzzy blur effect - lighter opacity so background shows through */}
        {/* Use fallback until native module is rebuilt - prevents warning */}
        {/* To enable native blur: run `npx expo prebuild --clean` then rebuild app */}
        <>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme2Colors.beige, opacity: opacity.interpolate({ inputRange: [0, 1], outputRange: [0, 0.3] }) }]} />
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(232, 224, 213, 0.4)", opacity: opacity.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) }]} />
        </>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0, 0, 0, 0.1)", opacity: opacity.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) }]} />
      <TouchableOpacity
          style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
        />
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ translateY }],
              opacity: slideAnim,
            },
          ]}
        >
              {/* Close Button - positioned at top right of card */}
          <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <FontAwesome name="times" size={16} color={theme2Colors.text} />
              </TouchableOpacity>

            <View style={styles.content}>
              {/* Geometric Shapes */}
              <View style={styles.geometricShapes}>
                {/* Green Starburst - top left */}
                <Svg width={40} height={40} style={styles.starburst}>
                  <Path
                    d="M 20 0 L 24 14 L 38 16 L 26 26 L 30 40 L 20 32 L 10 40 L 14 26 L 2 16 L 16 14 Z"
                    fill={theme2Colors.green}
                  />
                </Svg>
                
                {/* Orange Circle - top right */}
                <Svg width={16} height={16} style={styles.orangeCircle}>
                  <Circle cx={8} cy={8} r={8} fill={theme2Colors.yellow} />
                </Svg>
                
                {/* Light Green Triangle - right side */}
                <Svg width={30} height={30} style={styles.greenTriangle}>
                  <Polygon
                    points="0,30 30,15 0,0"
                    fill={theme2Colors.green}
                    opacity={0.6}
                  />
                </Svg>
              </View>

            {/* Avatar */}
            <View style={styles.avatarContainer}>
                <View style={styles.avatar}>
              {userAvatarUrl ? (
                <Image
                  source={{ uri: userAvatarUrl }}
                      style={{ width: 174, height: 174, borderRadius: 17 }}
                  resizeMode="cover"
                />
              ) : (
                  <Avatar
                    uri={userAvatarUrl}
                    name={userName}
                      size={174}
                      borderColor={theme2Colors.onboardingPink}
                      square={true}
                  />
                  )}
                </View>
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
              <TouchableOpacity
                style={styles.ctaButton}
              onPress={handleViewHistory}
                activeOpacity={0.8}
              >
                {/* Texture overlay */}
                <View style={styles.ctaButtonTexture} pointerEvents="none">
                  <Image
                    source={require("../assets/images/texture.png")}
                    style={{ 
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      width: "100%",
                      height: "100%",
                    }}
                    resizeMode="stretch"
            />
                </View>
                <Text style={styles.ctaButtonText}>
                  See all {userName}'s answers
                </Text>
          </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
    </Modal>
  )
}

