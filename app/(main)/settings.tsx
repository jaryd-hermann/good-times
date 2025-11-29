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
import {
  isBiometricAvailable,
  getBiometricType,
  getBiometricPreference,
  saveBiometricPreference,
  authenticateWithBiometric,
} from "../../lib/biometric"
import { clearAllAuthState } from "../../lib/dev-auth-reset"

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

    router.push({
      pathname: "/(onboarding)/create-group/invite",
      params: { groupId: primaryGroupId },
    })
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
    try {
      // Get current user ID before signing out
      const {
        data: { user },
      } = await supabase.auth.getUser()
      
      // Clear biometric credentials on sign out
      const { clearBiometricCredentials } = await import("../../lib/biometric")
      await clearBiometricCredentials()
      
      // Clear user-specific onboarding flag
      if (user) {
        const onboardingKey = `has_completed_post_auth_onboarding_${user.id}`
        await AsyncStorage.removeItem(onboardingKey)
      }
      
      await supabase.auth.signOut()
      await queryClient.invalidateQueries()
      router.replace("/(onboarding)/welcome-1")
    } catch (error: any) {
      Alert.alert("Error", error.message)
    }
  }

  function handleReportIssue() {
    router.push("/(main)/feedback")
  }

  async function handleDevForceCustomQuestionToggle(value: boolean) {
    setDevForceCustomQuestion(value)
    await AsyncStorage.setItem("dev_force_custom_question", value ? "true" : "false")
  }

  async function handleDevReset() {
    Alert.alert(
      "🧹 Clear All Auth State",
      "This will clear all authentication data, sessions, and onboarding flags. The app will need to be restarted.\n\nThis is for testing only.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear & Restart",
          style: "destructive",
          onPress: async () => {
            try {
              await clearAllAuthState()
              Alert.alert(
                "✅ Cleared",
                "All auth state cleared. Please restart the app manually.",
                [{ text: "OK" }]
              )
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to clear auth state")
            }
          },
        },
      ]
    )
  }

  // Create dynamic styles based on theme
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.black,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    closeButton: {
      padding: spacing.sm,
    },
    closeText: {
      ...typography.h2,
      color: colors.white,
    },
    title: {
      ...typography.h1,
      color: colors.white,
      fontSize: 32,
    },
    content: {
      padding: spacing.md,
      paddingBottom: spacing.xxl,
    },
    profileCard: {
      backgroundColor: colors.gray[900],
      borderRadius: 16,
      overflow: "hidden",
      marginBottom: spacing.md,
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
    },
    profileCardText: {
      flex: 1,
    },
    profileCardTitle: {
      ...typography.bodyBold,
      fontSize: 16,
      color: colors.white,
    },
    profileCardSubtitle: {
      ...typography.caption,
      color: colors.gray[400],
      fontSize: 13,
    },
    settingRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.gray[800],
    },
    settingRowText: {
      flex: 1,
    },
    settingRowTitle: {
      ...typography.bodyBold,
      fontSize: 16,
      color: colors.white,
    },
    settingRowSubtitle: {
      ...typography.body,
      color: colors.gray[400],
      fontSize: 14,
      marginTop: spacing.xs,
    },
    actions: {
      gap: spacing.md,
    },
    logoutLink: {
      alignSelf: "center",
      paddingVertical: spacing.xs,
    },
    logoutText: {
      ...typography.bodyMedium,
      color: colors.gray[300],
    },
    wordmark: {
      width: 120,
      height: 40,
      marginTop: spacing.md,
      alignSelf: "center",
      opacity: 0.6,
    },
    memorialText: {
      ...typography.caption,
      color: isDark ? colors.gray[600] : "#000000",
      textAlign: "center",
      marginTop: spacing.md,
      fontSize: 11,
      fontStyle: "italic",
    },
  }), [colors, isDark])

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Card */}
        <TouchableOpacity style={styles.profileCard} onPress={handleProfilePress} activeOpacity={0.7}>
          <View style={styles.profileCardContent}>
            <View style={styles.profileCardIcon}>
              {profile?.avatar_url ? (
                <Avatar uri={profile.avatar_url} name={profile.name || "User"} size={40} />
              ) : (
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.gray[800], justifyContent: "center", alignItems: "center" }}>
                  <FontAwesome name="user" size={20} color={colors.gray[400]} />
                </View>
              )}
            </View>
            <View style={styles.profileCardText}>
              <Text style={styles.profileCardTitle}>{profile?.name || "User"}</Text>
              <Text style={styles.profileCardSubtitle}>Edit profile</Text>
            </View>
            <FontAwesome name="chevron-right" size={16} color={colors.gray[500]} style={{ marginLeft: spacing.md }} />
          </View>
        </TouchableOpacity>

        {/* Latest Changes Card */}
        <TouchableOpacity 
          style={styles.profileCard} 
          onPress={() => router.push("/(main)/settings/latest-changes")} 
          activeOpacity={0.7}
        >
          <View style={styles.profileCardContent}>
            <View style={styles.profileCardIcon}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.gray[800], justifyContent: "center", alignItems: "center" }}>
                <FontAwesome name="bell" size={20} color={colors.gray[400]} />
              </View>
            </View>
            <View style={styles.profileCardText}>
              <Text style={styles.profileCardTitle}>Latest changes</Text>
              <Text style={styles.profileCardSubtitle}>New good things</Text>
            </View>
            <FontAwesome name="chevron-right" size={16} color={colors.gray[500]} style={{ marginLeft: spacing.md }} />
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
            trackColor={{ true: colors.accent }} 
            thumbColor={Platform.OS === "android" ? (isDark ? colors.white : colors.black) : undefined}
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
            trackColor={{ true: colors.accent }}
            thumbColor={Platform.OS === "android" ? (isDark ? colors.white : colors.black) : undefined}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingRowText}>
            <Text style={styles.settingRowTitle}>Theme</Text>
            <Text style={styles.settingRowSubtitle}>{theme === "dark" ? "Dark mode" : "Light mode"}</Text>
          </View>
          <Switch 
            value={theme === "light"} 
            onValueChange={(value) => {
              const newTheme = value ? "light" : "dark"
              const oldTheme = theme
              setTheme(newTheme)
              
              // Track changed_app_theme event
              try {
                if (posthog) {
                  posthog.capture("changed_app_theme", {
                    from_theme: oldTheme,
                    to_theme: newTheme,
                  })
                } else {
                  captureEvent("changed_app_theme", {
                    from_theme: oldTheme,
                    to_theme: newTheme,
                  })
                }
              } catch (error) {
                if (__DEV__) console.error("[settings] Failed to track changed_app_theme:", error)
              }
            }} 
            trackColor={{ true: colors.accent }}
            thumbColor={Platform.OS === "android" ? (isDark ? colors.white : colors.black) : undefined}
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
              trackColor={{ true: colors.accent }}
              thumbColor={Platform.OS === "android" ? (isDark ? colors.white : colors.black) : undefined}
            />
          </View>
        )}

        {__DEV__ && (
          <View style={styles.settingRow}>
            <View style={styles.settingRowText}>
              <Text style={styles.settingRowTitle}>Force Custom Question</Text>
              <Text style={styles.settingRowSubtitle}>Override eligibility to test custom question flow</Text>
            </View>
            <Switch
              value={devForceCustomQuestion}
              onValueChange={handleDevForceCustomQuestionToggle}
              trackColor={{ false: colors.gray[700], true: colors.accent }}
              thumbColor={Platform.OS === "android" ? (isDark ? colors.white : colors.black) : colors.white}
            />
          </View>
        )}

        <View style={styles.actions}>
          <Button title="Invite your group" onPress={handleInvite} variant="secondary" />
          <Button
            title="Report an Issue/Feedback"
            onPress={handleReportIssue}
            variant="primary"
          />
          <TouchableOpacity onPress={handleSignOut} style={styles.logoutLink}>
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
          {__DEV__ && (
            <TouchableOpacity onPress={handleDevReset} style={[styles.logoutLink, { marginTop: spacing.md }]}>
              <Text style={[styles.logoutText, { color: colors.accent, fontSize: 12 }]}>
                🧹 DEV: Clear All Auth State
              </Text>
            </TouchableOpacity>
          )}
          <Text style={styles.memorialText}>Made in memory of our mom, Amelia. We do remember all the good times.</Text>
          <Image 
            source={require("../../assets/images/wordmark.png")} 
            style={styles.wordmark}
            resizeMode="contain"
          />
        </View>
      </ScrollView>
    </View>
  )
}
