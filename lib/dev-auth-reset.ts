/**
 * DEV UTILITY: Clear all auth-related storage for testing
 * 
 * Use this when testing auth flows to ensure a clean state.
 * This clears:
 * - Supabase session tokens (all keys starting with "sb-")
 * - Onboarding completion flags
 * - Pending group joins
 * - Current group ID
 * - Biometric credentials
 * - PostHog user data
 * 
 * ⚠️ ONLY AVAILABLE IN DEVELOPMENT MODE
 */

import AsyncStorage from "@react-native-async-storage/async-storage"
import { supabase } from "./supabase"
import { clearBiometricCredentials } from "./biometric"

export async function clearAllAuthState(): Promise<void> {
  if (!__DEV__) {
    console.warn("[dev-auth-reset] clearAllAuthState is only available in development mode")
    return
  }

  console.log("[dev-auth-reset] 🧹 Clearing all auth state...")

  try {
    // 1. Sign out from Supabase (clears Supabase session tokens)
    try {
      await supabase.auth.signOut()
      console.log("[dev-auth-reset] ✓ Cleared Supabase session")
    } catch (error) {
      console.warn("[dev-auth-reset] Failed to sign out from Supabase:", error)
    }

    // 2. Clear all Supabase storage keys (they start with "sb-")
    try {
      const allKeys = await AsyncStorage.getAllKeys()
      const supabaseKeys = allKeys.filter(key => key.startsWith("sb-"))
      if (supabaseKeys.length > 0) {
        await AsyncStorage.multiRemove(supabaseKeys)
        console.log(`[dev-auth-reset] ✓ Cleared ${supabaseKeys.length} Supabase storage keys`)
      }
    } catch (error) {
      console.warn("[dev-auth-reset] Failed to clear Supabase keys:", error)
    }

    // 3. Clear onboarding completion flags (pattern: "has_completed_post_auth_onboarding_*")
    try {
      const allKeys = await AsyncStorage.getAllKeys()
      const onboardingKeys = allKeys.filter(key => 
        key.startsWith("has_completed_post_auth_onboarding_")
      )
      if (onboardingKeys.length > 0) {
        await AsyncStorage.multiRemove(onboardingKeys)
        console.log(`[dev-auth-reset] ✓ Cleared ${onboardingKeys.length} onboarding flags`)
      }
    } catch (error) {
      console.warn("[dev-auth-reset] Failed to clear onboarding keys:", error)
    }

    // 4. Clear app-specific storage
    const appKeys = [
      "pending_group_join",
      "current_group_id",
      "has_requested_notifications",
    ]
    
    // Also clear group visit timestamps (pattern: "group_visited_*")
    try {
      const allKeys = await AsyncStorage.getAllKeys()
      const groupVisitKeys = allKeys.filter(key => key.startsWith("group_visited_"))
      appKeys.push(...groupVisitKeys)
    } catch (error) {
      console.warn("[dev-auth-reset] Failed to get group visit keys:", error)
    }

    try {
      await AsyncStorage.multiRemove(appKeys)
      console.log(`[dev-auth-reset] ✓ Cleared ${appKeys.length} app storage keys`)
    } catch (error) {
      console.warn("[dev-auth-reset] Failed to clear app keys:", error)
    }

    // 5. Clear biometric credentials
    try {
      await clearBiometricCredentials()
      console.log("[dev-auth-reset] ✓ Cleared biometric credentials")
    } catch (error) {
      console.warn("[dev-auth-reset] Failed to clear biometric credentials:", error)
    }

    // 6. Clear OnboardingProvider storage (if exists)
    try {
      const allKeys = await AsyncStorage.getAllKeys()
      const onboardingProviderKeys = allKeys.filter(key => 
        key.startsWith("onboarding_data_")
      )
      if (onboardingProviderKeys.length > 0) {
        await AsyncStorage.multiRemove(onboardingProviderKeys)
        console.log(`[dev-auth-reset] ✓ Cleared ${onboardingProviderKeys.length} onboarding provider keys`)
      }
    } catch (error) {
      console.warn("[dev-auth-reset] Failed to clear onboarding provider keys:", error)
    }

    console.log("[dev-auth-reset] ✅ All auth state cleared! Restart app to see changes.")
  } catch (error) {
    console.error("[dev-auth-reset] ❌ Error clearing auth state:", error)
    throw error
  }
}

/**
 * Quick check: List all auth-related keys in storage
 */
export async function listAuthKeys(): Promise<string[]> {
  if (!__DEV__) {
    return []
  }

  try {
    const allKeys = await AsyncStorage.getAllKeys()
    const authKeys = allKeys.filter(key => 
      key.startsWith("sb-") ||
      key.startsWith("has_completed_post_auth_onboarding_") ||
      key.startsWith("group_visited_") ||
      key.startsWith("onboarding_data_") ||
      key === "pending_group_join" ||
      key === "current_group_id" ||
      key === "has_requested_notifications"
    )
    return authKeys
  } catch (error) {
    console.error("[dev-auth-reset] Failed to list auth keys:", error)
    return []
  }
}

