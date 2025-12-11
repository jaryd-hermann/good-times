# Comprehensive Boot Flow Fix - Background Resume Issues

## Critical Issues Found

### Issue #1: ForegroundQueryRefresher Navigates Twice
**Location:** `app/_layout.tsx` lines 164 and 195
**Problem:** 
- Navigates to root in AppState handler (line 164)
- Also navigates in separate useEffect when authLoading changes (line 195)
- Causes boot flow to run multiple times

**Fix:** Remove duplicate navigation - only navigate once

### Issue #2: Boot Flow Duplicate Run Prevention Doesn't Work
**Location:** `app/index.tsx` line 246
**Problem:**
- Checks `hasNavigatedRef.current && segments.length > 0`
- But when ForegroundQueryRefresher navigates to root, `segments.length === 0`
- So it doesn't skip, runs again

**Fix:** Check if we're on root AND have already navigated, skip if so

### Issue #3: hasNavigatedRef Reset Causes Re-runs
**Location:** `app/index.tsx` lines 116, 154
**Problem:**
- Reset when boot recheck trigger detected
- But this causes boot flow to run again even if already navigated
- Should only reset if we need to force a re-navigation

**Fix:** Only reset hasNavigatedRef if we're actually forcing a re-navigation

### Issue #4: Membership Query Timeout Navigates Wrong
**Location:** `app/index.tsx` line 500
**Problem:**
- If membership query times out, assumes no membership
- Navigates to create-group
- But user might have a group, just slow network
- Should trust session and navigate to home if we have effectiveUser

**Fix:** On timeout, trust session and navigate to home (user has session, likely has group)

### Issue #5: Navigation Timeout Too Aggressive
**Location:** `app/index.tsx` line 638
**Problem:**
- 3 second timeout might fire before queries complete
- Causes premature navigation
- Should be longer or removed if queries have their own timeouts

**Fix:** Increase timeout or remove (queries already have timeouts)

### Issue #6: Boot Flow Runs Before Queries Complete
**Location:** `app/index.tsx` lines 424-516
**Problem:**
- Profile and membership queries run sequentially
- If they timeout, we navigate incorrectly
- Should have a fallback: if we have effectiveUser, trust session and go to home

**Fix:** Add fallback navigation - if effectiveUser exists, navigate to home even if queries timeout

## Root Cause Summary

The fundamental issue is that background resume has MULTIPLE code paths that can navigate:
1. ForegroundQueryRefresher navigates to root
2. Boot flow runs and navigates
3. Multiple boot flow runs due to duplicate prevention not working
4. Queries timeout and navigate incorrectly

Cold start works because:
- Only ONE code path (boot flow)
- User loads before boot flow runs
- No duplicate navigations

## Solution

1. **Simplify ForegroundQueryRefresher** - Only navigate once, don't duplicate
2. **Fix duplicate prevention** - Check if on root AND already navigated
3. **Trust session on timeout** - If effectiveUser exists, navigate to home even if queries timeout
4. **Remove aggressive navigation timeout** - Queries already have timeouts
5. **Ensure single navigation path** - Only one place navigates to home

