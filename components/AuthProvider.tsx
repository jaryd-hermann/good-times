"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { AppState, AppStateStatus } from "react-native"
import type { User } from "../lib/types"
import { getBiometricPreference, saveBiometricCredentials, clearBiometricCredentials } from "../lib/biometric"
import { ensureValidSession } from "../lib/auth"

// Import usePostHog hook
// PostHogProvider is always rendered in _layout.tsx, so this hook is safe to call
import { usePostHog } from "posthog-react-native"

// Import supabase safely to prevent crashes
let supabase: any
try {
  const supabaseModule = require("../lib/supabase")
  supabase = supabaseModule.supabase
} catch (error) {
  console.error("[AuthProvider] Failed to import supabase:", error)
  // Create a minimal fallback to prevent crash
  supabase = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: () => Promise.resolve({ error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  }
}

interface AuthContextType {
  user: User | null
  loading: boolean
  refreshing: boolean // New: indicates session refresh in progress
  restoringSession: boolean // New: indicates session restoration in progress (after SIGNED_OUT)
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refreshing: false,
  restoringSession: false,
  signOut: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false) // Track session refresh state
  const [restoringSession, setRestoringSession] = useState(false) // Track session restoration state
  
  // Get PostHog instance (PostHogProvider is always rendered in _layout.tsx)
  // posthog will be null/undefined if PostHog is not configured or initialization failed
  const posthog = usePostHog()
  
  // Debug PostHog instance
  useEffect(() => {
    if (__DEV__) {
      console.log('[PostHog] usePostHog hook returned:', posthog ? 'valid instance' : 'null/undefined')
      if (posthog) {
        console.log('[PostHog] PostHog instance methods:', Object.keys(posthog))
      }
    }
  }, [posthog])

  useEffect(() => {
    let sessionInitialized = false
    let initialSessionTimeout: ReturnType<typeof setTimeout> | null = null
    let maxTimeout: ReturnType<typeof setTimeout> | null = null

    // CRITICAL: Maximum timeout to prevent infinite loading state
    // If we haven't initialized within 10 seconds, force loading to false
    maxTimeout = setTimeout(() => {
      if (!sessionInitialized) {
        console.warn("[AuthProvider] Maximum timeout reached - forcing loading to false")
        setLoading(false)
        sessionInitialized = true
      }
    }, 10000) // 10 second maximum

    // Listen for auth changes - this fires immediately with current session
    // This is the PRIMARY way to get session state (non-blocking, event-driven)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
      console.log(`[AuthProvider] onAuthStateChange: event=${event}, hasSession=${!!session}`)
      
      // CRITICAL: Mark token refresh when Supabase auto-refreshes
      // This prevents unnecessary refresh attempts when network is slow
      if (event === "TOKEN_REFRESHED") {
        try {
          const { markTokenRefreshed } = await import("../lib/auth")
          markTokenRefreshed()
          console.log("[AuthProvider] Token refreshed by Supabase - marking as valid")
        } catch (error) {
          console.warn("[AuthProvider] Failed to mark token refresh:", error)
        }
      }
      
      // Mark that we've received initial session state
      if (!sessionInitialized) {
        sessionInitialized = true
        if (initialSessionTimeout) {
          clearTimeout(initialSessionTimeout)
          initialSessionTimeout = null
        }
        if (maxTimeout) {
          clearTimeout(maxTimeout)
          maxTimeout = null
        }
      }

      if (session?.user) {
        // CRITICAL: Only load user if app is in foreground
        // When app is backgrounded, Supabase can still refresh tokens, but network requests are throttled
        // Attempting to load user data while backgrounded will timeout and create noise in logs
        const currentAppState = AppState.currentState
        const isAppActive = currentAppState === 'active'
        
        if (isAppActive) {
          // App is active - safe to load user data
          await loadUser(session.user.id)
        } else {
          // App is backgrounded - skip user load, but mark token as refreshed
          // User data will be loaded when app comes to foreground
          console.log("[AuthProvider] TOKEN_REFRESHED while app backgrounded - skipping user load (will load on foreground)")
          // Still mark token as refreshed so we know session is valid
          if (!sessionInitialized) {
            // If this is initial load and app is backgrounded, set loading to false
            // User will be loaded when app comes to foreground
            setLoading(false)
          }
        }
        
        // Save biometric credentials if enabled (this is safe to do even when backgrounded)
        try {
          const biometricEnabled = await getBiometricPreference()
          if (biometricEnabled && session.refresh_token) {
            await saveBiometricCredentials(session.refresh_token, session.user.id)
          }
        } catch (error) {
          console.warn("[AuthProvider] failed to save biometric credentials:", error)
        }
      } else {
        // CRITICAL: Session Restoration Pattern
        // Don't immediately clear user state on SIGNED_OUT - it might be an expired session
        // that can be restored using refresh token
        
        // Check if this is an explicit logout (user clicked "Sign Out")
        const { isExplicitLogout, clearExplicitLogoutFlag } = await import("../lib/auth")
        const isExplicit = await isExplicitLogout()
        
        if (isExplicit) {
          // Explicit logout - clear state immediately
          console.log("[AuthProvider] SIGNED_OUT: Explicit logout detected - clearing user state")
          await clearExplicitLogoutFlag()
          
          // Clear biometric credentials on sign out
          try {
            await clearBiometricCredentials()
          } catch (error) {
            console.warn("[AuthProvider] failed to clear biometric credentials:", error)
          }
          
          // Reset PostHog user identification on sign out
          if (posthog) {
            try {
              posthog.reset()
              if (__DEV__) {
                console.log("[PostHog] User reset")
              }
            } catch (error) {
              console.warn("[AuthProvider] Failed to reset PostHog:", error)
            }
          }
          
          setUser(null)
          setLoading(false)
        } else {
          // NOT explicit logout - likely expired session, attempt restoration
          console.log("[AuthProvider] SIGNED_OUT: Expired session detected - attempting refresh token restoration")
          setRestoringSession(true)
          
          try {
            // Attempt to restore session using refresh token
            // This is the key difference: we try to restore BEFORE clearing state
            const { refreshSession, getCurrentSession } = await import("../lib/auth")
            
            // Try to refresh session (single attempt with 15s timeout)
            try {
              const restoredSession = await refreshSession(1) // Single attempt with timeout
              
              if (restoredSession) {
                // Restoration successful - verify session exists
                const currentSession = await getCurrentSession()
                if (currentSession?.user) {
                  console.log("[AuthProvider] SIGNED_OUT: Session restoration SUCCESS - user remains logged in", {
                    userId: currentSession.user.id,
                  })
                  // onAuthStateChange will fire again with SIGNED_IN event, which will load user
                  setRestoringSession(false)
                  // Don't clear user state - let the SIGNED_IN event handle it
                  return
                }
              }
            } catch (refreshError: any) {
              // Refresh failed - check if it's because there's no refresh token (truly logged out)
              // vs network error (might be recoverable)
              const isAuthError = 
                refreshError?.message?.includes("Auth session missing") ||
                refreshError?.message?.includes("refresh_token_not_found") ||
                refreshError?.message?.includes("Invalid Refresh Token")
              
              if (isAuthError) {
                console.log("[AuthProvider] SIGNED_OUT: No refresh token available - truly logged out")
                throw refreshError // Will be caught below
              } else {
                // Network error - might be temporary, but we'll treat as logged out for now
                console.log("[AuthProvider] SIGNED_OUT: Refresh failed (network error) - treating as logged out", {
                  error: refreshError?.message,
                })
                throw refreshError
              }
            }
            
            // If we get here, restoration didn't succeed
            console.log("[AuthProvider] SIGNED_OUT: Session restoration FAILED - clearing user state")
            throw new Error("Session restoration failed")
          } catch (restoreError: any) {
            // Restoration failed - clear state
            console.log("[AuthProvider] SIGNED_OUT: Session restoration failed - clearing user state", {
              error: restoreError?.message,
            })
            
            // Clear biometric credentials
            try {
              await clearBiometricCredentials()
            } catch (error) {
              console.warn("[AuthProvider] failed to clear biometric credentials:", error)
            }
            
            // Reset PostHog user identification
            if (posthog) {
              try {
                posthog.reset()
                if (__DEV__) {
                  console.log("[PostHog] User reset")
                }
              } catch (error) {
                console.warn("[AuthProvider] Failed to reset PostHog:", error)
              }
            }
            
            setUser(null)
            setLoading(false)
            setRestoringSession(false)
          }
        }
      }
    })

    // Fallback: If onAuthStateChange doesn't fire within 2 seconds, try getSession with timeout
    // This handles edge cases where onAuthStateChange might not fire immediately
    initialSessionTimeout = setTimeout(async () => {
      if (!sessionInitialized) {
        console.log("[AuthProvider] onAuthStateChange didn't fire, falling back to getSession()")
        try {
          const getSessionPromise = supabase.auth.getSession()
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("getSession timeout")), 5000)
          )
          
          const result: any = await Promise.race([getSessionPromise, timeoutPromise])
          const { data: { session } } = result
          
          if (session?.user) {
            await loadUser(session.user.id)
          } else {
            setLoading(false)
          }
          sessionInitialized = true
          if (maxTimeout) {
            clearTimeout(maxTimeout)
            maxTimeout = null
          }
        } catch (error) {
          console.error("[AuthProvider] Fallback getSession failed:", error)
          setLoading(false)
          sessionInitialized = true
          if (maxTimeout) {
            clearTimeout(maxTimeout)
            maxTimeout = null
          }
        }
      }
    }, 2000) // Wait 2 seconds for onAuthStateChange to fire

    return () => {
      subscription.unsubscribe()
      if (initialSessionTimeout) {
        clearTimeout(initialSessionTimeout)
      }
      if (maxTimeout) {
        clearTimeout(maxTimeout)
      }
    }
  }, [posthog])

  // AppState listener: track app close AND refresh session on foreground
  useEffect(() => {
    let refreshTimeout: ReturnType<typeof setTimeout> | null = null
    
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState.match(/inactive|background/)) {
        // Track when app goes to background - record app close for session lifecycle
        try {
          const { recordAppClose } = await import("../lib/session-lifecycle")
          await recordAppClose()
        } catch (error) {
          console.error("[AuthProvider] Failed to record app close:", error)
        }
      } else if (nextAppState === "active") {
        // CRITICAL: When app comes to foreground, check if we have a session but no user
        // This handles the case where TOKEN_REFRESHED fired while app was backgrounded
        // and user load was skipped
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user && !user) {
            console.log("[AuthProvider] App came to foreground - session exists but no user, loading user now")
            await loadUser(session.user.id)
          }
        } catch (error) {
          console.warn("[AuthProvider] Failed to check session on foreground:", error)
        }
        
        // SIMPLIFIED: Check if long inactivity - if so, skip foreground refresh
        // ForegroundQueryRefresher will handle it by treating like "R" (navigate to root)
        // This prevents competing refresh attempts
        refreshTimeout = setTimeout(async () => {
          try {
            const { wasInactiveTooLong } = await import("../lib/session-lifecycle")
            const inactiveTooLong = await wasInactiveTooLong()
            
            if (inactiveTooLong) {
              console.log("[AuthProvider] Foreground refresh: SKIPPED - Long inactivity, ForegroundQueryRefresher will handle (treating like 'R')")
              return // ForegroundQueryRefresher will navigate to root and boot flow will handle everything
            }
            
            // Short inactivity: Quick session check (non-blocking)
            if (user) {
              const { shouldSkipSessionCheck } = await import("../lib/auth")
              if (shouldSkipSessionCheck()) {
                console.log("[AuthProvider] Foreground refresh: SKIPPED - Recent token refresh")
                return
              }
              
              // Quick background refresh for short inactivity
              setRefreshing(true)
              try {
                const { ensureValidSession } = await import("../lib/auth")
                await ensureValidSession() // Non-blocking, runs in background
              } catch (error) {
                console.error("[AuthProvider] Foreground refresh error:", error)
              } finally {
                setRefreshing(false)
              }
            }
          } catch (error) {
            console.error("[AuthProvider] Foreground refresh check error:", error)
          }
        }, 500)
      }
    }

    const subscription = AppState.addEventListener("change", handleAppStateChange)

    return () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout)
      }
      subscription.remove()
    }
  }, [user])

  async function loadUser(userId: string) {
    let userData: any = null
    try {
      console.log('[AuthProvider] Loading user:', userId)
      
      // Add timeout to prevent hanging (10 seconds)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('User load timeout after 10 seconds')), 10000)
      })
      
      const userPromise = supabase.from("users").select("*").eq("id", userId).maybeSingle()
      
      const result = await Promise.race([userPromise, timeoutPromise]) as any
      const { data, error } = result || { data: null, error: null }
      
      if (error) {
        console.error('[AuthProvider] Error loading user:', error)
      }
      
      console.log('[AuthProvider] User data loaded:', data ? 'success' : 'null', error ? `error: ${error.message}` : '')
      
      userData = data
      setUser(data)
      
      // CRITICAL: Set loading to false immediately after user data is set
      // Don't wait for PostHog identification - it can happen in background
      setLoading(false)
      
      // Identify user in PostHog after successful load (non-blocking, fire-and-forget)
      // Even if data is null, we can still identify the user with just the userId
      // Run this in background - don't await it
      if (posthog) {
        // Run PostHog identification in background (non-blocking)
        (async () => {
          try {
            if (data) {
              console.log('[PostHog] Attempting to identify user:', userId)
              
              // Get group count for analytics (non-PII) - with timeout
              let groupCount = 0
              try {
                const timeoutPromise = new Promise((_, reject) => {
                  setTimeout(() => reject(new Error('Group count query timeout')), 5000)
                })
                const countPromise = supabase
                  .from("group_members")
                  .select("*", { count: "exact", head: true })
                  .eq("user_id", userId)
                const countResult = await Promise.race([countPromise, timeoutPromise]) as any
                groupCount = countResult?.count || 0
              } catch (countError) {
                console.warn('[PostHog] Failed to get group count (non-blocking):', countError)
                // Continue without group count
              }
              
              // Calculate account age
              const accountCreatedAt = new Date(data.created_at || new Date())
              const accountAgeDays = Math.floor(
                (Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24)
              )
              
              // Identify user with non-PII properties
              const properties = {
                has_groups: (groupCount || 0) > 0,
                group_count: groupCount || 0,
                account_age_days: accountAgeDays,
              }
              
              console.log('[PostHog] Calling identify with:', { userId, properties })
              posthog.identify(userId, properties)
              console.log('[PostHog] Identify called successfully')
              
              // Capture a test event to verify PostHog is working
              console.log('[PostHog] Calling capture for user_loaded event')
              posthog.capture('user_loaded', {
                user_id: userId,
                has_groups: (groupCount || 0) > 0,
              })
              console.log('[PostHog] Capture called successfully')
              
              // Try to flush events immediately
              if (posthog.flush) {
                console.log('[PostHog] Flushing events...')
                posthog.flush()
                console.log('[PostHog] Flush called')
              }
              
              if (__DEV__) {
                console.log("[PostHog] User identified:", userId, properties)
                console.log("[PostHog] Test event captured: user_loaded")
              }
            } else {
              // User data not loaded yet, but still identify with minimal info
              console.log('[PostHog] Identifying user without profile data:', userId)
              posthog.identify(userId, {
                profile_loaded: false,
              })
              posthog.capture('user_loaded', {
                user_id: userId,
                profile_loaded: false,
              })
              console.log('[PostHog] User identified without profile data')
            }
          } catch (error) {
            console.error("[AuthProvider] Failed to identify user in PostHog (non-blocking):", error)
            // Don't block user loading if PostHog fails
          }
        })() // Fire and forget - don't await
      } else {
        console.warn('[PostHog] Cannot identify user - posthog:', !!posthog, 'data:', !!userData)
      }
    } catch (error) {
      console.error("[AuthProvider] Error loading user:", error)
      // CRITICAL: Always set loading to false, even on error
      // This prevents the app from hanging on white screen
      setUser(null)
      setLoading(false)
    }
    // Note: setLoading(false) is now called earlier (after user data is set)
    // This ensures the app doesn't hang waiting for PostHog identification
  }

  async function handleSignOut() {
    // Track logged_out event before clearing session
    try {
      if (posthog) {
        posthog.capture("logged_out")
      } else {
        const { captureEvent } = await import("../lib/posthog")
        captureEvent("logged_out")
      }
    } catch (error) {
      // Never let PostHog errors affect sign-out
      if (__DEV__) console.error("[AuthProvider] Failed to track logged_out:", error)
    }
    
    // Clear biometric credentials on sign out
    try {
      await clearBiometricCredentials()
    } catch (error) {
      console.warn("[AuthProvider] failed to clear biometric credentials:", error)
    }
    
    // Reset PostHog user identification on sign out
    if (posthog) {
      try {
        posthog.reset()
        if (__DEV__) {
          console.log("[PostHog] User reset on sign out")
        }
      } catch (error) {
        console.warn("[AuthProvider] Failed to reset PostHog on sign out:", error)
      }
    }
    
    await supabase.auth.signOut()
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, loading, refreshing, restoringSession, signOut: handleSignOut }}>{children}</AuthContext.Provider>
}
