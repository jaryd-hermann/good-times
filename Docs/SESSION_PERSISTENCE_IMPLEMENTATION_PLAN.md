# Session Persistence Implementation Plan

## Overview

This document outlines the specific code changes needed to fix session persistence issues and ensure users stay logged in across app sessions.

## Architecture Changes

### Current Flow (Problematic)
```
App Start
  ├─> AuthProvider initializes (async)
  └─> Boot process (app/index.tsx) runs independently
      ├─> Checks session directly
      ├─> Navigates based on session
      └─> AuthProvider may update state after navigation (RACE CONDITION)
```

### Target Flow (Fixed)
```
App Start
  ├─> AuthProvider initializes
  │   ├─> Loads session from storage
  │   ├─> Validates session
  │   └─> Sets loading: false when ready
  └─> Boot process waits for AuthProvider.loading === false
      ├─> Uses AuthProvider.user state
      └─> Navigates based on AuthProvider state
```

## Implementation Steps

### Step 1: Fix AuthProvider to be Single Source of Truth

**File:** `components/AuthProvider.tsx`

**Changes:**

1. **Remove dependency on `user` state in app state change handler**
   ```typescript
   // BEFORE (line 164-207)
   useEffect(() => {
     // ...
     if (user) {  // ❌ Race condition
       await ensureValidSession()
     }
   }, [user])
   
   // AFTER
   useEffect(() => {
     let lastAppState: AppStateStatus = AppState.currentState
     let refreshTimeout: NodeJS.Timeout | null = null
   
     const handleAppStateChange = async (nextAppState: AppStateStatus) => {
       if (lastAppState.match(/inactive|background/) && nextAppState === "active") {
         console.log("[AuthProvider] App came to foreground, checking session...")
         
         refreshTimeout = setTimeout(async () => {
           try {
             // ✅ Always check session, not user state
             const { data: { session } } = await supabase.auth.getSession()
             if (session) {
               // Session exists, ensure it's valid
               const refreshed = await ensureValidSession()
               if (refreshed) {
                 console.log("[AuthProvider] Session refreshed on app resume")
                 // Reload user data
                 await loadUser(session.user.id)
               } else {
                 console.warn("[AuthProvider] Failed to refresh session on app resume")
                 // Session refresh failed - clear user but don't navigate (boot process handles it)
                 setUser(null)
               }
             } else {
               // No session - clear user
               setUser(null)
             }
           } catch (error) {
             console.error("[AuthProvider] Error refreshing session on app resume:", error)
             // On error, try to get current session
             try {
               const { data: { session } } = await supabase.auth.getSession()
               if (!session) {
                 setUser(null)
               }
             } catch (e) {
               // If we can't even check session, assume logged out
               setUser(null)
             }
           }
         }, 300) // Reduced delay - app should be ready faster
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
   }, []) // ✅ No dependency on user state
   ```

2. **Improve initial session loading**
   ```typescript
   // Add state to track if initial session is loaded
   const [sessionInitialized, setSessionInitialized] = useState(false)
   
   useEffect(() => {
     let mounted = true
     let fallbackTimeout: NodeJS.Timeout | null = null
   
     // Primary: Listen for auth changes
     const {
       data: { subscription },
     } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
       console.log(`[AuthProvider] onAuthStateChange: event=${event}, hasSession=${!!session}`)
       
       if (!sessionInitialized && mounted) {
         setSessionInitialized(true)
         if (fallbackTimeout) {
           clearTimeout(fallbackTimeout)
           fallbackTimeout = null
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
         
         // Reset PostHog
         if (posthog) {
           try {
             posthog.reset()
           } catch (error) {
             console.warn("[AuthProvider] Failed to reset PostHog:", error)
           }
         }
         
         setUser(null)
         setLoading(false)
       }
     })
   
     // Fallback: If onAuthStateChange doesn't fire within 3 seconds
     fallbackTimeout = setTimeout(async () => {
       if (!sessionInitialized && mounted) {
         console.log("[AuthProvider] onAuthStateChange didn't fire, falling back to getSession()")
         try {
           const getSessionPromise = supabase.auth.getSession()
           const timeoutPromise = new Promise((_, reject) => 
             setTimeout(() => reject(new Error("getSession timeout")), 10000) // ✅ Increased timeout
           )
           
           const result: any = await Promise.race([getSessionPromise, timeoutPromise])
           const { data: { session } } = result
           
           if (session?.user && mounted) {
             await loadUser(session.user.id)
           } else if (mounted) {
             setLoading(false)
           }
           if (mounted) {
             setSessionInitialized(true)
           }
         } catch (error) {
           console.error("[AuthProvider] Fallback getSession failed:", error)
           if (mounted) {
             setLoading(false)
             setSessionInitialized(true)
           }
         }
       }
     }, 3000) // ✅ Increased from 2s to 3s
   
     return () => {
       mounted = false
       subscription.unsubscribe()
       if (fallbackTimeout) {
         clearTimeout(fallbackTimeout)
       }
     }
   }, [posthog])
   ```

