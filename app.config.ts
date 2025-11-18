import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Good Times",
  slug: "good-times",
  version: "1.1.0", // User-facing version (e.g., "1.1.0", "1.2.0")
  orientation: "portrait",
  icon: "./assets/images/icon-new.png",
  scheme: "goodtimes",
  userInterfaceStyle: "dark",
  // Disable New Architecture - causing crashes during native module registration
  newArchEnabled: false,
  splash: {
    // image: "./assets/images/splash.png", //
    resizeMode: "contain",
    backgroundColor: "#000000",
  },
  assetBundlePatterns: ["assets/*"],
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.jarydhermann.goodtimes",
    buildNumber: "5", // Increment for each TestFlight submission (e.g., "1", "2", "3" or "1.1.0.1", "1.1.0.2")
    // deploymentTarget is set in ios/Podfile.properties.json (not a valid property here in Expo SDK 54)
    infoPlist: {
      NSCameraUsageDescription: "Good Times needs access to your camera to capture photos and videos for your entries.",
      NSPhotoLibraryUsageDescription: "Good Times needs access to your photo library to select photos for your entries.",
      NSMicrophoneUsageDescription: "Good Times needs access to your microphone to record voice notes.",
      NSContactsUsageDescription: "Good Times uses your contacts so you can invite friends and family to your group.",
      NSFaceIDUsageDescription: "Good Times uses FaceID to securely log you in quickly.",
      // Export compliance: App only uses standard HTTPS/TLS and Apple's built-in encryption APIs
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      // foregroundImage: "./assets/images/adaptive-icon.png", // File doesn't exist, commented out
      backgroundColor: "#000000",
    },
    package: "com.goodtimes.app",
    permissions: ["CAMERA", "READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE", "RECORD_AUDIO", "READ_CONTACTS"],
  },
  plugins: [
    "expo-router",
    "expo-dev-client",
    "expo-local-authentication",
    "expo-secure-store",
    [
      "expo-font",
      {
        fonts: [
          "./assets/fonts/LibreBaskerville-Regular.ttf",
          "./assets/fonts/LibreBaskerville-Bold.ttf",
          "./assets/fonts/Roboto-Regular.ttf",
          "./assets/fonts/Roboto-Medium.ttf",
          "./assets/fonts/Roboto-Bold.ttf",
        ],
      },
    ],
  ],
  extra: {
    router: { origin: false },
    eas: { projectId: "ccd4fdb7-0126-46d1-a518-5839fae48a76" }, // your real EAS project id
    // expose public env for client usage
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});
