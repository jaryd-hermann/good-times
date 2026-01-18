// ------------------------------------------------------
// WORKING MINIMAL VERSION (active)
// ------------------------------------------------------

import { Stack } from "expo-router"
import { useFonts } from "expo-font"
import * as SplashScreen from "expo-splash-screen"
import { useEffect, useState, useRef } from "react"

// Import Updates conditionally - only available in production builds
let Updates: typeof import("expo-updates") | null = null
try {
  Updates = require("expo-updates")
} catch (error) {
  // Updates not available (development mode, Expo Go, or native module not built)
  console.log("[_layout] expo-updates not available (this is normal in development)")
}
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { AuthProvider, useAuth } from "../components/AuthProvider"
import { ErrorBoundary } from "../components/ErrorBoundary"
import * as Linking from "expo-linking"
import * as Notifications from "expo-notifications"
import { router, usePathname } from "expo-router"
import { PostHogProvider } from "posthog-react-native"
import { TabBarProvider } from "../lib/tab-bar-context"
import { ThemeProvider } from "../lib/theme-context"
import { View, ActivityIndicator, StyleSheet, Text, AppState, AppStateStatus, Animated, Image } from "react-native"
import { typography, colors as themeColors } from "../lib/theme"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { wasInactiveTooLong } from "../lib/session-lifecycle"
import { openAppStoreReview } from "../lib/app-store-review"
// Import supabase with error handling
let supabase: any
try {
  const supabaseModule = require("../lib/supabase")
  supabase = supabaseModule.supabase
} catch (error) {
  console.error("[_layout] Failed to import supabase:", error)
  // Create a minimal fallback to prevent crash
  supabase = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  }
}

SplashScreen.preventAutoHideAsync().catch(() => {})

// Component to handle boot recheck trigger from AuthProvider
// This ensures boot screen shows and boot flow runs even when app/index.tsx isn't mounted
function BootRecheckHandler() {
  const { user } = useAuth()
  
  useEffect(() => {
    let checkInterval: ReturnType<typeof setInterval> | null = null
    
    const checkTrigger = async () => {
      try {
        const trigger = await AsyncStorage.getItem("trigger_boot_recheck")
        if (trigger) {
          console.log("[_layout] Boot recheck trigger detected from AuthProvider, forcing boot screen", {
            triggerValue: trigger,
            hasUser: !!user,
            userId: user?.id,
            timestamp: new Date().toISOString(),
          })
          await AsyncStorage.removeItem("trigger_boot_recheck")
          
          // CRITICAL: Navigate to root (/) to trigger app/index.tsx boot flow
          // This will show boot screen and run proper boot flow
          if (user) {
            console.log("[_layout] User exists, navigating to root to show boot screen and run boot flow")
            // Set flag to force boot screen to show
            await AsyncStorage.setItem("force_boot_screen", "true")
            // Navigate to root - this will mount app/index.tsx and show boot screen
            router.replace("/")
          }
        }
      } catch (error) {
        console.error("[_layout] Failed to check boot recheck trigger:", error)
      }
    }

    // Check immediately
    checkTrigger()
    
    // Check periodically (every 2 seconds)
    // Reduced frequency to avoid log spam
    checkInterval = setInterval(checkTrigger, 2000) // Reduced from 500ms to 2s

    return () => {
      if (checkInterval) {
        clearInterval(checkInterval)
      }
    }
  }, [user])
  
  return null // This component doesn't render anything
}

