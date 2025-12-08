# Session Management Technical Audit

## Executive Summary

This audit identifies critical issues in the session management system that cause black screens and boot screen hangs after periods of inactivity. The root causes stem from **race conditions**, **conflicting session refresh logic**, and **incomplete session recovery handling**.

---

## Current Architecture Overview

### Components Involved

1. **`lib/session-lifecycle.ts`**: Tracks app open/close times, determines cold start vs warm start
2. **`components/AuthProvider.tsx`**: Manages auth state, listens to Supabase auth changes, refreshes session on foreground
3. **`app/index.tsx`**: Boot screen logic, routing decisions, session refresh on boot
4. **`lib/auth.ts`**: Session refresh utilities with retry logic and mutex protection
5. **`app/_layout.tsx`**: Notification handling, deep link handling

### Session Flow (Current)

```
App Opens
  ↓
AuthProvider.onAuthStateChange fires (async)
  ↓
app/index.tsx boot flow starts (parallel)
  ↓
Both try to refresh session (RACE CONDITION)
  ↓
Navigation happens based on user state
  ↓
Boot screen hides
```

---

## Critical Issues Identified

### Issue #1: Dual Session Refresh (Race Condition) ⚠️ CRITICAL

**Location**: `AuthProvider.tsx:192-243` AND `app/index.tsx:197-219`

**Problem**:
- `AuthProvider` refreshes session on foreground (line 209-231)
- `app/index.tsx` also refreshes session during boot (line 197-219)
- Both can run simultaneously, causing:
  - Multiple refresh attempts
  - Conflicting state updates
  - Navigation happening before session is ready
  - Black screen if navigation happens too early

**Evidence**:
```typescript
// AuthProvider.tsx:209-231
refreshTimeout = setTimeout(async () => {
  if (user) {
    setRefreshing(true)
    await ensureValidSession() // ← Refresh #1
  }
}, 500)

// app/index.tsx:197-219
if (user) {
  setSessionRefreshing(true)
  await ensureValidSession() // ← Refresh #2 (RACE!)
}
```

**Impact**: HIGH - Causes black screens and navigation failures

---

### Issue #2: hasNavigatedRef Reset on Foreground ⚠️ CRITICAL

**Location**: `app/index.tsx:104`

**Problem**:
- When app comes to foreground, `hasNavigatedRef.current` is reset to `false`
- This allows navigation to happen again, but:
  - If user is already on a valid screen, this can cause navigation loops
  - If session refresh fails, navigation may not happen, leaving user stuck
  - The reset happens BEFORE checking if navigation is needed

**Evidence**:
```typescript
// app/index.tsx:97-104
const subscription = AppState.addEventListener("change", async (nextAppState) => {
  if (nextAppState === "active") {
    await recordAppActive();
    hasNavigatedRef.current = false; // ← RESET (dangerous!)
    // ... then checks if navigation needed
  }
})
```

**Impact**: HIGH - Can cause navigation loops or prevent navigation

---

### Issue #3: Session Expiry Not Handled Gracefully ⚠️ CRITICAL

**Location**: `lib/auth.ts:140-245`, `app/index.tsx:197-219`

**Problem**:
- When session expires after inactivity:
  - `ensureValidSession()` may fail after retries
  - `app/index.tsx` continues boot flow even if session refresh failed
  - User may see boot screen but never navigate (stuck)
  - No fallback to sign-out and redirect to login

**Evidence**:
```typescript
// app/index.tsx:197-219
try {
  const sessionValid = await ensureValidSession();
  if (!sessionValid) {
    console.warn("[boot] Session refresh failed - user may need to sign in again");
    setBooting(false); // ← Just stops booting, doesn't navigate!
    return; // ← User stuck on boot screen
  }
} catch (error) {
  // Error logged but navigation continues anyway
}
```

**Impact**: HIGH - Causes boot screen hang (exact symptom reported)

---

### Issue #4: Boot Screen Logic Conflicts ⚠️ HIGH

**Location**: `app/index.tsx:175-509`

**Problem**:
- Multiple conditions control boot screen visibility:
  - `booting` state
  - `authLoading` from AuthProvider
  - `sessionRefreshing` state
  - `shouldShowBootScreen` state
  - `hasNoRoute` check (segments.length === 0)
  - Minimum display time (1 second)
- These can conflict:
  - Boot screen hides before navigation completes
  - Boot screen shows when it shouldn't
  - Multiple state updates cause flickering

