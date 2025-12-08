# Session Management Testing Plan

## Overview

This document provides step-by-step testing procedures to validate session management fixes in the iOS Simulator. It includes commands to force test scenarios and logging strategies to verify behavior.

---

## Prerequisites

1. **iOS Simulator running** (any iPhone model)
2. **App installed** via `npx expo run:ios` or EAS build
3. **Metro bundler running** (for logging)
4. **User account** with valid session

---

## Test Utilities Setup

### Option 1: Dev Tools in Settings Screen (Recommended) ✅ IMPLEMENTED

Test utilities are now available in the Settings screen (dev mode only):

1. Open app → Settings
2. Scroll to "Session Testing" section (dev mode only)
3. Use buttons to:
   - **Log Session State**: View current session state in alert and console
   - **Force Session Expiry**: Clear session to test expired session flow
   - **Simulate Long Inactivity**: Set inactivity time (default 35 min)
   - **Clear All Session Data**: Clear all session lifecycle data

**Usage**:
1. Open Settings screen
2. Scroll to "Session Testing" section
3. Tap buttons to test scenarios
4. Check console logs for detailed information
5. Restart app to test the scenario

**Note**: All test utilities log detailed information to console. Use Metro bundler or `npx react-native log-ios` to view logs.

---

### Option 2: Console Commands (Alternative)

Test utilities are also available in React Native Debugger console:

```typescript
// lib/test-session-utils.ts (already created)
import AsyncStorage from "@react-native-async-storage/async-storage"
import { supabase } from "./supabase"
import { 
  clearSessionLifecycle, 
  getLastAppCloseTime,
  getLastAppActiveTime,
  isColdStart,
  wasInactiveTooLong 
} from "./session-lifecycle"
import { getCurrentSession } from "./auth"

export async function logSessionState() {
  const session = await getCurrentSession()
  const lastClose = await getLastAppCloseTime()
  const lastActive = await getLastAppActiveTime()
  const isCold = await isColdStart()
  const inactiveTooLong = await wasInactiveTooLong()
  
  const state = {
    hasSession: !!session,
    sessionExpiresAt: session?.expires_at 
      ? new Date(session.expires_at * 1000).toISOString() 
      : null,
    sessionExpiresIn: session?.expires_at 
      ? Math.floor((session.expires_at * 1000 - Date.now()) / 1000 / 60) 
      : null,
    lastCloseTime: lastClose ? new Date(lastClose).toISOString() : null,
    lastActiveTime: lastActive ? new Date(lastActive).toISOString() : null,
    isColdStart: isCold,
    inactiveTooLong,
    timeSinceClose: lastClose 
      ? Math.floor((Date.now() - lastClose) / 1000 / 60) 
      : null,
    timeSinceActive: lastActive 
      ? Math.floor((Date.now() - lastActive) / 1000 / 60) 
      : null,
  }
  
  console.log('[TEST] Session State:', JSON.stringify(state, null, 2))
  return state
}

export async function forceSessionExpiry() {
  console.log('[TEST] Forcing session expiry...')
  try {
    // Clear session from AsyncStorage
    await AsyncStorage.removeItem('supabase.auth.token')
    // Also clear any other session-related keys
    const keys = await AsyncStorage.getAllKeys()
    const sessionKeys = keys.filter(k => k.includes('supabase') || k.includes('auth'))
    await AsyncStorage.multiRemove(sessionKeys)
    console.log('[TEST] ✅ Session cleared. Restart app to test expired session flow.')
  } catch (error) {
    console.error('[TEST] ❌ Failed to clear session:', error)
  }
}

export async function simulateLongInactivity(minutes: number = 35) {
  console.log(`[TEST] Simulating ${minutes} minutes of inactivity...`)
  try {
    const timeAgo = Date.now() - (minutes * 60 * 1000)
    await AsyncStorage.setItem('last_app_close_time', timeAgo.toString())
    await AsyncStorage.setItem('last_app_active_time', timeAgo.toString())
    console.log(`[TEST] ✅ Set last close/active time to ${minutes} minutes ago. Restart app to test.`)
  } catch (error) {
    console.error('[TEST] ❌ Failed to simulate inactivity:', error)
  }
}

export async function clearAllSessionData() {
  console.log('[TEST] Clearing all session lifecycle data...')
  try {
    await clearSessionLifecycle()
    await forceSessionExpiry()
    console.log('[TEST] ✅ All session data cleared. Restart app to test cold start.')
  } catch (error) {
    console.error('[TEST] ❌ Failed to clear session data:', error)
  }
}

// Make available globally for console access
if (__DEV__) {
  (global as any).testSession = {
    logState: logSessionState,
    forceExpiry: forceSessionExpiry,
    simulateInactivity: simulateLongInactivity,
    clearAll: clearAllSessionData,
  }
}
```

