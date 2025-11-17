# Version Control for TestFlight Builds

## Understanding iOS Version Numbers

iOS apps have **two** version numbers:

1. **Version** (`CFBundleShortVersionString`) - User-facing version
   - Format: `"1.0.0"`, `"1.1.0"`, `"2.0.0"`, etc.
   - This is what users see in the App Store
   - You can update this when you release new features

2. **Build Number** (`CFBundleVersion`) - Internal build identifier
   - Format: `"1"`, `"2"`, `"3"` or `"1.1.0.1"`, `"1.1.0.2"`, etc.
   - **Must increment** for each TestFlight submission
   - Apple requires this to be unique and increasing

## Current Configuration

In `app.config.ts`:
- `version: "1.0.0"` - User-facing version
- `ios.buildNumber: "1"` - Build number (will auto-increment with EAS)

In `eas.json`:
- `autoIncrement: true` - EAS will automatically increment buildNumber

## How to Update Versions

### Option 1: Manual Version Control (Recommended for Releases)

**For a new feature release (e.g., v1.1.0):**

1. Update `version` in `app.config.ts`:
   ```typescript
   version: "1.1.0",
   ios: {
     buildNumber: "1", // Reset to 1 for new version
   }
   ```

2. Build and submit:
   ```bash
   npx eas build --platform ios --profile production
   npx eas submit --platform ios --latest
   ```

**For a patch/hotfix (e.g., v1.1.1):**

1. Update `version` in `app.config.ts`:
   ```typescript
   version: "1.1.1",
   ios: {
     buildNumber: "1", // Reset to 1 for new version
   }
   ```

2. Build and submit

**For multiple builds of the same version (e.g., v1.1.0 build 2, 3, 4):**

1. Keep `version` the same:
   ```typescript
   version: "1.1.0",
   ios: {
     buildNumber: "2", // Increment manually: 2, 3, 4, etc.
   }
   ```

2. Build and submit

### Option 2: Automatic Build Number Increment (Easier for Testing)

With `autoIncrement: true` in `eas.json`:

1. **First build of v1.1.0:**
   ```typescript
   version: "1.1.0",
   ios: {
     buildNumber: "1", // EAS will increment to 2, 3, 4... automatically
   }
   ```

2. Build:
   ```bash
   npx eas build --platform ios --profile production
   ```
   - EAS automatically increments buildNumber to "2", "3", "4", etc.

3. Submit:
   ```bash
   npx eas submit --platform ios --latest
   ```

## Version Numbering Best Practices

### Semantic Versioning (Recommended)
- **Major** (1.0.0 → 2.0.0): Breaking changes
- **Minor** (1.0.0 → 1.1.0): New features, backward compatible
- **Patch** (1.0.0 → 1.0.1): Bug fixes

### Build Number Formats

**Simple incrementing:**
- `"1"`, `"2"`, `"3"`, `"4"`...

**Version-based:**
- `"1.0.0.1"`, `"1.0.0.2"`, `"1.0.0.3"`...
- `"1.1.0.1"`, `"1.1.0.2"`, `"1.1.0.3"`...

**Date-based:**
- `"20241116"` (YYYYMMDD)
- `"2024111601"` (YYYYMMDD + build number)

## Example Workflow

### Release v1.1.0

1. **Update app.config.ts:**
   ```typescript
   version: "1.1.0",
   ios: {
     buildNumber: "1",
   }
   ```

2. **Commit:**
   ```bash
   git add app.config.ts
   git commit -m "Bump version to 1.1.0"
   git push
   ```

3. **Build:**
   ```bash
   npx eas build --platform ios --profile production
   ```

4. **Submit:**
   ```bash
   npx eas submit --platform ios --latest
   ```

### Hotfix v1.1.1 (same day)

1. **Update app.config.ts:**
   ```typescript
   version: "1.1.1",
   ios: {
     buildNumber: "1",
   }
   ```

2. **Build and submit** (same as above)

### Multiple TestFlight builds of v1.1.0

1. **Keep version same, increment buildNumber:**
   ```typescript
   version: "1.1.0",
   ios: {
     buildNumber: "2", // Then 3, 4, etc.
   }
   ```

   OR use `autoIncrement: true` and let EAS handle it!

## Checking Current Version

After building, check your version in:
- **EAS Dashboard:** https://expo.dev/accounts/jarydhermann/projects/good-times/builds
- **App Store Connect:** TestFlight → Builds
- **In the app:** `expo-constants` can read version at runtime

## Important Notes

⚠️ **Build numbers must always increase** - Apple rejects builds with the same or lower build number

⚠️ **Version can stay the same** - You can submit multiple builds with the same version but different build numbers

✅ **EAS autoIncrement** - Makes it easier, but you still need to manage `version` manually for releases

## Quick Reference

```typescript
// app.config.ts
version: "1.1.0",        // User-facing version
ios: {
  buildNumber: "1",     // Build number (increments per submission)
}
```

```json
// eas.json
{
  "build": {
    "production": {
      "autoIncrement": true  // Auto-increment buildNumber
    }
  }
}
```