**Evidence**:
```typescript
// app/index.tsx:520
const shouldShowBooting = booting || authLoading || sessionRefreshing || 
  (!err && hasNoRoute) || shouldShowBootScreen;

// But also:
// app/index.tsx:486-501
setTimeout(() => {
  setBooting(false);
  setShouldShowBootScreen(false);
}, remainingTime); // ← Can hide before navigation completes
```

**Impact**: MEDIUM-HIGH - Causes inconsistent UX and black screens

---

### Issue #5: Session Refresh Mutex May Not Prevent All Races ⚠️ MEDIUM

**Location**: `lib/auth.ts:4-6, 140-159`

**Problem**:
- Mutex (`refreshInProgress`) prevents concurrent refreshes within `ensureValidSession()`
- BUT: Multiple callers can still call `ensureValidSession()` simultaneously
- Race window exists between checking mutex and setting it
- If refresh fails, mutex is cleared, allowing immediate retry (may be too fast)

**Evidence**:
```typescript
// lib/auth.ts:140-159
if (refreshInProgress && refreshPromise) {
  // Wait for existing refresh
} else {
  // Start new refresh
  refreshInProgress = true; // ← Race window here
  refreshPromise = (async () => { ... })()
}
```

**Impact**: MEDIUM - Can cause multiple refresh attempts

---

### Issue #6: Notification Handling May Skip Boot Screen ⚠️ MEDIUM

**Location**: `app/_layout.tsx:182-285`

**Problem**:
- When notification is clicked:
  - If app is already initialized, navigation happens directly (line 242-280)
  - This bypasses boot screen and session refresh
  - If session expired while app was closed, user may navigate with invalid session
  - Boot screen logic in `app/index.tsx` may not run if navigation happens first

**Evidence**:
```typescript
// app/_layout.tsx:216-228
if (isAppInitialized) {
  // App is already running - navigate directly
  shouldNavigateDirectly = true // ← Skips boot screen!
} else {
  // Boot screen will handle navigation
}
```

**Impact**: MEDIUM - Can cause navigation with expired session

---

### Issue #7: Inactivity Detection May Not Trigger Properly ⚠️ MEDIUM

**Location**: `lib/session-lifecycle.ts:173-200`, `app/index.tsx:107`

**Problem**:
- `wasInactiveTooLong()` checks `LAST_APP_ACTIVE_TIME_KEY`
- But `recordAppActive()` is called:
  - On boot (line 84)
  - On foreground (line 100)
  - On background (line 166) ← This updates active time when going inactive!
- If app is killed (not backgrounded), `recordAppClose()` may not be called
- Inactivity check may not work correctly if app was force-killed

**Evidence**:
```typescript
// app/index.tsx:164-167
} else if (nextAppState === "background" || nextAppState === "inactive") {
  await recordAppActive(); // ← Updates active time when going inactive!
}
```

**Impact**: MEDIUM - Inactivity detection may not work correctly

---

## Root Cause Analysis

### Primary Root Cause: **Session State Management Confusion**

The app has **two competing systems** trying to manage sessions:

1. **AuthProvider**: Refreshes on foreground, manages auth state
2. **app/index.tsx**: Refreshes on boot, manages routing

**Why this causes black screens**:
- If `AuthProvider` refreshes session but `app/index.tsx` doesn't wait for it → navigation happens with stale state
- If `app/index.tsx` refreshes but `AuthProvider` hasn't updated user state → navigation happens but user is null
- If both refresh simultaneously → race condition, unpredictable state
- If refresh fails → no fallback, user stuck on boot screen

### Secondary Root Cause: **Incomplete Error Recovery**

When session refresh fails:
- Boot screen stays visible (good)
- But navigation never happens (bad)
- No fallback to sign-out and redirect to login
- User is stuck

### Tertiary Root Cause: **hasNavigatedRef Logic Flaw**

Resetting `hasNavigatedRef` on foreground assumes navigation should happen again, but:
- If user is already on valid screen → unnecessary navigation attempt
- If session refresh fails → navigation won't happen, ref stays false
- Creates navigation loops or prevents navigation

---

## Expected Behavior (What Should Happen)

### Scenario 1: App Opens After Short Inactivity (< 5 min)
1. App opens
2. AuthProvider checks session (via `onAuthStateChange`)
3. If session valid → Quick resume, no boot screen
4. If session expired → Refresh session, show boot screen briefly
5. Navigate to appropriate screen

### Scenario 2: App Opens After Long Inactivity (> 30 min)
1. App opens
2. Detect cold start (via `wasInactiveTooLong()`)
3. Show boot screen
4. Refresh session (may fail if expired)
5. If refresh succeeds → Navigate to home
6. If refresh fails → Sign out, navigate to login

