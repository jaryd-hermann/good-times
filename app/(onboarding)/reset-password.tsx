"use client"

import { useState, useEffect } from "react"
import { View, Text, StyleSheet, Alert, TextInput, ImageBackground, KeyboardAvoidingView, Platform, ScrollView } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { supabase } from "../../lib/supabase"
import { colors, spacing } from "../../lib/theme"
import { Button } from "../../components/Button"
import { OnboardingBack } from "../../components/OnboardingBack"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { saveBiometricCredentials, getBiometricPreference } from "../../lib/biometric"
import * as Linking from "expo-linking"

export default function ResetPassword() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const insets = useSafeAreaInsets()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState<string | null>(null)

  // Extract token from URL hash or query params (Supabase sends it in hash)
  useEffect(() => {
    async function checkURL() {
      const url = await Linking.getInitialURL()
      if (url) {
        // Supabase sends tokens in hash fragment: goodtimes://reset-password#access_token=...&type=recovery
        const hashMatch = url.match(/#(.+)/)
        if (hashMatch) {
          const hashParams = new URLSearchParams(hashMatch[1])
          const accessToken = hashParams.get("access_token")
          const type = hashParams.get("type")
          
          if (accessToken && type === "recovery") {
            // Set the session with the recovery token
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: hashParams.get("refresh_token") || "",
            })
            
            if (error) {
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
      
      // Also check if we have a session already (in case user clicked link while app was open)
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email) {
        setEmail(session.user.email)
      }
    }
    
    checkURL()
    
    // Listen for URL changes (when app is already open)
    const subscription = Linking.addEventListener("url", async (event) => {
      const url = event.url
      if (url.includes("reset-password")) {
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

  return (
    <ImageBackground
      source={require("../../assets/images/auth-bg.png")}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
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
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  secureTextEntry
                  autoCapitalize="none"
                  style={styles.fieldInput}
                  editable={!loading}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Confirm Password</Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="••••••••"
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  secureTextEntry
                  autoCapitalize="none"
                  style={styles.fieldInput}
                  editable={!loading}
                />
              </View>

              <Button
                title="Reset Password"
                onPress={handleReset}
                loading={loading}
                style={styles.primaryButton}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
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
    fontFamily: "LibreBaskerville-Bold",
    fontSize: 40,
    color: colors.white,
  },
  subtitle: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    lineHeight: 24,
    color: colors.white,
    opacity: 0.9,
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  fieldInput: {
    fontFamily: "LibreBaskerville-Regular",
    fontSize: 24,
    color: colors.white,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    paddingVertical: spacing.sm,
  },
  primaryButton: {
    minHeight: 56,
  },
})

