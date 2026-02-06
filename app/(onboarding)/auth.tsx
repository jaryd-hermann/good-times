"use client"

import { useCallback, useEffect, useState, useRef, useMemo } from "react"
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
  Modal,
  Animated,
} from "react-native"
import { FontAwesome } from "@expo/vector-icons"
import * as Linking from "expo-linking"
import * as WebBrowser from "expo-web-browser"
import { useRouter } from "expo-router"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { supabase } from "../../lib/supabase"
import { colors, spacing } from "../../lib/theme"
import { Button } from "../../components/Button"
import { useOnboarding } from "../../components/OnboardingProvider"
import { Image } from "react-native"

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
import { createGroup, createMemorial } from "../../lib/db"
import { uploadAvatar, uploadMemorialPhoto, isLocalFileUri } from "../../lib/storage"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  saveBiometricCredentials,
  getBiometricPreference,
  isBiometricAvailable,
  getBiometricRefreshToken,
  getBiometricUserId,
  authenticateWithBiometric,
  clearBiometricCredentials,
} from "../../lib/biometric"
import type { User } from "../../lib/types"
import { usePostHog } from "posthog-react-native"
import { captureEvent, identifyUser } from "../../lib/posthog"

type OAuthProvider = "google" | "apple"
const POST_AUTH_ONBOARDING_KEY_PREFIX = "has_completed_post_auth_onboarding"
const PENDING_GROUP_KEY = "pending_group_join"

// Helper function to get user-specific onboarding key
function getPostAuthOnboardingKey(userId: string): string {
  return `${POST_AUTH_ONBOARDING_KEY_PREFIX}_${userId}`
}

// Track in-flight operations to prevent concurrent calls for same user
const processingUsers = new Set<string>()

