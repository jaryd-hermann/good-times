# Testing Photo Upload Fix

## What Was Fixed

1. **User Profile Photos** (`about.tsx` during onboarding)
   - Fixed: Photos are now properly detected as local files and uploaded to Supabase Storage before saving to database
   - Added robust local file URI detection that handles iOS simulator, Android, and production paths

2. **Memorial Photos** (`memorial-input.tsx` during onboarding)
   - Fixed: Memorial photos are now uploaded to storage before being saved to database
   - Applied to all memorial creation paths (onboarding, group settings)

## How to Test Locally (Without Store Build)

### Option 1: Expo Development Build (Recommended)
This is the closest to production and easiest to test:

```bash
# Build a development build for your device
eas build --profile development --platform ios
# or
eas build --profile development --platform android

# Install on your device via TestFlight (iOS) or direct APK (Android)
# Then run:
npx expo start --dev-client
```

### Option 2: iOS Simulator / Android Emulator
Works great for testing the fix:

```bash
# Start the development server
npx expo start

# Press 'i' for iOS simulator or 'a' for Android emulator
# Or scan QR code with Expo Go app
```

**Note**: Simulator uses local file paths (like `file:///...`), which is exactly what we're fixing. So simulator testing will verify the fix works!

### Option 3: Expo Go (Quick Test)
For quick testing on a physical device:

```bash
npx expo start
# Scan QR code with Expo Go app on your phone
```

**Limitation**: Expo Go may have some limitations with file system access, but should work for basic testing.

## Testing Steps

### Test 1: User Profile Photo During Onboarding

1. Start fresh (clear app data or use a new test account)
2. Go through onboarding flow:
   - Welcome screens
   - About screen (`/(onboarding)/about`)
3. **On the "About You" screen:**
   - Tap "Add a photo of yourself"
   - Select a photo from your library
   - Verify photo appears in the preview
   - Continue to auth screen
4. **Sign up** with email/password
5. **After onboarding completes:**
   - Check the database: `users` table, `avatar_url` column should have an HTTPS URL (not NULL, not a local file path)
   - Check Supabase Storage: `avatars` bucket should have the uploaded file
   - In the app: Profile photo should display correctly

**What to look for in logs:**
```
[persistOnboarding] Processing user photo: { hasPhoto: true, ... }
[persistOnboarding] 📤 Uploading avatar from local file...
[persistOnboarding] ✅ Avatar uploaded successfully: https://...
[persistOnboarding] ✅ Avatar URL saved to database
```

### Test 2: Memorial Photo During Onboarding

1. Start fresh onboarding flow
2. When prompted to add memorials:
   - Enter a name
   - Add a photo
   - Continue through flow
3. **After onboarding completes:**
   - Check database: `memorials` table, `photo_url` column should have HTTPS URL
   - Check Supabase Storage: `avatars` bucket (memorials use same bucket)
   - In app: Memorial photo should display

**What to look for in logs:**
```
[persistOnboarding] Uploading memorial photo for [name]...
[persistOnboarding] ✅ Memorial photo uploaded: https://...
```

### Test 3: Verify Database Values

After completing onboarding, check your Supabase database:

```sql
-- Check user avatar
SELECT id, name, avatar_url FROM users WHERE email = 'your-test-email@example.com';

-- Should show HTTPS URL like:
-- https://[project].supabase.co/storage/v1/object/public/avatars/[userId]/[filename].jpg
-- NOT NULL, NOT a file:// path

-- Check memorial photos
SELECT id, name, photo_url FROM memorials WHERE user_id = '[your-user-id]';

-- Should show HTTPS URLs, not NULL or file:// paths
```

### Test 4: Error Handling

To test error handling (optional):
1. Temporarily break your Supabase storage permissions
2. Try uploading a photo
3. Should see error alert but onboarding continues
4. Photo should be NULL in database (graceful failure)

## Debugging

If photos still aren't saving:

1. **Check console logs** for:
   - `[persistOnboarding] Processing user photo` - confirms photo is being processed
   - `isLocalFile: true/false` - confirms detection is working
   - Any error messages

2. **Check Supabase Storage permissions:**
   - `avatars` bucket should exist
   - Storage policies should allow authenticated uploads

3. **Verify file URI format:**
   - Log the actual URI: `console.log("Photo URI:", data.userPhoto)`
   - Should start with `file://` or `/` (local path)
   - If it's already HTTPS, something else is wrong

4. **Check network connectivity:**
   - Upload requires internet connection
   - Simulator/emulator needs network access

## Quick Verification Checklist

- [ ] User profile photo appears in app after onboarding
- [ ] Database `users.avatar_url` has HTTPS URL (not NULL)
- [ ] Supabase Storage `avatars` bucket has the file
- [ ] Memorial photos appear in app
- [ ] Database `memorials.photo_url` has HTTPS URLs (not NULL)
- [ ] Console logs show successful upload messages
- [ ] No errors in console during onboarding

## Production Testing

Once verified locally, you can test in production:

1. Build a production build: `eas build --platform ios --profile production`
2. Submit to TestFlight (iOS) or Internal Testing (Android)
3. Test with a real account on a real device
4. Monitor Supabase logs and database for any issues

The fix should work identically in production since it handles all common local file URI formats.

