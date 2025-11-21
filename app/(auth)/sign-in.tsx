"use client"

import { useState } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native"
import { useRouter } from "expo-router"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { supabase } from "../../lib/supabase"
import { colors, typography, spacing } from "../../lib/theme"
import { Input } from "../../components/Input"
import { Button } from "../../components/Button"

export default function SignIn() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

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

      // Check if user has completed profile
      const { data: user } = await supabase.from("users").select("name, birthday").eq("id", data.user.id).single()

      if (user?.name && user?.birthday) {
        // Check if user is in a group
        const { data: membership } = await supabase
          .from("group_members")
          .select("group_id")
          .eq("user_id", data.user.id)
          .limit(1)
          .single()

        if (membership) {
          // Check if this is a NEW user (created within last 10 minutes)
          // Only show welcome-post-auth to newly registered users, not existing users logging in
          const userCreatedAt = new Date(data.user.created_at)
          const now = new Date()
          const minutesSinceCreation = (now.getTime() - userCreatedAt.getTime()) / (1000 * 60)
          const isNewUser = minutesSinceCreation < 10 // User created within last 10 minutes
          
          if (isNewUser) {
            // Check if user has completed post-auth onboarding
            const onboardingKey = `has_completed_post_auth_onboarding_${data.user.id}`
            const hasCompletedPostAuth = await AsyncStorage.getItem(onboardingKey)
            if (!hasCompletedPostAuth) {
              router.replace("/(onboarding)/welcome-post-auth")
            } else {
              router.replace("/(main)/home")
            }
          } else {
            // Existing user - skip welcome-post-auth and go straight to home
            router.replace("/(main)/home")
          }
        } else {
          router.replace("/(onboarding)/create-group/name-type")
        }
      } else {
        router.replace("/(onboarding)/about")
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to continue your story</Text>
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