// Helper function to ensure user profile exists and join group if pending
// This should be called immediately after successful authentication
async function ensureProfileAndJoinGroup(
  userId: string,
  session: any,
  onboardingData?: { userName?: string; userBirthday?: Date; userPhoto?: string; userEmail?: string }
): Promise<{ joinedGroup: boolean; groupId?: string }> {
  console.log(`[ensureProfileAndJoinGroup] Starting for user:`, userId)
  
  // Concurrency protection: prevent duplicate calls for same user
  if (processingUsers.has(userId)) {
    console.warn(`[ensureProfileAndJoinGroup] Already processing for user ${userId}, waiting for existing operation...`)
    // Wait a bit and check if profile exists (operation may have completed)
    await new Promise(resolve => setTimeout(resolve, 500))
    const { data: existingProfile } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle()
    
    if (existingProfile) {
      // Profile exists, check for pending group join
      const pendingGroupId = await AsyncStorage.getItem(PENDING_GROUP_KEY)
      if (pendingGroupId) {
        const { data: existingMember } = await supabase
          .from("group_members")
          .select("id")
          .eq("group_id", pendingGroupId)
          .eq("user_id", userId)
          .maybeSingle()
        
        if (existingMember) {
          await AsyncStorage.removeItem(PENDING_GROUP_KEY)
          return { joinedGroup: true, groupId: pendingGroupId }
        }
      }
    }
    return { joinedGroup: false }
  }

  processingUsers.add(userId)
  
  try {
    // Read onboarding data from AsyncStorage if not provided
    let profileData = onboardingData
    if (!profileData) {
      try {
        const storedData = await AsyncStorage.getItem("onboarding-data-v1")
        if (storedData) {
          const parsed = JSON.parse(storedData)
          profileData = {
            userName: parsed.userName,
            userBirthday: parsed.userBirthday ? new Date(parsed.userBirthday) : undefined,
            userPhoto: parsed.userPhoto,
            userEmail: parsed.userEmail,
          }
        }
      } catch (error) {
        console.warn("[ensureProfileAndJoinGroup] Failed to read onboarding data:", error)
      }
    }

    // CRITICAL: Always use email from session (most reliable source)
    // Fallback to onboarding data only if session email is missing
    const emailFromSession = session?.user?.email ?? profileData?.userEmail
    
    if (!emailFromSession) {
      console.error("[ensureProfileAndJoinGroup] ❌ No email available from session or onboarding data")
      console.error("[ensureProfileAndJoinGroup] Session email:", session?.user?.email)
      console.error("[ensureProfileAndJoinGroup] Onboarding email:", profileData?.userEmail)
      throw new Error("Cannot create profile: no email available")
    }

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from("users")
      .select("id, email, name, birthday, avatar_url")
      .eq("id", userId)
      .maybeSingle()

    // Only update profile if:
    // 1. Profile doesn't exist (new user), OR
    // 2. We have onboarding data to update with
    const hasOnboardingData = !!(profileData?.userName || profileData?.userBirthday || profileData?.userPhoto)
    
    if (!existingProfile) {
      // New user - create profile with available data
      const birthday = profileData?.userBirthday 
        ? profileData.userBirthday.toISOString().split("T")[0]
        : null

      console.log(`[ensureProfileAndJoinGroup] Creating new profile:`, {
        userId,
        email: emailFromSession,
        name: profileData?.userName?.trim() || null,
        birthday,
        hasPhoto: !!profileData?.userPhoto,
      })

      // Upload avatar FIRST if it's a local file path
      // CRITICAL: Upload BEFORE creating profile so we can include avatar_url in the initial insert
      let finalAvatarUrl: string | null = null
      if (profileData?.userPhoto) {
        let avatarUrl = profileData.userPhoto
        
        if (isLocalFileUri(avatarUrl)) {
          try {
            console.log("[ensureProfileAndJoinGroup] 📤 Uploading avatar from local file...")
            avatarUrl = await uploadAvatar(avatarUrl, userId)
            console.log("[ensureProfileAndJoinGroup] ✅ Avatar uploaded:", avatarUrl)
            finalAvatarUrl = avatarUrl
          } catch (error: any) {
            console.error("[ensureProfileAndJoinGroup] ❌ Failed to upload avatar:", error)
            // Continue without avatar if upload fails
            finalAvatarUrl = null
          }
        } else if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) {
          // Already a valid URL
          finalAvatarUrl = avatarUrl
        } else {
          // Unknown format - try to upload anyway (defensive)
          console.warn("[ensureProfileAndJoinGroup] ⚠️ Photo URI format not recognized, attempting upload")
          try {
            avatarUrl = await uploadAvatar(avatarUrl, userId)
            finalAvatarUrl = avatarUrl
          } catch (error: any) {
            console.error("[ensureProfileAndJoinGroup] ❌ Upload failed for unrecognized format:", error)
            finalAvatarUrl = null
          }
        }
      }

      // Get device timezone for new user
      const deviceTimezone = (() => {
        try {
          return Intl.DateTimeFormat().resolvedOptions().timeZone
        } catch (error) {
          console.error("[ensureProfileAndJoinGroup] Failed to get device timezone:", error)
          return "America/New_York" // Fallback
        }
      })()

      const { error: profileError } = await supabase
        .from("users")
        .insert({
          id: userId,
          email: emailFromSession,
          name: profileData?.userName?.trim() || null,
          birthday: birthday,
          avatar_url: finalAvatarUrl, // Use uploaded URL if available, null otherwise
          timezone: deviceTimezone, // Set timezone from device
        } as any)

      if (profileError) {
        console.error("[ensureProfileAndJoinGroup] ❌ Profile creation failed:", profileError)
        throw new Error(`Failed to create profile: ${profileError.message}`)
      }
      
      console.log("[ensureProfileAndJoinGroup] ✅ Profile created successfully")
    } else if (hasOnboardingData) {
      // Existing user with onboarding data - update only provided fields
      // Don't overwrite existing data with null values
      const updateData: any = {}
      
      // Only update email if it's different (shouldn't happen, but be safe)
      if (emailFromSession !== existingProfile.email) {
        updateData.email = emailFromSession
      }
      
      // Only update fields that are provided in onboarding data
      if (profileData?.userName?.trim()) {
        updateData.name = profileData.userName.trim()
      }
      
      if (profileData?.userBirthday) {
        updateData.birthday = profileData.userBirthday.toISOString().split("T")[0]
      }
      
      if (profileData?.userPhoto) {
        // Upload avatar if it's a local file path
        let avatarUrl = profileData.userPhoto
        if (isLocalFileUri(avatarUrl)) {
          try {
            console.log("[ensureProfileAndJoinGroup] 📤 Uploading avatar from local file (update)...")
            avatarUrl = await uploadAvatar(avatarUrl, userId)
            console.log("[ensureProfileAndJoinGroup] ✅ Avatar uploaded:", avatarUrl)
          } catch (error: any) {
            console.error("[ensureProfileAndJoinGroup] ❌ Failed to upload avatar:", error)
            // Skip avatar update if upload fails
            return
          }
        } else if (!avatarUrl.startsWith("http://") && !avatarUrl.startsWith("https://")) {
          // Unknown format - try to upload anyway (defensive)
          console.warn("[ensureProfileAndJoinGroup] ⚠️ Photo URI format not recognized, attempting upload")
          try {
            avatarUrl = await uploadAvatar(avatarUrl, userId)
            console.log("[ensureProfileAndJoinGroup] ✅ Upload succeeded for unrecognized format:", avatarUrl)
          } catch (error: any) {
            console.error("[ensureProfileAndJoinGroup] ❌ Upload failed for unrecognized format:", error)
            return
          }
        }
        updateData.avatar_url = avatarUrl
      }

      if (Object.keys(updateData).length > 0) {
        console.log(`[ensureProfileAndJoinGroup] Updating existing profile:`, updateData)
        
        const { error: profileError } = await supabase
          .from("users")
          .update(updateData)
          .eq("id", userId)

        if (profileError) {
          console.error("[ensureProfileAndJoinGroup] ❌ Profile update failed:", profileError)
          // Non-critical - profile exists, continue
        } else {
          console.log("[ensureProfileAndJoinGroup] ✅ Profile updated successfully")
        }
      } else {
        console.log("[ensureProfileAndJoinGroup] No profile updates needed")
      }
    } else {
      // Existing user, no onboarding data - profile already exists, nothing to update
      console.log("[ensureProfileAndJoinGroup] Existing user profile found, no updates needed")
    }

    // Check for pending group join
    const pendingGroupId = await AsyncStorage.getItem(PENDING_GROUP_KEY)
    if (!pendingGroupId) {
      console.log("[ensureProfileAndJoinGroup] No pending group join")
      return { joinedGroup: false }
    }

    console.log(`[ensureProfileAndJoinGroup] Joining group:`, pendingGroupId)

    // Check if user is already a member (idempotency check)
    // Database has UNIQUE constraint, but we check first to avoid unnecessary errors
    const { data: existingMember } = await supabase
      .from("group_members")
      .select("id")
      .eq("group_id", pendingGroupId)
      .eq("user_id", userId)
      .maybeSingle()

    if (existingMember) {
      console.log("[ensureProfileAndJoinGroup] User already a member of group")
      // Don't clear pending_group_join here - let swipe-onboarding handle it
      return { joinedGroup: true, groupId: pendingGroupId }
    }

    // Join the group
    // Database UNIQUE constraint will prevent duplicates if concurrent calls slip through
    const { error: joinError } = await supabase
      .from("group_members")
      .insert({
        group_id: pendingGroupId,
        user_id: userId,
        role: "member",
      } as any)

    if (joinError) {
      // Check if error is due to duplicate (unique constraint violation)
      const isDuplicateError = joinError.message?.includes("duplicate") || 
                               joinError.code === "23505" // PostgreSQL unique violation
      
      if (isDuplicateError) {
        console.log("[ensureProfileAndJoinGroup] Duplicate membership detected (likely concurrent call), treating as success")
        // Don't clear pending_group_join here - let swipe-onboarding handle it
        return { joinedGroup: true, groupId: pendingGroupId }
      }
      
      console.error("[ensureProfileAndJoinGroup] Failed to join group:", joinError)
      // Don't clear pending group - let user try again
      return { joinedGroup: false }
    }

    console.log("[ensureProfileAndJoinGroup] ✅ Successfully joined group")
    // Don't clear pending_group_join here - let swipe-onboarding handle it after showing
    return { joinedGroup: true, groupId: pendingGroupId }
  } catch (error: any) {
    console.error("[ensureProfileAndJoinGroup] ❌ Error in ensureProfileAndJoinGroup:", error)
    // Re-throw critical errors (profile creation failures)
    // But allow group join failures to be non-blocking
    if (error.message?.includes("Cannot create profile") || error.message?.includes("Failed to create profile")) {
      throw error
    }
    // For group join failures, return false but don't throw
    return { joinedGroup: false }
  } finally {
    // Always remove from processing set
    processingUsers.delete(userId)
  }
}

