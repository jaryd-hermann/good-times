# Backfill Missing Prompts - Instructions

## Problem
Multiple groups have missing prompts for recent dates (Jan 15-17, 2026). The `schedule-daily-prompts` function hasn't been running daily.

## Root Cause
The function wasn't scheduled to run automatically via cron job.

## Solution

### Step 1: Set Up Daily Cron Job
Run the migration `069_schedule_daily_prompts_cron.sql` to schedule the function to run daily at 12:01 AM UTC.

**Important:** You'll need to set these settings in your Supabase database:
```sql
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';
ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';
```

Or modify the cron job to use environment variables if available.

### Step 2: Manually Trigger Function for Missing Dates

Since the function only schedules prompts for "today", you have two options:

#### Option A: Modify Function Temporarily (Recommended)
Temporarily modify `schedule-daily-prompts/index.ts` to accept a date parameter:

```typescript
// Change line 26 from:
const today = new Date().toISOString().split("T")[0]

// To:
const requestBody = await req.json().catch(() => ({}))
const today = requestBody.date || new Date().toISOString().split("T")[0]
```

Then call the function for each missing date:
```bash
# For Jan 15
curl -X POST https://your-project.supabase.co/functions/v1/schedule-daily-prompts \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"date": "2026-01-15"}'

# For Jan 16
curl -X POST https://your-project.supabase.co/functions/v1/schedule-daily-prompts \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"date": "2026-01-16"}'

# For Jan 17
curl -X POST https://your-project.supabase.co/functions/v1/schedule-daily-prompts \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"date": "2026-01-17"}'
```

#### Option B: Create a Backfill Script
Create a new Edge Function that calls `schedule-daily-prompts` for a range of dates.

### Step 3: Verify Prompts Were Scheduled
Run Query 1 from `debug_queries.sql` again to verify all dates now have prompts.

### Step 4: Monitor Going Forward
- Check Supabase Dashboard > Edge Functions > Logs for `schedule-daily-prompts`
- Verify the cron job is running: `SELECT * FROM cron.job WHERE jobname = 'schedule-daily-prompts';`
- Check cron job history: `SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'schedule-daily-prompts');`

## Missing Dates to Backfill

Based on Query 1 results:

**One Direction (4d129d3e-b14c-4d9b-88b7-43ec67d98ca2):**
- 2026-01-15
- 2026-01-16
- 2026-01-17

**Arambrook (8dd82cfd-7328-4deb-96c0-d729f7fc8e68):**
- 2026-01-12
- 2026-01-13
- 2026-01-14
- 2026-01-15
- 2026-01-16
- 2026-01-17

**Goblin Queens (cd36520c-03fa-4e18-9442-cde27e7cfa64):**
- 2026-01-10
- 2026-01-14
- 2026-01-15
- 2026-01-16
- 2026-01-17

## Important Notes

1. **Sunday Dates**: Jan 12, 2026 is a Sunday - these should get Journal prompts, not Standard prompts
2. **Function Logic**: The function checks if a prompt already exists before scheduling, so it's safe to run multiple times
3. **Race Conditions**: The function has protection against duplicate scheduling
4. **Logs**: Check function logs to see why prompts weren't scheduled (exhausted prompts, errors, etc.)
