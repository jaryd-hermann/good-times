# Build Number Auto-Increment Issue

## The Problem

EAS Build shows the same build number ("1") even with `autoIncrement: true` configured.

## How EAS Auto-Increment Works

EAS auto-increment works by:
1. Checking the **last build number** from App Store Connect or previous EAS builds
2. Incrementing from that number
3. If no previous build exists, it starts from `app.config.ts`

## Current Status

Looking at your builds:
- Build 1: `Build number: 1` (finished)
- Build 2: `Build number: 1` (in progress)

This suggests EAS isn't detecting the previous build number.

## Solutions

### Option 1: Sync Version with EAS (Recommended)

Tell EAS what the current version/build number should be:

```bash
npx eas build:version:set
```

This will:
- Prompt you for version (e.g., "1.0.0")
- Prompt you for build number (e.g., "1")
- Sync this to EAS servers
- Future builds will auto-increment from this

### Option 2: Manual Increment (More Control)

For each new build, manually update `app.config.ts`:

```typescript
ios: {
  buildNumber: "2", // Increment manually: 2, 3, 4, etc.
}
```

Then build:
```bash
npx eas build --platform ios --profile production
```

### Option 3: Use EAS Version Management

Set `appVersionSource` to `"remote"` (you already have this) and sync:

```bash
# Set initial version
npx eas build:version:set

# Then autoIncrement will work
```

## Why Auto-Increment Might Not Work

1. **First build** - EAS starts from `app.config.ts` value
2. **Not synced** - EAS doesn't know what the last build number was
3. **App Store Connect** - EAS checks App Store Connect for the last build number, but if you haven't submitted yet, it won't find it

## Recommendation

**For now:** Use manual increment until you've submitted your first build to TestFlight.

**After first TestFlight submission:** Auto-increment should work because EAS will read the build number from App Store Connect.

## Quick Fix

Update `app.config.ts` to increment manually:

```typescript
ios: {
  buildNumber: "2", // Change to 2, then 3, then 4, etc.
}
```

This gives you full control and is more predictable.