export default function OnboardingAuth() {
  const router = useRouter()
  const { data, clear, setUserEmail } = useOnboarding()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  
  // Memoize email change handler to prevent re-renders
  const handleEmailChange = useCallback((text: string) => {
    setEmail(text)
  }, [])
  const [confirmPassword, setConfirmPassword] = useState("")
  const [continueLoading, setContinueLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null)
  const [showOAuthLoadingScreen, setShowOAuthLoadingScreen] = useState(false)
  const oauthProcessingRef = useRef(false) // Prevent duplicate processing
  const oauthTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const oauthRotateAnim = useRef(new Animated.Value(0)).current
  const [persisting, setPersisting] = useState(false)
  const insets = useSafeAreaInsets()
  const posthog = usePostHog()
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isRegistrationFlow, setIsRegistrationFlow] = useState(false)
  const [showNoAccountModal, setShowNoAccountModal] = useState(false)
  const [biometricAttempted, setBiometricAttempted] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocusedInput, setPasswordFocusedInput] = useState(false)
  const [confirmPasswordFocusedInput, setConfirmPasswordFocusedInput] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // CRITICAL: Check if user already has a valid session - if so, redirect to home
  // This prevents the "Already Signed In" modal loop when user has session but AuthProvider user load timed out
  useEffect(() => {
    async function checkExistingSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          // User has a valid session - check if they have a profile
          try {
            const { data: profile } = await Promise.race([
              supabase.from("users").select("id").eq("id", session.user.id).maybeSingle(),
              new Promise<{ data: null }>((resolve) => setTimeout(() => resolve({ data: null }), 2000))
            ]) as any
            
            if (profile) {
              // User has session AND profile - they shouldn't be on auth screen
              // Redirect to home (boot flow should have handled this, but if user load timed out, it didn't)
              console.log("[auth] User has valid session and profile - redirecting to home")
              router.replace("/(main)/home")
            }
          } catch (profileError) {
            // Profile check failed - might be network issue, don't redirect
            console.warn("[auth] Failed to check profile for existing session:", profileError)
          }
        }
      } catch (error) {
        // Session check failed - ignore, user can still sign in
        console.warn("[auth] Failed to check existing session:", error)
      }
    }
    
    checkExistingSession()
  }, [router])

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

  // OAuth loading screen rotation animation
  useEffect(() => {
    if (showOAuthLoadingScreen) {
      // Start rotation animation
      const rotateAnimation = Animated.loop(
        Animated.timing(oauthRotateAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      )
      rotateAnimation.start()
      return () => {
        rotateAnimation.stop()
        oauthRotateAnim.setValue(0)
      }
    }
  }, [showOAuthLoadingScreen])

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
        
        // Upload avatar FIRST if it's a local file path
        // CRITICAL: Upload BEFORE creating profile so we can include avatar_url in the initial insert
        // This prevents race conditions and ensures avatar_url is never NULL when a photo exists
        let finalAvatarUrl: string | null = null
        if (data.userPhoto) {
          console.log("[persistOnboarding] Processing user photo:", {
            hasPhoto: !!data.userPhoto,
            photoUri: data.userPhoto.substring(0, 50) + "...",
            isLocalFile: isLocalFileUri(data.userPhoto)
          })
          
          let avatarUrl = data.userPhoto
          
          // Check if it's a local file that needs uploading
          if (isLocalFileUri(avatarUrl)) {
            try {
              console.log("[persistOnboarding] 📤 Uploading avatar from local file...")
              avatarUrl = await uploadAvatar(avatarUrl, userId)
              console.log("[persistOnboarding] ✅ Avatar uploaded successfully:", avatarUrl)
              finalAvatarUrl = avatarUrl
            } catch (error: any) {
              console.error("[persistOnboarding] ❌ Failed to upload avatar:", error)
              console.error("[persistOnboarding] Error details:", {
                message: error?.message,
                code: error?.code,
                stack: error?.stack
              })
              // Set to null if upload fails - user can add photo later
              finalAvatarUrl = null
              Alert.alert("Photo Upload Failed", "Your profile was created but the photo couldn't be uploaded. You can add it later in settings.")
            }
          } else if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) {
            // Already a valid URL (shouldn't happen in onboarding, but handle it)
            console.log("[persistOnboarding] Photo is already a URL, using directly:", avatarUrl.substring(0, 50))
            finalAvatarUrl = avatarUrl
          } else {
            // Unknown format - try to upload anyway (defensive)
            // This handles edge cases where our detection might miss a local file
            console.warn("[persistOnboarding] ⚠️ Photo URI format not recognized, attempting upload:", avatarUrl.substring(0, 50))
            try {
              avatarUrl = await uploadAvatar(avatarUrl, userId)
              console.log("[persistOnboarding] ✅ Upload succeeded for unrecognized format:", avatarUrl)
              finalAvatarUrl = avatarUrl
            } catch (error: any) {
              console.error("[persistOnboarding] ❌ Upload failed for unrecognized format:", error)
              finalAvatarUrl = null
            }
          }
        } else {
          console.log("[persistOnboarding] No user photo provided")
        }
        
        // Add timeout protection - wrap the entire upsert in a timeout
        // Use upsert with onConflict: "id" to update existing profiles
        // This ensures email is always synced with auth session
        // CRITICAL: Include avatar_url in initial insert if we have it (uploaded above)
        const profileUpsertPromise = (supabase
          .from("users") as any)
          .upsert(
            {
              id: userId,
            email: emailFromSession, // Always use current auth session email
            name: data.userName?.trim() ?? "",
            birthday,
            avatar_url: finalAvatarUrl, // Use uploaded URL if available, null otherwise
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
          // Upload memorial photo if it's a local file path
          let photoUrl = memorial.photo
          if (photoUrl && isLocalFileUri(photoUrl)) {
            try {
              console.log(`[persistOnboarding] Uploading memorial photo for ${memorial.name}...`)
              photoUrl = await uploadMemorialPhoto(photoUrl, userId, group.id)
              console.log(`[persistOnboarding] ✅ Memorial photo uploaded:`, photoUrl)
            } catch (error: any) {
              console.error(`[persistOnboarding] ❌ Failed to upload memorial photo:`, error)
              // Continue without photo if upload fails
              photoUrl = undefined
            }
          }
          
          await createMemorial({
            user_id: userId,
            group_id: group.id,
            name: memorial.name,
            photo_url: photoUrl,
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

  // Biometric login: Attempt FaceID/TouchID when screen mounts (if enabled)
  useEffect(() => {
    async function attemptBiometricLogin() {
      // Only attempt once per mount
      if (biometricAttempted) {
        console.log("[auth] Biometric login: Already attempted, skipping")
        return
      }
      
      console.log("[auth] Biometric login: Starting attempt...")
      
      try {
        // CRITICAL: First check if user already has a valid session
        // If they do, they shouldn't be on this screen - biometric won't help
        const { data: { session: existingSession } } = await supabase.auth.getSession()
        if (existingSession?.user) {
          console.log("[auth] Biometric login: User already has session, skipping biometric (shouldn't be on auth screen)")
          setBiometricAttempted(true)
          return
        }
        
        // Check if biometric is available and enabled
        console.log("[auth] Biometric login: Checking availability...")
        const biometricAvailable = await isBiometricAvailable()
        console.log("[auth] Biometric login: Available?", biometricAvailable)
        if (!biometricAvailable) {
          console.log("[auth] Biometric login: Not available on device")
          setBiometricAttempted(true)
          return
        }

        console.log("[auth] Biometric login: Checking preference...")
        const biometricEnabled = await getBiometricPreference()
        console.log("[auth] Biometric login: Enabled in app?", biometricEnabled)
        if (!biometricEnabled) {
          console.log("[auth] Biometric login: Not enabled in app settings")
          setBiometricAttempted(true)
          return
        }

        // Check if we have stored credentials
        console.log("[auth] Biometric login: Checking stored credentials...")
        const refreshToken = await getBiometricRefreshToken()
        const userId = await getBiometricUserId()
        console.log("[auth] Biometric login: Has refresh token?", !!refreshToken)
        console.log("[auth] Biometric login: Has user ID?", !!userId)
        if (!refreshToken || !userId) {
          console.log("[auth] Biometric login: No stored credentials - user needs to sign in manually first")
          setBiometricAttempted(true)
          return
        }

        console.log("[auth] Biometric login: All checks passed - prompting for biometric authentication...")
        setBiometricAttempted(true)

        // Attempt biometric authentication
        console.log("[auth] Biometric login: Prompting user for FaceID/TouchID...")
        const authResult = await authenticateWithBiometric("Authenticate to log in")
        console.log("[auth] Biometric login: Authentication result:", {
          success: authResult.success,
          error: authResult.error
        })
        if (!authResult.success) {
          // User cancelled or failed - allow manual login
          console.log("[auth] Biometric login: User cancelled or failed - allowing manual login")
          return
        }
        
        console.log("[auth] Biometric login: ✅ Biometric authentication successful!")

        // Use refresh token to get new session
        console.log("[auth] Biometric login: Refreshing session with stored refresh token...")
        const { data: sessionData, error } = await supabase.auth.refreshSession({
          refresh_token: refreshToken,
        })

        if (error || !sessionData.session) {
          console.warn("[auth] Biometric login: ❌ Failed to refresh session:", error)
          console.warn("[auth] Biometric login: Clearing invalid credentials")
          // Clear invalid credentials
          await clearBiometricCredentials()
          return
        }
        
        console.log("[auth] Biometric login: ✅ Session refreshed successfully!")

        const session = sessionData.session
        const authenticatedUserId = session.user.id

        // Track signed_in event and identify user in PostHog
        try {
          if (posthog) {
            posthog.capture("signed_in")
            posthog.identify(authenticatedUserId)
          } else {
            captureEvent("signed_in")
            identifyUser(authenticatedUserId)
          }
        } catch (error) {
          // Never let PostHog errors affect sign-in
          if (__DEV__) console.error("[auth] Failed to track signed_in:", error)
        }

        // CRITICAL: Ensure profile exists and join group if pending (must happen immediately after auth)
        let joinedGroup = false
        let groupId: string | undefined
        try {
          const result = await ensureProfileAndJoinGroup(
            authenticatedUserId,
            session,
            {
              userName: data.userName,
              userBirthday: data.userBirthday,
              userPhoto: data.userPhoto,
              userEmail: data.userEmail,
            }
          )
          joinedGroup = result.joinedGroup
          groupId = result.groupId
        } catch (profileError: any) {
          // Profile creation failure is critical - cannot proceed
          console.error("[auth] ❌ Critical: Profile creation failed during biometric login:", profileError)
          Alert.alert(
            "Account Setup Error",
            "Failed to create your profile. Please try signing in again or contact support if the problem persists.",
            [{ text: "OK", onPress: () => router.replace("/(onboarding)/auth") }]
          )
          return
        }

        // CRITICAL: If user just joined a group (via invite/deeplink), route to welcome-post-auth
        if (joinedGroup) {
          console.log("[auth] User just joined group via invite (biometric), routing to welcome-post-auth")
          router.replace("/(onboarding)/welcome-post-auth")
          return
        }

        // Check if this is a NEW user registration flow (has onboarding data)
        const isNewUserRegistration = !!(data.groupName && data.groupType && data.userName && data.userBirthday)
        
        if (isNewUserRegistration) {
          // New user creating their own group - call persistOnboarding
          await persistOnboarding(authenticatedUserId, session)
          return
        }

        // Check if this is an existing user (has profile and possibly group)
        const { data: user } = await (supabase
          .from("users") as any)
          .select("name, birthday, email")
          .eq("id", authenticatedUserId)
          .maybeSingle() as { data: Pick<User, "name" | "birthday" | "email"> | null }

        // CRITICAL: Sync profile email with auth session email if they differ
        if (user && session.user.email && user.email !== session.user.email) {
          console.log(`[auth] Email mismatch detected - syncing profile email with auth session`)
          try {
            await (supabase
              .from("users") as any)
              .update({ email: session.user.email })
              .eq("id", authenticatedUserId)
            console.log(`[auth] ✅ Profile email synced successfully`)
          } catch (emailSyncError) {
            console.warn(`[auth] ⚠️ Failed to sync profile email:`, emailSyncError)
          }
        }

        // If user has profile, check if they're in onboarding flow or returning user
        if (user?.name && user?.birthday) {
          // Existing user - check if they have a group
          const { data: membership } = await supabase
            .from("group_members")
            .select("group_id")
            .eq("user_id", authenticatedUserId)
            .limit(1)
            .maybeSingle()

          if (membership) {
            // User has group - check if this is registration flow or sign-in
            const isRegistration = !!(data.userName && data.userBirthday)
            
            if (isRegistration) {
              // This is registration flow - check if user needs onboarding
              const onboardingKey = getPostAuthOnboardingKey(authenticatedUserId)
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
            // Existing user without group - need to create one
            router.replace("/(onboarding)/create-group/name-type")
            return
          }
        }

        // Incomplete profile - user needs to complete onboarding
        router.replace("/(onboarding)/about")
      } catch (error) {
        // Silently fail - user can still log in manually
        console.error("[auth] Biometric login: ❌ Error during biometric login:", error)
        console.error("[auth] Biometric login: Error details:", {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        })
        setBiometricAttempted(true)
      }
    }

    // Attempt biometric login after a short delay to allow screen to render
    console.log("[auth] Biometric login: Setting up attempt (500ms delay)...")
    const timeout = setTimeout(() => {
      console.log("[auth] Biometric login: Timeout fired - attempting biometric login now")
      attemptBiometricLogin()
    }, 500)

    return () => {
      console.log("[auth] Biometric login: Cleanup - clearing timeout")
      clearTimeout(timeout)
    }
  }, [router, biometricAttempted, data, persistOnboarding, posthog])

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

      // CRITICAL: Skip password reset links - let _layout.tsx handle them
      // Password reset links can have error=, type=recovery, or reset-password in the URL
      if (url.includes("reset-password") || url.includes("type=recovery") || url.includes("otp_expired")) {
        console.log("[OAuth] Ignoring password reset link - handled by _layout.tsx")
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
          setErrorMessage(userMessage)
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
              setErrorMessage("Failed to complete sign-in. Please try again.")
            }
            return
          } else {
            console.error("[OAuth] Missing tokens in URL hash")
            oauthProcessingRef.current = false
            setOauthLoading(null)
            setErrorMessage("Failed to complete sign-in. Missing authentication tokens.")
            return
          }
        } else {
          console.error("[OAuth] No hash fragment in URL")
          oauthProcessingRef.current = false
          setOauthLoading(null)
          setErrorMessage("Failed to complete sign-in. Invalid redirect URL.")
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

        // CRITICAL: Ensure profile exists and join group if pending (must happen immediately after auth)
        let joinedGroup = false
        let groupId: string | undefined
        try {
          const result = await ensureProfileAndJoinGroup(
            userId,
            session,
            {
              userName: data.userName,
              userBirthday: data.userBirthday,
              userPhoto: data.userPhoto,
              userEmail: data.userEmail,
            }
          )
          joinedGroup = result.joinedGroup
          groupId = result.groupId
        } catch (profileError: any) {
          // Profile creation failure is critical - cannot proceed
          console.error("[auth] ❌ Critical: Profile creation failed:", profileError)
          Alert.alert(
            "Account Setup Error",
            "Failed to create your profile. Please try signing in again or contact support if the problem persists.",
            [{ text: "OK", onPress: () => router.replace("/(onboarding)/auth") }]
          )
          return
        }

        // CRITICAL: If user just joined a group (via invite/deeplink), route to welcome-post-auth
        // This must be checked FIRST, before other routing logic
        if (joinedGroup) {
          console.log("[auth] User just joined group via invite, routing to welcome-post-auth")
          router.replace("/(onboarding)/welcome-post-auth")
          return
        }

        // CRITICAL: Check if this is a NEW user registration flow (has onboarding data)
        // This check must happen BEFORE checking if user has profile, because
        // ensureProfileAndJoinGroup may have just created the profile
        const isNewUserRegistration = !!(data.groupName && data.groupType && data.userName && data.userBirthday)
        
        if (isNewUserRegistration) {
          // New user creating their own group - call persistOnboarding
          await persistOnboarding(userId, signInData.session)
          return
        }

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
            // User has group - check if this is registration flow or sign-in
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
            // Existing user without group - need to create one
            router.replace("/(onboarding)/create-group/name-type")
            return
          }
        }

        // Incomplete profile - user needs to complete onboarding
        router.replace("/(onboarding)/about")
        return
      }

      if (signInError && signInError.message?.toLowerCase().includes("invalid login")) {
        // CRITICAL: If user is trying to SIGN IN (not registration), don't auto-create account
        // Show modal instead to guide them to either join via invite or start onboarding
        if (!isRegistrationFlow) {
          console.log("[auth] Sign-in failed for non-existent account - showing no account modal")
          setContinueLoading(false) // Clear loading state
          setShowNoAccountModal(true)
          return
        }
        
        // Only auto-create account if in registration flow (with password confirmation)
        // Validate passwords match before sign-up
        if (password !== confirmPassword) {
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
          // CRITICAL: Ensure profile exists and join group if pending (must happen immediately after auth)
          let joinedGroup = false
          try {
            const result = await ensureProfileAndJoinGroup(
              signUpData.session.user.id,
              signUpData.session,
              {
                userName: data.userName,
                userBirthday: data.userBirthday,
                userPhoto: data.userPhoto,
                userEmail: data.userEmail,
              }
            )
            joinedGroup = result.joinedGroup
          } catch (profileError: any) {
            // Profile creation failure is critical - cannot proceed
            console.error("[auth] ❌ Critical: Profile creation failed during sign-up:", profileError)
            Alert.alert(
              "Account Setup Error",
              "Failed to create your profile. Please try signing up again or contact support if the problem persists.",
              [{ text: "OK", onPress: () => router.replace("/(onboarding)/auth") }]
            )
            return
          }

          if (joinedGroup) {
            // User just joined a group - go to welcome-post-auth
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
        setShowOAuthLoadingScreen(false)
        oauthProcessingRef.current = false
        setErrorMessage(error.message || `Failed to start Google sign-in. Please try again.`)
        return
      }

      if (!data?.url) {
        if (oauthTimeoutRef.current) {
          clearTimeout(oauthTimeoutRef.current)
          oauthTimeoutRef.current = null
        }
        console.error(`[OAuth] No URL returned from Supabase`)
        setOauthLoading(null)
        setShowOAuthLoadingScreen(false)
        oauthProcessingRef.current = false
        setErrorMessage(`Failed to get Google sign-in URL. Please try again.`)
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
        // Show full-screen loading immediately when browser redirects back
        // This prevents user interaction during OAuth processing
        setShowOAuthLoadingScreen(true)
        
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
          setShowOAuthLoadingScreen(false)
          oauthProcessingRef.current = false
          setErrorMessage(userMessage)
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
              setShowOAuthLoadingScreen(false)
              setErrorMessage("Failed to complete sign-in. Please try again.")
              return
            }
          } else {
            console.error(`[OAuth] Missing tokens in hash fragment`)
            setOauthLoading(null)
            setShowOAuthLoadingScreen(false)
            oauthProcessingRef.current = false
            setErrorMessage("Failed to complete sign-in. Missing authentication tokens.")
            return
          }
        } else {
          console.error(`[OAuth] No hash fragment in URL`)
          setOauthLoading(null)
          setShowOAuthLoadingScreen(false)
          oauthProcessingRef.current = false
          setErrorMessage("Failed to complete sign-in. Invalid redirect URL.")
          return
        }
      } else if (result.type === "cancel") {
        console.log(`[OAuth] User cancelled`)
        setOauthLoading(null)
        setShowOAuthLoadingScreen(false)
        oauthProcessingRef.current = false
        // Don't show alert for user cancellation
      } else {
        console.error(`[OAuth] Unexpected result type:`, result.type)
        setOauthLoading(null)
        setShowOAuthLoadingScreen(false)
        oauthProcessingRef.current = false
        setErrorMessage("Sign-in was cancelled or failed. Please try again.")
      }
    } catch (error: any) {
      if (oauthTimeoutRef.current) {
        clearTimeout(oauthTimeoutRef.current)
        oauthTimeoutRef.current = null
      }
      console.error(`[OAuth] Failed:`, error)
      oauthProcessingRef.current = false
      setOauthLoading(null)
      setShowOAuthLoadingScreen(false)

      // Extract error message safely
      let errorMsg = `Failed to sign in with Google. Please try again.`
      if (error && typeof error === 'object') {
        if (error.message) {
          errorMsg = error.message
        } else if (error.error_description) {
          errorMsg = error.error_description
        } else if (typeof error.toString === 'function') {
          const errorStr = error.toString()
          if (errorStr !== '[object Object]') {
            errorMsg = errorStr
          }
        }
      } else if (typeof error === 'string') {
        errorMsg = error
      }

      setErrorMessage(errorMsg)
    }
  }

  async function handleOAuthSuccess(session: any) {
    try {
      console.log(`[OAuth] handleOAuthSuccess called for user:`, session.user.id)
      console.log(`[OAuth] User email:`, session.user.email)
      
      // Clear spinner and reset processing ref immediately
      oauthProcessingRef.current = false
      setOauthLoading(null)
      // Keep loading screen visible until navigation happens

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
      
      // Determine if this is a login flow (no onboarding data) vs registration flow (has onboarding data)
      const isLoginFlow = !data.userName && !data.userBirthday && !data.groupName && !data.groupType
      
      // Add timeout protection to database query
      const userQueryPromise = (supabase
        .from("users") as any)
        .select("name, birthday, id")
        .eq("id", session.user.id)
        .maybeSingle() as Promise<{ data: Pick<User, "name" | "birthday"> & { id: string } | null, error: any }>
      
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
      
      // If query fails or times out, for login flow, try checking by email as fallback
      // This handles cases where account linking might have created a new user ID
      let userProfile = user
      if (userError) {
        const isTimeout = (userError as any).timeout === true
        console.warn(`[OAuth] User profile query ${isTimeout ? 'timed out' : 'failed'}:`, userError)
        
        if (isTimeout && isLoginFlow && session.user.email) {
          // For login flow, if query times out, try checking by email
          // Account linking might have created a new user ID, so check by email
          console.log(`[OAuth] Login flow - profile query timed out, checking by email as fallback...`)
          try {
            const { data: userByEmail } = await supabase
              .from("users")
              .select("name, birthday, id")
              .eq("email", session.user.email)
              .maybeSingle()
            
            if (userByEmail) {
              console.log(`[OAuth] Found user profile by email - account linking may have created new user ID`)
              console.log(`[OAuth] Email-based user ID: ${userByEmail.id}, OAuth user ID: ${session.user.id}`)
              // Use the email-based profile
              userProfile = userByEmail
            } else {
              console.log(`[OAuth] No user found by email either - treating as new user`)
              userProfile = null
            }
          } catch (emailCheckError) {
            console.warn(`[OAuth] Email-based fallback check failed:`, emailCheckError)
            userProfile = null
          }
        } else {
          // For registration flow or if no email, assume new user
          if (isTimeout) {
            console.log(`[OAuth] Query timed out - assuming new user and proceeding with onboarding`)
          } else {
            console.warn(`[OAuth] Query error (non-timeout) - proceeding as new user:`, userError)
          }
          // Set userProfile to null to trigger new user flow
          userProfile = null
        }
      }
      
      console.log(`[OAuth] User profile query result:`, {
        hasUser: !!userProfile,
        hasName: !!userProfile?.name,
        hasBirthday: !!userProfile?.birthday,
        name: userProfile?.name,
        birthday: userProfile?.birthday
      })
      
      // CRITICAL: Ensure profile exists and join group if pending (must happen immediately after auth)
      let joinedGroup = false
      try {
        const result = await ensureProfileAndJoinGroup(
          session.user.id,
          session,
          {
            userName: data.userName,
            userBirthday: data.userBirthday,
            userPhoto: data.userPhoto,
            userEmail: data.userEmail,
          }
        )
        joinedGroup = result.joinedGroup
      } catch (profileError: any) {
        // Profile creation failure is critical - cannot proceed
        console.error("[OAuth] ❌ Critical: Profile creation failed:", profileError)
        setShowOAuthLoadingScreen(false) // Hide loading screen before showing error
        Alert.alert(
          "Account Setup Error",
          "Failed to create your profile. Please try signing in again or contact support if the problem persists.",
          [{ text: "OK", onPress: () => router.replace("/(onboarding)/auth") }]
        )
        return
      }

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
        if (joinedGroup) {
          // User just joined a group - go to welcome-post-auth
          console.log(`[OAuth] ✅ User joined group, navigating to welcome-post-auth`)
          setShowOAuthLoadingScreen(false) // Hide loading screen before navigation
          router.replace("/(onboarding)/welcome-post-auth")
          return
        } else if (data.groupName && data.groupType && data.userName && data.userBirthday) {
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
            setShowOAuthLoadingScreen(false) // Hide loading screen before navigation
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
            setShowOAuthLoadingScreen(false) // Hide loading screen before showing error
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
          setShowOAuthLoadingScreen(false) // Hide loading screen before navigation
          router.replace("/(onboarding)/about")
          return
        }
      }

      // User has profile - this is an EXISTING user
      console.log(`[OAuth] Existing user detected (has profile) - checking group membership...`)
      
      // isLoginFlow was already declared above - reuse it
      console.log(`[OAuth] Flow type: ${isLoginFlow ? 'LOGIN' : 'REGISTRATION'}`)
      
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
      
      let hasGroup = false
      if (membershipError) {
        const isTimeout = (membershipError as any).timeout === true
        console.warn(`[OAuth] Group membership query ${isTimeout ? 'timed out' : 'failed'}:`, membershipError)
        
        if (isTimeout && isLoginFlow) {
          // For login flow, if query times out, try checking by email as fallback
          // This handles cases where account linking might have created a new user ID
          console.log(`[OAuth] Login flow - group query timed out, checking by email as fallback...`)
          if (session.user.email) {
            try {
              // Find user by email, then check their group membership
              const { data: userByEmail } = await supabase
                .from("users")
                .select("id")
                .eq("email", session.user.email)
                .maybeSingle()
              
              if (userByEmail) {
                // Check group membership with the email-based user ID (might be different from OAuth user ID)
                const { data: emailMembership } = await supabase
                  .from("group_members")
                  .select("group_id")
                  .eq("user_id", userByEmail.id)
                  .limit(1)
                  .maybeSingle()
                hasGroup = !!emailMembership
                if (hasGroup) {
                  console.log(`[OAuth] ✅ Found group membership with email-based user ID: ${userByEmail.id}`)
                  if (userByEmail.id !== session.user.id) {
                    console.log(`[OAuth] ⚠️ Account linking created new user ID. OAuth ID: ${session.user.id}, Email-based ID: ${userByEmail.id}`)
                    // TODO: This is a problem - we have a group under a different user ID
                    // For now, we'll still route to home, but this indicates account linking didn't work correctly
                  }
                } else {
                  console.log(`[OAuth] No group found with email-based user ID either`)
                }
              } else {
                // No user found by email - retry original query once
                console.log(`[OAuth] No user found by email, retrying original query...`)
                const retryResult = await supabase
                  .from("group_members")
                  .select("group_id")
                  .eq("user_id", session.user.id)
                  .limit(1)
                  .maybeSingle()
                hasGroup = !!retryResult.data
              }
            } catch (emailCheckError) {
              console.warn(`[OAuth] Email-based fallback check failed:`, emailCheckError)
              // Retry original query once as final fallback
              const retryResult = await supabase
                .from("group_members")
                .select("group_id")
                .eq("user_id", session.user.id)
                .limit(1)
                .maybeSingle()
              hasGroup = !!retryResult.data
            }
          } else {
            // No email available - retry original query once
            const retryResult = await supabase
              .from("group_members")
              .select("group_id")
              .eq("user_id", session.user.id)
              .limit(1)
              .maybeSingle()
            hasGroup = !!retryResult.data
          }
        } else {
          // For registration flow or non-timeout errors, assume no group
          console.log(`[OAuth] ${isLoginFlow ? 'Login' : 'Registration'} flow - group query ${isTimeout ? 'timed out' : 'failed'}, assuming no group`)
          hasGroup = false
        }
      } else {
        hasGroup = !!membership
      }
      
      console.log(`[OAuth] Group membership result:`, {
        hasMembership: hasGroup || joinedGroup,
        groupId: (membership as any)?.group_id,
        joinedGroup,
        isLoginFlow
      })

      if (hasGroup || joinedGroup) {
        // User has a group - route based on flow type
        if (isLoginFlow) {
          // LOGIN FLOW: Always go to home if user has group
          console.log(`[OAuth] ✅ Login flow with group, navigating to home`)
          setShowOAuthLoadingScreen(false) // Hide loading screen before navigation
          router.replace("/(main)/home")
          return
        } else {
          // REGISTRATION FLOW: Check if user needs onboarding
          const onboardingKey = getPostAuthOnboardingKey(session.user.id)
          const hasCompletedPostAuth = await AsyncStorage.getItem(onboardingKey)
          
          console.log(`[OAuth] Registration flow. hasCompletedPostAuth: ${!!hasCompletedPostAuth}`)
          
          if (!hasCompletedPostAuth) {
            // New user in registration flow who hasn't completed onboarding
            console.log(`[OAuth] Registration flow without completed onboarding, navigating to welcome-post-auth`)
            setShowOAuthLoadingScreen(false) // Hide loading screen before navigation
            router.replace("/(onboarding)/welcome-post-auth")
          } else {
            // Registration flow but onboarding already completed
            console.log(`[OAuth] Registration flow with completed onboarding, navigating to home`)
            setShowOAuthLoadingScreen(false) // Hide loading screen before navigation
            router.replace("/(main)/home")
          }
          return
        }
      } else {
        // Existing user without group
        if (joinedGroup) {
          // Just joined a group - go to welcome-post-auth
          console.log(`[OAuth] User just joined group, navigating to welcome-post-auth`)
          setShowOAuthLoadingScreen(false) // Hide loading screen before navigation
          router.replace("/(onboarding)/welcome-post-auth")
          return
        } else if (isLoginFlow) {
          // LOGIN FLOW: User exists but has no group - they need to create one
          console.log(`[OAuth] Login flow - existing user without group, navigating to create-group/name-type`)
          setShowOAuthLoadingScreen(false) // Hide loading screen before navigation
          router.replace("/(onboarding)/create-group/name-type")
          return
        } else if (data.groupName && data.groupType) {
          // REGISTRATION FLOW: Has onboarding data, create group
          console.log(`[OAuth] Registration flow - has onboarding data, calling persistOnboarding`)
          setShowOAuthLoadingScreen(false) // Hide loading screen before navigation
          await persistOnboarding(session.user.id, session)
          return
        } else {
          // REGISTRATION FLOW: Missing onboarding data - shouldn't happen, but handle gracefully
          console.log(`[OAuth] Registration flow - no onboarding data, navigating to create-group/name-type`)
          setShowOAuthLoadingScreen(false) // Hide loading screen before navigation
          router.replace("/(onboarding)/create-group/name-type")
          return
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
      setShowOAuthLoadingScreen(false)
      
      const errorMessage = error?.message || error?.error_description || "Failed to complete sign-in. Please try again."
      console.error("[OAuth] Showing error alert:", errorMessage)
      Alert.alert("Error", errorMessage)
    }
  }

  // OAuth loading screen rotation interpolation
  const oauthSpin = oauthRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  return (
    <View style={styles.background}>
      {/* OAuth Loading Screen - Full screen overlay during OAuth processing */}
      {showOAuthLoadingScreen && (
        <View style={styles.oauthLoadingContainer}>
          <Animated.View
            style={[
              styles.oauthLoadingIconContainer,
              {
                transform: [{ rotate: oauthSpin }],
              },
            ]}
          >
            <Image
              source={require("../../assets/images/loading.png")}
              style={styles.oauthLoadingIcon}
              resizeMode="contain"
            />
          </Animated.View>
        </View>
      )}
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
          keyboardDismissMode="on-drag"
        >
          {/* Error Message Toast */}
          {errorMessage && (
            <View style={styles.errorToast}>
              <Text style={styles.errorToastText}>{errorMessage}</Text>
              <TouchableOpacity
                onPress={() => setErrorMessage(null)}
                style={styles.errorToastClose}
              >
                <FontAwesome name="times" size={14} color={theme2Colors.white} />
              </TouchableOpacity>
            </View>
          )}
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
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={styles.backButton}
                  activeOpacity={0.7}
                >
                  <FontAwesome name="angle-left" size={18} color={theme2Colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push("/(onboarding)/forgot-password")}
                  style={styles.forgotPasswordLink}
                >
                  <Text style={styles.forgotPasswordText}>Forgot Password</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.content}>
              {/* Loading Icon - hide when keyboard is visible */}
              {!isKeyboardVisible && (
                <Image 
                  source={require("../../assets/images/loading.png")} 
                  style={styles.wordmark}
                  resizeMode="contain"
                />
              )}
              
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
                  <EmailInput
                    value={email}
                    onChangeText={handleEmailChange}
                    style={[
                      styles.fieldInput,
                      emailFocused && styles.fieldInputFocused
                    ]}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Password</Text>
                  <View style={[
                    styles.passwordContainer,
                    passwordFocusedInput && styles.passwordContainerFocused
                  ]}>
                    <TextInput
                      value={password}
                      onChangeText={(text) => {
                        setPassword(text)
                        // When password has value (including paste), ensure confirm field is visible
                        if (text.length > 0) {
                          setPasswordFocused(true)
                        }
                      }}
                      placeholder="••••••••"
                      placeholderTextColor={theme2Colors.textSecondary}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      keyboardAppearance="light"
                      blurOnSubmit={false}
                      style={[
                        styles.passwordInput,
                        passwordFocusedInput && styles.passwordInputFocused
                      ]}
                      onFocus={() => {
                        setPasswordFocused(true)
                        setPasswordFocusedInput(true)
                      }}
                      onBlur={() => {
                        setPasswordFocusedInput(false)
                        // Keep password focused if confirm password is focused OR if password has value
                        // This prevents the confirm password field from disappearing when clicking on it
                        // or when pasting a password (which might blur the field)
                        if (!confirmPasswordFocused && password.length === 0) {
                          // Small delay to check if confirm password will be focused
                          // This handles the case where user clicks from password to confirm password
                          // Only hide if password is empty (pasted passwords should keep field visible)
                          setTimeout(() => {
                            // Only hide if confirm password didn't get focused AND password is still empty
                            if (!confirmPasswordFocused && password.length === 0) {
                              setPasswordFocused(false)
                            }
                          }, 200) // Delay to allow confirm password field to receive focus
                        }
                        // If confirmPasswordFocused is true or password has value, keep passwordFocused true
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
                        color={theme2Colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {(passwordFocused || confirmPasswordFocused || password.length > 0) && isRegistrationFlow && (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Confirm Password</Text>
                    <View style={[
                      styles.passwordContainer,
                      confirmPasswordFocusedInput && styles.passwordContainerFocused
                    ]}>
                      <TextInput
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="••••••••"
                        placeholderTextColor={theme2Colors.textSecondary}
                        secureTextEntry={!showConfirmPassword}
                        autoCapitalize="none"
                        keyboardAppearance="light"
                        style={[
                          styles.passwordInput,
                          confirmPasswordFocusedInput && styles.passwordInputFocused
                        ]}
                        onFocus={() => {
                          setConfirmPasswordFocused(true)
                          setConfirmPasswordFocusedInput(true)
                          // Keep password focused to prevent confirm password from disappearing
                          setPasswordFocused(true)
                        }}
                        onBlur={() => {
                          setConfirmPasswordFocused(false)
                          setConfirmPasswordFocusedInput(false)
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
                        color={theme2Colors.textSecondary}
                      />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              {/* Only show Continue button if all fields are filled */}
              {(email.trim().length > 0 && password.length > 0 && (isRegistrationFlow ? confirmPassword.length > 0 : true)) && (
                <TouchableOpacity
                  onPress={handleContinue}
                  disabled={continueLoading || persisting}
                  style={styles.primaryButton}
                >
                  {continueLoading || persisting ? (
                    <Text style={styles.primaryButtonText}>Loading...</Text>
                  ) : (
                    <Text style={styles.primaryButtonText}>Continue →</Text>
                  )}
                </TouchableOpacity>
              )}

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Google Sign-In Button */}
              <TouchableOpacity
                onPress={() => {
                  setErrorMessage(null) // Clear any previous errors
                  handleOAuthSignIn("google")
                }}
                disabled={oauthLoading === "google" || persisting || continueLoading}
                style={[
                  styles.googleButton,
                  (oauthLoading === "google" || persisting || continueLoading) && styles.googleButtonDisabled
                ]}
                activeOpacity={0.8}
              >
                {oauthLoading === "google" ? (
                  <Text style={styles.googleButtonText}>Loading...</Text>
                ) : (
                  <>
                    {/* Google Logo */}
                    <Image
                      source={require("../../assets/images/google.jpg")}
                      style={styles.googleLogo}
                      resizeMode="contain"
                    />
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Terms and Privacy Policy - Only show in registration flow */}
              {isRegistrationFlow && (
                <View style={styles.termsContainer}>
                  <Text style={styles.termsText}>
                    By continuing, I confirm that I am 13 or older and agree to the{" "}
                    <Text
                      style={styles.termsLink}
                      onPress={() => Linking.openURL("https://www.getgoodtimes.app/terms")}
                    >
                      Terms
                    </Text>
                    {" "}and{" "}
                    <Text
                      style={styles.termsLink}
                      onPress={() => Linking.openURL("https://www.getgoodtimes.app/privacy")}
                    >
                      Privacy Policy
                    </Text>
                    .
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* No Account Modal - shown when user tries to sign in with non-existent email */}
      <Modal
        visible={showNoAccountModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNoAccountModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
            <TouchableOpacity
              onPress={() => {
                setShowNoAccountModal(false)
                router.replace("/(onboarding)/welcome-1")
              }}
              style={styles.modalCloseButton}
            >
              <FontAwesome name="times" size={16} color={theme2Colors.text} />
            </TouchableOpacity>

            <View style={styles.modalTextContainer}>
              <Text style={styles.modalTitle}>No Account Found</Text>
              <Text style={styles.modalMessage}>
                It looks like you're trying to login, but you don't have an account or group yet.
              </Text>
              <Text style={styles.modalSubmessage}>
                If you're looking to make a new group, tap below. If you're joining a group, ask a member for an invite link.
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => {
                  setShowNoAccountModal(false)
                  router.replace("/(onboarding)/welcome-2")
                }}
                style={styles.modalCTA}
              >
                <Text style={styles.modalCTAText}>Start Creating a Group →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

// Simple email input component - matches the working pattern from settings/profile.tsx
// No memoization, no local state, no refs - just a straightforward controlled component
const EmailInput = ({ value, onChangeText, style, onFocus, onBlur }: { value: string; onChangeText: (text: string) => void; style: any; onFocus?: () => void; onBlur?: () => void }) => {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder="you@email.com"
      placeholderTextColor={theme2Colors.textSecondary}
      keyboardType="email-address"
      autoCapitalize="none"
      autoCorrect={false}
      textContentType="none"
      keyboardAppearance="light"
      blurOnSubmit={false}
      style={style}
      onFocus={onFocus}
      onBlur={onBlur}
    />
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
    paddingBottom: spacing.xl,
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
    color: theme2Colors.textSecondary,
    textDecorationLine: "underline",
  },
  content: {
    gap: spacing.md,
    maxWidth: 460,
  },
  wordmark: {
    width: 180,
    height: 180,
    marginBottom: spacing.xs,
    alignSelf: "flex-start",
    // Remove any shadow or outline effects
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme2Colors.white,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loginLinkContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  loginLinkPrefix: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    color: theme2Colors.text,
  },
  loginLinkText: {
    fontFamily: "Roboto-Bold",
    fontSize: 16,
    color: theme2Colors.text,
    textDecorationLine: "underline",
  },
  fieldsContainer: {
    position: "relative",
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
    backgroundColor: theme2Colors.cream,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme2Colors.textSecondary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  passwordContainerFocused: {
    borderColor: theme2Colors.blue,
  },
  passwordInput: {
    flex: 1,
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    color: theme2Colors.text,
  },
  passwordInputFocused: {
    // Focus state handled by parent container
  },
  eyeButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  modalContent: {
    backgroundColor: theme2Colors.beige,
    borderRadius: 20,
    padding: spacing.xl,
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: theme2Colors.textSecondary,
    position: "relative",
  },
  modalCloseButton: {
    position: "absolute",
    top: spacing.lg,
    right: spacing.lg,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme2Colors.white,
    borderWidth: 1,
    borderColor: theme2Colors.text,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  modalTextContainer: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  modalTitle: {
    fontFamily: "PMGothicLudington-Text115",
    fontSize: 28,
    color: theme2Colors.text,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  modalMessage: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    lineHeight: 24,
    color: theme2Colors.text,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  modalSubmessage: {
    fontFamily: "Roboto-Regular",
    fontSize: 14,
    lineHeight: 20,
    color: theme2Colors.textSecondary,
    textAlign: "center",
  },
  modalActions: {
    marginTop: spacing.lg,
  },
  modalCTA: {
    backgroundColor: theme2Colors.onboardingPink,
    borderRadius: 25,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
  },
  modalCTAText: {
    fontFamily: "Roboto-Bold",
    fontSize: 18,
    color: theme2Colors.white,
  },
  errorToast: {
    backgroundColor: theme2Colors.red,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: theme2Colors.text,
  },
  errorToastText: {
    fontFamily: "Roboto-Regular",
    fontSize: 14,
    color: theme2Colors.white,
    flex: 1,
    marginRight: spacing.sm,
  },
  errorToastClose: {
    padding: spacing.xs,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.md,
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme2Colors.textSecondary,
    opacity: 0.3,
  },
  dividerText: {
    fontFamily: "Roboto-Regular",
    fontSize: 14,
    color: theme2Colors.textSecondary,
    paddingHorizontal: spacing.sm,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme2Colors.white,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: theme2Colors.text,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    minHeight: 56,
    gap: spacing.sm,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleButtonText: {
    fontFamily: "Roboto-Bold",
    fontSize: 18,
    color: theme2Colors.text,
  },
  googleLogo: {
    width: 20,
    height: 20,
  },
  oauthLoadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme2Colors.beige,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  oauthLoadingIconContainer: {
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  oauthLoadingIcon: {
    width: 120,
    height: 120,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  termsContainer: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  termsText: {
    fontFamily: "Roboto-Regular",
    fontSize: 12,
    lineHeight: 18,
    color: theme2Colors.textSecondary,
    textAlign: "center",
  },
  termsLink: {
    fontFamily: "Roboto-Regular",
    fontSize: 12,
    color: theme2Colors.blue,
    textDecorationLine: "underline",
  },
})

