# Notification Logic Documentation

This document outlines all notification types, their triggers, and scheduling in the Good Times app.

## Notification Types

### 1. Member Joined Notifications
**Purpose**: Notify all existing group members when someone new joins the group.

**Trigger**: 
- Database trigger `on_member_joined` fires automatically when a new row is inserted into `group_members` table
- Trigger function: `queue_member_joined_notification()` (PostgreSQL function)
- Migration: `supabase/migrations/005_notification_triggers.sql`

**Logic**:
- When a new member joins (INSERT into `group_members`):
  - Fetches the new member's name and group name
  - Queues notifications for **all existing members** (excluding the new member)
  - Inserts into `notification_queue` table with:
    - Type: `'member_joined'`
    - Title: `"{member_name} joined {group_name}"`
    - Body: `"{member_name} joined your group"`
    - Data: `{ type: 'member_joined', group_id, member_id }`
- Processed by `process-notification-queue` edge function (runs every 5 minutes)

**Notification Content**:
- Title: `"{member_name} joined {group_name}"`
- Body: `"{member_name} joined your group"`
- Data: `{ type: 'member_joined', group_id, member_id }`

**Note**: This is a **real-time trigger** - notifications are queued immediately when someone joins, but actual push notifications are sent when the queue processor runs (every 5 minutes).

---

### 2. New Entry Notifications (Someone Answered Daily Question)
**Purpose**: Notify all group members when someone posts an entry (answers the daily question).

**Trigger**: 
- Database trigger `on_new_entry` fires automatically when a new row is inserted into `entries` table
- Trigger function: `queue_new_entry_notification()` (PostgreSQL function)
- Migration: `supabase/migrations/005_notification_triggers.sql`

**Logic**:
- When a new entry is created (INSERT into `entries`):
  - Fetches the author's name, group name, and prompt question
  - Queues notifications for **all group members** (excluding the entry author)
  - Inserts into `notification_queue` table with:
    - Type: `'new_entry'`
    - Title: `"{author_name} shared in {group_name}"`
    - Body: The prompt question text
    - Data: `{ type: 'new_entry', group_id, entry_id }`
- Processed by `process-notification-queue` edge function (runs every 5 minutes)

**Notification Content**:
- Title: `"{author_name} shared in {group_name}"`
- Body: The prompt question text
- Data: `{ type: 'new_entry', group_id, entry_id }`

**Note**: This is a **real-time trigger** - notifications are queued immediately when an entry is posted, but actual push notifications are sent when the queue processor runs (every 5 minutes).

---

### 3. New Comment Notifications
**Purpose**: Notify the entry author when someone comments on their post.

**Trigger**: 
- Database trigger `on_new_comment` fires automatically when a new row is inserted into `comments` table
- Trigger function: `queue_new_comment_notification()` (PostgreSQL function)
- Migration: `supabase/migrations/005_notification_triggers.sql`

**Logic**:
- When a new comment is created (INSERT into `comments`):
  - Fetches the commenter's name and entry details
  - **Only notifies the entry author** (not the commenter, and not other group members)
  - Skips notification if commenter is the same as entry author (self-comment)
  - Inserts into `notification_queue` table with:
    - Type: `'new_comment'`
    - Title: `"{commenter_name} commented on your post"`
    - Body: The comment text
    - Data: `{ type: 'new_comment', entry_id, group_id, commenter_id }`
- Processed by `process-notification-queue` edge function (runs every 5 minutes)

**Notification Content**:
- Title: `"{commenter_name} commented on your post"`
- Body: The comment text
- Data: `{ type: 'new_comment', entry_id, group_id, commenter_id }`

**Note**: This is a **real-time trigger** - notifications are queued immediately when a comment is posted, but actual push notifications are sent when the queue processor runs (every 5 minutes). Only the entry author receives the notification, not other commenters or group members.

---

### 4. Daily Prompt Notifications
**Purpose**: Notify users about the daily question for their group.

**Trigger**: 
- Scheduled via cron job `send-daily-notifications`
- Runs daily at **9:00 AM UTC** (cron schedule: `0 9 * * *`)
- Edge function: `supabase/functions/send-daily-notifications/index.ts`

**Logic**:
- Fetches all `daily_prompts` entries for today's date
- For each prompt:
  - If `user_id` is set (e.g., birthday prompt): sends to that specific user only
  - If `user_id` is null (general prompt): sends to all group members
- Personalizes prompts with dynamic variables (e.g., member names for birthdays)
- Saves notification record to `notifications` table
- Sends via Expo Push Notification service

**Notification Content**:
- Title: `"Today's question for {group_name}"`
- Body: The personalized prompt question text
- Data: `{ type: "daily_prompt", group_id, prompt_id }`

**Note**: Currently sends at 9 AM UTC. For proper local time support, you would need multiple cron jobs for different timezones or a more sophisticated scheduling system.

---

### 5. Custom Question Notifications
**Purpose**: Notify users when they've been selected to ask a custom question.

**Triggers**: 
- **Initial Notification**: Scheduled at **8:00 AM UTC** (cron schedule: `0 8 * * *`)
- **Reminder Notification**: Scheduled at **4:00 PM UTC** (cron schedule: `0 16 * * *`)
- Edge function: `supabase/functions/send-custom-question-notifications/index.ts`

**Logic**:
- Fetches all `custom_questions` entries where:
  - `date_assigned` = today
  - `date_asked` is NULL (question not yet created)
- For each opportunity:
  - **8 AM check**: If `hoursSinceAssignment < 1`, sends initial notification
  - **4 PM check**: If `hoursSinceAssignment >= 6`, sends reminder notification
