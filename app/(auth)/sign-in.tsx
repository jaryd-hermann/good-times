"use client"

import { useState, useRef, useMemo, useEffect } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { supabase } from "../../lib/supabase"
import { colors, typography, spacing } from "../../lib/theme"
import { Input } from "../../components/Input"
import { Button } from "../../components/Button"
import { usePostHog } from "posthog-react-native"
import { captureEvent, identifyUser } from "../../lib/posthog"
import {
  isBiometricAvailable,
  getBiometricPreference,
  getBiometricRefreshToken,
  getBiometricUserId,
  authenticateWithBiometric,
  clearBiometricCredentials,
} from "../../lib/biometric"

export default function SignIn() {
  console.log("[sign-in] Component rendering - TOP OF FUNCTION")
  const router = useRouter()
  const insets = useSafeAreaInsets()
  console.log("[sign-in] After hooks, Platform:", Platform.OS, "insets.top:", insets.top)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [biometricAttempted, setBiometricAttempted] = useState(false)
  const posthog = usePostHog()
  const emailInputRef = useRef<any>(null)
  const passwordInputRef = useRef<any>(null)

  // Phase 4: FaceID should trigger at login screens
  // Attempt biometric login when screen mounts (if enabled)
  useEffect(() => {
    async function attemptBiometricLogin() {
      // Only attempt once per mount
      if (biometricAttempted) return
      
      try {
        // Check if biometric is available and enabled
        const biometricAvailable = await isBiometricAvailable()
        if (!biometricAvailable) {
          setBiometricAttempted(true)
          return
        }

        const biometricEnabled = await getBiometricPreference()
        if (!biometricEnabled) {
          setBiometricAttempted(true)
          return
        }

        // Check if we have stored credentials
        const refreshToken = await getBiometricRefreshToken()
        const userId = await getBiometricUserId()
        if (!refreshToken || !userId) {
          setBiometricAttempted(true)
          return
        }

        setBiometricAttempted(true)

        // Attempt biometric authentication
        const authResult = await authenticateWithBiometric("Authenticate to log in")
        if (!authResult.success) {
          // User cancelled or failed - allow manual login
          return
        }

        // Use refresh token to get new session
        const { data, error } = await supabase.auth.refreshSession({
          refresh_token: refreshToken,
        })

        if (error || !data.session) {
          console.warn("[sign-in] Failed to refresh session with biometric:", error)
          // Clear invalid credentials
          await clearBiometricCredentials()
          return
        }

        // Successfully authenticated - navigate to home
        // Check if user has completed profile
        const { data: user } = await supabase.from("users").select("name, birthday").eq("id", data.session.user.id).single()

        if ((user as any)?.name && (user as any)?.birthday) {
          // Check if user is in a group
          const { data: membership } = await supabase
            .from("group_members")
            .select("group_id")
            .eq("user_id", data.session.user.id)
            .limit(1)
            .maybeSingle()

          if (membership) {
            router.replace("/(main)/home")
          } else {
            router.replace("/(onboarding)/create-group/name-type")
          }
        } else {
          router.replace("/(onboarding)/about")
        }
      } catch (error) {
        // Silently fail - user can still log in manually
        console.warn("[sign-in] Biometric login error:", error)
        setBiometricAttempted(true)
      }
    }

    // Attempt biometric login after a short delay to allow screen to render
    const timeout = setTimeout(() => {
      attemptBiometricLogin()
    }, 500)

    return () => clearTimeout(timeout)
  }, [router, biometricAttempted])

  async function handleEmailSignIn() {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password")
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) throw error

      // Track signed_in event and identify user in PostHog
      try {
        const userId = data.user.id
        if (posthog) {
          posthog.capture("signed_in")
          posthog.identify(userId)
        } else {
          captureEvent("signed_in")
          identifyUser(userId)
        }
      } catch (error) {
        // Never let PostHog errors affect sign-in
        if (__DEV__) console.error("[sign-in] Failed to track signed_in:", error)
      }

      // Phase 7: Add navigation success check and fallback
      const navigateToRoute = async (route: string) => {
        try {
          router.replace(route as any)
          
          // Check if navigation succeeded after a short delay
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          // If navigation failed, try again with explicit navigation
          // Note: We can't directly check if navigation succeeded, so we rely on timeout fallback
          setTimeout(() => {
            router.replace(route as any)
          }, 2000)
        } catch (error) {
          console.error("[sign-in] Navigation error:", error)
          // Fallback: try again
          router.replace(route as any)
        }
      }

      // Check if user has completed profile
      const { data: user } = await supabase.from("users").select("name, birthday").eq("id", data.user.id).single()

      if ((user as any)?.name && (user as any)?.birthday) {
        // Check if user is in a group
        const { data: membership } = await supabase
          .from("group_members")
          .select("group_id")
          .eq("user_id", data.user.id)
          .limit(1)
          .maybeSingle()

        if (membership) {
          // Sign-in should ALWAYS go to home - never show onboarding screens
          // Onboarding screens are only shown during registration flow
          await navigateToRoute("/(main)/home")
        } else {
          await navigateToRoute("/(onboarding)/create-group/name-type")
        }
      } else {
        await navigateToRoute("/(onboarding)/about")
      }
    } catch (error: any) {
      Alert.alert("Error", error.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    Alert.alert("Coming Soon", "Google sign-in will be available soon")
  }

  async function handleAppleSignIn() {
    Alert.alert("Coming Soon", "Apple sign-in will be available soon")
  }

  const androidPaddingTop = Platform.OS === "android" ? insets.top + spacing.xs : spacing.xxl * 2
  console.log("[sign-in] Platform:", Platform.OS, "paddingTop:", androidPaddingTop, "insets.top:", insets.top)
  
  try {
    console.log("[sign-in] styles.content:", styles.content)
  } catch (e) {
    console.error("[sign-in] Error accessing styles:", e)
  }
  
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
      enabled={Platform.OS === "ios"}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: androidPaddingTop }
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[
          styles.header,
          Platform.OS === "android" && { backgroundColor: "red", padding: 20 } // TEST: Make Android header visible
        ]}>
          <Text style={styles.title}>ANDROID TEST - Welcome back</Text>
          <Text style={styles.subtitle}>TEST SUBTITLE - Sign in to continue your story</Text>
        </View>

        <View style={styles.form}>
          <Input
            ref={emailInputRef}
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <Input
            ref={passwordInputRef}
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
          />

          <Button title="Sign In" onPress={handleEmailSignIn} loading={loading} style={styles.button} />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          <Button title="Continue with Google" onPress={handleGoogleSignIn} variant="secondary" style={styles.button} />

          <Button title="Continue with Apple" onPress={handleAppleSignIn} variant="secondary" style={styles.button} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push("/(auth)/sign-up")}>
            <Text style={styles.footerLink}>Sign up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingLeft: spacing.lg,
    paddingRight: spacing.lg,
    paddingBottom: Platform.OS === "android" ? spacing.xxl * 4 : spacing.xxl * 2,
    // paddingTop is set inline at runtime (not in StyleSheet) to properly handle platform differences
    flexGrow: 1,
  },
  header: {
    marginBottom: spacing.xxl,
  },
  title: {
    ...typography.h1,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.gray[400],
  },
  form: {
    marginBottom: spacing.xl,
  },
  button: {
    marginTop: spacing.md,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gray[700],
  },
  dividerText: {
    ...typography.caption,
    marginHorizontal: spacing.md,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    ...typography.body,
    color: colors.gray[400],
  },
  footerLink: {
    ...typography.bodyBold,
    color: colors.accent,
  },
})
