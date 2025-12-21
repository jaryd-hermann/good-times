"use client"

import { useState, useEffect } from "react"
import { View, Text, StyleSheet, Alert, TextInput, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { supabase } from "../../lib/supabase"
import { colors, spacing } from "../../lib/theme"
import { Button } from "../../components/Button"
import { OnboardingBack } from "../../components/OnboardingBack"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { saveBiometricCredentials, getBiometricPreference } from "../../lib/biometric"
import * as Linking from "expo-linking"
import AsyncStorage from "@react-native-async-storage/async-storage"

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
}

export default function ResetPassword() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const insets = useSafeAreaInsets()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(true)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false)

  // Extract token from URL hash or query params (Supabase sends it in hash)
  // NOTE: _layout.tsx already sets the session before navigating here, but we need to wait for it
  useEffect(() => {
    async function checkSession() {
      console.log("[reset-password] Checking for existing session...")
      
      // Wait a bit for _layout.tsx to finish setting the session
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Check if we have a session (set by _layout.tsx)
      let session = null
      let retries = 3
      
      while (retries > 0 && !session) {
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error("[reset-password] Error getting session:", sessionError)
        }
        
        if (currentSession) {
          session = currentSession
          break
        }
        
        console.log(`[reset-password] No session found, retrying... (${retries} attempts left)`)
        retries--
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      }
      
      if (session?.user?.email) {
        console.log("[reset-password] Found session with email:", session.user.email)
        setEmail(session.user.email)
        // Clear the backup email from AsyncStorage
        await AsyncStorage.removeItem("password_reset_email")
        return
      }
      
      // Fallback 1: Check AsyncStorage for email stored by _layout.tsx
      console.warn("[reset-password] No session found after retries, checking AsyncStorage for email...")
      try {
        const storedEmail = await AsyncStorage.getItem("password_reset_email")
        if (storedEmail) {
          console.log("[reset-password] Found email in AsyncStorage:", storedEmail)
          setEmail(storedEmail)
          // Keep it in storage in case we need it later, but proceed with reset
          return
        }
      } catch (e) {
        console.warn("[reset-password] Failed to read AsyncStorage:", e)
      }
      
      // Fallback 2: Check URL if session wasn't set by _layout.tsx (e.g., app was already open)
      console.warn("[reset-password] No email in AsyncStorage, checking URL for tokens...")
      const url = await Linking.getInitialURL()
      if (url && url.includes("reset-password")) {
        const hashMatch = url.match(/#(.+)/)
        if (hashMatch) {
          const hashParams = new URLSearchParams(hashMatch[1])
          const accessToken = hashParams.get("access_token")
          const type = hashParams.get("type")
          
          // Only set session if we have tokens and no existing session
          if (accessToken && type === "recovery") {
            console.log("[reset-password] Setting session from URL tokens...")
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: hashParams.get("refresh_token") || "",
            })
            
            if (error) {
              console.error("[reset-password] Failed to set session:", error)
              Alert.alert("Error", "Invalid or expired reset link. Please request a new one.")
              router.replace("/(onboarding)/forgot-password")
              return
            }
            
            if (data.session?.user?.email) {
              setEmail(data.session.user.email)
              await AsyncStorage.removeItem("password_reset_email")
              return
            }
          }
        }
      }
      
      // No URL, no session, and no stored email - navigate back
      console.warn("[reset-password] No URL, no session, and no stored email after all attempts, navigating to forgot-password")
      setIsChecking(false)
      Alert.alert("Error", "Invalid or expired reset link. Please request a new one.")
      router.replace("/(onboarding)/forgot-password")
      return
    }
    
    setIsChecking(false)
    checkSession()
    
    // Listen for URL changes (when app is already open)
    const subscription = Linking.addEventListener("url", async (event) => {
      const url = event.url
      if (url.includes("reset-password")) {
        console.log("[reset-password] URL change detected:", url)
        // Check session first - _layout.tsx might have already set it
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.email) {
          setEmail(session.user.email)
          return
        }
        
        // Fallback: try to set session from URL
        const hashMatch = url.match(/#(.+)/)
        if (hashMatch) {
          const hashParams = new URLSearchParams(hashMatch[1])
          const accessToken = hashParams.get("access_token")
          const type = hashParams.get("type")
          
          if (accessToken && type === "recovery") {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: hashParams.get("refresh_token") || "",
            })
            
            if (error) {
              console.error("[reset-password] Failed to set session from URL change:", error)
              Alert.alert("Error", "Invalid or expired reset link. Please request a new one.")
              router.replace("/(onboarding)/forgot-password")
              return
            }
            
            if (data.session?.user?.email) {
              setEmail(data.session.user.email)
            }
          }
        }
      }
    })
    
    return () => {
      subscription.remove()
    }
  }, [router])

  async function handleReset() {
    if (!password || !confirmPassword) {
      Alert.alert("Error", "Please enter and confirm your new password")
      return
    }

    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters long")
      return
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords don't match. Please try again.")
      return
    }

    setLoading(true)
    try {
      // Update password using Supabase
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) {
        throw error
      }

      // After password reset, sign in automatically
      if (email) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        })

        if (signInError) {
          // If auto-login fails, redirect to sign in
          Alert.alert("Password Reset", "Your password has been reset. Please sign in with your new password.")
          router.replace("/(onboarding)/auth")
          return
        }

        if (signInData.session) {
          // Save biometric credentials if enabled
          const biometricEnabled = await getBiometricPreference()
          if (biometricEnabled && signInData.session.refresh_token) {
            try {
              await saveBiometricCredentials(signInData.session.refresh_token, signInData.session.user.id)
            } catch (error) {
              console.warn("[reset-password] failed to save biometric credentials:", error)
            }
          }

          // Check if user has profile and group (same logic as auth.tsx)
          const { data: user } = await supabase
            .from("users")
            .select("name, birthday")
            .eq("id", signInData.session.user.id)
            .maybeSingle()

          if (user?.name && user?.birthday) {
            // Existing user - check if they have a group
            const { data: membership } = await supabase
              .from("group_members")
              .select("group_id")
              .eq("user_id", signInData.session.user.id)
              .limit(1)
              .maybeSingle()

            if (membership) {
              // Existing user with group - go to home
              router.replace("/(main)/home")
            } else {
              // Existing user without group
              router.replace("/(onboarding)/create-group/name-type")
            }
          } else {
            // New user or incomplete profile
            router.replace("/(onboarding)/about")
          }
        }
      } else {
        // No email available, redirect to sign in
        Alert.alert("Password Reset", "Your password has been reset. Please sign in with your new password.")
        router.replace("/(onboarding)/auth")
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to reset password. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // Don't render if we're still checking or if we don't have an email
  if (isChecking || !email) {
    return (
      <View style={styles.background}>
        <View style={[styles.container, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl, justifyContent: "center", alignItems: "center" }]}>
          <Text style={[styles.title, { color: theme2Colors.text }]}>Loading...</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.background}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.container,
              { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
            ]}
          >
            <View style={styles.topBar}>
              <OnboardingBack />
            </View>

            <View style={styles.content}>
              <Text style={styles.title}>Reset Password</Text>
              <Text style={styles.subtitle}>
                Enter your new password below. It must be at least 6 characters long.
              </Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>New Password</Text>
                <View style={[
                  styles.passwordContainer,
                  passwordFocused && styles.passwordContainerFocused
                ]}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor={theme2Colors.textSecondary}
                    secureTextEntry
                    autoCapitalize="none"
                    keyboardAppearance="light"
                    style={styles.passwordInput}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    editable={!loading}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Confirm Password</Text>
                <View style={[
                  styles.passwordContainer,
                  confirmPasswordFocused && styles.passwordContainerFocused
                ]}>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="••••••••"
                    placeholderTextColor={theme2Colors.textSecondary}
                    secureTextEntry
                    autoCapitalize="none"
                    keyboardAppearance="light"
                    style={styles.passwordInput}
                    onFocus={() => setConfirmPasswordFocused(true)}
                    onBlur={() => setConfirmPasswordFocused(false)}
                    editable={!loading}
                  />
                </View>
              </View>

              <TouchableOpacity
                onPress={handleReset}
                disabled={loading}
                style={styles.primaryButton}
              >
                {loading ? (
                  <Text style={styles.primaryButtonText}>Resetting...</Text>
                ) : (
                  <Text style={styles.primaryButtonText}>Reset Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: theme2Colors.beige,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: "flex-end",
  },
  topBar: {
    position: "absolute",
    top: spacing.xl + spacing.sm,
    left: spacing.lg,
  },
  content: {
    gap: spacing.lg,
    maxWidth: 460,
  },
  title: {
    fontFamily: "PMGothicLudington-Text115",
    fontSize: 32,
    color: theme2Colors.text,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    lineHeight: 24,
    color: theme2Colors.textSecondary,
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontFamily: "Roboto-Regular",
    fontSize: 14,
    color: theme2Colors.text,
    marginBottom: spacing.xs,
    fontWeight: "600",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme2Colors.cream,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme2Colors.textSecondary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  passwordContainerFocused: {
    borderColor: theme2Colors.blue,
  },
  passwordInput: {
    flex: 1,
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    color: theme2Colors.text,
  },
  primaryButton: {
    backgroundColor: theme2Colors.onboardingPink,
    borderRadius: 25,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
  },
  primaryButtonText: {
    fontFamily: "Roboto-Bold",
    fontSize: 18,
    color: theme2Colors.white,
  },
})

