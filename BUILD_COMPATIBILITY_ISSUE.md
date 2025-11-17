# Build Compatibility Issue

## The Problem

We're encountering a compatibility conflict:

1. **Expo SDK 54** expects `react-native-reanimated` `~4.1.1`
2. **Reanimated 4.x** requires **New Architecture** to be enabled
3. **New Architecture** was disabled to avoid rendering issues
4. **Reanimated 3.16.1** (current version) has Hermes compatibility issues with RN 0.81

## The Error

```
Undefined symbols for architecture arm64
┌─ Symbol: facebook::hermes::inspector_modern::chrome::enableDebugging(...)
└─ Referenced from: worklets::ReanimatedHermesRuntime::ReanimatedHermesRuntime(...)
```

This is a linker error - Reanimated 3.16.1 is trying to use a Hermes API that doesn't exist in React Native 0.81.

## Solutions

### ✅ Option 1: Use EAS Build for TestFlight (RECOMMENDED)

**EAS Build handles all compatibility issues automatically:**

```bash
eas build --platform ios --profile production
eas submit --platform ios --latest
```

**Why this works:**
- EAS Build uses its own build environment
- Automatically handles New Architecture compatibility
- Uses correct versions of all dependencies
- No local build configuration needed

### Option 2: Enable New Architecture (For Local Development)

If you want to test locally, you can enable New Architecture:

1. **Update `app.config.ts`:**
   ```typescript
   newArchEnabled: true, // Change from false
   ```

2. **Update `ios/Podfile.properties.json`:**
   ```json
   {
     "newArchEnabled": "true"
   }
   ```

3. **Reinstall pods:**
   ```bash
   cd ios && rm -rf Pods Podfile.lock && pod install
   ```

4. **Upgrade Reanimated:**
   ```bash
   npm install react-native-reanimated@~4.1.1
   ```

**⚠️ Warning:** You mentioned having rendering issues before. New Architecture might reintroduce those.

### Option 3: Stay on Reanimated 3.16.1 and Fix Hermes Issue

This would require patching Reanimated's source code to remove the `enableDebugging` call, which is complex and not recommended.

## Recommendation

**Use EAS Build for TestFlight** - it's the simplest and most reliable solution. You don't need to fix local builds if you're using EAS Build for production.

For local development, you can:
- Continue using Expo Go for quick testing (if compatible)
- Or enable New Architecture if you need native features

## Current Status

- ✅ RCT-Folly coroutine issues: **Fixed** (patched header files)
- ❌ Reanimated/Hermes compatibility: **Blocked** (requires New Architecture or EAS Build)