### Step 2: Update Boot Process to Wait for AuthProvider

**File:** `app/index.tsx`

**⚠️ CRITICAL NOTE: Keep Biometric Auth in Boot Process**

The implementation plan originally suggested removing biometric auth from boot process, but **this should NOT be done**. Biometric auth must remain in the boot process because:
- AuthProvider doesn't currently handle biometric auth on initialization
- Users expect biometric prompt immediately on app start
- Removing it would break biometric login functionality

**Changes:**

1. **Use AuthProvider state instead of direct session checks (but keep biometric auth)**
   ```typescript
   import { useAuth } from "../components/AuthProvider"
   
   export default function Index() {
     const router = useRouter()
     const { user, loading: authLoading } = useAuth() // ✅ Use AuthProvider
     const [booting, setBooting] = useState(true)
     // ... rest of state
   
     useEffect(() => {
       let cancelled = false
   
       (async () => {
         try {
           console.log("[boot] start")
           
           // ✅ Wait for AuthProvider to finish loading
           if (authLoading) {
             console.log("[boot] Waiting for AuthProvider to initialize...")
             return // Exit early, will retry when authLoading becomes false
           }
           
           // Check if Supabase is configured
           console.log("[boot] Checking Supabase configuration...")
           let isConfigured = false
           try {
             const { isSupabaseConfigured } = await import("../lib/supabase")
             isConfigured = isSupabaseConfigured()
             console.log("[boot] Supabase configured:", isConfigured)
           } catch (error: any) {
             console.error("[boot] Failed to check Supabase config:", error)
             const errorMsg = `Failed to check Supabase: ${error?.message || String(error)}`
             setErr(errorMsg)
             if (__DEV__) Alert.alert("Boot Error", errorMsg)
             setBooting(false)
             return
           }
           
           if (!isConfigured) {
             const errorMsg = "Supabase is not configured..."
             console.error("[boot]", errorMsg)
             setErr(errorMsg)
             if (__DEV__) Alert.alert("Configuration Error", errorMsg)
             setBooting(false)
             return
           }
   
           // Check for pending group join
           const pendingGroupId = await AsyncStorage.getItem(PENDING_GROUP_KEY)
   
           // ✅ Use AuthProvider user state instead of checking session directly
           if (!user) {
             console.log("[boot] no user → onboarding/welcome-1")
             if (pendingGroupId) {
               // Keep pendingGroupId in storage for after auth
               await AsyncStorage.setItem(PENDING_GROUP_KEY, pendingGroupId)
             }
             router.replace("/(onboarding)/welcome-1")
             return
           }
   
           // ✅ User exists from AuthProvider - proceed with boot
           const userId = user.id
           
           // If there's a pending group join, handle it
           if (pendingGroupId) {
             await AsyncStorage.removeItem(PENDING_GROUP_KEY)
             router.replace({
               pathname: `/join/${pendingGroupId}`,
             })
             return
           }
   
           // Check user profile (should exist if user is set)
           if (!user.name || !user.birthday) {
             console.log("[boot] ⚠️ User exists but no profile - orphaned session")
             console.log("[boot] Clearing orphaned session and redirecting to welcome-1")
             
             try {
               await supabase.auth.signOut()
               await clearBiometricCredentials()
               console.log("[boot] ✅ Orphaned session cleared")
             } catch (signOutError) {
               console.warn("[boot] Failed to clear orphaned session:", signOutError)
             }
             
             router.replace("/(onboarding)/welcome-1")
             return
           }
   
           // Check group membership
           console.log("[boot] checking group membership...")
           const { data: membership, error: memErr } = await supabase
             .from("group_members")
             .select("group_id")
             .eq("user_id", userId)
             .limit(1)
             .maybeSingle()
   
           console.log("[boot] membership query result:", { membership, error: memErr?.message })
   
           if (memErr) {
             console.log("[boot] group_members error:", memErr.message)
             console.log("[boot] → onboarding/create-group/name-type")
             router.replace("/(onboarding)/create-group/name-type")
             return
           }
   
           // Route to appropriate screen
           console.log("[boot] routing decision...")
           if (membership?.group_id) {
             console.log("[boot] user with group → (main)/home")
             router.replace("/(main)/home")
           } else {
             console.log("[boot] no group → onboarding/create-group/name-type")
             router.replace("/(onboarding)/create-group/name-type")
           }
           console.log("[boot] router.replace called")
         } catch (e: any) {
           const msg = e?.message || String(e)
           const stack = e?.stack || ''
           console.error("[boot] FATAL ERROR:", msg, stack)
           setErr(`Boot failed: ${msg}`)
           Alert.alert(
             "App Failed to Start",
             `Error: ${msg}\n\nPlease check your configuration and try again.`,
             [{ text: "OK" }]
           )
         } finally {
           if (!cancelled) setBooting(false)
         }
       })()
   
       return () => {
         cancelled = true
       }
     }, [router, user, authLoading]) // ✅ Depend on user and authLoading
   
     // ... rest of component
   }
   ```

