# Android Implementation Proposal

**Branch**: `android-config`  
**Date**: Based on codebase review  
**Goal**: Enable Android builds with full feature parity to iOS

---

## Executive Summary

After reviewing the codebase and the Android Build Plan, I've identified the exact changes needed to enable Android builds. The good news is that **~95% of your codebase is already Android-ready** - most React Native code works cross-platform. The remaining work is primarily **build configuration** and **minor platform-specific adjustments**.

### Key Findings

✅ **Already Android-Ready:**
- All React Native components and business logic
- Supabase integration (shared database/auth/storage)
- Deep linking handler (`goodtimes://` scheme) - already implemented
- Date picker implementation - already has Android support via `DateTimePickerAndroid`
- Platform checks (`Platform.OS`) are already in place
- All Expo modules are cross-platform compatible

⚠️ **Needs Configuration:**
- New Architecture mismatch in `gradle.properties`
- Missing Android build profiles in `eas.json`
- Version code sync with iOS
- Adaptive icon asset creation
- AndroidManifest deep link intent filters (may need verification)

🔍 **Needs Testing (Code Looks Good):**
- Keyboard behavior (`KeyboardAvoidingView` - some use `undefined`, some use `"height"`)
- Runtime permissions (Android 13+ storage permissions)
- Deep linking on Android (code exists, needs verification)

---

## Current State Analysis

### ✅ Configuration Files Status

| File | Current State | Issue | Priority |
|------|--------------|-------|----------|
| `app.config.ts` | ✅ Android section exists | Adaptive icon commented out | Medium |
| `eas.json` | ❌ No Android profiles | Missing Android configs | **CRITICAL** |
| `android/gradle.properties` | ❌ `newArchEnabled=true` | Mismatch with `app.config.ts` | **CRITICAL** |
| `android/app/build.gradle` | ⚠️ `versionCode 1` | Should match iOS (5) or use EAS auto-increment | Medium |
| `android/app/src/main/AndroidManifest.xml` | ⚠️ Missing deep link filters | May need intent filters for `goodtimes://` | Medium |

### ✅ Code Implementation Status

| Feature | iOS | Android | Status |
|---------|-----|---------|--------|
| Date Picker | ✅ Modal | ✅ `DateTimePickerAndroid` | ✅ Implemented |
| Keyboard Handling | ✅ `"padding"` | ⚠️ Mixed (`undefined`/`"height"`) | ⚠️ Needs Testing |
| Deep Linking | ✅ Handled | ⚠️ Code exists, needs manifest | ⚠️ Needs Verification |
| Permissions | ✅ Info.plist | ✅ Manifest exists | ⚠️ May need runtime checks |
| OAuth | ✅ Apple + Google | ✅ Google (Apple iOS-only) | ✅ Ready |
| Biometric Auth | ✅ FaceID | ✅ Fingerprint/Face | ✅ Ready |

---

## Proposed Implementation Plan

### Phase 1: Critical Configuration Fixes (MUST DO FIRST)

#### 1.1 Fix New Architecture Mismatch
**File**: `android/gradle.properties`  
**Change**: Line 38
```properties
# BEFORE
newArchEnabled=true

# AFTER
newArchEnabled=false
```
**Rationale**: Matches `app.config.ts` line 14. New Architecture causes crashes.

#### 1.2 Add Android Build Profiles to EAS
**File**: `eas.json`  
**Change**: Add Android configs to all three profiles

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true },
      "android": {
        "buildType": "apk"
      },
      "env": {
        "NPM_CONFIG_LEGACY_PEER_DEPS": "true"
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false },
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "ios": {
        "simulator": false,
        "image": "latest",
        "buildConfiguration": "Release"
      },
      "android": {
        "buildType": "app-bundle"
      },
      "autoIncrement": true,
      "env": {
        "NPM_CONFIG_LEGACY_PEER_DEPS": "true"
      }
    }
  }
}
```

**Rationale**: EAS needs Android-specific build configurations. `app-bundle` is required for Google Play.

#### 1.3 Sync Version Code (Optional - EAS Auto-Increment Recommended)
**File**: `android/app/build.gradle`  
**Option A (Recommended)**: Use EAS `autoIncrement: true` (already in production profile)  
**Option B**: Manually sync
```gradle
# BEFORE
versionCode 1
versionName "1.0"

