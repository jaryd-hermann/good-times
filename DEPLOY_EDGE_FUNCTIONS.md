# Deploy Edge Functions to Supabase

## Issue
The `process-notification-queue` Edge Function is returning 404 because it hasn't been deployed to Supabase.

## Solution: Deploy the Edge Function

### Prerequisites
1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref ytnnsykbgohiscfgomfe
   ```
   (Replace with your project ref if different)

### Deploy the Function

```bash
# Deploy the process-notification-queue function
supabase functions deploy process-notification-queue

# Also deploy other functions if needed:
supabase functions deploy schedule-daily-prompts
supabase functions deploy send-daily-notifications
```

### Verify Deployment

After deploying, test again:
```bash
npx tsx scripts/test-notification.ts "55f93958-b2a3-41e5-b965-3180f9df6e36"
```

You should see:
- ✓ Inserted notification into queue
- ✓ Edge Function response: { success: true, processed: 1, ... }

### Alternative: Deploy via Supabase Dashboard

1. Go to https://supabase.com/dashboard/project/ytnnsykbgohiscfgomfe/functions
2. Click "Create a new function"
3. Name: `process-notification-queue`
4. Copy the code from `supabase/functions/process-notification-queue/index.ts`
5. Paste into the editor
6. Click "Deploy"

### Set Environment Variables

The function needs these environment variables (set in Supabase Dashboard):
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your service role key (secret)

To set them:
1. Go to Supabase Dashboard → Edge Functions → process-notification-queue → Settings
2. Add secrets:
   - `SUPABASE_URL` = `https://ytnnsykbgohiscfgomfe.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = (your service role key from Settings → API)

### Why This Fixes Notifications

The notification system works like this:
1. Triggers insert notifications into `notification_queue` table
2. Cron job calls `process-notification-queue` Edge Function every 5 minutes
3. Edge Function processes queued notifications and sends push notifications

Without the deployed Edge Function, step 3 never happens, so notifications accumulate in the queue but never get sent.

