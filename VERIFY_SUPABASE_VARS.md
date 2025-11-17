# How to Verify Supabase Environment Variables

## Where to Check in Codebase

### 1. **`lib/supabase.ts`** (Lines 5-11)
This is the main file that reads the environment variables:

```typescript
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ""

// Validate environment variables
const hasValidConfig = supabaseUrl && supabaseAnonKey && 
  supabaseUrl !== "https://placeholder.supabase.co" && 
  supabaseAnonKey !== "placeholder-key"
```

**What to verify:**
- Lines 5-6: Variables are read from `process.env`
- Lines 9-11: Validation checks for non-empty, non-placeholder values
- Line 62-64: `isSupabaseConfigured()` function exports the validation result

### 2. **`app/index.tsx`** (Lines 33-39)
This checks Supabase configuration on app boot:

```typescript
// Check if Supabase is configured
const { isSupabaseConfigured } = await import("../lib/supabase");
if (!isSupabaseConfigured()) {
  setErr("Supabase is not configured. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY as EAS secrets.");
  setBooting(false);
  return;
}
```

**What to verify:**
- Line 34: Imports the validation function
- Line 35: Checks if Supabase is configured
- Line 36-38: Shows error message if not configured (prevents crash)

### 3. **`app.config.ts`** (Lines 64-65)
This exposes env vars for client usage (but EAS secrets override this):

```typescript
extra: {
  // expose public env for client usage
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
}
```

**Note:** This is just for reference. EAS Build uses secrets from `eas env:list`, not from `app.config.ts`.

## How EAS Build Injects Variables

1. **EAS Secrets** (set via `eas env:create`):
   - These are injected as `process.env.EXPO_PUBLIC_SUPABASE_URL` and `process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - Available during build time and runtime

2. **Verification Command:**
   ```bash
   eas env:list --scope project --environment production
   ```

## Expected Values

- **EXPO_PUBLIC_SUPABASE_URL**: `https://ytnnsykbgohiscfgomfe.supabase.co`
- **EXPO_PUBLIC_SUPABASE_ANON_KEY**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (long JWT token)

## If Variables Are Missing

The app will:
1. Show error message instead of crashing (thanks to `isSupabaseConfigured()` check)
2. Log warnings in console
3. Display: "Supabase is not configured. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY as EAS secrets."

## Files to Check

1. ✅ `lib/supabase.ts` - Main Supabase client initialization
2. ✅ `app/index.tsx` - Boot-time validation check
3. ✅ `app/_layout.tsx` - Error boundary wrapper
4. ✅ `components/ErrorBoundary.tsx` - Crash prevention component

All these files are in the latest commit and should prevent crashes.

