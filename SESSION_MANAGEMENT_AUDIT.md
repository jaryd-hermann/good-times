# Session Management & Boot Flow Audit

## Current Issues Identified

### 1. **Black Screen After Inactivity**
**Root Causes:**
- **Dual Session Management**: Both `app/index.tsx` and `AuthProvider.tsx` are checking/refreshing sessions simultaneously, causing race conditions
- **No Session State Tracking**: App doesn't track when it was last opened vs. when user is actively using it
- **Complex Timeout Logic**: Multiple overlapping timeouts (15s boot, 3s navigation, 5s session check) create unpredictable states
- **Route Detection Issues**: `useSegments()` may return empty array during navigation transitions, triggering false "black screen" recovery
- **AppState Handling**: Background/foreground detection triggers unnecessary session refreshes that can fail

**Specific Problems:**
- `app/index.tsx` line 67-109: Boot timeout tries to recover but may navigate before AuthProvider finishes
- `app/index.tsx` line 112-195: AppState change handler triggers recovery that conflicts with boot logic
- `AuthProvider.tsx` line 192-365: Session refresh on foreground can clear user state if refresh fails
- No distinction between "cold start" (app closed) vs "warm start" (app backgrounded briefly)

### 2. **FaceID Triggering at Wrong Times**
**Root Causes:**
- **FaceID During Boot**: `app/index.tsx` line 236-243 triggers FaceID during boot when user is already authenticated
- **No Route Check**: FaceID triggers regardless of current route - should only trigger at login screens
- **Race Condition**: FaceID attempt during boot can interfere with normal session check

**Specific Problems:**
- `app/index.tsx` line 232-283: Biometric check happens during boot, not just at login
- FaceID should ONLY trigger in:
  - `app/(auth)/sign-in.tsx` - when user manually navigates to sign-in
  - `app/(onboarding)/welcome-1.tsx` - when user is logged out
- Currently triggers even when user has valid session, causing confusion

### 3. **Login Screen Stuck After Credentials**
**Root Causes:**
- **Navigation Not Triggered**: `sign-in.tsx` line 72 calls `router.replace()` but navigation may be blocked
- **Session State Conflict**: After FaceID attempt, manual login may not properly update session state
- **No Error Handling**: If navigation fails, user sees no feedback

**Specific Problems:**
- `sign-in.tsx` line 35-83: After successful sign-in, navigation may not complete
- No fallback if `router.replace()` fails
- Possible race condition if FaceID was attempted first

### 4. **No Session Lifecycle Tracking**
**Missing Features:**
- No tracking of when app session started
- No tracking of when app was last closed
- No distinction between "in-app" refreshes vs "new session"
- No way to determine if boot screen should show based on time since last use

## Proposed Solution Architecture

### Core Principles
1. **Single Source of Truth**: `AuthProvider` handles ALL session management
2. **Session Lifecycle Tracking**: Track app open/close times to determine boot behavior
3. **Route-Based FaceID**: FaceID only triggers at actual login screens
4. **Simplified Boot Flow**: `app/index.tsx` only handles routing, not session checks
5. **In-App vs Cold Start**: Different behavior for in-app refreshes vs. app reopening

### Implementation Plan

#### Phase 1: Session Lifecycle Tracking
**New AsyncStorage Keys:**
- `last_app_close_time`: Timestamp when app was closed
- `current_session_start_time`: Timestamp when current session started
- `last_successful_navigation`: Last route that successfully loaded

**Logic:**
- On app open: Check `last_app_close_time`
  - If > 5-10 minutes ago → Show boot screen, start new session
  - If < 5 minutes ago → Quick resume, no boot screen
- On app close: Save `last_app_close_time`
- On successful navigation: Save `last_successful_navigation`

#### Phase 2: Simplified Boot Flow (`app/index.tsx`)
**New Responsibilities:**
- Check session lifecycle (time since last close)
- Show boot screen if needed (based on time gap)
- Route to appropriate screen based on AuthProvider state
- NO session checking/refreshing (AuthProvider handles this)

**Removed Responsibilities:**
- Session refresh logic
- Biometric authentication during boot
- Complex timeout recovery logic
- AppState change handling for session refresh

#### Phase 3: Centralized Session Management (`AuthProvider.tsx`)
**Enhanced Responsibilities:**
- Handle ALL session checks and refreshes
- Track session validity
- Handle expired sessions gracefully
- Provide clear loading/refreshing states
- Never clear user state unless session is definitively expired

