"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { supabase } from "../lib/supabase"
import type { User } from "../lib/types"
import { getBiometricPreference, saveBiometricCredentials, clearBiometricCredentials } from "../lib/biometric"

interface AuthContextType {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUser(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
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
        setUser(null)
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function loadUser(userId: string) {
    try {
      const { data } = await supabase.from("users").select("*").eq("id", userId).single()
      setUser(data)
    } catch (error) {
      console.error("[v0] Error loading user:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSignOut() {
    // Clear biometric credentials on sign out
    try {
      await clearBiometricCredentials()
    } catch (error) {
      console.warn("[AuthProvider] failed to clear biometric credentials:", error)
    }
    await supabase.auth.signOut()
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, loading, signOut: handleSignOut }}>{children}</AuthContext.Provider>
}
