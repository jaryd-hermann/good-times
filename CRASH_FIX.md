# Crash Fix - Reanimated Import

## The Problem

The app was crashing on startup because `react-native-reanimated` wasn't imported at the top of `app/_layout.tsx`. With Reanimated 4.x and New Architecture, this import is **critical** and must be the first import.

## What I Fixed

✅ Added `import "react-native-reanimated"` as the first import in `app/_layout.tsx`

## Next Steps

1. **Rebuild and test locally:**
   ```bash
   export LANG=en_US.UTF-8
   npx expo run:ios
   ```

2. **If local build works, rebuild for TestFlight:**
   ```bash
   eas build --platform ios --profile production
   eas submit --platform ios --latest
   ```

## Additional Check: Environment Variables

Make sure your Supabase environment variables are set in EAS:

```bash
# Check if they're set
eas secret:list

# If not, set them:
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "your-url"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-key"
```

Or add them to `eas.json` build profiles (less secure but simpler):

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "your-url",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "your-key"
      }
    }
  }
}
```

## Why This Crashed

Reanimated 4.x with New Architecture requires the import to be at the very top of the entry file to properly initialize worklets and the native module. Without it, the app crashes immediately on startup.

