import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { supabase } from "./supabase"
import { getCurrentUser, updateUser } from "./db"
import { getThemeColors, type ThemeColors } from "./theme"

export type Theme = "dark" | "light"

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => Promise<void>
  colors: ThemeColors
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEME_STORAGE_KEY_PREFIX = "user_theme_preference_"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark")
  const [isLoading, setIsLoading] = useState(true)

  // Get theme colors based on current theme - memoized to prevent infinite re-renders
  const colors = useMemo(() => getThemeColors(theme), [theme])

  // Load theme preference on mount
  useEffect(() => {
    async function loadTheme() {
      try {
        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          // No user, default to dark
          setThemeState("dark")
          setIsLoading(false)
          return
        }

        const userId = user.id
        const storageKey = `${THEME_STORAGE_KEY_PREFIX}${userId}`

        // Try AsyncStorage first (fast)
        const cachedTheme = await AsyncStorage.getItem(storageKey)
        if (cachedTheme === "dark" || cachedTheme === "light") {
          setThemeState(cachedTheme)
          setIsLoading(false)
        }

        // Then check database (for sync across devices)
        const profile = await getCurrentUser()
        if (profile?.theme_preference) {
          const dbTheme = profile.theme_preference
          setThemeState(dbTheme)
          // Update AsyncStorage cache
          await AsyncStorage.setItem(storageKey, dbTheme)
        } else {
          // Default to dark if no preference exists
          setThemeState("dark")
          await AsyncStorage.setItem(storageKey, "dark")
        }
      } catch (error) {
        console.error("[ThemeProvider] Failed to load theme:", error)
        // Default to dark on error
        setThemeState("dark")
      } finally {
        setIsLoading(false)
      }
    }

    loadTheme()
  }, [])

  // Set theme and persist
  const setTheme = useCallback(async (newTheme: Theme) => {
    try {
      setThemeState(newTheme)

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        // No user, just update state (shouldn't happen in logged-in screens)
        return
      }

      const userId = user.id
      const storageKey = `${THEME_STORAGE_KEY_PREFIX}${userId}`

      // Save to AsyncStorage immediately (fast)
      await AsyncStorage.setItem(storageKey, newTheme)

      // Save to database (for sync across devices)
      // Only try to save if column exists (migration may not be applied yet)
      try {
        await updateUser(userId, { theme_preference: newTheme })
      } catch (dbError: any) {
        // If column doesn't exist yet, just log and continue (migration needs to be run)
        if (dbError?.code === "PGRST204" || dbError?.message?.includes("theme_preference")) {
          console.warn("[ThemeProvider] theme_preference column not found - migration may need to be applied")
        } else {
          throw dbError // Re-throw other errors
        }
      }
    } catch (error) {
      console.error("[ThemeProvider] Failed to save theme:", error)
      // Revert on error
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const storageKey = `${THEME_STORAGE_KEY_PREFIX}${user.id}`
        const cachedTheme = await AsyncStorage.getItem(storageKey)
        if (cachedTheme === "dark" || cachedTheme === "light") {
          setThemeState(cachedTheme)
        }
      }
    }
  }, [])

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      theme,
      setTheme,
      colors,
      isDark: theme === "dark",
    }),
    [theme, setTheme, colors]
  )

  // Don't render children until theme is loaded (prevents flash)
  if (isLoading) {
    return null
  }

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }
  return context
}

