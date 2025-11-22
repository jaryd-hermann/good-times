export type Theme = "dark" | "light"

export interface ThemeColors {
  black: string
  white: string
  accent: string
  filmInner: string
  gray: {
    100: string
    200: string
    300: string
    400: string
    500: string
    600: string
    700: string
    800: string
    900: string
  }
}

// Base dark theme colors (current/default)
const darkColors: ThemeColors = {
  black: "#000000",
  white: "#ffffff",
  accent: "#de2f08",
  filmInner: "#0D0F1B",
  gray: {
    100: "#f5f5f5",
    200: "#e5e5e5",
    300: "#d4d4d4",
    400: "#a3a3a3",
    500: "#737373",
    600: "#525252",
    700: "#404040",
    800: "#262626",
    900: "#171717",
  },
}

// Light theme colors
const lightColors: ThemeColors = {
  black: "#F9F4EC", // Background color (was black)
  white: "#000000", // Text color (was white)
  accent: "#de2f08", // Accent stays red
  filmInner: "#F9F4EC", // Film inner (was dark blue)
  gray: {
    100: "#171717", // Inverted from dark gray[900]
    200: "#262626", // Inverted from dark gray[800]
    300: "#404040", // Inverted from dark gray[700]
    400: "#737373", // Inverted from dark gray[500]
    500: "#a3a3a3", // Inverted from dark gray[400]
    600: "#d4d4d4", // Inverted from dark gray[300]
    700: "#e5e5e5", // Inverted from dark gray[200]
    800: "#f5f5f5", // Inverted from dark gray[100]
    900: "#ffffff", // Inverted from dark gray[100] (lighter)
  },
}

// Legacy export for backward compatibility (defaults to dark)
export const colors = darkColors

// Get theme-aware colors
export function getThemeColors(theme: Theme): ThemeColors {
  return theme === "light" ? lightColors : darkColors
}

// Get theme-aware typography (removes hardcoded colors)
export function getTypography(themeColors: ThemeColors) {
  return {
    h1: {
      fontFamily: fonts.heading.bold,
      fontSize: 32,
      lineHeight: 40,
      color: themeColors.white,
    },
    h2: {
      fontFamily: fonts.heading.bold,
      fontSize: 24,
      lineHeight: 32,
      color: themeColors.white,
    },
    h3: {
      fontFamily: fonts.heading.regular,
      fontSize: 20,
      lineHeight: 28,
      color: themeColors.white,
    },
    body: {
      fontFamily: fonts.body.regular,
      fontSize: 16,
      lineHeight: 24,
      color: themeColors.white,
    },
    bodyMedium: {
      fontFamily: fonts.body.medium,
      fontSize: 16,
      lineHeight: 24,
      color: themeColors.white,
    },
    bodyBold: {
      fontFamily: fonts.body.bold,
      fontSize: 16,
      lineHeight: 24,
      color: themeColors.white,
    },
    caption: {
      fontFamily: fonts.body.regular,
      fontSize: 14,
      lineHeight: 20,
      color: themeColors.gray[400],
    },
  }
}

export const fonts = {
  heading: {
    regular: "LibreBaskerville-Regular",
    bold: "LibreBaskerville-Bold",
  },
  body: {
    regular: "Roboto-Regular",
    medium: "Roboto-Medium",
    bold: "Roboto-Bold",
  },
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
}

// Legacy typography export (uses dark theme colors for backward compatibility)
export const typography = getTypography(darkColors)
