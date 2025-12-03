// ------------------------------------------------------
// WORKING MINIMAL VERSION (active)
// ------------------------------------------------------

import { Stack } from "expo-router"
import { useFonts } from "expo-font"
import * as SplashScreen from "expo-splash-screen"
import { useEffect, useState, useRef } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { AuthProvider, useAuth } from "../components/AuthProvider"
import { ErrorBoundary } from "../components/ErrorBoundary"
import * as Linking from "expo-linking"
import * as Notifications from "expo-notifications"
import { router } from "expo-router"
import { PostHogProvider } from "posthog-react-native"
import { TabBarProvider } from "../lib/tab-bar-context"
import { ThemeProvider } from "../lib/theme-context"
import { View, ActivityIndicator, StyleSheet, ImageBackground, Text } from "react-native"
import { typography, colors as themeColors } from "../lib/theme"
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

// Refreshing overlay component - shows when session is being refreshed
// Matches the boot screen design for consistency
function RefreshingOverlay() {
  const { refreshing } = useAuth()
  const [loadingDots, setLoadingDots] = useState(".")
  const [showOverlay, setShowOverlay] = useState(false)
  const startTimeRef = useRef<number | null>(null)
  const minDisplayTimeRef = useRef<NodeJS.Timeout | null>(null)
  
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
  
  useEffect(() => {
    if (!showOverlay) return
    
    const interval = setInterval(() => {
      setLoadingDots((prev) => {
        if (prev === ".") return ".."
        if (prev === "..") return "..."
        return "."
      })
    }, 500)
    
    return () => clearInterval(interval)
  }, [showOverlay])
  
  if (!showOverlay) return null
  
  return (
    <View style={styles.refreshingOverlay}>
      <ImageBackground
        source={require("../assets/images/welcome-home.png")}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>Loading Good Times{loadingDots}</Text>
        </View>
      </ImageBackground>
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
  backgroundImage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingOverlay: {
    // No background - text directly over image
  },
  loadingText: {
    ...typography.body,
    fontSize: 18,
    color: themeColors.white,
    textAlign: "center",
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
  // 1️⃣ Load fonts (keep this active)
  const [fontsLoaded, fontError] = useFonts({
    "LibreBaskerville-Regular": require("../assets/fonts/LibreBaskerville-Regular.ttf"),
    "LibreBaskerville-Bold": require("../assets/fonts/LibreBaskerville-Bold.ttf"),
    "Roboto-Regular": require("../assets/fonts/Roboto-Regular.ttf"),
    "Roboto-Medium": require("../assets/fonts/Roboto-Medium.ttf"),
    "Roboto-Bold": require("../assets/fonts/Roboto-Bold.ttf"),
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
      try {
        const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default
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
        // Boot screen will handle navigation after ensuring session is valid (see app/index.tsx)
        // This ensures we never navigate with a stale session
        return // Don't navigate yet - wait for boot screen to complete
      } catch (error) {
        console.error("[_layout] Error storing notification:", error)
        // If storage fails, try to navigate immediately (fallback)
      }

      // Small delay to ensure app is ready
      setTimeout(() => {
        if (type === "daily_prompt" && group_id && prompt_id) {
          // Navigate to entry composer with prompt
          router.push({
            pathname: "/(main)/modals/entry-composer",
            params: {
              promptId: prompt_id,
              date: new Date().toISOString().split("T")[0],
              returnTo: "/(main)/home",
            },
          })
        } else if (type === "new_entry" && group_id && entry_id) {
          // Navigate to entry detail
          router.push({
            pathname: "/(main)/modals/entry-detail",
            params: {
              entryId: entry_id,
              returnTo: "/(main)/home",
            },
          })
        } else if (type === "new_comment" && entry_id) {
          // Navigate to entry detail
          router.push({
            pathname: "/(main)/modals/entry-detail",
            params: {
              entryId: entry_id,
              returnTo: "/(main)/home",
            },
          })
        } else if (type === "member_joined" && group_id) {
          // Navigate to home with group focused
          router.push({
            pathname: "/(main)/home",
            params: { focusGroupId: group_id },
          })
        } else if (type === "inactivity_reminder" && group_id) {
          // Navigate to home with group focused
          router.push({
            pathname: "/(main)/home",
            params: { focusGroupId: group_id },
          })
        }
      }, 300) // Small delay to ensure app state is ready
    })

    return () => subscription.remove()
  }, [])

  // Handle OAuth redirects and deep links
  useEffect(() => {
    const handleURL = async (event: { url: string }) => {
      try {
        const { url } = event
        console.log("[_layout] Received URL:", url)
        
        // Filter out non-OAuth URLs (like expo development client URLs)
        if (url.includes("expo-development-client") || url.includes("192.168")) {
          console.log("[_layout] Ignoring non-OAuth URL")
          return
        }
        
        // Handle OAuth callback from Supabase
        if (url.includes("#access_token=") || url.includes("?code=") || url.includes("access_token=") || url.includes("error=")) {
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
        // Handle password reset links
        else if (url.includes("goodtimes://reset-password")) {
          // Extract tokens from hash fragment
          const hashMatch = url.match(/#(.+)/)
          if (hashMatch) {
            const hashParams = new URLSearchParams(hashMatch[1])
            const accessToken = hashParams.get("access_token")
            const type = hashParams.get("type")
            
            if (accessToken && type === "recovery") {
              // Set session with recovery token
              if (!supabase?.auth) {
                console.warn("[_layout] Supabase auth not available")
                return
              }
              
              const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: hashParams.get("refresh_token") || "",
              })
              
              if (error) {
                console.error("[_layout] Failed to set recovery session:", error)
                router.push("/(onboarding)/forgot-password")
                return
              }
              
              if (data.session) {
                // Navigate to reset password screen
                router.push("/(onboarding)/reset-password")
              }
            }
          } else {
            // No hash fragment, just navigate to reset password screen
            router.push("/(onboarding)/reset-password")
          }
        }
      } catch (error) {
        console.error("[_layout] Error handling URL:", error)
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
    }
  }, [])

  // 2️⃣ SplashScreen logic (safe timeout fallback)
  useEffect(() => {
    const timer = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 1500)
    // Option 4: Hide splash screen when fonts load OR timeout occurs
    if (fontsLoaded || fontsTimedOut) SplashScreen.hideAsync().catch(() => {})
    return () => clearTimeout(timer)
  }, [fontsLoaded, fontsTimedOut])

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
            <RefreshingOverlay />
            <ThemeProvider>
            <QueryClientProvider client={queryClient}>
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
