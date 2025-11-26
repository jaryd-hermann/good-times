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
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  
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
    let initialSessionTimeout: NodeJS.Timeout | null = null

    // Listen for auth changes - this fires immediately with current session
    // This is the PRIMARY way to get session state (non-blocking, event-driven)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
      console.log(`[AuthProvider] onAuthStateChange: event=${event}, hasSession=${!!session}`)
      
      // Mark that we've received initial session state
      if (!sessionInitialized) {
        sessionInitialized = true
        if (initialSessionTimeout) {
          clearTimeout(initialSessionTimeout)
          initialSessionTimeout = null
        }
      }

      if (session?.user) {
        await loadUser(session.user.id)
        // Save biometric credentials if enabled
        try {
          const biometricEnabled = await getBiometricPreference()
          if (biometricEnabled && session.refresh_token) {
            await saveBiometricCredentials(session.refresh_token, session.user.id)
          }
        } catch (error) {
          console.warn("[AuthProvider] failed to save biometric credentials:", error)
        }
      } else {
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
        } catch (error) {
          console.error("[AuthProvider] Fallback getSession failed:", error)
          setLoading(false)
          sessionInitialized = true
        }
      }
    }, 2000) // Wait 2 seconds for onAuthStateChange to fire

    return () => {
      subscription.unsubscribe()
      if (initialSessionTimeout) {
        clearTimeout(initialSessionTimeout)
      }
    }
  }, [posthog])

  // Refresh session when app comes to foreground
  useEffect(() => {
    let lastAppState: AppStateStatus = AppState.currentState
    let refreshTimeout: NodeJS.Timeout | null = null

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      // App came to foreground from background/inactive
      if (lastAppState.match(/inactive|background/) && nextAppState === "active") {
        console.log("[AuthProvider] App came to foreground, checking session...")
        
        // Small delay to ensure app is fully active
        refreshTimeout = setTimeout(async () => {
          try {
            // Only refresh if we have a user (session exists)
            if (user) {
              const refreshed = await ensureValidSession()
              if (refreshed) {
                console.log("[AuthProvider] Session refreshed on app resume")
                // Reload user data to ensure it's fresh
                const { data: { session } } = await supabase.auth.getSession()
                if (session?.user) {
                  await loadUser(session.user.id)
                }
              } else {
                console.warn("[AuthProvider] Failed to refresh session on app resume")
              }
            }
          } catch (error) {
            console.error("[AuthProvider] Error refreshing session on app resume:", error)
          }
        }, 500) // 500ms delay
      }
      
      lastAppState = nextAppState
    }

    const subscription = AppState.addEventListener("change", handleAppStateChange)

    return () => {
      subscription.remove()
      if (refreshTimeout) {
        clearTimeout(refreshTimeout)
      }
    }
  }, [user])

  async function loadUser(userId: string) {
    try {
      console.log('[AuthProvider] Loading user:', userId)
      const { data, error } = await supabase.from("users").select("*").eq("id", userId).maybeSingle()
      
      if (error) {
        console.error('[AuthProvider] Error loading user:', error)
      }
      
      console.log('[AuthProvider] User data loaded:', data ? 'success' : 'null', error ? `error: ${error.message}` : '')
      
      setUser(data)
      
      // Identify user in PostHog after successful load
      // Even if data is null, we can still identify the user with just the userId
      if (posthog) {
        if (data) {
        try {
          console.log('[PostHog] Attempting to identify user:', userId)
          
          // Get group count for analytics (non-PII)
          const { count: groupCount } = await supabase
            .from("group_members")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
          
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
        } catch (error) {
          console.error("[AuthProvider] Failed to identify user in PostHog:", error)
          // Don't block user loading if PostHog fails
        }
        } else {
          // User data not loaded yet, but still identify with minimal info
          console.log('[PostHog] Identifying user without profile data:', userId)
          try {
            posthog.identify(userId, {
              profile_loaded: false,
            })
            posthog.capture('user_loaded', {
              user_id: userId,
              profile_loaded: false,
            })
            console.log('[PostHog] User identified without profile data')
          } catch (error) {
            console.error("[AuthProvider] Failed to identify user in PostHog (no profile):", error)
          }
        }
      } else {
        console.warn('[PostHog] Cannot identify user - posthog:', !!posthog, 'data:', !!data)
      }
    } catch (error) {
      console.error("[v0] Error loading user:", error)
    } finally {
      setLoading(false)
    }
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

  return <AuthContext.Provider value={{ user, loading, signOut: handleSignOut }}>{children}</AuthContext.Provider>
}
