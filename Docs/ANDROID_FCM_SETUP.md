# Android FCM (Firebase Cloud Messaging) Setup Guide

**Purpose**: Enable push notifications for Android production builds  
**When to do this**: Before your first production build that needs push notifications  
**Estimated time**: 15-30 minutes

---

## Overview

### What is FCM?
- **FCM** = Firebase Cloud Messaging
- Google's service for sending push notifications to Android devices
- Required for production Android builds to send push notifications

### What is an FCM Key?
- A **Google Service Account Key** (JSON file)
- Grants your app permission to send push notifications through Firebase
- Uploaded to EAS and used during production builds

### Why Do I Need This?
- **Development builds**: Push notifications work without FCM (uses Expo's push service)
- **Production builds**: Require FCM credentials to send push notifications
- **Without FCM**: You'll see `FirebaseApp is not initialized` errors in production

---

## Prerequisites

Before starting, make sure you have:
- ✅ Google account (same one used for Google Play Console)
- ✅ Firebase account (can create during setup)
- ✅ EAS account set up (`eas login`)
- ✅ Android app already created in Google Play Console
- ✅ Package name: `com.goodtimes.app` (must match Firebase)

---

## Step-by-Step Setup

### Step 1: Create Firebase Project

1. **Go to Firebase Console**
   - URL: https://console.firebase.google.com/
   - Sign in with your Google account

2. **Create New Project**
   - Click **"Add project"** or **"Create a project"**
   - **Project name**: `Good Times` (or your preferred name)
   - **Google Analytics**: Enable (recommended) or disable
   - Click **"Create project"**
   - Wait for project creation (30-60 seconds)

3. **Complete Setup**
   - Click **"Continue"** when project is ready

---

### Step 2: Add Android App to Firebase

1. **Add Android App**
   - In Firebase Console, click the **Android icon** (or **"Add app"** → **Android**)
   - Or go to: **Project Settings** → **Your apps** → **Add app** → **Android**

2. **Register App**
   - **Android package name**: `com.goodtimes.app`
     - ⚠️ **CRITICAL**: Must match exactly with `app.config.ts` line 52
   - **App nickname** (optional): `Good Times`
   - **Debug signing certificate SHA-1** (optional): Skip for now
   - Click **"Register app"**

3. **Download `google-services.json`**
   - Firebase will generate a `google-services.json` file
   - **DO NOT download it yet** - Expo handles this automatically
   - Click **"Next"** → **"Next"** → **"Continue to console"**

---

### Step 3: Verify Cloud Messaging API is Enabled

**Note**: You don't need to create a new service account - Firebase already created one for you (`firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com`). Just verify the API is enabled.

1. **Check in Firebase Console**
   - Go to Firebase Console: https://console.firebase.google.com/
   - Select your project
   - Click **⚙️ Settings** (gear icon) → **Project settings**
   - Click the **"Cloud Messaging"** tab

2. **Verify API Status**
   - Look for **"Firebase Cloud Messaging API (V1)"** - should say **"Enabled"** ✅
   - **"Cloud Messaging API (Legacy)"** may say "Disabled" - that's fine, it's deprecated
   - ✅ **You need V1 enabled** (which you have!) - proceed to Step 4

3. **If V1 is Disabled** (unlikely)
   - Go to: https://console.cloud.google.com/apis/library/fcm.googleapis.com
   - **Important**: Make sure your Firebase project is selected in the top dropdown
   - Click **"Enable"** if needed

4. **If You See a "Create Service Account" Form**
   - ⚠️ **Close it** - you don't need to create a new service account
   - Firebase already created one automatically (`firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com`)

---

### Step 4: Generate Google Service Account Key

1. **Go to Google Cloud Console**
   - URL: https://console.cloud.google.com/
   - Make sure you're in the **same project** as your Firebase project
   - If you see a project selector, choose your Firebase project

2. **Navigate to Service Accounts**
   - In the left sidebar, go to: **IAM & Admin** → **Service Accounts**
   - Or direct URL: https://console.cloud.google.com/iam-admin/serviceaccounts

3. **Find Firebase Service Account**
   - Look for a service account named: `firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com`
   - If you don't see it:
     - Go back to Firebase Console
     - **Project Settings** → **Service Accounts** tab
     - Click **"Generate new private key"** button
     - This will create the service account and download the key

4. **Generate Key**
   - Click on the Firebase service account (or click **"Generate new private key"** in Firebase)
   - Click **"Keys"** tab → **"Add Key"** → **"Create new key"**
   - Select **JSON** format
   - Click **"Create"**
   - **A JSON file will download** - this is your FCM key!

5. **Save the Key Securely**
   - The downloaded file will be named something like: `your-project-id-xxxxx.json`
   - **Keep this file safe** - you'll need it for EAS
   - ⚠️ **Never commit this file to git** (it's already in `.gitignore`)

---

### Step 5: Upload FCM Key to EAS

**Important**: You need to upload the same JSON file to TWO different sections:
1. **Push Notifications (FCM V1)** - for push notifications
2. **Submissions** - for Google Play Store uploads

1. **Run EAS Credentials Command**
   ```bash
   eas credentials
   ```

2. **Upload for FCM V1 Push Notifications**
   - Select: **Android**
   - Select: **production** (or the profile you want)
   - Select: **Push Notifications (FCM V1)** (NOT Legacy)
   - Choose: **"Upload a Google Service Account Key"**
   - Select the JSON file you downloaded in Step 4
   - EAS will upload and store it securely

3. **Upload for Google Play Submissions**
   - Still in `eas credentials`, go back to the main menu
   - Select: **Android** → **production**
   - Select: **Submissions: Google Service Account Key for Play Store Submissions**
   - Choose: **"Upload a Google Service Account Key"**
   - Select the **same JSON file** (yes, the same one!)
   - EAS will upload and store it securely

4. **Verify Upload**
   - You should see both:
     - ✅ **Push Notifications (FCM V1)**: Key assigned
     - ✅ **Submissions**: Key assigned

---

### Step 6: Verify Configuration

1. **Check EAS Credentials**
   ```bash
   eas credentials
   ```
   - Select: **Android** → **production** → **Push Notifications (FCM)**
   - You should see your FCM key listed

2. **Test Production Build** (Optional)
   ```bash
   eas build --profile production --platform android
   ```
   - The build should complete without FCM errors
   - Push notifications should work in the production build

---

## Verification Checklist

After completing setup, verify:

- [ ] Firebase project created
- [ ] Android app added to Firebase with package name `com.goodtimes.app`
- [ ] Cloud Messaging API enabled
- [ ] Google Service Account Key generated (JSON file downloaded)
- [ ] FCM key uploaded to EAS via `eas credentials`
- [ ] Production build completes without FCM errors

---

## Troubleshooting

### Error: "FirebaseApp is not initialized"
**Cause**: FCM credentials not configured  
**Solution**: Complete Steps 4-5 above

### Error: "Package name mismatch"
**Cause**: Package name in Firebase doesn't match `app.config.ts`  
**Solution**: 
- Verify Firebase package name is exactly `com.goodtimes.app`
- Or update `app.config.ts` to match Firebase (not recommended)

### Error: "Service account not found"
**Cause**: Service account wasn't created automatically  
**Solution**: 
- Go to Firebase Console → Project Settings → Service Accounts
- Click "Generate new private key"
- This creates the service account and downloads the key

### Error: "Cloud Messaging API not enabled"
**Cause**: FCM API not enabled in Google Cloud Console  
**Solution**: 
- Go to: https://console.cloud.google.com/apis/library/fcm.googleapis.com
- Select your Firebase project
- Click "Enable"

### Error: "Invalid JSON key"
**Cause**: Wrong file uploaded or corrupted file  
**Solution**: 
- Re-download the key from Firebase Console
- Make sure you're uploading the JSON file (not `google-services.json`)

---

## Important Notes

### Development vs Production
- **Development builds**: Don't need FCM - use Expo's push service
- **Production builds**: Require FCM credentials
- The error you see in dev builds is expected and harmless

### Security
- ⚠️ **Never commit** the FCM key JSON file to git
- ✅ It's already in `.gitignore` (pattern: `*.json` for keys)
- ✅ EAS stores the key securely in the cloud

### Package Name
- Must match exactly: `com.goodtimes.app`
- Check in:
  - Firebase Console (Android app registration)
  - `app.config.ts` line 52
  - Google Play Console (App identity)

### When to Set Up
- **Can do now**: If you want push notifications in production
- **Can do later**: Before first production build that needs notifications
- **Not urgent**: Development builds work fine without it

---

## Quick Reference

### Commands
```bash
# Set up FCM credentials
eas credentials
# Select: Android → production → Push Notifications (FCM)

# Verify credentials
eas credentials
# Select: Android → production → Push Notifications (FCM)

# Test production build
eas build --profile production --platform android
```

### Important URLs
- **Firebase Console**: https://console.firebase.google.com/
- **Google Cloud Console**: https://console.cloud.google.com/
- **FCM API**: https://console.cloud.google.com/apis/library/fcm.googleapis.com
- **Service Accounts**: https://console.cloud.google.com/iam-admin/serviceaccounts

### Key Files
- **FCM Key**: `your-project-id-xxxxx.json` (downloaded from Firebase)
- **App Config**: `app.config.ts` (package name: `com.goodtimes.app`)

---

## Next Steps After Setup

1. **Build Production App**
   ```bash
   eas build --profile production --platform android
   ```

2. **Test Push Notifications**
   - Install production build on Android device
   - Grant notification permissions
   - Verify notifications are received

3. **Submit to Google Play**
   ```bash
   eas submit --platform android --latest
   ```

---

## Additional Resources

- **Expo FCM Docs**: https://docs.expo.dev/push-notifications/fcm-credentials/
- **Firebase Console**: https://console.firebase.google.com/
- **EAS Credentials Docs**: https://docs.expo.dev/app-signing/managed-credentials/

---

**Status**: Ready to set up when needed  
**Last Updated**: Based on current Android setup  
**Related Docs**: `ANDROID_BUILD_PLAN.md`, `ANDROID_IMPLEMENTATION_PROPOSAL.md`

