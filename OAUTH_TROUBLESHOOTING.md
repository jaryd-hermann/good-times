# OAuth Troubleshooting Guide

## Apple OAuth: "Unable to exchange external code"

This error indicates a Supabase server-side configuration issue with Apple OAuth.

### Common Causes

1. **Redirect URL mismatch**
   - Apple requires the redirect URL to match exactly what's configured
   - Your app uses: `goodtimes://`
   - Make sure this is configured in both:
     - Supabase Dashboard → Authentication → URL Configuration → Redirect URLs
     - Apple Developer Portal → Services IDs → Your Service ID → Return URLs

2. **Apple OAuth credentials incorrect**
   - Go to Supabase Dashboard → Authentication → Providers → Apple
   - Verify:
     - **Service ID** matches your Apple Developer Portal Service ID
     - **Team ID** is correct (found in Apple Developer Portal)
     - **Key ID** matches your OAuth key
     - **Private Key** is the correct .p8 file content

3. **Apple Developer Portal configuration**
   - Go to https://developer.apple.com/account/resources/identifiers/list/serviceId
   - Select your Service ID
   - Under "Sign in with Apple", ensure:
     - Primary App ID is set correctly
     - **Return URLs** must include: `https://ytnnsykbgohiscfgomfe.supabase.co/auth/v1/callback`
       - ⚠️ **Important**: Apple requires HTTPS URLs, NOT custom schemes like `goodtimes://`
       - This is the Supabase callback URL that processes OAuth before redirecting to your app
     - Domains and Subdomains includes: `ytnnsykbgohiscfgomfe.supabase.co`

### How to Fix

1. **Configure Apple Developer Portal Return URL**:
   - Go to Apple Developer Portal → Services IDs → Your Service ID
   - Under "Sign in with Apple" → "Return URLs"
   - Add: `https://ytnnsykbgohiscfgomfe.supabase.co/auth/v1/callback`
   - ⚠️ **This must be HTTPS** - Apple doesn't accept custom URL schemes here
   - This is where Apple redirects after authentication, then Supabase redirects to your app

2. **Verify Supabase Redirect URL**:
   - Go to Supabase Dashboard → Authentication → URL Configuration
   - Under "Redirect URLs", ensure `goodtimes://` is listed
   - This is where Supabase redirects AFTER processing OAuth (different from Apple's return URL)

2. **Check Apple Service ID**:
   - In Apple Developer Portal, verify your Service ID is active
   - Check that Return URLs includes `goodtimes://`
   - Make sure the Service ID matches what's in Supabase

3. **Regenerate Apple OAuth Key** (if needed):
   - Go to Apple Developer Portal → Keys
   - Create a new "Sign in with Apple" key
   - Download the .p8 file
   - Update Supabase with the new Key ID and Private Key

4. **Test with different redirect format**:
   - Try adding `com.jarydhermann.goodtimes://` to Supabase redirect URLs
   - Update the redirect in code to match

## Google OAuth: Session timeout

If Google OAuth times out when setting the session:

1. **Check redirect URL**:
   - Supabase Dashboard → Authentication → URL Configuration
   - Ensure `goodtimes://` is in Redirect URLs

2. **Verify Google OAuth credentials**:
   - Supabase Dashboard → Authentication → Providers → Google
   - Check Client ID and Client Secret are correct
   - Verify they're from the correct Google Cloud project

3. **Google Cloud Console**:
   - Go to https://console.cloud.google.com/apis/credentials
   - Select your OAuth 2.0 Client ID
   - Under "Authorized redirect URIs", ensure:
     - `https://ytnnsykbgohiscfgomfe.supabase.co/auth/v1/callback`
     - This is automatically added by Supabase, but verify it exists

## Testing OAuth

### ⚠️ Simulator Limitations

**OAuth redirects often don't work reliably in iOS Simulators.**

- **Google OAuth**: May work intermittently, but deep link redirects can fail
- **Apple OAuth**: Often fails to redirect back to the app
- **Workaround**: Test OAuth on a **physical iOS device** or use **email/password** authentication in the simulator

**Why?** iOS Simulators have limitations with:
- Deep linking (`goodtimes://` redirects)
- Custom URL schemes
- Web browser → app redirects

**For Development:**
- Use email/password sign-in in simulator
- Test OAuth flows on physical device (TestFlight or development build)

### Test Redirect URLs

1. **Check current redirect**:
   ```typescript
   // In auth.tsx, the redirect is:
   const redirectTo = "goodtimes://"
   ```

2. **Verify in Supabase**:
   - Dashboard → Authentication → URL Configuration
   - Should see `goodtimes://` in Redirect URLs

3. **Test manually**:
   - Try opening: `goodtimes://test` in your app
   - If it opens the app, the scheme is working

### Debug Steps

1. **Check Supabase logs**:
   - Dashboard → Logs → Auth Logs
   - Look for OAuth errors

2. **Verify OAuth provider status**:
   - Apple: Check Apple Developer Portal for any service issues
   - Google: Check Google Cloud Console for quota/errors

3. **Test with email/password**:
   - If email/password works but OAuth doesn't, it's an OAuth config issue
   - If nothing works, check Supabase project status

## Quick Fixes

### For Apple OAuth:
1. **In Apple Developer Portal** (Return URLs - where Apple redirects):
   - Add: `https://ytnnsykbgohiscfgomfe.supabase.co/auth/v1/callback`
   - ⚠️ Must be HTTPS, not `goodtimes://`

2. **In Supabase Dashboard** (Redirect URLs - where Supabase redirects to your app):
   - Add: `goodtimes://`
   - This is where Supabase sends users after processing OAuth

3. Verify Service ID in Apple Developer Portal matches Supabase

4. Check that the OAuth key (.p8) hasn't expired

### For Google OAuth:
1. Verify Client ID and Secret in Supabase match Google Cloud Console

2. Check that redirect URI is authorized in Google Cloud Console

3. Ensure Google OAuth consent screen is configured

## Still Not Working?

1. **Check Supabase status**: https://status.supabase.com
2. **Review Supabase Auth logs**: Dashboard → Logs → Auth Logs
3. **Test in Supabase Dashboard**: Try the OAuth flow directly in Supabase Dashboard → Authentication → Users → Add user → OAuth

If OAuth works in Supabase Dashboard but not in your app, it's likely a redirect URL configuration issue.

