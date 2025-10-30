import type React from "react"
import { View, StyleSheet, Image, type ViewStyle } from "react-native"
import { colors } from "../lib/theme"

interface FilmFrameProps {
  children: React.ReactNode
  style?: ViewStyle
}

export function FilmFrame({ children, style }: FilmFrameProps) {
  return (
    <View style={[styles.container, style]}>
      <Image source={require("../assets/images/film-frame.png")} style={styles.frame} resizeMode="stretch" />
      <View style={styles.content}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    width: "100%",
  },
  frame: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  content: {
    backgroundColor: colors.filmInner,
    margin: 20,
    padding: 16,
    minHeight: 200,
  },
})
