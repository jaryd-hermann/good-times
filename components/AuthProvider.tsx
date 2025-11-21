"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type { User } from "../lib/types"
import { getBiometricPreference, saveBiometricCredentials, clearBiometricCredentials } from "../lib/biometric"

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
    // Get initial session with timeout
    const getSessionPromise = supabase.auth.getSession()
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("getSession timeout")), 10000)
    )
    
    Promise.race([getSessionPromise, timeoutPromise])
      .then((result: any) => {
        const { data: { session } } = result
        if (session?.user) {
          loadUser(session.user.id)
        } else {
          setLoading(false)
        }
      })
      .catch((error) => {
        console.error("[AuthProvider] getSession failed:", error)
        setLoading(false)
      })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
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

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function loadUser(userId: string) {
    try {
      const { data } = await supabase.from("users").select("*").eq("id", userId).single()
      setUser(data)
      
      // Identify user in PostHog after successful load
      if (posthog && data) {
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
        console.warn('[PostHog] Cannot identify user - posthog:', !!posthog, 'data:', !!data)
      }
    } catch (error) {
      console.error("[v0] Error loading user:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSignOut() {
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
