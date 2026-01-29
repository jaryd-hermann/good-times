# Troubleshooting send-email 500 Error

## The Problem
The `send-email` function is returning a 500 Internal Server Error when called from `process-onboarding-emails`.

## Common Causes

### 1. Missing RESEND_API_KEY Environment Variable
**Most likely cause!**

Check if `RESEND_API_KEY` is set:
1. Go to **Supabase Dashboard** → **Edge Functions** → `send-email` → **Settings**
2. Check **Environment Variables**
3. Make sure `RESEND_API_KEY` is set with your actual Resend API key

**To set it:**
- Go to Resend Dashboard → API Keys
- Copy your API key
- Add it to Supabase Edge Function environment variables

### 2. Missing User Data
The function tries to fetch user data. If the user doesn't exist or can't be fetched, it might fail.

### 3. Resend API Error
The Resend API call itself might be failing (invalid API key, rate limit, etc.)

## How to Debug

### Step 1: Check send-email Function Logs
1. Go to **Supabase Dashboard** → **Edge Functions** → `send-email` → **Logs**
2. Look for the most recent error around the timestamp: `2026-01-29T13:07:18`
3. The error message will tell you exactly what failed

### Step 2: Check Environment Variables
Run this in Supabase SQL Editor (won't show values, but confirms they exist):
```sql
-- Note: Edge Function env vars are in Dashboard, not SQL
-- But you can check if the function exists and is deployed
SELECT 
  name,
  version,
  created_at
FROM supabase_functions.functions
WHERE name = 'send-email';
```

### Step 3: Test send-email Function Directly
Try invoking `send-email` directly with a test payload:

```bash
# Replace with your values
PROJECT_REF="ytnnsykbgohiscfgomfe"
ANON_KEY="your-anon-key"

curl -X POST \
  "https://${PROJECT_REF}.supabase.co/functions/v1/send-email" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email_type": "welcome",
    "user_id": "567ae465-b7c9-4ac5-81dd-cd13b8338742"
  }'
```

This will show you the exact error from `send-email`.

## Most Likely Fix

**Set the RESEND_API_KEY environment variable:**
1. Supabase Dashboard → Edge Functions → `send-email` → Settings
2. Add environment variable: `RESEND_API_KEY` = `your-resend-api-key`
3. Redeploy the function (or it should auto-update)

## After Fixing

Once `RESEND_API_KEY` is set, try running the test again:
```bash
npx tsx test_send_onboarding_emails.ts 567ae465-b7c9-4ac5-81dd-cd13b8338742
```

You should see `processed > 0` instead of `errors: 34`.
