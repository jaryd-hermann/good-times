// Session lifecycle tracking utilities
// Tracks app open/close times to determine boot behavior

import AsyncStorage from "@react-native-async-storage/async-storage"

const LAST_APP_CLOSE_TIME_KEY = "last_app_close_time"
const CURRENT_SESSION_START_TIME_KEY = "current_session_start_time"
const LAST_SUCCESSFUL_NAVIGATION_KEY = "last_successful_navigation"

// Cold start threshold: if app was closed more than this many minutes ago, show boot screen
const COLD_START_THRESHOLD_MINUTES = 5

/**
 * Record that the app was closed
 * Call this when app goes to background or closes
 */
export async function recordAppClose(): Promise<void> {
  try {
    const timestamp = Date.now().toString()
    await AsyncStorage.setItem(LAST_APP_CLOSE_TIME_KEY, timestamp)
    // Clear current session start time when app closes
    await AsyncStorage.removeItem(CURRENT_SESSION_START_TIME_KEY)
    if (__DEV__) {
      console.log("[session-lifecycle] Recorded app close at:", new Date(parseInt(timestamp)).toISOString())
    }
  } catch (error) {
    console.error("[session-lifecycle] Failed to record app close:", error)
  }
}

/**
 * Record that a new session has started
 * Call this when app opens (cold start)
 */
export async function recordSessionStart(): Promise<void> {
  try {
    const timestamp = Date.now().toString()
    await AsyncStorage.setItem(CURRENT_SESSION_START_TIME_KEY, timestamp)
    if (__DEV__) {
      console.log("[session-lifecycle] Recorded session start at:", new Date(parseInt(timestamp)).toISOString())
    }
  } catch (error) {
    console.error("[session-lifecycle] Failed to record session start:", error)
  }
}

/**
 * Get the time when the app was last closed (in milliseconds since epoch)
 * Returns null if never recorded
 */
export async function getLastAppCloseTime(): Promise<number | null> {
  try {
    const timestamp = await AsyncStorage.getItem(LAST_APP_CLOSE_TIME_KEY)
    return timestamp ? parseInt(timestamp, 10) : null
  } catch (error) {
    console.error("[session-lifecycle] Failed to get last app close time:", error)
    return null
  }
}

/**
 * Get the time when the current session started (in milliseconds since epoch)
 * Returns null if no active session
 */
export async function getCurrentSessionStartTime(): Promise<number | null> {
  try {
    const timestamp = await AsyncStorage.getItem(CURRENT_SESSION_START_TIME_KEY)
    return timestamp ? parseInt(timestamp, 10) : null
  } catch (error) {
    console.error("[session-lifecycle] Failed to get current session start time:", error)
    return null
  }
}

/**
 * Check if this is a cold start (app was closed for more than threshold)
 * Returns true if app should show boot screen
 */
export async function isColdStart(): Promise<boolean> {
  try {
    const lastCloseTime = await getLastAppCloseTime()
    if (!lastCloseTime) {
      // Never recorded - assume cold start
      return true
    }
    
    const timeSinceClose = Date.now() - lastCloseTime
    const thresholdMs = COLD_START_THRESHOLD_MINUTES * 60 * 1000
    const isCold = timeSinceClose > thresholdMs
    
    if (__DEV__) {
      console.log("[session-lifecycle] Cold start check:", {
        lastCloseTime: new Date(lastCloseTime).toISOString(),
        timeSinceCloseMinutes: Math.round(timeSinceClose / 1000 / 60),
        thresholdMinutes: COLD_START_THRESHOLD_MINUTES,
        isCold,
      })
    }
    
    return isCold
  } catch (error) {
    console.error("[session-lifecycle] Failed to check cold start:", error)
    // On error, assume cold start to be safe
    return true
  }
}

/**
 * Record a successful navigation to a route
 * Call this after successfully navigating to a screen
 */
export async function recordSuccessfulNavigation(route: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_SUCCESSFUL_NAVIGATION_KEY, route)
    if (__DEV__) {
      console.log("[session-lifecycle] Recorded successful navigation to:", route)
    }
  } catch (error) {
    console.error("[session-lifecycle] Failed to record successful navigation:", error)
  }
}

/**
 * Get the last successful navigation route
 * Returns null if never recorded
 */
export async function getLastSuccessfulNavigation(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_SUCCESSFUL_NAVIGATION_KEY)
  } catch (error) {
    console.error("[session-lifecycle] Failed to get last successful navigation:", error)
    return null
  }
}

/**
 * Clear all session lifecycle data
 * Useful for testing or resetting state
 */
export async function clearSessionLifecycle(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      LAST_APP_CLOSE_TIME_KEY,
      CURRENT_SESSION_START_TIME_KEY,
      LAST_SUCCESSFUL_NAVIGATION_KEY,
    ])
    if (__DEV__) {
      console.log("[session-lifecycle] Cleared all session lifecycle data")
    }
  } catch (error) {
    console.error("[session-lifecycle] Failed to clear session lifecycle:", error)
  }
}

