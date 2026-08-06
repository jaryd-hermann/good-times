import type { ExpoConfig, ConfigContext } from "expo/config";

const onesignalApsMode =
  process.env.ONESIGNAL_APS_MODE === "production" ? "production" : "development";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  owner: "jarydhermann",
  name: "Good Times",
  slug: "good-times",
  version: "2.0.3", // User-facing version (e.g., "1.1.0", "1.2.0")
  orientation: "portrait",
  icon: "./assets/images/icon-ios.png",
  scheme: "goodtimes",
  userInterfaceStyle: "light",
  // Disable New Architecture - causing crashes during native module registration
  newArchEnabled: false,
  splash: {
    image: "./assets/images/loading.png",
    resizeMode: "contain",
    backgroundColor: "#E8E0D5", // Match new boot screen beige background
  },
  assetBundlePatterns: ["assets/*"],
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.jarydhermann.goodtimes",
    buildNumber: "6", // Increment for each TestFlight submission (e.g., "1", "2", "3" or "1.1.0.1", "1.1.0.2")
    usesAppleSignIn: true, // Keep Apple Sign In capability enabled (required for web-based OAuth via Supabase)
    associatedDomains: ["applinks:thegoodtimes.app"],
    entitlements: {
      "com.apple.security.application-groups": ["group.com.jarydhermann.goodtimes.onesignal"],
    },
    // Apple's required privacy manifest. This used to live as a checked-in
    // ios/GoodTimes/PrivacyInfo.xcprivacy, which meant `expo prebuild` silently
    // dropped it (prebuild only emits the manifest when it is declared here) and
    // the next submission would fail ITMS-91053. Declared in config it survives
    // any regeneration of the native project.
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp",
          NSPrivacyAccessedAPITypeReasons: ["C617.1", "0A2A.1", "3B52.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
          NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime",
          NSPrivacyAccessedAPITypeReasons: ["35F9.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace",
          NSPrivacyAccessedAPITypeReasons: ["E174.1", "85F4.1"],
        },
      ],
      NSPrivacyCollectedDataTypes: [],
      NSPrivacyTracking: false,
    },
    // deploymentTarget is set in ios/Podfile.properties.json (not a valid property here in Expo SDK 54)
    infoPlist: {
      NSCameraUsageDescription: "Good Times needs access to your camera to capture photos and videos for your entries.",
      NSPhotoLibraryUsageDescription: "Good Times needs access to your photo library to select photos for your entries.",
      NSMicrophoneUsageDescription: "Good Times needs access to your microphone to record voice notes.",
      NSContactsUsageDescription: "Good Times uses your contacts so you can invite friends and family to your group.",
      NSFaceIDUsageDescription: "Good Times uses FaceID to securely log you in quickly.",
      // Required by App Store validation (ITMS-90683), not by the app.
      // OneSignal's pod pulls in OneSignalXCFramework/OneSignalLocation, so the
      // binary references CoreLocation even though Good Times never asks for a
      // location and no code path requests one. Apple requires a purpose string
      // whenever the API is merely referenced. The user will not see this prompt.
      NSLocationWhenInUseUsageDescription:
        "Good Times does not use your location. This appears only because our notifications provider includes location code we do not enable.",
      UIBackgroundModes: ["remote-notification"],
      // Export compliance: App only uses standard HTTPS/TLS and Apple's built-in encryption APIs
      ITSAppUsesNonExemptEncryption: false,
      icon: "./assets/images/icon-ios.png",
      // Allow querying for Gmail and other email apps
      LSApplicationQueriesSchemes: [
        "googlegmail",
        "gmail",
        "mailto",
        "ms-outlook",
        "ymail",
        "readdle-spark",
      ],
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#000000",
    },
    package: "com.goodtimes.app",
    permissions: ["CAMERA", "READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE", "RECORD_AUDIO", "READ_CONTACTS"],
    // Android App Links, the counterpart to the iOS associatedDomains above.
    // Without these, https://thegoodtimes.app/join and /share links open the
    // browser instead of the app. Verification is against the fingerprints in
    // public/.well-known/assetlinks.json, which must list both the EAS upload
    // key and (once published) the Play App Signing key.
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          { scheme: "https", host: "thegoodtimes.app", pathPrefix: "/join" },
          { scheme: "https", host: "thegoodtimes.app", pathPrefix: "/share" },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  // Android tints the small icon and renders it as an alpha mask, so this must be
  // a white-on-transparent silhouette or the status bar shows a solid white square.
  // Read by expo-notifications and by onesignal-expo-plugin, which copies it to
  // ic_stat_onesignal_default. Both Android-only; iOS ignores this block.
  notification: {
    icon: "./assets/images/notification-icon.png",
    color: "#E5A13C",
  },
  androidStatusBar: {
    barStyle: "dark-content",
    backgroundColor: "#E8E0D5",
  },
  plugins: [
    // iPhoneDeploymentTarget must be set explicitly: the plugin otherwise gives the
    // Notification Service Extension target a deployment target of 11.0, which the
    // Xcode 26 toolchain on EAS will not build. 15.1 matches the app target.
    // smallIconAccentColor is applied by withOneSignalAndroid only; the notification
    // block above sets the color for expo-notifications but OneSignal reads its own
    // com.onesignal.NotificationAccentColor.DEFAULT meta-data.
    [
      "onesignal-expo-plugin",
      {
        mode: onesignalApsMode,
        iPhoneDeploymentTarget: "15.1",
        smallIconAccentColor: "#E5A13C",
      },
    ],
    "expo-router",
    "expo-dev-client",
    "expo-local-authentication",
    "expo-apple-authentication", // Required for EAS to recognize Apple Sign In capability
    "expo-secure-store",
    "expo-notifications",
    "expo-camera", // Required for video recording feature
    // Note: Notification icons use the app icon automatically on both iOS and Android
    // If you see the old icon in notifications after updating the app icon:
    // - iOS: The system caches notification icons. Users may need to restart their device or the app needs to be rebuilt
    // - Android: Uses the app icon automatically. Ensure adaptiveIcon.foregroundImage is updated above
    // Note: expo-blur doesn't require a config plugin - it's a native module that works automatically
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
  updates: {
    url: "https://u.expo.dev/ccd4fdb7-0126-46d1-a518-5839fae48a76",
  },
  runtimeVersion: "2.0.3", // Must be a string in bare workflow, matches app version
  extra: {
    router: { origin: false },
    eas: { projectId: "ccd4fdb7-0126-46d1-a518-5839fae48a76" }, // your real EAS project id
    // expose public env for client usage
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_OPENAI_API_KEY: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
    EXPO_PUBLIC_ONESIGNAL_APP_ID: process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID,
  },
});
