# Technical Audit: Background Resume vs Cold Start Session Handling

## Problem Statement

After long inactivity (1+ hour), when opening the app from background:
- **Black screen (12s)** → **Welcome screen (12s)** → **Home**
- Total: **24+ seconds**, multiple screen flashes, poor UX

When app is completely closed and reopened (cold start):
- **Boot screen (2s)** → **Home**
- Total: **2 seconds**, smooth, reliable

## Root Cause Analysis

### The Critical Difference

**Cold Start Flow:**
1. App initializes fresh
2. `AuthProvider` mounts, `onAuthStateChange` fires with initial session from storage
3. If session exists in storage → loads user immediately
4. Boot flow sees `user` exists → navigates to home
5. ✅ **Works perfectly**

**Background Resume Flow (After Long Inactivity):**
1. App resumes from background
2. Session expired while app was backgrounded (access token expired)
3. `onAuthStateChange` fires with `SIGNED_OUT` event (because access token is expired)
4. **CRITICAL BUG**: `AuthProvider` immediately clears user state (`setUser(null)`) on line 152
5. `ForegroundQueryRefresher` detects long inactivity → navigates to root
6. Boot flow runs → sees `user === null` → navigates to `welcome-1`
7. Session refresh fails because there's no session to refresh
8. ❌ **User sees welcome screen despite being logged in**

### The Fundamental Flaw

**We're conflating two different states:**
- **Expired Session** (access token expired, but refresh token might still be valid) → Should attempt refresh, keep user logged in
- **Explicit Logout** (user clicked "Sign Out") → Should clear state, go to welcome

**Current Behavior:**
- `SIGNED_OUT` event from Supabase fires for BOTH cases
- We treat both the same: clear user state immediately
- This is wrong - expired session should attempt refresh token restore first

### Evidence from Logs

```
Line 857: [AuthProvider] onAuthStateChange: event=SIGNED_OUT, hasSession=false
Line 858: Long inactivity detected (883 minutes)
Line 883: ForegroundQueryRefresher: Long inactivity detected
Line 904: [boot] Boot flow: No user found (neither AuthProvider nor session) - navigating to welcome
Line 919: ERROR [auth] refreshSession failed: Auth session missing!
```

**What's happening:**
1. Session expired while backgrounded
2. `SIGNED_OUT` fires → user state cleared
3. Boot flow sees no user → goes to welcome
4. Refresh fails because we already cleared the state

## Industry Best Practices Research

### How Other Apps Handle This

1. **Session Restoration State Pattern**
   - Don't immediately clear user state on `SIGNED_OUT`
   - Enter a "restoring session" state
   - Attempt refresh token restore
   - Only clear state if refresh fails AND it's an explicit logout

2. **Distinguish Expired vs Logged Out**
   - Track whether logout was explicit (`signOut()` called) vs implicit (session expired)
   - Only clear user state on explicit logout
   - For expired sessions, attempt refresh before clearing

3. **Optimistic Session Handling**
   - On app resume, assume session might be restorable
   - Show boot screen while attempting refresh
   - Only navigate to welcome if refresh definitively fails

4. **Refresh Token Persistence**
   - Supabase stores refresh tokens separately from access tokens
   - Refresh tokens have longer expiration (typically 30 days)
   - Even if access token expired, refresh token might still be valid
   - Should attempt `refreshSession()` before giving up

### Supabase-Specific Behavior

- `onAuthStateChange` fires `SIGNED_OUT` when access token expires
- But refresh token might still be valid in storage
- `supabase.auth.refreshSession()` can restore session using refresh token
- We should attempt this BEFORE clearing user state

## Proposed Solution

### Phase 1: Session Restoration Pattern (Immediate Fix)

**Core Principle:** Don't clear user state on `SIGNED_OUT` until we've attempted refresh token restore.

**Changes:**

1. **AuthProvider.tsx - Modify `onAuthStateChange` handler:**
   - When `SIGNED_OUT` fires, DON'T immediately clear user state
   - Instead, enter "restoring session" state
   - Attempt `supabase.auth.refreshSession()` to restore using refresh token
   - Only clear user state if:
     a) Refresh fails AND
     b) It's an explicit logout (tracked via flag)

2. **Track Explicit Logout:**
   - Add `isExplicitLogout` flag in `signOut()` function
   - Store in `AsyncStorage` temporarily
   - Check this flag before clearing user state on `SIGNED_OUT`

