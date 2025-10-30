export const colors = {
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

export const typography = {
  h1: {
    fontFamily: fonts.heading.bold,
    fontSize: 32,
    lineHeight: 40,
    color: colors.white,
  },
  h2: {
    fontFamily: fonts.heading.bold,
    fontSize: 24,
    lineHeight: 32,
    color: colors.white,
  },
  h3: {
    fontFamily: fonts.heading.regular,
    fontSize: 20,
    lineHeight: 28,
    color: colors.white,
  },
  body: {
    fontFamily: fonts.body.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.white,
  },
  bodyMedium: {
    fontFamily: fonts.body.medium,
    fontSize: 16,
    lineHeight: 24,
    color: colors.white,
  },
  bodyBold: {
    fontFamily: fonts.body.bold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.white,
  },
  caption: {
    fontFamily: fonts.body.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.gray[400],
  },
}
