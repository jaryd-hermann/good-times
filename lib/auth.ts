import { supabase } from "./supabase"
import type { User } from "./types"
import AsyncStorage from "@react-native-async-storage/async-storage"

// Mutex to prevent concurrent refresh attempts
let refreshInProgress = false
let refreshPromise: Promise<any> | null = null

// CRITICAL: Track explicit logout to distinguish from expired sessions
const EXPLICIT_LOGOUT_FLAG = "explicit_logout"

export async function signOut() {
  // Set flag BEFORE signing out to mark this as explicit logout
  try {
    await AsyncStorage.setItem(EXPLICIT_LOGOUT_FLAG, Date.now().toString())
    console.log("[auth] signOut: Marked as explicit logout")
  } catch (error) {
    console.warn("[auth] signOut: Failed to set explicit logout flag:", error)
  }
  
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function isExplicitLogout(): Promise<boolean> {
  try {
    const flag = await AsyncStorage.getItem(EXPLICIT_LOGOUT_FLAG)
    return !!flag
  } catch (error) {
    console.warn("[auth] isExplicitLogout: Failed to check flag:", error)
    return false
  }
}

export async function clearExplicitLogoutFlag(): Promise<void> {
  try {
    await AsyncStorage.removeItem(EXPLICIT_LOGOUT_FLAG)
    console.log("[auth] clearExplicitLogoutFlag: Flag cleared")
  } catch (error) {
    console.warn("[auth] clearExplicitLogoutFlag: Failed to clear flag:", error)
  }
}

export async function getCurrentSession() {
  try {
    // Add timeout protection to prevent hanging
    // Use longer timeout for simulator/slow networks
    const getSessionPromise = supabase.auth.getSession()
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("getSession timeout")), 15000) // Increased to 15s
    )
    
    const result: any = await Promise.race([getSessionPromise, timeoutPromise])
    return result?.data?.session || null
  } catch (error: any) {
    // Don't log timeout errors as errors - they're expected in some cases
    if (error.message?.includes("timeout")) {
      console.log("[auth] getCurrentSession timeout (network may be slow)")
    } else {
      console.error("[auth] getCurrentSession failed:", error.message)
    }
    // Return null on timeout/error - let caller handle it
    return null
  }
}

export async function refreshSession(retries = 3): Promise<any> {
  const maxRetries = retries
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Increase timeout with each attempt: 15s, 20s, 25s
      const timeoutMs = 15000 + (attempt * 5000)
      
      const refreshPromise = supabase.auth.refreshSession()
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("refreshSession timeout")), timeoutMs)
      )
      
      const result: any = await Promise.race([refreshPromise, timeoutPromise])
      const { data: { session }, error } = result
      
      if (error) {
        // Check if error is retryable (network errors, timeouts, 5xx errors)
        const isRetryable = 
          error.message?.includes("network") ||
          error.message?.includes("timeout") ||
          error.message?.includes("ECONNREFUSED") ||
          error.message?.includes("ENOTFOUND") ||
          (error.status >= 500 && error.status < 600)
        
        // Don't retry on auth errors (401, 403) or if this is the last attempt
        if (!isRetryable || attempt === maxRetries - 1) {
          console.error(`[auth] refreshSession failed (attempt ${attempt + 1}/${maxRetries}):`, error.message)
          throw error
        }
        
        // Wait before retry (exponential backoff: 1s, 2s, 4s)
        const backoffMs = Math.pow(2, attempt) * 1000
        console.log(`[auth] refreshSession retryable error (attempt ${attempt + 1}/${maxRetries}), retrying in ${backoffMs}ms...`)
        await new Promise(resolve => setTimeout(resolve, backoffMs))
        continue
      }
      
      // Success
      if (attempt > 0) {
        console.log(`[auth] refreshSession succeeded on attempt ${attempt + 1}/${maxRetries}`)
      }
      return session
    } catch (error: any) {
      // Check if this is a timeout or network error (retryable)
      const isRetryable = 
        error.message?.includes("timeout") ||
        error.message?.includes("network") ||
        error.message?.includes("ECONNREFUSED") ||
        error.message?.includes("ENOTFOUND")
      
      if (!isRetryable || attempt === maxRetries - 1) {
        // Not retryable or last attempt - log as warning instead of error for timeout cases
        if (error.message?.includes("timeout")) {
          console.warn(`[auth] refreshSession timed out after ${attempt + 1} attempt(s) - this may be due to slow network`)
        } else {
          console.error(`[auth] refreshSession failed after ${attempt + 1} attempt(s):`, error.message)
        }
        throw error
      }
      
      // Wait before retry (exponential backoff: 1s, 2s, 4s)
      const backoffMs = Math.pow(2, attempt) * 1000
      console.log(`[auth] refreshSession timeout/network error (attempt ${attempt + 1}/${maxRetries}), retrying in ${backoffMs}ms...`)
      await new Promise(resolve => setTimeout(resolve, backoffMs))
    }
  }
  
  // Should never reach here, but TypeScript needs it
  throw new Error("refreshSession: Max retries exceeded")
}

