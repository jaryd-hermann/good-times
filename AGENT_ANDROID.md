# Android Build & Google Play Publishing - Agent Context Document

## Project Overview

**Good Times** is a private, nostalgic journaling app for families and friends living apart. The app is currently **iOS-only** and published on the App Store. This document outlines the plan to add Android support and publish to Google Play **without breaking the stable iOS build**.

### Current Status
- ✅ **iOS**: Stable, published on App Store (v1.2.0, Build 5)
- ⚠️ **Android**: ~70% ready, needs configuration fixes and testing
- 🎯 **Goal**: Publish Android version to Google Play while maintaining iOS stability

---

## Tech Stack (Cross-Platform)

### Frontend
- **React Native**: `^0.81.5` (Old Architecture - New Architecture disabled)
- **React**: `19.1.0` (pinned exact version - critical for compatibility)
- **Expo SDK**: `^54.0.23`
- **Expo Router**: `~6.0.14` (file-based routing)
- **TypeScript**: `~5.3.3`
- **React Query** (`@tanstack/react-query`): `^5.17.0` (data fetching/caching)
- **React Native Animated API**: Built-in (NOT `react-native-reanimated`)

### Backend
- **Supabase**: Database, Auth, Storage, Edge Functions
- **PostgreSQL**: Via Supabase
- **Storage Buckets**: `entries-media`, `avatars`

### Key Libraries (All Android-Compatible)
- `expo-av`: Audio recording/playback for voice memos ✅
- `expo-image-picker`: Photo/video selection ✅
- `expo-notifications`: Push notifications ✅
- `expo-local-authentication`: Biometric (FaceID/TouchID/Fingerprint) ✅
- `expo-secure-store`: Secure credential storage ✅
- `expo-file-system`: File operations (using `/legacy` import) ✅
- `react-native-webview`: Spotify/Apple Music embeds ✅
- `date-fns`: Date manipulation ✅
- `@react-native-community/datetimepicker`: Date selection ✅

---

## Critical Architecture Decisions

### 1. **React Native New Architecture: DISABLED**
- **Why**: Caused crashes during native module registration on iOS
- **Config**: `newArchEnabled: false` in `app.config.ts`
- **⚠️ CRITICAL**: Must also be `false` in `android/gradle.properties` (currently `true` - **MISMATCH**)
- **Impact**: Cannot use libraries requiring New Architecture

### 2. **React Version: Pinned to 19.1.0**
- **Why**: React Native renderer requires exact match
- **Critical**: Do NOT upgrade React without checking `react-native-renderer` compatibility
- **Error if mismatched**: "Incompatible React versions: react: 19.2.0 vs react-native-renderer: 19.1.0"

### 3. **No react-native-reanimated**
- **Why**: Removed due to compatibility issues with Old Architecture
- **Alternative**: Using React Native's built-in `Animated` API
- **Files**: `babel.config.js` does NOT include `react-native-reanimated/plugin`

### 4. **Group Context Management**
- **Storage**: `AsyncStorage` key `"current_group_id"` persists selected group
- **Sync**: `useFocusEffect` hooks sync group ID on screen focus
- **Critical**: All queries must filter by `currentGroupId` to prevent data leakage between groups

### 5. **Data Fetching Strategy**
- **React Query**: All server data fetched via `@tanstack/react-query`
- **Query Keys**: Include `currentGroupId` for group-specific data
- **Invalidation**: Use prefix matching (`exact: false`) when invalidating group queries
- **Stale Time**: `staleTime: 0` for history entries to ensure fresh data on group switch

---

## Current Android Setup Status

### ✅ What's Already Set Up

1. **Android Project Structure**
   - `android/` directory exists with proper structure
   - `MainActivity.kt` and `MainApplication.kt` present and configured
   - `AndroidManifest.xml` configured with permissions
   - Gradle files present (`build.gradle`, `settings.gradle`, `gradle.properties`)

2. **Basic Android Configuration**
   - Package name: `com.goodtimes.app` (set in `app.config.ts`)
   - Permissions declared: `CAMERA`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `RECORD_AUDIO`, `READ_CONTACTS`
   - Adaptive icon background color: `#000000`
   - Dark theme support configured

3. **Cross-Platform Code**
   - Most Expo modules are Android-compatible
   - React Native 0.81.5 supports Android
   - Dependencies are Android-ready
   - Platform checks exist for notifications and keyboard behavior

