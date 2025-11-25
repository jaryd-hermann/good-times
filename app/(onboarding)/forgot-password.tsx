"use client"

import { useState } from "react"
import { View, Text, StyleSheet, Alert, TextInput, KeyboardAvoidingView, Platform, ScrollView } from "react-native"
import { useRouter } from "expo-router"
import { supabase } from "../../lib/supabase"
import { colors, spacing } from "../../lib/theme"
import { Button } from "../../components/Button"
import { OnboardingBack } from "../../components/OnboardingBack"
import { useSafeAreaInsets } from "react-native-safe-area-context"

export default function ForgotPassword() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

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
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: "goodtimes://reset-password",
      })

      if (error) {
        throw error
      }

      setSent(true)
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to send reset email. Please try again.")
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
})

