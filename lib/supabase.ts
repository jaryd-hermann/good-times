import "react-native-url-polyfill/auto"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ""

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = `Missing Supabase environment variables!
EXPO_PUBLIC_SUPABASE_URL: ${supabaseUrl ? "✓" : "✗ MISSING"}
EXPO_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? "✓" : "✗ MISSING"}
Check your .env file or EAS secrets.`
  console.error("[supabase]", errorMsg)
  // Don't throw immediately - create a dummy client that will fail gracefully
  // This prevents crashes during module initialization
}

let supabase: ReturnType<typeof createClient>

try {
  if (!supabaseUrl || !supabaseAnonKey) {
    // Create a dummy client that will fail on first use
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

export { supabase }
