// ------------------------------------------------------
// WORKING MINIMAL VERSION (active)
// ------------------------------------------------------

import { Stack } from "expo-router"
import { useFonts } from "expo-font"
import * as SplashScreen from "expo-splash-screen"
import { useEffect } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider } from "../components/AuthProvider"

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

  // 2️⃣ SplashScreen logic (safe timeout fallback)
  useEffect(() => {
    const timer = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 1500)
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {})
    return () => clearTimeout(timer)
  }, [fontsLoaded])

  // 3️⃣ Render the app normally
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </AuthProvider>
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
