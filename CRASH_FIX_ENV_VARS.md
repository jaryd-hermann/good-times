# Crash Fix: Missing Environment Variables

## Problem
The app crashes immediately on open because Supabase environment variables are not set in EAS Build.

## Solution
Set the environment variables as EAS secrets before building:

```bash
# Set Supabase URL
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value YOUR_SUPABASE_URL

# Set Supabase Anon Key
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value YOUR_SUPABASE_ANON_KEY
```

Replace:
- `YOUR_SUPABASE_URL` with your actual Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- `YOUR_SUPABASE_ANON_KEY` with your actual Supabase anon/public key

## Verify Secrets
Check that secrets are set:
```bash
eas secret:list --scope project
```

## Rebuild
After setting secrets, rebuild:
```bash
eas build --platform ios --profile production
```

## Changes Made
1. Added `isSupabaseConfigured()` check function
2. Added error boundary to catch crashes gracefully
3. Added validation in boot sequence to show helpful error message
4. Improved error messages to guide users to set EAS secrets

## Testing
The app will now:
- Show a helpful error message if env vars are missing (instead of crashing)
- Log clear warnings in console
- Guide users to set EAS secrets

