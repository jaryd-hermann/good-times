# Steps to Debug the Crash

## What We've Fixed

1. ✅ Added Reanimated import at top of `_layout.tsx`
2. ✅ Added environment variable validation
3. ✅ Made Supabase initialization more defensive
4. ✅ Added font loading check before render

## Next Steps to Debug

### 1. Check Metro Bundler Output

When you run `npx expo run:ios`, watch the Metro bundler output for:
- Red error messages
- Yellow warnings
- Any stack traces

### 2. Check Xcode Console

If building from Xcode or if simulator is open:
- Open Xcode → Window → Devices and Simulators
- Select your simulator
- Click "Open Console"
- Filter for "GoodTimes" or "Expo"
- Look for crash logs

### 3. Check Simulator Logs Directly

```bash
# Stream simulator logs
xcrun simctl spawn booted log stream --predicate 'processImagePath contains "GoodTimes"' --level debug
```

### 4. Try Minimal Test

Create a minimal test to see if it's a specific component:

```typescript
// Temporarily replace app/index.tsx content with:
export default function Index() {
  return <View style={{ flex: 1, backgroundColor: 'red' }}><Text>Test</Text></View>
}
```

If this works, the issue is in the boot logic. If it crashes, it's a deeper issue.

### 5. Check if It's New Architecture

Try temporarily disabling New Architecture:

```typescript
// app.config.ts
newArchEnabled: false,
```

Then downgrade Reanimated:
```bash
npm install react-native-reanimated@~3.16.1
cd ios && rm -rf Pods Podfile.lock && pod install
npx expo run:ios
```

If this works, the issue is New Architecture compatibility.

## Most Likely Causes

1. **New Architecture incompatibility** - Some code might not work with New Architecture
2. **Reanimated initialization** - Even with import, might need more setup
3. **Circular dependency** - Some imports might be causing issues
4. **Native module initialization** - Some native module failing to initialize

## Quick Test

Run this and tell me what error message you see:

```bash
export LANG=en_US.UTF-8
npx expo run:ios 2>&1 | tee build.log
```

Then check `build.log` for errors, or share the last 50 lines of output.

