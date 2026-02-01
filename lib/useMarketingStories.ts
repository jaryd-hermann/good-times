import { useState, useEffect, useCallback, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = '@goodtimes_seen_stories'

interface StoryProgress {
  storyId: string
  lastSlideViewed: number // 0-8, where 8 means fully seen
  isComplete: boolean // true if all 8 slides viewed
}

interface SeenStoriesData {
  [storyId: string]: StoryProgress
}

export function useMarketingStories() {
  const [seenStories, setSeenStories] = useState<SeenStoriesData>({})
  const [isLoading, setIsLoading] = useState(true)

  // Load seen stories from storage
  useEffect(() => {
    async function loadSeenStories() {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored) as SeenStoriesData
          setSeenStories(parsed)
        }
      } catch (error) {
        console.error('[useMarketingStories] Error loading seen stories:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadSeenStories()
  }, [])

  // Check if story is fully seen (all 8 slides viewed)
  const isStorySeen = useCallback((storyId: string): boolean => {
    const progress = seenStories[storyId]
    return progress?.isComplete === true
  }, [seenStories])

  // Get the last slide viewed for a story (returns 0 if never viewed)
  const getLastSlideViewed = useCallback((storyId: string): number => {
    const progress = seenStories[storyId]
    return progress?.lastSlideViewed || 0
  }, [seenStories])

  // Mark a slide as viewed (updates progress)
  // Use a ref to avoid infinite loops - don't depend on seenStories in the callback
  const markSlideViewedRef = useRef<SeenStoriesData>({})
  
  useEffect(() => {
    markSlideViewedRef.current = seenStories
  }, [seenStories])

  const markSlideViewed = useCallback(async (storyId: string, slideNumber: number) => {
    try {
      const currentSeenStories = markSlideViewedRef.current
      const updated: SeenStoriesData = {
        ...currentSeenStories,
        [storyId]: {
          storyId,
          lastSlideViewed: Math.max(slideNumber, currentSeenStories[storyId]?.lastSlideViewed || 0),
          isComplete: slideNumber >= 8, // Complete if reached slide 8
        },
      }

      // If reached slide 8, mark as complete
      if (slideNumber >= 8) {
        updated[storyId].isComplete = true
      }

      setSeenStories(updated)
      markSlideViewedRef.current = updated
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch (error) {
      console.error('[useMarketingStories] Error marking slide viewed:', error)
    }
  }, []) // No dependencies - uses ref instead

  // Mark story as seen (manually by user)
  const markStoryAsSeen = useCallback(async (storyId: string) => {
    try {
      const updated: SeenStoriesData = {
        ...seenStories,
        [storyId]: {
          storyId,
          lastSlideViewed: 8,
          isComplete: true,
        },
      }

      setSeenStories(updated)
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch (error) {
      console.error('[useMarketingStories] Error marking story as seen:', error)
    }
  }, [seenStories])

  // Get visible stories (filter out fully seen ones)
  const getVisibleStories = useCallback((storyIds: string[]): string[] => {
    return storyIds.filter((storyId) => !isStorySeen(storyId))
  }, [isStorySeen])

  return {
    seenStories,
    isLoading,
    isStorySeen,
    getLastSlideViewed,
    markSlideViewed,
    markStoryAsSeen,
    getVisibleStories,
  }
}
