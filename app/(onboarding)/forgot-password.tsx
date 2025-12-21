"use client"

import { useState, useEffect } from "react"
import { View, Text, StyleSheet, Alert, TextInput, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { supabase } from "../../lib/supabase"
import { colors, spacing } from "../../lib/theme"
import { Button } from "../../components/Button"
import { OnboardingBack } from "../../components/OnboardingBack"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import * as Linking from "expo-linking"

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

export default function ForgotPassword() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const insets = useSafeAreaInsets()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [emailFocused, setEmailFocused] = useState(false)
  
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
                      placeholderTextColor={theme2Colors.textSecondary}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      keyboardAppearance="light"
                      style={[
                        styles.fieldInput,
                        emailFocused && styles.fieldInputFocused
                      ]}
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                      editable={!loading}
                    />
                  </View>

                  <TouchableOpacity
                    onPress={handleSend}
                    disabled={loading}
                    style={styles.primaryButton}
                  >
                    {loading ? (
                      <Text style={styles.primaryButtonText}>Sending...</Text>
                    ) : (
                      <Text style={styles.primaryButtonText}>Send Reset Link</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.successContainer}>
                  <Text style={styles.successTitle}>Check your inbox</Text>
                  <Text style={styles.successText}>
                    We've sent a password reset link to {email.trim()}. Click the link in the email to reset your password.
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryButtonText}>Back to Sign In</Text>
                  </TouchableOpacity>
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
  fieldInput: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    color: theme2Colors.text,
    backgroundColor: theme2Colors.cream,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme2Colors.textSecondary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  fieldInputFocused: {
    borderColor: theme2Colors.blue,
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
  successContainer: {
    gap: spacing.md,
  },
  successTitle: {
    fontFamily: "PMGothicLudington-Text115",
    fontSize: 32,
    color: theme2Colors.text,
  },
  successText: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    lineHeight: 24,
    color: theme2Colors.textSecondary,
  },
  errorContainer: {
    backgroundColor: theme2Colors.cream,
    borderWidth: 2,
    borderColor: theme2Colors.red,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    fontFamily: "Roboto-Medium",
    fontSize: 16,
    color: theme2Colors.red,
    marginBottom: spacing.xs,
  },
  errorSubtext: {
    fontFamily: "Roboto-Regular",
    fontSize: 14,
    color: theme2Colors.textSecondary,
  },
})