// Track last successful token refresh time to avoid unnecessary checks
let lastTokenRefreshTime: number | null = null

// Call this when TOKEN_REFRESHED event fires
export function markTokenRefreshed(): void {
  lastTokenRefreshTime = Date.now()
  console.log("[auth] Token refresh marked - session should be valid")
}

// Check if we should skip ensureValidSession() because Supabase just refreshed
// Returns true if we should skip (trust Supabase's refresh)
export function shouldSkipSessionCheck(): boolean {
  if (!lastTokenRefreshTime) {
    return false
  }
  const timeSinceRefresh = Date.now() - lastTokenRefreshTime
  const shouldSkip = timeSinceRefresh < 300000 // 5 minutes
  if (shouldSkip) {
    console.log("[auth] shouldSkipSessionCheck: TRUE - Recent token refresh, skipping session check", {
      timeSinceRefreshMs: timeSinceRefresh,
      timeSinceRefreshMinutes: Math.floor(timeSinceRefresh / 60000),
    })
  }
  return shouldSkip
}

// Check if session is expired or about to expire (within 5 minutes)
export async function isSessionExpired(): Promise<boolean> {
  try {
    // CRITICAL: If Supabase just refreshed token (within last 5 minutes), trust it
    // This prevents unnecessary refresh attempts when network is slow
    console.log("[auth] isSessionExpired: Checking lastTokenRefreshTime", {
      hasLastTokenRefreshTime: !!lastTokenRefreshTime,
      lastTokenRefreshTime,
      currentTime: Date.now(),
    })
    if (lastTokenRefreshTime) {
      const timeSinceRefresh = Date.now() - lastTokenRefreshTime
      console.log("[auth] isSessionExpired: Time since refresh", {
        timeSinceRefreshMs: timeSinceRefresh,
        timeSinceRefreshMinutes: Math.floor(timeSinceRefresh / 60000),
        isWithin5Minutes: timeSinceRefresh < 300000,
      })
      if (timeSinceRefresh < 300000) { // 5 minutes - extended window
        console.log("[auth] Recent token refresh detected, assuming session is valid", {
          timeSinceRefreshMs: timeSinceRefresh,
          timeSinceRefreshMinutes: Math.floor(timeSinceRefresh / 60000),
        })
        return false // Session was just refreshed, assume valid
      } else {
        console.log("[auth] Token refresh was too long ago, checking session normally", {
          timeSinceRefreshMs: timeSinceRefresh,
          timeSinceRefreshMinutes: Math.floor(timeSinceRefresh / 60000),
        })
      }
    } else {
      console.log("[auth] isSessionExpired: No lastTokenRefreshTime set, checking session normally")
    }
    
    const session = await getCurrentSession()
    if (!session) {
      // No session - could be timeout or truly no session
      // If refresh is in progress, don't assume expired (might be network issue)
      if (refreshInProgress) {
        console.log("[auth] No session found but refresh in progress, waiting...")
        return false // Don't trigger another refresh
      }
      
      // CRITICAL: If getCurrentSession timed out, don't assume expired
      // Supabase might have the session but network is slow
      // Check if we recently had a token refresh (within 5 minutes)
      if (lastTokenRefreshTime && (Date.now() - lastTokenRefreshTime) < 300000) {
        console.log("[auth] getCurrentSession timeout but recent refresh - assuming session valid", {
          timeSinceRefreshMs: Date.now() - lastTokenRefreshTime,
          timeSinceRefreshMinutes: Math.floor((Date.now() - lastTokenRefreshTime) / 60000),
        })
        return false // Assume valid if recent refresh
      }
      
      return true // No session and no refresh in progress
    }
    
    // Check if session expires within 5 minutes
    const expiresAt = session.expires_at
    if (!expiresAt) return false // No expiry info, assume valid
    
    const expiresIn = expiresAt - Math.floor(Date.now() / 1000)
    return expiresIn < 300 // Less than 5 minutes
  } catch (error) {
    console.error("[auth] isSessionExpired check failed:", error)
    // If refresh is in progress, don't assume expired
    if (refreshInProgress) {
      return false
    }
    
    // If we recently had a token refresh, assume valid despite error (within 5 minutes)
    if (lastTokenRefreshTime && (Date.now() - lastTokenRefreshTime) < 300000) {
      console.log("[auth] Error checking expiry but recent refresh - assuming session valid", {
        timeSinceRefreshMs: Date.now() - lastTokenRefreshTime,
        timeSinceRefreshMinutes: Math.floor((Date.now() - lastTokenRefreshTime) / 60000),
      })
      return false
    }
    
    return true // Assume expired on error (unless refresh in progress or recent refresh)
  }
}

