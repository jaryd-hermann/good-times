import { supabase } from "./supabase"
import type { User } from "./types"

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session
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