Then import this in `app/_layout.tsx`:

```typescript
// Add to app/_layout.tsx imports
if (__DEV__) {
  require("../lib/test-session-utils")
}
```

**Usage in React Native Debugger Console** (if needed):
```javascript
// Log current session state
testSession.logState()

// Force session expiry
testSession.forceExpiry()

// Simulate 35 minutes of inactivity
testSession.simulateInactivity(35)

// Clear all session data
testSession.clearAll()
```

**Note**: Prefer using the Settings screen UI for testing - it's easier and shows results in alerts.

---

### Option 3: Terminal Commands (Alternative)

If you prefer terminal commands, you can use `xcrun simctl` to interact with the simulator:

```bash
# Get simulator device ID
xcrun simctl list devices | grep Booted

# Clear app data (forces cold start)
xcrun simctl uninstall booted com.jarydhermann.goodtimes

# Reinstall app
# (Then run: npx expo run:ios)
```

**Note**: This clears ALL app data, not just session data. Use Option 1 for more granular control.

---

## Test Scenarios

### Test 1: Short Inactivity (< 5 minutes) ✅ Baseline

**Purpose**: Verify quick resume works correctly

**Steps**:
1. Open app, ensure logged in
2. Navigate to home screen
3. Press home button (background app)
4. Wait 2 minutes
5. Reopen app (tap app icon)

**Expected Behavior**:
- ✅ No boot screen (or very brief flash)
- ✅ App resumes immediately to home screen
- ✅ No session refresh needed
- ✅ Logs show: `isColdStart: false`, `inactiveTooLong: false`

**Logs to Check**:
```
[boot] Boot screen initialized - always showing boot screen
[boot] AuthProvider loaded, user: true
[boot] User exists - refreshing session to ensure validity...
[boot] Session refreshed successfully
[boot] user with group → (main)/home
```

**Success Criteria**: App resumes without boot screen, no delays

---

### Test 2: Long Inactivity (> 30 minutes) ⚠️ CRITICAL

**Purpose**: Verify cold start with session refresh works

**Steps**:
1. Open app, ensure logged in
2. Navigate to Settings screen
3. Scroll to "Session Testing" section
4. Tap "Simulate Long Inactivity" button
5. Enter `35` (or desired minutes) and tap "Simulate"
6. Close app completely (swipe up in app switcher)
7. Reopen app (tap app icon)

**Expected Behavior**:
- ✅ Boot screen shows
- ✅ Session refreshes successfully
- ✅ Navigates to home screen
- ✅ Boot screen hides after navigation completes
- ✅ Logs show: `isColdStart: true` OR `inactiveTooLong: true`

**Logs to Check**:
```
[session-lifecycle] Inactivity check: { wasTooLong: true, ... }
[boot] App came to foreground from long inactivity - forcing boot screen and session refresh
[boot] Session refreshed successfully
[boot] user with group → (main)/home
[boot] Recorded successful navigation to: /(main)/home
```

**Success Criteria**: Boot screen shows, session refreshes, navigation completes

**Failure Modes**:
- ❌ Boot screen shows but navigation never happens (STUCK)
- ❌ Black screen instead of boot screen
- ❌ Session refresh fails but no fallback

---

### Test 3: Expired Session (Force Expiry) ⚠️ CRITICAL

**Purpose**: Verify expired session handling and redirect to login

**Steps**:
1. Open app, ensure logged in
2. Navigate to Settings screen
3. Scroll to "Session Testing" section
4. Tap "Force Session Expiry" button
5. Confirm by tapping "Clear Session"
6. Close app completely (swipe up in app switcher)
7. Reopen app (tap app icon)

**Expected Behavior**:
- ✅ Boot screen shows
- ✅ Session refresh fails (session expired)
- ✅ User is signed out (`user = null`)
- ✅ Navigates to login screen (`/(onboarding)/welcome-1`)
- ✅ Boot screen hides after navigation

