# Redeploy send-email Function

## The Problem
The deployed `send-email` function doesn't have the onboarding email types (`onboarding_day_2` through `onboarding_day_7`), even though they're in the code. This means the function needs to be redeployed.

## Solution: Redeploy the Function

### Option 1: Using Supabase CLI (Recommended)

```bash
# Make sure you're logged in
supabase login

# Link to your project (if not already linked)
supabase link --project-ref ytnnsykbgohiscfgomfe

# Deploy the send-email function
supabase functions deploy send-email
```

### Option 2: Using Supabase Dashboard

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Find `send-email` function
3. Click **Deploy** or **Redeploy** button
4. Make sure the latest code is deployed

### Option 3: Using GitHub/CI (if you have it set up)

If you have CI/CD set up, push your changes and it should auto-deploy.

## Verify Deployment

After redeploying, check that the function has the latest code:

1. Go to **Supabase Dashboard** → **Edge Functions** → `send-email` → **Code**
2. Verify that `EMAIL_TEMPLATES` includes:
   - `onboarding_day_2`
   - `onboarding_day_3`
   - `onboarding_day_4`
   - `onboarding_day_5`
   - `onboarding_day_6`
   - `onboarding_day_7`

## Test After Redeploy

Once redeployed, test again:

```bash
npx tsx test_send_onboarding_emails.ts 567ae465-b7c9-4ac5-81dd-cd13b8338742
```

You should now see `processed > 0` instead of `errors: 34`.

## Why This Happened

The function code in your repo has the onboarding email types, but the deployed version in Supabase doesn't. This happens when:
- Code was updated locally but not deployed
- Deployment failed previously
- Function was deployed from a different branch/version
