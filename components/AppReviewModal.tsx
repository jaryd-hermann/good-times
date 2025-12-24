"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Dimensions, Platform } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Button } from "./Button"
import { typography, spacing } from "../lib/theme"
import { useTheme } from "../lib/theme-context"
import { FontAwesome } from "@expo/vector-icons"
import { openAppStoreReview } from "../lib/app-store-review"

const { width: SCREEN_WIDTH } = Dimensions.get("window")

interface AppReviewModalProps {
  visible: boolean
  onClose: () => void
  onRate: () => void
}

export function AppReviewModal({
  visible,
  onClose,
  onRate,
}: AppReviewModalProps) {
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const slideAnim = useRef(new Animated.Value(0)).current
  const fadeAnim = useRef(new Animated.Value(0)).current

  // Theme 2 color palette - dynamic based on dark/light mode
  const theme2Colors = {
    red: "#B94444",
    yellow: "#E8A037",
    green: "#2D6F4A",
    blue: "#3A5F8C",
    beige: isDark ? "#000000" : "#E8E0D5", // Black in dark mode
    cream: isDark ? "#000000" : "#F5F0EA", // Black in dark mode
    white: isDark ? "#E8E0D5" : "#FFFFFF", // Beige in dark mode
    text: isDark ? "#F5F0EA" : "#000000", // Cream in dark mode
    textSecondary: isDark ? "#A0A0A0" : "#404040", // Light gray in dark mode
    onboardingPink: "#D97393", // Pink for onboarding CTAs (same in both modes)
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
    } else {
      // Reset animations
      slideAnim.setValue(0)
      fadeAnim.setValue(0)
    }
  }, [visible])

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [500, 0], // Slide up from bottom
  })

  const opacity = fadeAnim

  const handleRate = async () => {
    await openAppStoreReview()
    onRate()
    onClose()
  }

  const styles = useMemo(() => StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: "flex-end", // Position at bottom
      alignItems: "center",
      paddingBottom: spacing.lg, // Padding below modal
      paddingHorizontal: spacing.md, // Padding on sides
    },
    container: {
      backgroundColor: theme2Colors.beige, // Black in dark mode, beige in light mode
      borderRadius: 32, // More rounded edges
      paddingTop: spacing.xl + spacing.lg + spacing.md,
      paddingBottom: insets.bottom + spacing.xl,
      paddingHorizontal: spacing.lg,
      alignItems: "center",
      minHeight: 400,
      width: "100%",
      maxWidth: SCREEN_WIDTH - spacing.md * 2, // Account for side padding
      borderWidth: 2,
      borderColor: isDark ? theme2Colors.text : theme2Colors.yellow, // Cream outline in dark mode, yellow in light mode
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
      backgroundColor: isDark ? theme2Colors.beige : theme2Colors.white, // Black in dark mode, white in light mode
      justifyContent: "center",
      alignItems: "center",
      zIndex: 10,
      borderWidth: 1,
      borderColor: isDark ? theme2Colors.text : theme2Colors.text, // Cream outline in dark mode
    },
    content: {
      zIndex: 1,
      alignItems: "center",
      width: "100%",
    },
    title: {
      ...typography.h2,
      fontSize: 32,
      lineHeight: 40,
      color: theme2Colors.text,
      marginBottom: spacing.md,
      textAlign: "center",
      fontFamily: "PMGothicLudington-Text115",
      includeFontPadding: true, // Android: include font padding to prevent clipping
    },
    paragraph: {
      ...typography.body,
      fontSize: 16,
      lineHeight: 24,
      color: theme2Colors.textSecondary,
      marginBottom: spacing.xl,
      textAlign: "center",
      paddingHorizontal: spacing.sm,
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
  }), [isDark, theme2Colors, insets.bottom])

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.backdrop, { opacity }]}>
        {/* Warm fuzzy blur effect - lighter opacity so background shows through */}
        <>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(0, 0, 0, 0.6)" : theme2Colors.beige, opacity: opacity.interpolate({ inputRange: [0, 1], outputRange: [0, isDark ? 1 : 0.3] }) }]} />
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(0, 0, 0, 0.3)" : "rgba(232, 224, 213, 0.4)", opacity: opacity.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) }]} />
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
            {/* Title */}
            <Text style={styles.title}>Can I ask you a favor?</Text>

            {/* Paragraph */}
            <Text style={styles.paragraph}>
              I'm Jaryd, solo maker of Good Times.{'\n\n'}
              If you've enjoyed my app and have a minute to spare, it would mean the world if you'd leave a rating or review on the app store.{'\n\n'}
              It makes a huge difference helping new small apps get found.
            </Text>

            {/* CTA Button */}
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={handleRate}
              activeOpacity={0.8}
            >
              {/* Texture overlay */}
              <View style={styles.ctaButtonTexture} pointerEvents="none">
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    width: "100%",
                    height: "100%",
                  }}
                />
              </View>
              <Text style={styles.ctaButtonText}>
                Sure, I'll help with a quick rating!
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  )
}

