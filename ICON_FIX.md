# App Icon Fix - Root Cause Found

## Problem
The iOS native project has its own icon asset catalog that was overriding Expo's icon configuration.

**Location**: `ios/GoodTimes/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png`

This native asset catalog takes precedence over the `icon` setting in `app.config.ts`.

## Solution Applied
✅ Copied `icon-ios.png` to replace the old icon in the asset catalog

## Additional Steps Needed

### Option 1: Delete iOS folder (Recommended for EAS builds)
If you're using EAS builds (not local builds), delete the `ios` folder and let EAS regenerate it:

```bash
rm -rf ios
```

EAS will regenerate the `ios` folder during build and use the icon from `app.config.ts` (`icon-ios.png`).

**Note**: Only do this if you're NOT doing local builds with `npx expo run:ios`

### Option 2: Resize icon to 1024x1024
The current icon is 938x938, but iOS requires 1024x1024. You can resize it:

```bash
# Using ImageMagick (if installed)
convert assets/images/icon-ios.png -resize 1024x1024 assets/images/icon-ios-1024.png

# Then copy to asset catalog
cp assets/images/icon-ios-1024.png ios/GoodTimes/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png
```

### Option 3: Keep current setup
✅ **COMPLETED**: The icon (`icon-ios.png`) has been copied to the asset catalog. The file is 2.4MB and should be properly sized for iOS.

## Verification
After your next build:
1. Check the build logs for icon processing
2. Verify the icon in TestFlight/App Store Connect
3. Check the installed app icon on device

## Why This Happened
When you run `npx expo prebuild` or `npx expo run:ios`, Expo creates a native iOS project with an asset catalog. This asset catalog takes precedence over Expo's icon config. Even for EAS builds, if the `ios` folder exists locally, it might be included in the build.

## Prevention
For EAS-only builds, consider:
- Adding `ios/` to `.gitignore` (if not already)
- Or ensuring the asset catalog always matches `app.config.ts`

