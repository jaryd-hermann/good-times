import type React from "react"
import { View, StyleSheet, type ViewStyle } from "react-native"
import { colors, spacing } from "../lib/theme"

interface FilmFrameProps {
  children: React.ReactNode
  style?: ViewStyle
  contentStyle?: ViewStyle
}

export function FilmFrame({ children, style, contentStyle }: FilmFrameProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: colors.gray[900],
    borderWidth: 1,
    borderColor: colors.gray[800],
    overflow: "hidden",
  },
  content: {
    padding: spacing.lg,
  },
})
