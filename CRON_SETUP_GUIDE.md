# Cron Job Setup Guide

## Why are `daily_prompts` and `group_prompt_queue` empty?

These tables are populated by the `schedule-daily-prompts` Edge Function, which runs via a cron job at 12:01 AM UTC daily. If the tables are empty, it's likely because:

1. **The cron job isn't configured** - The migration `002_add_cron_jobs.sql` has placeholder URLs that need to be updated
2. **The cron job hasn't run yet** - It only runs once per day at 12:01 AM UTC
3. **The Edge Function isn't deployed** - The function needs to be deployed to Supabase

## Setup Steps

### 1. Deploy the Edge Function

```bash
# Make sure you're in the project root
cd /path/to/good-times

# Deploy the updated function
supabase functions deploy schedule-daily-prompts
```

### 2. Configure the Cron Job

1. **Get your Supabase project details:**
   - Project Reference: Found in your Supabase URL (`https://[PROJECT_REF].supabase.co`)
   - Service Role Key: Found in Supabase Dashboard → Settings → API → `service_role` key (NOT the anon key)

2. **Update the cron job in Supabase SQL Editor:**

```sql
-- First, unschedule any existing jobs with placeholder URLs
SELECT cron.unschedule('schedule-daily-prompts');
SELECT cron.unschedule('send-daily-notifications');

-- Then schedule with your actual project details
SELECT cron.schedule(
  'schedule-daily-prompts',
  '1 0 * * *',  -- Runs at 12:01 AM UTC daily
  $$
  SELECT
    net.http_post(
      url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/schedule-daily-prompts',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
    ) AS request_id;
  $$
);

SELECT cron.schedule(
  'send-daily-notifications',
  '0 9 * * *',  -- Runs at 9:00 AM UTC daily
  $$
  SELECT
    net.http_post(
      url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-daily-notifications',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
    ) AS request_id;
  $$
);
```

**Replace:**
- `YOUR_PROJECT_REF` with your actual project reference
- `YOUR_SERVICE_ROLE_KEY` with your actual service role key

### 3. Verify Cron Jobs Are Running

```sql
-- Check if cron jobs are scheduled
SELECT * FROM cron.job WHERE jobname IN ('schedule-daily-prompts', 'send-daily-notifications');

-- Check cron job execution history (if available)
SELECT * FROM cron.job_run_details 
WHERE jobid IN (
  SELECT jobid FROM cron.job 
  WHERE jobname = 'schedule-daily-prompts'
)
ORDER BY start_time DESC
LIMIT 10;
```

### 4. Manually Trigger the Function (Optional - for testing)

You can manually trigger the function to populate prompts for existing groups:

```bash
# Using Supabase CLI
supabase functions invoke schedule-daily-prompts

# Or using curl
curl -X POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/schedule-daily-prompts' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json'
```

### 5. Populate Prompts for Existing Groups (One-time)

If you have existing groups and want to populate prompts for today, run this SQL:

```sql
-- This will create prompts for today for all existing groups
DO $$
DECLARE
  group_record RECORD;
  today_date DATE := CURRENT_DATE;
  prompt_record RECORD;
  day_index INTEGER;
  group_offset INTEGER;
  selected_prompt_id UUID;
BEGIN
  FOR group_record IN SELECT id, type FROM groups LOOP
    -- Check if group already has a prompt for today
    IF NOT EXISTS (
      SELECT 1 FROM daily_prompts 
      WHERE group_id = group_record.id 
      AND date = today_date
    ) THEN
      -- Calculate day index for group-specific randomization
      group_offset := length(group_record.id::text);
      day_index := (EXTRACT(EPOCH FROM (today_date - '2020-01-01'::date)) / 86400)::integer + group_offset;
      
      -- Get a prompt (excluding birthday prompts and Edgy/NSFW for family groups)
      SELECT id INTO selected_prompt_id
      FROM prompts
      WHERE birthday_type IS NULL
        AND (group_record.type = 'friends' OR category != 'Edgy/NSFW')
      ORDER BY id
      LIMIT 1
      OFFSET (day_index % (
        SELECT COUNT(*) FROM prompts 
        WHERE birthday_type IS NULL 
        AND (group_record.type = 'friends' OR category != 'Edgy/NSFW')
      ));
      
      -- Insert daily prompt if we found one
      IF selected_prompt_id IS NOT NULL THEN
        INSERT INTO daily_prompts (group_id, prompt_id, date, user_id)
        VALUES (group_record.id, selected_prompt_id, today_date, NULL)
        ON CONFLICT (group_id, date) DO NOTHING;
      END IF;
    END IF;
  END LOOP;
END $$;
```

## What Changed?

The `schedule-daily-prompts` Edge Function has been updated to:

1. **Use weighted selection** - Respects group category preferences (more/less/none)
2. **Filter disabled categories** - Honors group settings for disabled categories
3. **Check for memorials** - Automatically disables "Remembering" category if group has no memorials
4. **Use group-specific randomization** - Each group gets its own randomized sequence
5. **Handle queue properly** - Checks queue first, then falls back to weighted selection

This matches the logic in `lib/db.ts` `getDailyPrompt` function, ensuring consistency between scheduled prompts and on-demand prompts.

## Troubleshooting

### Cron job not running?
- Check if `pg_cron` extension is enabled: `SELECT * FROM pg_extension WHERE extname = 'pg_cron';`
- Verify cron jobs are scheduled: `SELECT * FROM cron.job;`
- Check Supabase logs for Edge Function errors

### No prompts being created?
- Verify the Edge Function is deployed: `supabase functions list`
- Check Edge Function logs: `supabase functions logs schedule-daily-prompts`
- Ensure prompts exist in the `prompts` table: `SELECT COUNT(*) FROM prompts;`

### Prompts not respecting preferences?
- Verify category preferences exist: `SELECT * FROM question_category_preferences WHERE group_id = 'YOUR_GROUP_ID';`
- Check that weights are set correctly (more=1.5, less=0.5, none=0)

