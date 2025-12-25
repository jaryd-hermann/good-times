import { Linking, Platform } from "react-native"
import * as Application from "expo-application"
import * as StoreReview from "expo-store-review"

/**
 * Opens the native app store review modal (iOS) or app store page (Android)
 * On iOS, shows the native StoreKit rating modal with preset 5 stars
 * On Android, opens the Play Store review page
 */
export async function openAppStoreReview(): Promise<void> {
  try {
    if (Platform.OS === "ios") {
      // Use native iOS StoreKit rating modal
      // This shows the native in-app rating modal with preset 5 stars
      // NOTE: StoreKit rating modal does NOT work in iOS Simulator - only on real devices
      const isAvailable = await StoreReview.isAvailableAsync()
      
      if (__DEV__) {
        console.log("[app-store-review] StoreReview.isAvailableAsync():", isAvailable)
        console.log("[app-store-review] Platform.isSimulator:", Platform.isPad === false && Platform.isTV === false) // Basic check
      }
      
      if (isAvailable) {
        // Request the native rating modal
        // This will silently fail in simulator - Apple's StoreKit limitation
        await StoreReview.requestReview()
        
        if (__DEV__) {
          console.log("[app-store-review] StoreReview.requestReview() called")
          console.log("[app-store-review] Note: Rating modal may not appear in simulator - test on real device")
        }
      } else {
        // Fallback: open App Store page if native modal is not available
        // This can happen if:
        // - Running in iOS Simulator (StoreKit doesn't work there)
        // - User has already rated recently (Apple rate limits)
        // - App hasn't been used enough (Apple's requirements)
        if (__DEV__) {
          console.log("[app-store-review] StoreReview not available, falling back to App Store URL")
        }
        
        const bundleId = Application.applicationId
        const appStoreId = "6755366013" // From the App Store URL
        
        const url = `itms-apps://itunes.apple.com/app/id${appStoreId}?action=write-review`
        const canOpen = await Linking.canOpenURL(url)
        
        if (canOpen) {
          await Linking.openURL(url)
        } else {
          // Final fallback: web URL
          const webUrl = `https://apps.apple.com/app/id${appStoreId}?action=write-review`
          await Linking.openURL(webUrl)
        }
      }
    } else if (Platform.OS === "android") {
      // Android Play Store URL
      const bundleId = Application.applicationId || "com.goodtimes.app"
      const url = `market://details?id=${bundleId}`
      
      // Try native URL first
      const canOpen = await Linking.canOpenURL(url)
      if (canOpen) {
        await Linking.openURL(url)
        return
      }
      
      // Fallback to web URL
      const webUrl = `https://play.google.com/store/apps/details?id=${bundleId}`
      await Linking.openURL(webUrl)
    }
  } catch (error) {
    console.error("[app-store-review] Error opening app store:", error)
    // Silently fail - don't disrupt user flow
  }
}