// Component to handle app foreground - SIMPLIFIED: Just like hitting "R"
// When app opens from background after long inactivity, treat it exactly like a refresh
function ForegroundQueryRefresher() {
  const { user, loading: authLoading } = useAuth()
  const queryClient = useQueryClient()
  const pathname = usePathname()
  
  useEffect(() => {
    console.log("[_layout] ForegroundQueryRefresher: Component mounted, setting up AppState listener", {
      hasUser: !!user,
      userId: user?.id,
      authLoading,
    })
    
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      console.log("[_layout] ForegroundQueryRefresher: AppState changed", {
        nextAppState,
        hasUser: !!user,
        userId: user?.id,
        authLoading,
      })
      
      if (nextAppState === "active") {
        console.log("[_layout] ForegroundQueryRefresher: App became active, checking inactivity")
        
        // CRITICAL: Check for long inactivity even if user load is slow/timing out
        // Get user ID from Supabase session directly (don't rely on AuthProvider user state)
        let userId: string | null = null
        try {
          const { data: { session } } = await supabase.auth.getSession()
          userId = session?.user?.id || null
          console.log("[_layout] ForegroundQueryRefresher: Got session", {
            hasSession: !!session,
            userId,
          })
        } catch (error) {
          console.warn("[_layout] ForegroundQueryRefresher: Failed to get session:", error)
        }
        
        // Only check inactivity if we have a user (either from AuthProvider or session)
        if (!user && !userId) {
          console.log("[_layout] ForegroundQueryRefresher: No user found (neither AuthProvider nor session), skipping")
          return
        }
        
        // Check if inactive too long - if so, treat exactly like "R" (full refresh)
        console.log("[_layout] ForegroundQueryRefresher: Checking if inactive too long...")
        const inactiveTooLong = await wasInactiveTooLong()
        console.log("[_layout] ForegroundQueryRefresher: Inactivity check result", { inactiveTooLong })
        
        if (inactiveTooLong) {
          console.log("[_layout] ForegroundQueryRefresher: Long inactivity detected - treating like 'R' refresh (clear cache, set flag for boot flow)", {
            hasUserFromAuth: !!user,
            hasUserFromSession: !!userId,
            authLoading,
          })
          
          // CRITICAL: Clear React Query cache completely (like "R" does)
          queryClient.clear()
          console.log("[_layout] ForegroundQueryRefresher: React Query cache cleared")
          
          // CRITICAL: Trigger boot screen overlay IMMEDIATELY (synchronously) before any async operations
          // This ensures boot screen shows before home renders
          bootScreenTriggerRef.current = true
          console.log("[_layout] ForegroundQueryRefresher: Triggered boot screen overlay immediately")
          
          // CRITICAL: Navigate to root immediately to show boot screen
          // This prevents black screen when opening from background
          // Set flags for boot flow
          await AsyncStorage.setItem("force_boot_screen", "true")
          await AsyncStorage.setItem("force_boot_refresh", Date.now().toString())
          console.log("[_layout] ForegroundQueryRefresher: Set flags for boot flow to handle navigation")
          
          // Navigate to root immediately to show boot screen (prevents black screen)
          if (pathname !== "/" && pathname !== "") {
            console.log("[_layout] ForegroundQueryRefresher: Navigating to root to show boot screen immediately", {
              currentPath: pathname,
            })
            router.replace("/")
          } else {
            console.log("[_layout] ForegroundQueryRefresher: Already on root, boot screen should show", {
              pathname,
            })
          }
        } else {
          console.log("[_layout] ForegroundQueryRefresher: Short inactivity, doing nothing (let normal app behavior handle it)")
        }
      }
    }
    
    const subscription = AppState.addEventListener("change", handleAppStateChange)
    console.log("[_layout] ForegroundQueryRefresher: AppState listener registered")
    
    return () => {
      console.log("[_layout] ForegroundQueryRefresher: Cleaning up AppState listener")
      subscription.remove()
    }
  }, [user, authLoading, queryClient]) // Added authLoading to dependencies
  
  // CRITICAL: Also handle navigation when AuthProvider finishes loading
  // This ensures we navigate to root if we detected long inactivity but AuthProvider was still loading
  // BUT: Only navigate if we haven't already navigated (prevent duplicate navigations)
  useEffect(() => {
    if (!authLoading) {
      // AuthProvider finished loading - check if we need to navigate
      AsyncStorage.getItem("force_boot_refresh").then((flag) => {
        if (flag) {
          // Check if we're already on root - if so, don't navigate again (prevents duplicate boot flow runs)
          if (pathname === "/" || pathname === "") {
            console.log("[_layout] ForegroundQueryRefresher: Already on root, skipping duplicate navigation", {
              hasUser: !!user,
              userId: user?.id,
              pathname,
            })
            AsyncStorage.removeItem("force_boot_refresh")
            return
          }
          
          console.log("[_layout] ForegroundQueryRefresher: AuthProvider finished loading, navigating to root for refresh", {
            hasUser: !!user,
            userId: user?.id,
            pathname,
          })
          AsyncStorage.removeItem("force_boot_refresh")
          router.replace("/")
        }
      }).catch(() => {})
    }
  }, [authLoading, user])
  
  return null
}

// Shared state for boot screen overlay - allows ForegroundQueryRefresher to trigger it immediately
const bootScreenTriggerRef = { current: false }

