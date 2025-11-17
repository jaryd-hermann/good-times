# TestFlight Crash Debug Guide

## 🔍 Where to Find Crash Logs

### Option 1: App Store Connect (Easiest)
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to: **My Apps** → **Good Times** → **TestFlight** tab
3. Click on your build (build 5)
4. Scroll down to **"Crashes"** section
5. Click on any crash report to see stack traces

### Option 2: Xcode Organizer (If you have Xcode)
1. Open **Xcode**
2. Go to **Window** → **Organizer**
3. Click **Crashes** tab
4. Select your app and build number
5. View crash reports with symbols

### Option 3: Device Logs (If testing on physical device)
1. Connect device to Mac
2. Open **Console.app** (Applications → Utilities → Console)
3. Select your device from sidebar
4. Filter by your app name "Good Times"
5. Look for crash logs with timestamps

### Option 4: EAS Build Logs
```bash
# View build logs for the latest build
eas build:list --platform ios --limit 1

# Get specific build ID, then:
eas build:view [BUILD_ID]
```

---

## 🚨 Critical Issue: Instant Crash

The app is crashing immediately on launch. This suggests:

1. **Module initialization crash** (before React renders)
2. **Missing environment variables** (Supabase not configured)
3. **Native module registration failure**
4. **Error in top-level code** (before ErrorBoundary can catch)

### Potential Causes

#### 1. Supabase Module Import Failure
Even with safe `require()`, if the module itself crashes during initialization, the try-catch won't help.

**Check:** Look for errors related to:
- `@supabase/supabase-js`
- `react-native-url-polyfill`
- `@react-native-async-storage/async-storage`

#### 2. Missing Environment Variables
If EAS secrets aren't set correctly, the app might crash trying to access them.

**Check:**
```bash
# Verify secrets are set
eas env:list --scope project --environment production
```

#### 3. Native Module Registration
A native module might be failing to register.

**Check crash logs for:**
- `EXC_BAD_ACCESS`
- `NSInvalidArgumentException`
- Module registration errors

#### 4. Font Loading Failure
If fonts fail to load, it could crash.

**Check:** Look for font-related errors in crash logs.

---

## 🔧 Debugging Steps

### Step 1: Check Crash Logs
Follow Option 1 above to get the actual crash stack trace from App Store Connect.

### Step 2: Verify Environment Variables
```bash
# Check if secrets are set
eas env:list --scope project --environment production --include-sensitive
```

Should show:
- `EXPO_PUBLIC_SUPABASE_URL` = `https://ytnnsykbgohiscfgomfe.supabase.co`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` = `*****` (hidden)

### Step 3: Check Build Logs
```bash
# Get latest build ID
eas build:list --platform ios --limit 1

# View build logs (look for errors during build)
eas build:view [BUILD_ID]
```

### Step 4: Test with Minimal Code
If crash logs show a specific module, we can temporarily disable it to isolate the issue.

---

## 📱 Icon Not Updating

### Why This Happens
iOS caches app icons aggressively. Even with a new build, iOS might show the old icon.

### Solutions

#### Solution 1: Increment Build Number (Required)
The build number must change for iOS to recognize it as a new build:

```typescript
// app.config.ts
buildNumber: "6", // Increment from "5"
```

#### Solution 2: Verify Icon File
```bash
# Check icon exists and is valid
ls -lh assets/images/icon.png
file assets/images/icon.png

# Should show: PNG image data, 938 x 938
```

#### Solution 3: Clear Device Cache
On TestFlight device:
1. Delete the app completely
2. Restart device
3. Reinstall from TestFlight

#### Solution 4: Verify Icon in Build
The icon should be included in the build. Check build logs for:
```
Processing asset: assets/images/icon.png
```

---

## 🎯 Immediate Actions

1. **Get crash logs** from App Store Connect (most important)
2. **Increment build number** to `6` for icon fix
3. **Verify EAS secrets** are set correctly
4. **Check build logs** for any errors during build

---

## 📋 What to Look For in Crash Logs

### Common Crash Patterns

**Pattern 1: Module Import Failure**
```
Exception Type: EXC_CRASH
Exception Subtype: KERN_INVALID_ADDRESS
Termination Reason: Namespace SIGNAL, Code 0xb
Crashed Thread: 0
```

**Pattern 2: Missing Environment Variable**
```
Fatal error: Missing Supabase environment variables
```

**Pattern 3: Native Module Registration**
```
-[RCTModuleData initWithModuleClass:]: unrecognized selector
```

**Pattern 4: Font Loading**
```
Font not found: LibreBaskerville-Regular
```

---

## 🔄 Next Steps

1. **Get the crash log** from App Store Connect
2. **Share the stack trace** so we can identify the exact issue
3. **Increment build number** to `6` for icon
4. **Rebuild** with fixes

The crash log will tell us exactly what's failing, then we can fix it.