4. **OAuth Authentication**
   - ✅ **Google OAuth**: Already implemented and working
   - ✅ **Apple OAuth**: iOS-only (expected, no Android equivalent needed)
   - ✅ **Email/Password**: Works on both platforms

---

## Critical Gaps to Fix

### 🔴 **CRITICAL: New Architecture Mismatch**

**Issue**: Conflicting New Architecture settings
- ✅ `app.config.ts`: `newArchEnabled: false` (correct)
- ❌ `android/gradle.properties`: `newArchEnabled=true` (WRONG - must be `false`)

**Impact**: Android builds may enable New Architecture, causing crashes (same issue as iOS)

**Fix Required**: Set `newArchEnabled=false` in `android/gradle.properties`

**Risk to iOS**: None (iOS config is separate)

---

### 🔴 **CRITICAL: Missing Android Build Configuration**

**Issue**: `eas.json` has no Android-specific build profiles

**Current State**:
```json
"production": {
  "ios": { ... },
  // No Android config!
}
```

**Impact**: Android builds may fail or use incorrect defaults

**Fix Required**: Add Android build profiles to `eas.json`:
- `development` profile with Android config
- `preview` profile with Android config  
- `production` profile with Android config

**Risk to iOS**: None (iOS configs remain unchanged)

---

### 🔴 **CRITICAL: Production Signing Configuration**

**Issue**: Release builds use debug keystore

**Current State** (`android/app/build.gradle`):
```gradle
release {
    signingConfig signingConfigs.debug  // ❌ Should be production keystore
}
```

**Impact**: Cannot publish to Google Play (requires production keystore)

**Fix Required**:
1. Generate production keystore OR let EAS manage it (recommended)
2. Configure EAS credentials: `eas credentials` → Android → Production
3. Update `build.gradle` to use production signing (or let EAS handle it)

**Risk to iOS**: None (iOS uses separate signing)

**Note**: EAS can manage Android keystores automatically - this is the recommended approach.

---

### 🟡 **MEDIUM: Missing Android-Specific Configurations**