// CRITICAL: Boot screen overlay that blocks all rendering when boot flags are detected
// This ensures boot screen shows IMMEDIATELY when app comes from background, before home renders
function BootScreenOverlay() {
  const pathname = usePathname()
  const rotateAnim = useRef(new Animated.Value(0)).current
  
  // CRITICAL: Initialize state from trigger ref to show overlay immediately on first render
  // This ensures overlay shows before home renders
  const [showBootScreen, setShowBootScreen] = useState(() => {
    if (bootScreenTriggerRef.current) {
      console.log("[_layout] BootScreenOverlay: Trigger ref detected on mount - initializing overlay visible")
      bootScreenTriggerRef.current = false // Reset
      return true
    }
    return false
  })
  
  // CRITICAL: Start rotation animation IMMEDIATELY on mount (before any async checks)
  // This ensures spinner is always spinning when overlay is visible
  useEffect(() => {
    // Start rotation animation immediately - don't wait for showBootScreen
    const rotateAnimation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    )
    rotateAnimation.start()
    return () => rotateAnimation.stop()
  }, [rotateAnim]) // Remove showBootScreen dependency - always animate
  
  // CRITICAL: Check trigger ref in useEffect (runs on mount and when pathname changes)
  // This ensures overlay shows immediately when trigger is set
  useEffect(() => {
    if (bootScreenTriggerRef.current) {
      console.log("[_layout] BootScreenOverlay: Trigger ref detected - showing overlay immediately")
      setShowBootScreen(true)
      bootScreenTriggerRef.current = false // Reset
    }
  }, [pathname]) // Run on mount and when pathname changes (when navigating to root)
  
  // CRITICAL: Show overlay IMMEDIATELY when app becomes active on root route
  // This ensures boot screen shows before home renders
  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (nextAppState) => {
      if (nextAppState === "active") {
        // CRITICAL: Check trigger ref FIRST (synchronous, immediate)
        if (bootScreenTriggerRef.current) {
          console.log("[_layout] BootScreenOverlay: Trigger ref detected in AppState listener - showing overlay immediately")
          setShowBootScreen(true)
          bootScreenTriggerRef.current = false // Reset
        }
        
        // CRITICAL: Check pathname synchronously (from closure)
        const currentPathname = pathname
        const isOnRoot = !currentPathname || currentPathname === "/" || currentPathname === ""
        
        if (isOnRoot) {
          // Show overlay IMMEDIATELY (synchronously) before checking flags
          console.log("[_layout] BootScreenOverlay: App became active on root - showing overlay immediately", {
            pathname: currentPathname,
          })
          setShowBootScreen(true)
          
          // Then check for boot flags (async, but overlay is already showing)
          const forceBootRefresh = await AsyncStorage.getItem("force_boot_refresh")
          const forceBootScreen = await AsyncStorage.getItem("force_boot_screen")
          if (forceBootRefresh || forceBootScreen === "true") {
            console.log("[_layout] BootScreenOverlay: Boot flags confirmed - keeping overlay visible")
            // Clear flags
            if (forceBootRefresh) await AsyncStorage.removeItem("force_boot_refresh")
            if (forceBootScreen === "true") await AsyncStorage.removeItem("force_boot_screen")
          } else {
            // No flags - hide overlay after short delay (boot flow will handle navigation)
            // But only if we're still on root (might have navigated already)
            setTimeout(() => {
              const stillOnRoot = !pathname || pathname === "/" || pathname === ""
              if (stillOnRoot) {
                console.log("[_layout] BootScreenOverlay: No boot flags, hiding overlay")
                setShowBootScreen(false)
              }
            }, 500)
          }
        }
      }
    })
    return () => subscription.remove()
  }, [pathname])
  
  // CRITICAL: Check for boot flags on mount - show overlay immediately if flags exist
  // This ensures overlay shows before any async operations complete
  useEffect(() => {
    let cancelled = false
    // Show overlay immediately if trigger ref is set (synchronous check)
    if (bootScreenTriggerRef.current) {
      console.log("[_layout] BootScreenOverlay: Trigger ref detected on mount - showing overlay immediately")
      setShowBootScreen(true)
      bootScreenTriggerRef.current = false
    }
    
    // Then check AsyncStorage flags (async, but overlay is already showing if trigger was set)
    ;(async () => {
      const forceBootRefresh = await AsyncStorage.getItem("force_boot_refresh")
      const forceBootScreen = await AsyncStorage.getItem("force_boot_screen")
      if (!cancelled && (forceBootRefresh || forceBootScreen === "true")) {
        console.log("[_layout] BootScreenOverlay: Boot flags detected on mount - showing overlay")
        setShowBootScreen(true)
        // Clear flags
        if (forceBootRefresh) await AsyncStorage.removeItem("force_boot_refresh")
        if (forceBootScreen === "true") await AsyncStorage.removeItem("force_boot_screen")
      }
    })()
    return () => { cancelled = true }
  }, [])
  
  // CRITICAL: Check when pathname changes to root - show overlay immediately if trigger is set
  useEffect(() => {
    if (pathname === "/" || pathname === "") {
      // Check trigger ref synchronously first (immediate)
      if (bootScreenTriggerRef.current) {
        console.log("[_layout] BootScreenOverlay: On root with trigger ref - showing overlay immediately")
        setShowBootScreen(true)
        bootScreenTriggerRef.current = false
      }
      
      // Then check AsyncStorage flags (async)
      AsyncStorage.getItem("force_boot_refresh").then((flag) => {
        if (flag) {
          console.log("[_layout] BootScreenOverlay: On root with boot flag - showing overlay")
          setShowBootScreen(true)
        }
      }).catch(() => {})
    }
  }, [pathname])
  
  // Hide overlay after boot completes (when pathname changes away from root)
  useEffect(() => {
    if (showBootScreen && pathname && pathname !== "/" && pathname !== "") {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        console.log("[_layout] BootScreenOverlay: Navigation complete, hiding overlay")
        setShowBootScreen(false)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [showBootScreen, pathname])
  
  if (!showBootScreen) return null
  
  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })
  
  return (
    <View style={{
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "#E8E0D5", // beige
      zIndex: 99999,
      justifyContent: "center",
      alignItems: "center",
    }}>
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <Image
          source={require("../assets/images/loading.png")}
          style={{ width: 120, height: 120 }}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  )
}

