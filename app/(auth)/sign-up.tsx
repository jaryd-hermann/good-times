"use client"

import { useState } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native"
import { useRouter } from "expo-router"
import { supabase } from "../../lib/supabase"
import { colors, typography, spacing } from "../../lib/theme"
import { Input } from "../../components/Input"
import { Button } from "../../components/Button"

export default function SignUp() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Start your shared story today</Text>
      </View>

      <View style={styles.form}>
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="your@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />

        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="At least 6 characters"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password-new"
        />

        <Input
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
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xxl * 2,
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