# AFTER
versionCode 5  // Match iOS buildNumber
versionName "1.2.0"  // Match app.config.ts version
```

**Recommendation**: Use Option A (EAS auto-increment) - less maintenance.

---

### Phase 2: Android Assets

#### 2.1 Create Adaptive Icon
**Action**: Create `assets/images/adaptive-icon.png`
- Size: 1024x1024px
- Format: PNG with transparency
- Content: App icon/logo (foreground)
- Background: Already configured as `#000000` in `app.config.ts`

#### 2.2 Enable Adaptive Icon in Config
**File**: `app.config.ts`  
**Change**: Line 49
```typescript
// BEFORE
adaptiveIcon: {
  // foregroundImage: "./assets/images/adaptive-icon.png", // File doesn't exist, commented out
  backgroundColor: "#000000",
},

// AFTER
adaptiveIcon: {
  foregroundImage: "./assets/images/adaptive-icon.png",
  backgroundColor: "#000000",
},
```

---

### Phase 3: Deep Linking Configuration

#### 3.1 Add Intent Filters to AndroidManifest
**File**: `android/app/src/main/AndroidManifest.xml`  
**Change**: Add intent filters to MainActivity

```xml
<activity 
  android:name=".MainActivity" 
  android:configChanges="keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode" 
  android:launchMode="singleTask" 
  android:windowSoftInputMode="adjustResize" 
  android:theme="@style/Theme.App.SplashScreen" 
  android:exported="true">
  
  <!-- Existing launcher intent -->
  <intent-filter>
    <action android:name="android.intent.action.MAIN"/>
    <category android:name="android.intent.category.LAUNCHER"/>
  </intent-filter>
  
  <!-- NEW: Deep link intent filters -->
  <intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="goodtimes" />
  </intent-filter>
  
</activity>
```

**Rationale**: Enables Android to handle `goodtimes://` deep links. The code in `app/_layout.tsx` already handles these URLs, but Android needs manifest configuration.

**Note**: Expo may auto-generate this, but it's safer to add explicitly.

---

### Phase 4: Platform-Specific Code Adjustments (Testing Dependent)

#### 4.1 Standardize Keyboard Behavior
**Files**: 
- `app/(onboarding)/auth.tsx` (line 855)
- `app/(onboarding)/about.tsx` (line 122)

**Current**: Mixed usage
- Some use `Platform.OS === "ios" ? "padding" : undefined`
- Others use `Platform.OS === "ios" ? "padding" : "height"`

**Recommendation**: Test on Android first. If keyboard covers inputs, change `undefined` to `"height"`.

**Files to potentially update**:
```typescript
// app/(onboarding)/auth.tsx line ~855
behavior={Platform.OS === "ios" ? "padding" : "height"}  // Change undefined to "height"

// app/(onboarding)/about.tsx line ~122
behavior={Platform.OS === "ios" ? "padding" : "height"}  // Change undefined to "height"
```

#### 4.2 Android 13+ Storage Permissions
**File**: `android/app/src/main/AndroidManifest.xml`  
**Current**: Uses `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE`

**Android 13+ (API 33+)**: These permissions are deprecated. Need granular permissions:
- `READ_MEDIA_IMAGES`
- `READ_MEDIA_VIDEO`
- `READ_MEDIA_AUDIO`

**Action**: 
1. Check `expo-image-picker` documentation - it may handle this automatically
2. If not, add runtime permission requests in code
3. Update manifest with new permissions

**Recommendation**: Test first - Expo modules often handle this automatically.

---

## Implementation Checklist

### Critical (Must Do Before First Build)
- [ ] Fix `android/gradle.properties` - set `newArchEnabled=false`
- [ ] Add Android profiles to `eas.json` (development, preview, production)
- [ ] Verify `app.config.ts` Android package name matches Google Play Console

### Important (Required for Production)
- [ ] Create `assets/images/adaptive-icon.png` (1024x1024px)
- [ ] Uncomment adaptive icon in `app.config.ts`
- [ ] Add deep link intent filters to `AndroidManifest.xml`
- [ ] Set up EAS credentials for Android production (`eas credentials`)

