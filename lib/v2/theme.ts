import { useMemo } from "react"
import { useTheme } from "../theme-context"

/**
 * v2 palette, matching the design mocks (2A–4A).
 *
 * v1 recomputed an inline `theme2Colors` object in nearly every screen. This
 * centralises it so the thread, hub, composer and history cannot drift apart.
 */
export type V2Colors = {
  bg: string
  surface: string
  surfaceAlt: string
  ink: string
  text: string
  textSecondary: string
  border: string
  accent: string
  accentInk: string
  blue: string
  pink: string
  green: string
  red: string
  bubble: string
  bubbleMine: string
}

const LIGHT: V2Colors = {
  bg: "#E8E0D5",
  surface: "#F5F0EA",
  surfaceAlt: "#FFFFFF",
  ink: "#000000",
  text: "#000000",
  textSecondary: "#404040",
  border: "#000000",
  accent: "#E5A13C",
  accentInk: "#000000",
  blue: "#3A5F8C",
  pink: "#D9788F",
  green: "#2F6B4F",
  red: "#B23B3B",
  // Others get a cool tint, you get warm cream. Neither is white: white is
  // reserved for answer cards so they stay the anchor of a thread.
  bubble: "#E7EEF6",
  bubbleMine: "#F5F0EA",
}

const DARK: V2Colors = {
  bg: "#000000",
  surface: "#111111",
  surfaceAlt: "#1A1A1A",
  ink: "#E8E0D5",
  text: "#F5F0EA",
  textSecondary: "#A0A0A0",
  border: "#333333",
  accent: "#C4832B",
  accentInk: "#000000",
  blue: "#7FA3CC",
  pink: "#D9788F",
  green: "#4E9B76",
  red: "#D96A6A",
  bubble: "#1A1A1A",
  bubbleMine: "#222222",
}

export function useV2Colors(): { c: V2Colors; isDark: boolean } {
  const { isDark } = useTheme()
  const c = useMemo(() => (isDark ? DARK : LIGHT), [isDark])
  return { c, isDark }
}

export const v2Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const
