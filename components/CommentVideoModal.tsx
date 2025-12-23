"use client"

import { useCallback, useEffect, useRef, useState, useMemo } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  AppState,
} from "react-native"
import { CameraView, CameraType, useCameraPermissions } from "expo-camera"
import { Video, ResizeMode } from "expo-av"
import * as FileSystem from "expo-file-system/legacy"
import { FontAwesome } from "@expo/vector-icons"
import { useTheme } from "../lib/theme-context"
import { typography, spacing } from "../lib/theme"

const MAX_RECORDING_DURATION = 120 // 2 minutes in seconds
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024 // 2GB
const FILE_SIZE_WARNING_THRESHOLD = 1.5 * 1024 * 1024 * 1024 // 1.5GB

type RecordingState = "idle" | "recording" | "paused" | "playback"

interface CommentVideoModalProps {
  visible: boolean
  replyToName: string
  onClose: () => void
  onAddVideo: (videoUri: string) => void
}

export function CommentVideoModal({ visible, replyToName, onClose, onAddVideo }: CommentVideoModalProps) {
  const { colors, isDark } = useTheme()
  const [permission, requestPermission] = useCameraPermissions()
  const [recordingState, setRecordingState] = useState<RecordingState>("idle")
  const [cameraType, setCameraType] = useState<CameraType>("front")
  const [videoUri, setVideoUri] = useState<string | null>(null)
  const [recordingDuration, setRecordingDuration] = useState(0) // in seconds
  const [fileSize, setFileSize] = useState(0) // in bytes
  const [playbackPosition, setPlaybackPosition] = useState(0) // in milliseconds
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const cameraRef = useRef<CameraView>(null)
  const recordingRef = useRef<{ stop: () => Promise<void>; uri: string } | null>(null)
  const videoRef = useRef<Video>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pulseAnim = useRef(new Animated.Value(1)).current
  const recordingStartTimeRef = useRef<number>(0)

  // Theme 2 color palette - dynamic based on dark/light mode
  const theme2Colors = useMemo(() => {
    if (isDark) {
      return {
        red: "#B94444",
        yellow: "#E8A037",
        green: "#2D6F4A",
        blue: "#3A5F8C",
        beige: "#000000",
        cream: "#000000",
        white: "#E8E0D5",
        text: "#F5F0EA",
        textSecondary: "#A0A0A0",
        pink: "#D97393",
      }
    } else {
      return {
        red: "#B94444",
        yellow: "#E8A037",
        green: "#2D6F4A",
        blue: "#3A5F8C",
        beige: "#E8E0D5",
        cream: "#F5F0EA",
        white: "#FFFFFF",
        text: "#000000",
        textSecondary: "#404040",
        pink: "#D97393",
      }
    }
  }, [isDark])

  // Request permission when modal opens
  useEffect(() => {
    if (visible && !permission?.granted) {
      requestPermission()
    }
  }, [visible, permission])

  // Handle app state changes - pause recording if app goes to background
  useEffect(() => {
    if (!visible) return

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState !== "active" && recordingState === "recording") {
        pauseRecording()
      }
    })

    return () => {
      subscription.remove()
    }
  }, [visible, recordingState])

  // Pulsing animation for record button
  useEffect(() => {
    if (recordingState === "recording") {
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
    } else {
      pulseAnim.setValue(1)
    }
  }, [recordingState, pulseAnim])

  // Format remaining time as "XmYs left"
  function formatRemainingTime(seconds: number): string {
    const remaining = MAX_RECORDING_DURATION - seconds
    if (remaining <= 0) return "0s left"
    const mins = Math.floor(remaining / 60)
    const secs = remaining % 60
    if (mins > 0) {
      return `${mins}m${secs}s left`
    }
    return `${secs}s left`
  }

  // Format file size for display
  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  // Start recording
  async function startRecording() {
    if (!cameraRef.current) {
      setError("Camera not ready")
      return
    }

    try {
      setError(null)
      setRecordingState("recording")
      setRecordingDuration(0)
      setFileSize(0)
      recordingStartTimeRef.current = Date.now()

      const recordingPromise = cameraRef.current.recordAsync({
        maxDuration: MAX_RECORDING_DURATION,
        maxFileSize: MAX_FILE_SIZE,
      })

      recordingRef.current = {
        stop: async () => {
          if (cameraRef.current) {
            cameraRef.current.stopRecording()
          }
        },
        uri: "",
      }

      timerRef.current = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000)
        setRecordingDuration(elapsedSeconds)

        if (elapsedSeconds >= MAX_RECORDING_DURATION) {
          stopRecording()
        }
      }, 100) as unknown as NodeJS.Timeout

      recordingPromise
        .then(async (result) => {
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }

          if (!result) {
            setError("Recording failed - no result")
            setRecordingState("idle")
            recordingRef.current = null
            return
          }

          const uri = result.uri
          if (uri) {
            try {
              const fileInfo = await FileSystem.getInfoAsync(uri)
              if (fileInfo.exists && fileInfo.size !== undefined) {
                setFileSize(fileInfo.size)

                if (fileInfo.size > MAX_FILE_SIZE) {
                  setError("Video file is too large. Maximum size is 2GB.")
                  Alert.alert("File Too Large", "The video file exceeds 2GB. Please record a shorter video.")
                  try {
                    await FileSystem.deleteAsync(uri, { idempotent: true })
                  } catch (e) {
                    // Ignore cleanup errors
                  }
                  setRecordingState("idle")
                  setVideoUri(null)
                  recordingRef.current = null
                  return
                }
              }
            } catch (e) {
              // Ignore file size check errors
            }

            setVideoUri(uri)
            setRecordingState("playback")
            recordingRef.current = null
          } else {
            setError("Failed to save recording")
            setRecordingState("idle")
            recordingRef.current = null
          }
        })
        .catch((error: any) => {
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          setError(error.message || "Recording failed")
          setRecordingState("idle")
          recordingRef.current = null
        })
    } catch (error: any) {
      setError(error.message || "Failed to start recording")
      setRecordingState("idle")
      Alert.alert("Error", error.message || "Failed to start recording")
    }
  }

  // Pause recording
  async function pauseRecording() {
    if (!cameraRef.current || recordingState !== "recording") return

    try {
      stopRecording()
    } catch (error: any) {
      setError(error.message || "Failed to pause recording")
    }
  }

  // Stop recording
  async function stopRecording() {
    if (!cameraRef.current) return

    try {
      cameraRef.current.stopRecording()
      
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    } catch (error: any) {
      setError(error.message || "Failed to stop recording")
      setRecordingState("idle")
      recordingRef.current = null
    }
  }

  // Play video playback
  async function playVideo() {
    if (!videoUri || !videoRef.current) return

    try {
      const status = await videoRef.current.getStatusAsync()
      if (status.isLoaded) {
        if (status.didJustFinish) {
          await videoRef.current.setPositionAsync(0)
        }
        await videoRef.current.playAsync()
        setIsPlaying(true)

        playbackTimerRef.current = setInterval(async () => {
          if (videoRef.current) {
            const playbackStatus = await videoRef.current.getStatusAsync()
            if (playbackStatus.isLoaded) {
              setPlaybackPosition(playbackStatus.positionMillis || 0)
              if (playbackStatus.didJustFinish) {
                setIsPlaying(false)
                if (playbackTimerRef.current) {
                  clearInterval(playbackTimerRef.current)
                  playbackTimerRef.current = null
                }
              }
            }
          }
        }, 100) as unknown as NodeJS.Timeout
      }
    } catch (error: any) {
      setError(error.message || "Failed to play video")
    }
  }

  // Pause video playback
  async function pauseVideo() {
    if (!videoRef.current) return

    try {
      await videoRef.current.pauseAsync()
      setIsPlaying(false)
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current)
        playbackTimerRef.current = null
      }
    } catch (error: any) {
      setError(error.message || "Failed to pause video")
    }
  }

  // Restart video playback
  async function restartVideo() {
    if (!videoRef.current) return

    try {
      await videoRef.current.setPositionAsync(0)
      setPlaybackPosition(0)
      await playVideo()
    } catch (error: any) {
      setError(error.message || "Failed to restart video")
    }
  }

  // Delete video
  async function deleteVideo() {
    if (!videoUri) return

    Alert.alert(
      "Delete video?",
      "Are you sure you want to delete this video?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              if (videoUri) {
                await FileSystem.deleteAsync(videoUri, { idempotent: true })
              }
              setVideoUri(null)
              setRecordingState("idle")
              setRecordingDuration(0)
              setFileSize(0)
              setPlaybackPosition(0)
              setIsPlaying(false)
              if (playbackTimerRef.current) {
                clearInterval(playbackTimerRef.current)
                playbackTimerRef.current = null
              }
            } catch (error: any) {
              setError(error.message || "Failed to delete video")
            }
          },
        },
      ]
    )
  }

  // Add video to reply
  async function handleAddToReply() {
    if (!videoUri) return

    // Verify file exists before adding
    try {
      const fileInfo = await FileSystem.getInfoAsync(videoUri)
      if (!fileInfo.exists) {
        Alert.alert("Error", "Video file not found. Please record again.")
        setError("Video file not found")
        return
      }
    } catch (error: any) {
      Alert.alert("Error", "Failed to verify video file. Please try again.")
      setError(error.message || "Failed to verify video file")
      return
    }

    // Final file size check
    if (fileSize > MAX_FILE_SIZE) {
      Alert.alert("File Too Large", "The video file exceeds 2GB. Please record a shorter video.")
      return
    }

    // Add video and close without showing discard modal
    onAddVideo(videoUri)
    resetState()
    onClose()
  }

  // Handle close with discard confirmation (only when clicking X with unsaved video)
  function handleClose() {
    // Only show discard confirmation if there's a video that hasn't been added to reply
    if (videoUri && recordingState === "playback") {
      Alert.alert(
        "Discard video?",
        "Do you want to discard this video?",
        [
          {
            text: "No",
            style: "cancel",
          },
          {
            text: "Yes",
            style: "destructive",
            onPress: async () => {
              // Clean up
              if (videoUri) {
                try {
                  await FileSystem.deleteAsync(videoUri, { idempotent: true })
                } catch (e) {
                  // Ignore cleanup errors
                }
              }
              resetState()
              onClose()
            },
          },
        ]
      )
    } else {
      // No video or not in playback state - just close
      resetState()
      onClose()
    }
  }

  // Reset all state
  function resetState() {
    setRecordingState("idle")
    setVideoUri(null)
    setRecordingDuration(0)
    setFileSize(0)
    setPlaybackPosition(0)
    setIsPlaying(false)
    setError(null)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current)
      playbackTimerRef.current = null
    }
    if (recordingRef.current && cameraRef.current) {
      try {
        cameraRef.current.stopRecording()
      } catch (e) {
        // Ignore errors
      }
      recordingRef.current = null
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current)
      }
      if (recordingRef.current && cameraRef.current) {
        try {
          cameraRef.current.stopRecording()
        } catch (e) {
          // Ignore errors
        }
      }
    }
  }, [])

  const styles = useMemo(() => StyleSheet.create({
    modal: {
      flex: 1,
      backgroundColor: theme2Colors.beige,
    },
    container: {
      flex: 1,
      paddingTop: Platform.OS === "ios" ? 60 : 40,
      paddingBottom: spacing.xl,
      paddingHorizontal: spacing.lg,
    },
    contentWrapper: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.xl,
    },
    questionText: {
      ...typography.h2,
      fontSize: 20,
      color: theme2Colors.text,
      fontFamily: "PMGothicLudington-Text115",
      flex: 1,
      marginRight: spacing.md,
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme2Colors.cream,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
    },
    cameraCard: {
      width: "100%",
      aspectRatio: 9 / 16,
      maxHeight: Dimensions.get("window").height * 0.6,
      borderRadius: 16,
      overflow: "hidden",
      backgroundColor: colors.gray[900],
      borderWidth: 2,
      borderColor: theme2Colors.textSecondary,
      marginBottom: spacing.lg,
      position: "relative",
      alignSelf: "center",
    },
    cameraView: {
      flex: 1,
    },
    cameraSwitchButton: {
      position: "absolute",
      top: spacing.md,
      right: spacing.md,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 10,
    },
    videoPlayback: {
      flex: 1,
    },
    playbackControls: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      padding: spacing.md,
    },
    scrubBar: {
      height: 4,
      backgroundColor: colors.gray[600],
      borderRadius: 2,
      marginBottom: spacing.sm,
    },
    scrubBarFill: {
      height: "100%",
      backgroundColor: theme2Colors.pink,
      borderRadius: 2,
    },
    playbackButtons: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: spacing.md,
    },
    playbackButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme2Colors.text,
      justifyContent: "center",
      alignItems: "center",
    },
    fileSizeWarning: {
      backgroundColor: theme2Colors.yellow,
      padding: spacing.sm,
      borderRadius: 8,
      marginBottom: spacing.md,
    },
    fileSizeWarningText: {
      ...typography.caption,
      color: theme2Colors.text,
      textAlign: "center",
    },
    infoText: {
      ...typography.body,
      color: theme2Colors.textSecondary,
      textAlign: "center",
      marginBottom: spacing.md,
    },
    timerText: {
      ...typography.h2,
      fontSize: 18,
      color: theme2Colors.text,
      textAlign: "center",
      marginBottom: spacing.md,
    },
    controlsSection: {
      alignItems: "center",
      marginBottom: spacing.xl,
    },
    recordButton: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme2Colors.pink,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: spacing.md,
      borderWidth: 4,
      borderColor: theme2Colors.white,
    },
    recordButtonInner: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: theme2Colors.white,
    },
    recordButtonPaused: {
      backgroundColor: theme2Colors.green,
    },
    actionButtons: {
      flexDirection: "row",
      gap: spacing.md,
      justifyContent: "center",
    },
    actionButton: {
      flex: 1,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 25,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 56,
    },
    addButton: {
      backgroundColor: theme2Colors.pink,
      borderWidth: 2,
      borderColor: theme2Colors.blue,
    },
    deleteButton: {
      backgroundColor: theme2Colors.red,
    },
    actionButtonText: {
      ...typography.bodyBold,
      fontSize: 16,
      color: theme2Colors.white,
    },
    addButtonText: {
      ...typography.bodyBold,
      fontSize: 16,
      color: theme2Colors.white,
    },
    errorText: {
      ...typography.body,
      color: theme2Colors.red,
      textAlign: "center",
      marginBottom: spacing.md,
    },
  }), [colors, theme2Colors])

  if (!permission) {
    return null
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleClose}>
        <View style={styles.modal}>
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.questionText}>Share a video reply to what {replyToName} said</Text>
              <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                <FontAwesome name="times" size={18} color={theme2Colors.text} />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl }}>
              <Text style={styles.infoText}>Camera permission is required to record video messages.</Text>
              <TouchableOpacity
                style={[styles.actionButton, styles.addButton]}
                onPress={requestPermission}
              >
                <Text style={styles.actionButtonText}>Grant Permission</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    )
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleClose}>
      <View style={styles.modal}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.questionText} numberOfLines={2}>
              Share a video reply to what {replyToName} said
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <FontAwesome name="times" size={18} color={theme2Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Content Wrapper - Centers the preview card */}
          <View style={styles.contentWrapper}>
            {/* Camera/Video Card */}
            <View style={styles.cameraCard}>
              {recordingState === "playback" && videoUri ? (
              <>
                <Video
                  ref={videoRef}
                  source={{ uri: videoUri }}
                  style={styles.videoPlayback}
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay={isPlaying}
                  isLooping={false}
                  onLoad={async () => {
                    if (videoRef.current) {
                      const status = await videoRef.current.getStatusAsync()
                      if (status.isLoaded && status.durationMillis) {
                        setPlaybackPosition(0)
                      }
                    }
                  }}
                />
                <View style={styles.playbackControls}>
                  <View style={styles.scrubBar}>
                    <View
                      style={[
                        styles.scrubBarFill,
                        {
                          width: videoRef.current
                            ? `${(playbackPosition / (recordingDuration * 1000)) * 100}%`
                            : "0%",
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.playbackButtons}>
                    <TouchableOpacity style={styles.playbackButton} onPress={restartVideo}>
                      <FontAwesome name="step-backward" size={18} color={theme2Colors.white} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.playbackButton}
                      onPress={isPlaying ? pauseVideo : playVideo}
                    >
                      <FontAwesome name={isPlaying ? "pause" : "play"} size={20} color={theme2Colors.white} />
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            ) : (
              <>
                <CameraView
                  ref={cameraRef}
                  style={styles.cameraView}
                  facing={cameraType}
                  mode="video"
                  mirror={cameraType === "front"}
                />
                <TouchableOpacity
                  style={styles.cameraSwitchButton}
                  onPress={() => setCameraType(cameraType === "front" ? "back" : "front")}
                >
                  <FontAwesome name="refresh" size={20} color={theme2Colors.white} />
                </TouchableOpacity>
              </>
            )}
            </View>

            {/* Action Buttons - Delete and Add to Reply (shown in playback state) */}
            {recordingState === "playback" && videoUri && (
              <View style={styles.actionButtons}>
                <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={deleteVideo}>
                  <Text style={styles.actionButtonText}>Delete</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, styles.addButton]} onPress={handleAddToReply}>
                  <Text style={styles.addButtonText}>Add to Reply</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* File Size Warning */}
          {fileSize > FILE_SIZE_WARNING_THRESHOLD && (
            <View style={styles.fileSizeWarning}>
              <Text style={styles.fileSizeWarningText}>
                Warning: Video size is {formatFileSize(fileSize)}. Approaching 2GB limit.
              </Text>
            </View>
          )}

          {/* Error Message */}
          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}

          {/* Info Text */}
          {recordingState === "idle" && (
            <Text style={styles.infoText}>You have max 2 minutes to answer</Text>
          )}

          {/* Timer */}
          {(recordingState === "recording" || recordingState === "paused") && (
            <Text style={styles.timerText}>{formatRemainingTime(recordingDuration)}</Text>
          )}

          {/* Controls Section */}
          <View style={styles.controlsSection}>
            {/* Record Button */}
            {recordingState !== "playback" && (
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <TouchableOpacity
                  style={[
                    styles.recordButton,
                    recordingState === "paused" && styles.recordButtonPaused,
                  ]}
                  onPress={() => {
                    if (recordingState === "idle") {
                      startRecording()
                    } else if (recordingState === "recording" || recordingState === "paused") {
                      stopRecording()
                    }
                  }}
                >
                  <View style={styles.recordButtonInner} />
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  )
}

