import * as LocalAuthentication from "expo-local-authentication"
import * as SecureStore from "expo-secure-store"
import AsyncStorage from "@react-native-async-storage/async-storage"

const BIOMETRIC_ENABLED_KEY = "biometric_enabled"
const REFRESH_TOKEN_KEY = "biometric_refresh_token"
const USER_ID_KEY = "biometric_user_id"

/**
 * Check if biometric authentication is available on the device
 */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync()
    if (!compatible) return false

    const enrolled = await LocalAuthentication.isEnrolledAsync()
    return enrolled
  } catch (error) {
    console.error("[biometric] error checking availability:", error)
    return false
  }
}

/**
 * Get the type of biometric authentication available
 */
export async function getBiometricType(): Promise<"face" | "fingerprint" | "iris" | "none"> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync()
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return "face"
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return "fingerprint"
    }
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return "iris"
    }
    return "none"
  } catch (error) {
    console.error("[biometric] error getting type:", error)
    return "none"
  }
}

/**
 * Prompt user for biometric authentication
 */
export async function authenticateWithBiometric(
  reason: string = "Authenticate to continue"
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: "Cancel",
      disableDeviceFallback: false, // Allow password fallback
    })

    if (result.success) {
      return { success: true }
    }

    if (result.error === "user_cancel") {
      return { success: false, error: "Authentication cancelled" }
    }

    return { success: false, error: result.error || "Authentication failed" }
  } catch (error: any) {
    console.error("[biometric] authentication error:", error)
    return { success: false, error: error.message || "Authentication failed" }
  }
}

/**
 * Check if biometric authentication is enabled in user preferences
 */
export async function getBiometricPreference(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY)
    return value === "true"
  } catch (error) {
    console.error("[biometric] error getting preference:", error)
    return false
  }
}

/**
 * Save biometric authentication preference
 */
export async function saveBiometricPreference(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, "true")
    } else {
      await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, "false")
      // Clear stored credentials when disabling
      await clearBiometricCredentials()
    }
  } catch (error) {
    console.error("[biometric] error saving preference:", error)
    throw error
  }
}

/**
 * Save refresh token and user ID for biometric login
 */
export async function saveBiometricCredentials(refreshToken: string, userId: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken)
    await SecureStore.setItemAsync(USER_ID_KEY, userId)
  } catch (error) {
    console.error("[biometric] error saving credentials:", error)
    throw error
  }
}

/**
 * Get stored refresh token for biometric login
 */
export async function getBiometricRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
  } catch (error) {
    console.error("[biometric] error getting refresh token:", error)
    return null
  }
}

/**
 * Get stored user ID for biometric login
 */
export async function getBiometricUserId(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(USER_ID_KEY)
  } catch (error) {
    console.error("[biometric] error getting user ID:", error)
    return null
  }
}

/**
 * Clear all stored biometric credentials
 */
export async function clearBiometricCredentials(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY)
    await SecureStore.deleteItemAsync(USER_ID_KEY)
  } catch (error) {
    console.error("[biometric] error clearing credentials:", error)
    // Don't throw - clearing is best effort
  }
}

