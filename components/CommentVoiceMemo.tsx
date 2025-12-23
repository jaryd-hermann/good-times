"use client"

import { useEffect, useRef, useState } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native"
import { Audio } from "expo-av"
import { FontAwesome } from "@expo/vector-icons"
import { useTheme } from "../lib/theme-context"
import { typography, spacing } from "../lib/theme"
import { AppState } from "react-native"

interface CommentVoiceMemoProps {
  onRecordingComplete: (uri: string, duration: number) => void
  onCancel: () => void
}

export function CommentVoiceMemo({ onRecordingComplete, onCancel }: CommentVoiceMemoProps) {
  const { colors, isDark } = useTheme()
  const [recording, setRecording] = useState<Audio.Recording>()
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [sound, setSound] = useState<Audio.Sound | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const pulseAnim = useRef(new Animated.Value(1)).current

  // Theme 2 color palette
  const theme2Colors = {
    red: "#B94444",
    yellow: "#E8A037",
    green: "#2D6F4A",
    blue: "#3A5F8C",
    beige: isDark ? "#000000" : "#E8E0D5",
    cream: isDark ? "#000000" : "#F5F0EA",
    white: isDark ? "#E8E0D5" : "#FFFFFF",
    text: isDark ? "#F5F0EA" : "#000000",
    textSecondary: isDark ? "#A0A0A0" : "#404040",
    pink: "#D97393",
  }

  // Pulsing animation for record button
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    )
    pulse.start()
    return () => pulse.stop()
  }, [pulseAnim])

  // Start recording
  async function startRecording() {
    try {
      const { status } = await Audio.requestPermissionsAsync()
      if (status !== "granted") {
        return
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      )
      setRecording(newRecording)
      setDuration(0)

      // Start timer
      timerRef.current = setInterval(async () => {
        const status = await newRecording.getStatusAsync()
        if (status.isRecording) {
          setDuration(Math.floor(status.durationMillis / 1000))
        }
      }, 300) as unknown as NodeJS.Timeout
    } catch (error: any) {
      console.error("Failed to start recording:", error)
    }
  }

  // Stop recording
  async function stopRecording() {
    if (!recording) return

    try {
      await recording.stopAndUnloadAsync()
      const uri = recording.getURI()
      if (uri && timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
        onRecordingComplete(uri, duration)
      }
      setRecording(undefined)
    } catch (error: any) {
      console.error("Failed to stop recording:", error)
    }
  }

  // Play preview
  async function playPreview(uri: string) {
    try {
      if (sound) {
        await sound.unloadAsync()
      }

      const { sound: newSound } = await Audio.Sound.createAsync({ uri })
      setSound(newSound)
      setIsPlaying(true)

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false)
        }
      })

      await newSound.playAsync()
    } catch (error: any) {
      console.error("Failed to play preview:", error)
    }
  }

  // Stop preview
  async function stopPreview() {
    if (sound) {
      await sound.stopAsync()
      await sound.unloadAsync()
      setSound(null)
      setIsPlaying(false)
    }
  }

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => {})
      }
      if (sound) {
        sound.unloadAsync().catch(() => {})
      }
    }
  }, [recording, sound])

  function formatDuration(totalSeconds: number) {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const styles = StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.md,
      backgroundColor: theme2Colors.cream,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
    },
    recordButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme2Colors.red,
      justifyContent: "center",
      alignItems: "center",
    },
    stopButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme2Colors.green,
      justifyContent: "center",
      alignItems: "center",
    },
    playButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme2Colors.blue,
      justifyContent: "center",
      alignItems: "center",
    },
    durationText: {
      ...typography.body,
      fontSize: 14,
      color: theme2Colors.text,
      minWidth: 50,
    },
    actionButtons: {
      flexDirection: "row",
      gap: spacing.sm,
      marginLeft: "auto",
    },
    sendButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme2Colors.blue,
      justifyContent: "center",
      alignItems: "center",
    },
    cancelButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme2Colors.textSecondary,
      justifyContent: "center",
      alignItems: "center",
    },
  })

  // Auto-start recording when component mounts
  useEffect(() => {
    startRecording()
  }, [])

  if (!recording) {
    // Recording stopped - show preview controls
    return null // This will be handled by parent
  }

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <TouchableOpacity style={styles.recordButton} onPress={stopRecording}>
          <FontAwesome name="stop" size={16} color={theme2Colors.white} />
        </TouchableOpacity>
      </Animated.View>
      <Text style={styles.durationText}>{formatDuration(duration)}</Text>
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <FontAwesome name="times" size={14} color={theme2Colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

