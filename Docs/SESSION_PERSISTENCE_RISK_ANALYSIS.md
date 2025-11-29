# Session Persistence Changes - Risk Analysis

## Overview

This document analyzes the risks and impacts of implementing the session persistence fixes on existing flows: join, registration, login, and OAuth.

## Risk Assessment Summary

| Flow | Risk Level | Impact | Mitigation |
|------|-----------|--------|------------|
| **Join Flow** | 🟡 MEDIUM | May need to wait for AuthProvider | Add AuthProvider check |
| **Sign In** | 🟢 LOW | No impact - creates new session | None needed |
| **Sign Up** | 🟢 LOW | No impact - creates new session | None needed |
| **OAuth Flow** | 🟡 MEDIUM | Timing dependency on AuthProvider | Ensure proper sequencing |
| **Boot Process** | 🟠 HIGH | Core change - needs careful testing | Extensive testing required |
| **Biometric Auth** | 🟡 MEDIUM | Removed from boot, handled by AuthProvider | Verify AuthProvider handles it |

## Detailed Flow Analysis

### 1. Join Flow (`app/join/[groupId].tsx`)

**Current Behavior:**
- Line 98-110: Checks session directly with `supabase.auth.getSession()`
- If no session → stores `PENDING_GROUP_KEY` → redirects to `welcome-2`
- If session exists → checks profile → joins group

**Impact of Changes:**
- ✅ **No direct code changes** - Join flow doesn't use AuthProvider
- ⚠️ **Potential timing issue**: If user clicks join link immediately after app opens, AuthProvider might not be initialized yet
- ⚠️ **Session check**: Join flow checks session directly, which is fine, but should ideally use AuthProvider state

**Risk:** 🟡 MEDIUM
- Join flow will still work, but there's a small window where AuthProvider might not be ready
- If user is already logged in and clicks join link, the session check should work fine
- If user is not logged in, it stores pending group ID and redirects (this still works)

