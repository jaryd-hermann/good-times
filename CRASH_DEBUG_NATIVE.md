# Native Crash Debugging

## Issue
App crashes immediately on launch, even with latest commit. Icon also not updating.

## Possible Causes

### 1. Native Module Initialization Crash
- Happens before React renders
- ErrorBoundary cannot catch it
- Usually related to:
  - Missing native dependencies
  - Incorrect native module configuration
  - Missing permissions in Info.plist

### 2. Build Not Using Latest Commit
- Check build logs for git commit hash
- Should be `ca1722d` or later
- Icon not updating suggests old build

### 3. Environment Variables Not Injected
- Even with EAS secrets set, they might not be injected
- Check build logs for env var injection
- Look for: "Injecting environment variables"

### 4. Asset Caching
- Icon might be cached by iOS
- Try deleting app and reinstalling
- Or increment build number

## Next Steps

1. **Verify Build Commit:**
   - Check Expo dashboard → Builds → Latest build
   - Look for "Git commit" in build logs
   - Should show `ca1722d`

2. **Check Build Logs:**
   - Look for any errors during:
     - Native module linking
     - Asset bundling
     - Environment variable injection

3. **Test Locally First:**
   ```bash
   npx expo run:ios
   ```
   - If it works locally, issue is with EAS build
   - If it crashes locally, issue is in code

4. **Increment Build Number:**
   - Change `buildNumber: "4"` to `buildNumber: "5"`
   - Forces iOS to treat it as new app version
   - May fix icon caching issue

5. **Check Native Logs:**
   - Connect device to Xcode
   - View device logs for crash details
   - Look for native stack traces

## Files Fixed

- ✅ `app/_layout.tsx` - Safe Supabase import
- ✅ `components/AuthProvider.tsx` - Safe Supabase import  
- ✅ `app/index.tsx` - Safe Supabase import
- ✅ `lib/supabase.ts` - Defensive initialization

All latest fixes are in commit `ca1722d`.

