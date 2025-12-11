"use client"

import { useState, useEffect } from "react"
import { View, Text, StyleSheet, Alert, TextInput, KeyboardAvoidingView, Platform, ScrollView } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { supabase } from "../../lib/supabase"
import { colors, spacing } from "../../lib/theme"
import { Button } from "../../components/Button"
import { OnboardingBack } from "../../components/OnboardingBack"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import * as Linking from "expo-linking"

export default function ForgotPassword() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const insets = useSafeAreaInsets()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  // Check for error in URL (expired/invalid reset link)
  useEffect(() => {
    async function checkURL() {
      const url = await Linking.getInitialURL()
      if (url) {
        const errorMatch = url.match(/[#&]error=([^&]+)/)
        const errorCodeMatch = url.match(/[#&]error_code=([^&]+)/)
        const errorDescriptionMatch = url.match(/[#&]error_description=([^&]+)/)
        
        if (errorCodeMatch && errorCodeMatch[1] === "otp_expired") {
          const errorDescription = errorDescriptionMatch 
            ? decodeURIComponent(errorDescriptionMatch[1].replace(/\+/g, " "))
            : "Email link is invalid or has expired"
          setErrorMessage(errorDescription)
        }
      }
    }
    checkURL()
    
    // Also listen for URL changes
    const subscription = Linking.addEventListener("url", (event) => {
      const url = event.url
      const errorCodeMatch = url.match(/[#&]error_code=([^&]+)/)
      const errorDescriptionMatch = url.match(/[#&]error_description=([^&]+)/)
      
      if (errorCodeMatch && errorCodeMatch[1] === "otp_expired") {
        const errorDescription = errorDescriptionMatch 
          ? decodeURIComponent(errorDescriptionMatch[1].replace(/\+/g, " "))
          : "Email link is invalid or has expired"
        setErrorMessage(errorDescription)
      }
    })
    
    return () => subscription.remove()
  }, [])

  async function handleSend() {
    if (!email.trim()) {
      Alert.alert("Error", "Please enter your email address")
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      Alert.alert("Error", "Please enter a valid email address")
      return
    }

    setLoading(true)
    setErrorMessage(null) // Clear any previous errors
    try {
      console.log("[forgot-password] Requesting password reset for:", email.trim())
      // Use base scheme only - let the app handle routing based on tokens/errors
      // This might work better with Supabase's validation
      const redirectUrl = "goodtimes://"
      console.log("[forgot-password] Using redirect URL:", redirectUrl)
      const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl,
        // Note: Supabase will redirect to this URL with tokens in hash fragment
        // Format: goodtimes://#access_token=...&type=recovery&refresh_token=...
        // Or with errors: goodtimes://#error=...&error_code=...
        // The app will detect type=recovery and route to reset-password screen
      })

      if (error) {
        console.error("[forgot-password] Error requesting password reset:", error)
        throw error
      }

      console.log("[forgot-password] Password reset email sent successfully")
      setSent(true)
    } catch (error: any) {
      const errorMsg = error.message || "Failed to send reset email. Please try again."
      setErrorMessage(errorMsg)
      Alert.alert("Error", errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.background}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "padding"}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === "android" ? -40 : 0}
        enabled={true}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.container,
              { 
                paddingTop: Platform.OS === "android" ? insets.top + spacing.xs : insets.top + spacing.xl, 
                paddingBottom: insets.bottom + spacing.xl 
              },
            ]}
          >
            <View style={styles.topBar}>
              <OnboardingBack />
            </View>

            <View style={styles.content}>
              {!sent ? (
                <>
                  <Text style={styles.title}>Forgot Password</Text>
                  <Text style={styles.subtitle}>
                    Enter your email address and we'll send you a link to reset your password.
                  </Text>
                  
                  {errorMessage && (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{errorMessage}</Text>
                      <Text style={styles.errorSubtext}>Please request a new reset link.</Text>
                    </View>
                  )}

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Email</Text>
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder="you@email.com"
                      placeholderTextColor="rgba(255,255,255,0.6)"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      style={styles.fieldInput}
                      editable={!loading}
                    />
                  </View>

                  <Button
                    title="Send Reset Link"
                    onPress={handleSend}
                    loading={loading}
                    style={styles.primaryButton}
                  />
                </>
              ) : (
                <View style={styles.successContainer}>
                  <Text style={styles.successTitle}>Check your inbox</Text>
                  <Text style={styles.successText}>
                    We've sent a password reset link to {email.trim()}. Click the link in the email to reset your password.
                  </Text>
                  <Button
                    title="Back to Sign In"
                    onPress={() => router.back()}
                    style={styles.primaryButton}
                  />
                </View>
              )}
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
    backgroundColor: colors.black,
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
  successContainer: {
    gap: spacing.md,
  },
  successTitle: {
    fontFamily: "LibreBaskerville-Bold",
    fontSize: 32,
    color: colors.white,
  },
  successText: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    lineHeight: 24,
    color: colors.white,
    opacity: 0.9,
  },
  errorContainer: {
    backgroundColor: "rgba(222, 47, 8, 0.1)",
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    fontFamily: "Roboto-Medium",
    fontSize: 16,
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  errorSubtext: {
    fontFamily: "Roboto-Regular",
    fontSize: 14,
    color: colors.white,
    opacity: 0.8,
  },
})

