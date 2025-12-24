import { Linking, Platform } from "react-native"
import * as Application from "expo-application"

/**
 * Opens the app store review page for the current app
 * Uses native app store URLs when available, falls back to web URLs
 */
export async function openAppStoreReview(): Promise<void> {
  try {
    const bundleId = Application.applicationId
    
    if (Platform.OS === "ios") {
      // iOS App Store URL
      // Get app store ID from Constants or use bundle ID as fallback
      // Note: You'll need to set this in app.json or expo-constants
      const appStoreId = process.env.EXPO_PUBLIC_APP_STORE_ID || bundleId
      
      if (appStoreId && appStoreId !== bundleId) {
        // If we have a numeric App Store ID
        const url = `itms-apps://itunes.apple.com/app/id${appStoreId}?action=write-review`
        
        // Try native URL first
        const canOpen = await Linking.canOpenURL(url)
        if (canOpen) {
          await Linking.openURL(url)
          return
        }
        
        // Fallback to web URL
        const webUrl = `https://apps.apple.com/app/id${appStoreId}?action=write-review`
        await Linking.openURL(webUrl)
      } else {
        // Fallback: open App Store search for the app
        const searchUrl = `itms-apps://itunes.apple.com/search?term=${encodeURIComponent("Good Times")}`
        const canOpen = await Linking.canOpenURL(searchUrl)
        if (canOpen) {
          await Linking.openURL(searchUrl)
        } else {
          // Final fallback: web search
          await Linking.openURL(`https://apps.apple.com/search?term=${encodeURIComponent("Good Times")}`)
        }
      }
    } else if (Platform.OS === "android") {
      // Android Play Store URL
      const packageName = bundleId || "com.yourcompany.goodtimes" // Fallback if bundleId not available
      const url = `market://details?id=${packageName}`
      
      // Try native URL first
      const canOpen = await Linking.canOpenURL(url)
      if (canOpen) {
        await Linking.openURL(url)
        return
      }
      
      // Fallback to web URL
      const webUrl = `https://play.google.com/store/apps/details?id=${packageName}`
      await Linking.openURL(webUrl)
    }
  } catch (error) {
    console.error("[app-store-review] Error opening app store:", error)
    // Silently fail - don't disrupt user flow
  }
}

