# Local Development Workflow Guide

## 🎯 Goal: Test Locally Before TestFlight

You need to be able to:
1. ✅ Make code changes locally
2. ✅ See changes instantly with hot reload
3. ✅ Test all features in simulator
4. ✅ Verify everything works before pushing to TestFlight

---

## 🔍 Why Local Builds Were Failing

### The Root Cause

1. **New Architecture Disabled** (for TestFlight stability)
   - Set to `false` in `app.config.ts` and `ios/Podfile.properties.json`
   - This was done to prevent crashes in TestFlight

2. **Reanimated Compatibility Issue**
   - `react-native-reanimated@~3.16.1` has Hermes compatibility issues with React Native 0.81 when New Architecture is disabled
   - This caused linker errors: `Undefined symbols for architecture arm64`

3. **RCT-Folly Coroutine Issue** (Fixed ✅)
   - Header files patched in `ios/Podfile`
   - This is no longer blocking

### Current Status

- ✅ **EAS Build (TestFlight)**: Works perfectly (uses cloud build environment)
- ❌ **Local Build (`npx expo run:ios`)**: May fail due to Reanimated/Hermes compatibility
- ✅ **Environment Variables**: Set up in `.env` file for local development

---

## 🚀 Recommended Workflow

### Option 1: Local Development Build (⚠️ CURRENTLY NOT WORKING)

**Status:** ❌ **Will fail** with Reanimated/Hermes compatibility error

**Why it fails:**
- New Architecture is disabled (`newArchEnabled: false`) for TestFlight stability
- Reanimated 3.16.1 has Hermes compatibility issues with RN 0.81 when New Architecture is disabled
- Error: `Undefined symbols for architecture arm64` - `facebook::hermes::inspector_modern::chrome::enableDebugging`

**Don't use this** - Use Option 2 (EAS Development Build) instead.

---

### Option 2: EAS Development Build (✅ RECOMMENDED - Use This)

**Build once, test many times:**

```bash
# 1. Build a development client in the cloud
eas build --profile development --platform ios

# 2. After build completes, install on simulator
eas build:run --platform ios

# 3. Start Metro bundler
npx expo start --dev-client
```

**What happens:**
- Builds in EAS cloud (handles all compatibility issues)
- Creates a `.ipa` file you install on simulator
- Once installed, works like local build with hot reload
- **Build time**: 15-20 minutes (one time)
- **Testing**: Instant hot reload after that

**Advantages:**
- ✅ No local build issues
- ✅ Same environment as TestFlight
- ✅ Hot reload works perfectly
- ✅ Can test on physical device too

**Disadvantages:**
- ⏱️ Initial build takes 15-20 minutes
- 💰 Uses EAS build credits (but development builds are cheaper)

---

### Option 3: Hybrid Approach (Recommended)

**Best of both worlds:**

1. **For quick UI/UX changes**: Use Option 1 (local build)
   - Fast iteration
   - Hot reload
   - No build credits

2. **For native module testing**: Use Option 2 (EAS dev build)
   - Test FaceID, camera, etc.
   - Same environment as production
   - Verify before TestFlight

3. **For production**: Use EAS production build
   - Only when ready for TestFlight
   - After local/EAS dev testing passes

---

## 📋 Step-by-Step Local Development Process

### Daily Development Workflow

**Since local builds don't work, use EAS Development Build:**

```bash
# 1. Start your day - ensure dependencies are installed
npm install

# 2. If you don't have a dev build yet, create one (one time, 15-20 min):
eas build --profile development --platform ios

# 3. Install on simulator:
eas build:run --platform ios

# 4. Start Metro bundler:
npx expo start --dev-client
```

### Making Changes

1. **Edit code** in your editor
2. **Save file** → Metro automatically reloads
3. **See changes instantly** in simulator
4. **Test feature** → Verify it works
5. **Commit when ready** → Push to branch

### Before Pushing to TestFlight

