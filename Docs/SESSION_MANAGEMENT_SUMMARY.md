# Session Management Issue Summary

## Quick Reference

**Problem**: After inactivity, users see black screen or stuck boot screen  
**Root Cause**: Race conditions between dual session refresh systems  
**Impact**: Production blocker - users must hard close app to recover  
**Status**: Audit complete, ready for implementation

---

## Key Findings

### Critical Issues (Must Fix)

1. **Dual Session Refresh Race Condition**
   - `AuthProvider.tsx` and `app/index.tsx` both refresh sessions simultaneously
   - Causes unpredictable state and navigation failures
   - **Fix**: Single source of truth (AuthProvider only)

2. **hasNavigatedRef Reset Bug**
   - Reset on foreground prevents proper navigation recovery
   - **Fix**: Only reset on actual navigation, not on foreground

3. **No Expired Session Fallback**
   - When session refresh fails, user stuck on boot screen
   - **Fix**: Sign out and redirect to login if refresh fails

4. **Boot Screen Logic Conflicts**
   - Multiple conditions control visibility, can conflict
   - **Fix**: Simplify to single condition: show until navigation completes

### Medium Issues (Should Fix)

5. **Session Refresh Mutex Race Window**
   - Small window where concurrent refreshes can start
   - **Fix**: Improve mutex implementation

6. **Notification Handling May Skip Boot Screen**
   - Direct navigation bypasses session refresh
   - **Fix**: Always show boot screen for notifications, refresh session first

7. **Inactivity Detection Edge Cases**
   - Force-kill may not be detected correctly
   - **Fix**: Improve detection logic

---

## Recommended Solution

### Phase 1: Critical Fixes (Immediate - Low Risk)

1. ✅ Remove `hasNavigatedRef` reset on foreground
2. ✅ Add expired session fallback (sign out → login)
3. ✅ Ensure boot screen stays visible until navigation completes
4. ✅ Add comprehensive logging

**Estimated Time**: 2-4 hours  
**Risk**: LOW  
**Impact**: HIGH (fixes stuck boot screen)

### Phase 2: Refactor (Next - Medium Risk)

1. ✅ Move all session refresh to `AuthProvider`
2. ✅ Remove session refresh from `app/index.tsx`
3. ✅ `app/index.tsx` only routes based on `user` state
4. ✅ Add session state tracking

**Estimated Time**: 4-8 hours  
**Risk**: MEDIUM  
**Impact**: HIGH (eliminates race conditions)

---

## Testing Strategy

### Quick Test (5 minutes)
1. Log in to app
2. Background app (home button)
3. Wait 2 minutes
4. Reopen → Should resume quickly ✅

### Critical Test (10 minutes)
1. Log in to app
2. Use test utility: `testSession.simulateInactivity(35)`
3. Close app
4. Reopen → Should show boot screen, refresh, navigate ✅

### Expired Session Test (10 minutes)
1. Log in to app
2. Use test utility: `testSession.forceExpiry()`
3. Close app
4. Reopen → Should show boot screen, sign out, navigate to login ✅

**Full test plan**: See `SESSION_TESTING_PLAN.md`

---

## Files to Modify

### High Priority
- `app/index.tsx` - Remove session refresh, fix navigation logic
- `components/AuthProvider.tsx` - Add expired session fallback
- `lib/auth.ts` - Improve error handling

### Medium Priority
- `lib/session-lifecycle.ts` - Improve inactivity detection
- `app/_layout.tsx` - Fix notification handling

### Low Priority (New Files)
- `lib/test-session-utils.ts` - Test utilities for simulator

---

## Expected Behavior After Fix

### Short Inactivity (< 5 min)
- ✅ Quick resume, no boot screen
- ✅ Immediate navigation to previous screen

### Long Inactivity (> 30 min)
- ✅ Boot screen shows
- ✅ Session refreshes
- ✅ Navigates to home (or login if expired)

### Expired Session
- ✅ Boot screen shows
- ✅ Session refresh fails
- ✅ User signed out automatically
- ✅ Navigates to login screen
- ✅ **No stuck boot screen**

### Notification Click
- ✅ Boot screen shows (if app was closed)
- ✅ Session refreshes
- ✅ Navigates to notification target

---

## Success Criteria

✅ **No black screens** - Boot screen always shows when needed  
✅ **No stuck boot screens** - Navigation always completes  
✅ **No race conditions** - Single source of truth for sessions  
✅ **Proper error handling** - Expired sessions redirect to login  
✅ **Testable** - Can simulate all scenarios in simulator  
✅ **Reliable** - Works consistently after inactivity

---

## Documentation

- **Technical Audit**: `SESSION_MANAGEMENT_TECHNICAL_AUDIT.md`
- **Testing Plan**: `SESSION_TESTING_PLAN.md`
- **This Summary**: `SESSION_MANAGEMENT_SUMMARY.md`

---

## Next Steps

1. **Review audit documents** with team
2. **Choose implementation approach** (recommend Phase 1 + Phase 2)
3. **Implement Phase 1 fixes** (quick wins)
4. **Add test utilities** for simulator testing
5. **Test all scenarios** before shipping
6. **Implement Phase 2 refactor** (long-term fix)
7. **Final validation** and production testing

---

**Last Updated**: 2025-12-07  
**Status**: Ready for Implementation

