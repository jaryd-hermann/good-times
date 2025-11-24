# Inactivity Notification System

## Overview

Sends push notifications to users who haven't answered questions in a group for 3 consecutive days. This helps maintain engagement and prevents gaps in group history.

## Requirements

1. **3-Day Rule**: User must not have answered for 3 consecutive days (today, yesterday, day before)
2. **Membership Duration**: User must have been a member for at least 3 days (based on `joined_at`)
3. **Prompt Existence**: Only send if prompts exist for those 3 days in the group
4. **Rate Limiting**: Maximum once per 24 hours per user/group
5. **No Opt-Out**: If user has notifications enabled for daily prompts, they get this too

## Implementation

### Database Changes

**Migration**: `019_add_inactivity_notifications.sql`

- Creates `inactivity_notification_log` table to track sent notifications
- Adds indexes for performance
- Creates `get_inactive_users()` PostgreSQL function for efficient querying

### Edge Function

**File**: `supabase/functions/send-inactivity-notifications/index.ts`

**Logic**:
1. Finds users who joined at least 3 days ago
2. Checks if they have no entries in the last 3 days
3. Verifies prompts exist for those 3 days
4. Checks notification log to prevent duplicates (24-hour cooldown)
5. Sends push notification via Expo
6. Logs notification to database and updates notification log

**Performance**:
- Uses PostgreSQL function for efficient querying (falls back to manual if function doesn't exist)
- Processes users sequentially to avoid overwhelming the system
- Includes race condition protection (double-checks entries before sending)

### Cron Job

**Schedule**: Daily at 9:30 PM UTC (evening, after daily prompts)

**File**: `supabase/migrations/002_add_cron_jobs.sql`

```sql
SELECT cron.schedule(
  'send-inactivity-notifications',
  '30 21 * * *',
  ...
);
```

### Deep Link Handling

**File**: `app/_layout.tsx`

When user clicks notification:
- Navigates to `/(main)/home` with `focusGroupId` parameter
- Focuses the specific group in the home screen

## Notification Format

**Title**: "Don't leave gaps in your group's history!"

**Body**: "You haven't answered a question in {group_name} in 3 days, don't leave gaps in your group's growing history!"

**Data**:
```json
{
  "type": "inactivity_reminder",
  "group_id": "..."
}
```

## Safety Features

1. **Duplicate Prevention**: `inactivity_notification_log` table with unique constraint
2. **Rate Limiting**: 24-hour cooldown between notifications
3. **Race Condition Protection**: Double-checks entries right before sending
4. **Error Handling**: Graceful degradation - continues processing even if one user fails
5. **Performance**: Indexes on critical columns for fast queries

## Testing

### Manual Testing Steps

1. Create a test user and group
2. Join user to group (note the date)
3. Wait 3+ days
4. Ensure no entries exist for last 3 days
5. Ensure prompts exist for those 3 days
6. Manually trigger Edge Function or wait for cron
7. Verify notification received
8. Click notification → should navigate to home with group focused
9. Verify notification log entry created

### Edge Cases to Test

- User posts entry right before notification sends (race condition)
- User joins group but no prompts exist yet
- User has entries but not for all 3 days
- Multiple groups - user inactive in one, active in another
- User deleted from group after notification queued
- Push token expired or invalid

## Monitoring

Check Edge Function logs for:
- Number of inactive users found
- Number of notifications sent vs skipped
- Errors during processing
- Performance metrics (execution time)

## Future Enhancements

- User preference to disable inactivity notifications (separate from daily prompts)
- Different notification timing based on user timezone
- Escalating reminders (3 days, 7 days, 14 days)
- Analytics tracking for notification effectiveness

