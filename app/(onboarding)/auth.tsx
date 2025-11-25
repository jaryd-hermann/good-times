"use client"

import { useCallback, useEffect, useState, useRef } from "react"
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Keyboard,
} from "react-native"
import { FontAwesome } from "@expo/vector-icons"
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
import { usePostHog } from "posthog-react-native"
import { captureEvent, identifyUser } from "../../lib/posthog"

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
  const [confirmPassword, setConfirmPassword] = useState("")
  const [continueLoading, setContinueLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null)
  const oauthProcessingRef = useRef(false) // Prevent duplicate processing
  const oauthTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [persisting, setPersisting] = useState(false)
  const insets = useSafeAreaInsets()
  const posthog = usePostHog()
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isRegistrationFlow, setIsRegistrationFlow] = useState(false)

  // Check if user is in registration flow (onboarding or invite/join)
  useEffect(() => {
    async function checkRegistrationFlow() {
      // Check AsyncStorage directly to avoid stale context data
      // This ensures we get the most up-to-date state even if context hasn't updated
      const storedData = await AsyncStorage.getItem("onboarding-data-v1")
      let hasOnboardingData = false
      if (storedData) {
        try {
          const parsed = JSON.parse(storedData)
          hasOnboardingData = !!(parsed.userName && parsed.userBirthday)
        } catch (error) {
          // If parsing fails, fall back to context check
          hasOnboardingData = !!(data.userName && data.userBirthday)
        }
      } else {
        // Fall back to context check if AsyncStorage is empty
        hasOnboardingData = !!(data.userName && data.userBirthday)
      }
      
      // Check if user is joining a group via invite link
      const pendingGroupId = await AsyncStorage.getItem("pending_group_join")
      const isJoiningGroup = !!pendingGroupId
      
      // Show confirm password only if in registration flow
      setIsRegistrationFlow(hasOnboardingData || isJoiningGroup)
    }
    checkRegistrationFlow()
  }, [data.userName, data.userBirthday])

  // Keyboard visibility listener
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setIsKeyboardVisible(true)
        if (Platform.OS === "android") {
          // Use actual keyboard height for Android
          setKeyboardHeight(e.endCoordinates.height)
        }
      }
    )
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setIsKeyboardVisible(false)
        if (Platform.OS === "android") {
          setKeyboardHeight(0)
        }
      }
    )

    return () => {
      keyboardWillShow.remove()
      keyboardWillHide.remove()
    }
  }, [])

  const persistOnboarding = useCallback(
    async (userId: string, sessionOverride?: any) => {
      if (persisting) return
      if (!data.groupName || !data.groupType) return

      setPersisting(true)
      try {
        const birthday = data.userBirthday ? data.userBirthday.toISOString().split("T")[0] : null
        
        // Use provided session if available, otherwise try to get it
        let session = sessionOverride || null
        if (!session) {
          try {
            const getSessionPromise = supabase.auth.getSession()
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error("getSession timeout")), 5000)
            )
            const result: any = await Promise.race([getSessionPromise, timeoutPromise])
            session = result?.data?.session || null
          } catch (error: any) {
            console.warn("[auth] getSession failed in persistOnboarding:", error.message)
            // Continue without session - will use data.userEmail
          }
        } else {
          console.log("[auth] Using provided session in persistOnboarding")
          
          // Only re-set session for OAuth flows - email sign-up already has session properly set
          // Check if this is an OAuth session by looking for app_metadata or provider
          const isOAuthSession = session.user.app_metadata?.provider && 
                                 session.user.app_metadata.provider !== 'email'
          
          if (isOAuthSession) {
            // CRITICAL: Ensure OAuth session is actually set in Supabase client before database queries
            // Simulators can have AsyncStorage timing issues where setSession() completes
            // but the session isn't available for database queries yet
            console.log("[persistOnboarding] 🔄 OAuth session detected - ensuring session is set in Supabase client...")
            try {
              // Explicitly set the session again to ensure it's in AsyncStorage
              // Use shorter timeout - if it fails, proceed anyway
              const { data: setSessionData, error: setSessionErr } = await Promise.race([
                supabase.auth.setSession({
                  access_token: session.access_token,
                  refresh_token: session.refresh_token,
                }),
                new Promise<{ data: null, error: { message: string } }>((resolve) =>
                  setTimeout(() => resolve({ data: null, error: { message: "setSession timeout" } }), 2000)
                )
              ]) as any
              
              if (setSessionErr) {
                console.warn("[persistOnboarding] ⚠️ Re-setting OAuth session failed (proceeding anyway):", setSessionErr.message)
              } else {
                console.log("[persistOnboarding] ✅ OAuth session re-set successfully")
                // Small delay to ensure AsyncStorage write completes (simulator-specific)
                await new Promise(resolve => setTimeout(resolve, 200))
              }
            } catch (sessionSetError) {
              console.warn("[persistOnboarding] ⚠️ OAuth session re-set error (proceeding anyway):", sessionSetError)
            }
          } else {
            console.log("[persistOnboarding] Email session - skipping re-set (already properly set)")
          }
        }

        // CRITICAL: Always use the email from the auth session, not from onboarding data
        // This ensures the email in the database matches the email used to authenticate
        // If user logged in with OAuth using one email, then logs in with email/password using another,
        // we want to update the profile email to match the current auth session
        const emailFromSession = session?.user?.email ?? data.userEmail
        if (!emailFromSession) {
          throw new Error("Unable to determine email for profile upsert")
        }

        console.log(`[persistOnboarding] 📝 Step 1: Creating/updating user profile...`, {
          userId,
          email: emailFromSession,
          authSessionEmail: session?.user?.email,
          onboardingDataEmail: data.userEmail,
          name: data.userName?.trim(),
          birthday,
          hasPhoto: !!data.userPhoto
        })

        const profileStartTime = Date.now()
        
        // Add timeout protection - wrap the entire upsert in a timeout
        // Use upsert with onConflict: "id" to update existing profiles
        // This ensures email is always synced with auth session
        const profileUpsertPromise = (supabase
          .from("users") as any)
          .upsert(
            {
              id: userId,
              email: emailFromSession, // Always use current auth session email
              name: data.userName?.trim() ?? "",
              birthday,
              avatar_url: data.userPhoto,
            },
            { onConflict: "id" }
          )
        
        const profileTimeoutPromise = new Promise<{ error: { message: string, timeout: boolean } }>((resolve) => {
          setTimeout(() => {
            resolve({ error: { message: "Profile upsert timeout after 15 seconds", timeout: true } })
          }, 15000) // Increased from 10s to 15s for simulator network issues
        })

        try {
          console.log(`[persistOnboarding] 🔄 Starting profile upsert (15s timeout)...`)
          const profileResult = await Promise.race([profileUpsertPromise, profileTimeoutPromise])
          const profileDuration = Date.now() - profileStartTime
          
          if ((profileResult as any).error?.timeout) {
            console.error(`[persistOnboarding] ❌ Profile upsert TIMED OUT after ${profileDuration}ms`)
            console.error(`[persistOnboarding] This might be a simulator network issue. Try on a physical device.`)
            throw new Error("Database connection timeout. This might be a simulator issue - try on a physical device or check your internet connection.")
          }
          
          const { error: profileError } = profileResult as any
          
          if (profileError) {
            console.error(`[persistOnboarding] ❌ Profile error:`, profileError)
            throw profileError
          }
          
          console.log(`[persistOnboarding] ✅ Step 1 complete: User profile created (took ${profileDuration}ms)`)
        } catch (profileErr: any) {
          const profileDuration = Date.now() - profileStartTime
          console.error(`[persistOnboarding] ❌ Profile creation failed after ${profileDuration}ms:`, profileErr)
          throw profileErr
        }

        // Check if memorials will be created (before creating group to pass to queue initialization)
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

        const hasMemorials = memorialsToSave.length > 0

        console.log(`[persistOnboarding] Creating group...`, {
          groupName: data.groupName,
          groupType: data.groupType,
          userId,
          enableNSFW: data.enableNSFW ?? false,
          hasMemorials
        })

        // Pass NSFW and memorial preferences to createGroup to avoid race condition
        const group = await createGroup(data.groupName, data.groupType, userId, data.enableNSFW ?? false, hasMemorials)
        
        console.log(`[persistOnboarding] ✅ Group created successfully:`, group.id)

        // Set NSFW preference for friends groups (still needed for persistence)
        if (data.groupType === "friends") {
          console.log(`[persistOnboarding] 📝 Step 4: Setting NSFW preference...`)
          const { updateQuestionCategoryPreference } = await import("../../lib/db")
          // If NSFW is enabled, set preference to "more", otherwise set to "none" (disabled)
          const nsfwPreference = data.enableNSFW ? "more" : "none"
          try {
            await updateQuestionCategoryPreference(group.id, "Edgy/NSFW", nsfwPreference, userId)
            console.log(`[persistOnboarding] ✅ Step 4 complete: NSFW preference set`)
          } catch (error) {
            // If category doesn't exist yet, that's okay - it will be set later when prompts are added
            console.warn("[persistOnboarding] ⚠️ Failed to set NSFW preference (non-blocking):", error)
          }
        }

        // Create all memorials (after group is created)
        console.log(`[persistOnboarding] 📝 Step 5: Creating ${memorialsToSave.length} memorials...`)
        for (const memorial of memorialsToSave) {
          await createMemorial({
            user_id: userId,
            group_id: group.id,
            name: memorial.name,
            photo_url: memorial.photo,
          })
        }
        console.log(`[persistOnboarding] ✅ Step 5 complete: Memorials created`)

        // Save biometric credentials if biometric is enabled
        console.log(`[persistOnboarding] 📝 Step 6: Saving biometric credentials...`)
        const biometricEnabled = await getBiometricPreference()
        if (biometricEnabled && session?.refresh_token) {
          try {
            await saveBiometricCredentials(session.refresh_token, userId)
            console.log(`[persistOnboarding] ✅ Step 6 complete: Biometric credentials saved`)
          } catch (error) {
            console.warn("[persistOnboarding] ⚠️ Failed to save biometric credentials (non-blocking):", error)
            // Don't block onboarding if saving credentials fails
          }
        } else {
          console.log(`[persistOnboarding] ⏭️ Step 6 skipped: Biometric not enabled or no refresh token`)
        }

        console.log(`[persistOnboarding] 📝 Step 7: Clearing onboarding data and navigating...`)
        clear()

        // Check for pending group join from deep link
        const pendingGroupId = await AsyncStorage.getItem("pending_group_join")
        if (pendingGroupId) {
          console.log(`[persistOnboarding] ✅ Navigating to welcome-post-auth (pending group join)`)
          // After registration, always go to welcome-post-auth
          router.replace("/(onboarding)/welcome-post-auth")
          return
        }

        console.log(`[persistOnboarding] ✅ Navigating to invite screen with groupId:`, group.id)
        router.replace({
          pathname: "/(onboarding)/create-group/invite",
          params: { groupId: group.id },
        })
        console.log(`[persistOnboarding] 🎉 COMPLETE - All steps finished!`)
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
        console.log("[OAuth] handleURL: OAuth callback detected")
        console.log("[OAuth] handleURL: oauthProcessingRef.current =", oauthProcessingRef.current)
        
        // Prevent duplicate processing - but allow if we're waiting for this callback
        if (oauthProcessingRef.current) {
          console.log("[OAuth] handleURL: Already processing OAuth - WebBrowser flow is active, skipping deep link handler")
          // Don't return early - let WebBrowser.openAuthSessionAsync handle it
          // The flag will be cleared when handleOAuthSuccess is called
          return
        }

        console.log("[OAuth] handleURL: Processing OAuth callback via deep link handler")
        oauthProcessingRef.current = true
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

          oauthProcessingRef.current = false
          setOauthLoading(null)
          Alert.alert("Sign-in Failed", userMessage)
          return
        }

        // Extract tokens from URL and set session directly
        // Note: Supabase may auto-process the URL, but we'll set it explicitly for reliability
        const hashMatch = url.match(/#(.+)/)
        if (hashMatch) {
          const hashParams = new URLSearchParams(hashMatch[1])
          const accessToken = hashParams.get("access_token")
          const refreshToken = hashParams.get("refresh_token")

          if (accessToken && refreshToken) {
            console.log("[OAuth] Found tokens in URL - starting parallel setSession and polling")

            // Strategy: Start setSession in background (non-blocking) and poll getSession() immediately
            // This prevents hanging - if setSession hangs, polling will still work
            let setSessionCompleted = false
            let setSessionResult: any = null

            // Start setSession in background (fire and forget, but track result)
            supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            }).then((result) => {
              setSessionCompleted = true
              setSessionResult = result
              console.log("[OAuth] setSession completed in background")
            }).catch((error) => {
              setSessionCompleted = true
              setSessionResult = { error }
              console.warn("[OAuth] setSession failed in background:", error)
            })

            // Start polling immediately (don't wait for setSession)
            let attempts = 0
            const maxAttempts = 20 // 10 seconds total

            const pollSession = async (): Promise<void> => {
              attempts++
              console.log(`[OAuth] Polling for session (attempt ${attempts}/${maxAttempts})...`)

              const { data: { session }, error } = await supabase.auth.getSession()

              if (error) {
                console.error("[OAuth] getSession error:", error)
                if (attempts >= maxAttempts) {
                  throw new Error("Failed to get session after polling")
                }
                setTimeout(pollSession, 500)
                return
              }

              if (session?.user) {
                console.log("[OAuth] Session found via polling!")
                oauthProcessingRef.current = false
                await handleOAuthSuccess(session)
                return
              }

              // Check if setSession completed while we were polling
              if (setSessionCompleted && setSessionResult) {
                if (setSessionResult?.data?.session?.user) {
                  console.log("[OAuth] setSession completed successfully!")
                  oauthProcessingRef.current = false
                  await handleOAuthSuccess(setSessionResult.data.session)
                  return
                } else if (setSessionResult?.error) {
                  console.warn("[OAuth] setSession returned error:", setSessionResult.error)
                }
              }

              // Continue polling if no session yet
              if (attempts < maxAttempts) {
                setTimeout(pollSession, 500)
              } else {
                throw new Error("No session found after polling")
              }
            }

            // Start polling immediately
            try {
              await pollSession()
            } catch (pollError: any) {
              console.error("[OAuth] Polling failed:", pollError)
              oauthProcessingRef.current = false
              setOauthLoading(null)
              Alert.alert("Error", "Failed to complete sign-in. Please try again.")
            }
            return
          } else {
            console.error("[OAuth] Missing tokens in URL hash")
            oauthProcessingRef.current = false
            setOauthLoading(null)
            Alert.alert("Error", "Failed to complete sign-in. Missing authentication tokens.")
            return
          }
        } else {
          console.error("[OAuth] No hash fragment in URL")
          oauthProcessingRef.current = false
          setOauthLoading(null)
          Alert.alert("Error", "Failed to complete sign-in. Invalid redirect URL.")
          return
        }
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

    console.log(`[auth] handleContinue: Attempting sign-in with email:`, email.trim())
    
    // Check current session first - if there's an orphaned session (no profile), clear it
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (currentSession) {
        // Check if this session has a valid user profile
        // If not, it's an orphaned session from a failed OAuth sign-up
        console.log(`[auth] handleContinue: Found existing session, checking if it has a profile...`)
        try {
          const { data: profileCheck } = await Promise.race([
            supabase.from("users").select("id").eq("id", currentSession.user.id).maybeSingle(),
            new Promise<{ data: null }>((resolve) => setTimeout(() => resolve({ data: null }), 3000))
          ]) as any
          
          if (!profileCheck) {
            // Orphaned session - no profile exists
            console.warn(`[auth] handleContinue: Found orphaned session (no profile) - clearing it`)
            await supabase.auth.signOut()
            // Continue with sign-in
          } else {
            // Valid session with profile - user shouldn't be here
            console.warn(`[auth] handleContinue: User is already authenticated with profile! User ID:`, currentSession.user.id)
            console.warn(`[auth] handleContinue: Current email:`, currentSession.user.email)
            Alert.alert(
              "Already Signed In",
              `You're already signed in as ${currentSession.user.email}. Please sign out first or continue with your current account.`,
              [
                { text: "OK" },
                {
                  text: "Sign Out",
                  onPress: async () => {
                    await supabase.auth.signOut()
                    router.replace("/(onboarding)/auth")
                  }
                }
              ]
            )
            return
          }
        } catch (profileCheckError) {
          // Profile check failed - assume orphaned session and clear it
          console.warn(`[auth] handleContinue: Profile check failed, clearing session:`, profileCheckError)
          await supabase.auth.signOut()
          // Continue with sign-in
        }
      }
    } catch (sessionError) {
      console.warn(`[auth] handleContinue: Error checking current session:`, sessionError)
      // Continue with sign-in attempt
    }

    setUserEmail(email.trim())
    setContinueLoading(true)
    try {
      console.log(`[auth] handleContinue: Calling signInWithPassword...`)
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      
      console.log(`[auth] handleContinue: signInWithPassword result:`, {
        hasSession: !!signInData?.session,
        hasError: !!signInError,
        error: signInError?.message
      })

      if (!signInError && signInData.session?.user) {
        const userId = signInData.session.user.id
        const session = signInData.session

        // Track signed_in event and identify user in PostHog
        try {
          if (posthog) {
            posthog.capture("signed_in")
            posthog.identify(userId)
          } else {
            captureEvent("signed_in")
            identifyUser(userId)
          }
        } catch (error) {
          // Never let PostHog errors affect sign-in
          if (__DEV__) console.error("[auth] Failed to track signed_in:", error)
        }

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
          .select("name, birthday, email")
          .eq("id", userId)
          .maybeSingle() as { data: Pick<User, "name" | "birthday" | "email"> | null }

        // CRITICAL: Sync profile email with auth session email if they differ
        // This handles cases where user logged in with OAuth using one email,
        // then logs in with email/password using a different email
        if (user && session.user.email && user.email !== session.user.email) {
          console.log(`[auth] Email mismatch detected - syncing profile email with auth session`)
          console.log(`[auth] Profile email: ${user.email}, Auth session email: ${session.user.email}`)
          try {
            await (supabase
              .from("users") as any)
              .update({ email: session.user.email })
              .eq("id", userId)
            console.log(`[auth] ✅ Profile email synced successfully`)
          } catch (emailSyncError) {
            console.warn(`[auth] ⚠️ Failed to sync profile email:`, emailSyncError)
            // Don't block login if email sync fails
          }
        }

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
            // Sign-in should ALWAYS go to home - never show onboarding screens
            // Onboarding screens are only shown during registration flow (after group creation)
            // Check if this is a registration flow (user has onboarding data)
            const isRegistration = !!(data.userName && data.userBirthday)
            
            if (isRegistration) {
              // This is registration flow - check if user needs onboarding
              const onboardingKey = getPostAuthOnboardingKey(userId)
              const hasCompletedPostAuth = await AsyncStorage.getItem(onboardingKey)
              
              if (!hasCompletedPostAuth) {
                // New user in registration flow who hasn't completed onboarding
                router.replace("/(onboarding)/welcome-post-auth")
              } else {
                // Registration flow but onboarding already completed
                router.replace("/(main)/home")
              }
            } else {
              // This is sign-in flow - always go to home, never show onboarding
              router.replace("/(main)/home")
            }
            return
          } else {
            // Existing user without group - if pending group join, go to welcome-post-auth after registration
            if (pendingGroupId) {
              router.replace("/(onboarding)/welcome-post-auth")
            } else {
              router.replace("/(onboarding)/create-group/name-type")
            }
            return
          }
        }

        // New user or incomplete profile - continue with onboarding flow
        // If pending group join, go to welcome-post-auth after completing profile
        if (pendingGroupId) {
          // User is joining a group - after registration, go to welcome-post-auth
          router.replace("/(onboarding)/welcome-post-auth")
        } else if (data.groupName && data.groupType) {
          // New user creating their own group
          await persistOnboarding(userId, signInData.session)
        } else {
          // No group data means they need to complete onboarding
          router.replace("/(onboarding)/about")
        }
        return
      }

      if (signInError && signInError.message?.toLowerCase().includes("invalid login")) {
        // Validate passwords match before sign-up (only if in registration flow)
        if (isRegistrationFlow && password !== confirmPassword) {
          Alert.alert("Passwords don't match", "Please make sure both passwords are the same.")
          return
        }
        
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
          // Track created_account event and identify user in PostHog
          try {
            const userId = signUpData.session.user.id
            if (posthog) {
              posthog.capture("created_account")
              posthog.identify(userId)
            } else {
              const { captureEvent, identifyUser } = await import("../../lib/posthog")
              captureEvent("created_account")
              identifyUser(userId)
            }
          } catch (error) {
            // Never let PostHog errors affect account creation
            if (__DEV__) console.error("[auth] Failed to track created_account:", error)
          }
          // Check for pending group join
          const pendingGroupId = await AsyncStorage.getItem("pending_group_join")
          if (pendingGroupId) {
            // In group join flow - save profile and go to welcome-post-auth after registration
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
            router.replace("/(onboarding)/welcome-post-auth")
          } else {
            // Normal onboarding - create group
            await persistOnboarding(signUpData.session.user.id, signUpData.session)
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
    // Prevent duplicate OAuth attempts
    if (oauthProcessingRef.current || oauthLoading) {
      console.log(`[OAuth] Already processing OAuth, ignoring duplicate request`)
      return
    }

    console.log(`[OAuth] Starting ${provider} sign-in...`)
    setOauthLoading(provider)
    oauthProcessingRef.current = true // Set BEFORE opening browser to prevent Linking handler from processing

    // Set a timeout to stop the spinner if redirect doesn't happen
    if (oauthTimeoutRef.current) {
      clearTimeout(oauthTimeoutRef.current)
    }
    oauthTimeoutRef.current = setTimeout(() => {
      console.warn("[OAuth] Timeout waiting for redirect")
      oauthProcessingRef.current = false
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
          // Force fresh OAuth flow to prevent cached sessions (especially on simulator)
          queryParams: {
            prompt: 'select_account', // Forces Google to show account selection, prevents auto-login
            access_type: 'offline',
          },
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

      // Add prompt=select_account to force fresh login (prevents cached session auto-login on simulator)
      // This ensures users see the Google account selection screen
      const oauthUrl = new URL(data.url)
      oauthUrl.searchParams.set('prompt', 'select_account')
      const finalUrl = oauthUrl.toString()
      
      console.log(`[OAuth] Opening browser with URL: ${finalUrl}`)
      console.log(`[OAuth] Original URL: ${data.url}`)

      // Open the OAuth URL in a browser/webview
      // WebBrowser will handle the redirect back to the app automatically
      // preferEphemeralSession: true prevents sharing cookies/sessions (iOS only)
      const result = await WebBrowser.openAuthSessionAsync(
        finalUrl,
        redirectTo,
        Platform.OS === 'ios' ? { preferEphemeralSession: true } : undefined
      )

      console.log(`[OAuth] Browser session result:`, {
        type: result.type,
        url: result.type === "success" && "url" in result ? `${result.url.substring(0, 100)}...` : null,
        error: "error" in result ? result.error : null
      })

      // Clear timeout since we got a response
      if (oauthTimeoutRef.current) {
        clearTimeout(oauthTimeoutRef.current)
        oauthTimeoutRef.current = null
      }

      if (result.type === "success" && result.url) {
        // Parse the URL to extract tokens
        const url = result.url
        console.log(`[OAuth] ✅ Success! Parsing URL (length: ${url.length})`)
        console.log(`[OAuth] URL preview:`, url.substring(0, 150) + "...")

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
            console.log(`[OAuth] Found tokens in hash, starting parallel setSession and polling...`)
            console.log(`[OAuth] Access token length:`, accessToken.length)
            console.log(`[OAuth] Refresh token length:`, refreshToken.length)
            console.log(`[OAuth] Access token preview:`, accessToken.substring(0, 50) + "...")

            // Strategy: Start setSession in background and poll immediately
            // This prevents hanging - polling will find session even if setSession hangs
            let setSessionCompleted = false
            let setSessionResult: any = null
            let setSessionStartTime = Date.now()
            
            // Set up onAuthStateChange listener to detect when session is set
            // This is more reliable than polling getSession() which may hang
            // Declare these BEFORE the timeout so they're accessible in the timeout callback
            let authStateChangeResolved = false
            let authStateChangeSession: any = null

            // Add timeout wrapper for setSession
            const setSessionTimeout = setTimeout(() => {
              if (!setSessionCompleted) {
                // Only log error if onAuthStateChange didn't detect success
                // If authStateChangeResolved is true, the session was set successfully
                // even though the promise didn't resolve (known Supabase issue)
                if (!authStateChangeResolved) {
                  console.error(`[OAuth] setSession TIMEOUT after 10 seconds - this indicates a hang`)
                } else {
                  console.warn(`[OAuth] setSession promise timed out, but session was detected via onAuthStateChange - this is OK`)
                }
                setSessionCompleted = true
                setSessionResult = { 
                  error: authStateChangeResolved ? null : { 
                    message: "setSession timeout - Supabase client may be hung or network issue",
                    timeout: true 
                  }
                }
              }
            }, 10000) // 10 second timeout

            console.log(`[OAuth] Calling supabase.auth.setSession()...`)
            const authStateChangeTimeout = setTimeout(() => {
              if (!authStateChangeResolved) {
                console.log(`[OAuth] onAuthStateChange listener timeout (5s) - will rely on polling`)
              }
            }, 5000)
            
            const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
              if (event === 'SIGNED_IN' && session?.user && !authStateChangeResolved) {
                console.log(`[OAuth] ✅ onAuthStateChange fired with SIGNED_IN event! User ID:`, session.user.id)
                authStateChangeResolved = true
                authStateChangeSession = session
                clearTimeout(authStateChangeTimeout)
                subscription.unsubscribe()
                // Don't call handleOAuthSuccess here - let the polling logic handle it
                // This just signals that the session is ready
              }
            })
            
            // Start setSession in background (non-blocking)
            supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            }).then((result) => {
              clearTimeout(setSessionTimeout)
              const duration = Date.now() - setSessionStartTime
              setSessionCompleted = true
              setSessionResult = result
              console.log(`[OAuth] setSession completed in background (took ${duration}ms)`)
              console.log(`[OAuth] setSession result:`, {
                hasSession: !!result?.data?.session,
                hasUser: !!result?.data?.session?.user,
                hasError: !!result?.error,
                error: result?.error
              })
              if (result?.error) {
                console.error(`[OAuth] setSession returned error:`, result.error)
              }
            }).catch((error) => {
              clearTimeout(setSessionTimeout)
              const duration = Date.now() - setSessionStartTime
              setSessionCompleted = true
              setSessionResult = { error }
              console.error(`[OAuth] setSession FAILED in background (took ${duration}ms):`, error)
              console.error(`[OAuth] setSession error details:`, {
                message: error?.message,
                name: error?.name,
                stack: error?.stack
              })
            })

            // Start polling immediately (don't wait for setSession)
            let attempts = 0
            const maxAttempts = 20 // 10 seconds total

            const pollSession = async (): Promise<void> => {
              attempts++
              const pollStartTime = Date.now()
              console.log(`[OAuth] Polling for session (attempt ${attempts}/${maxAttempts})...`)
              console.log(`[OAuth] setSession status: completed=${setSessionCompleted}, hasResult=${!!setSessionResult}`)
              console.log(`[OAuth] onAuthStateChange status: resolved=${authStateChangeResolved}, hasSession=${!!authStateChangeSession}`)

              // FIRST: Check if onAuthStateChange fired (most reliable signal)
              if (authStateChangeResolved && authStateChangeSession?.user) {
                console.log(`[OAuth] ✅ onAuthStateChange detected session! Using that session`)
                console.log(`[OAuth] User ID:`, authStateChangeSession.user.id)
                subscription.unsubscribe() // Clean up listener
                oauthProcessingRef.current = false
                await handleOAuthSuccess(authStateChangeSession)
                return
              }

              // SECOND: Check if setSession completed (might have finished while we were waiting)
              if (setSessionCompleted && setSessionResult) {
                console.log(`[OAuth] Checking setSessionResult...`)
                if (setSessionResult?.data?.session?.user) {
                  console.log(`[OAuth] ✅ setSession completed successfully! Using setSession result`)
                  console.log(`[OAuth] User ID:`, setSessionResult.data.session.user.id)
                  oauthProcessingRef.current = false
                  await handleOAuthSuccess(setSessionResult.data.session)
                  return
                } else if (setSessionResult?.error) {
                  console.warn(`[OAuth] ⚠️ setSession returned error:`, setSessionResult.error)
                  console.warn(`[OAuth] Error details:`, {
                    message: setSessionResult.error?.message,
                    name: setSessionResult.error?.name,
                    timeout: setSessionResult.error?.timeout
                  })
                  // Continue polling - maybe getSession will work even if setSession failed
                } else {
                  console.warn(`[OAuth] ⚠️ setSession completed but no session in result:`, setSessionResult)
                }
              }

              console.log(`[OAuth] Calling supabase.auth.getSession()...`)
              
              // Add timeout protection to prevent hanging
              const getSessionPromise = supabase.auth.getSession()
              const timeoutPromise = new Promise<{ data: { session: null }, error: { message: string, timeout: boolean } }>((resolve) => {
                setTimeout(() => {
                  resolve({
                    data: { session: null },
                    error: { message: "getSession timeout after 3 seconds", timeout: true }
                  })
                }, 3000) // 3 second timeout for polling
              })
              
              const { data: { session }, error } = await Promise.race([getSessionPromise, timeoutPromise])
              const pollDuration = Date.now() - pollStartTime
              console.log(`[OAuth] getSession completed (took ${pollDuration}ms)`)
              
              // Check if this is a timeout error (our custom error object)
              const isTimeoutError = error && typeof error === 'object' && 'timeout' in error && (error as any).timeout === true
              
              if (isTimeoutError) {
                console.warn(`[OAuth] ⚠️ getSession timed out, but onAuthStateChange may have fired - checking session via direct access`)
                // Even if getSession times out, the session might be set (onAuthStateChange fired)
                // Try to access it directly via supabase.auth.getUser() or check if we can get it another way
                // For now, continue polling - the next attempt might succeed
                if (attempts < maxAttempts) {
                  setTimeout(pollSession, 500)
                  return
                } else {
                  // Last attempt - try one more time with a different approach
                  console.log(`[OAuth] Final attempt: checking if session exists via getUser()...`)
                  try {
                    const { data: { user }, error: userError } = await Promise.race([
                      supabase.auth.getUser(),
                      new Promise<{ data: { user: null }, error: { message: string } }>((resolve) => {
                        setTimeout(() => resolve({ data: { user: null }, error: { message: "getUser timeout" } }), 2000)
                      })
                    ])
                    if (user && !userError) {
                      console.log(`[OAuth] ✅ Found user via getUser()! User ID:`, user.id)
                      // Get session one more time, or construct it from user
                      const { data: { session: finalSession } } = await Promise.race([
                        supabase.auth.getSession(),
                        new Promise<{ data: { session: null } }>((resolve) => {
                          setTimeout(() => resolve({ data: { session: null } }), 2000)
                        })
                      ])
                      if (finalSession?.user) {
                        oauthProcessingRef.current = false
                        await handleOAuthSuccess(finalSession)
                        return
                      }
                    }
                  } catch (finalError) {
                    console.error(`[OAuth] Final attempt failed:`, finalError)
                  }
                  throw new Error("Failed to get session after polling - getSession is timing out")
                }
              }

              if (error && !isTimeoutError) {
                console.error(`[OAuth] ❌ getSession error:`, error)
                console.error(`[OAuth] Error details:`, {
                  message: error?.message,
                  name: 'name' in error ? (error as any).name : undefined
                })
                if (attempts >= maxAttempts) {
                  throw new Error("Failed to get session after polling")
                }
                setTimeout(pollSession, 500)
                return
              }

              console.log(`[OAuth] getSession result:`, {
                hasSession: !!session,
                hasUser: !!session?.user,
                userId: session?.user?.id
              })

              if (session?.user) {
                console.log(`[OAuth] ✅ Session found via polling! User ID:`, session.user.id)
                subscription.unsubscribe() // Clean up listener
                oauthProcessingRef.current = false
                await handleOAuthSuccess(session)
                return
              }

              // Continue polling if no session yet
              if (attempts < maxAttempts) {
                console.log(`[OAuth] No session yet, continuing to poll...`)
                setTimeout(pollSession, 500)
              } else {
                console.error(`[OAuth] ❌ Polling exhausted after ${maxAttempts} attempts`)
                subscription.unsubscribe() // Clean up listener
                throw new Error("No session found after polling")
              }
            }

            // Start polling immediately
            try {
              console.log(`[OAuth] Starting polling loop...`)
              await pollSession()
              console.log(`[OAuth] ✅ Polling completed successfully`)
              return
            } catch (pollError: any) {
              console.error(`[OAuth] ❌ Polling failed after all attempts:`, pollError)
              console.error(`[OAuth] Poll error details:`, {
                message: pollError?.message,
                name: pollError?.name,
                stack: pollError?.stack
              })
              console.error(`[OAuth] Final setSession status:`, {
                completed: setSessionCompleted,
                hasResult: !!setSessionResult,
                result: setSessionResult
              })
              console.error(`[OAuth] Final onAuthStateChange status:`, {
                resolved: authStateChangeResolved,
                hasSession: !!authStateChangeSession
              })
              subscription.unsubscribe() // Clean up listener
              oauthProcessingRef.current = false
              setOauthLoading(null)
              Alert.alert("Error", "Failed to complete sign-in. Please try again.")
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
        oauthProcessingRef.current = false
        // Don't show alert for user cancellation
      } else {
        console.error(`[OAuth] Unexpected result type:`, result.type)
        setOauthLoading(null)
        oauthProcessingRef.current = false
        Alert.alert("Error", "Sign-in was cancelled or failed. Please try again.")
      }
    } catch (error: any) {
      if (oauthTimeoutRef.current) {
        clearTimeout(oauthTimeoutRef.current)
        oauthTimeoutRef.current = null
      }
      console.error(`[OAuth] Failed:`, error)
      oauthProcessingRef.current = false
      setOauthLoading(null)

      // Extract error message safely
      let errorMessage = `Failed to sign in with ${provider}. Please try again.`
      if (error && typeof error === 'object') {
        if (error.message) {
          errorMessage = error.message
        } else if (error.error_description) {
          errorMessage = error.error_description
        } else if (typeof error.toString === 'function') {
          const errorStr = error.toString()
          if (errorStr !== '[object Object]') {
            errorMessage = errorStr
          }
        }
      } else if (typeof error === 'string') {
        errorMessage = error
      }

      Alert.alert("Error", errorMessage)
    }
  }

  async function handleOAuthSuccess(session: any) {
    try {
      console.log(`[OAuth] handleOAuthSuccess called for user:`, session.user.id)
      console.log(`[OAuth] User email:`, session.user.email)
      
      // Clear spinner and reset processing ref immediately
      oauthProcessingRef.current = false
      setOauthLoading(null)

      // Save biometric credentials if enabled
      const biometricEnabled = await getBiometricPreference()
      if (biometricEnabled && session.refresh_token) {
        try {
          await saveBiometricCredentials(session.refresh_token, session.user.id)
          console.log(`[OAuth] Biometric credentials saved`)
        } catch (error) {
          console.warn("[OAuth] failed to save biometric credentials:", error)
        }
      }

      // Check if user has completed onboarding (has profile in database)
      // For NEW users signing up with OAuth, they won't have a profile yet
      // We check to see if this is a returning user or a new user
      console.log(`[OAuth] Checking if user has completed onboarding (profile exists)...`)
      
      // Add timeout protection to database query
      const userQueryPromise = (supabase
        .from("users") as any)
        .select("name, birthday")
        .eq("id", session.user.id)
        .maybeSingle() as Promise<{ data: Pick<User, "name" | "birthday"> | null, error: any }>
      
      const userQueryTimeout = new Promise<{ data: null, error: { message: string, timeout: boolean } }>((resolve) => {
        setTimeout(() => {
          resolve({
            data: null,
            error: { message: "User profile query timeout after 5 seconds", timeout: true }
          })
        }, 5000)
      })
      
      console.log(`[OAuth] Waiting for user profile query (with 5s timeout)...`)
      const queryStartTime = Date.now()
      const { data: user, error: userError } = await Promise.race([userQueryPromise, userQueryTimeout])
      const queryDuration = Date.now() - queryStartTime
      console.log(`[OAuth] User profile query completed (took ${queryDuration}ms)`)
      
      // If query fails or times out, assume new user and proceed with onboarding
      let userProfile = user
      if (userError) {
        const isTimeout = (userError as any).timeout === true
        console.warn(`[OAuth] User profile query ${isTimeout ? 'timed out' : 'failed'}:`, userError)
        
        if (isTimeout) {
          console.log(`[OAuth] Query timed out - assuming new user and proceeding with onboarding`)
        } else {
          console.warn(`[OAuth] Query error (non-timeout) - proceeding as new user:`, userError)
        }
        // Set userProfile to null to trigger new user flow
        userProfile = null
      }
      
      console.log(`[OAuth] User profile query result:`, {
        hasUser: !!userProfile,
        hasName: !!userProfile?.name,
        hasBirthday: !!userProfile?.birthday,
        name: userProfile?.name,
        birthday: userProfile?.birthday
      })
      
      // If no user profile exists OR query timed out, this is a NEW user
      // They should have already completed About screen (have onboarding data)
      // If they don't have onboarding data, something went wrong - they shouldn't be here
      const isNewUser = !userProfile || !userProfile.name || !userProfile.birthday
      
      if (isNewUser) {
        console.log(`[OAuth] New user detected (no profile in database or query timed out)`)
        
        // Track created_account event and identify user in PostHog for OAuth
        try {
          const userId = session.user.id
          if (posthog) {
            posthog.capture("created_account")
            posthog.identify(userId)
          } else {
            captureEvent("created_account")
            identifyUser(userId)
          }
        } catch (error) {
          // Never let PostHog errors affect OAuth flow
          if (__DEV__) console.error("[OAuth] Failed to track created_account:", error)
        }
        
        console.log(`[OAuth] Checking onboarding data:`, {
          hasUserName: !!data.userName,
          hasUserBirthday: !!data.userBirthday,
          hasGroupName: !!data.groupName,
          hasGroupType: !!data.groupType
        })
        
        // New user should have completed About screen first
        // They should have onboarding data (name, birthday, groupName, groupType)
        if (data.groupName && data.groupType && data.userName && data.userBirthday) {
          console.log(`[OAuth] ✅ Has all onboarding data, calling persistOnboarding to create user and group`)
          console.log(`[OAuth] This will create user profile, group, and navigate to invite screen`)
          
          // CRITICAL: OAuth session needs time to propagate to Supabase client's internal state
          // Email sign-up works because signUp()/signInWithPassword() return session synchronously
          // OAuth uses setSession() which is async - the session might not be in AsyncStorage yet
          // when we try to make database queries, causing them to hang
          console.log(`[OAuth] Waiting for OAuth session to fully propagate to Supabase client...`)
          
          // Wait a bit and verify session is accessible
          let sessionReady = false
          let attempts = 0
          while (!sessionReady && attempts < 5) {
            await new Promise(resolve => setTimeout(resolve, 200))
            attempts++
            try {
              // Try to get session - if it works, Supabase client has processed it
              const { data: { session: verifySession } } = await Promise.race([
                supabase.auth.getSession(),
                new Promise<{ data: { session: null } }>((resolve) => 
                  setTimeout(() => resolve({ data: { session: null } }), 1000)
                )
              ])
              if (verifySession?.user?.id === session.user.id) {
                sessionReady = true
                console.log(`[OAuth] ✅ Session verified after ${attempts * 200}ms`)
              } else {
                console.log(`[OAuth] Session not ready yet (attempt ${attempts}/5)...`)
              }
            } catch (err) {
              console.log(`[OAuth] Session verification attempt ${attempts} failed, retrying...`)
            }
          }
          
          if (!sessionReady) {
            console.warn(`[OAuth] ⚠️ Session verification timed out, proceeding anyway...`)
          }
          
          try {
            console.log(`[OAuth] Calling persistOnboarding with session:`, {
              userId: session.user.id,
              hasAccessToken: !!session.access_token,
              hasRefreshToken: !!session.refresh_token
            })
            
            // Pass the session we already have to avoid another getSession() call
            await persistOnboarding(session.user.id, session)
            // persistOnboarding will navigate to invite screen
            console.log(`[OAuth] ✅ persistOnboarding completed successfully`)
            return
          } catch (persistError: any) {
            console.error(`[OAuth] ❌ persistOnboarding failed:`, persistError)
            console.error(`[OAuth] Error details:`, {
              message: persistError?.message,
              name: persistError?.name,
              stack: persistError?.stack
            })
            // Show error to user
            Alert.alert(
              "Error",
              persistError?.message || "Failed to complete sign-up. Please try again."
            )
            return
          }
        } else {
          // Missing onboarding data - this shouldn't happen if flow is correct
          // But handle gracefully: send them back to about to complete it
          console.warn(`[OAuth] ⚠️ Missing onboarding data - user should have completed About first`)
          console.warn(`[OAuth] Missing:`, {
            userName: !data.userName,
            userBirthday: !data.userBirthday,
            groupName: !data.groupName,
            groupType: !data.groupType
          })
          console.warn(`[OAuth] Navigating back to About screen to complete onboarding`)
          router.replace("/(onboarding)/about")
          return
        }
      }

      // User has profile - this is an EXISTING user
      console.log(`[OAuth] Existing user detected (has profile) - checking group membership...`)
      
      // Add timeout protection to group membership query
      const membershipQueryPromise = supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", session.user.id)
        .limit(1)
        .maybeSingle()
      
      const membershipQueryTimeout = new Promise<{ data: null, error: { message: string, timeout: boolean } }>((resolve) => {
        setTimeout(() => {
          resolve({
            data: null,
            error: { message: "Group membership query timeout after 5 seconds", timeout: true }
          })
        }, 5000)
      })
      
      const { data: membership, error: membershipError } = await Promise.race([membershipQueryPromise, membershipQueryTimeout])
      
      if (membershipError) {
        const isTimeout = (membershipError as any).timeout === true
        console.warn(`[OAuth] Group membership query ${isTimeout ? 'timed out' : 'failed'}:`, membershipError)
        
        if (isTimeout) {
          // If query times out, assume they don't have a group and proceed with onboarding
          console.log(`[OAuth] Group query timed out - assuming no group, proceeding with onboarding`)
          const membership = null
        } else {
          // For other errors, also assume no group
          console.warn(`[OAuth] Group query error - assuming no group:`, membershipError)
          const membership = null
        }
      }
      
      console.log(`[OAuth] Group membership result:`, {
        hasMembership: !!membership,
        groupId: (membership as any)?.group_id
      })

      if (membership) {
          // OAuth sign-in should ALWAYS go to home - never show onboarding screens
          // Onboarding screens are only shown during registration flow (after group creation)
          // Check if this is a registration flow (user has onboarding data)
          const isRegistration = !!(data.userName && data.userBirthday)
          
          console.log(`[OAuth] User has group. isRegistration: ${isRegistration}`)

          if (isRegistration) {
            // This is registration flow - check if user needs onboarding
            const onboardingKey = getPostAuthOnboardingKey(session.user.id)
            const hasCompletedPostAuth = await AsyncStorage.getItem(onboardingKey)
            
            console.log(`[OAuth] Registration flow. hasCompletedPostAuth: ${!!hasCompletedPostAuth}`)
            
            if (!hasCompletedPostAuth) {
              // New user in registration flow who hasn't completed onboarding
              console.log(`[OAuth] Registration flow without completed onboarding, navigating to welcome-post-auth`)
              router.replace("/(onboarding)/welcome-post-auth")
            } else {
              // Registration flow but onboarding already completed
              console.log(`[OAuth] Registration flow with completed onboarding, navigating to home`)
              router.replace("/(main)/home")
            }
          } else {
            // This is sign-in flow - always go to home, never show onboarding
            console.log(`[OAuth] Sign-in flow with group, navigating to home`)
            router.replace("/(main)/home")
          }
        } else {
          // Existing user without group
          console.log(`[OAuth] User has profile but no group. data.groupName: ${data.groupName}, data.groupType: ${data.groupType}`)
          if (data.groupName && data.groupType) {
            console.log(`[OAuth] Has onboarding data, calling persistOnboarding`)
            await persistOnboarding(session.user.id, session)
          } else {
            console.log(`[OAuth] No onboarding data, navigating to create-group/name-type`)
            router.replace("/(onboarding)/create-group/name-type")
          }
        }
      
      console.log(`[OAuth] handleOAuthSuccess completed successfully`)
    } catch (error: any) {
      console.error("[OAuth] ❌ Error in handleOAuthSuccess:", error)
      console.error("[OAuth] Error details:", {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      })
      oauthProcessingRef.current = false
      setOauthLoading(null)
      
      const errorMessage = error?.message || error?.error_description || "Failed to complete sign-in. Please try again."
      console.error("[OAuth] Showing error alert:", errorMessage)
      Alert.alert("Error", errorMessage)
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
            {!isKeyboardVisible && (
              <View style={styles.topBar}>
                <OnboardingBack />
                <TouchableOpacity
                  onPress={() => router.push("/(onboarding)/forgot-password")}
                  style={styles.forgotPasswordLink}
                >
                  <Text style={styles.forgotPasswordText}>Forgot Password</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.content}>
              {isRegistrationFlow && (
                <View style={styles.loginLinkContainer}>
                  <Text style={styles.loginLinkPrefix}>Already a member? </Text>
                  <TouchableOpacity 
                    onPress={() => {
                      setIsRegistrationFlow(false)
                      setConfirmPassword("") // Clear confirm password when switching to login
                      setConfirmPasswordFocused(false) // Reset focus state
                    }} 
                    activeOpacity={0.8}
                  >
                    <Text style={styles.loginLinkText}>Login</Text>
                  </TouchableOpacity>
                </View>
              )}
              <Text style={styles.title}>{isRegistrationFlow ? "Create Account" : "Sign In"}</Text>

              <View style={styles.fieldsContainer}>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Email</Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@email.com"
                    placeholderTextColor="rgba(255,255,255,0.6)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.fieldInput}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Password</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="••••••••"
                      placeholderTextColor="rgba(255,255,255,0.6)"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      style={styles.passwordInput}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => {
                        // Keep password focused if confirm password is focused
                        // This prevents the confirm password field from disappearing when clicking on it
                        if (!confirmPasswordFocused) {
                          // Small delay to check if confirm password will be focused
                          // This handles the case where user clicks from password to confirm password
                          setTimeout(() => {
                            // Only hide if confirm password didn't get focused
                            if (!confirmPasswordFocused) {
                              setPasswordFocused(false)
                            }
                          }, 200) // Delay to allow confirm password field to receive focus
                        }
                        // If confirmPasswordFocused is true, keep passwordFocused true too
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeButton}
                      activeOpacity={0.7}
                    >
                      <FontAwesome
                        name={showPassword ? "eye-slash" : "eye"}
                        size={20}
                        color="rgba(255,255,255,0.6)"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {(passwordFocused || confirmPasswordFocused) && isRegistrationFlow && (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Confirm Password</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="••••••••"
                        placeholderTextColor="rgba(255,255,255,0.6)"
                        secureTextEntry={!showConfirmPassword}
                        autoCapitalize="none"
                        style={styles.passwordInput}
                        onFocus={() => {
                          setConfirmPasswordFocused(true)
                          // Keep password focused to prevent confirm password from disappearing
                          setPasswordFocused(true)
                        }}
                        onBlur={() => {
                          setConfirmPasswordFocused(false)
                          // Only hide password focus if password field itself is not focused
                          // This prevents flickering when switching between fields
                          setTimeout(() => {
                            if (!passwordFocused && !confirmPasswordFocused) {
                              // Both fields are blurred, safe to hide confirm password
                            }
                          }, 100)
                        }}
                      />
                      <TouchableOpacity
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={styles.eyeButton}
                        activeOpacity={0.7}
                      >
                        <FontAwesome
                          name={showConfirmPassword ? "eye-slash" : "eye"}
                          size={20}
                          color="rgba(255,255,255,0.6)"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              <Button
                title="Continue →"
                onPress={handleContinue}
                loading={continueLoading || persisting}
                style={styles.primaryButton}
              />

              {/* OAuth buttons temporarily disabled - commented out until OAuth is fixed */}
              {/* <View style={styles.divider}>
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
              </View> */}
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
    justifyContent: "flex-end", // Content starts at bottom on both platforms
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
  loginLinkContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  loginLinkPrefix: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    color: colors.white,
  },
  loginLinkText: {
    fontFamily: "Roboto-Bold",
    fontSize: 16,
    color: colors.white,
    textDecorationLine: "underline",
  },
  fieldsContainer: {
    position: "relative",
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
  formBackground: {
    position: "absolute",
    top: -spacing.md,
    left: -spacing.md,
    right: -spacing.md,
    bottom: -spacing.md,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 8,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
  },
  passwordInput: {
    flex: 1,
    fontFamily: "LibreBaskerville-Regular",
    fontSize: 24,
    color: colors.white,
    paddingVertical: spacing.sm,
  },
  eyeButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
})

