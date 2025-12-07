import { supabase } from "./supabase"
import type { User } from "./types"

// Mutex to prevent concurrent refresh attempts
let refreshInProgress = false
let refreshPromise: Promise<any> | null = null

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
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

// Check if session is expired or about to expire (within 5 minutes)
export async function isSessionExpired(): Promise<boolean> {
  try {
    const session = await getCurrentSession()
    if (!session) {
      // No session - could be timeout or truly no session
      // If refresh is in progress, don't assume expired (might be network issue)
      if (refreshInProgress) {
        console.log("[auth] No session found but refresh in progress, waiting...")
        return false // Don't trigger another refresh
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
    return true // Assume expired on error (unless refresh in progress)
  }
}

// Refresh session if expired or about to expire
// Uses mutex to prevent concurrent refresh attempts
export async function ensureValidSession(): Promise<boolean> {
  // If refresh is already in progress, wait for it instead of starting a new one
  if (refreshInProgress && refreshPromise) {
    console.log("[auth] Refresh already in progress, waiting for existing refresh...")
    try {
      const result = await refreshPromise
      if (result) {
        return true
      }
      // Refresh completed but returned false, check session directly
      const session = await getCurrentSession()
      return !!session
    } catch (error) {
      // Existing refresh failed, continue with our own check
      console.log("[auth] Existing refresh failed, checking session...")
      // Reset mutex since refresh failed
      refreshInProgress = false
      refreshPromise = null
    }
  }

  try {
    const expired = await isSessionExpired()
    if (!expired) {
      return true // Session is valid, no refresh needed
    }

    // Session is expired - check mutex again before starting refresh
    if (refreshInProgress && refreshPromise) {
      console.log("[auth] Refresh started while checking, waiting...")
      try {
        const result = await refreshPromise
        if (result) {
          return true
        }
        const session = await getCurrentSession()
        return !!session
      } catch (error) {
        refreshInProgress = false
        refreshPromise = null
      }
    }

    // Start new refresh with mutex protection
    refreshInProgress = true
    refreshPromise = (async () => {
      try {
        console.log("[auth] Session expired or expiring soon, refreshing...")
        await refreshSession() // Will retry automatically
        console.log("[auth] Session refreshed successfully")
        return true
      } catch (refreshError: any) {
        // Refresh failed after all retries
        console.error("[auth] ensureValidSession: refresh failed after retries:", refreshError.message)
        
        // Check if session still exists in storage (might be valid despite refresh failure)
        const storedSession = await getCurrentSession()
        if (storedSession) {
          console.log("[auth] Session exists in storage despite refresh failure, checking validity...")
          // Check if stored session is still valid (not expired)
          const expiresAt = storedSession.expires_at
          if (expiresAt) {
            const expiresIn = expiresAt - Math.floor(Date.now() / 1000)
            if (expiresIn > 0) {
              console.log("[auth] Stored session is still valid, continuing with it")
              return true // Session is valid, continue
            }
          }
        }
        
        // No valid session found
        return false
      } finally {
        refreshInProgress = false
        refreshPromise = null
      }
    })()

    const result = await refreshPromise
    return result
  } catch (error: any) {
    // Make sure to reset mutex on error
    if (refreshInProgress) {
      refreshInProgress = false
      refreshPromise = null
    }
    console.error("[auth] ensureValidSession failed:", error.message)
    // Check stored session as fallback
    try {
      const storedSession = await getCurrentSession()
      if (storedSession) {
        const expiresAt = storedSession.expires_at
        if (expiresAt) {
          const expiresIn = expiresAt - Math.floor(Date.now() / 1000)
          if (expiresIn > 0) {
            console.log("[auth] Using stored session as fallback")
            return true
          }
        }
      }
    } catch (fallbackError) {
      console.error("[auth] Fallback session check failed:", fallbackError)
    }
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