3. **Boot Flow - Trust Session Restoration:**
   - On boot, if `user` is null but we're in "restoring session" state, wait
   - Don't navigate to welcome immediately
   - Wait for session restoration attempt to complete
   - Only navigate to welcome if restoration definitively fails

### Phase 2: Optimistic Boot Screen (UX Improvement)

**Core Principle:** Show boot screen immediately on resume, attempt refresh in background.

**Changes:**

1. **ForegroundQueryRefresher:**
   - On long inactivity, navigate to root immediately (don't wait for AuthProvider)
   - Boot screen shows immediately
   - Session restoration happens in background

2. **Boot Flow:**
   - Show boot screen immediately
   - In parallel:
     a) Attempt session restoration (refresh token)
     b) Invalidate React Query cache
   - If restoration succeeds → navigate to home
   - If restoration fails → navigate to welcome
   - Maximum wait: 5 seconds (then proceed with best available state)

### Phase 3: Refresh Token Persistence Check (Reliability)

**Core Principle:** Check if refresh token exists before attempting refresh.

**Changes:**

1. **lib/auth.ts - Add `hasRefreshToken()` helper:**
   - Check if refresh token exists in Supabase storage
   - Use this to determine if session restoration is possible

2. **AuthProvider:**
   - Before clearing user state, check `hasRefreshToken()`
   - If refresh token exists → attempt restoration
   - If no refresh token → clear state (truly logged out)

## Implementation Plan

### Step 1: Add Explicit Logout Tracking
- Modify `signOut()` to set `AsyncStorage` flag: `explicit_logout: true`
- Clear flag after handling

### Step 2: Modify AuthProvider `onAuthStateChange`
- When `SIGNED_OUT` fires:
  - Check `explicit_logout` flag
  - If explicit → clear user state (current behavior)
  - If NOT explicit → attempt `refreshSession()` first
  - Only clear state if refresh fails

### Step 3: Add Session Restoration State
- Add `restoringSession: boolean` to AuthContext
- Set to `true` when attempting refresh on `SIGNED_OUT`
- Set to `false` when restoration completes (success or failure)

### Step 4: Update Boot Flow
- If `restoringSession === true`, wait for completion (max 5s)
- Don't navigate to welcome while restoration is in progress
- Show boot screen during restoration

### Step 5: Update ForegroundQueryRefresher
- Navigate to root immediately on long inactivity
- Don't wait for AuthProvider state
- Boot screen handles session restoration

## Expected Outcome

**After Fix:**
- Background resume: **Boot screen (2-3s)** → **Home**
- Cold start: **Boot screen (2s)** → **Home**
- Both flows identical, fast, reliable

**Key Improvement:**
- Session restoration happens BEFORE clearing user state
- User stays "logged in" during restoration attempt
- Only navigates to welcome if restoration definitively fails
- Matches cold start behavior exactly

## Testing Plan

1. **Test Case 1: Long Inactivity (1+ hour)**
   - Background app for 1+ hour
   - Open app
   - Expected: Boot screen → Home (not Welcome)

2. **Test Case 2: Explicit Logout**
   - User clicks "Sign Out"
   - Expected: Navigate to Welcome immediately

3. **Test Case 3: Expired Refresh Token**
   - Force refresh token expiration (30+ days)
   - Open app
   - Expected: Boot screen → Welcome (truly logged out)

4. **Test Case 4: Network Failure During Restoration**
   - Disable network
   - Background app for 1+ hour
   - Open app
   - Expected: Boot screen → Wait 5s → Navigate based on last known state

## Risk Assessment

**Low Risk:**
- Changes are additive (don't remove existing logic)
- Explicit logout still works (tracked separately)
- Fallback to current behavior if restoration fails

**Medium Risk:**
- Need to ensure `restoringSession` state is properly managed
- Need to prevent infinite restoration loops

**Mitigation:**
- Add timeout to restoration attempts (5 seconds max)
- Track restoration attempts to prevent loops
- Fallback to current behavior on any error

## Conclusion

The root cause is treating expired sessions the same as explicit logouts. The fix is to attempt refresh token restoration before clearing user state, matching how cold starts work (where session is loaded from storage immediately).

This is a well-solved problem in the industry - we just need to implement the session restoration pattern that other apps use.

