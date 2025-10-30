"use client"

import { View, Image, TouchableOpacity, StyleSheet, Dimensions } from "react-native"
import { Video, ResizeMode } from "expo-av"
import { Audio } from "expo-av"
import { useState, useEffect } from "react"
import { colors } from "@/lib/theme"

const { width } = Dimensions.get("window")

interface MediaViewerProps {
  media: Array<{
    type: "image" | "video" | "audio"
    url: string
  }>
}

export function MediaViewer({ media }: MediaViewerProps) {
  const [sound, setSound] = useState<Audio.Sound>()

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync()
        }
      : undefined
  }, [sound])

  const playAudio = async (url: string) => {
    const { sound } = await Audio.Sound.createAsync({ uri: url })
    setSound(sound)
    await sound.playAsync()
  }

  return (
    <View style={styles.container}>
      {media.map((item, index) => (
        <View key={index} style={styles.mediaItem}>
          {item.type === "image" && <Image source={{ uri: item.url }} style={styles.image} resizeMode="cover" />}
          {item.type === "video" && (
            <Video source={{ uri: item.url }} style={styles.video} useNativeControls resizeMode={ResizeMode.CONTAIN} />
          )}
          {item.type === "audio" && (
            <TouchableOpacity style={styles.audioButton} onPress={() => playAudio(item.url)}>
              <View style={styles.audioIcon} />
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  mediaItem: {
    width: (width - 64) / 2,
    height: (width - 64) / 2,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: colors.gray[100],
  },
  image: {
    width: "100%",
    height: "100%",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  audioButton: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.accent,
  },
  audioIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
  },
})
