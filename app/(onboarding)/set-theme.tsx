"use client"

import { useState, useEffect, useMemo } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
} from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { supabase } from "../../lib/supabase"
import { spacing, typography } from "../../lib/theme"
import { useTheme } from "../../lib/theme-context"
import { usePostHog } from "posthog-react-native"
import { safeCapture } from "../../lib/posthog"

const SET_THEME_ONBOARDING_KEY_PREFIX = "has_completed_set_theme_onboarding"

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
  onboardingPink: "#D97393", // Pink for onboarding CTAs
  darkBackground: "#1A1A1C", // Dark background for dark theme card
}

// Helper function to get user+group-specific onboarding key
function getSetThemeOnboardingKey(userId: string, groupId: string): string {
  return `${SET_THEME_ONBOARDING_KEY_PREFIX}_${userId}_${groupId}`
}

export default function SetTheme() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const insets = useSafeAreaInsets()
  const { theme, setTheme, isDark } = useTheme()
  const posthog = usePostHog()
  
  const [userId, setUserId] = useState<string>()
  const [groupId, setGroupId] = useState<string>()
  const [selectedTheme, setSelectedTheme] = useState<"light" | "dark">("light")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadUserAndGroup() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        
        if (!user) {
          router.replace("/(onboarding)/welcome-1")
          return
        }

        setUserId(user.id)

        // Get group ID - check pending group created FIRST, then params, then pending group join
        let targetGroupId: string | undefined
        
        const pendingGroupCreated = await AsyncStorage.getItem("pending_group_created")
        const paramsGroupIdValue = Array.isArray(params.groupId) ? params.groupId[0] : params.groupId
        
        if (pendingGroupCreated) {
          targetGroupId = pendingGroupCreated
        } else if (paramsGroupIdValue) {
          targetGroupId = paramsGroupIdValue as string
        } else {
          const pendingGroupId = await AsyncStorage.getItem("pending_group_join")
          if (pendingGroupId) {
            targetGroupId = pendingGroupId
          } else {
            // Get user's first group
            const { data: groups } = await supabase
              .from("group_members")
              .select("group_id")
              .eq("user_id", user.id)
              .limit(1)
            
            if (groups && groups.length > 0) {
              targetGroupId = groups[0].group_id
            }
          }
        }

        if (!targetGroupId) {
          router.replace("/(main)/home")
          return
        }

        setGroupId(targetGroupId)

        // Check if user has already completed set theme onboarding for this group
        const onboardingKey = getSetThemeOnboardingKey(user.id, targetGroupId)
        const hasCompleted = await AsyncStorage.getItem(onboardingKey)
        
        if (hasCompleted === "true") {
          // Already completed - go to home
          router.replace({
            pathname: "/(main)/home",
            params: { focusGroupId: targetGroupId },
          })
          return
        }

        // Load current theme preference (if exists)
        const storageKey = `user_theme_preference_${user.id}`
        const cachedTheme = await AsyncStorage.getItem(storageKey)
        if (cachedTheme === "dark" || cachedTheme === "light") {
          setSelectedTheme(cachedTheme)
        }

        setIsLoading(false)
        
        // Track loaded_set_theme_onboarding event
        safeCapture(posthog, "loaded_set_theme_onboarding", {
          group_id: targetGroupId,
        })
      } catch (error) {
        console.error("[set-theme] Error loading user and group:", error)
        router.replace("/(main)/home")
      }
    }
    
    loadUserAndGroup()
  }, [router, params.groupId, posthog])

  async function handleThemeSelect(themeChoice: "light" | "dark") {
    setSelectedTheme(themeChoice)
    // Update theme immediately for preview
    await setTheme(themeChoice)
  }

  async function handleContinue() {
    if (!userId || !groupId) {
      router.replace("/(main)/home")
      return
    }

    // Save theme preference (already saved by setTheme, but ensure it's persisted)
    await setTheme(selectedTheme)

    // Mark set theme onboarding as complete for this user+group
    const onboardingKey = getSetThemeOnboardingKey(userId, groupId)
    await AsyncStorage.setItem(onboardingKey, "true")
    
    // Track completed_set_theme_onboarding event
    safeCapture(posthog, "completed_set_theme_onboarding", {
      group_id: groupId,
      theme_selected: selectedTheme,
    })
    
    // Clear pending group keys if they exist
    const pendingGroupCreated = await AsyncStorage.getItem("pending_group_created")
    const pendingGroupId = await AsyncStorage.getItem("pending_group_join")
    if (pendingGroupCreated) {
      await AsyncStorage.removeItem("pending_group_created")
    }
    if (pendingGroupId) {
      await AsyncStorage.removeItem("pending_group_join")
    }
    
    // Route to group-interests (onboarding step) with focus on the group
    router.replace({
      pathname: "/(main)/group-interests",
      params: { groupId },
    })
  }

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme2Colors.beige,
    },
    content: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: insets.top + spacing.xxl,
      paddingBottom: spacing.xl,
      justifyContent: "space-between",
    },
    header: {
      alignItems: "flex-start",
      marginBottom: spacing.xxl,
    },
    title: {
      fontFamily: "PMGothicLudington-Text115",
      fontSize: 32,
      color: theme2Colors.text,
      marginBottom: spacing.sm,
      textAlign: "left",
    },
    subtitle: {
      ...typography.body,
      fontSize: 16,
      color: theme2Colors.textSecondary,
      textAlign: "left",
      marginTop: spacing.sm,
    },
    themeCardsContainer: {
      flex: 1,
      justifyContent: "center",
      gap: spacing.lg,
      paddingVertical: spacing.xl,
    },
    themeCard: {
      width: "100%",
      minHeight: 240,
      borderRadius: 16,
      padding: spacing.xl,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: theme2Colors.textSecondary,
    },
    themeCardSelected: {
      borderColor: theme2Colors.onboardingPink,
      borderWidth: 3,
    },
    darkThemeCard: {
      backgroundColor: theme2Colors.darkBackground,
    },
    lightThemeCard: {
      backgroundColor: theme2Colors.beige,
    },
    themeCardText: {
      fontFamily: "PMGothicLudington-Text115",
      fontSize: 24,
      color: theme2Colors.text,
    },
    darkThemeCardText: {
      color: theme2Colors.white,
    },
    continueButtonContainer: {
      paddingTop: spacing.md,
    },
    continueButton: {
      width: "100%",
      backgroundColor: theme2Colors.onboardingPink,
      borderRadius: 25,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      position: "relative",
      minHeight: 56,
    },
    continueButtonText: {
      fontFamily: "Roboto-Bold",
      fontSize: 18,
      color: theme2Colors.white,
      zIndex: 2,
    },
    continueButtonTexture: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.3,
      zIndex: 1,
    },
    continueButtonTextureImage: {
      ...StyleSheet.absoluteFillObject,
      width: "100%",
      height: "100%",
    },
    selectedTag: {
      marginTop: spacing.sm,
      backgroundColor: theme2Colors.onboardingPink,
      borderRadius: 12,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    selectedTagText: {
      fontFamily: "Roboto-Bold",
      fontSize: 12,
      color: theme2Colors.white,
    },
  }), [insets.top, selectedTheme])

  if (isLoading) {
    return null
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Pick a theme</Text>
          <Text style={styles.subtitle}>You can change in settings anytime</Text>
        </View>

        {/* Theme Cards */}
        <View style={styles.themeCardsContainer}>
          {/* Dark Theme Card */}
          <TouchableOpacity
            style={[
              styles.themeCard,
              styles.darkThemeCard,
              selectedTheme === "dark" && styles.themeCardSelected,
            ]}
            onPress={() => handleThemeSelect("dark")}
            activeOpacity={0.8}
          >
            <Text style={[styles.themeCardText, styles.darkThemeCardText]}>Dark theme</Text>
            {selectedTheme === "dark" && (
              <View style={styles.selectedTag}>
                <Text style={styles.selectedTagText}>Selected</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Light Theme Card */}
          <TouchableOpacity
            style={[
              styles.themeCard,
              styles.lightThemeCard,
              selectedTheme === "light" && styles.themeCardSelected,
            ]}
            onPress={() => handleThemeSelect("light")}
            activeOpacity={0.8}
          >
            <Text style={styles.themeCardText}>Light theme</Text>
            {selectedTheme === "light" && (
              <View style={styles.selectedTag}>
                <Text style={styles.selectedTagText}>Selected</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Continue Button */}
        <View style={styles.continueButtonContainer}>
          <TouchableOpacity
            onPress={handleContinue}
            style={styles.continueButton}
            activeOpacity={0.8}
          >
            <Text style={styles.continueButtonText}>
              Continue with {selectedTheme === "dark" ? "dark" : "light"} mode →
            </Text>
            <View style={styles.continueButtonTexture} pointerEvents="none">
              <Image
                source={require("../../assets/images/texture.png")}
                style={styles.continueButtonTextureImage}
                resizeMode="cover"
              />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

