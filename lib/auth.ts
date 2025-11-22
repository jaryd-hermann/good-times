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
  const {
    data: { session },
    error,
  } = await supabase.auth.refreshSession()
  if (error) throw error
  return session
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