```bash
# 1. Test with EAS development build
eas build --profile development --platform ios
eas build:run --platform ios
npx expo start --dev-client
# Test all features, verify everything works

# 2. Commit and push
git add .
git commit -m "Your changes"
git push origin your-branch

# 3. Merge to main (after review)

# 4. Build for TestFlight
eas build --platform ios --profile production

# 5. Submit to TestFlight
eas submit --platform ios --latest
```

---

## 🔧 Troubleshooting Local Builds

### Local Builds Don't Work (Expected)

**Error: Reanimated/Hermes compatibility**

This is **expected** - local builds won't work with current configuration. Use EAS development build instead:

```bash
# Use EAS development build (this is the only option that works)
eas build --profile development --platform ios
eas build:run --platform ios
npx expo start --dev-client
```

**Error: RCT-Folly coroutine**

```bash
# This should be fixed, but if it happens:
cd ios
rm -rf Pods Podfile.lock
pod install
# The Podfile will automatically patch the headers
```

**Error: Environment variables not found**

```bash
# Ensure .env file exists
cat .env
# Should show:
# EXPO_PUBLIC_SUPABASE_URL=...
# EXPO_PUBLIC_SUPABASE_ANON_KEY=...

# If missing, create it:
cp .env.example .env
# Then fill in your Supabase credentials
```

---

## 🎯 Quick Reference

### Local Development (Fast Iteration)
```bash
npx expo start --clear
# Press 'i' in Metro, or:
npx expo run:ios
```

### EAS Development Build (If Local Fails)
```bash
eas build --profile development --platform ios
eas build:run --platform ios
npx expo start --dev-client
```

### Production Build (TestFlight)
```bash
eas build --platform ios --profile production
eas submit --platform ios --latest
```

---

## 📊 Comparison

| Method | Build Time | Hot Reload | Native Modules | Build Credits |
|--------|-----------|------------|----------------|---------------|
| **Local (`npx expo run:ios`)** | 5-10 min (first) | ✅ Yes | ✅ Yes | ❌ No |
| **EAS Dev Build** | 15-20 min (one time) | ✅ Yes | ✅ Yes | ✅ Yes (cheaper) |
| **EAS Production** | 20-30 min | ❌ No | ✅ Yes | ✅ Yes |

---

## ✅ Recommended Setup

**For your workflow, I recommend:**

1. **Use EAS development build** (only option that works)
   - Build once, test many times
   - Same environment as production
   - Hot reload works perfectly
   - Worth the build credits for reliability

2. **Only use EAS production** when ready for TestFlight
   - After thorough EAS dev testing
   - When you're confident everything works

**Note:** Local builds (`npx expo run:ios`) don't work due to Reanimated/Hermes compatibility. This is expected and not a bug.

---

## 🚨 Important Notes

1. **Environment Variables**: 
   - Local: Uses `.env` file
   - EAS Build: Uses EAS secrets (already set)

2. **New Architecture**: 
   - Currently disabled (`false`) for TestFlight stability
   - Local builds should work with this setting
   - If not, use EAS development build

3. **Reanimated**: 
   - Currently `~3.16.1` (compatible with Old Architecture)
   - If you upgrade to 4.x, you'll need New Architecture enabled

4. **Build Credits**:
   - Development builds: Cheaper than production
   - Production builds: More expensive
   - Use development builds for testing, production only for TestFlight

---

## 🎉 Next Steps

1. **Use EAS development build** (local builds don't work):
   ```bash
   # Build development client (one time, 15-20 min)
   eas build --profile development --platform ios
   
   # Install on simulator
   eas build:run --platform ios
   
   # Start Metro for hot reload
   npx expo start --dev-client
   ```

2. **After build installs**: You'll have hot reload and can test everything locally.

3. **Test thoroughly** before pushing to TestFlight.

**Note:** This is the only working option due to Reanimated/Hermes compatibility issues with local builds.

---

**You should now be able to test locally before using TestFlight!** 🚀

