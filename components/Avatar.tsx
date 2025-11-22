import { View, Image, Text, StyleSheet } from "react-native"
import { typography } from "../lib/theme"
import { useTheme } from "../lib/theme-context"

interface AvatarProps {
  uri?: string
  name: string
  size?: number
}

export function Avatar({ uri, name, size = 40 }: AvatarProps) {
  const { colors } = useTheme()
  
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const dynamicStyles = StyleSheet.create({
    container: {
      backgroundColor: colors.gray[700],
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
    },
    initials: {
      ...typography.bodyBold,
      color: colors.white,
    },
  })

  return (
    <View style={[dynamicStyles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? (
        <Image source={{ uri }} style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]} />
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
