# Session Timeout Issue - Explanation & Solution

## What's Happening: The Current Flow

### The Error You're Seeing

```
ERROR [auth] ensureValidSession failed: refreshSession timeout
```

### Current Flow When Session Expires

1. **App Resumes** (from background/inactive)
   - `AuthProvider` detects app state change
   - Calls `ensureValidSession()` after 500ms delay
   - Only runs if `user` state exists (⚠️ **RACE CONDITION**)

2. **Session Refresh Attempt** (`lib/auth.ts`)
   ```
   ensureValidSession()
     → isSessionExpired() checks if session expires in < 5 minutes
     → If expired, calls refreshSession()
     → refreshSession() has 10s timeout
     → If timeout occurs → throws error
     → ensureValidSession() catches error → returns false
   ```

3. **What Happens After Refresh Fails**
   - `AuthProvider` logs warning: "Failed to refresh session on app resume"
   - **BUT**: User state is NOT cleared
   - **BUT**: No navigation happens
   - User stays on current screen
   - **Session is actually expired** but app doesn't know it

4. **The Problem**
   - User sees no error (just console log)
   - User continues using app
   - Next API call fails with 401/403
   - App might show error or get stuck
   - User thinks app is broken

### Why Timeout Happens

**Possible Causes:**
1. **Slow Network** - Simulator/device has slow connection
2. **Supabase API Slow** - Supabase refresh endpoint taking > 10s
3. **Network Interruption** - Brief network hiccup during refresh
4. **Simulator Issues** - iOS Simulator network stack can be slow

**The 10s timeout is actually reasonable**, but the problem is:
- **No retry logic** - Single failure = logged out
- **No graceful degradation** - App doesn't handle failure well
- **No user feedback** - User doesn't know what's happening

---

## The Pattern You Want: "Soft Reload"

### How Other Apps Handle This

**Common Pattern:**
1. **Detect Session Expired** → Show loading/boot screen
2. **Attempt Refresh** → Try to refresh session in background
3. **If Success** → Continue normally (user barely notices)
4. **If Failure** → Show brief loading, then redirect to login (only if truly expired)

**Key Principles:**
- ✅ **Don't immediately log out** on first failure
- ✅ **Show loading state** so user knows something is happening
- ✅ **Retry once** before giving up
- ✅ **Distinguish** between network errors and actual auth failures
- ✅ **Smooth transition** - no jarring redirects

---

## Current Issues in Your Code

### Issue 1: Silent Failure
```typescript
// AuthProvider.tsx:178
const refreshed = await ensureValidSession()
if (!refreshed) {
  console.warn("[AuthProvider] Failed to refresh session on app resume")
  // ⚠️ PROBLEM: Nothing happens! User stays logged in but session is expired
}
```

**Problem:** User state not cleared, no navigation, user doesn't know session expired.

### Issue 2: No Retry Logic
```typescript
// lib/auth.ts:26-42
export async function refreshSession() {
  // Single attempt with 10s timeout
  // If fails → throws error → caller gives up
}
```

**Problem:** Network hiccup = immediate failure, no retry.

### Issue 3: Race Condition
```typescript
// AuthProvider.tsx:177
if (user) {  // ⚠️ Only refreshes if user exists
  await ensureValidSession()
}
```

**Problem:** If `user` is null during re-initialization, refresh is skipped.

### Issue 4: Boot Process Continues Even If Refresh Fails
```typescript
// app/index.tsx:188
if (!refreshed) {
  console.warn("[boot] Failed to refresh expired session, user may need to sign in again")
  // Continue anyway - AuthProvider will handle auth state changes
}
```

**Problem:** Boot continues with expired session, user navigates to home, then API calls fail.

---

## The Solution: "Soft Reload" Pattern

### What We Need

**When session refresh fails:**

1. **Don't immediately log out**
   - Session might still exist in storage
   - Network might be temporarily unavailable
   - Refresh might succeed on retry

2. **Show loading state**
   - User sees boot/loading screen
   - Knows app is refreshing
   - Not confused by errors

3. **Retry with exponential backoff**
   - First retry: immediate
   - Second retry: 2s delay
   - Third retry: 4s delay
   - Total: ~6s of retries before giving up

4. **Check stored session**
   - Before giving up, check if session exists in AsyncStorage
   - If session exists but refresh failed → might be network issue
   - If no session → truly logged out

5. **Graceful degradation**
   - If refresh fails but session exists → try to continue (session might still be valid)
   - If refresh fails and no session → redirect to login
   - Show user-friendly message if needed

### Implementation Strategy

**Phase 1: Add Retry Logic** (Low Risk)
- Update `refreshSession()` to retry 2-3 times
- Exponential backoff between retries
- Distinguish network errors from auth errors

**Phase 2: Add "Soft Reload" State** (Medium Risk)
- Add `refreshing` state to AuthProvider
- When refresh fails, set `refreshing: true`
- Show loading screen while refreshing
- Retry refresh before giving up

