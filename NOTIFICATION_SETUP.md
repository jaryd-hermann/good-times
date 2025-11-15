# Notification Setup Guide

## Overview

This app now supports push notifications for:
1. **Daily Prompts** - Sent at 9 AM (currently UTC, timezone support coming)
2. **Member Joined** - When someone joins a group
3. **New Entry** - When a group member posts a new entry
4. **New Comment** - When someone comments on your entry

## Setup Steps

### 1. Run Database Migrations

Run the new migration file in Supabase SQL Editor:
```sql
-- Run supabase/migrations/005_notification_triggers.sql
```

This creates:
- `notification_queue` table for async processing
- Database triggers for member join, entry creation, and comment creation
- Functions to queue notifications

### 2. Deploy Edge Functions

Deploy the notification functions:
```bash
supabase functions deploy send-daily-notifications
supabase functions deploy send-notification
supabase functions deploy process-notification-queue
```

### 3. Update Cron Jobs

Update `supabase/migrations/002_add_cron_jobs.sql` with your project reference:
- Replace `YOUR_PROJECT_REF` with your Supabase project reference
- Replace `YOUR_ANON_KEY` with your Supabase anon key

Then run the updated cron job SQL in Supabase SQL Editor.

### 4. Test Push Token Registration

The app now automatically registers for push notifications on login. To verify:
1. Log in to the app
2. Check `push_tokens` table in Supabase - you should see your token
3. Check console logs for "[boot] push token registered"

### 5. Test Notifications

#### Using Test Buttons (Dev Mode Only)

1. Open Settings in the app (dev mode only)
2. Scroll to "Test Notifications" section
3. Click each test button to see notification UI/UX
4. Click the notification to test routing

#### Manual Testing

1. **Daily Prompt**: Wait for 9 AM UTC or manually trigger `send-daily-notifications` function
2. **Member Joined**: Add a new member to a group
3. **New Entry**: Create a new entry in a group
4. **New Comment**: Comment on someone else's entry

## Notification Routing

When a notification is clicked:

- **daily_prompt** → Opens entry composer with the prompt
- **new_entry** → Opens entry detail page
- **new_comment** → Opens entry detail page
- **member_joined** → Opens home with that group focused

## Current Limitations

1. **Timezone**: Daily notifications currently send at 9 AM UTC. For local time support, you'll need to:
   - Add `timezone` field to `users` table
   - Update `send-daily-notifications` to calculate local 9 AM for each user
   - Or run multiple cron jobs for different timezones

2. **Notification Queue**: The queue is processed every 5 minutes. For real-time notifications, reduce the cron interval or use webhooks.

## Troubleshooting

### Notifications not sending?

1. Check `push_tokens` table - ensure tokens exist
2. Check `notification_queue` table - ensure items are being queued
3. Check `notifications` table - ensure notifications are being saved
4. Check Supabase Edge Function logs for errors
5. Verify cron jobs are enabled in Supabase Dashboard

### Notifications not routing?

1. Check notification data payload includes correct `type` and IDs
2. Verify notification click handler in `app/_layout.tsx`
3. Check console logs for routing errors

### Push tokens not registering?

1. Check app permissions - ensure notification permissions are granted
2. Check console logs for registration errors
3. Verify `registerForPushNotifications()` is being called on login

## Production Checklist

- [ ] Run all migrations
- [ ] Deploy all edge functions
- [ ] Update cron job URLs with production project reference
- [ ] Test all notification types
- [ ] Verify notification routing works
- [ ] Set up monitoring for notification queue
- [ ] Configure timezone support (if needed)
- [ ] Remove test notification buttons (they're already dev-only)

