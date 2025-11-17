# Fixed EAS Build Issue

## The Problem

EAS Build failed with:
```
'folly/coro/Coroutine.h' file not found
```

This happened because:
- Local patches to `ios/Pods/RCT-Folly/folly/Expected.h` and `Optional.h` don't get applied in EAS Build
- EAS Build regenerates the `Pods/` directory from scratch
- The preprocessor definition `FOLLY_HAS_COROUTINES=0` wasn't being applied correctly

## The Fix

I've updated `ios/Podfile` to:
1. **Set preprocessor definition** `FOLLY_HAS_COROUTINES=0` (Method 1)
2. **Directly patch header files** during `pod install` (Method 2 - more reliable)

The Podfile now automatically patches the header files during the EAS Build process.

## Next Steps

1. **Commit the Podfile change:**
   ```bash
   git add ios/Podfile
   git commit -m "Fix RCT-Folly coroutine issue for EAS Build"
   ```

2. **Push to your repo** (if using git):
   ```bash
   git push
   ```

3. **Start a new EAS Build:**
   ```bash
   npx eas build --platform ios --profile production
   ```

## What Changed

The `post_install` hook in `ios/Podfile` now:
- Sets `FOLLY_HAS_COROUTINES=0` in build settings
- **Directly patches** `Expected.h` and `Optional.h` files
- Works in both local builds and EAS Build

This ensures the fix is applied during the EAS Build process, not just locally.

## Verify

After the build starts, check the build logs. You should see:
```
✅ Patched /path/to/RCT-Folly/folly/Expected.h
✅ Patched /path/to/RCT-Folly/folly/Optional.h
```

This confirms the patches are being applied during the build.