### Scenario 3: App Opens from Notification
1. Notification clicked
2. Store notification data
3. Show boot screen
4. Refresh session
5. If session valid → Navigate to notification target
6. If session expired → Sign out, navigate to login (then handle notification after login)

### Scenario 4: Session Expires While App Closed
1. App opens
2. Show boot screen
3. Try to refresh session
4. Refresh fails (session expired)
5. **CRITICAL**: Retry refresh with exponential backoff (up to 3 attempts)
6. If refresh succeeds → Navigate to home
7. If refresh fails after retries → Keep user logged in, use stored session if valid, navigate to home
8. **DO NOT** sign out user or navigate to login (users stay logged in unless they explicitly log out)

---

## Current Behavior (What Actually Happens)

### Scenario 1: App Opens After Short Inactivity
✅ **Works correctly** - Quick resume, no issues

### Scenario 2: App Opens After Long Inactivity
❌ **FAILS** - Boot screen shows but navigation never happens (stuck)

### Scenario 3: App Opens from Notification
⚠️ **PARTIAL** - May skip boot screen if app was initialized, may navigate with expired session

### Scenario 4: Session Expires While App Closed
❌ **FAILS** - Boot screen shows, refresh fails, but no retry logic or navigation (stuck on boot screen)
**Note**: Should NOT sign out user - should retry refresh and keep user logged in

---

## Recommended Solutions

### Solution Option 1: Single Source of Truth (Recommended) ⭐

**Principle**: `AuthProvider` handles ALL session management, `app/index.tsx` only routes

**Changes**:
1. Remove session refresh from `app/index.tsx` boot flow
2. `AuthProvider` handles all session refreshes (on foreground, on boot)
3. `app/index.tsx` waits for `AuthProvider` to finish loading before routing
4. **CRITICAL**: If session refresh fails, keep user logged in and retry - DO NOT auto-logout
5. `app/index.tsx` routes based on `user` state (null → login, exists → home)

**Pros**:
- Eliminates race conditions
- Single source of truth
- Clear error handling
- Simpler logic
- Maintains user session (no unexpected logouts)

**Cons**:
- Requires refactoring
- Need to ensure AuthProvider handles all cases
- Need robust retry logic for failed refreshes

**Risk**: MEDIUM (requires careful testing)

**Important**: This solution maintains user sessions. Users stay logged in unless they explicitly log out. Failed session refreshes should trigger retries, not auto-logout.

---

### Solution Option 2: Explicit Session State Machine

**Principle**: Add explicit session states (loading, valid, expired, refreshing)

**Changes**:
1. Add `sessionState: 'loading' | 'valid' | 'expired' | 'refreshing'` to AuthProvider
2. `app/index.tsx` waits for `sessionState === 'valid'` before routing
3. If `sessionState === 'expired'`, sign out and navigate to login
4. Boot screen shows while `sessionState !== 'valid'`

**Pros**:
- Clear state management
- Easy to debug
- Prevents navigation with invalid session

**Cons**:
- More complex state management
- Need to update all session checks

**Risk**: MEDIUM-HIGH (requires state machine implementation)

---

### Solution Option 3: Fix Current System (Quick Fix)

**Principle**: Keep current architecture but fix critical bugs

**Changes**:
1. Remove `hasNavigatedRef` reset on foreground (only reset on actual navigation)
2. **IMPORTANT**: If session refresh fails → Retry with exponential backoff → Keep user logged in (DO NOT auto-logout)
3. Add mutex to prevent dual refresh (wait for AuthProvider refresh before boot refresh)
4. Ensure boot screen stays visible until navigation completes

**Pros**:
- Minimal changes
- Quick to implement
- Lower risk
- Maintains current session persistence behavior

**Cons**:
- Doesn't solve root cause (dual refresh)
- May still have edge cases
- Retry logic adds complexity

**Risk**: LOW-MEDIUM (band-aid fix)

**Important**: This solution maintains user sessions. Users stay logged in unless they explicitly log out.

---

## Recommended Approach: Hybrid (Option 1 + Critical Fixes)

### Phase 1: Critical Fixes (Immediate)
1. ✅ Remove `hasNavigatedRef` reset on foreground
2. ✅ **IMPORTANT**: If session refresh fails → Retry with exponential backoff → Keep user logged in (DO NOT auto-logout)
3. ✅ Ensure boot screen stays visible until navigation completes
4. ✅ Add comprehensive logging to track session refresh flow

