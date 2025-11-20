"use client"

import { useCallback, useEffect, useState, useRef } from "react"
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TextInput,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import * as Linking from "expo-linking"
import * as WebBrowser from "expo-web-browser"
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
import type { User } from "../../lib/types"

type OAuthProvider = "google" | "apple"
const POST_AUTH_ONBOARDING_KEY_PREFIX = "has_completed_post_auth_onboarding"

// Helper function to get user-specific onboarding key
function getPostAuthOnboardingKey(userId: string): string {
  return `${POST_AUTH_ONBOARDING_KEY_PREFIX}_${userId}`
}

export default function OnboardingAuth() {
  const router = useRouter()
  const { data, clear, setUserEmail } = useOnboarding()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [continueLoading, setContinueLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null)
  const oauthTimeoutRef = useRef<NodeJS.Timeout | null>(null)
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

        const { error: profileError } = await (supabase
          .from("users") as any)
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

        // Set NSFW preference for friends groups
        if (data.groupType === "friends") {
          const { updateQuestionCategoryPreference } = await import("../../lib/db")
          // If NSFW is enabled, set preference to "more", otherwise set to "none" (disabled)
          const nsfwPreference = data.enableNSFW ? "more" : "none"
          try {
            await updateQuestionCategoryPreference(group.id, "Edgy/NSFW", nsfwPreference, userId)
          } catch (error) {
            // If category doesn't exist yet, that's okay - it will be set later when prompts are added
            console.warn("[auth] Failed to set NSFW preference:", error)
          }
        }

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
        
        // Clear any timeout that was set
        if (oauthTimeoutRef.current) {
          clearTimeout(oauthTimeoutRef.current)
          oauthTimeoutRef.current = null
        }
        
        // Check for errors in the URL
        if (url.includes("error=")) {
          const errorMatch = url.match(/error=([^&]+)/)
          const errorDescMatch = url.match(/error_description=([^&#]+)/)
          const error = errorMatch ? decodeURIComponent(errorMatch[1]) : "Unknown error"
          const errorDesc = errorDescMatch ? decodeURIComponent(errorDescMatch[1]) : ""
          
          console.error("[OAuth] Error in callback:", error, errorDesc)
          
          // Provide helpful error messages for common issues
          let userMessage = errorDesc || error
          if (error === "server_error" && errorDesc.includes("Unable to exchange external code")) {
            userMessage = "OAuth configuration error. Please check your Supabase OAuth settings for Apple/Google."
          } else if (error === "access_denied") {
            userMessage = "Sign-in was cancelled. Please try again."
          }
          
          setOauthLoading(null)
          Alert.alert("Sign-in Failed", userMessage)
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
            const { data: user } = await (supabase
              .from("users") as any)
              .select("name, birthday")
              .eq("id", session.user.id)
              .maybeSingle() as { data: Pick<User, "name" | "birthday"> | null }
            
            if (user?.name && user?.birthday) {
              // Existing user - check if they have a group
              const { data: membership } = await supabase
                .from("group_members")
                .select("group_id")
                .eq("user_id", session.user.id)
                .limit(1)
                .maybeSingle()
              
            if (membership) {
              // Check post-auth onboarding (user-specific)
              const onboardingKey = getPostAuthOnboardingKey(session.user.id)
              const hasCompletedPostAuth = await AsyncStorage.getItem(onboardingKey)
              if (!hasCompletedPostAuth) {
                router.replace("/(onboarding)/welcome-post-auth")
              } else {
                router.replace("/(main)/home")
              }
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
      // Complete WebBrowser auth session on unmount
      WebBrowser.maybeCompleteAuthSession()
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
        const { data: user } = await (supabase
          .from("users") as any)
          .select("name, birthday")
          .eq("id", userId)
          .maybeSingle() as { data: Pick<User, "name" | "birthday"> | null }

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
            // Existing user with group - check post-auth onboarding (user-specific)
            const onboardingKey = getPostAuthOnboardingKey(userId)
            const hasCompletedPostAuth = await AsyncStorage.getItem(onboardingKey)
            if (!hasCompletedPostAuth) {
              router.replace("/(onboarding)/welcome-post-auth")
            } else {
              router.replace("/(main)/home")
            }
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
              await (supabase
                .from("users") as any)
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
    
    // Set a timeout to stop the spinner if redirect doesn't happen
    if (oauthTimeoutRef.current) {
      clearTimeout(oauthTimeoutRef.current)
    }
    oauthTimeoutRef.current = setTimeout(() => {
      console.warn("[OAuth] Timeout waiting for redirect")
      setOauthLoading(null)
      oauthTimeoutRef.current = null
      Alert.alert(
        "OAuth Sign-In",
        "The sign-in process is taking longer than expected. Please try again.",
        [{ text: "OK" }]
      )
    }, 60000) // 60 second timeout
    
    try {
      // Get OAuth URL from Supabase with skipBrowserRedirect: true
      // This returns the URL without opening a browser automatically
      const redirectTo = "goodtimes://"
      console.log(`[OAuth] Getting OAuth URL with redirect: ${redirectTo}`)
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { 
          redirectTo,
          skipBrowserRedirect: true, // Important: we'll open browser manually
        },
      })
      
      console.log(`[OAuth] Supabase response:`, { data, error })
      
      if (error) {
        if (oauthTimeoutRef.current) {
          clearTimeout(oauthTimeoutRef.current)
          oauthTimeoutRef.current = null
        }
        console.error(`[OAuth] Error getting OAuth URL:`, error)
        setOauthLoading(null)
        Alert.alert("Error", error.message || `Failed to start ${provider} sign-in. Please try again.`)
        return
      }
      
      if (!data?.url) {
        if (oauthTimeoutRef.current) {
          clearTimeout(oauthTimeoutRef.current)
          oauthTimeoutRef.current = null
        }
        console.error(`[OAuth] No URL returned from Supabase`)
        setOauthLoading(null)
        Alert.alert("Error", `Failed to get ${provider} sign-in URL. Please try again.`)
        return
      }
      
      console.log(`[OAuth] Opening browser with URL: ${data.url}`)
      
      // Open the OAuth URL in a browser/webview
      // WebBrowser will handle the redirect back to the app automatically
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo
      )
      
      console.log(`[OAuth] Browser session result:`, result)
      
      // Clear timeout since we got a response
      if (oauthTimeoutRef.current) {
        clearTimeout(oauthTimeoutRef.current)
        oauthTimeoutRef.current = null
      }
      
      if (result.type === "success" && result.url) {
        // Parse the URL to extract tokens
        const url = result.url
        console.log(`[OAuth] Success! Parsing URL: ${url}`)
        
        // Check for errors first
        if (url.includes("error=")) {
          const errorMatch = url.match(/error=([^&#]+)/)
          const errorDescMatch = url.match(/error_description=([^&#]+)/)
          const error = errorMatch ? decodeURIComponent(errorMatch[1]) : "Unknown error"
          const errorDesc = errorDescMatch ? decodeURIComponent(errorDescMatch[1]) : ""
          console.error(`[OAuth] Error in redirect URL:`, error, errorDesc)
          
          // Provide helpful error messages
          let userMessage = errorDesc || error
          if (error === "server_error" && errorDesc.includes("Unable to exchange external code")) {
            userMessage = "OAuth configuration error. Please check your Supabase OAuth settings. See OAUTH_TROUBLESHOOTING.md for help."
          } else if (error === "access_denied") {
            userMessage = "Sign-in was cancelled. Please try again."
          }
          
          setOauthLoading(null)
          Alert.alert("Sign-in Failed", userMessage)
          return
        }
        
        // Extract hash fragment (Supabase sends tokens in hash for OAuth)
        const hashMatch = url.match(/#(.+)/)
        if (hashMatch) {
          const hashParams = new URLSearchParams(hashMatch[1])
          const accessToken = hashParams.get("access_token")
          const refreshToken = hashParams.get("refresh_token")
          const expiresIn = hashParams.get("expires_in")
          
          if (accessToken && refreshToken) {
            console.log(`[OAuth] Found tokens in hash, setting session...`)
            
            // Manually set session - use a reasonable timeout
            try {
              console.log(`[OAuth] Setting session directly...`)
              
              // Create a promise that resolves/rejects quickly
              const setSessionPromise = supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              })
              
              // Race with timeout
              const timeoutId = setTimeout(() => {
                console.warn(`[OAuth] setSession taking longer than expected...`)
              }, 3000)
              
              const { data: sessionData, error: sessionError } = await setSessionPromise
              clearTimeout(timeoutId)
              
              if (sessionError) {
                console.error(`[OAuth] setSession error:`, sessionError)
                throw sessionError
              }
              
              if (sessionData?.session) {
                console.log(`[OAuth] Session set successfully`)
                await handleOAuthSuccess(sessionData.session)
                return
              } else {
                throw new Error("No session in response")
              }
            } catch (error: any) {
              console.error(`[OAuth] setSession failed:`, error.message)
              
              // Fallback: Manually trigger the URL handler by calling Linking.openURL
              // This will cause the useEffect handler to process it
              console.log(`[OAuth] Triggering URL handler as fallback...`)
              try {
                await Linking.openURL(url)
                // Wait for handler to process
                await new Promise(resolve => setTimeout(resolve, 1500))
                
                const { data: { session }, error: checkError } = await supabase.auth.getSession()
                if (session && !checkError) {
                  console.log(`[OAuth] Session found via URL handler fallback`)
                  await handleOAuthSuccess(session)
                  return
                }
              } catch (linkError) {
                console.error(`[OAuth] Linking fallback failed:`, linkError)
              }
              
              setOauthLoading(null)
              Alert.alert("Error", error.message || "Failed to complete sign-in. Please try again.")
              return
            }
          } else {
            console.error(`[OAuth] Missing tokens in hash fragment`)
            setOauthLoading(null)
            Alert.alert("Error", "Failed to complete sign-in. Missing authentication tokens.")
            return
          }
        } else {
          console.error(`[OAuth] No hash fragment in URL`)
          setOauthLoading(null)
          Alert.alert("Error", "Failed to complete sign-in. Invalid redirect URL.")
          return
        }
      } else if (result.type === "cancel") {
        console.log(`[OAuth] User cancelled`)
        setOauthLoading(null)
        // Don't show alert for user cancellation
      } else {
        console.error(`[OAuth] Unexpected result type:`, result.type)
        setOauthLoading(null)
        Alert.alert("Error", "Sign-in was cancelled or failed. Please try again.")
      }
    } catch (error: any) {
      if (oauthTimeoutRef.current) {
        clearTimeout(oauthTimeoutRef.current)
        oauthTimeoutRef.current = null
      }
      console.error(`[OAuth] Failed:`, error)
      setOauthLoading(null)
      Alert.alert("Error", error.message || `Failed to sign in with ${provider}. Please try again.`)
    }
  }

  async function handleOAuthSuccess(session: any) {
    try {
      setOauthLoading(null)
      
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
      const { data: user } = await (supabase
        .from("users") as any)
        .select("name, birthday")
        .eq("id", session.user.id)
        .maybeSingle() as { data: Pick<User, "name" | "birthday"> | null }
      
      if (user?.name && user?.birthday) {
        // Existing user - check if they have a group
        const { data: membership } = await supabase
          .from("group_members")
          .select("group_id")
          .eq("user_id", session.user.id)
          .limit(1)
          .maybeSingle()
        
        if (membership) {
          // Existing user with group - check post-auth onboarding (user-specific)
          const onboardingKey = getPostAuthOnboardingKey(session.user.id)
          const hasCompletedPostAuth = await AsyncStorage.getItem(onboardingKey)
          if (!hasCompletedPostAuth) {
            router.replace("/(onboarding)/welcome-post-auth")
          } else {
            router.replace("/(main)/home")
          }
        } else {
          // Existing user without group
          if (data.groupName && data.groupType) {
            await persistOnboarding(session.user.id)
          } else {
            router.replace("/(onboarding)/create-group/name-type")
          }
        }
      } else {
        // New user or incomplete profile - continue with onboarding flow
        if (data.groupName && data.groupType) {
          await persistOnboarding(session.user.id)
        } else {
          router.replace("/(onboarding)/about")
        }
      }
    } catch (error: any) {
      console.error("[OAuth] Error handling success:", error)
      setOauthLoading(null)
      Alert.alert("Error", error.message || "Failed to complete sign-in. Please try again.")
    }
  }

  return (
    <ImageBackground
      source={require("../../assets/images/auth.png")}
      style={styles.background}
      resizeMode="cover"
    >
      <LinearGradient
        colors={["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0.55)", "rgba(0, 0, 0, 0.8)", "rgba(0, 0, 0, 1)"]}
        locations={[0, 0.4, 0.7, 1]}
        style={styles.gradientOverlay}
      />
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
              <TouchableOpacity
                onPress={() => router.push("/(onboarding)/forgot-password")}
                style={styles.forgotPasswordLink}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password</Text>
              </TouchableOpacity>
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
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
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
    top: spacing.xxl + spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  forgotPasswordLink: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  forgotPasswordText: {
    fontFamily: "Roboto-Regular",
    fontSize: 14,
    color: colors.white,
    textDecorationLine: "underline",
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