**Logs to Check**:
```
[boot] User exists - refreshing session to ensure validity...
[auth] ensureValidSession: refresh failed after retries: ...
[boot] Session refresh failed - user may need to sign in again
[AuthProvider] onAuthStateChange: event=SIGNED_OUT, hasSession=false
[boot] No user → onboarding/welcome-1
```

**Success Criteria**: Expired session redirects to login, no stuck boot screen

**Failure Modes**:
- ❌ Boot screen shows but navigation never happens (STUCK)
- ❌ Session refresh fails but user state not cleared
- ❌ No navigation to login screen

---

### Test 4: Notification Click (App Closed) ⚠️ IMPORTANT

**Purpose**: Verify notification handling when app is closed

**Steps**:
1. Open app, ensure logged in
2. Close app completely (swipe up in app switcher)
3. Send test push notification (via backend or test tool)
4. Click notification
5. App opens

**Expected Behavior**:
- ✅ Boot screen shows
- ✅ Session refreshes
- ✅ Navigates to notification target (e.g., entry detail)
- ✅ Boot screen hides after navigation

**Logs to Check**:
```
[_layout] Notification clicked - storing for boot screen to handle
[boot] App opened from notification - forcing boot screen and session refresh
[boot] Session refreshed after notification click
[boot] Processing pending notification: new_entry
[boot] Session validated successfully for notification navigation
[boot] Recorded successful navigation to: /(main)/modals/entry-detail
```

**Success Criteria**: Notification opens correct screen, session valid

**Failure Modes**:
- ❌ Navigation happens with expired session
- ❌ Boot screen skipped (should show)
- ❌ Wrong screen navigated to

---

### Test 5: Notification Click (App Backgrounded) ✅ Baseline

**Purpose**: Verify notification handling when app is backgrounded

**Steps**:
1. Open app, ensure logged in
2. Navigate to home screen
3. Press home button (background app)
4. Send test push notification
5. Click notification
6. App comes to foreground

**Expected Behavior**:
- ✅ No boot screen (quick resume)
- ✅ Navigates to notification target
- ✅ Session refresh happens in background (if needed)

**Logs to Check**:
```
[_layout] Notification clicked - storing for boot screen to handle
[_layout] App already initialized - will navigate directly
[AuthProvider] App came to foreground - refreshing session to ensure validity...
```

**Success Criteria**: Quick navigation to notification target, no boot screen

---

### Test 6: Force Kill App ⚠️ EDGE CASE

**Purpose**: Verify app handles force-kill correctly

**Steps**:
1. Open app, ensure logged in
2. Navigate to home screen
3. Double-tap home button (or swipe up on newer iOS)
4. Swipe up on app card (force kill)
5. Wait 5+ minutes
6. Reopen app (tap app icon)

**Expected Behavior**:
- ✅ Boot screen shows (cold start)
- ✅ Session refreshes
- ✅ Navigates to home screen
- ✅ OR: If session expired, navigates to login

**Logs to Check**:
```
[session-lifecycle] Cold start check: { isCold: true, ... }
[boot] Boot screen initialized - always showing boot screen
[boot] User exists - refreshing session to ensure validity...
```

**Success Criteria**: App handles force-kill correctly, no black screen

**Failure Modes**:
- ❌ `recordAppClose()` not called → may not detect as cold start
- ❌ Boot screen doesn't show
- ❌ Navigation doesn't happen

---

### Test 7: Network Failure During Refresh ⚠️ EDGE CASE

**Purpose**: Verify graceful handling of network failures

**Steps**:
1. Open app, ensure logged in
2. Enable airplane mode (or disable WiFi)
3. Close app
4. Wait 5+ minutes
5. Reopen app

**Expected Behavior**:
- ✅ Boot screen shows
- ✅ Session refresh attempts (with retries)
- ✅ If refresh fails after retries:
  - ✅ Check stored session (may still be valid)
  - ✅ If stored session valid → Use it, navigate
  - ✅ If stored session expired → Sign out, navigate to login
- ✅ No stuck boot screen

**Logs to Check**:
```
[auth] refreshSession timeout/network error (attempt 1/3), retrying in 1000ms...
[auth] refreshSession failed after 3 attempt(s): timeout
[auth] Session exists in storage despite refresh failure, checking validity...
[auth] Stored session is still valid, continuing with it
```

