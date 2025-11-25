"use client"

import { useState, useRef } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { supabase } from "../../lib/supabase"
import { colors, typography, spacing } from "../../lib/theme"
import { Input } from "../../components/Input"
import { Button } from "../../components/Button"

export default function SignUp() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const emailInputRef = useRef<any>(null)
  const passwordInputRef = useRef<any>(null)
  const confirmPasswordInputRef = useRef<any>(null)

  async function handleEmailSignUp() {
    if (!email || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields")
      return
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match")
      return
    }

    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters")
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      })

      if (error) throw error

      if (data.user) {
        // Create user profile
        const { error: profileError } = await supabase.from("users").insert({
          id: data.user.id,
          email: data.user.email!,
        })

        if (profileError) throw profileError

        // Navigate to onboarding
        router.replace("/(onboarding)/about")
      }
    } catch (error: any) {
      Alert.alert("Error", error.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignUp() {
    Alert.alert("Coming Soon", "Google sign-up will be available soon")
  }

  async function handleAppleSignUp() {
    Alert.alert("Coming Soon", "Apple sign-up will be available soon")
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
          { paddingTop: Platform.OS === "android" ? insets.top + spacing.xs : spacing.xxl * 2 }
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Start your shared story today</Text>
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
            placeholder="At least 6 characters"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password-new"
          />

          <Input
            ref={confirmPasswordInputRef}
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter your password"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password-new"
          />

          <Button title="Create Account" onPress={handleEmailSignUp} loading={loading} style={styles.button} />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          <Button title="Continue with Google" onPress={handleGoogleSignUp} variant="secondary" style={styles.button} />

          <Button title="Continue with Apple" onPress={handleAppleSignUp} variant="secondary" style={styles.button} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push("/(auth)/sign-in")}>
            <Text style={styles.footerLink}>Sign in</Text>
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
    paddingBottom: Platform.OS === "android" ? spacing.xxl * 5 : spacing.xxl * 2,
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