// Refreshing overlay component - shows when session is being refreshed
// Matches the boot screen design for consistency
function RefreshingOverlay() {
  const { refreshing } = useAuth()
  const [showOverlay, setShowOverlay] = useState(false)
  const startTimeRef = useRef<number | null>(null)
  const minDisplayTimeRef = useRef<NodeJS.Timeout | null>(null)
  const rotateAnim = useRef(new Animated.Value(0)).current
  
  useEffect(() => {
    if (refreshing) {
      // Start showing overlay
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now()
        setShowOverlay(true)
      }
    } else {
      // Refresh completed - ensure minimum 2s display time
      if (startTimeRef.current) {
        const elapsed = Date.now() - startTimeRef.current
        const remainingTime = Math.max(0, 2000 - elapsed)
        
        if (remainingTime > 0) {
          // Set timeout to hide after minimum display time
          minDisplayTimeRef.current = setTimeout(() => {
            setShowOverlay(false)
            startTimeRef.current = null
            minDisplayTimeRef.current = null
          }, remainingTime)
        } else {
          // Already shown for 2s+, hide immediately
          setShowOverlay(false)
          startTimeRef.current = null
        }
      }
    }
    
    return () => {
      if (minDisplayTimeRef.current) {
        clearTimeout(minDisplayTimeRef.current)
        minDisplayTimeRef.current = null
      }
    }
  }, [refreshing])
  
  // Animate icon rotation - start immediately on mount to ensure no gap
  // This ensures spinner is always spinning when overlay is visible
  useEffect(() => {
    // Start rotation animation immediately - don't wait for showOverlay
    // This prevents any gap where overlay is visible but animation hasn't started
    const rotateAnimation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000, // 3 seconds for a full rotation
        useNativeDriver: true,
      })
    )

    rotateAnimation.start()

    return () => {
      rotateAnimation.stop()
    }
  }, [rotateAnim]) // Remove showOverlay dependency - always animate
  
  if (!showOverlay) return null
  
  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })
  
  const theme2Colors = {
    beige: "#E8E0D5",
  }
  
  return (
    <View style={styles.refreshingOverlay}>
      <View style={styles.refreshingContainer}>
        <Animated.View
          style={[
            styles.iconContainer,
            {
              transform: [{ rotate: spin }],
            },
          ]}
        >
          <Image
            source={require("../assets/images/loading.png")}
            style={styles.refreshingIcon}
            resizeMode="contain"
          />
        </Animated.View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  refreshingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  refreshingContainer: {
    flex: 1,
    backgroundColor: "#E8E0D5", // theme2Colors.beige
    justifyContent: "center",
    alignItems: "center",
  },
  iconContainer: {
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  refreshingIcon: {
    width: 120,
    height: 120,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on 401/403 (expired session) - let session refresh handle it
        if (error?.status === 401 || error?.status === 403) {
          return false
        }
        // Retry up to 2 times for other errors
        return failureCount < 2
      },
      staleTime: 0, // Always consider data stale to ensure fresh data
      refetchOnMount: true,
      refetchOnWindowFocus: true,
    },
  },
})

