# Build Number Auto-Increment Explanation

## How It Works

When you have `autoIncrement: true` in `eas.json`:

1. **EAS checks** the last build number from:
   - Previous EAS builds for this app
   - App Store Connect (if you've submitted before)
   - Your `app.config.ts` (if no previous builds exist)

2. **EAS increments** the build number during the build process

3. **The number shown** in the Expo dashboard during build might be:
   - The **starting** number (from `app.config.ts`)
   - The **final** number (after increment)

## Why You're Seeing "1" for Both Builds

**Possible reasons:**

1. **First builds** - EAS starts from `app.config.ts` value ("1")
2. **Not synced** - EAS remote versioning needs to be initialized
3. **Build in progress** - The number shown might be the starting number, final number comes after build completes

## What to Do

### Option 1: Sync Version (Recommended)

```bash
# Sync your local version with EAS
npx eas build:version:sync

# This will update app.config.ts with the remote version
# Then future builds will auto-increment properly
```

### Option 2: Check After Build Completes

The build number shown **during** the build might be the starting number. Check the **completed** build to see if it was incremented.

### Option 3: Manual Control (Most Reliable)

For now, manually increment in `app.config.ts`:

```typescript
ios: {
  buildNumber: "2", // Change to 2, 3, 4, etc. for each build
}
```

This gives you full control and is more predictable.

## Recommendation

**For your current build:** Wait for it to complete, then check the final build number in the Expo dashboard.

**For future builds:** 
- If auto-increment works after this build completes → great!
- If not → use manual increment (more reliable)

The important thing is that **each TestFlight submission needs a unique, increasing build number** - whether it's auto or manual doesn't matter.

