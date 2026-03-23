# Deploy and Test Custom Question Assignment

## Quick Start

Since today is **Monday (2026-02-09)** and you have 0 opportunities, let's deploy and invoke the function to create them.

## Step 1: Set Environment Variables

Get your service role key from:
- **Supabase Dashboard → Settings → API → service_role key** (NOT the anon key)

Then set it:

```bash
export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'
```

(Optional) If your Supabase URL is different:
```bash
export EXPO_PUBLIC_SUPABASE_URL='https://your-project.supabase.co'
```

## Step 2: Deploy and Invoke (Recommended)

This script will:
1. Deploy the function (if Supabase CLI is set up)
2. Invoke it to create opportunities for today
3. Verify the results in the database

**Option A: Using npm script (Recommended)**
```bash
# Make sure you've set SUPABASE_SERVICE_ROLE_KEY first (Step 1)
npm run deploy-custom-questions
```

**Option B: Using npx (if npm script doesn't work)**
```bash
# Make sure you've set SUPABASE_SERVICE_ROLE_KEY first (Step 1)
npx tsx scripts/deploy-and-invoke-custom-question-assignment.ts
```

**Option C: Inline environment variable**
```bash
SUPABASE_SERVICE_ROLE_KEY='your-key' npm run deploy-custom-questions
```

## Step 2 Alternative: Just Invoke (If Already Deployed)

If the function is already deployed, you can just invoke it:

**Option A: Using npm script**
```bash
npm run invoke-custom-questions
```

**Option B: Using npx**
```bash
npx tsx scripts/invoke-custom-question-assignment.ts
```

## Step 3: Verify Results

After running, check:

1. **In Supabase Dashboard → Edge Functions → Logs**
   - Look for `assign-custom-question-opportunity`
   - Check for any errors

2. **In Database** - Run this SQL:
```sql
SELECT 
  date_assigned,
  COUNT(*) as opportunities,
  COUNT(*) FILTER (WHERE date_asked IS NULL) as pending_banners
FROM custom_questions
WHERE date_assigned = CURRENT_DATE
GROUP BY date_assigned;
```

3. **In the App**
   - Users should see banners today (Monday)
   - Banners show when `date_assigned = today` AND `date_asked IS NULL`

## Expected Output

If everything works, you should see:
- ✅ Function invoked successfully
- 📈 Newly Assigned: 6 (or however many eligible groups you have)
- Opportunities created in database for today

## Troubleshooting

### Function Not Found (404)
- The function isn't deployed
- Run: `supabase functions deploy assign-custom-question-opportunity`
- Or use the deploy script above

### Function Returns 0 Assignments
- Check if groups are marked eligible:
```sql
SELECT COUNT(*) FROM group_activity_tracking 
WHERE is_eligible_for_custom_questions = true;
```
- If 0, run the eligibility check function first

### Function Errors
- Check Supabase Dashboard → Edge Functions → Logs
- Look for error messages
- Common issues:
  - Missing environment variables in function
  - Database permission issues
  - Missing tables/columns

## After Success: Set Up Scheduler

Once you verify it works, set up the cron scheduler:

1. **Supabase Dashboard → Edge Functions → assign-custom-question-opportunity**
2. Click **"Schedule"** tab
3. Add schedule: `0 1 * * 1,4` (Monday and Thursday at 12:01 AM UTC)
4. Save

This will ensure the function runs automatically every Monday and Thursday.

## Manual Deployment (If Script Doesn't Work)

```bash
# Make sure you're logged in
supabase login

# Link to your project (if not already)
supabase link --project-ref ytnnsykbgohiscfgomfe

# Deploy the function
supabase functions deploy assign-custom-question-opportunity
```

Then invoke using the script or curl:

```bash
curl -X POST \
  "https://ytnnsykbgohiscfgomfe.supabase.co/functions/v1/assign-custom-question-opportunity" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```
