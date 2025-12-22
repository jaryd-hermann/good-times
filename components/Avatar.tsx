import { View, Image, Text, StyleSheet } from "react-native"
import { typography } from "../lib/theme"
import { useTheme } from "../lib/theme-context"

interface AvatarProps {
  uri?: string
  name?: string | null
  size?: number
  borderColor?: string
  square?: boolean // New prop for square avatars with rounded edges
}

export function Avatar({ uri, name, size = 40, borderColor, square = false }: AvatarProps) {
  const { colors, isDark } = useTheme()
  
  // Handle null/undefined names gracefully
  const displayName = name || "User"
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  // In dark mode, use black for avatar borders instead of colored borders
  const effectiveBorderColor = isDark && borderColor ? "#000000" : (borderColor || "transparent")

  const dynamicStyles = StyleSheet.create({
    container: {
      backgroundColor: colors.gray[700],
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
      borderWidth: effectiveBorderColor !== "transparent" ? 2 : 0,
      borderColor: effectiveBorderColor,
    },
    initials: {
      ...typography.bodyBold,
      color: colors.white,
    },
  })

  // Square with rounded edges matching day cards (borderRadius: 8) or circular (50% radius)
  const borderRadius = square ? 8 : size / 2

  return (
    <View style={[dynamicStyles.container, { width: size, height: size, borderRadius }]}>
      {uri ? (
        <Image source={{ uri }} style={[styles.image, { width: size, height: size, borderRadius }]} />
      ) : (
        <Text style={[dynamicStyles.initials, { fontSize: size * 0.4 }]}>{initials}</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  image: {
    width: "100%",
    height: "100%",
  },
})
