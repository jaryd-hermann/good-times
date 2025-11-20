# Apple OAuth Setup - Step by Step

## The Confusion: Two Different URLs

There are **two different redirect URLs** you need to configure:

1. **Apple Developer Portal → Return URLs**: Where Apple redirects after authentication
   - Must be HTTPS: `https://ytnnsykbgohiscfgomfe.supabase.co/auth/v1/callback`
   
2. **Supabase Dashboard → Redirect URLs**: Where Supabase redirects to your app after processing
   - Custom scheme: `goodtimes://`

## Step-by-Step Setup

### Step 1: Apple Developer Portal

1. Go to https://developer.apple.com/account/resources/identifiers/list/serviceId
2. Select your Service ID (or create one)
3. Under "Sign in with Apple" → "Return URLs"
4. Click "+" to add a new URL
5. Enter: `https://ytnnsykbgohiscfgomfe.supabase.co/auth/v1/callback`
   - ⚠️ **Must be HTTPS** - Apple will reject `goodtimes://`
6. Click "Save"

### Step 2: Apple Developer Portal - Domains

1. In the same Service ID configuration
2. Under "Domains and Subdomains"
3. Add: `ytnnsykbgohiscfgomfe.supabase.co`
4. Click "Save"

### Step 3: Supabase Dashboard - Redirect URLs

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Under "Redirect URLs", add:
   - `goodtimes://`
   - (Optional) `com.jarydhermann.goodtimes://`
3. Click "Save"

### Step 4: Supabase Dashboard - Apple Provider

1. Go to Supabase Dashboard → Authentication → Providers → Apple
2. Enable Apple provider
3. Enter:
   - **Service ID**: Your Apple Service ID (e.g., `com.jarydhermann.goodtimes`)
   - **Team ID**: Found in Apple Developer Portal (top right)
   - **Key ID**: From your OAuth key in Apple Developer Portal
   - **Private Key**: Contents of your .p8 file (download from Apple Developer Portal → Keys)
4. Click "Save"

## How It Works

```
User clicks "Sign in with Apple"
  ↓
Opens Apple authentication page
  ↓
User authenticates with Apple
  ↓
Apple redirects to: https://ytnnsykbgohiscfgomfe.supabase.co/auth/v1/callback
  ↓
Supabase processes OAuth and exchanges code for tokens
  ↓
Supabase redirects to: goodtimes://#access_token=...
  ↓
Your app receives the deep link and sets the session
```

## Troubleshooting

### "Invalid URL" error in Apple Developer Portal
- ✅ Use: `https://ytnnsykbgohiscfgomfe.supabase.co/auth/v1/callback`
- ❌ Don't use: `goodtimes://` (custom schemes not allowed here)

### "Unable to exchange external code" error
- Check that Return URL in Apple matches exactly: `https://ytnnsykbgohiscfgomfe.supabase.co/auth/v1/callback`
- Verify Service ID, Team ID, Key ID, and Private Key in Supabase match Apple Developer Portal
- Ensure the OAuth key hasn't expired

### OAuth works but app doesn't receive redirect
- Check Supabase Redirect URLs includes `goodtimes://`
- Verify app scheme is configured in `app.config.ts`: `scheme: "goodtimes"`