2. **Remove duplicate session checks (but keep biometric auth)**
   - ⚠️ **KEEP biometric auth check in boot process** (see critical note above)
   - Remove direct `getSession()` calls (except for biometric fallback)
   - Remove `ensureValidSession()` call after biometric auth (AuthProvider handles normal session refresh)
   
   **Biometric Auth Flow:**
   ```typescript
   // In app/index.tsx boot process
   // Wait for AuthProvider first
   if (authLoading) {
     return // Exit early, will retry when authLoading becomes false
   }
   
   // If no user from AuthProvider, try biometric auth
   if (!user) {
     const biometricEnabled = await getBiometricPreference()
     if (biometricEnabled) {
       const refreshToken = await getBiometricRefreshToken()
       const userId = await getBiometricUserId()
       
       if (refreshToken && userId) {
         const authResult = await authenticateWithBiometric("Log in with FaceID")
         if (authResult.success) {
           try {
             const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
               refresh_token: refreshToken,
             })
             
             if (!refreshError && refreshData?.session) {
               // Biometric auth successful - AuthProvider will pick up session via onAuthStateChange
               // Wait a moment for AuthProvider to update, then re-check user state
               await new Promise(resolve => setTimeout(resolve, 500))
               // Re-check user from AuthProvider (will be updated by onAuthStateChange)
               // Continue boot process...
             }
           } catch (error) {
             // Biometric refresh failed - continue to welcome screen
           }
         }
       }
     }
   }
   
   // Continue with normal boot process using AuthProvider user state
   ```

### Step 3: Improve Session Refresh Logic

**File:** `lib/auth.ts`

**Changes:**

1. **Add retry logic with exponential backoff**
   ```typescript
   export async function refreshSession(retries = 3): Promise<Session | null> {
     for (let attempt = 0; attempt < retries; attempt++) {
       try {
         const refreshPromise = supabase.auth.refreshSession()
         const timeoutMs = 10000 + (attempt * 5000) // 10s, 15s, 20s
         const timeoutPromise = new Promise((_, reject) => 
           setTimeout(() => reject(new Error("refreshSession timeout")), timeoutMs)
         )
         
         const result: any = await Promise.race([refreshPromise, timeoutPromise])
         const { data: { session }, error } = result
         
         if (error) {
           // Check if error is retryable
           const isRetryable = error.message?.includes("network") || 
                               error.message?.includes("timeout") ||
                               error.status >= 500
           
           if (!isRetryable || attempt === retries - 1) {
             throw error
           }
           
           // Wait before retry (exponential backoff)
           await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
           continue
         }
         
         return session
       } catch (error: any) {
         if (attempt === retries - 1) {
           console.error(`[auth] refreshSession failed after ${retries} attempts:`, error.message)
           throw error
         }
         // Wait before retry
         await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
       }
     }
     return null
   }
   ```

2. **Improve ensureValidSession**
   ```typescript
   export async function ensureValidSession(): Promise<boolean> {
     try {
       const session = await getCurrentSession()
       if (!session) {
         console.log("[auth] No session found")
         return false
       }
       
       // Check if session expires within 5 minutes
       const expiresAt = session.expires_at
       if (!expiresAt) {
         console.log("[auth] Session has no expiry, assuming valid")
         return true
       }
       
       const expiresIn = expiresAt - Math.floor(Date.now() / 1000)
       
       if (expiresIn < 300) { // Less than 5 minutes
         console.log("[auth] Session expired or expiring soon, refreshing...")
         try {
           await refreshSession()
           console.log("[auth] Session refreshed successfully")
           return true
         } catch (error: any) {
           console.error("[auth] Failed to refresh session:", error.message)
           
           // Try biometric refresh token as fallback
           try {
             const { getBiometricPreference, getBiometricRefreshToken, authenticateWithBiometric } = await import("./biometric")
             const biometricEnabled = await getBiometricPreference()
             if (biometricEnabled) {
               const refreshToken = await getBiometricRefreshToken()
               if (refreshToken) {
                 const authResult = await authenticateWithBiometric("Session expired. Please authenticate.")
                 if (authResult.success) {
                   const refreshed = await refreshSession()
                   if (refreshed) {
                     console.log("[auth] Session refreshed via biometric")
                     return true
                   }
                 }
               }
             }
           } catch (biometricError) {
             console.warn("[auth] Biometric refresh fallback failed:", biometricError)
           }
           
           return false
         }
       }
       
       return true
     } catch (error) {
       console.error("[auth] ensureValidSession check failed:", error)
       return false
     }
   }
   ```

