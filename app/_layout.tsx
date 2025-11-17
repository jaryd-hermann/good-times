// ------------------------------------------------------
// WORKING MINIMAL VERSION (active)
// ------------------------------------------------------

import { Stack } from "expo-router"
import { useFonts } from "expo-font"
import * as SplashScreen from "expo-splash-screen"
import { useEffect } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { AuthProvider } from "../components/AuthProvider"
import * as Linking from "expo-linking"
import * as Notifications from "expo-notifications"
import { router } from "expo-router"
import { supabase } from "../lib/supabase"

SplashScreen.preventAutoHideAsync().catch(() => {})

const queryClient = new QueryClient()

export default function RootLayout() {
  // 1️⃣ Load fonts (keep this active)
  const [fontsLoaded] = useFonts({
    "LibreBaskerville-Regular": require("../assets/fonts/LibreBaskerville-Regular.ttf"),
    "LibreBaskerville-Bold": require("../assets/fonts/LibreBaskerville-Bold.ttf"),
    "Roboto-Regular": require("../assets/fonts/Roboto-Regular.ttf"),
    "Roboto-Medium": require("../assets/fonts/Roboto-Medium.ttf"),
    "Roboto-Bold": require("../assets/fonts/Roboto-Bold.ttf"),
  })

  // Handle notification clicks
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data
      if (!data) return

      const { type, group_id, entry_id, prompt_id } = data

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
      }
    })

    return () => subscription.remove()
  }, [])

  // Handle OAuth redirects and deep links
  useEffect(() => {
    const handleURL = async (event: { url: string }) => {
      const { url } = event
      // Handle OAuth callback from Supabase
      if (url.includes("#access_token=") || url.includes("?code=")) {
        // Supabase will handle the session automatically
        // Just ensure we're listening for auth state changes
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
      // Handle join links
      else if (url.includes("goodtimes://join/")) {
        const groupId = url.split("goodtimes://join/")[1]?.split("?")[0]?.split("/")[0]
        if (groupId) {
          router.push(`/join/${groupId}`)
        }
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
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {})
    return () => clearTimeout(timer)
  }, [fontsLoaded])

  // 3️⃣ Render the app normally
  // Add error boundary for crashes
  if (!fontsLoaded) {
    return null // Keep splash screen visible while fonts load
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <Stack screenOptions={{ headerShown: false }} />
        </QueryClientProvider>
      </AuthProvider>
    </SafeAreaProvider>
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
