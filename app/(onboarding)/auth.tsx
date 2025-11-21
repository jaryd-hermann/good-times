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
  Keyboard,
} from "react-native"
import { FontAwesome } from "@expo/vector-icons"
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
  const oauthProcessingRef = useRef(false) // Prevent duplicate processing
  const oauthTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [persisting, setPersisting] = useState(false)
  const insets = useSafeAreaInsets()
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Keyboard visibility listener
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setIsKeyboardVisible(true)
    )
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setIsKeyboardVisible(false)
    )

    return () => {
      keyboardWillShow.remove()
      keyboardWillHide.remove()
    }
  }, [])

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

        // Pass NSFW preference to createGroup to avoid race condition
        const group = await createGroup(data.groupName, data.groupType, userId, data.enableNSFW ?? false)

        // Set NSFW preference for friends groups (still needed for persistence)
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
        // Prevent duplicate processing
        if (oauthProcessingRef.current) {
          console.log("[OAuth] Already processing OAuth, ignoring duplicate URL")
          return
        }
        
        console.log("[OAuth] OAuth callback detected, processing...")
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
            // Check if this is a NEW user (created within last 10 minutes)
            // Only show welcome-post-auth to newly registered users, not existing users logging in
            const userCreatedAt = new Date(signInData.session.user.created_at)
            const now = new Date()
            const minutesSinceCreation = (now.getTime() - userCreatedAt.getTime()) / (1000 * 60)
            const isNewUser = minutesSinceCreation < 10 // User created within last 10 minutes
            
            if (isNewUser) {
              // Check if user has completed post-auth onboarding
              const onboardingKey = getPostAuthOnboardingKey(userId)
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
            console.log(`[OAuth] Found tokens in hash, starting parallel setSession and polling...`)
            
            // Strategy: Start setSession in background and poll immediately
            // This prevents hanging - polling will find session even if setSession hangs
            let setSessionCompleted = false
            let setSessionResult: any = null
            
            // Start setSession in background (non-blocking)
            supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            }).then((result) => {
              setSessionCompleted = true
              setSessionResult = result
              console.log(`[OAuth] setSession completed in background`)
            }).catch((error) => {
              setSessionCompleted = true
              setSessionResult = { error }
              console.warn(`[OAuth] setSession failed in background:`, error)
            })
            
            // Start polling immediately (don't wait for setSession)
            let attempts = 0
            const maxAttempts = 20 // 10 seconds total
            
            const pollSession = async (): Promise<void> => {
              attempts++
              console.log(`[OAuth] Polling for session (attempt ${attempts}/${maxAttempts})...`)
              
              const { data: { session }, error } = await supabase.auth.getSession()
              
              if (error) {
                console.error(`[OAuth] getSession error:`, error)
                if (attempts >= maxAttempts) {
                  throw new Error("Failed to get session after polling")
                }
                setTimeout(pollSession, 500)
                return
              }
              
              if (session?.user) {
                console.log(`[OAuth] Session found via polling!`)
                oauthProcessingRef.current = false
                await handleOAuthSuccess(session)
                return
              }
              
              // Check if setSession completed while we were polling
              if (setSessionCompleted && setSessionResult) {
                if (setSessionResult?.data?.session?.user) {
                  console.log(`[OAuth] setSession completed successfully!`)
                  oauthProcessingRef.current = false
                  await handleOAuthSuccess(setSessionResult.data.session)
                  return
                } else if (setSessionResult?.error) {
                  console.warn(`[OAuth] setSession returned error:`, setSessionResult.error)
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
              return
            } catch (pollError: any) {
              console.error(`[OAuth] Polling failed:`, pollError)
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
          // Check if this is a NEW user (created within last 10 minutes)
          // Only show welcome-post-auth to newly registered users, not existing users logging in
          const userCreatedAt = new Date(session.user.created_at)
          const now = new Date()
          const minutesSinceCreation = (now.getTime() - userCreatedAt.getTime()) / (1000 * 60)
          const isNewUser = minutesSinceCreation < 10 // User created within last 10 minutes
          
          if (isNewUser) {
            // Check if user has completed post-auth onboarding
            const onboardingKey = getPostAuthOnboardingKey(session.user.id)
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
            <Text style={styles.title}>Sign in</Text>

            <View style={styles.fieldsContainer}>
              {(emailFocused || passwordFocused) && (
                <View style={styles.formBackground} />
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
                    onBlur={() => setPasswordFocused(false)}
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