### Step 4: Increase Timeout Values

**File:** `lib/auth.ts`

**Changes:**

```typescript
export async function getCurrentSession() {
  try {
    const getSessionPromise = supabase.auth.getSession()
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("getSession timeout")), 10000) // ✅ Increased from 5s to 10s
    )
    
    const result: any = await Promise.race([getSessionPromise, timeoutPromise])
    return result?.data?.session || null
  } catch (error: any) {
    console.error("[auth] getCurrentSession failed:", error.message)
    return null
  }
}
```

### Step 5: Improve Splash Screen Handling

**File:** `app/_layout.tsx`

**Changes:**

```typescript
// Increase splash screen timeout
useEffect(() => {
  const timer = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 3000) // ✅ Increased from 1500ms to 3000ms
  if (fontsLoaded) SplashScreen.hideAsync().catch(() => {})
  return () => clearTimeout(timer)
}, [fontsLoaded])
```

### Step 6: Add Proactive Session Refresh

**File:** `components/AuthProvider.tsx`

**Changes:**

Add a background timer to refresh session before expiry:

```typescript
// Add proactive session refresh
useEffect(() => {
  if (!user) return
  
  let refreshInterval: NodeJS.Timeout | null = null
  
  const scheduleRefresh = async () => {
    try {
      const session = await getCurrentSession()
      if (!session?.expires_at) return
      
      const expiresAt = session.expires_at
      const now = Math.floor(Date.now() / 1000)
      const expiresIn = expiresAt - now
      
      // Refresh 5 minutes before expiry
      const refreshIn = (expiresIn - 300) * 1000
      
      if (refreshIn > 0) {
        console.log(`[AuthProvider] Scheduling session refresh in ${Math.floor(refreshIn / 1000)}s`)
        refreshInterval = setTimeout(async () => {
          try {
            await ensureValidSession()
            console.log("[AuthProvider] Proactive session refresh completed")
            // Reschedule next refresh
            scheduleRefresh()
          } catch (error) {
            console.error("[AuthProvider] Proactive refresh failed:", error)
          }
        }, refreshIn)
      } else {
        // Expires soon, refresh immediately
        ensureValidSession().catch(console.error)
      }
    } catch (error) {
      console.error("[AuthProvider] Failed to schedule refresh:", error)
    }
  }
  
  scheduleRefresh()
  
  return () => {
    if (refreshInterval) {
      clearTimeout(refreshInterval)
    }
  }
}, [user])
```

## Testing Checklist

- [ ] App resumes after 1 hour in background - user stays logged in
- [ ] App resumes after 24 hours in background - user stays logged in
- [ ] Slow network - session refresh succeeds with retries
- [ ] No network, then network restored - session recovers
- [ ] Session expires while app in background - refreshes on resume
- [ ] Biometric auth cancelled - user not logged out
- [ ] Multiple rapid app switches - no race conditions
- [ ] Boot process completes successfully
- [ ] No black screens during boot
- [ ] Splash screen shows during boot

## Rollout Plan

1. **Phase 1**: Implement Steps 1-2 (Critical fixes)
   - Test thoroughly in development
   - Deploy to TestFlight for beta testing
   - Monitor for 1 week

2. **Phase 2**: Implement Steps 3-4 (Retry logic and timeouts)
   - Test with slow network conditions
   - Deploy to TestFlight
   - Monitor for 1 week

3. **Phase 3**: Implement Steps 5-6 (Proactive refresh)
   - Test long background periods
   - Deploy to production
   - Monitor metrics

## Success Metrics

- Session refresh success rate > 99%
- Logout rate < 0.1% (excluding explicit logouts)
- Black screen occurrences < 0.01%
- Average boot time < 2 seconds
- User satisfaction with login persistence

