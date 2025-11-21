# EAS Build Workflow: Do You Need to Commit?

## Short Answer

**It depends on how EAS is configured, but typically: YES, you should commit and push.**

## How EAS Build Works

EAS Build can work in two ways:

### Option 1: Build from Git Repository (Most Common)
- EAS clones your git repository
- Builds from the committed code
- **Requires:** Commit + Push before building

### Option 2: Build from Local Files
- EAS uploads your local project files
- Builds from what's on your machine
- **Doesn't require:** Commit + Push

## How to Check Your Setup

When you run `npx eas build`, EAS will:
1. Check if you have a git remote configured
2. If yes → Build from git (requires commit + push)
3. If no → Build from local files (no commit needed)

## Best Practice: Always Commit + Push

**Recommended workflow:**

```bash
# 1. Make changes
# Edit app.config.ts, update buildNumber to "2"

# 2. Commit changes
git add app.config.ts
git commit -m "Bump build number to 2"

# 3. Push to repository
git push

# 4. Build with EAS
npx eas build --platform ios --profile production
```

## Why Commit + Push?

✅ **Version control** - Track what was built
✅ **Reproducibility** - Can rebuild exact same version
✅ **Team collaboration** - Others know what's being built
✅ **Debugging** - Easy to see what code was in each build
✅ **EAS default** - EAS prefers git-based builds

## Quick Check

Run this to see if EAS will use git:

```bash
git remote -v
```

If you see a remote URL, EAS will build from git (need commit + push).
If no remote, EAS will build from local files.

## Recommendation

**Always commit and push before building** - it's the safest, most reliable approach and ensures your builds are reproducible.

