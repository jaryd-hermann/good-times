// Wrap in try-catch to prevent crashes during module initialization
let urlPolyfillLoaded = false
try {
  require("react-native-url-polyfill/auto")
  urlPolyfillLoaded = true
} catch (error) {
  console.warn("[supabase] Failed to load url-polyfill:", error)
}

import AsyncStorage from "@react-native-async-storage/async-storage"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ""

// Validate environment variables
const hasValidConfig = supabaseUrl && supabaseAnonKey && 
  supabaseUrl !== "https://placeholder.supabase.co" && 
  supabaseAnonKey !== "placeholder-key"

if (!hasValidConfig) {
  const errorMsg = `Missing Supabase environment variables!
EXPO_PUBLIC_SUPABASE_URL: ${supabaseUrl ? "✓" : "✗ MISSING"}
EXPO_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? "✓" : "✗ MISSING"}
Check your .env file or EAS secrets.
For EAS Build, set secrets with:
  eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value YOUR_URL
  eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value YOUR_KEY`
  console.error("[supabase]", errorMsg)
}

let supabase: ReturnType<typeof createClient>

try {
  if (!hasValidConfig) {
    // Create a dummy client that will fail gracefully
    supabase = createClient("https://placeholder.supabase.co", "placeholder-key", {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    })
    console.warn("[supabase] Using placeholder client - app will not work until env vars are set")
  } else {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  }
} catch (error) {
  console.error("[supabase] Failed to create client:", error)
  // Create minimal fallback client
  supabase = createClient("https://placeholder.supabase.co", "placeholder-key", {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}

// Export a function to check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return hasValidConfig
}

export { supabase }
