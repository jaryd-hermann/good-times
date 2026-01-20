"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
} from "react-native"
import * as MediaLibrary from "expo-media-library"
import * as ImagePicker from "expo-image-picker"
import { format } from "date-fns"
import { FontAwesome } from "@expo/vector-icons"
import { typography, spacing } from "../lib/theme"
import { useTheme } from "../lib/theme-context"

const { width: SCREEN_WIDTH } = Dimensions.get("window")
const THUMBNAIL_SIZE = (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm * 2) / 3

type PhotoAsset = {
  id: string
  uri: string
  creationTime: number
  dayOfWeek: string // "Monday", "Tuesday", etc.
  dayIndex: number // 0-6 for Mon-Sun
}

type DayMedia = {
  dayName: string // "Monday", "Tuesday", etc.
  dayIndex: number // 0-6 for Mon-Sun
  photos: PhotoAsset[]
}

type JournalWeeklyMediaPickerProps = {
  visible: boolean
  journalDate: string // The Sunday date when Journal is asked
  existingMedia?: Array<{ uri: string; type: string }> // For edit mode
  onClose: () => void
  onUpdate: (photos: Array<{ uri: string; type: "photo" | "video" }>) => void
  onCameraPress?: () => void // Callback for camera button
}

// Calculate the date range for the Journal week (previous Monday to previous Sunday)
function getJournalWeekRange(journalDate: string): { startDate: Date; endDate: Date; mondayDate: Date } {
  // Parse journal date (Sunday when question is asked)
  const journalDateObj = new Date(journalDate + "T12:00:00") // Use noon to avoid timezone issues
  
  // Calculate previous Sunday (1 day ago)
  const previousSunday = new Date(journalDateObj)
  previousSunday.setDate(previousSunday.getDate() - 1)
  
  // Calculate previous Monday (7 days ago from journal date)
  const previousMonday = new Date(previousSunday)
  previousMonday.setDate(previousMonday.getDate() - 6)
  
  // Set to start of day
  previousMonday.setHours(0, 0, 0, 0)
  previousSunday.setHours(23, 59, 59, 999)
  
  return {
    startDate: previousMonday,
    endDate: previousSunday,
    mondayDate: previousMonday,
  }
}

// Get day name from date (Monday, Tuesday, etc.)
function getDayName(date: Date): string {
  return format(date, "EEEE") // "Monday", "Tuesday", etc.
}

// Get day index (0 = Monday, 6 = Sunday)
function getDayIndex(date: Date): number {
  const day = date.getDay() // 0 = Sunday, 1 = Monday, etc.
  return day === 0 ? 6 : day - 1 // Convert to 0 = Monday, 6 = Sunday
}