**Key Changes:**
- Remove AppState-based session refresh (causes issues)
- Only refresh session when explicitly needed (not on every foreground)
- Better error handling - don't clear user on network errors
- Provide session state to `app/index.tsx` for routing decisions

#### Phase 4: Route-Based FaceID
**FaceID Should Only Trigger:**
- `app/(auth)/sign-in.tsx`: When user navigates to sign-in screen
- `app/(onboarding)/welcome-1.tsx`: When user is logged out

**Removed From:**
- `app/index.tsx` boot flow
- Any other screens

**Implementation:**
- Add FaceID check in `sign-in.tsx` on mount (if biometric enabled)
- Add FaceID check in `welcome-1.tsx` on mount (if biometric enabled)
- Remove all FaceID logic from `app/index.tsx`

#### Phase 5: In-App Refresh Handling
**For In-App Refreshes:**
- Pull-to-refresh on screens
- Group switching
- Tab navigation
- These should NOT show boot screen
- These should use React Query refetch (already implemented)

**For App Reopening:**
- If > 5-10 minutes since last close → Show boot screen
- If < 5 minutes → Quick resume, no boot screen
- Boot screen shows while checking session and routing

#### Phase 6: Black Screen Prevention
**Guarantees:**
- Boot screen ALWAYS shows if no route is active
- Boot screen shows during any session check
- Boot screen shows during navigation transitions
- Never show blank/black screen

**Implementation:**
- `app/index.tsx` always shows boot screen if `segments.length === 0`
- Boot screen shows during AuthProvider loading state
- Boot screen shows during session refresh
- Only hide boot screen when valid route is active

#### Phase 7: Login Flow Fixes
**In `sign-in.tsx`:**
- Add explicit navigation success check
- Add fallback navigation if `router.replace()` fails
- Handle FaceID attempt before manual login
- Clear any pending FaceID state before manual login

**In `welcome-1.tsx`:**
- Ensure FaceID only triggers when user is logged out
- Handle FaceID success properly
- Navigate correctly after FaceID login

## Risk Assessment

### Low Risk Changes
- Adding session lifecycle tracking (AsyncStorage)
- Removing FaceID from boot flow
- Simplifying boot timeout logic

### Medium Risk Changes
- Removing AppState-based session refresh
- Changing when boot screen shows
- Modifying AuthProvider session refresh logic

### High Risk Changes
- Removing session checks from `app/index.tsx` (need to ensure AuthProvider handles everything)
- Changing navigation flow after login

## Testing Strategy

### Test Cases
1. **Cold Start (>10 min since close)**
   - App closed for >10 minutes
   - Open app → Should show boot screen → Route to home if logged in

2. **Warm Start (<5 min since close)**
   - App closed briefly
   - Open app → Should NOT show boot screen → Quick resume

3. **In-App Refresh**
   - User pulls to refresh → Should NOT show boot screen
   - User switches groups → Should NOT show boot screen

4. **FaceID Login**
   - User navigates to sign-in → FaceID should trigger
   - User cancels FaceID → Can enter credentials manually
   - User completes FaceID → Should navigate to home

5. **Manual Login**
   - User enters credentials → Should navigate immediately
   - If navigation fails → Should retry with fallback

6. **Session Expiry**
   - Session expires while app is open → Should refresh silently
   - Session expires while app is closed → Should show login on reopen

7. **Black Screen Prevention**
   - Any scenario where route is lost → Should show boot screen
   - Network errors during boot → Should show boot screen, not black

## Implementation Order

1. **Phase 1**: Add session lifecycle tracking (safest, no behavior change)
2. **Phase 4**: Move FaceID to login screens only (isolated change)
3. **Phase 2**: Simplify boot flow (depends on Phase 1)
4. **Phase 3**: Enhance AuthProvider (depends on Phase 2)
5. **Phase 5**: Implement in-app vs cold start logic (depends on Phase 1)
6. **Phase 6**: Black screen prevention (depends on Phase 2)
7. **Phase 7**: Fix login flow (depends on Phase 4)

## Success Criteria

✅ Users never see black screen
✅ Users never need to re-login unless they explicitly log out
✅ FaceID only triggers at login screens
✅ Boot screen shows appropriately (cold start, not warm start)
✅ In-app refreshes are seamless (no boot screen)
✅ Session management is reliable and predictable
✅ Navigation always completes after login