export default function RootLayout() {
  // CRITICAL: Check for password reset link on app start (before AuthProvider initializes)
  // This prevents AuthProvider from trying to refresh an invalid session
  useEffect(() => {
    async function checkInitialURL() {
      try {
        const url = await Linking.getInitialURL()
        if (url) {
          console.log("[_layout] Checking initial URL on app start:", url)
          
          // Decode URL-encoded characters (e.g., %23 becomes #)
          const decodedUrl = decodeURIComponent(url)
          
          // Check for password reset errors first (check both encoded and decoded)
          const isPasswordResetError = url.includes("otp_expired") || 
            decodedUrl.includes("otp_expired") ||
            url.includes("error_code=") ||
            decodedUrl.includes("error_code=") ||
            (decodedUrl.includes("error=") && decodedUrl.includes("access_denied"))
          
          if (isPasswordResetError) {
            console.log("[_layout] Password reset error detected on app start, navigating to forgot-password")
            // Navigate immediately - don't wait for boot flow
            // Use setTimeout to ensure router is ready
            setTimeout(() => {
              router.replace("/(onboarding)/forgot-password")
            }, 100)
            return
          }
          
          // Check for valid password reset link (only if not an error)
          // First check if it's an error - if so, skip to avoid double navigation
          const hasResetError = url.includes("otp_expired") || 
            url.includes("error_code=") ||
            url.includes("error=access_denied")
          
          if (!hasResetError && (url.includes("reset-password") || (url.includes("goodtimes://") && (url.includes("type=recovery") || url.includes("#access_token"))))) {
            console.log("[_layout] Valid password reset link detected on app start:", url)
            
            // Extract tokens from hash fragment
            const hashMatch = url.match(/#(.+)/)
            if (hashMatch) {
              const hashParams = new URLSearchParams(hashMatch[1])
              const accessToken = hashParams.get("access_token")
              const type = hashParams.get("type")
              const refreshToken = hashParams.get("refresh_token")
              
              // Only proceed if we have valid tokens and it's a recovery type
              // Also check that there's no error in the URL
              const hasError = hashParams.get("error") || hashParams.get("error_code")
              if (!hasError && accessToken && type === "recovery" && supabase?.auth) {
                console.log("[_layout] Setting recovery session immediately on app start")
                // Set session BEFORE AuthProvider tries to refresh
                const { data, error } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken || "",
                })
                
                if (error) {
                  console.error("[_layout] Failed to set recovery session on app start:", error)
                  setTimeout(() => {
                    router.replace("/(onboarding)/forgot-password")
                  }, 100)
                  return
                }
                
                if (data.session) {
                  // Navigate to reset password screen
                  // Use setTimeout to ensure router is ready
                  setTimeout(() => {
                    router.replace("/(onboarding)/reset-password")
                  }, 100)
                  return
                }
              } else if (hasError) {
                console.log("[_layout] Password reset link has error, navigating to forgot-password")
                setTimeout(() => {
                  router.replace("/(onboarding)/forgot-password")
                }, 100)
                return
              }
            }
          }
        }
      } catch (error) {
        console.warn("[_layout] Failed to check initial URL:", error)
      }
    }
    checkInitialURL()
  }, [])
  
  // 1️⃣ Load fonts (keep this active)
  const [fontsLoaded, fontError] = useFonts({
    "LibreBaskerville-Regular": require("../assets/fonts/LibreBaskerville-Regular.ttf"),
    "LibreBaskerville-Bold": require("../assets/fonts/LibreBaskerville-Bold.ttf"),
    "Roboto-Regular": require("../assets/fonts/Roboto-Regular.ttf"),
    "Roboto-Medium": require("../assets/fonts/Roboto-Medium.ttf"),
    "Roboto-Bold": require("../assets/fonts/Roboto-Bold.ttf"),
    "PMGothicLudington-Text115": require("../assets/fonts/PMGothicLudington-Text115.ttf"),
  })
  
  // Option 4: Add font loading timeout - proceed without fonts if they don't load within 5 seconds
  const [fontsTimedOut, setFontsTimedOut] = useState(false)
  useEffect(() => {
    const fontTimeout = setTimeout(() => {
      if (!fontsLoaded && !fontError) {
        console.warn("[_layout] Font loading timeout - proceeding without custom fonts")
        setFontsTimedOut(true)
      }
    }, 5000) // 5 second timeout
    
    return () => clearTimeout(fontTimeout)
  }, [fontsLoaded, fontError])

  // Check for EAS Updates (only in production builds, not in development)
  useEffect(() => {
    async function checkForUpdates() {
      if (__DEV__) {
        // Skip update checking in development
        return
      }

      try {
        // Check if Updates is enabled (only available in production builds)
        if (!Updates || !Updates.isEnabled) {
          console.log("[_layout] Updates not enabled (development build)")
          return
        }

        const update = await Updates.checkForUpdateAsync()
        
        if (update.isAvailable) {
          console.log("[_layout] Update available, downloading...")
          await Updates.fetchUpdateAsync()
          console.log("[_layout] Update downloaded, will reload on next app restart")
          // Optionally reload immediately:
          // await Updates.reloadAsync()
        } else {
          console.log("[_layout] No updates available")
        }
      } catch (error) {
        console.error("[_layout] Error checking for updates:", error)
        // Don't block app startup if update check fails
      }
    }

    // Only check for updates after fonts are loaded
    if (fontsLoaded || fontsTimedOut) {
      checkForUpdates()
    }
  }, [fontsLoaded, fontsTimedOut])

  // Handle notification clicks
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data
      if (!data) return

      const { type, group_id, entry_id, prompt_id } = data

      // CRITICAL: Always store notification data and force boot screen to show
      // Boot screen will ensure session is valid before navigating
      // This prevents black screens and ensures smooth experience
      console.log("[_layout] Notification clicked - storing for boot screen to handle")
      
      let shouldNavigateDirectly = false
      
      try {
        const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default
        
        // Store notification data for boot screen to process
        await AsyncStorage.setItem("pending_notification", JSON.stringify({
          type,
          group_id,
          entry_id,
          prompt_id,
          timestamp: Date.now(),
        }))
        
        // CRITICAL: Set flag to force boot screen to show when app opens from notification
        // This ensures session refresh happens before navigation
        await AsyncStorage.setItem("notification_clicked", "true")
        console.log("[_layout] Notification stored, boot screen will be forced to show")
        
        // CRITICAL: Check if app is already initialized (user is logged in and app is running)
        // Only navigate directly if app is already running and initialized
        // Otherwise, let boot screen handle it (prevents black screen on cold start)
        try {
          const { data: { session } } = await supabase.auth.getSession()
          const isAppInitialized = !!session
          
          if (isAppInitialized) {
            // App is already running - navigate directly (user clicked notification while app was open)
            console.log("[_layout] App already initialized - will navigate directly")
            shouldNavigateDirectly = true
          } else {
            // App is NOT initialized (cold start) - let boot screen handle navigation
            // This prevents black screen when app opens from closed state
            console.log("[_layout] App not initialized (cold start) - boot screen will handle navigation")
            return // Exit early - boot screen will handle navigation
          }
        } catch (sessionError) {
          // If we can't check session, assume cold start and let boot screen handle it
          console.log("[_layout] Could not check session - boot screen will handle navigation")
          return // Exit early - boot screen will handle navigation
        }
      } catch (error) {
        console.error("[_layout] Error storing notification:", error)
        // If storage fails, don't navigate - better to show boot screen than black screen
        return // Exit early - don't navigate if storage fails
      }

      // Only navigate if app is already initialized (user clicked notification while app was open)
      if (shouldNavigateDirectly) {
        setTimeout(() => {
          if (type === "daily_prompt" && group_id && prompt_id) {
            router.push({
              pathname: "/(main)/modals/entry-composer",
              params: {
                promptId: prompt_id,
                date: new Date().toISOString().split("T")[0],
                returnTo: "/(main)/home",
              },
            })
          } else if (type === "new_entry" && group_id && entry_id) {
            router.push({
              pathname: "/(main)/modals/entry-detail",
              params: {
                entryId: entry_id,
                returnTo: "/(main)/home",
              },
            })
          } else if (type === "new_comment" && entry_id) {
            router.push({
              pathname: "/(main)/modals/entry-detail",
              params: {
                entryId: entry_id,
                returnTo: "/(main)/home",
              },
            })
          } else if (type === "member_joined" && group_id) {
            router.push({
              pathname: "/(main)/home",
              params: { focusGroupId: group_id },
            })
          } else if (type === "inactivity_reminder" && group_id) {
            router.push({
              pathname: "/(main)/home",
              params: { focusGroupId: group_id },
            })
          }
        }, 300) // Small delay to ensure app state is ready
      }
    })

    return () => subscription.remove()
  }, [])

  // Handle OAuth redirects and deep links
  useEffect(() => {
    const handleURL = async (event: { url: string }) => {
      try {
        const { url } = event
        console.log("[_layout] Received URL:", url)
        
        // Decode URL to check both encoded and decoded versions
        let decodedUrl = url
        try {
          decodedUrl = decodeURIComponent(url)
          console.log("[_layout] Decoded URL:", decodedUrl)
        } catch (e) {
          console.warn("[_layout] Failed to decode URL:", e)
        }
        
        // Filter out non-OAuth URLs (like expo development client URLs)
        if (url.includes("expo-development-client") || url.includes("192.168")) {
          console.log("[_layout] Ignoring non-OAuth URL")
          return
        }
        
        // CRITICAL: Handle password reset links FIRST (before OAuth)
        // This prevents AuthProvider from trying to refresh an invalid session
        // Check for reset-password in URL OR error codes related to password reset
        // Also check for recovery tokens in hash (Supabase may redirect to goodtimes://#access_token=...&type=recovery)
        const hasRecoveryType = url.includes("type=recovery") || decodedUrl.includes("type=recovery")
        const hasRecoveryToken = (url.includes("#access_token") || decodedUrl.includes("#access_token")) && hasRecoveryType
        const hasResetError = url.includes("otp_expired") || decodedUrl.includes("otp_expired") || url.includes("error_code=") || decodedUrl.includes("error_code=")
        
        const isPasswordReset = url.includes("reset-password") || 
          decodedUrl.includes("reset-password") ||
          hasRecoveryType ||
          hasResetError ||
          (url.includes("goodtimes://") && hasRecoveryToken)
        
        if (isPasswordReset) {
          console.log("[_layout] Password reset link detected (priority handling):", url)
          console.log("[_layout] Decoded password reset URL:", decodedUrl)
          
          // Check for errors first (expired/invalid link) - check both encoded and decoded
          const errorMatch = decodedUrl.match(/[#&]error=([^&]+)/) || url.match(/[#&]error=([^&]+)/)
          const errorCodeMatch = decodedUrl.match(/[#&]error_code=([^&]+)/) || url.match(/[#&]error_code=([^&]+)/)
          const errorDescriptionMatch = decodedUrl.match(/[#&]error_description=([^&]+)/) || url.match(/[#&]error_description=([^&]+)/)
          
          if (errorMatch || errorCodeMatch) {
            const error = errorMatch ? decodeURIComponent(errorMatch[1]) : null
            const errorCode = errorCodeMatch ? decodeURIComponent(errorCodeMatch[1]) : null
            const errorDescription = errorDescriptionMatch ? decodeURIComponent(errorDescriptionMatch[1].replace(/\+/g, " ")) : null
            
            console.warn("[_layout] Password reset link error detected:", { error, errorCode, errorDescription, originalUrl: url, decodedUrl })
            
            // Navigate to forgot-password screen with error
            // Use replace to ensure navigation happens even if boot flow is running
            // Use setTimeout to ensure router is ready
            console.log("[_layout] Navigating to forgot-password screen due to expired/invalid link")
            setTimeout(() => {
              console.log("[_layout] Executing navigation to forgot-password")
              router.replace("/(onboarding)/forgot-password")
            }, 100)
            return // Exit early - don't process as OAuth
          }
          
          // If no error, check if it's a valid reset link with tokens
          console.log("[_layout] No error detected, checking for valid reset tokens...")
          
          // Extract tokens from hash fragment (goodtimes://reset-password#access_token=...)
          // Also handle case where Supabase redirects to goodtimes://#access_token=... (without reset-password path)
          let hashMatch = decodedUrl.match(/#(.+)/) || url.match(/#(.+)/)
          let accessToken: string | null = null
          let type: string | null = null
          let refreshToken: string | null = null
          
          console.log("[_layout] Hash match result:", hashMatch ? hashMatch[1].substring(0, 200) : "none")
          
          if (hashMatch) {
            // Tokens in hash fragment (standard Supabase format)
            const hashParams = new URLSearchParams(hashMatch[1])
            accessToken = hashParams.get("access_token")
            type = hashParams.get("type")
            refreshToken = hashParams.get("refresh_token")
            
            console.log("[_layout] Extracted tokens from hash:", {
              hasAccessToken: !!accessToken,
              accessTokenLength: accessToken?.length || 0,
              type,
              hasRefreshToken: !!refreshToken,
              refreshTokenLength: refreshToken?.length || 0,
              hashFragment: hashMatch[1].substring(0, 200) // Log first 200 chars
            })
          } else if (url.includes("?") || decodedUrl.includes("?")) {
            // Check query params (fallback for non-standard formats)
            try {
              const urlToParse = decodedUrl.includes("?") ? decodedUrl : url
              const urlObj = new URL(urlToParse.replace("goodtimes://", "https://"))
              accessToken = urlObj.searchParams.get("access_token") || urlObj.searchParams.get("token")
              type = urlObj.searchParams.get("type")
              refreshToken = urlObj.searchParams.get("refresh_token")
              
              console.log("[_layout] Extracted tokens from query params:", {
                hasAccessToken: !!accessToken,
                type,
                hasRefreshToken: !!refreshToken
              })
            } catch (e) {
              console.warn("[_layout] Failed to parse URL:", e)
            }
          }
          
          if (accessToken && type === "recovery") {
            console.log("[_layout] Valid recovery tokens found, setting session...")
            // CRITICAL: Set session IMMEDIATELY before AuthProvider tries to refresh
            // This prevents "Invalid Refresh Token" errors
            if (!supabase?.auth) {
              console.warn("[_layout] Supabase auth not available")
              router.push("/(onboarding)/forgot-password")
              return
            }
            
            console.log("[_layout] Setting recovery session immediately (before AuthProvider refresh)")
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || "",
            })
            
            if (error) {
              console.error("[_layout] Failed to set recovery session:", error)
              setTimeout(() => {
                router.replace("/(onboarding)/forgot-password")
              }, 100)
              return
            }
            
            if (data.session) {
              const userEmail = data.session.user.email
              console.log("[_layout] Recovery session set successfully:", {
                userId: data.session.user.id,
                email: userEmail,
                hasAccessToken: !!data.session.access_token,
                hasRefreshToken: !!data.session.refresh_token
              })
              
              // Store email in AsyncStorage as backup in case session doesn't persist
              // This ensures reset-password.tsx can still access it
              if (userEmail) {
                try {
                  await AsyncStorage.setItem("password_reset_email", userEmail)
                  console.log("[_layout] Stored email in AsyncStorage as backup")
                } catch (e) {
                  console.warn("[_layout] Failed to store email in AsyncStorage:", e)
                }
              }
              
              // Verify session is persisted before navigating
              // Wait a moment to ensure session is saved
              await new Promise(resolve => setTimeout(resolve, 200))
              
              // Double-check session is still there
              const { data: { session: verifySession } } = await supabase.auth.getSession()
              if (!verifySession) {
                console.warn("[_layout] Session not persisted after setting, but email stored - proceeding anyway")
                // Still navigate - reset-password.tsx can use AsyncStorage email
              } else {
                console.log("[_layout] Session verified, navigating to reset-password")
              }
              
              // Navigate to reset password screen
              router.replace("/(onboarding)/reset-password")
              return // Exit early - don't process as OAuth
            } else {
              console.warn("[_layout] No session after setting recovery token")
              router.push("/(onboarding)/forgot-password")
              return
            }
          } else {
            console.log("[_layout] No tokens in URL yet, navigating to reset-password screen (it will handle URL parsing)")
            // Navigate to reset password screen - it will handle extracting tokens from URL
            router.push("/(onboarding)/reset-password")
            return // Exit early - don't process as OAuth
          }
        }
        
        // Handle OAuth callback from Supabase
        // Skip if it's a password reset error (already handled above)
        const isOAuthCallback = (url.includes("#access_token=") || url.includes("?code=") || url.includes("access_token=") || url.includes("error=")) && 
          !url.includes("otp_expired") && 
          !url.includes("type=recovery")
        
        if (isOAuthCallback) {
          console.log("[_layout] OAuth callback detected")
          // Supabase will handle the session automatically
          // Just ensure we're listening for auth state changes
          if (!supabase?.auth) {
            console.warn("[_layout] Supabase auth not available")
            return
          }
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            // User successfully authenticated via OAuth
            // Save biometric credentials if enabled
            try {
              const { getBiometricPreference, saveBiometricCredentials } = await import("../lib/biometric")
              const biometricEnabled = await getBiometricPreference()
              if (biometricEnabled && session.refresh_token) {
                await saveBiometricCredentials(session.refresh_token, session.user.id)
              }
            } catch (error) {
              console.warn("[_layout] failed to save biometric credentials after OAuth:", error)
            }
            // Navigation will happen automatically via app/index.tsx
          }
        }
        // Handle join links (both deep link and HTTPS)
        else if (url.includes("goodtimes://join/")) {
          const groupId = url.split("goodtimes://join/")[1]?.split("?")[0]?.split("/")[0]
          if (groupId) {
            router.push(`/join/${groupId}`)
          }
        }
        else if (url.includes("thegoodtimes.app/join/")) {
          const groupId = url.split("thegoodtimes.app/join/")[1]?.split("?")[0]?.split("/")[0]
          if (groupId) {
            router.push(`/join/${groupId}`)
          }
        }
        // Handle app store rating deep link
        else if (url.includes("goodtimes://rate")) {
          await openAppStoreReview()
        }
      } catch (error) {
        console.error("[_layout] Error handling URL:", error)
      }
    }

    // Listen for deep links
    console.log("[_layout] Setting up deep link listener for password reset and OAuth")
    const subscription = Linking.addEventListener("url", (event) => {
      console.log("[_layout] Deep link event received:", event.url)
      handleURL(event)
    })

    // Check if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log("[_layout] Initial URL found:", url)
        handleURL({ url })
      } else {
        console.log("[_layout] No initial URL found")
      }
    }).catch((error) => {
      console.error("[_layout] Error getting initial URL:", error)
    })

    return () => {
      subscription.remove()
    }
  }, [])

  // 2️⃣ SplashScreen logic - Keep native splash visible until boot screen is ready
  // CRITICAL: Don't hide native splash immediately - let boot screen handle it
  // This prevents black screen flash between native splash and boot screen
  // CRITICAL FIX: Don't hide native splash here - let app/index.tsx handle it
  // This ensures boot screen is visible before native splash hides, preventing blank beige screen
  // The native splash will be hidden by app/index.tsx once boot screen is ready

  // 3️⃣ Render the app normally
  // Option 4: Proceed with app even if fonts haven't loaded (after timeout or error)
  // System fonts will be used as fallback
  if (!fontsLoaded && !fontsTimedOut && !fontError) {
    return null // Keep splash screen visible while fonts load (up to 5 seconds)
  }

  // PostHog configuration
  const posthogApiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY || ''
  const posthogHost = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'
  const isPostHogConfigured = posthogApiKey && posthogApiKey.startsWith('phc_')

  if (__DEV__ && isPostHogConfigured) {
    console.log('[PostHog] Configuration:', {
      apiKey: posthogApiKey.substring(0, 10) + '...',
      host: posthogHost,
      configured: isPostHogConfigured
    })
  }

  // Always render PostHogProvider to satisfy React hooks rules
  // When not configured, PostHogProvider may not initialize properly, but usePostHog will return null
  // ErrorBoundary will catch any initialization errors
  return (
    <ErrorBoundary>
      <PostHogProvider
        apiKey={isPostHogConfigured ? posthogApiKey : 'phc_dummy_key_for_unconfigured'}
        options={{
          host: posthogHost,
          // Privacy-first settings - always enable when configured (autocapture may not work in simulator)
          captureApplicationLifecycleEvents: isPostHogConfigured,
          captureDeepLinks: isPostHogConfigured,
          captureScreens: isPostHogConfigured, // Autocapture screen views
          captureScreenViews: isPostHogConfigured, // Additional screen view tracking
          sessionReplay: false, // Disabled for privacy
          anonymizeIP: true,
          enableFeatureFlags: false, // Disabled initially
          debug: __DEV__ && isPostHogConfigured, // Enable debug logging in dev
          flushAt: 1, // Send events immediately (good for testing)
          flushInterval: 0, // Don't batch events
        }}
      >
        <SafeAreaProvider>
          <AuthProvider>
            <BootRecheckHandler />
            <RefreshingOverlay />
            <BootScreenOverlay />
            <ThemeProvider>
            <QueryClientProvider client={queryClient}>
                <ForegroundQueryRefresher />
                <TabBarProvider>
              <Stack screenOptions={{ headerShown: false }} />
                </TabBarProvider>
            </QueryClientProvider>
            </ThemeProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </PostHogProvider>
    </ErrorBoundary>
  )
}

