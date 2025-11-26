import { supabase } from "./supabase"
import type { User } from "./types"

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentSession() {
  try {
    // Add timeout protection to prevent hanging
    const getSessionPromise = supabase.auth.getSession()
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("getSession timeout")), 5000)
    )
    
    const result: any = await Promise.race([getSessionPromise, timeoutPromise])
    return result?.data?.session || null
  } catch (error: any) {
    console.error("[auth] getCurrentSession failed:", error.message)
    // Return null on timeout/error - let caller handle it
    return null
  }
}

export async function refreshSession() {
  try {
    // Add timeout protection
    const refreshPromise = supabase.auth.refreshSession()
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("refreshSession timeout")), 10000)
    )
    
    const result: any = await Promise.race([refreshPromise, timeoutPromise])
    const { data: { session }, error } = result
    
    if (error) throw error
    return session
  } catch (error: any) {
    console.error("[auth] refreshSession failed:", error.message)
    throw error
  }
}

// Check if session is expired or about to expire (within 5 minutes)
export async function isSessionExpired(): Promise<boolean> {
  try {
    const session = await getCurrentSession()
    if (!session) return true
    
    // Check if session expires within 5 minutes
    const expiresAt = session.expires_at
    if (!expiresAt) return false
    
    const expiresIn = expiresAt - Math.floor(Date.now() / 1000)
    return expiresIn < 300 // Less than 5 minutes
  } catch (error) {
    console.error("[auth] isSessionExpired check failed:", error)
    return true // Assume expired on error
  }
}

// Refresh session if expired or about to expire
export async function ensureValidSession(): Promise<boolean> {
  try {
    const expired = await isSessionExpired()
    if (expired) {
      console.log("[auth] Session expired or expiring soon, refreshing...")
      await refreshSession()
      console.log("[auth] Session refreshed successfully")
      return true
    }
    return true
  } catch (error: any) {
    console.error("[auth] ensureValidSession failed:", error.message)
    return false
  }
}

export function onAuthStateChange(callback: (user: User | null) => void) {
  return supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      const { data } = await supabase.from("users").select("*").eq("id", session.user.id).single()
      callback(data)
    } else {
      callback(null)
    }
  })
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })
  if (error) throw error
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email)
  if (error) throw error
}
