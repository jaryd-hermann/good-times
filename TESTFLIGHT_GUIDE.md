# TestFlight Submission Guide for Good Times

This guide will walk you through submitting your app to TestFlight for beta testing.

## Prerequisites Checklist

- ✅ Expo account (you have this)
- ✅ Apple Developer account (you have this)
- ✅ EAS project configured (`ccd4fdb7-0126-46d1-a518-5839fae48a76`)
- ✅ Bundle identifier set: `com.jarydhermann.goodtimes`

## Step 1: Install EAS CLI

If you haven't already, install the EAS CLI globally:

```bash
npm install -g eas-cli
```

## Step 2: Login to Expo

```bash
eas login
```

Enter your Expo account credentials.

## Step 3: Configure Apple Developer Account

### 3a. Link Your Apple Developer Account

```bash
eas credentials
```

Select:
1. **iOS** platform
2. **production** profile (or create a new one)
3. Choose **"Set up credentials"** or **"Manage credentials"**

### 3b. Apple Developer Account Setup

EAS will guide you through:
1. **Apple Team ID**: Found in [Apple Developer Portal](https://developer.apple.com/account) → Membership → Team ID
2. **App Store Connect API Key** (recommended) OR **Apple ID credentials**:
   - **Option A (Recommended)**: Create an App Store Connect API key:
     - Go to [App Store Connect](https://appstoreconnect.apple.com) → Users and Access → Keys
     - Click "+" to create a new key
     - Download the `.p8` key file
     - Note the Key ID and Issuer ID
     - Provide these to EAS when prompted
   - **Option B**: Use your Apple ID (less secure, requires 2FA)

### 3c. Register Bundle Identifier

EAS will automatically register `com.jarydhermann.goodtimes` with Apple if it doesn't exist.

## Step 4: Verify Environment Variables

**IMPORTANT**: Make sure your `.env` file has production values:

```bash
# Check your .env file exists and has:
EXPO_PUBLIC_SUPABASE_URL=your_production_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_production_supabase_anon_key
```

**Note**: EAS Build will automatically use these environment variables during the build process. Make sure they're set correctly for production!

## Step 5: Update App Configuration (if needed)

Your `app.config.ts` looks good, but verify:

- ✅ Bundle identifier: `com.jarydhermann.goodtimes`
- ✅ Version: `1.0.0` (update this for each new build)
- ✅ App name: "Good Times"
- ✅ EAS project ID is set
- ✅ Icon exists: `./assets/images/icon.png`

**Optional**: Update version number before building:

```bash
# In app.config.ts, change version to:
version: "1.0.1",  // Increment for each new build
```

## Step 6: Build for iOS (TestFlight)

### 6a. Build the App

```bash
eas build --platform ios --profile production
```

**What happens:**
- EAS uploads your code to their servers
- Builds a production iOS app
- Takes 15-30 minutes
- You'll get a build URL to track progress

**Note**: The first build may take longer as it sets up certificates and provisioning profiles.

### 6b. Alternative: Build Locally (faster, but requires Xcode)

If you have Xcode installed and want faster builds:

```bash
eas build --platform ios --profile production --local
```

## Step 7: Submit to TestFlight

Once the build completes, submit it to TestFlight:

```bash
eas submit --platform ios --latest
```

**What happens:**
- EAS uploads your build to App Store Connect
- Apple processes the build (can take 10-60 minutes)
- You'll receive an email when processing is complete

## Step 8: Configure TestFlight in App Store Connect

### 8a. Access App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Sign in with your Apple Developer account
3. Click **"My Apps"**

### 8b. Create App Record (if first time)

If this is your first submission:

1. Click **"+"** → **"New App"**
2. Fill in:
   - **Platform**: iOS
   - **Name**: Good Times
   - **Primary Language**: English
   - **Bundle ID**: `com.jarydhermann.goodtimes` (should be pre-selected)
   - **SKU**: `good-times-001` (any unique identifier)
   - **User Access**: Full Access
3. Click **"Create"**

### 8c. Add TestFlight Information

1. In your app, go to **"TestFlight"** tab
2. Once your build is processed, you'll see it under **"iOS Builds"**
3. Click **"Add to TestFlight"** or wait for it to appear automatically
4. Fill in **"What to Test"** (optional but recommended):
   ```
   This is a beta build of Good Times. Please test:
   - Creating groups and inviting members
   - Posting entries with photos, videos, and voice memos
   - Viewing history and switching between groups
   - Push notifications
   ```

### 8d. Add Internal Testers

1. Go to **"Internal Testing"** tab
2. Click **"+"** to add testers
3. Add yourself and team members (up to 100 internal testers)
4. Select the build you want to test
5. Click **"Start Testing"**

### 8e. Add External Testers (Optional)

For external beta testers (up to 10,000):

1. Go to **"External Testing"** tab
2. Click **"+"** to create a new group
3. Name it (e.g., "Beta Testers")
4. Add the build
5. Fill in **"Beta App Information"**:
   - **What to Test**: Description of what to test
   - **Feedback Email**: Your email
   - **Marketing URL** (optional)
   - **Privacy Policy URL** (required for external testing)
6. Submit for Beta App Review (can take 24-48 hours)
7. Once approved, add testers via email addresses

## Step 9: Testers Install TestFlight

Testers need to:

1. Install **TestFlight** app from App Store (if not already installed)
2. Accept the email invitation (if external tester)
3. Open TestFlight app
4. Tap **"Accept"** on your app invitation
5. Tap **"Install"** to download the beta app

## Troubleshooting

### Build Fails

**Error: "No Apple Team ID found"**
```bash
eas credentials
# Select iOS → production → Set up credentials
# Enter your Apple Team ID
```

**Error: "Bundle identifier already exists"**
- This is normal if you've created it before
- EAS will use the existing one

**Error: "Invalid credentials"**
```bash
eas credentials
# Re-enter your Apple Developer credentials
```

### Submission Fails

**Error: "Build not found"**
- Wait a few minutes after build completes
- Check build status: `eas build:list`

**Error: "App record not found"**
- Create the app record in App Store Connect first (Step 7b)

### TestFlight Issues

**Build stuck in "Processing"**
- This is normal, can take 10-60 minutes
- Check App Store Connect for status updates

**Testers can't install**
- Ensure they have TestFlight app installed
- Check that build is approved for testing
- Verify tester email addresses are correct

## Updating Your App

For subsequent builds:

1. **Update version** in `app.config.ts`:
   ```typescript
   version: "1.0.2",  // Increment this
   ```

2. **Build again**:
   ```bash
   eas build --platform ios --profile production
   ```

3. **Submit**:
   ```bash
   eas submit --platform ios --latest
   ```

4. **Update TestFlight**: The new build will appear automatically in TestFlight

## Important Notes

- **Build Time**: First build takes 15-30 minutes, subsequent builds are faster
- **Processing Time**: Apple takes 10-60 minutes to process builds
- **External Testing**: Requires Beta App Review (24-48 hours) before testers can install
- **Internal Testing**: No review needed, instant access for up to 100 testers
- **Version Numbers**: Must increment for each new build submitted
- **Expiration**: TestFlight builds expire after 90 days

## Quick Reference Commands

```bash
# Login to Expo
eas login

# Configure credentials
eas credentials

# Build for iOS
eas build --platform ios --profile production

# Submit to TestFlight
eas submit --platform ios --latest

# Check build status
eas build:list

# View build logs
eas build:view [BUILD_ID]
```

## Next Steps After TestFlight

Once testing is complete:

1. Fix any bugs found during testing
2. Update version number
3. Build and submit again
4. When ready, submit for App Store Review:
   ```bash
   eas submit --platform ios --latest
   # Then complete App Store listing in App Store Connect
   ```

## Resources

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
- [TestFlight Documentation](https://developer.apple.com/testflight/)
- [App Store Connect](https://appstoreconnect.apple.com)

