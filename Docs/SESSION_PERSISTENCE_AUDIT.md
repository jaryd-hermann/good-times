# Session Persistence & App Stability Audit

## Executive Summary

This audit identifies critical issues causing users to be logged out or experience black screens on iOS and Android. The problems stem from race conditions, aggressive timeouts, incomplete error handling, and lack of proper session recovery mechanisms.

## Current Architecture

### Session Management Flow

1. **Supabase Client Configuration** (`lib/supabase.ts`)
   - ✅ `autoRefreshToken: true` - Good
   - ✅ `persistSession: true` - Good
   - ✅ Uses `AsyncStorage` for persistence - Good
   - ⚠️ Fallback client created when config invalid (may mask issues)

2. **AuthProvider** (`components/AuthProvider.tsx`)
   - Listens to `onAuthStateChange` for session updates
   - Has fallback `getSession()` call after 2s timeout
   - Refreshes session on app foreground (but only if `user` exists - **RACE CONDITION**)
   - Sets `loading: false` after initial session check

3. **Boot Process** (`app/index.tsx`)
   - Complex async boot sequence
   - Checks biometric auth first
   - Falls back to normal session check
   - Validates session expiry before navigation
   - Routes to appropriate screen based on user state

## Critical Issues Identified

### 1. Race Condition Between AuthProvider and Boot Process

**Problem:**
- `app/index.tsx` boot process runs independently of `AuthProvider`
- Boot process calls `getSession()` directly, bypassing AuthProvider's state
- AuthProvider's `onAuthStateChange` may fire after boot navigation completes
- This can cause:
  - User navigated to home, then AuthProvider sets user to null
  - Black screen when AuthProvider updates state
  - Session check happens before AuthProvider initializes

**Location:**
- `app/index.tsx:149-180` - Boot process checks session independently
- `components/AuthProvider.tsx:71-161` - AuthProvider initializes separately

**Impact:** HIGH - Causes black screens and unexpected logouts

---

### 2. App State Change Handler Race Condition

**Problem:**
```typescript
// AuthProvider.tsx:164-207
useEffect(() => {
  // ...
  if (lastAppState.match(/inactive|background/) && nextAppState === "active") {
    if (user) {  // ⚠️ RACE CONDITION: user might be null during initialization
      await ensureValidSession()
    }
  }
}, [user])  // ⚠️ Depends on user state
```

- Handler only refreshes session if `user` exists
- When app resumes, `user` might be `null` temporarily (during re-initialization)
- Session refresh is skipped, leading to expired sessions
- 500ms delay might not be enough for app to fully resume

**Impact:** HIGH - Users logged out after app resumes

---

### 3. Aggressive Timeout Values

**Problem:**
```typescript
// lib/auth.ts:13-14
setTimeout(() => reject(new Error("getSession timeout")), 5000)

// lib/auth.ts:30-31
setTimeout(() => reject(new Error("refreshSession timeout")), 10000
```

- 5s timeout for `getSession()` may be too short on slow networks
- 10s timeout for `refreshSession()` may be too short if network is slow
- No retry logic - single failure causes logout
- Timeouts don't distinguish between network errors and actual failures

**Impact:** MEDIUM-HIGH - Users on slow networks get logged out

---

### 4. No Session Recovery Mechanism

**Problem:**
- When session refresh fails, app immediately redirects to welcome screen
- No attempt to use stored refresh token from SecureStore (biometric)
- No exponential backoff retry
- No distinction between temporary network errors and permanent auth failures

**Location:**
- `app/index.tsx:182-203` - Session validation fails → redirect to welcome
- `lib/auth.ts:64-78` - `ensureValidSession()` throws on error

**Impact:** HIGH - Users logged out unnecessarily

---

### 5. Boot Process Complexity and Error Handling

**Problem:**
- Boot process has multiple async operations that can fail:
  1. Supabase config check
  2. Biometric auth check
  3. Session retrieval
  4. Session refresh
  5. User profile fetch
  6. Group membership check
- If any step fails, entire boot fails
- No partial recovery - all-or-nothing approach
- Error messages shown but user stuck on boot screen

**Location:**
- `app/index.tsx:60-312` - Entire boot sequence

**Impact:** MEDIUM - Black screen if any step fails

---

### 6. Splash Screen Timeout Too Short

**Problem:**
```typescript
// app/_layout.tsx:228-232
const timer = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 1500)
```

- 1.5s timeout may hide splash before boot completes
- If boot takes longer (slow network, biometric prompt), splash hides too early
- User sees black screen during boot

**Impact:** MEDIUM - Contributes to black screen issue

---

### 7. Missing Session Refresh on App Resume

**Problem:**
- App state change handler only refreshes if `user` exists
- But session might expire while app is in background
- When app resumes, expired session not detected until API call fails
- No proactive session refresh on resume