- Calculates user's local time (currently defaults to "America/New_York" timezone)
- Sends via Expo Push Notification service

**Notification Content**:
- **Initial (8 AM)**:
  - Title: `"You've been selected!"`
  - Body: `"You've been selected to ask a custom question to your group. Tap to create yours."`
  - Data: `{ type: "custom_question_opportunity", groupId, date }`
  
- **Reminder (4 PM)**:
  - Title: `"Don't forget!"`
  - Body: `"You have {hoursRemaining} hours left to ask your custom question. Tap to create yours."`
  - Data: `{ type: "custom_question_opportunity", groupId, date }`

**Note**: Currently uses hardcoded "America/New_York" timezone. TODO: Store user timezone preference in `users` table.

---

### 6. Custom Question Eligibility Check
**Purpose**: Daily check to determine which groups are eligible for custom questions.

**Trigger**:
- Scheduled via cron job `check-custom-question-eligibility`
- Runs daily at **1:00 AM UTC** (cron schedule: `0 1 * * *`)
- Edge function: `supabase/functions/check-custom-question-eligibility/index.ts`

**Logic**:
- Checks all groups for eligibility:
  - Group must be active for at least 7 days
  - Group must have at least 3 members
- Updates `group_activity_tracking` table with eligibility status

---

### 7. Custom Question Opportunity Assignment
**Purpose**: Weekly assignment of custom question opportunities to group members.

**Trigger**:
- Scheduled via cron job `assign-custom-question-opportunity`
- Runs every **Monday at 12:01 AM UTC** (cron schedule: `1 0 * * 1`)
- Edge function: `supabase/functions/assign-custom-question-opportunity/index.ts`

**Logic**:
- For each eligible group:
  - Selects a random member who hasn't been assigned this week
  - Prioritizes members who haven't asked yet (rotation logic)
  - Creates `custom_questions` entry with `date_assigned` = random day of the week
  - Ensures no user gets multiple assignments on the same day across different groups
- Updates `custom_question_rotation` table to track assignments

---

### 8. Process Skipped Custom Questions
**Purpose**: Handle custom question opportunities that were skipped (not created within 24 hours).

**Trigger**:
- Scheduled via cron job `process-skipped-custom-questions`
- Runs daily at **11:59 PM UTC** (cron schedule: `59 23 * * *`)
- Edge function: `supabase/functions/process-skipped-custom-questions/index.ts`

**Logic**:
- Finds all `custom_questions` entries where:
  - `date_assigned` = today
  - `date_asked` is NULL (not created)
- Marks these as skipped
- Allows rotation to continue normally (skipped users still count as having had their turn)

---

## Cron Job Schedule Summary

| Cron Job | Schedule (UTC) | Purpose |
|----------|----------------|---------|
| `schedule-daily-prompts` | `1 0 * * *` (12:01 AM daily) | Schedule daily prompts for all groups |
| `send-daily-notifications` | `0 9 * * *` (9:00 AM daily) | Send daily prompt notifications |
| `check-custom-question-eligibility` | `0 1 * * *` (1:00 AM daily) | Check group eligibility for custom questions |
| `assign-custom-question-opportunity` | `1 0 * * 1` (12:01 AM Mondays) | Assign weekly custom question opportunities |
| `send-custom-question-notifications-8am` | `0 8 * * *` (8:00 AM daily) | Send initial custom question notifications |
| `send-custom-question-notifications-4pm` | `0 16 * * *` (4:00 PM daily) | Send reminder custom question notifications |
| `process-skipped-custom-questions` | `59 23 * * *` (11:59 PM daily) | Process skipped custom questions |
| `process-notification-queue` | `*/5 * * * *` (Every 5 minutes) | Process queued notifications |

---

## Notification Queue Processing

The `process-notification-queue` cron job runs every 5 minutes to process notifications queued by database triggers.

**How it works**:
1. **Database Triggers** (real-time): When certain events occur (member joins, entry created, comment created), PostgreSQL triggers automatically insert notification records into the `notification_queue` table
2. **Queue Processor** (every 5 minutes): The `process-notification-queue` edge function:
   - Fetches up to 50 unprocessed notifications from `notification_queue`
   - Gets push tokens for each user
   - Sends push notifications via Expo Push Notification Service
   - Saves notification records to `notifications` table (for in-app history)
   - Marks queue items as `processed = true`

**Notification Types Using Queue**:
- Member joined (`member_joined`)
- New entry (`new_entry`)
- New comment (`new_comment`)

**Notification Types Using Direct Scheduling**:
- Daily prompts (scheduled cron job)
- Custom question notifications (scheduled cron jobs)

---

## Timezone Considerations

**Current State**:
- Most notifications are scheduled at fixed UTC times
- Custom question notifications attempt to calculate user local time but default to "America/New_York"
- Daily notifications send at 9 AM UTC regardless of user timezone

**Future Improvements Needed**:
1. Store user timezone preference in `users` table
2. Implement timezone-aware scheduling for all notifications
3. Consider using a more sophisticated scheduling system (e.g., multiple cron jobs per timezone or a queue-based system)

---

## Notification Delivery

All notifications are delivered via:
- **Expo Push Notification Service** (`https://exp.host/--/api/v2/push/send`)
- Push tokens are stored in `push_tokens` table
- Notifications are also saved to `notifications` table for in-app notification history

---

## Testing Notifications

To test notifications in development:
1. Use Expo's push notification tool: `npx expo-notifications`
2. Manually trigger edge functions via Supabase dashboard
3. Use the dev mode toggle in settings (for custom question flow)