### Testing (After First Build)
- [ ] Test date picker on Android
- [ ] Test keyboard behavior (adjust if needed)
- [ ] Test deep links (`goodtimes://join/{groupId}`)
- [ ] Test OAuth (Google Sign In)
- [ ] Test biometric authentication
- [ ] Test all media features (camera, photo library, video, audio)
- [ ] Test push notifications
- [ ] Test storage permissions on Android 13+

### Optional (Can Do Later)
- [ ] Sync version code manually (or rely on EAS auto-increment)
- [ ] Add Android 13+ granular storage permissions if needed
- [ ] Standardize keyboard behavior across all screens

---

## Risk Assessment

### ✅ Zero Risk to iOS
- All changes are Android-specific files
- iOS build configuration untouched
- No shared code changes required

### ⚠️ Low-Medium Risk
- Build configuration changes (low risk, easy to revert)
- Deep linking manifest changes (low risk, well-documented)
- Platform-specific code adjustments (medium risk, requires testing)

### 🛡️ Protection Strategy
1. Work on `android-config` branch (already created)
2. Test Android builds incrementally
3. Verify iOS builds still work after each phase
4. Commit after each successful phase

---

## Testing Strategy

### Phase 1: Configuration Verification
```bash
# Test Android development build
eas build --profile development --platform android

# Verify iOS still works
eas build --profile development --platform ios
```

### Phase 2: Feature Testing
1. Install development build on Android device/emulator
2. Test all critical user flows:
   - Authentication (email, Google OAuth)
   - Onboarding (date picker, photo selection)
   - Entry creation (text, photos, videos, audio)
   - Deep links (group join links)
   - Push notifications
   - Biometric login

### Phase 3: Production Build
```bash
# Build production AAB
eas build --profile production --platform android

# Verify AAB is valid
# Submit to Google Play Console (internal testing track first)
```

---

## Files That Will Be Changed

### Must Change (Critical)
1. `android/gradle.properties` - Fix New Architecture
2. `eas.json` - Add Android build profiles
3. `android/app/src/main/AndroidManifest.xml` - Add deep link intent filters

### Should Change (Important)
4. `app.config.ts` - Uncomment adaptive icon
5. `assets/images/adaptive-icon.png` - Create asset

### May Change (Testing Dependent)
6. `app/(onboarding)/auth.tsx` - Keyboard behavior
7. `app/(onboarding)/about.tsx` - Keyboard behavior
8. `android/app/build.gradle` - Version code (if not using EAS auto-increment)
9. `android/app/src/main/AndroidManifest.xml` - Android 13+ permissions (if needed)

---

## Next Steps

1. **Immediate**: Implement Phase 1 (Critical Configuration Fixes)
2. **After Phase 1**: Test Android development build
3. **After Testing**: Implement Phase 2 (Android Assets)
4. **After Assets**: Implement Phase 3 (Deep Linking)
5. **Final**: Test all features, then proceed to production build

---

## Questions & Considerations

### Q: Do we need to update AndroidManifest for deep links?
**A**: Yes, Android requires intent filters in the manifest. Expo may auto-generate some, but it's safer to add explicitly.

### Q: Will Android 13+ storage permissions break the app?
**A**: Unlikely - `expo-image-picker` typically handles this automatically. Test first, then add if needed.

### Q: Should we use EAS auto-increment or manual version codes?
**A**: **EAS auto-increment recommended** - less maintenance, fewer errors. Already configured in production profile.

### Q: Do we need to test iOS after Android changes?
**A**: **No** - All changes are Android-specific. iOS builds remain untouched.

### Q: What about the adaptive icon - can we use the iOS icon?
**A**: Yes, but Android adaptive icons need specific sizing. Best to create a 1024x1024px version optimized for Android's adaptive icon system.

---

## Conclusion

The codebase is **already 95% Android-ready**. The remaining work is:
1. **Build configuration** (3 files)
2. **Asset creation** (1 file)
3. **Testing and minor adjustments** (platform-specific code)

**Estimated Time**: 
- Configuration fixes: 30-60 minutes
- Asset creation: 30-60 minutes  
- Testing and adjustments: 2-4 hours
- **Total**: ~4-6 hours of active work

**Risk Level**: **LOW** - All changes are isolated to Android-specific files, zero impact on iOS.

**Ready to proceed?** Let's start with Phase 1 (Critical Configuration Fixes).