#### a) Version Code Management
- **Issue**: `android/app/build.gradle` has hardcoded `versionCode 1`
- **Impact**: Version code won't increment automatically
- **Fix**: Sync with iOS build number or use EAS `autoIncrement: true`
- **Risk**: Low (versioning issue, won't break app)

#### b) Adaptive Icon Foreground
- **Issue**: Commented out in `app.config.ts`: `// foregroundImage: "./assets/images/adaptive-icon.png"`
- **Impact**: Android launcher icon may not display properly
- **Fix**: Create adaptive icon foreground image (1024x1024px, transparent PNG)
- **Risk**: Low (cosmetic issue)

#### c) Runtime Permissions
- **Issue**: Permissions declared but may need runtime permission requests
- **Impact**: Android 13+ requires runtime permission for `READ_MEDIA_IMAGES`
- **Fix**: Add runtime permission requests where needed (camera, storage, contacts)
- **Risk**: Medium (may need code changes)

#### d) Deep Linking Verification
- **Issue**: Scheme `goodtimes://` configured, but Android intent filters need verification
- **Impact**: Deep links may not work on Android
- **Fix**: Verify intent filters in `AndroidManifest.xml` match iOS deep link setup
- **Risk**: Low (verification only)

---

### 🟡 **MEDIUM: Platform-Specific Code Adjustments**

#### 1. Date Picker Styling
- **Files**: `app/(onboarding)/about.tsx`, `app/(main)/settings.tsx`
- **Issue**: Uses iOS-specific `DateTimePicker` with `display="spinner"`
- **Impact**: Android may need different styling/behavior
- **Fix**: Test date picker on Android, adjust styling if needed
- **Risk**: Low (UI difference, won't break functionality)

#### 2. Keyboard Behavior
- **Files**: Multiple files with `Platform.OS === "ios" ? "padding" : undefined`
- **Issue**: Android may need `"height"` instead of `undefined`
- **Impact**: Keyboard may cover input fields on Android
- **Fix**: Test keyboard behavior, adjust to `"height"` if needed
- **Risk**: Low (UI adjustment)

#### 3. Audio Recording Settings
- **File**: `app/(main)/modals/entry-composer.tsx`
- **Issue**: `allowsRecordingIOS` and `playsInSilentModeIOS` are iOS-only props
- **Impact**: No functional impact (Android ignores iOS-only props)
- **Fix**: None needed (Android handles audio differently)
- **Risk**: None

#### 4. Apple Authentication Plugin
- **File**: `app.config.ts`
- **Issue**: `expo-apple-authentication` plugin is iOS-only
- **Impact**: No functional impact (plugin won't load on Android)
- **Fix**: Optional - conditionally include plugin, but not required
- **Risk**: None (plugin simply won't load on Android)

---

## Risk Assessment

### ✅ **Low Risk** (Won't Break iOS)
- Fixing New Architecture mismatch in `gradle.properties`
- Adding Android build profiles to `eas.json`
- Creating adaptive icon assets
- Verifying deep linking configuration
- Testing platform-specific UI differences

### ⚠️ **Medium Risk** (Requires Testing)
- Runtime permission handling changes
- Keyboard behavior adjustments
- Date picker styling differences
- Version code management

### 🔴 **Higher Risk** (Needs Careful Testing)
- Production keystore setup (if misconfigured, can break future updates)
- Version code management (must increment properly for Google Play)
- Any native module compatibility issues

### 🛡️ **Risk to iOS Build: LOW**
- All Android changes are isolated to:
  - `android/` directory (separate from `ios/`)
  - `eas.json` Android configs (iOS configs remain unchanged)
  - `app.config.ts` Android section (iOS section remains unchanged)
- No shared code changes required
- Can test Android builds independently

---

## Implementation Plan

### **Phase 1: Critical Configuration Fixes** (1-2 hours, Low Risk)

**Priority**: Must fix before any Android builds

1. **Fix New Architecture Mismatch**
   - File: `android/gradle.properties`
   - Change: `newArchEnabled=true` → `newArchEnabled=false`
   - Verify: Matches `app.config.ts` setting

2. **Add Android Build Profiles to EAS**
   - File: `eas.json`
   - Add Android configs to `development`, `preview`, and `production` profiles
   - Match iOS structure but with Android-specific settings
   - Use `autoIncrement: true` for version codes

3. **Sync Version Code**
   - File: `android/app/build.gradle`
   - Update `versionCode` to match iOS build number (5) or use EAS auto-increment
   - Ensure `versionName` matches `app.config.ts` version (1.2.0)

**Testing**: Run `eas build --profile development --platform android` to verify configuration

---

### **Phase 2: Credentials and Signing** (1 hour, Medium Risk)

**Priority**: Required for production builds

1. **Set Up EAS Credentials for Android**
   - Run: `eas credentials` → Select Android → Production
   - Choose: Let EAS manage keystore (recommended) OR upload your own
   - EAS will store keystore securely

2. **Verify Signing Configuration**
   - File: `android/app/build.gradle`
   - If using EAS-managed keystore: EAS handles signing automatically
   - If using own keystore: Update `signingConfigs` to use production keystore

**Testing**: Run `eas build --profile production --platform android` to verify signing

---

### **Phase 3: Android Assets** (1-2 hours, Low Risk)

**Priority**: Required for Google Play submission

1. **Create Adaptive Icon**
   - Size: 1024x1024px, transparent PNG
   - Foreground: App icon/logo
   - Background: Already set to `#000000` in config
   - File: Save as `assets/images/adaptive-icon.png`
   - Update: `app.config.ts` to uncomment `foregroundImage`

2. **Prepare Google Play Assets** (for later)
   - Feature graphic: 1024x500px
   - Screenshots: Phone (required), Tablet (if supporting tablets)
   - App icon: 512x512px (for Play Console)

**Note**: Can be done in parallel with other phases

---

### **Phase 4: Platform-Specific Code Testing** (2-4 hours, Medium Risk)

**Priority**: Ensure all features work on Android

1. **Test Date Picker**
   - Files: `app/(onboarding)/about.tsx`, `app/(main)/settings.tsx`
   - Verify: Date picker displays and works correctly
   - Adjust: Styling if needed for Android

2. **Test Keyboard Behavior**
   - Files: All files with `KeyboardAvoidingView`
   - Verify: Keyboard doesn't cover input fields
   - Adjust: Change `undefined` to `"height"` if needed

3. **Test Runtime Permissions**
   - Verify: Camera, storage, contacts permissions request correctly
   - Test: On Android 13+ for `READ_MEDIA_IMAGES` permission
   - Add: Runtime permission requests if missing

4. **Test Deep Linking**
   - Verify: `goodtimes://` scheme works on Android
   - Test: Group join links open app correctly
   - Verify: Intent filters in `AndroidManifest.xml`

5. **Test All Features**
   - Authentication (Email, Google OAuth)
   - Biometric login (Fingerprint/Face unlock)
   - Entry creation (text, photos, videos, voice memos)
   - Media playback (audio, video, embedded music)
   - Push notifications
   - Group switching
   - History view

**Testing**: Use physical Android device (recommended) or emulator

---

### **Phase 5: Build and Test** (2-3 hours, Low Risk)

**Priority**: Verify Android build works end-to-end

1. **Development Build**
   - Command: `eas build --profile development --platform android`
   - Install: On Android device/emulator
   - Test: All features work correctly

2. **Preview Build** (Optional)
   - Command: `eas build --profile preview --platform android`
   - Distribute: To testers via EAS internal distribution
   - Collect: Feedback on Android-specific issues

3. **Production Build**
   - Command: `eas build --profile production --platform android`
   - Verify: AAB file is generated correctly
   - Check: Version code increments properly

---

### **Phase 6: Google Play Console Setup** (2-3 hours, Low Risk)

**Priority**: Required for publishing

1. **Create Google Play Developer Account**
   - Cost: $25 one-time fee
   - Setup: Complete developer profile

2. **Create App Listing**
   - App name: "Good Times"
   - Description: Match iOS App Store description
   - Category: Social/Productivity
   - Content rating: Complete questionnaire
   - Privacy policy: Required URL

3. **Upload Assets**
   - Feature graphic: 1024x500px
   - Screenshots: Phone screenshots (required)
   - App icon: 512x512px
   - Adaptive icon: Already configured in app

4. **Configure App Details**
   - Package name: `com.goodtimes.app` (must match `app.config.ts`)
   - Version: 1.2.0 (must match `app.config.ts`)
   - Target audience: Same as iOS
   - Content rating: Complete questionnaire

---

### **Phase 7: Submit to Google Play** (1 hour, Low Risk)

**Priority**: Final step

1. **Upload AAB**
   - Command: `eas submit --platform android --latest`
   - OR: Upload manually via Google Play Console
   - Verify: AAB uploads successfully

2. **Complete Store Listing**
   - Fill: All required fields
   - Upload: Screenshots and assets
   - Set: Pricing (Free)

3. **Submit for Review**
   - Review: All information is correct
   - Submit: For Google Play review
   - Wait: Typically 1-3 days for review

---

## Files That Need Changes

### **Must Change** (Critical)
1. `android/gradle.properties` - Fix New Architecture setting
2. `eas.json` - Add Android build profiles
3. `android/app/build.gradle` - Update version code (or use EAS auto-increment)

### **Should Change** (Important)
4. `app.config.ts` - Uncomment adaptive icon foreground image
5. `assets/images/adaptive-icon.png` - Create if doesn't exist

### **May Need Changes** (Testing Dependent)
6. Files with `KeyboardAvoidingView` - May need Android-specific behavior
7. Date picker files - May need Android-specific styling
8. Permission request code - May need runtime permission handling

### **No Changes Needed** (Already Working)
- Google OAuth implementation ✅
- All Expo modules ✅
- Core app logic ✅
- Supabase integration ✅

---

## Testing Checklist

### **Before First Android Build**
- [ ] New Architecture disabled in `gradle.properties`
- [ ] Android build profiles added to `eas.json`
- [ ] Version code synced with iOS

### **After Development Build**
- [ ] App installs and launches
- [ ] Authentication works (Email, Google OAuth)
- [ ] Biometric login works (Fingerprint/Face)
- [ ] Entry creation works (all media types)
- [ ] Media playback works (audio, video, music)
- [ ] Push notifications work
- [ ] Group switching works
- [ ] History view works
- [ ] Deep linking works
- [ ] Permissions request correctly

### **Before Production Build**
- [ ] EAS credentials configured for Android
- [ ] Production keystore set up (or EAS-managed)
- [ ] Adaptive icon created and configured
- [ ] All features tested on physical device
- [ ] Version code increments correctly

### **Before Google Play Submission**
- [ ] Google Play Console account created
- [ ] App listing created with all required info
- [ ] Screenshots and assets uploaded
- [ ] Privacy policy URL added
- [ ] Content rating completed
- [ ] Production AAB built successfully

---

## What You Need to Provide

### **Required**
1. **Google Play Developer Account**
   - Cost: $25 one-time
   - Setup: Complete developer profile

2. **Adaptive Icon Asset**
   - Size: 1024x1024px, transparent PNG
   - Content: App icon/logo (foreground only, background is black)

3. **Google Play Assets** (for store listing)
   - Feature graphic: 1024x500px
   - Screenshots: Phone screenshots (minimum 2, recommended 4-8)
   - App icon: 512x512px (for Play Console)

4. **Privacy Policy URL**
   - Required for Google Play submission
   - Must be publicly accessible

### **Optional** (Can Use EAS)
- Production keystore (EAS can manage this automatically)
- Testing devices (can use Android emulator)

---

## Important Notes

### **Version Management**
- iOS and Android versions should stay in sync
- Current version: `1.2.0` (in `app.config.ts`)
- iOS build number: `5` (in `app.config.ts`)
- Android version code: Should match iOS build number or use EAS auto-increment

### **Build Commands**
```bash
# Development build
eas build --profile development --platform android

# Production build
eas build --profile production --platform android

# Submit to Google Play
eas submit --platform android --latest
```

### **Testing Commands**
```bash
# Run on Android emulator (if set up locally)
npx expo run:android

# Start dev server
npx expo start --dev-client
```

### **EAS Credentials**
- Run `eas credentials` to manage Android signing
- Recommended: Let EAS manage keystore automatically
- EAS stores keystores securely in the cloud

---

## Common Issues & Solutions

### **Issue: Build Fails with New Architecture Error**
- **Cause**: `gradle.properties` has `newArchEnabled=true`
- **Fix**: Set to `false` to match `app.config.ts`

### **Issue: Version Code Conflict**
- **Cause**: Version code not incrementing
- **Fix**: Use `autoIncrement: true` in `eas.json` or manually increment

### **Issue: Signing Error**
- **Cause**: Production keystore not configured
- **Fix**: Run `eas credentials` → Android → Production

### **Issue: Permissions Not Requested**
- **Cause**: Runtime permissions not implemented
- **Fix**: Add permission requests using `expo-image-picker` and `expo-camera` APIs

### **Issue: Deep Links Don't Work**
- **Cause**: Intent filters missing or incorrect
- **Fix**: Verify `AndroidManifest.xml` has correct intent filters

---

## Success Criteria

### **Phase 1 Complete When:**
- ✅ Android development build succeeds
- ✅ App installs and launches on Android device
- ✅ No New Architecture errors

### **Phase 2 Complete When:**
- ✅ Production build succeeds
- ✅ AAB file generated correctly
- ✅ Signing configured properly

### **Phase 3 Complete When:**
- ✅ Adaptive icon displays correctly
- ✅ All assets prepared for Google Play

### **Phase 4 Complete When:**
- ✅ All features work on Android
- ✅ No platform-specific bugs
- ✅ UI looks correct on Android

### **Phase 5 Complete When:**
- ✅ Production AAB built successfully
- ✅ Ready for Google Play submission

### **Phase 6 Complete When:**
- ✅ Google Play Console listing created
- ✅ All required information filled in
- ✅ Assets uploaded

### **Phase 7 Complete When:**
- ✅ App submitted to Google Play
- ✅ Under review or published

---

## Estimated Timeline

- **Phase 1** (Configuration): 1-2 hours
- **Phase 2** (Credentials): 1 hour
- **Phase 3** (Assets): 1-2 hours (can be parallel)
- **Phase 4** (Testing): 2-4 hours
- **Phase 5** (Builds): 2-3 hours (includes build wait times)
- **Phase 6** (Play Console): 2-3 hours
- **Phase 7** (Submission): 1 hour

**Total Active Work**: ~10-16 hours
**Total Calendar Time**: ~1-2 weeks (includes build wait times and testing)

---

## References

- **iOS Context**: See `AGENT_CONTEXT.md` for full iOS setup and architecture
- **EAS Docs**: https://docs.expo.dev/build/introduction/
- **Google Play Console**: https://play.google.com/console
- **Android Gradle**: https://developer.android.com/studio/build
- **Expo Android Config**: https://docs.expo.dev/guides/config-plugins/

---

## Final Notes

- **iOS Stability**: All Android changes are isolated and won't affect iOS builds
- **Risk Level**: Low to Medium (most changes are configuration-only)
- **Testing**: Use physical Android device for best results
- **Support**: EAS handles most complexity (keystores, signing, builds)

**Status**: Ready to proceed with Android implementation. Start with Phase 1 (Critical Configuration Fixes) and work through phases sequentially.

---

**Last Updated**: Based on codebase review as of latest commit  
**Android Readiness**: ~70%  
**Estimated Completion**: 1-2 weeks with focused effort