**Impact:** MEDIUM - Delayed logout experience

---

### 8. Query Client Retry Logic May Interfere

**Problem:**
```typescript
// app/_layout.tsx:40-46
retry: (failureCount, error: any) => {
  if (error?.status === 401 || error?.status === 403) {
    return false  // Don't retry on auth errors
  }
  return failureCount < 2
}
```

- 401/403 errors don't trigger retry (good)
- But no automatic session refresh on 401/403
- Queries fail immediately without attempting session recovery

**Impact:** MEDIUM - API calls fail before session refresh attempted

---

### 9. No Network State Monitoring

**Problem:**
- No detection of network connectivity
- Session refresh attempts even when offline
- No queue of requests to retry when network returns
- User sees errors even when network is temporarily unavailable

**Impact:** LOW-MEDIUM - Poor offline experience

---

### 10. Biometric Auth Flow Issues

**Problem:**
```typescript
// app/index.tsx:99-146
if (biometricEnabled) {
  const refreshToken = await getBiometricRefreshToken()
  // ... try biometric auth
  if (!session) {
    // Falls back to normal session check
  }
}
```

- Biometric flow runs before normal session check
- If biometric fails (user cancels), falls back to normal session
- But if normal session also expired, user logged out
- No attempt to refresh using stored refresh token

**Impact:** MEDIUM - Biometric users logged out unnecessarily

---

## Root Causes Summary

1. **Lack of Single Source of Truth**: AuthProvider and boot process both check session independently
2. **Race Conditions**: Multiple async operations not properly synchronized
3. **No Retry Logic**: Single failure causes logout
4. **Insufficient Error Recovery**: No fallback mechanisms
5. **Timeout Values**: May be too aggressive for slow networks
6. **Missing Proactive Refresh**: Session only refreshed reactively, not proactively

## Recommended Solutions

### Phase 1: Critical Fixes (Immediate)

1. **Unify Session Management**
   - Make AuthProvider the single source of truth
   - Boot process should wait for AuthProvider to initialize
   - Remove duplicate session checks from boot process

2. **Fix App State Change Handler**
   - Remove dependency on `user` state
   - Always attempt session refresh on resume
   - Check session directly, not user state

3. **Implement Retry Logic**
   - Add exponential backoff for session refresh
   - Retry up to 3 times before giving up
   - Distinguish between network errors and auth failures

4. **Increase Timeout Values**
   - Increase `getSession()` timeout to 10s
   - Increase `refreshSession()` timeout to 15s
   - Add network-aware timeouts

### Phase 2: Enhanced Stability (Short-term)

5. **Proactive Session Refresh**
   - Refresh session before expiry (5 minutes before)
   - Refresh on app resume regardless of user state
   - Background refresh when possible

6. **Better Error Recovery**
   - Attempt biometric refresh token if normal refresh fails
   - Fallback to stored refresh token from SecureStore
   - Clear session only after all recovery attempts fail

7. **Improve Boot Process**
   - Add loading states for each boot step
   - Allow partial recovery (e.g., show home even if some data fails)
   - Better error messages and recovery options

8. **Network State Monitoring**
   - Detect network connectivity
   - Queue requests when offline
   - Retry when network returns

### Phase 3: Best-in-Class Experience (Long-term)

9. **Session Persistence Improvements**
   - Store session in both AsyncStorage and SecureStore
   - Encrypt sensitive session data
   - Validate session integrity on load

10. **Background Session Refresh**
    - Use background tasks to refresh session
    - Keep session alive even when app closed
    - Seamless experience on app resume

11. **Analytics & Monitoring**
    - Track session refresh failures
    - Monitor logout rates
    - Alert on unusual patterns

## Implementation Priority

**P0 (Critical - Fix Immediately):**
- Fix race condition between AuthProvider and boot process
- Fix app state change handler
- Add retry logic for session refresh

**P1 (High Priority - Fix Soon):**
- Increase timeout values
- Implement proactive session refresh
- Improve error recovery

**P2 (Medium Priority - Fix When Possible):**
- Network state monitoring
- Better boot process error handling
- Background session refresh

## Testing Recommendations

1. **Test Scenarios:**
   - App backgrounded for 1 hour, then resumed
   - App backgrounded for 24 hours, then resumed
   - Slow network conditions
   - No network, then network restored
   - Session expires while app in background
   - Multiple rapid app switches
   - Biometric auth cancelled, then app resumed

2. **Monitoring:**
   - Track session refresh success rate
   - Monitor logout frequency
   - Measure boot time
   - Track black screen occurrences

## Expected Outcomes

After implementing fixes:
- ✅ Users stay logged in across app sessions
- ✅ Smooth app resume without black screens
- ✅ Graceful handling of network issues
- ✅ Automatic session recovery
- ✅ Better user experience overall

