"use client"

import { View, StyleSheet, ActivityIndicator } from "react-native"
import { WebView } from "react-native-webview"
import { colors, spacing } from "../lib/theme"
import type { ParsedEmbed } from "../lib/embed-parser"

interface EmbeddedPlayerProps {
  embed: ParsedEmbed
  onRemove?: () => void
  showRemove?: boolean
}

export function EmbeddedPlayer({ embed, onRemove, showRemove = false }: EmbeddedPlayerProps) {
  // Spotify is 152px, Apple Music is similar height
  const height = embed.platform === "spotify" ? 152 : embed.platform === "apple_music" ? 175 : 152

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: embed.embedUrl }}
        style={[styles.webview, { height }]}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.white} />
          </View>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginVertical: spacing.sm,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: colors.gray[900],
  },
  webview: {
    width: "100%",
    backgroundColor: "transparent",
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

