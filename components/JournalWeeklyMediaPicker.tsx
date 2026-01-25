"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
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
  AppState,
  AppStateStatus,
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
  onUpdate: (photos: Array<{ uri: string; type: "photo" | "video"; assetId?: string }>) => void
  onCameraPress?: () => void // Callback for camera button
  onEditCaptions?: () => void // Callback to open captions editor
}

// Calculate the date range for the Journal week (previous Monday to previous Sunday)
// Journal is asked on Sunday, so we want photos from the previous week: Monday (6 days ago) to Sunday (today)
function getJournalWeekRange(journalDate: string): { startDate: Date; endDate: Date; mondayDate: Date } {
  // Parse journal date (Sunday when question is asked)
  // Use local timezone to avoid issues
  const journalDateStr = journalDate.split('T')[0] // Get just the date part (YYYY-MM-DD)
  const [year, month, day] = journalDateStr.split('-').map(Number)
  const journalDateObj = new Date(year, month - 1, day) // Month is 0-indexed
  
  // Journal is asked on Sunday, so the journalDate is a Sunday
  // We want photos from the previous week: Monday (6 days before Sunday) to Sunday (the journal date itself)
  const dayOfWeek = journalDateObj.getDay() // 0 = Sunday, 1 = Monday, etc.
  
  // If journalDate is not Sunday, find the most recent Sunday
  let targetSunday = new Date(journalDateObj)
  if (dayOfWeek !== 0) {
    // Go back to the most recent Sunday
    targetSunday.setDate(targetSunday.getDate() - dayOfWeek)
  }
  
  // Calculate Monday of that week (6 days before Sunday)
  const mondayDate = new Date(targetSunday)
  mondayDate.setDate(mondayDate.getDate() - 6)
  
  // Set to start/end of day in local timezone
  mondayDate.setHours(0, 0, 0, 0)
  targetSunday.setHours(23, 59, 59, 999)
  
  console.log(`[getJournalWeekRange] journalDate: ${journalDate}, parsed: ${journalDateObj.toISOString()}, dayOfWeek: ${dayOfWeek}`)
  console.log(`[getJournalWeekRange] Week range: ${mondayDate.toISOString()} to ${targetSunday.toISOString()}`)
  
  return {
    startDate: mondayDate,
    endDate: targetSunday,
    mondayDate: mondayDate,
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
  onEditCaptions,
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

  // Track cancellation for async operations (must be declared before AppState handler)
  const cancelledRef = useRef(false)
  
  // Track app state to cancel operations when app goes to background
  const appStateRef = useRef(AppState.currentState)
  const [appState, setAppState] = useState(AppState.currentState)
  
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === "active") {
        // App has come to foreground
        console.log("[JournalWeeklyMediaPicker] App has come to foreground")
      } else if (appStateRef.current === "active" && nextAppState.match(/inactive|background/)) {
        // App has gone to background - cancel operations to prevent watchdog timeout
        console.log("[JournalWeeklyMediaPicker] App has gone to background - cancelling operations")
        cancelledRef.current = true
        setLoading(false)
      }
      appStateRef.current = nextAppState
      setAppState(nextAppState)
    })
    
    return () => {
      subscription.remove()
    }
  }, [])
  
  // Pre-populate with existing media in edit mode
  // CRITICAL: Sync with existingMedia to ensure deleted photos can be re-added
  useEffect(() => {
    if (!visible) {
      // Reset when modal closes
      setSelectedDayMedia({})
      setSelectedPhotoIds(new Set())
      cancelledRef.current = true // Cancel any ongoing operations
      return
    }
    
    if (existingMedia.length > 0) {
      const initialDayMedia: Record<number, DayMedia> = {}
      const initialSelectedIds = new Set<string>()
      
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
          // Use a unique ID based on URI to allow re-adding after deletion
          const photoAsset: PhotoAsset = {
            id: `existing-${media.uri}-${index}`, // Unique ID based on URI and index
            uri: media.uri,
            creationTime: mondayDate.getTime() + (dayIndex * 24 * 60 * 60 * 1000), // Approximate
            dayOfWeek: dayLabels[dayIndex],
            dayIndex,
          }
          
          initialDayMedia[dayIndex].photos.push(photoAsset)
          initialSelectedIds.add(photoAsset.id)
        }
      })
      
      setSelectedDayMedia(initialDayMedia)
      setSelectedPhotoIds(initialSelectedIds)
    } else {
      // Reset when opening fresh (no existing media)
      setSelectedDayMedia({})
      setSelectedPhotoIds(new Set())
    }
  }, [visible, existingMedia, mondayDate])

  // Fetch photos from media library
  useEffect(() => {
    if (!visible) {
      cancelledRef.current = true
      return
    }

    cancelledRef.current = false

    async function fetchPhotos() {
      setLoading(true)
      try {
        const { status } = await MediaLibrary.requestPermissionsAsync()
        console.log(`[JournalWeeklyMediaPicker] Permission status: ${status}`)
        if (status !== "granted") {
          Alert.alert("Permission needed", "Please grant photo library access")
          setLoading(false)
          return
        }

        if (cancelledRef.current) {
          setLoading(false)
          return
        }
        
        // First, check if we can access the library at all
        const testResult = await MediaLibrary.getAssetsAsync({
          mediaType: MediaLibrary.MediaType.photo,
          first: 1,
        })
        console.log(`[JournalWeeklyMediaPicker] Test fetch: Found ${testResult.assets.length} photos (total in library: ${testResult.totalCount || 'unknown'})`)
        
        if (testResult.totalCount === 0) {
          console.log(`[JournalWeeklyMediaPicker] Photo library appears to be empty`)
          Alert.alert("No Photos", "Your photo library is empty. Please add photos to your device first.")
          setAvailablePhotos([])
          setLoading(false)
          return
        }

        // Fetch photos efficiently - get a large batch upfront for instant results
        // Sort by creationTime descending (newest first) to get recent photos first
        const startTime = weekRange.startDate.getTime()
        const endTime = weekRange.endDate.getTime()
        
        // Pre-calculate date boundaries for fast comparison
        const startDateOnly = new Date(weekRange.startDate.getFullYear(), weekRange.startDate.getMonth(), weekRange.startDate.getDate())
        const endDateOnly = new Date(weekRange.endDate.getFullYear(), weekRange.endDate.getMonth(), weekRange.endDate.getDate())

        console.log(`[JournalWeeklyMediaPicker] Fetching photos for week: ${format(weekRange.startDate, 'MMM d, yyyy')} - ${format(weekRange.endDate, 'MMM d, yyyy')}`)
        console.log(`[JournalWeeklyMediaPicker] Time range: ${startTime} (${new Date(startTime).toISOString()}) to ${endTime} (${new Date(endTime).toISOString()})`)
        
        // Fetch a large initial batch (2000 photos) for instant results
        // This covers most use cases since users typically have < 2000 photos in a week
        const initialBatchSize = Math.min(2000, testResult.totalCount || 2000)
        console.log(`[JournalWeeklyMediaPicker] Fetching ${initialBatchSize} photos (library has ${testResult.totalCount} total)`)
        
        // Try fetching photos sorted by creationTime ascending (oldest first) to find photos with valid dates
        // The simulator may have corrupted dates on newer photos, so older photos might have valid dates
        const result = await MediaLibrary.getAssetsAsync({
          mediaType: MediaLibrary.MediaType.photo,
          first: initialBatchSize,
          sortBy: MediaLibrary.SortBy.creationTime, // Try newest first first
        })
        
        console.log(`[JournalWeeklyMediaPicker] Fetched ${result.assets.length} photos from library`)
        
        if (result.assets.length === 0) {
          console.log(`[JournalWeeklyMediaPicker] No photos returned from MediaLibrary.getAssetsAsync`)
          setAvailablePhotos([])
          setLoading(false)
          return
        }
        
        // Debug: log RAW creationTime values first to see if they're already in milliseconds
        const firstRawTime = result.assets[0].creationTime
        const lastRawTime = result.assets[result.assets.length - 1].creationTime
        console.log(`[JournalWeeklyMediaPicker] RAW first asset creationTime: ${firstRawTime} (as date: ${new Date(firstRawTime).toISOString()})`)
        console.log(`[JournalWeeklyMediaPicker] RAW last asset creationTime: ${lastRawTime} (as date: ${new Date(lastRawTime).toISOString()})`)
        
        // Check if creationTime is already in milliseconds (if it's > 1e12, it's likely milliseconds)
        // If it's < 1e10, it's likely seconds and needs conversion
        const isAlreadyMilliseconds = firstRawTime > 1e12
        
        console.log(`[JournalWeeklyMediaPicker] creationTime appears to be ${isAlreadyMilliseconds ? 'MILLISECONDS' : 'SECONDS'} (raw value: ${firstRawTime})`)
        
        // Debug: log first and last asset times, and sample dates
        const firstAssetTime = isAlreadyMilliseconds ? firstRawTime : firstRawTime * 1000
        const lastAssetTime = isAlreadyMilliseconds ? lastRawTime : lastRawTime * 1000
        console.log(`[JournalWeeklyMediaPicker] First asset (converted): ${new Date(firstAssetTime).toISOString()} (${format(new Date(firstAssetTime), 'MMM d, yyyy')})`)
        console.log(`[JournalWeeklyMediaPicker] Last asset (converted): ${new Date(lastAssetTime).toISOString()} (${format(new Date(lastAssetTime), 'MMM d, yyyy')})`)
        
        // Log sample of first 10 photos to see their dates
        const sampleDates = result.assets.slice(0, 10).map((asset, idx) => {
          const creationTime = isAlreadyMilliseconds ? asset.creationTime : asset.creationTime * 1000
          const creationDate = new Date(creationTime)
          return {
            index: idx,
            rawTime: asset.creationTime,
            date: format(creationDate, 'MMM d, yyyy'),
            iso: creationDate.toISOString(),
            timestamp: creationTime,
          }
        })
        console.log(`[JournalWeeklyMediaPicker] Sample photo dates:`, sampleDates)
        
        // Fast filter: compare dates directly (ignoring time) for timezone safety
        // Also filter out photos with corrupted/invalid dates (year > 2100 or < 2000)
        const totalFetched = result.assets.length
        const filteredAssets = result.assets.filter((asset) => {
          const creationTime = isAlreadyMilliseconds ? asset.creationTime : asset.creationTime * 1000
          const creationDate = new Date(creationTime)
          const year = creationDate.getFullYear()
          
          // Filter out photos with corrupted dates (year way in future/past)
          // Valid photos should be between 2000 and 2100
          if (year < 2000 || year > 2100) {
            if (result.assets.indexOf(asset) < 5) {
              console.log(`[JournalWeeklyMediaPicker] Skipping photo ${result.assets.indexOf(asset)} with corrupted date: year ${year} (raw: ${asset.creationTime}, converted: ${creationTime})`)
            }
            return false
          }
          
          const creationDateOnly = new Date(creationDate.getFullYear(), creationDate.getMonth(), creationDate.getDate())
          
          // Photo is in range if its date is >= start date and <= end date
          const isInRange = creationDateOnly >= startDateOnly && creationDateOnly <= endDateOnly
          
          // Debug first few to see why they're not matching
          if (result.assets.indexOf(asset) < 5) {
            console.log(`[JournalWeeklyMediaPicker] Photo ${result.assets.indexOf(asset)}: ${format(creationDate, 'MMM d, yyyy')}, inRange=${isInRange}, start=${format(startDateOnly, 'MMM d, yyyy')}, end=${format(endDateOnly, 'MMM d, yyyy')}`)
          }
          
          return isInRange
        })
        
        // Count valid photos (not corrupted) for better logging
        const validPhotos = result.assets.filter((asset) => {
          const creationTime = isAlreadyMilliseconds ? asset.creationTime : asset.creationTime * 1000
          const creationDate = new Date(creationTime)
          const year = creationDate.getFullYear()
          return year >= 2000 && year <= 2100
        })
        
        console.log(`[JournalWeeklyMediaPicker] Found ${filteredAssets.length} photos in range out of ${totalFetched} total photos fetched (${validPhotos.length} valid dates, ${totalFetched - validPhotos.length} corrupted)`)
        
        // If all photos have corrupted dates, show the most recent photos anyway (fallback for simulator)
        // This allows users to select photos even when metadata is corrupted
        if (filteredAssets.length === 0 && validPhotos.length === 0 && result.assets.length > 0) {
          console.log(`[JournalWeeklyMediaPicker] All photos have corrupted dates - showing most recent ${Math.min(100, result.assets.length)} photos as fallback`)
          // Show the first 100 photos (most recent) as a fallback
          // result.assets is already sorted newest first, so index 0 is newest
          const fallbackPhotos: PhotoAsset[] = result.assets.slice(0, 100).map((asset, index) => {
            // Use a fake creation time based on index (most recent = highest time)
            // Assign newest photos the highest timestamps so they appear first when sorted descending
            const fakeCreationTime = endTime - (index * 60 * 60 * 1000) // Space them 1 hour apart, newest gets highest time
            const fakeDate = new Date(fakeCreationTime)
            return {
              id: asset.id,
              uri: asset.uri,
              creationTime: fakeCreationTime,
              dayOfWeek: getDayName(fakeDate),
              dayIndex: getDayIndex(fakeDate),
            }
          }).sort((a, b) => b.creationTime - a.creationTime) // Sort descending: newest first
          
          if (!cancelledRef.current) {
            setAvailablePhotos(fallbackPhotos)
            setLoading(false)
          }
          return
        }
        
        // If we got fewer photos than requested, we've fetched all photos
        // If we got the full batch and found photos in range, we might need more batches
        // But for instant UX, show what we have immediately
        let allAssets = filteredAssets
        
        // Only fetch more if we got a full batch AND (found photos in range OR all photos were corrupted)
        // This handles the case where simulator has corrupted metadata on older photos
        if (result.assets.length === initialBatchSize && (filteredAssets.length > 0 || validPhotos.length === 0)) {
          // Check if we should continue fetching
          // If we found valid photos, check oldest date. If all were corrupted, always fetch more.
          let shouldContinueFetching = false
          if (filteredAssets.length > 0) {
            // Found valid photos - check if oldest is still in range
            const oldestRawTime = result.assets[result.assets.length - 1].creationTime
            const oldestAssetTime = isAlreadyMilliseconds ? oldestRawTime : oldestRawTime * 1000
            const oldestDate = new Date(oldestAssetTime)
            const oldestDateOnly = new Date(oldestDate.getFullYear(), oldestDate.getMonth(), oldestDate.getDate())
            shouldContinueFetching = oldestDateOnly >= startDateOnly
          } else if (validPhotos.length === 0) {
            // All photos corrupted - fetch more to find valid ones
            shouldContinueFetching = true
            console.log(`[JournalWeeklyMediaPicker] All photos in first batch have corrupted dates, fetching more batches...`)
          }
          
          if (shouldContinueFetching) {
            // Continue fetching in background (don't block UI)
            // Set photos immediately, then update as more come in
            setAvailablePhotos(filteredAssets.map((asset) => {
              const creationTime = isAlreadyMilliseconds ? asset.creationTime : asset.creationTime * 1000
              const creationDate = new Date(creationTime)
              return {
                id: asset.id,
                uri: asset.uri,
                creationTime,
                dayOfWeek: getDayName(creationDate),
                dayIndex: getDayIndex(creationDate),
              }
            }).sort((a, b) => b.creationTime - a.creationTime)) // Sort descending: newest first
            setLoading(false)
            
            // Fetch remaining photos in background
            let after = result.endCursor
            let hasNextPage = result.hasNextPage
            let batchCount = 1
            const backgroundAssets = [...filteredAssets]
            
            while (hasNextPage && !cancelledRef.current && batchCount < 5) { // Limit to 5 more batches
              const nextResult = await MediaLibrary.getAssetsAsync({
                mediaType: MediaLibrary.MediaType.photo,
                first: 500,
                sortBy: MediaLibrary.SortBy.creationTime,
                after,
              })
              
              if (nextResult.assets.length === 0) break
              
              const nextFiltered = nextResult.assets.filter((asset) => {
                const creationTime = isAlreadyMilliseconds ? asset.creationTime : asset.creationTime * 1000
                const creationDate = new Date(creationTime)
                const year = creationDate.getFullYear()
                
                // Filter out corrupted dates
                if (year < 2000 || year > 2100) {
                  return false
                }
                
                const creationDateOnly = new Date(creationDate.getFullYear(), creationDate.getMonth(), creationDate.getDate())
                return creationDateOnly >= startDateOnly && creationDateOnly <= endDateOnly
              })
              
              backgroundAssets.push(...nextFiltered)
              
              // Stop if we've gone past our date range
              const oldestRawTime = nextResult.assets[nextResult.assets.length - 1].creationTime
              const oldestTime = isAlreadyMilliseconds ? oldestRawTime : oldestRawTime * 1000
              const oldestDate = new Date(oldestTime)
              const oldestDateOnly = new Date(oldestDate.getFullYear(), oldestDate.getMonth(), oldestDate.getDate())
              if (oldestDateOnly < startDateOnly) break
              
              hasNextPage = nextResult.hasNextPage
              after = nextResult.endCursor
              batchCount++
              
              // Update photos as we find more (progressive loading)
              if (!cancelledRef.current && nextFiltered.length > 0) {
                const updatedPhotos = backgroundAssets.map((asset) => {
                  const creationTime = isAlreadyMilliseconds ? asset.creationTime : asset.creationTime * 1000
                  const creationDate = new Date(creationTime)
                  return {
                    id: asset.id,
                    uri: asset.uri,
                    creationTime,
                    dayOfWeek: getDayName(creationDate),
                    dayIndex: getDayIndex(creationDate),
                  }
                }).sort((a, b) => b.creationTime - a.creationTime) // Sort descending: newest first
                setAvailablePhotos(updatedPhotos)
              }
            }
            
            return // Already set photos and loading state
          }
        }
        
        // Convert filtered assets to PhotoAsset (for the case where we didn't do background fetching)
        const filteredPhotos: PhotoAsset[] = filteredAssets
          .map((asset) => {
            const creationTime = isAlreadyMilliseconds ? asset.creationTime : asset.creationTime * 1000
            const creationDate = new Date(creationTime)
            return {
              id: asset.id,
              uri: asset.uri,
              creationTime,
              dayOfWeek: getDayName(creationDate),
              dayIndex: getDayIndex(creationDate),
            }
          })
          // Sort by creation time (newest first) for consistent display
          .sort((a, b) => b.creationTime - a.creationTime)

        if (cancelledRef.current) {
          setLoading(false)
          return
        }
        
        console.log(`[JournalWeeklyMediaPicker] Date range: ${format(weekRange.startDate, 'MMM d, yyyy')} - ${format(weekRange.endDate, 'MMM d, yyyy')}`)
        console.log(`[JournalWeeklyMediaPicker] Final result: Found ${filteredPhotos.length} photos in range out of ${totalFetched} total photos fetched`)
        
        if (!cancelledRef.current) {
          setAvailablePhotos(filteredPhotos)
        }
      } catch (error) {
        if (!cancelledRef.current) {
        console.error("[JournalWeeklyMediaPicker] Error fetching photos:", error)
        Alert.alert("Error", "Failed to load photos. Please try again.")
        }
      } finally {
        if (!cancelledRef.current) {
        setLoading(false)
        }
      }
    }

    fetchPhotos()
    
    return () => {
      cancelledRef.current = true
    }
  }, [visible, weekRange])

  // Check if a photo URI is already in existingMedia (to prevent duplicates)
  const isPhotoUriSelected = useCallback((photoUri: string) => {
    return existingMedia.some((media) => media.uri === photoUri)
  }, [existingMedia])

  // Handle photo selection - auto-assign based on photo's creation date
  const handlePhotoSelect = useCallback((photo: PhotoAsset) => {
    // Check if photo is selected by ID (from picker) OR by URI (from existingMedia)
    const isSelectedById = selectedPhotoIds.has(photo.id)
    const isSelectedByUri = isPhotoUriSelected(photo.uri)
    const isSelected = isSelectedById || isSelectedByUri
    
    if (isSelected) {
      // Deselect photo - only remove from picker selection if it was selected by ID
      if (isSelectedById) {
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
      }
      // If selected by URI (from existingMedia), don't allow deselection here
      // User must delete from composer first
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
  }, [selectedPhotoIds, isPhotoUriSelected])

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
    
    // Convert to MediaItem format - include asset ID for proper file access
    const mediaItems = allSelectedPhotos.map((photo) => ({
      uri: photo.uri,
      type: "photo" as const,
      assetId: photo.id, // Include asset ID to get readable file path
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
      gap: spacing.sm, // Reduced by 50% (was spacing.lg, now spacing.sm)
      paddingLeft: 0, // Remove left padding to align with margins
      paddingRight: spacing.lg, // Keep right padding
    },
    dayPlaceholder: {
      width: 120,
      height: 120,
      borderRadius: 6,
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
      borderRadius: 5,
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
      gap: spacing.xs,
      paddingBottom: spacing.xl,
    },
    photoItem: {
      width: THUMBNAIL_SIZE,
      height: THUMBNAIL_SIZE,
      borderRadius: 4,
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
    photoAlreadyAddedText: {
      ...typography.caption,
      fontSize: 10,
      color: theme2Colors.white,
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    captionsCTA: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme2Colors.textSecondary,
    },
    captionsCTAContainer: {
      backgroundColor: theme2Colors.white,
      borderRadius: 20,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      alignSelf: "center",
      borderWidth: 1,
      borderColor: theme2Colors.text,
    },
    captionsCTAText: {
      ...typography.body,
      fontSize: 14,
      color: theme2Colors.text,
      textAlign: "center",
      fontWeight: "500",
    },
  })

  // Format Monday date for display
  const mondayDateFormatted = format(mondayDate, "MMMM d")

  // Calculate total selected photos count
  const totalSelectedPhotos = useMemo(() => {
    return Object.values(selectedDayMedia).reduce((sum, dayMedia) => sum + dayMedia.photos.length, 0)
  }, [selectedDayMedia])

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

          {/* Day Placeholders - Show all selected photos */}
          <View style={styles.dayPlaceholdersContainer}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              style={styles.dayPlaceholdersScroll}
              contentContainerStyle={styles.dayPlaceholdersContent}
            >
              {/* Show all selected photos, grouped by day in chronological order */}
              {Object.values(selectedDayMedia)
                .sort((a, b) => a.dayIndex - b.dayIndex) // Sort by day index (Mon-Sun)
                .map((dayMedia) => 
                  dayMedia.photos.map((photo, photoIndex) => (
                    <View key={`${dayMedia.dayIndex}-${photo.id}`} style={[styles.dayPlaceholder, styles.dayPlaceholderFilled]}>
                      <Image source={{ uri: photo.uri }} style={styles.dayPlaceholderImage} resizeMode="cover" />
                      <Text style={styles.dayPlaceholderLabel}>{dayMedia.dayName}</Text>
                    </View>
                  ))
                )
                .flat()}
              
              {/* Show empty day placeholders for days with no photos */}
              {dayLabels.map((dayLabel, index) => {
                const dayMedia = selectedDayMedia[index]
                const hasPhotos = dayMedia && dayMedia.photos.length > 0
                
                if (!hasPhotos) {
                  return (
                    <View key={`empty-${index}`} style={styles.dayPlaceholder}>
                      <Text style={styles.dayPlaceholderLabel}>{dayLabel}</Text>
                    </View>
                  )
                }
                return null
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
                  const isSelectedById = selectedPhotoIds.has(photo.id)
                  const isSelectedByUri = existingMedia.some((media) => media.uri === photo.uri)
                  const isSelected = isSelectedById || isSelectedByUri
                  return (
                    <TouchableOpacity
                      key={photo.id}
                      style={[styles.photoItem, isSelected && styles.photoSelected]}
                      onPress={() => {
                        // Only allow selection if not already selected by URI (from existingMedia)
                        if (!isSelectedByUri) {
                          handlePhotoSelect(photo)
                        }
                      }}
                      activeOpacity={0.9}
                      disabled={isSelectedByUri} // Disable if already in existingMedia
                    >
                      <Image source={{ uri: photo.uri }} style={styles.photoImage} resizeMode="cover" />
                      {isSelected && (
                        <View style={styles.photoSelectedOverlay}>
                          {isSelectedByUri ? (
                            <Text style={styles.photoAlreadyAddedText}>Already added</Text>
                          ) : (
                          <FontAwesome name="check-circle" size={24} color={theme2Colors.white} />
                          )}
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