**Phase 3: Improve Error Handling** (Low Risk)
- Check stored session before logging out
- Only log out if session truly doesn't exist
- Show user-friendly error messages

**Phase 4: Proactive Refresh** (Low Risk)
- Refresh session before it expires (5 min before)
- Background refresh when possible
- Prevent expiration in first place

---

## Recommended Approach: Lowest Risk

### Step 1: Add Retry Logic to `refreshSession()` ✅ SAFE
- Modify `lib/auth.ts` only
- Add 2-3 retries with exponential backoff
- Network errors → retry
- Auth errors (401/403) → don't retry
- **Risk: LOW** - Only improves existing function

### Step 2: Add "Refreshing" State ✅ SAFE
- Add `refreshing: boolean` to AuthProvider context
- Set `refreshing: true` when refresh starts
- Set `refreshing: false` when complete
- Components can show loading state
- **Risk: LOW** - Just adds state, doesn't change logic

### Step 3: Show Loading on Refresh Failure ✅ SAFE
- When refresh fails, check stored session
- If session exists → show loading, retry once
- If no session → redirect to login
- **Risk: MEDIUM** - Changes navigation logic, but safer than current

### Step 4: Improve Boot Process ✅ SAFE
- Boot process waits for AuthProvider
- If refresh fails during boot → show loading
- Retry before navigating
- **Risk: MEDIUM** - Changes boot flow, but aligns with audit recommendations

---

## The "Soft Reload" Flow

### Ideal User Experience

```
User opens app after 2 hours
  ↓
App shows boot screen (brief)
  ↓
AuthProvider checks session
  ↓
Session expired → Attempts refresh
  ↓
[If network slow/timeout]
  ↓
Show loading state (user sees boot screen)
  ↓
Retry refresh (2-3 times with backoff)
  ↓
[If succeeds]
  ↓
Continue to home (smooth, user barely notices)
  ↓
[If all retries fail]
  ↓
Check stored session
  ↓
[If session exists in storage]
  ↓
Try to continue (might still work)
  ↓
[If no session]
  ↓
Redirect to login (only if truly logged out)
```

### Key Differences from Current Flow

**Current:**
- ❌ Single attempt → immediate failure
- ❌ No user feedback
- ❌ Silent failure → user confused
- ❌ No retry → network hiccup = logout

**Proposed:**
- ✅ Multiple retries → handles network issues
- ✅ Loading state → user knows what's happening
- ✅ Graceful handling → checks stored session
- ✅ Only logout if truly expired → better UX

---

## Risk Assessment

### Low Risk Changes ✅
1. **Add retry logic** - Only improves existing function
2. **Add refreshing state** - Just adds state, no logic changes
3. **Increase timeout** - Simple config change
4. **Better error messages** - Just logging improvements

### Medium Risk Changes ⚠️
1. **Change boot process** - Affects app startup
2. **Add soft reload** - Changes navigation flow
3. **Session check before logout** - Changes logout logic

### High Risk Changes 🔴
1. **Major refactor** - Not needed
2. **Remove existing logic** - Too risky

---

## Recommended Implementation Order

### Phase 1: Quick Wins (Low Risk)
1. ✅ Add retry logic to `refreshSession()` (2-3 retries)
2. ✅ Increase timeout to 15s (more forgiving)
3. ✅ Add better error logging

**Impact:** Handles most timeout issues without major changes

### Phase 2: User Feedback (Low Risk)
4. ✅ Add `refreshing` state to AuthProvider
5. ✅ Show loading screen when refreshing
6. ✅ Update boot process to show loading on refresh

**Impact:** Users see what's happening, no confusion

### Phase 3: Graceful Degradation (Medium Risk)
7. ✅ Check stored session before logout
8. ✅ Retry refresh before giving up
9. ✅ Only logout if session truly doesn't exist

**Impact:** Prevents unnecessary logouts, better UX

---

## Expected Outcomes

**After Implementation:**
- ✅ Timeout errors become rare (retries handle network issues)
- ✅ When timeout occurs, user sees loading (not stuck screen)
- ✅ App retries before giving up (handles temporary network issues)
- ✅ Only logs out if session truly expired (not just network timeout)
- ✅ Smooth user experience (brief loading, then continue)

**Metrics to Track:**
- Session refresh success rate (should be > 99%)
- Timeout occurrences (should decrease)
- Unnecessary logouts (should decrease)
- User complaints about being logged out (should decrease)

---

## Summary

**The Problem:**
- Session refresh times out (> 10s)
- Single failure → user stays logged in but session expired
- No retry → network hiccup = logout
- No user feedback → user confused

**The Solution:**
- Add retry logic (2-3 attempts with backoff)
- Show loading state during refresh
- Check stored session before logout
- Only logout if session truly doesn't exist

**The Risk:**
- Low risk: Retry logic, better error handling
- Medium risk: Navigation changes, boot process updates
- Can be implemented incrementally

**The Result:**
- Smooth "soft reload" experience
- Handles network issues gracefully
- Users stay logged in unless truly expired
- Better UX overall

