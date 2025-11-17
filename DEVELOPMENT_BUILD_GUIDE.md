# Development Build Guide for SDK 54

## Don't Use Expo Go

Your app uses native modules that require a **development build**, not Expo Go:
- `expo-local-authentication` (FaceID)
- `expo-secure-store` (secure storage)
- `expo-av` (audio recording)
- `expo-image-picker` (camera)
- `expo-contacts` (contacts)

## Option 1: Run Development Build Locally (Recommended)

Build and run a development client on your simulator:

```bash
# Build and run development client on iOS simulator
npx expo run:ios
```

**What this does:**
- Builds a development client with all your native modules
- Installs it on the simulator
- Connects to Metro bundler for hot reload
- Works exactly like production, but with dev tools

**First time:** Takes 5-10 minutes to build
**Subsequent runs:** Much faster (uses cached build)

## Option 2: Build Development Client with EAS (For Physical Device)

If you want to test on a physical device:

```bash
# Build development client
eas build --profile development --platform ios

# After build completes, install on device and run:
npx expo start --dev-client
```

## Option 3: Use Production Build for Testing

For final testing before TestFlight:

```bash
# Build production version
eas build --platform ios --profile production

# Install on device via TestFlight or direct install
```

## Rendering Concerns

✅ **With `newArchEnabled: false`**, rendering should be identical to SDK 51:
- No blank screens
- Same behavior as before
- All animations work
- All components render correctly

The development build will behave exactly like your production build, so you can trust what you see.

## Quick Start

```bash
# Answer "n" to Expo Go prompt
# Then run:
npx expo run:ios
```

This builds a proper development client that supports all your native modules.

