"use client"

import { useEffect, useState, useMemo } from "react"
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Image,
  Switch,
  Platform,
  Share,
  BackHandler,
} from "react-native"
import { useRouter } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { supabase } from "../../lib/supabase"
import { getCurrentUser, getUserGroups } from "../../lib/db"
import { spacing, typography } from "../../lib/theme"
import { useTheme } from "../../lib/theme-context"
import { Button } from "../../components/Button"
import { Avatar } from "../../components/Avatar"
import { FontAwesome } from "@expo/vector-icons"
import { usePostHog } from "posthog-react-native"
import { captureEvent } from "../../lib/posthog"
import { getTodayDate } from "../../lib/utils"
import {
  isBiometricAvailable,
  getBiometricType,
  getBiometricPreference,
  saveBiometricPreference,
  authenticateWithBiometric,
} from "../../lib/biometric"
import {
  logSessionState,
  forceSessionExpiry,
  simulateLongInactivity,
  clearAllSessionData,
  testPasswordResetLink,
  type SessionState,
} from "../../lib/test-session-utils"
import { OnboardingGallery } from "../../components/OnboardingGallery"
import { openAppStoreReview } from "../../lib/app-store-review"

export default function SettingsScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()
  const { colors, theme, setTheme, isDark } = useTheme()
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [dailyQuestionNotifications, setDailyQuestionNotifications] = useState(true)
  const [primaryGroupId, setPrimaryGroupId] = useState<string | undefined>()
  const [biometricEnabled, setBiometricEnabled] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricType, setBiometricType] = useState<"face" | "fingerprint" | "iris" | "none">("none")
  const [devForceCustomQuestion, setDevForceCustomQuestion] = useState(false)
  const [sessionState, setSessionState] = useState<SessionState | null>(null)
  const [onboardingGalleryVisible, setOnboardingGalleryVisible] = useState(false)
  const posthog = usePostHog()

  // Track loaded_settings_screen event
  useEffect(() => {
    try {
      if (posthog) {
        posthog.capture("loaded_settings_screen")
      } else {
        captureEvent("loaded_settings_screen")
      }
    } catch (error) {
      if (__DEV__) console.error("[settings] Failed to track loaded_settings_screen:", error)
    }
  }, [posthog])

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: getCurrentUser,
  })

  useEffect(() => {
    async function loadGroups() {
      if (!profile?.id) return
      try {
        const groups = await getUserGroups(profile.id)
        if (groups.length > 0) {
          setPrimaryGroupId(groups[0].id)
        }
      } catch (error) {
        console.warn("[settings] failed to load groups", error)
      }
    }
    loadGroups()
  }, [profile?.id])

  useEffect(() => {
    async function checkBiometric() {
      const available = await isBiometricAvailable()
      setBiometricAvailable(available)
      if (available) {
        const type = await getBiometricType()
        setBiometricType(type)
        const enabled = await getBiometricPreference()
        setBiometricEnabled(enabled)
      }
    }
    checkBiometric()
  }, [])

  useEffect(() => {
    async function loadDevSettings() {
      if (__DEV__) {
        const forceCustomQuestion = await AsyncStorage.getItem("dev_force_custom_question")
        setDevForceCustomQuestion(forceCustomQuestion === "true")
      }
    }
    loadDevSettings()
  }, [])

  function handleProfilePress() {
    router.push("/(main)/settings/profile")
  }

  async function handleInvite() {
    if (!primaryGroupId) {
      Alert.alert("No group yet", "Create a group first to share your invite link.")
      return
    }

    try {
      const userName = profile?.name || "me"
      const inviteLink = `https://thegoodtimes.app/join/${primaryGroupId}`
      const inviteMessage = `I've created a group for us on this new app, Good Times. Join ${userName} here: ${inviteLink}`
      
      // Platform-specific sharing to prevent duplicate URLs on iOS
      // iOS: Only use message (URL included in text) to avoid preview card duplication
      // Android: Use both url and message for better integration
      if (Platform.OS === "ios") {
        await Share.share({
          message: inviteMessage,
          title: "Invite someone",
        })
      } else {
        await Share.share({
          url: inviteLink,
          message: inviteMessage,
          title: "Invite someone",
        })
      }
    } catch (error: any) {
      Alert.alert("Error", error.message)
    }
  }

  async function handleAppRating() {
    await openAppStoreReview()
  }

  async function handleBiometricToggle(value: boolean) {
    if (value) {
      // User wants to enable - authenticate first
      const result = await authenticateWithBiometric("Enable FaceID to log in quickly")
      if (result.success) {
        try {
          await saveBiometricPreference(true)
          setBiometricEnabled(true)
          Alert.alert("FaceID Enabled", "You can now use FaceID to log in quickly.")
        } catch (error: any) {
          Alert.alert("Error", error.message || "Failed to enable FaceID")
        }
      } else {
        // User cancelled or failed - don't enable
        Alert.alert("FaceID Not Enabled", result.error || "Authentication required to enable FaceID")
      }
    } else {
      // User wants to disable
      try {
        await saveBiometricPreference(false)
        setBiometricEnabled(false)
        Alert.alert("FaceID Disabled", "You'll need to use your password to log in.")
      } catch (error: any) {
        Alert.alert("Error", error.message || "Failed to disable FaceID")
      }
    }
  }

  async function handleSignOut() {
    // CRITICAL: Navigate immediately for instant UX (optimistic navigation)
    // Don't wait for cleanup operations - they can happen in background
    router.replace("/(onboarding)/welcome-1")
    
    // Run cleanup operations in parallel with timeouts (non-blocking)
    // This prevents the 10-15s lag
    Promise.all([
      // Get user ID and clear onboarding flag (with timeout)
      (async () => {
        try {
          const getUserPromise = supabase.auth.getUser()
          const getUserTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("getUser timeout")), 2000)
          )
          const result = await Promise.race([getUserPromise, getUserTimeout]) as any
          const user = result?.data?.user
          
          if (user) {
            const onboardingKey = `has_completed_post_auth_onboarding_${user.id}`
            await AsyncStorage.removeItem(onboardingKey)
          }
        } catch (error) {
          // Ignore errors - navigation already happened
          console.warn("[settings] Failed to clear onboarding flag:", error)
        }
      })(),
      
      // Clear biometric credentials (with timeout)
      (async () => {
        try {
          const { clearBiometricCredentials } = await import("../../lib/biometric")
          const clearPromise = clearBiometricCredentials()
          const clearTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("clearBiometric timeout")), 2000)
          )
          await Promise.race([clearPromise, clearTimeout])
        } catch (error) {
          console.warn("[settings] Failed to clear biometric credentials:", error)
        }
      })(),
      
      // Sign out from Supabase (with timeout)
      (async () => {
        try {
          const signOutPromise = supabase.auth.signOut()
          const signOutTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("signOut timeout")), 3000)
          )
          await Promise.race([signOutPromise, signOutTimeout])
        } catch (error) {
          console.warn("[settings] signOut failed or timed out:", error)
          // Continue anyway - navigation already happened
        }
      })(),
      
      // Invalidate queries (with timeout - this is often the slowest operation)
      (async () => {
        try {
          // CRITICAL: Use removeQueries instead of invalidateQueries for faster cleanup
          // removeQueries is synchronous and faster than invalidateQueries which refetches
          queryClient.removeQueries()
        } catch (error) {
          console.warn("[settings] Query cleanup failed:", error)
        }
      })(),
    ]).catch((error) => {
      // All cleanup operations failed or timed out - that's okay, navigation already happened
      console.warn("[settings] Some cleanup operations failed:", error)
    })
  }

  function handleReportIssue() {
    router.push("/(main)/feedback")
  }

  async function handleDevForceCustomQuestionToggle(value: boolean) {
    setDevForceCustomQuestion(value)
    await AsyncStorage.setItem("dev_force_custom_question", value ? "true" : "false")
  }

  async function handleLogSessionState() {
    try {
      const state = await logSessionState()
      setSessionState(state)
      Alert.alert(
        "Session State",
        `Session: ${state.hasSession ? "✅" : "❌"}\n` +
        `Expires in: ${state.sessionExpiresIn !== null ? `${state.sessionExpiresIn} min` : "N/A"}\n` +
        `Cold start: ${state.isColdStart ? "Yes" : "No"}\n` +
        `Inactive too long: ${state.inactiveTooLong ? "Yes" : "No"}\n` +
        `Time since close: ${state.timeSinceClose !== null ? `${state.timeSinceClose} min` : "N/A"}\n` +
        `Time since active: ${state.timeSinceActive !== null ? `${state.timeSinceActive} min` : "N/A"}\n\n` +
        `Check console for full details.`,
        [{ text: "OK" }]
      )
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to log session state")
    }
  }

  async function handleForceSessionExpiry() {
    Alert.alert(
      "Force Session Expiry",
      "This will clear the current session. Restart the app to test expired session flow.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Session",
          style: "destructive",
          onPress: async () => {
            try {
              await forceSessionExpiry()
              Alert.alert("Success", "Session cleared. Restart app to test.")
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to clear session")
            }
          },
        },
      ]
    )
  }

  async function handleSimulateInactivity() {
    Alert.prompt(
      "Simulate Inactivity",
      "Enter minutes of inactivity to simulate (default: 35):\n\nThis will:\n1. Set last active/close times\n2. Close the app\n3. You can then reopen to test boot flow",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Simulate & Close",
          onPress: async (minutesStr) => {
            try {
              const minutes = minutesStr ? parseInt(minutesStr, 10) : 35
              if (isNaN(minutes) || minutes < 0) {
                Alert.alert("Error", "Invalid number of minutes")
                return
              }
              
              console.log(`[SETTINGS] Starting inactivity simulation: ${minutes} minutes`)
              
              // Simulate the inactivity with comprehensive logging
              await simulateLongInactivity(minutes)
              
              console.log(`[SETTINGS] Inactivity simulation complete, verifying...`)
              
              // Verify the simulation worked by checking wasInactiveTooLong
              try {
                const { wasInactiveTooLong } = await import("../../lib/session-lifecycle")
                const isInactive = await wasInactiveTooLong()
                console.log(`[SETTINGS] Verification: wasInactiveTooLong() = ${isInactive}`)
                
                if (isInactive) {
                  console.log(`[SETTINGS] ✅ Verification passed - inactivity detected correctly`)
                } else {
                  console.warn(`[SETTINGS] ⚠️ Verification warning - inactivity not detected (may need >= 30 minutes)`)
                }
              } catch (error) {
                console.warn(`[SETTINGS] Failed to verify inactivity:`, error)
              }
              
              console.log(`[SETTINGS] Preparing to close app...`)
              
              // Show confirmation before closing
              Alert.alert(
                "Simulation Complete ✅",
                `Simulated ${minutes} minutes of inactivity.\n\n📋 Check console logs for full details.\n\n🔄 The app will now close. Reopen it to test the boot flow.\n\n✅ Expected behavior:\n• Boot screen with spinning loading.png\n• Routes to home.tsx after 2-3 seconds\n• Check console for "[boot] LONG INACTIVITY DETECTED" logs`,
                [
                  {
                    text: Platform.OS === "android" ? "Close App" : "Got It",
                    style: "destructive",
                    onPress: () => {
                      console.log(`[SETTINGS] User confirmed, closing app...`)
                      // Close the app
                      if (Platform.OS === "android") {
                        // Android: Use BackHandler to exit
                        console.log(`[SETTINGS] Android detected - calling BackHandler.exitApp()`)
                        BackHandler.exitApp()
                      } else {
                        // iOS: Can't programmatically close, but show instructions
                        console.log(`[SETTINGS] iOS detected - showing manual close instructions`)
                        Alert.alert(
                          "Close the App",
                          "On iOS, please manually close the app:\n\n1. Swipe up from bottom (or double-tap home button)\n2. Swipe up on the Good Times app card\n\nThen reopen to test the boot flow.\n\nCheck console logs for boot flow behavior.",
                          [{ text: "OK" }]
                        )
                      }
                    },
                  },
                  {
                    text: "Stay Open",
                    style: "cancel",
                    onPress: () => {
                      console.log(`[SETTINGS] User chose to stay open - can manually close later`)
                    },
                  },
                ]
              )
            } catch (error: any) {
              console.error(`[SETTINGS] Failed to simulate inactivity:`, error)
              Alert.alert("Error", error.message || "Failed to simulate inactivity")
            }
          },
        },
      ],
      "plain-text",
      "35"
    )
  }

  async function handleClearAllSessionData() {
    Alert.alert(
      "Clear All Session Data",
      "This will clear all session lifecycle data. Restart the app to test cold start.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            try {
              await clearAllSessionData()
              Alert.alert("Success", "All session data cleared. Restart app to test.")
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to clear session data")
            }
          },
        },
      ]
    )
  }

  async function handleTestPasswordReset() {
    // First get email, then URL
    Alert.prompt(
      "Test Password Reset Link",
      "Enter the email address for the reset link:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Next",
          onPress: async (email) => {
            if (!email || !email.trim()) {
              Alert.alert("Error", "Please enter an email address")
              return
            }
            
            // Then prompt for URL
            Alert.prompt(
              "Test Password Reset Link",
              "Paste the Supabase verification URL from the email:\n\nhttps://project.supabase.co/auth/v1/verify?token=...&type=recovery&redirect_to=goodtimes://",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Test",
                  onPress: async (url) => {
                    if (!url || !url.trim()) {
                      Alert.alert("Error", "Please paste the verification URL")
                      return
                    }
                    try {
                      const result = await testPasswordResetLink(url.trim(), email.trim())
                      if (result.success) {
                        Alert.alert(
                          "Success", 
                          `Password reset link appears valid!\n\nEmail: ${email.trim()}\n\nNote: The link will be consumed when you use it. Navigating to reset password screen...`,
                          [
                            {
                              text: "OK",
                              onPress: () => {
                                router.push("/(onboarding)/reset-password")
                              }
                            }
                          ]
                        )
                      } else {
                        Alert.alert("Error", result.error || "Failed to verify password reset link")
                      }
                    } catch (error: any) {
                      Alert.alert("Error", error.message || "Failed to test password reset link")
                    }
                  },
                },
              ],
              "plain-text"
            )
          },
        },
      ],
      "plain-text"
    )
  }


  // Theme 2 color palette - dynamic based on dark/light mode
  const theme2Colors = useMemo(() => ({
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
  }), [isDark])

  // Create dynamic styles based on theme
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme2Colors.beige,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? theme2Colors.beige : theme2Colors.white, // Black in dark mode
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: isDark ? theme2Colors.text : theme2Colors.text, // Cream in dark mode
    },
    title: {
      fontFamily: "PMGothicLudington-Text115",
      fontSize: 32,
      color: theme2Colors.text,
    },
    content: {
      padding: spacing.md,
      paddingBottom: spacing.xxl,
    },
    profileCard: {
      backgroundColor: theme2Colors.beige,
      borderRadius: 16,
      overflow: "hidden",
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    topCard: {
      backgroundColor: theme2Colors.cream,
      borderRadius: 16,
      overflow: "hidden",
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: theme2Colors.text,
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    profileCardContent: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.md,
    },
    profileCardIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: spacing.md,
      overflow: "hidden",
      backgroundColor: theme2Colors.textSecondary,
      justifyContent: "center",
      alignItems: "center",
    },
    topCardIcon: {
      width: 24,
      height: 24,
      marginRight: spacing.md,
      justifyContent: "center",
      alignItems: "center",
    },
    profileCardText: {
      flex: 1,
    },
    profileCardTitle: {
      ...typography.bodyBold,
      fontSize: 18,
      color: theme2Colors.text,
      fontWeight: "600",
    },
    profileCardSubtitle: {
      ...typography.caption,
      color: theme2Colors.textSecondary,
      fontSize: 14,
    },
    settingRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme2Colors.textSecondary,
    },
    settingRowText: {
      flex: 1,
    },
    settingRowTitle: {
      ...typography.bodyBold,
      fontSize: 22,
      color: theme2Colors.text,
      fontWeight: "600",
    },
    settingRowSubtitle: {
      ...typography.body,
      color: theme2Colors.textSecondary,
      fontSize: 15,
      marginTop: spacing.xs,
    },
    actions: {
      gap: spacing.md,
    },
    inviteCard: {
      backgroundColor: theme2Colors.cream,
      borderRadius: 16,
      overflow: "hidden",
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
    },
    inviteCardContent: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.md,
    },
    inviteCardIcon: {
      width: 24,
      height: 24,
      justifyContent: "center",
      alignItems: "center",
      marginRight: spacing.md,
    },
    inviteCardText: {
      flex: 1,
    },
    inviteCardTitle: {
      ...typography.bodyBold,
      fontSize: 16,
      color: theme2Colors.text,
    },
    inviteCardSubtitle: {
      ...typography.caption,
      color: theme2Colors.textSecondary,
      fontSize: 13,
    },
    reportButton: {
      backgroundColor: theme2Colors.blue,
      borderRadius: 20,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 56,
    },
    reportButtonText: {
      ...typography.bodyBold,
      fontSize: 18,
      color: theme2Colors.white,
      textAlign: "center",
    },
    logoutLink: {
      alignSelf: "center",
      paddingVertical: spacing.xs,
    },
    logoutText: {
      ...typography.bodyMedium,
      color: theme2Colors.textSecondary,
    },
    wordmark: {
      width: 240, // 2x larger (120 * 2)
      height: 80, // 2x larger (40 * 2)
      marginTop: spacing.md,
      alignSelf: "center",
    },
    memorialText: {
      ...typography.body,
      color: theme2Colors.textSecondary,
      textAlign: "center",
      marginTop: spacing.md,
      fontSize: 12,
      fontStyle: "italic",
      lineHeight: 12, // 50% reduction from default 24px line height
    },
  }), [colors, isDark, theme2Colors])

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton} activeOpacity={0.7}>
          <FontAwesome name="times" size={16} color={theme2Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Card */}
        <TouchableOpacity style={styles.topCard} onPress={handleProfilePress} activeOpacity={0.7}>
          <View style={styles.profileCardContent}>
            <View style={styles.topCardIcon}>
              {profile?.avatar_url ? (
                <Avatar uri={profile.avatar_url} name={profile.name || "User"} size={24} />
              ) : (
                <Image 
                  source={require("../../assets/images/pic.png")} 
                  style={{ width: 24, height: 24 }}
                  resizeMode="contain"
                />
              )}
            </View>
            <View style={styles.profileCardText}>
              <Text style={styles.profileCardTitle}>{profile?.name || "User"}</Text>
              <Text style={styles.profileCardSubtitle}>Edit profile</Text>
            </View>
            <FontAwesome name="chevron-right" size={16} color={theme2Colors.textSecondary} style={{ marginLeft: spacing.md }} />
          </View>
        </TouchableOpacity>

        {/* Latest Changes Card */}
        <TouchableOpacity 
          style={styles.topCard} 
          onPress={() => router.push("/(main)/settings/latest-changes")} 
          activeOpacity={0.7}
        >
          <View style={styles.profileCardContent}>
            <View style={styles.topCardIcon}>
              <Image 
                source={require("../../assets/images/changes.png")} 
                style={{ width: 24, height: 24 }}
                resizeMode="contain"
              />
            </View>
            <View style={styles.profileCardText}>
              <Text style={styles.profileCardTitle}>Latest changes</Text>
              <Text style={styles.profileCardSubtitle}>New good things</Text>
            </View>
            <FontAwesome name="chevron-right" size={16} color={theme2Colors.textSecondary} style={{ marginLeft: spacing.md }} />
          </View>
        </TouchableOpacity>

        {/* App Explainer Card */}
        <TouchableOpacity 
          style={styles.topCard} 
          onPress={() => setOnboardingGalleryVisible(true)} 
          activeOpacity={0.7}
        >
          <View style={styles.profileCardContent}>
            <View style={styles.topCardIcon}>
              <Image 
                source={require("../../assets/images/explainer.png")} 
                style={{ width: 24, height: 24 }}
                resizeMode="contain"
              />
            </View>
            <View style={styles.profileCardText}>
              <Text style={styles.profileCardTitle}>App explainer</Text>
              <Text style={styles.profileCardSubtitle}>Learn how Good Times works</Text>
            </View>
            <FontAwesome name="chevron-right" size={16} color={theme2Colors.textSecondary} style={{ marginLeft: spacing.md }} />
          </View>
        </TouchableOpacity>

        {/* Invite Members Card */}
        <TouchableOpacity style={styles.inviteCard} onPress={handleInvite} activeOpacity={0.7}>
          <View style={styles.inviteCardContent}>
            <View style={styles.inviteCardIcon}>
              <Image 
                source={require("../../assets/images/people.png")} 
                style={{ width: 24, height: 24 }}
                resizeMode="contain"
              />
            </View>
            <View style={styles.inviteCardText}>
              <Text style={styles.inviteCardTitle}>Invite Members</Text>
              <Text style={styles.inviteCardSubtitle}>Share invite link to add new members</Text>
            </View>
            <FontAwesome name="chevron-right" size={16} color={theme2Colors.textSecondary} style={{ marginLeft: spacing.md }} />
          </View>
        </TouchableOpacity>

        {/* App Rating Card */}
        <TouchableOpacity style={styles.inviteCard} onPress={handleAppRating} activeOpacity={0.7}>
          <View style={styles.inviteCardContent}>
            <View style={styles.inviteCardIcon}>
              <FontAwesome name="star" size={20} color={theme2Colors.yellow} />
            </View>
            <View style={styles.inviteCardText}>
              <Text style={styles.inviteCardTitle}>Help with an app rating</Text>
              <Text style={styles.inviteCardSubtitle}>Rate and review Good Times on the app store</Text>
            </View>
            <FontAwesome name="chevron-right" size={16} color={theme2Colors.textSecondary} style={{ marginLeft: spacing.md }} />
          </View>
        </TouchableOpacity>

        {/* Inline Settings */}
        <View style={styles.settingRow}>
          <View style={styles.settingRowText}>
            <Text style={styles.settingRowTitle}>Notifications</Text>
            <Text style={styles.settingRowSubtitle}>Stay updated when your group shares.</Text>
          </View>
          <Switch 
            value={notificationsEnabled} 
            onValueChange={setNotificationsEnabled} 
            trackColor={{ true: theme2Colors.onboardingPink }} 
            thumbColor={Platform.OS === "android" ? theme2Colors.white : undefined}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingRowText}>
            <Text style={styles.settingRowTitle}>Daily question</Text>
            <Text style={styles.settingRowSubtitle}>Get reminder each day to share.</Text>
          </View>
          <Switch
            value={dailyQuestionNotifications}
            onValueChange={setDailyQuestionNotifications}
            trackColor={{ true: theme2Colors.onboardingPink }}
            thumbColor={Platform.OS === "android" ? theme2Colors.white : undefined}
          />
        </View>

        {/* Dark Mode Toggle */}
        <View style={styles.settingRow}>
          <View style={styles.settingRowText}>
            <Text style={styles.settingRowTitle}>Dark mode</Text>
            <Text style={styles.settingRowSubtitle}>Switch between light and dark theme.</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={(value) => setTheme(value ? "dark" : "light")}
            trackColor={{ true: theme2Colors.onboardingPink }}
            thumbColor={Platform.OS === "android" ? theme2Colors.white : undefined}
          />
        </View>

        {biometricAvailable && (
          <View style={styles.settingRow}>
            <View style={styles.settingRowText}>
              <Text style={styles.settingRowTitle}>
                Enable {biometricType === "face" ? "FaceID" : biometricType === "fingerprint" ? "TouchID" : "Biometric"}
              </Text>
              <Text style={styles.settingRowSubtitle}>Log in quickly with {biometricType === "face" ? "FaceID" : biometricType === "fingerprint" ? "TouchID" : "biometric authentication"}.</Text>
            </View>
            <Switch 
              value={biometricEnabled} 
              onValueChange={handleBiometricToggle} 
              trackColor={{ true: theme2Colors.onboardingPink }}
              thumbColor={Platform.OS === "android" ? theme2Colors.white : undefined}
            />
          </View>
        )}

        {__DEV__ && (
          <>
            <View style={styles.settingRow}>
              <View style={styles.settingRowText}>
                <Text style={styles.settingRowTitle}>Force Custom Question</Text>
                <Text style={styles.settingRowSubtitle}>Override eligibility to test custom question flow</Text>
              </View>
              <Switch
                value={devForceCustomQuestion}
                onValueChange={handleDevForceCustomQuestionToggle}
                trackColor={{ false: theme2Colors.textSecondary, true: theme2Colors.onboardingPink }}
                thumbColor={Platform.OS === "android" ? theme2Colors.white : theme2Colors.white}
              />
            </View>

            {/* Session Testing Utilities */}
            <View style={[styles.profileCard, { marginTop: spacing.md }]}>
              <View style={styles.profileCardContent}>
                <View style={styles.profileCardIcon}>
                  <FontAwesome name="bug" size={20} color={theme2Colors.white} />
                </View>
                <View style={styles.profileCardText}>
                  <Text style={styles.profileCardTitle}>Session Testing</Text>
                  <Text style={styles.profileCardSubtitle}>Dev tools for testing session management</Text>
                </View>
              </View>
            </View>

            <View style={styles.actions}>
              <Button
                title="Log Session State"
                onPress={handleLogSessionState}
                variant="secondary"
              />
              <Button
                title="Force Session Expiry"
                onPress={handleForceSessionExpiry}
                variant="secondary"
              />
              <Button
                title="Simulate Long Inactivity"
                onPress={handleSimulateInactivity}
                variant="secondary"
              />
              <Button
                title="Clear All Session Data"
                onPress={handleClearAllSessionData}
                variant="secondary"
              />
              <Button
                title="Test Password Reset Link"
                onPress={handleTestPasswordReset}
                variant="secondary"
              />
            </View>

            {/* Boot Screen Testing */}
            <View style={[styles.profileCard, { marginTop: spacing.md }]}>
              <View style={styles.profileCardContent}>
                <View style={styles.profileCardIcon}>
                  <FontAwesome name="play-circle" size={20} color={theme2Colors.white} />
                </View>
                <View style={styles.profileCardText}>
                  <Text style={styles.profileCardTitle}>Boot Screen Testing</Text>
                  <Text style={styles.profileCardSubtitle}>Test boot screen flow with different durations</Text>
                </View>
              </View>
            </View>

            <View style={styles.actions}>
              <Button
                title="Test Boot Screen (3s)"
                onPress={async () => {
                  await AsyncStorage.setItem("test_boot_screen", "3000");
                  router.replace("/");
                }}
                variant="secondary"
              />
              <Button
                title="Test Boot Screen (5s)"
                onPress={async () => {
                  await AsyncStorage.setItem("test_boot_screen", "5000");
                  router.replace("/");
                }}
                variant="secondary"
              />
              <Button
                title="Test Boot Screen (10s)"
                onPress={async () => {
                  await AsyncStorage.setItem("test_boot_screen", "10000");
                  router.replace("/");
                }}
                variant="secondary"
              />
            </View>

            {/* Onboarding Gallery */}
            <View style={[styles.profileCard, { marginTop: spacing.md }]}>
              <View style={styles.profileCardContent}>
                <View style={styles.profileCardIcon}>
                  <FontAwesome name="images" size={20} color={theme2Colors.white} />
                </View>
                <View style={styles.profileCardText}>
                  <Text style={styles.profileCardTitle}>Onboarding</Text>
                  <Text style={styles.profileCardSubtitle}>View app screenshots gallery</Text>
                </View>
              </View>
            </View>

            <View style={styles.actions}>
              <Button
                title="Onboarding"
                onPress={() => setOnboardingGalleryVisible(true)}
                variant="secondary"
              />
            </View>

            {/* App Review Modal Dev Tool */}
            <View style={[styles.profileCard, { marginTop: spacing.md }]}>
              <View style={styles.profileCardContent}>
                <View style={styles.profileCardIcon}>
                  <FontAwesome name="star" size={20} color={theme2Colors.yellow} />
                </View>
                <View style={styles.profileCardText}>
                  <Text style={styles.profileCardTitle}>App Review Modal</Text>
                  <Text style={styles.profileCardSubtitle}>Test the review modal design</Text>
                </View>
              </View>
            </View>

            <View style={styles.actions}>
              <Button
                title="Show Review Modal"
                onPress={async () => {
                  // Set flag to trigger modal on home screen
                  await AsyncStorage.setItem("dev_show_app_review_modal", "true")
                  // Navigate to home
                  router.push("/(main)/home")
                }}
                variant="secondary"
              />
            </View>

            {/* Sunday Journal Dev Tool */}
            <View style={[styles.profileCard, { marginTop: spacing.md }]}>
              <View style={styles.profileCardContent}>
                <View style={styles.profileCardIcon}>
                  <FontAwesome name="camera" size={20} color={theme2Colors.white} />
                </View>
                <View style={styles.profileCardText}>
                  <Text style={styles.profileCardTitle}>Sunday Journal</Text>
                  <Text style={styles.profileCardSubtitle}>Test the weekly photo journal prompt</Text>
                </View>
              </View>
            </View>

            <View style={styles.actions}>
              <Button
                title="Open Sunday Journal Composer"
                onPress={async () => {
                  try {
                    if (!primaryGroupId) {
                      Alert.alert("Error", "No group found. Please join a group first.")
                      return
                    }

                    // Get the Journal prompt
                    const { data: journalPrompt, error: promptError } = await supabase
                      .from("prompts")
                      .select("id")
                      .eq("category", "Journal")
                      .limit(1)
                      .maybeSingle()

                    if (promptError || !journalPrompt) {
                      Alert.alert("Error", "Journal prompt not found. Please run the migration first.")
                      return
                    }

                    const todayDate = getTodayDate()

                    // Check if daily_prompt already exists for today
                    const { data: existingPrompt } = await supabase
                      .from("daily_prompts")
                      .select("id")
                      .eq("group_id", primaryGroupId)
                      .eq("date", todayDate)
                      .is("user_id", null)
                      .maybeSingle()

                    // Create or update daily_prompt for today with Journal prompt
                    if (existingPrompt) {
                      // Update existing prompt
                      const { error: updateError } = await supabase
                        .from("daily_prompts")
                        .update({ prompt_id: journalPrompt.id })
                        .eq("id", existingPrompt.id)

                      if (updateError) {
                        console.error("[settings] Failed to update daily_prompt:", updateError)
                        Alert.alert("Error", "Failed to update Journal prompt. Please try again.")
                        return
                      }
                    } else {
                      // Create new prompt
                      const { error: insertError } = await supabase
                        .from("daily_prompts")
                        .insert({
                          group_id: primaryGroupId,
                          prompt_id: journalPrompt.id,
                          date: todayDate,
                          user_id: null, // General prompt
                        })

                      if (insertError) {
                        console.error("[settings] Failed to create daily_prompt:", insertError)
                        Alert.alert("Error", "Failed to schedule Journal prompt. Please try again.")
                        return
                      }
                    }

                    // Invalidate queries to refresh home screen
                    queryClient.invalidateQueries({ queryKey: ["dailyPrompt", primaryGroupId], exact: false })
                    queryClient.invalidateQueries({ queryKey: ["entries", primaryGroupId], exact: false })

                    // Navigate to entry composer
                    router.push({
                      pathname: "/(main)/modals/entry-composer",
                      params: {
                        promptId: journalPrompt.id,
                        date: todayDate,
                        groupId: primaryGroupId,
                        returnTo: "/(main)/home",
                      },
                    })
                  } catch (error: any) {
                    console.error("[settings] Error opening Sunday Journal composer:", error)
                    Alert.alert("Error", error.message || "Failed to open Sunday Journal composer")
                  }
                }}
                variant="secondary"
              />
            </View>
          </>
        )}

        <View style={[styles.actions, { marginTop: spacing.xl }]}>
          <TouchableOpacity style={styles.reportButton} onPress={handleReportIssue} activeOpacity={0.7}>
            <Text style={styles.reportButtonText}>Report an Issue/Feedback</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSignOut} style={styles.logoutLink}>
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
          <Text style={styles.memorialText}>
            Made in memory of our mom, Amelia.{"\n"}We do remember all the good times.
          </Text>
          <Image 
            source={require("../../assets/images/wordmark.png")} 
            style={styles.wordmark}
            resizeMode="contain"
          />
        </View>
      </ScrollView>

      {/* Onboarding Gallery Modal */}
      <OnboardingGallery
        visible={onboardingGalleryVisible}
        screenshots={[
          { id: "1", source: require("../../assets/images/onboarding-1-one-question.png") },
          { id: "2", source: require("../../assets/images/onboarding-2-your-answer.png") },
          { id: "3", source: require("../../assets/images/onboarding-video.png") },
          { id: "4", source: require("../../assets/images/onboarding-3-their-answer.png") },
          { id: "5", source: require("../../assets/images/onboarding-4-your-group.png") },
          { id: "6", source: require("../../assets/images/onboarding-5-ask-them.png") },
          { id: "7", source: require("../../assets/images/onboarding-status.png") },
          { id: "8", source: require("../../assets/images/onboarding-journal.png") },
          { id: "9", source: require("../../assets/images/onboarding-7-set-your-vibe.png") },
        ]}
        onComplete={() => setOnboardingGalleryVisible(false)}
      />
    </View>
  )
}