### Phase 2: Refactor (Next)

**Risk Assessment**: MEDIUM-HIGH

**Pros**:
- ✅ Eliminates race conditions completely
- ✅ Single source of truth for session management
- ✅ Cleaner separation of concerns
- ✅ Easier to debug and maintain
- ✅ Better error handling centralization
- ✅ Maintains user sessions (no unexpected logouts)

**Cons**:
- ⚠️ Requires significant refactoring
- ⚠️ Need to ensure AuthProvider handles all edge cases
- ⚠️ Need robust retry logic for failed refreshes
- ⚠️ May require changes to how other components access session state
- ⚠️ Testing required for all scenarios

**Risks**:
1. **Breaking existing behavior**: If not implemented carefully, could break current working flows
2. **Session persistence**: Must ensure users stay logged in unless they explicitly log out
3. **Error handling**: Need robust retry logic - failed refreshes should retry, not logout
4. **Testing complexity**: Need to test all scenarios (short inactivity, long inactivity, expired sessions, network failures)

**Mitigation**:
- Implement incrementally with feature flags
- Comprehensive testing before shipping
- Keep fallback to current behavior if refactor fails
- Extensive logging to track behavior

**Changes**:
1. ✅ Move all session refresh to `AuthProvider` (single source of truth)
2. ✅ Remove session refresh from `app/index.tsx` boot flow
3. ✅ `app/index.tsx` only routes based on `user` state from AuthProvider
4. ✅ Add session state tracking (loading, valid, expired, refreshing)
5. ✅ **CRITICAL**: Implement retry logic - failed refreshes retry with backoff, DO NOT auto-logout
6. ✅ Keep user logged in unless they explicitly sign out

**Important**: Phase 2 maintains the current behavior of keeping users logged in. Users should NEVER be auto-logged out unless they explicitly tap "Log out". Failed session refreshes should trigger retries, not logout.

---

## Test Plan

### Test Case 1: Short Inactivity (< 5 min)
**Steps**:
1. Open app, log in
2. Close app (home button)
3. Wait 2 minutes
4. Reopen app

**Expected**: Quick resume, no boot screen, navigates to home

**Current**: ✅ Works

---

### Test Case 2: Long Inactivity (> 30 min)
**Steps**:
1. Open app, log in
2. Close app (home button)
3. Wait 35 minutes (or force session expiry)
4. Reopen app

**Expected**: Boot screen shows, session refreshes, navigates to home (or login if expired)

**Current**: ❌ Boot screen shows, navigation never happens

**How to Test**:
```bash
# In simulator, after closing app:
# Option 1: Wait 30+ minutes (realistic but slow)
# Option 2: Manually expire session in database (requires DB access)
# Option 3: Add test command to force session expiry (recommended)
```

---

### Test Case 3: Session Expired (Force Expiry)
**Steps**:
1. Open app, log in
2. Manually expire session (via test command or DB)
3. Close app
4. Reopen app

**Expected**: Boot screen shows, refresh fails, signs out, navigates to login

**Current**: ❌ Boot screen shows, refresh fails, stuck on boot screen

**How to Test**:
```bash
# Add test command to clear/expire session:
# Option 1: Clear AsyncStorage session data
# Option 2: Call supabase.auth.signOut() programmatically
# Option 3: Add dev menu option to "Expire Session"
```

---

### Test Case 4: Notification Click (App Closed)
**Steps**:
1. Close app completely
2. Send push notification
3. Click notification
4. App opens

**Expected**: Boot screen shows, session refreshes, navigates to notification target

**Current**: ⚠️ May skip boot screen if app was "initialized"

**How to Test**:
```bash
# In simulator:
# 1. Close app completely (swipe up)
# 2. Send test notification (via backend or test tool)
# 3. Click notification
# 4. Observe boot flow
```

---

### Test Case 5: Notification Click (App Backgrounded)
**Steps**:
1. Open app, background it (home button)
2. Send push notification
3. Click notification
4. App comes to foreground

**Expected**: Quick resume, navigates to notification target (no boot screen)

**Current**: ✅ Works (but may have session refresh race)

---

### Test Case 6: Force Kill App
**Steps**:
1. Open app, log in
2. Force kill app (swipe up in app switcher)
3. Wait 5+ minutes
4. Reopen app

**Expected**: Boot screen shows (cold start), session refreshes, navigates

**Current**: ⚠️ May not detect as cold start if `recordAppClose()` wasn't called

---

## Testing Commands & Utilities Needed

