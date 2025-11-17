# Submitting Build #3 to TestFlight

## Step 1: Cancel the Hanging Terminal Command

In your terminal where `eas build` is running:
1. Press `Ctrl+C` to cancel the hanging command
2. This won't affect your build - it's already complete!

## Step 2: Submit to TestFlight

Run this command (it will prompt you for Apple ID credentials):

```bash
eas submit --platform ios --latest
```

**OR** if you want to submit a specific build:

```bash
eas submit --platform ios --id <build-id>
```

You can find the build ID in the Expo dashboard URL or by running:
```bash
eas build:list --platform ios --limit 1
```

## Step 3: Authentication

When prompted:
- **Apple ID**: Your Apple Developer account email
- **Password**: Your Apple ID password (or app-specific password if 2FA enabled)
- **2FA Code**: If you have two-factor authentication enabled

## Alternative: Use App Store Connect API Key

If you have an App Store Connect API key set up (more secure, no prompts):

```bash
eas submit --platform ios --latest --non-interactive
```

To set up an API key:
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Users and Access → Keys → App Store Connect API
3. Create a new key
4. Add it to EAS: `eas credentials`

## Verify Submission

After submission:
1. Check Expo dashboard - submission status will show
2. Check App Store Connect - build will appear in TestFlight section
3. Processing usually takes 10-30 minutes

## Notes

- The terminal hanging doesn't affect the build - it's just waiting for status updates
- Build #3 is ready and can be submitted independently
- The "degraded performance" message is just about status updates, not build quality