**Mitigation:**
- Join flow can continue using direct session check (it's a separate screen)
- OR: Add optional AuthProvider check with fallback to direct session check
- **Recommendation**: Keep as-is, but add comment explaining why direct check is OK here

---

### 2. Sign In Flow (`app/(auth)/sign-in.tsx`)

**Current Behavior:**
- Line 35: Calls `supabase.auth.signInWithPassword()` directly
- After successful sign-in, checks profile and navigates
- Uses `router.replace()` to navigate

**Impact of Changes:**
- ✅ **No code changes needed**
- ✅ **AuthProvider will automatically pick up new session** via `onAuthStateChange`
- ✅ **Navigation happens after sign-in** - AuthProvider will have updated by then

**Risk:** 🟢 LOW
- Sign-in creates a new session, which triggers `onAuthStateChange` in AuthProvider
- AuthProvider will update `user` state automatically
- Boot process will use the updated AuthProvider state on next app start

**Mitigation:** None needed - this flow is independent and works correctly

---

### 3. Sign Up Flow (`app/(auth)/sign-up.tsx`)

**Current Behavior:**
- Line 41: Calls `supabase.auth.signUp()` directly
- Creates user profile
- Navigates to onboarding

**Impact of Changes:**
- ✅ **No code changes needed**
- ✅ **AuthProvider will automatically pick up new session** via `onAuthStateChange`
- ✅ **Navigation happens after sign-up** - AuthProvider will have updated

**Risk:** 🟢 LOW
- Same as sign-in - creates new session, AuthProvider picks it up automatically
- No dependencies on boot process

**Mitigation:** None needed

---

### 4. OAuth Flow (`app/(onboarding)/auth.tsx`)

**Current Behavior:**
- Handles OAuth callbacks from Supabase
- Calls `ensureProfileAndJoinGroup()` after authentication
- Uses `onAuthStateChange` listener

**Impact of Changes:**
- ⚠️ **Timing dependency**: OAuth creates session, which triggers `onAuthStateChange`
- ⚠️ **Race condition potential**: If OAuth completes while AuthProvider is initializing
- ✅ **Should work fine**: OAuth flow is separate from boot process

**Risk:** 🟡 MEDIUM
- OAuth flow relies on `onAuthStateChange` which AuthProvider also uses
- Both should receive the event, but order matters
- If OAuth completes during app boot, there might be a race condition

**Mitigation:**
- OAuth flow should continue to work as-is
- AuthProvider's `onAuthStateChange` will also fire, ensuring state is synced
- Test OAuth flow thoroughly after changes

---

### 5. Boot Process (`app/index.tsx`) - **HIGH RISK AREA**

**Current Behavior:**
- Checks Supabase config
- Checks biometric auth
- Checks normal session
- Validates session expiry
- Checks user profile
- Checks group membership
- Routes to appropriate screen

**Impact of Changes:**
- 🔴 **MAJOR CHANGE**: Boot process will now wait for AuthProvider
- 🔴 **Removes**: Direct session checks, biometric auth check
- 🔴 **Adds**: Dependency on `useAuth()` hook
- 🔴 **Changes**: Navigation logic to use AuthProvider state

**Risk:** 🟠 HIGH
- This is the core change - boot process is critical
- If AuthProvider fails to initialize, boot will hang
- If AuthProvider takes too long, user sees loading screen longer
- Pending group join logic must still work

**Specific Risks:**

1. **AuthProvider Initialization Failure**
   - If AuthProvider fails to initialize, boot process waits forever
   - **Mitigation**: Add timeout in boot process (e.g., wait max 10s for AuthProvider)

2. **Pending Group Join**
   - Current: Boot checks `PENDING_GROUP_KEY` and routes to join screen
   - After change: Boot uses AuthProvider state, but still needs to check pending group
   - **Mitigation**: Keep pending group check in boot process (it's independent)

3. **Biometric Auth**
   - Current: Boot process handles biometric auth
   - After change: Removed from boot, should be handled by AuthProvider
   - **Risk**: AuthProvider doesn't currently handle biometric auth on initialization
   - **Mitigation**: Need to add biometric auth to AuthProvider initialization OR keep it in boot

4. **Orphaned Session Detection**
   - Current: Boot detects orphaned sessions (session exists but no profile)
   - After change: Should still work, but uses AuthProvider user state
   - **Risk**: If AuthProvider loads user but profile is incomplete, detection might fail
   - **Mitigation**: Keep orphaned session check in boot process

**Mitigation Strategy:**
```typescript
// In app/index.tsx - Add timeout for AuthProvider
useEffect(() => {
  let cancelled = false
  let authTimeout: NodeJS.Timeout | null = null

  (async () => {
    // Wait for AuthProvider with timeout
    if (authLoading) {
      authTimeout = setTimeout(() => {
        if (!cancelled) {
          console.warn("[boot] AuthProvider timeout, proceeding with direct session check")
          // Fallback to direct session check
          checkSessionDirectly()
        }
      }, 10000) // 10s timeout
      return
    }
    
    // Proceed with boot using AuthProvider state
    // ...
  })()

  return () => {
    cancelled = true
    if (authTimeout) clearTimeout(authTimeout)
  }
}, [authLoading, user])
```

---

### 6. Biometric Authentication

**Current Behavior:**
- Boot process checks biometric preference
- If enabled, prompts for biometric auth
- Uses refresh token to get session

**Impact of Changes:**
- 🔴 **REMOVED from boot process** in implementation plan
- ⚠️ **Not currently in AuthProvider** initialization
- ⚠️ **Gap**: Who handles biometric auth on app start?

**Risk:** 🟡 MEDIUM
- If biometric auth is removed from boot, users with biometric enabled won't be prompted
- They'll need to manually sign in each time
- This defeats the purpose of biometric auth

**Mitigation:**
- **Option 1**: Keep biometric auth in boot process (recommended)
  - Boot process can still check biometric before waiting for AuthProvider
  - Or check biometric after AuthProvider initializes but before navigation
  
- **Option 2**: Add biometric auth to AuthProvider initialization
  - AuthProvider checks biometric preference on init
  - Prompts for biometric if enabled
  - Uses refresh token to get session
  
- **Recommendation**: Keep biometric auth in boot process, but after AuthProvider check
  ```typescript
  // In app/index.tsx
  if (authLoading) return // Wait for AuthProvider
  
  if (!user) {
    // Check biometric auth
    const biometricEnabled = await getBiometricPreference()
    if (biometricEnabled) {
      // Try biometric auth
      // If successful, AuthProvider will pick up session
      // If fails, continue to welcome screen
    }
  }
  ```

---

## Critical Dependencies

### Files That Depend on Session State

1. **`app/index.tsx`** - Boot process (HIGH RISK - being changed)
2. **`app/join/[groupId].tsx`** - Join flow (MEDIUM RISK - uses direct session check)
3. **`app/(onboarding)/auth.tsx`** - OAuth flow (MEDIUM RISK - timing dependent)
4. **`app/(main)/home.tsx`** - Home screen (LOW RISK - uses AuthProvider via `useAuth()`)
5. **`components/AuthProvider.tsx`** - Auth state management (HIGH RISK - being changed)

### Files That Create Sessions (Should Be Safe)

1. **`app/(auth)/sign-in.tsx`** - Creates session via `signInWithPassword()` ✅
2. **`app/(auth)/sign-up.tsx`** - Creates session via `signUp()` ✅
3. **`app/(onboarding)/auth.tsx`** - Creates session via OAuth ✅
4. **`app/_layout.tsx`** - Handles OAuth redirects ✅

---

## Testing Checklist

### Critical Tests (Must Pass)

- [ ] **App cold start** - User logged in, app closed, reopen app → should stay logged in
- [ ] **App resume** - User logged in, app backgrounded for 1 hour, resume → should stay logged in
- [ ] **Join flow (logged out)** - User not logged in, clicks join link → should store pending group, redirect to welcome-2
- [ ] **Join flow (logged in)** - User logged in, clicks join link → should join group immediately
- [ ] **Sign in flow** - User signs in → should navigate correctly, AuthProvider should update
- [ ] **Sign up flow** - User signs up → should navigate to onboarding, AuthProvider should update
- [ ] **OAuth flow** - User completes OAuth → should create session, AuthProvider should update
- [ ] **Biometric auth** - User with biometric enabled, app start → should prompt for biometric
- [ ] **Pending group join** - User not logged in, clicks join link, then signs up → should join group after auth
- [ ] **Orphaned session** - Session exists but no profile → should clear session, redirect to welcome

### Edge Cases

- [ ] **Slow network** - App start on slow network → should handle timeouts gracefully
- [ ] **No network** - App start with no network → should handle gracefully
- [ ] **AuthProvider timeout** - AuthProvider takes > 10s → boot should fallback to direct check
- [ ] **Multiple rapid app switches** - User switches apps rapidly → should handle correctly
- [ ] **Session expires during boot** - Session expires while booting → should refresh or redirect

---

## Recommended Implementation Strategy

### Phase 1: Low-Risk Changes First
1. ✅ Fix AuthProvider app state handler (removes race condition)
2. ✅ Add retry logic to session refresh
3. ✅ Increase timeout values
4. ✅ Add proactive session refresh

### Phase 2: Medium-Risk Changes
5. ⚠️ Update boot process to use AuthProvider (with timeout fallback)
6. ⚠️ Keep biometric auth in boot process (don't remove it)
7. ⚠️ Test join flow thoroughly

### Phase 3: Verification
8. ✅ Test all flows end-to-end
9. ✅ Monitor for issues in production
10. ✅ Iterate based on feedback

---

## Rollback Plan

If issues arise:

1. **Quick Rollback**: Revert boot process changes, keep AuthProvider improvements
2. **Partial Rollback**: Keep AuthProvider fixes, revert boot process to direct session check
3. **Full Rollback**: Revert all changes, restore original code

**Key Point**: AuthProvider improvements (retry logic, timeouts, proactive refresh) are low-risk and can be kept even if boot process changes need rollback.

---

## Conclusion

**Overall Risk Level:** 🟡 MEDIUM-HIGH

**Key Risks:**
1. Boot process changes are high-risk but necessary
2. Biometric auth needs careful handling
3. Join flow timing needs verification

**Key Safeguards:**
1. Add timeout fallback in boot process
2. Keep biometric auth in boot process
3. Extensive testing before deployment
4. Monitor metrics after deployment
5. Have rollback plan ready

**Recommendation:** 
- Proceed with implementation, but:
  1. Keep biometric auth in boot process (don't remove it)
  2. Add timeout fallback for AuthProvider initialization
  3. Test thoroughly before production deployment
  4. Deploy to TestFlight first for beta testing