**Success Criteria**: Network failure doesn't cause stuck boot screen

---

## Logging Strategy

### Enhanced Logging Points

Add these log statements to track session flow:

**In `lib/auth.ts`**:
```typescript
console.log('[auth] ensureValidSession: start', { 
  refreshInProgress, 
  hasExistingPromise: !!refreshPromise 
})
console.log('[auth] ensureValidSession: session expired check', { expired })
console.log('[auth] ensureValidSession: refresh result', { success: !!result })
```

**In `app/index.tsx`**:
```typescript
console.log('[boot] Boot flow: start', { 
  authLoading, 
  hasUser: !!user, 
  segmentsLength: segments.length,
  hasNavigated: hasNavigatedRef.current 
})
console.log('[boot] Boot flow: session refresh', { 
  sessionValid, 
  error: error?.message 
})
console.log('[boot] Boot flow: navigation', { 
  route, 
  success: true 
})
```

**In `components/AuthProvider.tsx`**:
```typescript
console.log('[AuthProvider] onAuthStateChange', { 
  event, 
  hasSession: !!session, 
  userId: session?.user?.id 
})
console.log('[AuthProvider] Foreground refresh', { 
  hasUser: !!user, 
  refreshing 
})
```

### Log Filtering

Use these filters in Metro bundler or terminal:

```bash
# Filter for boot flow logs
npx react-native log-ios | grep "\[boot\]"

# Filter for auth logs
npx react-native log-ios | grep "\[auth\]"

# Filter for session lifecycle logs
npx react-native log-ios | grep "\[session-lifecycle\]"

# Filter for AuthProvider logs
npx react-native log-ios | grep "\[AuthProvider\]"

# Filter for all session-related logs
npx react-native log-ios | grep -E "\[boot\]|\[auth\]|\[session|\[AuthProvider\]"
```

---

## Test Checklist

Use this checklist when testing:

### Pre-Test Setup
- [ ] App installed in simulator
- [ ] User logged in
- [ ] Settings screen accessible (for test utilities)
- [ ] Logging enabled (Metro bundler running)
- [ ] Log filters ready (see Logging Strategy section)

### Test Execution
- [ ] Test 1: Short inactivity (< 5 min) - ✅ PASS
- [ ] Test 2: Long inactivity (> 30 min) - ⚠️ CRITICAL
- [ ] Test 3: Expired session - ⚠️ CRITICAL
- [ ] Test 4: Notification (app closed) - ⚠️ IMPORTANT
- [ ] Test 5: Notification (app backgrounded) - ✅ PASS
- [ ] Test 6: Force kill app - ⚠️ EDGE CASE
- [ ] Test 7: Network failure - ⚠️ EDGE CASE

### Post-Test Validation
- [ ] No black screens observed
- [ ] No stuck boot screens observed
- [ ] All navigation completes successfully
- [ ] Expired sessions redirect to login
- [ ] Logs show expected flow

---

## Troubleshooting

### Issue: Can't access test utilities

**Solution**: Ensure `__DEV__` is true and utilities are imported in `_layout.tsx`

### Issue: Logs not showing

**Solution**: 
- Check Metro bundler is running
- Use `npx react-native log-ios` in separate terminal
- Check log filters are correct

### Issue: Simulator not responding

**Solution**:
- Reset simulator: `xcrun simctl shutdown all && xcrun simctl boot "iPhone 15"`
- Or restart simulator manually

### Issue: Session not expiring

**Solution**:
- Check AsyncStorage keys: `testSession.logState()`
- Manually clear: `testSession.forceExpiry()`
- Verify session expiry time in logs

---

## Success Metrics

### Quantitative
- ✅ 0 black screens in 10 test runs
- ✅ 0 stuck boot screens in 10 test runs
- ✅ 100% navigation success rate
- ✅ < 3 second boot screen display time (for valid sessions)

### Qualitative
- ✅ Smooth user experience
- ✅ Predictable behavior
- ✅ Clear error handling
- ✅ No confusion or frustration

---

## Next Steps After Testing

1. **Document Results**: Record which tests pass/fail
2. **Fix Issues**: Address any failures found
3. **Re-test**: Run failed tests again after fixes
4. **Production Testing**: Test on real device before release
5. **Monitor**: Add analytics to track session issues in production

---

**Document Version**: 1.0  
**Date**: 2025-12-07  
**Status**: Ready for Use

