# Invite Flow & Push Notifications Guide

## 📱 Testing the Invite Flow

### Step-by-Step Instructions

1. **Get an invite link:**
   - Open the app and go to a group
   - Click "Invite" or share the group
   - Copy the invite link: `goodtimes://join/{groupId}`
   - Example: `goodtimes://join/9b0f1b50-ccd6-42da-a306-11a366a58bc6`

2. **Test in iOS Simulator (Recommended):**
   ```bash
   # Method 1: Using Safari in Simulator (Easiest)
   # 1. Open Safari in iOS Simulator
   # 2. Type: goodtimes://join/{groupId}
   # 3. Press Enter - Safari will prompt to open in app
   
   # Method 2: Using terminal (app must be running)
   npx expo start --ios
   # Wait for app to load, then in another terminal:
   xcrun simctl openurl booted "goodtimes://join/{groupId}"
   
   # Method 3: Using Expo's linking
   npx expo start --ios --open-url "goodtimes://join/{groupId}"
   ```

3. **Expected Behavior:**
   - **Unauthenticated user**: Redirects to onboarding → after sign-up/login → joins group → redirects to home
   - **Authenticated user**: Checks membership → joins if not member → redirects to home with group focused
   - **Already a member**: Just redirects to home with that group focused

### Current Flow Logic

1. **Deep Link Handler** (`app/_layout.tsx`):
   - Listens for `goodtimes://join/{groupId}` URLs
   - Currently only handles OAuth redirects, NOT join links

2. **Join Route** (`app/join/[groupId].tsx`):
   - Checks authentication
   - If not authenticated: Stores `groupId` in AsyncStorage → redirects to onboarding
   - If authenticated: Checks if group exists → checks membership → adds user → redirects to home

3. **Boot Handler** (`app/index.tsx`):
   - Checks for pending group join from AsyncStorage
   - After auth, redirects to `/join/{groupId}`

### ⚠️ Current Issue

The deep link handler in `app/_layout.tsx` only handles OAuth callbacks, not `goodtimes://join/` links. The join links are handled by Expo Router automatically routing to `/join/[groupId]`, but we need to ensure the deep link listener also handles these.

---

## 🔔 Push Notifications

### Current Notification Logic

#### When Notifications Are Sent

1. **Daily Prompt Notifications** (via Supabase Edge Function):
   - **Function**: `supabase/functions/send-daily-notifications/index.ts`
   - **Trigger**: Cron job scheduled for 9:00 AM UTC daily (`002_add_cron_jobs.sql`)
   - **What it does**:
     - Gets all `group_prompts` scheduled for today
     - For each group, gets all members with push tokens
     - Sends Expo push notification with:
       - Title: `"Today's question for {group.name}"`
       - Body: The prompt question
       - Data: `{ type: "daily_prompt", group_id, prompt_id }`

2. **Notification Payload Structure**:
   ```json
   {
     "to": "ExponentPushToken[...]",
     "sound": "default",
     "title": "Today's question for Family Group",
     "body": "What made you smile today?",
     "data": {
       "type": "daily_prompt",
       "group_id": "uuid",
       "prompt_id": "uuid"
     }
   }
   ```

#### On-Click Behavior

**⚠️ CURRENTLY NOT IMPLEMENTED**

The app does NOT have notification click handlers set up. When a user taps a notification:
- The app opens, but no navigation happens
- The notification data is not processed

**What needs to be implemented:**
1. Add notification listener in `app/_layout.tsx` or `app/index.tsx`
2. Handle notification data payload
3. Navigate to appropriate screen based on `type`:
   - `daily_prompt` → Navigate to `/(main)/home` with `focusGroupId`
   - Future types (comments, reactions) → Navigate to entry detail

#### Push Token Registration

**⚠️ CURRENTLY NOT CALLED**

The app has the functions (`lib/notifications.ts`):
- `registerForPushNotifications()` - Gets Expo push token
- `savePushToken(userId, token)` - Saves to `push_tokens` table