export function JournalWeeklyMediaPicker({
  visible,
  journalDate,
  existingMedia = [],
  onClose,
  onUpdate,
  onCameraPress,
}: JournalWeeklyMediaPickerProps) {
  const { colors, isDark } = useTheme()
  const [loading, setLoading] = useState(false)
  const [availablePhotos, setAvailablePhotos] = useState<PhotoAsset[]>([])
  const [selectedDayMedia, setSelectedDayMedia] = useState<Record<number, DayMedia>>({})
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set())

  // Initialize day placeholders (Mon-Sun)
  const dayLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

  // Calculate week range - memoize to avoid recalculating
  const weekRange = useMemo(() => getJournalWeekRange(journalDate), [journalDate])
  const mondayDate = weekRange.mondayDate

  // Pre-populate with existing media in edit mode
  useEffect(() => {
    if (visible && existingMedia.length > 0) {
      const initialDayMedia: Record<number, DayMedia> = {}
      
      // Group existing photos by day (we'll need to infer day from order or use a default)
      // For now, assign them chronologically to days
      existingMedia.forEach((media, index) => {
        if (media.type === "photo" || media.type === "video") {
          const dayIndex = index % 7
          if (!initialDayMedia[dayIndex]) {
            initialDayMedia[dayIndex] = {
              dayName: dayLabels[dayIndex],
              dayIndex,
              photos: [],
            }
          }
          
          // Create a PhotoAsset-like object (we don't have creationTime for existing media)
          const photoAsset: PhotoAsset = {
            id: `existing-${index}`,
            uri: media.uri,
            creationTime: mondayDate.getTime() + (dayIndex * 24 * 60 * 60 * 1000), // Approximate
            dayOfWeek: dayLabels[dayIndex],
            dayIndex,
          }
          
          initialDayMedia[dayIndex].photos.push(photoAsset)
          setSelectedPhotoIds((prev) => new Set(prev).add(photoAsset.id))
        }
      })
      
      setSelectedDayMedia(initialDayMedia)
    } else if (visible && existingMedia.length === 0) {
      // Reset when opening fresh
      setSelectedDayMedia({})
      setSelectedPhotoIds(new Set())
    }
  }, [visible, existingMedia.length])

  // Fetch photos from media library
  useEffect(() => {
    if (!visible) return

    async function fetchPhotos() {
      setLoading(true)
      try {
        const { status } = await MediaLibrary.requestPermissionsAsync()
        if (status !== "granted") {
          Alert.alert("Permission needed", "Please grant photo library access")
          setLoading(false)
          return
        }

        // Fetch all photos (we'll filter by date client-side)
        const assets = await MediaLibrary.getAssetsAsync({
          mediaType: MediaLibrary.MediaType.photo,
          first: 1000,
          sortBy: MediaLibrary.SortBy.creationTime,
        })

        // Filter by date range and convert to PhotoAsset
        const startTime = weekRange.startDate.getTime()
        const endTime = weekRange.endDate.getTime()

        const filteredPhotos: PhotoAsset[] = assets.assets
          .filter((asset) => {
            const creationTime = asset.creationTime * 1000 // Convert to milliseconds
            return creationTime >= startTime && creationTime <= endTime
          })
          .map((asset) => {
            const creationDate = new Date(asset.creationTime * 1000)
            const dayName = getDayName(creationDate)
            const dayIndex = getDayIndex(creationDate)
            
            return {
              id: asset.id,
              uri: asset.uri,
              creationTime: asset.creationTime * 1000,
              dayOfWeek: dayName,
              dayIndex,
            }
          })

        setAvailablePhotos(filteredPhotos)
      } catch (error) {
        console.error("[JournalWeeklyMediaPicker] Error fetching photos:", error)
        Alert.alert("Error", "Failed to load photos. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    fetchPhotos()
  }, [visible, weekRange])

  // Handle photo selection - auto-assign based on photo's creation date
  const handlePhotoSelect = useCallback((photo: PhotoAsset) => {
    const isSelected = selectedPhotoIds.has(photo.id)
    
    if (isSelected) {
      // Deselect photo
      setSelectedPhotoIds((prev) => {
        const newSet = new Set(prev)
        newSet.delete(photo.id)
        return newSet
      })
      
      // Remove from day media
      setSelectedDayMedia((prev) => {
        const dayMedia = prev[photo.dayIndex]
        if (dayMedia) {
          const updatedPhotos = dayMedia.photos.filter((p) => p.id !== photo.id)
          if (updatedPhotos.length === 0) {
            const { [photo.dayIndex]: removed, ...rest } = prev
            return rest
          }
          return {
            ...prev,
            [photo.dayIndex]: {
              ...dayMedia,
              photos: updatedPhotos,
            },
          }
        }
        return prev
      })
    } else {
      // Select photo and assign to its day
      setSelectedPhotoIds((prev) => new Set(prev).add(photo.id))
      
      setSelectedDayMedia((prev) => {
        const dayMedia = prev[photo.dayIndex]
        if (dayMedia) {
          // Add to existing day
          return {
            ...prev,
            [photo.dayIndex]: {
              ...dayMedia,
              photos: [...dayMedia.photos, photo].sort((a, b) => a.creationTime - b.creationTime),
            },
          }
        } else {
          // Create new day entry
          return {
            ...prev,
            [photo.dayIndex]: {
              dayName: photo.dayOfWeek,
              dayIndex: photo.dayIndex,
              photos: [photo],
            },
          }
        }
      })
    }
  }, [selectedPhotoIds])

  // Handle update - convert selected photos to MediaItem format
  const handleUpdate = useCallback(() => {
    // Collect all selected photos in chronological order
    const allSelectedPhotos: PhotoAsset[] = []
    
    // Sort days by index (Mon-Sun)
    const sortedDays = Object.values(selectedDayMedia).sort((a, b) => a.dayIndex - b.dayIndex)
    
    // Collect photos from each day, maintaining chronological order within each day
    sortedDays.forEach((dayMedia) => {
      allSelectedPhotos.push(...dayMedia.photos)
    })
    
    // Convert to MediaItem format
    const mediaItems = allSelectedPhotos.map((photo) => ({
      uri: photo.uri,
      type: "photo" as const,
    }))
    
    onUpdate(mediaItems)
    onClose()
  }, [selectedDayMedia, onUpdate, onClose])

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
  }

  const styles = StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: isDark ? "rgba(0, 0, 0, 0.9)" : "rgba(232, 224, 213, 0.95)",
    },
    container: {
      flex: 1,
      paddingTop: 60,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme2Colors.textSecondary,
    },
    headerTitle: {
      fontFamily: "Roboto-Bold",
      fontSize: 17,
      color: theme2Colors.text,
      flex: 1,
      textAlign: "center",
      fontWeight: "700",
    },
    cancelButton: {
      padding: spacing.sm,
    },
    cancelButtonText: {
      ...typography.body,
      fontSize: 16,
      color: theme2Colors.blue,
    },
    updateButton: {
      padding: spacing.sm,
    },
    updateButtonText: {
      ...typography.bodyBold,
      fontSize: 16,
      color: theme2Colors.blue,
    },
    updateButtonDisabled: {
      opacity: 0.5,
    },
    dayPlaceholdersContainer: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme2Colors.textSecondary,
    },
    dayPlaceholdersScroll: {
      flexDirection: "row",
    },
    dayPlaceholdersContent: {
      gap: spacing.lg,
      paddingHorizontal: spacing.lg,
    },
    dayPlaceholder: {
      width: 120,
      height: 120,
      borderRadius: 12,
      backgroundColor: theme2Colors.cream,
      borderWidth: 2,
      borderColor: theme2Colors.textSecondary,
      borderStyle: "dashed",
      justifyContent: "center",
      alignItems: "center",
      position: "relative",
    },
    dayPlaceholderFilled: {
      borderStyle: "solid",
      borderColor: theme2Colors.text,
      backgroundColor: theme2Colors.white,
    },
    dayPlaceholderImage: {
      width: "100%",
      height: "100%",
      borderRadius: 10,
    },
    dayPlaceholderLabel: {
      position: "absolute",
      bottom: spacing.xs,
      ...typography.caption,
      fontSize: 12,
      color: theme2Colors.text,
      fontWeight: "600",
    },
    dayPlaceholderCount: {
      position: "absolute",
      top: spacing.xs,
      right: spacing.xs,
      backgroundColor: theme2Colors.blue,
      borderRadius: 10,
      width: 20,
      height: 20,
      justifyContent: "center",
      alignItems: "center",
    },
    dayPlaceholderCountText: {
      ...typography.caption,
      fontSize: 10,
      color: theme2Colors.white,
      fontWeight: "700",
    },
    filterLabel: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    filterLabelText: {
      ...typography.body,
      fontSize: 14,
      color: theme2Colors.textSecondary,
    },
    cameraButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme2Colors.cream,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
    },
    photosContainer: {
      flex: 1,
      paddingHorizontal: spacing.lg,
    },
    photoGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      paddingBottom: spacing.xl,
    },
    photoItem: {
      width: THUMBNAIL_SIZE,
      height: THUMBNAIL_SIZE,
      borderRadius: 8,
      overflow: "hidden",
      position: "relative",
    },
    photoImage: {
      width: "100%",
      height: "100%",
    },
    photoSelected: {
      borderWidth: 3,
      borderColor: theme2Colors.blue,
    },
    photoSelectedOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(58, 95, 140, 0.3)",
      justifyContent: "center",
      alignItems: "center",
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: spacing.xl,
    },
    emptyText: {
      ...typography.body,
      fontSize: 16,
      color: theme2Colors.textSecondary,
      textAlign: "center",
    },
  })

  // Format Monday date for display
  const mondayDateFormatted = format(mondayDate, "MMMM d")

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add to Your Week</Text>
            <TouchableOpacity
              style={[styles.updateButton, Object.keys(selectedDayMedia).length === 0 && styles.updateButtonDisabled]}
              onPress={handleUpdate}
              disabled={Object.keys(selectedDayMedia).length === 0}
            >
              <Text style={styles.updateButtonText}>Update</Text>
            </TouchableOpacity>
          </View>

          {/* Day Placeholders */}
          <View style={styles.dayPlaceholdersContainer}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              style={styles.dayPlaceholdersScroll}
              contentContainerStyle={styles.dayPlaceholdersContent}
            >
              {dayLabels.map((dayLabel, index) => {
                const dayMedia = selectedDayMedia[index]
                const hasPhotos = dayMedia && dayMedia.photos.length > 0
                const firstPhoto = dayMedia?.photos[0]

                return (
                  <View key={index} style={[styles.dayPlaceholder, hasPhotos && styles.dayPlaceholderFilled]}>
                    {hasPhotos && firstPhoto ? (
                      <>
                        <Image source={{ uri: firstPhoto.uri }} style={styles.dayPlaceholderImage} resizeMode="cover" />
                        <Text style={styles.dayPlaceholderLabel}>{dayMedia.dayName}</Text>
                        {dayMedia.photos.length > 1 && (
                          <View style={styles.dayPlaceholderCount}>
                            <Text style={styles.dayPlaceholderCountText}>{dayMedia.photos.length}</Text>
                          </View>
                        )}
                      </>
                    ) : (
                      <Text style={styles.dayPlaceholderLabel}>{dayLabel}</Text>
                    )}
                  </View>
                )
              })}
            </ScrollView>
          </View>

          {/* Filter Label */}
          <View style={styles.filterLabel}>
            <Text style={styles.filterLabelText}>Photos taken since {mondayDateFormatted}</Text>
            <TouchableOpacity 
              style={styles.cameraButton}
              onPress={() => {
                if (onCameraPress) {
                  onCameraPress()
                }
              }}
            >
              <FontAwesome name="camera" size={16} color={theme2Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Photos Grid */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme2Colors.text} />
            </View>
          ) : availablePhotos.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No photos found for this week</Text>
            </View>
          ) : (
            <ScrollView style={styles.photosContainer}>
              <View style={styles.photoGrid}>
                {availablePhotos.map((photo) => {
                  const isSelected = selectedPhotoIds.has(photo.id)
                  return (
                    <TouchableOpacity
                      key={photo.id}
                      style={[styles.photoItem, isSelected && styles.photoSelected]}
                      onPress={() => handlePhotoSelect(photo)}
                      activeOpacity={0.9}
                    >
                      <Image source={{ uri: photo.uri }} style={styles.photoImage} resizeMode="cover" />
                      {isSelected && (
                        <View style={styles.photoSelectedOverlay}>
                          <FontAwesome name="check-circle" size={24} color={theme2Colors.white} />
                        </View>
                      )}
                    </TouchableOpacity>
                  )
                })}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  )
}
