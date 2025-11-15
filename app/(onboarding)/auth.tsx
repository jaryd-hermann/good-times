"use client"

import { useCallback, useEffect, useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TextInput,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import * as Linking from "expo-linking"
import { useRouter } from "expo-router"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { supabase } from "../../lib/supabase"
import { colors, spacing } from "../../lib/theme"
import { Button } from "../../components/Button"
import { OnboardingBack } from "../../components/OnboardingBack"
import { useOnboarding } from "../../components/OnboardingProvider"
import { createGroup, createMemorial } from "../../lib/db"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { saveBiometricCredentials, getBiometricPreference } from "../../lib/biometric"

type OAuthProvider = "google" | "apple"

export default function OnboardingAuth() {
  const router = useRouter()
  const { data, clear, setUserEmail } = useOnboarding()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [continueLoading, setContinueLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null)
  const [persisting, setPersisting] = useState(false)
  const insets = useSafeAreaInsets()

  const persistOnboarding = useCallback(
    async (userId: string) => {
      if (persisting) return
      if (!data.groupName || !data.groupType) return

      setPersisting(true)
      try {
        const birthday = data.userBirthday ? data.userBirthday.toISOString().split("T")[0] : null
        const {
          data: { session },
        } = await supabase.auth.getSession()

        const emailFromSession = data.userEmail ?? session?.user?.email
        if (!emailFromSession) {
          throw new Error("Unable to determine email for profile upsert")
        }

        const { error: profileError } = await supabase
          .from("users")
          .upsert(
            {
              id: userId,
              email: emailFromSession,
              name: data.userName?.trim() ?? "",
              birthday,
              avatar_url: data.userPhoto,
            },
            { onConflict: "id" }
          )

        if (profileError) throw profileError

        const group = await createGroup(data.groupName, data.groupType, userId)

        // Save all memorials - both from the array and the current single memorial (for backward compatibility)
        const memorialsToSave: Array<{ name: string; photo?: string }> = []
        
        // Add memorials from the array
        if (data.memorials && data.memorials.length > 0) {
          memorialsToSave.push(...data.memorials)
        }
        
        // Add current memorial if it exists and isn't already in the array
        if (data.memorialName && data.memorialName.trim().length > 0) {
          const isDuplicate = data.memorials?.some(
            (m) => m.name === data.memorialName && m.photo === data.memorialPhoto
          )
          if (!isDuplicate) {
            memorialsToSave.push({
              name: data.memorialName,
              photo: data.memorialPhoto,
            })
          }
        }

        // Create all memorials
        for (const memorial of memorialsToSave) {
          await createMemorial({
            user_id: userId,
            group_id: group.id,
            name: memorial.name,
            photo_url: memorial.photo,
          })
        }

        // Save biometric credentials if biometric is enabled
        const biometricEnabled = await getBiometricPreference()
        if (biometricEnabled && session?.refresh_token) {
          try {
            await saveBiometricCredentials(session.refresh_token, userId)
          } catch (error) {
            console.warn("[auth] failed to save biometric credentials:", error)
            // Don't block onboarding if saving credentials fails
          }
        }

        clear()

        // Check for pending group join from deep link
        const pendingGroupId = await AsyncStorage.getItem("pending_group_join")
        if (pendingGroupId) {
          // Keep pendingGroupId for after onboarding completes
          // Go to how-it-works, which will handle joining
          router.replace("/(onboarding)/how-it-works")
          return
        }

        router.replace({
          pathname: "/(onboarding)/create-group/invite",
          params: { groupId: group.id },
        })
      } catch (error: any) {
        setPersisting(false)
        Alert.alert("Error", error.message)
      }
    },
    [clear, data, persisting, router]
  )

  // Listen for OAuth redirect
  useEffect(() => {
    const handleURL = async (event: { url: string }) => {
      const { url } = event
      console.log("[OAuth] Received redirect URL:", url)
      
      // Filter out non-OAuth URLs (like expo development client URLs)
      if (url.includes("expo-development-client") || url.includes("192.168")) {
        console.log("[OAuth] Ignoring non-OAuth URL")
        return
      }
      
      // Check if this is an OAuth callback
      if (url.includes("#access_token=") || url.includes("?code=") || url.includes("access_token=") || url.includes("error=")) {
        console.log("[OAuth] OAuth callback detected, processing...")
        setOauthLoading(null) // Stop loading spinner
        
        // Check for errors in the URL
        if (url.includes("error=")) {
          const errorMatch = url.match(/error=([^&]+)/)
          const error = errorMatch ? decodeURIComponent(errorMatch[1]) : "Unknown error"
          console.error("[OAuth] Error in callback:", error)
          Alert.alert("Sign-in Failed", error)
          return
        }
        
        // Parse the URL to extract tokens if needed
        // Supabase should handle this automatically, but we'll wait for it to process
        let attempts = 0
        const maxAttempts = 10
        
        const checkSession = async () => {
          attempts++
          console.log(`[OAuth] Checking session (attempt ${attempts}/${maxAttempts})...`)
          
          const { data: { session }, error } = await supabase.auth.getSession()
          
          if (error) {
            console.error("[OAuth] Session error:", error)
            if (attempts >= maxAttempts) {
              Alert.alert("Error", "Failed to complete sign-in. Please try again.")
            } else {
              setTimeout(checkSession, 500)
            }
            return
          }
          
          if (session?.user) {
            console.log("[OAuth] Session found, routing user...")
            
            // Save biometric credentials if enabled
            const biometricEnabled = await getBiometricPreference()
            if (biometricEnabled && session.refresh_token) {
              try {
                await saveBiometricCredentials(session.refresh_token, session.user.id)
              } catch (error) {
                console.warn("[OAuth] failed to save biometric credentials:", error)
              }
            }
            
            // Check if user has profile and group (same logic as handleContinue)
            const { data: user } = await supabase
              .from("users")
              .select("name, birthday")
              .eq("id", session.user.id)
              .maybeSingle()
            
            if (user?.name && user?.birthday) {
              // Existing user - check if they have a group
              const { data: membership } = await supabase
                .from("group_members")
                .select("group_id")
                .eq("user_id", session.user.id)
                .limit(1)
                .maybeSingle()
              
              if (membership) {
                router.replace("/(main)/home")
              } else {
                router.replace("/(onboarding)/create-group/name-type")
              }
            } else {
              // New user - continue onboarding
              if (data.groupName && data.groupType) {
                await persistOnboarding(session.user.id)
              } else {
                router.replace("/(onboarding)/about")
              }
            }
          } else {
            if (attempts < maxAttempts) {
              console.log(`[OAuth] No session yet, retrying...`)
              setTimeout(checkSession, 500)
            } else {
              console.log("[OAuth] No session found after redirect")
              Alert.alert("Error", "Sign-in was cancelled or failed. Please try again.")
            }
          }
        }
        
        // Start checking for session
        setTimeout(checkSession, 500)
      }
    }

    // Listen for deep links
    const subscription = Linking.addEventListener("url", handleURL)
    
    // Check if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleURL({ url })
      }
    })

    return () => {
      subscription.remove()
    }
  }, [router, data, persistOnboarding])

  async function handleContinue() {
    if (!email.trim() || !password) {
      Alert.alert("Error", "Please enter your email and password")
      return
    }

    setUserEmail(email.trim())
    setContinueLoading(true)
    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (!signInError && signInData.session?.user) {
        const userId = signInData.session.user.id
        const session = signInData.session

        // Save biometric credentials if biometric is enabled
        const biometricEnabled = await getBiometricPreference()
        if (biometricEnabled && session.refresh_token) {
          try {
            await saveBiometricCredentials(session.refresh_token, userId)
          } catch (error) {
            console.warn("[auth] failed to save biometric credentials:", error)
            // Don't block login if saving credentials fails
          }
        }

        // Check for pending group join first
        const pendingGroupId = await AsyncStorage.getItem("pending_group_join")
        
        // Check if this is an existing user (has profile and possibly group)
        const { data: user } = await supabase
          .from("users")
          .select("name, birthday")
          .eq("id", userId)
          .maybeSingle()

        // If user has profile, check if they're in onboarding flow or returning user
        if (user?.name && user?.birthday) {
          // Existing user - check if they have a group
          const { data: membership } = await supabase
            .from("group_members")
            .select("group_id")
            .eq("user_id", userId)
            .limit(1)
            .maybeSingle()

          if (membership) {
            // Existing user with group - go to home
            router.replace("/(main)/home")
            return
          } else {
            // Existing user without group - if pending group join, go to how-it-works
            if (pendingGroupId) {
              router.replace("/(onboarding)/how-it-works")
            } else {
              router.replace("/(onboarding)/create-group/name-type")
            }
            return
          }
        }

        // New user or incomplete profile - continue with onboarding flow
        // If pending group join, go to how-it-works after completing profile
        if (pendingGroupId) {
          // User is joining a group - go to how-it-works (profile will be saved there)
          router.replace("/(onboarding)/how-it-works")
        } else if (data.groupName && data.groupType) {
          // New user creating their own group
          await persistOnboarding(userId)
        } else {
          // No group data means they need to complete onboarding
          router.replace("/(onboarding)/about")
        }
        return
      }

      if (signInError && signInError.message?.toLowerCase().includes("invalid login")) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        })

        if (signUpError) {
          if (signUpError.message?.toLowerCase().includes("user already registered")) {
            Alert.alert("Wrong password", "That email already has an account. Double-check the password and try again.")
            return
          }
          throw signUpError
        }

        if (signUpData.session?.user) {
          // Check for pending group join
          const pendingGroupId = await AsyncStorage.getItem("pending_group_join")
          if (pendingGroupId) {
            // In group join flow - save profile and go to how-it-works
            const userId = signUpData.session.user.id
            const birthday = data.userBirthday ? data.userBirthday.toISOString().split("T")[0] : null
            const emailFromSession = data.userEmail ?? signUpData.session.user.email
            if (emailFromSession && data.userName) {
              await supabase
                .from("users")
                .upsert(
                  {
                    id: userId,
                    email: emailFromSession,
                    name: data.userName.trim(),
                    birthday,
                    avatar_url: data.userPhoto,
                  },
                  { onConflict: "id" }
                )
            }
            router.replace("/(onboarding)/how-it-works")
          } else {
            // Normal onboarding - create group
            await persistOnboarding(signUpData.session.user.id)
          }
        } else {
          Alert.alert(
            "Check your email",
            "Open the verification link we just sent to finish setting up your account, then sign in again here."
          )
        }
        return
      }

      if (signInError) {
        throw signInError
      }
    } catch (error: any) {
      Alert.alert("Error", error.message)
    } finally {
      setContinueLoading(false)
    }
  }

  async function handleOAuthSignIn(provider: OAuthProvider) {
    console.log(`[OAuth] Starting ${provider} sign-in...`)
    setOauthLoading(provider)
    try {
      // Use the app scheme for redirect URL - required for OAuth in Expo
      const redirectTo = Linking.createURL("/", { scheme: "goodtimes" })
      console.log(`[OAuth] Redirect URL: ${redirectTo}`)
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { 
          redirectTo,
          skipBrowserRedirect: false,
        },
      })
      
      console.log(`[OAuth] Response:`, { data, error })
      
      if (error) {
        console.error(`[OAuth] Error:`, error)
        throw error
      }
      
      // Note: OAuth will open browser, user completes auth, then redirects back to app
      // The redirect will be handled by the Linking listener in _layout.tsx
      console.log(`[OAuth] OAuth flow initiated, waiting for redirect...`)
    } catch (error: any) {
      console.error(`[OAuth] Failed:`, error)
      Alert.alert("Error", error.message || `Failed to sign in with ${provider}. Make sure OAuth redirect URL is configured in Supabase: goodtimes://`)
      setOauthLoading(null)
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
        keyboardVerticalOffset={insets.top}
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
            <Text style={styles.title}>Sign in</Text>

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
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="rgba(255,255,255,0.6)"
                secureTextEntry
                autoCapitalize="none"
                style={styles.fieldInput}
              />
            </View>

            <Button
              title="Continue →"
              onPress={handleContinue}
              loading={continueLoading || persisting}
              style={styles.primaryButton}
            />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialRow}>
              <Button
                title="Google"
                onPress={() => handleOAuthSignIn("google")}
                loading={oauthLoading === "google" || persisting}
                variant="ghost"
                style={styles.socialButton}
              />
              <Button
                title="Apple"
                onPress={() => handleOAuthSignIn("apple")}
                loading={oauthLoading === "apple" || persisting}
                variant="ghost"
                style={styles.socialButton}
              />
            </View>
          </View>
        </View>
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
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  dividerText: {
    fontFamily: "Roboto-Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
  },
  socialRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  socialButton: {
    minHeight: 56,
    flex: 1,
  },
})