// ------------------------------------------------------
// ORIGINAL FULL VERSION (preserved + commented out)
// ------------------------------------------------------

// import 'react-native-reanimated'
// import { useEffect } from "react"
// import { Stack } from "expo-router"
// import { useFonts } from "expo-font"
// import * as SplashScreen from "expo-splash-screen"
// import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
// import { StatusBar } from "expo-status-bar"
// import { AuthProvider } from "../components/AuthProvider"

// SplashScreen.preventAutoHideAsync()

// const queryClient = new QueryClient()

// export default function RootLayout() {
//   const [fontsLoaded] = useFonts({
//     "LibreBaskerville-Regular": require("../assets/fonts/LibreBaskerville-Regular.ttf"),
//     "LibreBaskerville-Bold": require("../assets/fonts/LibreBaskerville-Bold.ttf"),
//     "Roboto-Regular": require("../assets/fonts/Roboto-Regular.ttf"),
//     "Roboto-Medium": require("../assets/fonts/Roboto-Medium.ttf"),
//     "Roboto-Bold": require("../assets/fonts/Roboto-Bold.ttf"),
//   })

//   useEffect(() => {
//     if (fontsLoaded) SplashScreen.hideAsync()
//   }, [fontsLoaded])

//   if (!fontsLoaded) return null

//   return (
//     <AuthProvider>
//       <QueryClientProvider client={queryClient}>
//         <StatusBar style="light" />
//         <Stack screenOptions={{ headerShown: false }} />
//       </QueryClientProvider>
//     </AuthProvider>
//   )
// }
