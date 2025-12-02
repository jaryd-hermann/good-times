"use client"

import { View, StyleSheet, ActivityIndicator } from "react-native"
import { WebView } from "react-native-webview"
import { spacing } from "../lib/theme"
import { useTheme } from "../lib/theme-context"
import type { ParsedEmbed } from "../lib/embed-parser"

interface EmbeddedPlayerProps {
  embed: ParsedEmbed
  onRemove?: () => void
  showRemove?: boolean
}

export function EmbeddedPlayer({ embed, onRemove, showRemove = false }: EmbeddedPlayerProps) {
  const { colors } = useTheme()
  
  // Spotify is 152px, Apple Music is 175px, Soundcloud is 166px (compact) or 300px (visual)
  const height = embed.platform === "spotify" 
    ? 152 
    : embed.platform === "apple_music" 
    ? 175 
    : embed.platform === "soundcloud"
    ? 166
    : 152

  const dynamicStyles = StyleSheet.create({
    container: {
      width: "100%",
      marginVertical: spacing.sm,
      borderRadius: 8,
      overflow: "hidden",
      backgroundColor: colors.gray[900],
    },
    loadingContainer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.gray[900],
    },
  })

  return (
    <View style={dynamicStyles.container}>
      <WebView
        source={{ uri: embed.embedUrl }}
        style={[styles.webview, { height }]}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        startInLoadingState
        renderLoading={() => (
          <View style={dynamicStyles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.white} />
          </View>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  webview: {
    width: "100%",
    backgroundColor: "transparent",
  },
})