**But these are never called!** You need to:
1. Call `registerForPushNotifications()` when user logs in or on app start
2. Save the token using `savePushToken()`
3. Common places to add this: `app/index.tsx` after auth, or `app/(main)/settings.tsx`

---

## 🐛 Why Notifications Table is Empty

### Issue 1: Push Tokens Not Saved
- The notification function looks for `push_token` in the `users` table
- But tokens are saved to `push_tokens` table
- **Fix needed**: Update `send-daily-notifications/index.ts` to join with `push_tokens` table

### Issue 2: Push Tokens Never Registered
- `registerForPushNotifications()` is never called
- Users don't have push tokens saved
- **Fix needed**: Add push token registration on login/app start

### Issue 3: Cron Job May Not Be Running
- Check if cron jobs are enabled in Supabase
- Verify the URLs in `002_add_cron_jobs.sql` match your project
- **Check**: Supabase Dashboard → Database → Cron Jobs

### Issue 4: Daily Prompts May Not Be Scheduled
- The `schedule-daily-prompts` function runs at 12:01 AM UTC
- It creates `group_prompts` entries for today
- **Check**: Query `group_prompts` table to see if entries exist for today

---

## 🔧 What Needs to Be Fixed

### 1. Fix Deep Link Handler
**File**: `app/_layout.tsx`
- Add handling for `goodtimes://join/{groupId}` URLs
- Route to `/join/{groupId}`

### 2. Add Push Token Registration
**Files**: `app/index.tsx` or `app/(main)/settings.tsx`
- Call `registerForPushNotifications()` after user logs in
- Save token with `savePushToken(userId, token)`

### 3. Fix Notification Function
**File**: `supabase/functions/send-daily-notifications/index.ts`
- Change query to join `push_tokens` table instead of looking for `push_token` in `users`
- Current code expects `users.push_token` which doesn't exist

### 4. Add Notification Click Handler
**File**: `app/_layout.tsx` or `app/index.tsx`
- Add `Notifications.addNotificationResponseReceivedListener()`
- Handle navigation based on notification data

### 5. Verify Cron Jobs
**Check**: Supabase Dashboard
- Ensure cron jobs are enabled
- Verify URLs match your project reference
- Check logs for errors

---

## 📋 Testing Checklist

### Invite Flow
- [ ] Test with unauthenticated user
- [ ] Test with authenticated user (not a member)
- [ ] Test with authenticated user (already a member)
- [ ] Test deep link from Safari
- [ ] Test deep link from terminal

### Push Notifications
- [ ] Register push token on login
- [ ] Verify token saved to `push_tokens` table
- [ ] Manually trigger `send-daily-notifications` function
- [ ] Verify notification received in app
- [ ] Test notification click navigation
- [ ] Verify notifications saved to `notifications` table

---

## 🧪 Manual Testing Commands

### Test Invite Link
```bash
# Get a groupId from your database
# Then run:
xcrun simctl openurl booted "goodtimes://join/{groupId}"
```

### Test Push Notification (Expo)
1. Get your Expo push token from app logs
2. Go to https://expo.dev/notifications
3. Send test notification with your token
4. Include data: `{ "type": "daily_prompt", "group_id": "...", "prompt_id": "..." }`

### Manually Trigger Notification Function
```bash
# In Supabase Dashboard → Edge Functions → send-daily-notifications
# Click "Invoke" to test manually
```

### Check Database
```sql
-- Check if push tokens exist
SELECT * FROM push_tokens;

-- Check if notifications exist
SELECT * FROM notifications ORDER BY created_at DESC;

-- Check if daily prompts are scheduled
SELECT * FROM group_prompts WHERE scheduled_for = CURRENT_DATE;

-- Check cron jobs
SELECT * FROM cron.job;
```

---

## 📝 Next Steps

1. **Immediate**: Fix push token registration and notification function
2. **Next**: Add notification click handlers
3. **Then**: Test full flow end-to-end
4. **Finally**: Set up proper error handling and logging