### 1. Force Session Expiry Command
```typescript
// Add to dev menu or test utility
async function forceSessionExpiry() {
  // Clear session from AsyncStorage
  await AsyncStorage.removeItem('supabase.auth.token')
  // Or call signOut
  await supabase.auth.signOut()
  console.log('[TEST] Session expired - restart app to test')
}
```

### 2. Clear Session Lifecycle Data
```typescript
// Already exists: lib/session-lifecycle.ts:206
await clearSessionLifecycle()
```

### 3. Simulate Long Inactivity
```typescript
// Modify LAST_APP_CLOSE_TIME to be 30+ minutes ago
async function simulateLongInactivity() {
  const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000)
  await AsyncStorage.setItem('last_app_close_time', thirtyMinutesAgo.toString())
  console.log('[TEST] Simulated 30+ min inactivity - restart app')
}
```

### 4. Log Session State
```typescript
// Add comprehensive logging
async function logSessionState() {
  const session = await getCurrentSession()
  const lastClose = await getLastAppCloseTime()
  const lastActive = await getLastAppActiveTime()
  const isCold = await isColdStart()
  const inactiveTooLong = await wasInactiveTooLong()
  
  console.log('[SESSION STATE]', {
    hasSession: !!session,
    sessionExpiresAt: session?.expires_at,
    lastCloseTime: lastClose ? new Date(lastClose).toISOString() : null,
    lastActiveTime: lastActive ? new Date(lastActive).toISOString() : null,
    isColdStart: isCold,
    inactiveTooLong,
  })
}
```

---

## Implementation Priority

### P0 (Critical - Fix Immediately)
1. ✅ Add fallback: If session refresh fails → sign out → navigate to login
2. ✅ Remove `hasNavigatedRef` reset on foreground (only reset on actual navigation)
3. ✅ Ensure boot screen stays visible until navigation completes
4. ✅ Add comprehensive logging for session flow

### P1 (High - Fix Soon)
1. ✅ Move all session refresh to `AuthProvider` (single source of truth)
2. ✅ Remove session refresh from `app/index.tsx` boot flow
3. ✅ Add session state tracking (loading, valid, expired, refreshing)

### P2 (Medium - Nice to Have)
1. ✅ Improve inactivity detection (handle force-kill case)
2. ✅ Add test utilities for forcing session expiry
3. ✅ Add dev menu for testing session scenarios

---

## Success Criteria

✅ **No black screens** - Boot screen always shows when needed
✅ **No stuck boot screens** - Navigation always completes or redirects to login
✅ **No race conditions** - Single source of truth for session management
✅ **Proper error handling** - Expired sessions redirect to login
✅ **Testable** - Can simulate all scenarios in simulator
✅ **Reliable** - Works consistently after inactivity periods

---

## Next Steps

1. **Review this audit** with team
2. **Choose solution approach** (recommend Option 1 + Critical Fixes)
3. **Implement P0 fixes** first (quick wins)
4. **Add test utilities** for simulator testing
5. **Test all scenarios** in simulator before shipping
6. **Implement P1 refactor** (single source of truth)
7. **Final testing** and validation

---

## Questions to Answer

1. **What happens if `ensureValidSession()` times out?** (Currently: returns false, but boot flow may continue)
2. **Should we show boot screen on every foreground, or only after inactivity?** (Currently: shows on every foreground if inactive)
3. **What's the expected behavior if session refresh fails but user data exists?** (Currently: unclear)
4. **Should notifications always trigger boot screen, or only if app was closed?** (Currently: conditional)

---

## Appendix: Code Flow Diagrams

### Current Flow (Problematic)
```
App Opens
  ├─ AuthProvider.onAuthStateChange (async)
  │   └─ Refresh session on foreground
  │
  └─ app/index.tsx boot flow (parallel)
      ├─ Check session lifecycle
      ├─ Refresh session (RACE!)
      ├─ Check user/profile/group
      └─ Navigate
          └─ hasNavigatedRef prevents re-navigation
              └─ BUT: Reset on foreground! (BUG)
```

### Recommended Flow
```
App Opens
  └─ AuthProvider.onAuthStateChange (single source)
      ├─ Check session
      ├─ Refresh if needed (with mutex)
      ├─ Update user state
      └─ If expired → Sign out → user = null
          │
          └─ app/index.tsx waits for AuthProvider
              ├─ If user === null → Navigate to login
              └─ If user exists → Navigate to home
                  └─ Boot screen shows until navigation completes
```

---

**Document Version**: 1.0  
**Date**: 2025-12-07  
**Author**: Technical Audit  
**Status**: Ready for Review

