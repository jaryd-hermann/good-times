import type { ExpoConfig, ConfigContext } from "expo/config"

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Good Times",
  slug: "good-times",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "goodtimes",
  userInterfaceStyle: "dark",
  splash: {
    image: "./assets/images/splash.png",
    resizeMode: "contain",
    backgroundColor: "#000000",
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.goodtimes.app",
    infoPlist: {
      NSCameraUsageDescription: "Good Times needs access to your camera to capture photos and videos for your entries.",
      NSPhotoLibraryUsageDescription:
        "Good Times needs access to your photo library to select photos for your entries.",
      NSMicrophoneUsageDescription: "Good Times needs access to your microphone to record voice notes.",
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#000000",
    },
    package: "com.goodtimes.app",
    permissions: ["CAMERA", "READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE", "RECORD_AUDIO"],
  },
  plugins: [
    "expo-router",
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
    router: {
      origin: false,
    },
    eas: {
      projectId: "your-project-id",
    },
  },
})
