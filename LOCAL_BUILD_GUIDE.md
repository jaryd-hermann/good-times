# How to Build Locally Without Hanging

## The Issue

`npx expo run:ios` is a **long-running process** that:
1. Builds your app (takes 2-5 minutes)
2. Launches the simulator
3. **Keeps running** to watch for file changes

Using `tail` or piping to commands makes it appear to "hang" because it never finishes.

## Solutions

### Option 1: Run in Background (Recommended)
```bash
# Start the build in background
npx expo run:ios > build.log 2>&1 &

# Watch the log file
tail -f build.log

# When you see "Build succeeded" or the simulator opens, press Ctrl+C to stop tailing
```

### Option 2: Build Only (No Watch Mode)
```bash
# Build without launching (if supported)
npx expo run:ios --no-build-cache

# Or use xcodebuild directly
cd ios && xcodebuild -workspace GoodTimes.xcworkspace -scheme GoodTimes -configuration Debug -sdk iphonesimulator -derivedDataPath build
```

### Option 3: Use Expo Start + Manual Launch
```bash
# Terminal 1: Start Metro bundler
npx expo start

# Terminal 2: Build and launch (one-time)
npx expo run:ios --no-bundler
```

## Current Status

You have **Reanimated 3.16.1** which has linker errors with RN 0.81. The build will likely fail with:

```
Undefined symbols for architecture arm64
Symbol: facebook::hermes::inspector_modern::chrome::enableDebugging
```

## Recommendation

**For TestFlight:** Use EAS Build - it handles compatibility automatically.

**For local testing:** Try building and see if it actually works despite warnings. Sometimes linker warnings don't prevent the app from running.

