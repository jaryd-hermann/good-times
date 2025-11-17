# Silent Crash Debugging Guide

## 🚨 The Problem: No Crash Logs

If there are **no crash logs** in App Store Connect, this suggests:

1. **Silent Failure** - App fails before crash reporting initializes
2. **Hanging/Freezing** - App hangs instead of crashing
3. **White/Black Screen** - App launches but doesn't render
4. **Environment Variable Issue** - Missing env vars cause silent failure

## 🔍 Debugging Steps

### Step 1: Add Enhanced Logging

The app already has console.log statements, but in production builds, these might not be visible. We need to:

1. **Add Alert-based error reporting** (visible even in production)
2. **Add early logging** before any async operations
3. **Add error boundaries** at multiple levels

### Step 2: Test with Development Build

Since development builds show console logs, this will help us see what's happening:

```bash
# Build development client
eas build --profile development --platform ios

# Install on simulator
eas build:run --platform ios

# Start Metro and watch logs
npx expo start --dev-client
```

**Watch the Metro console** - you'll see all `console.log` statements and errors.

### Step 3: Check Environment Variables

The most likely cause of silent failure is missing environment variables:

```bash
# Verify secrets are set
eas env:list --scope project --environment production --include-sensitive
```

Should show:
- `EXPO_PUBLIC_SUPABASE_URL` = `https://ytnnsykbgohiscfgomfe.supabase.co`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` = `*****`

### Step 4: Add Visual Error Indicators

We'll add Alert dialogs that show even in production builds to see what's failing.

## 🎯 Most Likely Causes

### 1. Missing Environment Variables (90% likely)

If `EXPO_PUBLIC_SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_ANON_KEY` are missing:
- The app checks this in `app/index.tsx` line 49-54
- It should show an error message, but if the check itself fails, it might crash silently

### 2. Supabase Module Import Failure

Even with safe `require()`, if the module crashes during initialization:
- The try-catch might not catch it
- This would cause a silent crash

### 3. Font Loading Failure

If fonts fail to load:
- The app might hang on splash screen
- No crash, just a white/black screen

### 4. Native Module Registration

A native module might fail to register:
- This happens before React renders
- Would cause instant crash with no logs

## 🔧 Immediate Actions

1. **Build development client** to see console logs
2. **Check environment variables** are set correctly
3. **Add Alert-based error reporting** to see errors in production
4. **Test with development build** to identify the issue

## 📱 Icon Issue

### Why Icon Doesn't Update

iOS aggressively caches app icons. Even with a new build number, iOS might show the old icon.

### Solutions

1. **Verify icon is in build**:
   ```bash
   # Check build logs for icon processing
   eas build:view [BUILD_ID] | grep -i icon
   ```

2. **Force icon refresh**:
   - Delete app completely from device
   - Restart device
   - Reinstall from TestFlight
   - Sometimes takes 2-3 installs for icon to update

3. **Check icon file**:
   ```bash
   ls -lh assets/images/icon.png
   file assets/images/icon.png
   # Should be PNG, 938x938
   ```

4. **Verify in App Store Connect**:
   - Go to App Store Connect
   - My Apps → Good Times → App Information
   - Check if icon shows correctly there
   - If wrong there, the build isn't including the new icon

## 🎯 Next Steps

1. **Build development client** to see logs:
   ```bash
   eas build --profile development --platform ios
   ```

2. **Watch Metro console** when app launches to see where it fails

3. **Share the console output** so we can identify the exact failure point

4. **Add Alert-based error reporting** to production builds so we can see errors even without logs

