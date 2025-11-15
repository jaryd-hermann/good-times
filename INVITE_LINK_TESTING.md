# Testing Invite Link Flow

## Overview
The invite link flow allows users to join groups via deep links with the format: `goodtimes://join/<groupId>`

## Testing Steps

### Method 1: Using Terminal Command (Most Reliable)

1. **Ensure the app is running in the iOS Simulator**
   ```bash
   npx expo start
   # Then press 'i' to open in iOS Simulator
   ```

2. **Open the invite link using xcrun simctl**
   ```bash
   xcrun simctl openurl booted "goodtimes://join/YOUR_GROUP_ID_HERE"
   ```
   
   Replace `YOUR_GROUP_ID_HERE` with the actual group ID from your Supabase database.

   **Example:**
   ```bash
   xcrun simctl openurl booted "goodtimes://join/1e558ef2-be21-4cf0-b9ff-693a5c1d384c"
   ```

### Method 2: Using Safari (Less Reliable)

1. **Ensure the app is running in the iOS Simulator**

2. **Open Safari in the Simulator**
   - Safari should already be available in the Simulator

3. **Type or paste the invite link in the address bar**
   ```
   goodtimes://join/YOUR_GROUP_ID_HERE
   ```

4. **Press Enter**
   - Safari may sometimes search instead of opening the link
   - If it searches, try Method 1 instead

### Method 3: Using Notes App (Alternative)

1. **Create a note in the Notes app with the invite link**
   ```
   goodtimes://join/YOUR_GROUP_ID_HERE
   ```

2. **Tap the link** in the Notes app

## Expected Flow

### For Unauthenticated Users:
1. User clicks invite link → Redirected to `/(onboarding)/welcome-1`
2. User completes onboarding (About → Auth → How it Works)
3. After authentication, user is automatically added to the group
4. User is redirected to `/(main)/home` with the new group focused

### For Authenticated Users:
1. User clicks invite link → Redirected to `/(onboarding)/join-group-landing`
2. User sees inviter info, group name, and members
3. User clicks "Join Group" → Redirected to `/(onboarding)/about` (if profile incomplete) or directly joins
4. After profile completion/verification → User joins group
5. User is redirected to `/(onboarding)/how-it-works` → Then `/(main)/home` with the new group focused

## Troubleshooting

### "Simulator device failed to open" Error
- **Solution**: Make sure the app is running in the simulator before executing the command
- Try rebuilding: `npx expo run:ios`

### Safari Just Searches Instead of Opening Link
- **Solution**: Use Method 1 (terminal command) instead - it's more reliable
- The terminal method bypasses Safari's search behavior

### Black Screen After Opening Link
- **Solution**: 
  1. Check that the app is running and not crashed
  2. Verify the group ID exists in your Supabase database
  3. Check console logs for errors
  4. Ensure deep linking is properly configured in `app.config.ts`

### Link Doesn't Work
- **Solution**:
  1. Verify the URL scheme is registered: Check `app.config.ts` for `scheme: "goodtimes"`
  2. Ensure the app is built with native code: `npx expo run:ios` (not just Expo Go)
  3. Check that the group ID is valid in Supabase

## Getting a Group ID

To get a group ID for testing:

1. Go to your Supabase Dashboard
2. Navigate to the `groups` table
3. Copy the `id` column value for any group
4. Use it in the invite link: `goodtimes://join/<that-id>`

## Quick Test Command

Replace `YOUR_GROUP_ID` with an actual group ID:

```bash
xcrun simctl openurl booted "goodtimes://join/YOUR_GROUP_ID"
```

This is the most reliable method and should work consistently.

