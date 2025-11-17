# EAS Build for TestFlight - Step by Step

## Prerequisites ✅
- ✅ EAS CLI installed (v16.27.0)
- ✅ Logged in as: jarydhermann
- ✅ eas.json configured
- ✅ app.config.ts set up

## Build Process

### Step 1: Start the Build
```bash
npx eas build --platform ios --profile production
```

### Step 2: Credentials Setup (if prompted)
EAS will ask about credentials:
- **Choose:** "Set up credentials with EAS" (recommended)
- EAS will automatically manage your certificates and provisioning profiles

### Step 3: Wait for Build
- Build takes 15-30 minutes
- You'll get a URL to track progress
- You'll receive an email when complete

### Step 4: Submit to TestFlight (after build completes)
```bash
npx eas submit --platform ios --latest
```

Or manually:
1. Download the `.ipa` from EAS dashboard
2. Upload to App Store Connect via Transporter app
3. Process in App Store Connect → TestFlight

## Important Notes

1. **New Architecture:** Currently disabled in `app.config.ts`. EAS Build will handle compatibility automatically.

2. **Reanimated:** EAS Build will use the correct version for your Expo SDK.

3. **Version:** Make sure `version` in `app.config.ts` matches what you want in TestFlight.

4. **Bundle ID:** `com.jarydhermann.goodtimes` - make sure this matches your Apple Developer account.

## Troubleshooting

If build fails:
- Check the build logs in EAS dashboard
- Common issues:
  - Missing Apple Developer account setup
  - Certificate/provisioning profile issues (EAS handles this automatically)
  - Code signing errors

## Next Steps After Build

1. Build completes → Download `.ipa`
2. Submit to TestFlight (via EAS submit or manually)
3. Wait for processing (5-10 minutes)
4. Add testers in App Store Connect → TestFlight
5. Testers receive email invitation