// Refresh session if expired or about to expire
// Uses mutex to prevent concurrent refresh attempts
export async function ensureValidSession(): Promise<boolean> {
  const startTime = Date.now()
  console.log("[auth] ensureValidSession: START", {
    refreshInProgress,
    hasExistingPromise: !!refreshPromise,
    timestamp: new Date().toISOString(),
  })

  // If refresh is already in progress, wait for it instead of starting a new one
  if (refreshInProgress && refreshPromise) {
    console.log("[auth] ensureValidSession: Refresh already in progress, waiting for existing refresh...")
    try {
      const result = await refreshPromise
      const elapsed = Date.now() - startTime
      console.log("[auth] ensureValidSession: Waited for existing refresh", {
        result: !!result,
        elapsedMs: elapsed,
      })
      if (result) {
        return true
      }
      // Refresh completed but returned false, check session directly
      const session = await getCurrentSession()
      const hasSession = !!session
      console.log("[auth] ensureValidSession: Existing refresh returned false, checking session directly", {
        hasSession,
      })
      return hasSession
    } catch (error: any) {
      // Existing refresh failed, continue with our own check
      console.log("[auth] ensureValidSession: Existing refresh failed, checking session...", {
        error: error?.message,
      })
      // Reset mutex since refresh failed
      refreshInProgress = false
      refreshPromise = null
    }
  }

  // CRITICAL: Short-circuit if Supabase just refreshed token (within last 5 minutes)
  // This prevents unnecessary refresh attempts when network is slow
  // If TOKEN_REFRESHED fired, Supabase has a valid session - we just can't read it due to network issues
  if (lastTokenRefreshTime) {
    const timeSinceRefresh = Date.now() - lastTokenRefreshTime
    if (timeSinceRefresh < 300000) { // 5 minutes - extended window
      console.log("[auth] ensureValidSession: Recent token refresh detected, skipping refresh check", {
        timeSinceRefreshMs: timeSinceRefresh,
        timeSinceRefreshMinutes: Math.floor(timeSinceRefresh / 60000),
        lastTokenRefreshTime,
      })
      return true // Session was just refreshed, assume valid
    } else {
      console.log("[auth] ensureValidSession: Token refresh was too long ago, will check session", {
        timeSinceRefreshMs: timeSinceRefresh,
        timeSinceRefreshMinutes: Math.floor(timeSinceRefresh / 60000),
      })
    }
  }

  try {
    const expired = await isSessionExpired()
    console.log("[auth] ensureValidSession: Session expiry check", {
      expired,
      refreshInProgress,
    })
    
    if (!expired) {
      const elapsed = Date.now() - startTime
      console.log("[auth] ensureValidSession: Session valid, no refresh needed", {
        elapsedMs: elapsed,
      })
      return true // Session is valid, no refresh needed
    }

    // Session is expired - check mutex again before starting refresh
    if (refreshInProgress && refreshPromise) {
      console.log("[auth] ensureValidSession: Refresh started while checking expiry, waiting...")
      try {
        const result = await refreshPromise
        const elapsed = Date.now() - startTime
        console.log("[auth] ensureValidSession: Got result from concurrent refresh", {
          result: !!result,
          elapsedMs: elapsed,
        })
        if (result) {
          return true
        }
        const session = await getCurrentSession()
        const hasSession = !!session
        console.log("[auth] ensureValidSession: Concurrent refresh returned false, checking session", {
          hasSession,
        })
        return hasSession
      } catch (error: any) {
        console.log("[auth] ensureValidSession: Concurrent refresh failed", {
          error: error?.message,
        })
        refreshInProgress = false
        refreshPromise = null
      }
    }

    // Start new refresh with mutex protection
    console.log("[auth] ensureValidSession: Starting new session refresh...")
    refreshInProgress = true
    const refreshStartTime = Date.now()
    refreshPromise = (async () => {
      try {
        console.log("[auth] ensureValidSession: refreshPromise START - Session expired or expiring soon, refreshing...")
        await refreshSession() // Will retry automatically
        const refreshElapsed = Date.now() - refreshStartTime
        console.log("[auth] ensureValidSession: refreshPromise SUCCESS - Session refreshed successfully", {
          refreshElapsedMs: refreshElapsed,
        })
        return true
      } catch (refreshError: any) {
        // Refresh failed after all retries
        const refreshElapsed = Date.now() - refreshStartTime
        console.error("[auth] ensureValidSession: refreshPromise FAILED - refresh failed after retries", {
          error: refreshError.message,
          errorType: refreshError.constructor?.name,
          refreshElapsedMs: refreshElapsed,
        })
        
        // Check if session still exists in storage (might be valid despite refresh failure)
        const storedSession = await getCurrentSession()
        console.log("[auth] ensureValidSession: Checking stored session after refresh failure", {
          hasStoredSession: !!storedSession,
        })
        
        if (storedSession) {
          console.log("[auth] ensureValidSession: Session exists in storage despite refresh failure, checking validity...")
          // Check if stored session is still valid (not expired)
          const expiresAt = storedSession.expires_at
          if (expiresAt) {
            const expiresIn = expiresAt - Math.floor(Date.now() / 1000)
            const expiresInMinutes = Math.floor(expiresIn / 60)
            console.log("[auth] ensureValidSession: Stored session expiry check", {
              expiresAt: new Date(expiresAt * 1000).toISOString(),
              expiresInSeconds: expiresIn,
              expiresInMinutes,
              isValid: expiresIn > 0,
            })
            if (expiresIn > 0) {
              console.log("[auth] ensureValidSession: Stored session is still valid, continuing with it")
              return true // Session is valid, continue
            } else {
              console.log("[auth] ensureValidSession: Stored session is expired")
            }
          } else {
            console.log("[auth] ensureValidSession: Stored session has no expiry info")
          }
        }
        
        // CRITICAL: Try biometric restore as fallback (if enabled)
        // This restores session using stored biometric credentials
        console.log("[auth] ensureValidSession: Attempting biometric restore as fallback...")
        try {
          const { 
            getBiometricPreference, 
            getBiometricRefreshToken,
            getBiometricUserId 
          } = await import("./biometric")
          
          const biometricEnabled = await getBiometricPreference()
          if (biometricEnabled) {
            const biometricRefreshToken = await getBiometricRefreshToken()
            const biometricUserId = await getBiometricUserId()
            
            if (biometricRefreshToken && biometricUserId) {
              console.log("[auth] ensureValidSession: Biometric credentials found, attempting restore...")
              // Use refresh token to restore session (no biometric prompt needed - token is already stored)
              const { data, error } = await supabase.auth.refreshSession({
                refresh_token: biometricRefreshToken,
              })
              
              if (!error && data?.session) {
                console.log("[auth] ensureValidSession: Biometric restore SUCCESS - Session restored")
                return true // Session restored successfully
              } else {
                console.warn("[auth] ensureValidSession: Biometric restore failed", {
                  error: error?.message,
                })
                // Clear invalid biometric credentials
                const { clearBiometricCredentials } = await import("./biometric")
                await clearBiometricCredentials()
              }
            } else {
              console.log("[auth] ensureValidSession: No biometric credentials found")
            }
          } else {
            console.log("[auth] ensureValidSession: Biometric not enabled")
          }
        } catch (biometricError: any) {
          console.error("[auth] ensureValidSession: Biometric restore error", {
            error: biometricError?.message,
          })
          // Don't fail - continue to return false
        }
        
        // No valid session found and biometric restore failed
        console.log("[auth] ensureValidSession: No valid session found after refresh failure and biometric restore attempt")
        return false
      } finally {
        refreshInProgress = false
        refreshPromise = null
        const totalElapsed = Date.now() - refreshStartTime
        console.log("[auth] ensureValidSession: refreshPromise FINALLY - Mutex cleared", {
          totalElapsedMs: totalElapsed,
        })
      }
    })()

    const result = await refreshPromise
    const totalElapsed = Date.now() - startTime
    console.log("[auth] ensureValidSession: END", {
      result,
      totalElapsedMs: totalElapsed,
    })
    return result
  } catch (error: any) {
    // Make sure to reset mutex on error
    const totalElapsed = Date.now() - startTime
    if (refreshInProgress) {
      refreshInProgress = false
      refreshPromise = null
    }
    console.error("[auth] ensureValidSession: EXCEPTION", {
      error: error.message,
      errorType: error.constructor?.name,
      stack: error.stack,
      totalElapsedMs: totalElapsed,
    })
    // Check stored session as fallback
    try {
      const storedSession = await getCurrentSession()
      console.log("[auth] ensureValidSession: Checking fallback stored session", {
        hasStoredSession: !!storedSession,
      })
      if (storedSession) {
        const expiresAt = storedSession.expires_at
        if (expiresAt) {
          const expiresIn = expiresAt - Math.floor(Date.now() / 1000)
          const expiresInMinutes = Math.floor(expiresIn / 60)
          console.log("[auth] ensureValidSession: Fallback session expiry check", {
            expiresAt: new Date(expiresAt * 1000).toISOString(),
            expiresInSeconds: expiresIn,
            expiresInMinutes,
            isValid: expiresIn > 0,
          })
          if (expiresIn > 0) {
            console.log("[auth] ensureValidSession: Using stored session as fallback")
            return true
          }
        }
      }
    } catch (fallbackError: any) {
      console.error("[auth] ensureValidSession: Fallback session check failed", {
        error: fallbackError?.message,
      })
    }
    console.log("[auth] ensureValidSession: Returning false (no valid session)")
    return false
  }
}

export function onAuthStateChange(callback: (user: User | null) => void) {
  return supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      const { data } = await supabase.from("users").select("*").eq("id", session.user.id).single()
      callback(data)
    } else {
      callback(null)
    }
  })
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })
  if (error) throw error
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email)
  if (error) throw error
}
