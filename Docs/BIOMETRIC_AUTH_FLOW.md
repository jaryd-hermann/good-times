# Biometric Authentication Flow & Session Persistence

## Overview

Biometric authentication (FaceID/TouchID) is an **optional convenience feature** that allows users to quickly log in without entering their password. It's separate from the core session persistence system but works alongside it.

## How Biometric Auth Fits Into Session Persistence

### Two Separate Systems

1. **Core Session Persistence** (Always Active)
   - Supabase stores session in AsyncStorage
   - Session auto-refreshes via refresh tokens
   - Works even without biometric enabled
   - **This is what keeps users logged in**

2. **Biometric Auth** (Optional)
   - Only works if user enables it in Settings
   - Stores refresh token in SecureStore (encrypted)
   - Allows quick login when app starts with no session
   - **This is a convenience feature, not required**

### Key Point: Biometric is NOT Required

- Users can stay logged in **without** biometric enabled
- Biometric is just a faster way to log in when session expires
- If biometric is disabled, users just use normal password login

---

## Complete Biometric Flow

### 1. Enabling Biometric (Settings)

**Location:** `app/(main)/settings.tsx`

**Flow:**
1. User goes to Settings
2. Sees "Enable FaceID" toggle (only shown if device supports it)
3. User toggles it ON
4. App prompts for FaceID authentication (to verify it's the user)
5. If successful:
   - Saves `biometric_enabled = "true"` to AsyncStorage
   - **BUT**: Refresh token is NOT saved yet (only saved after next login)

**Important:** Enabling biometric in Settings doesn't save credentials - they're saved after the next successful login.

### 2. Saving Biometric Credentials (After Login)

**When credentials are saved:**
- After successful OAuth login (`app/(onboarding)/auth.tsx`)
- After password reset (`app/(onboarding)/reset-password.tsx`)
- After normal session refresh in boot process (`app/index.tsx`)
- After OAuth redirect (`app/_layout.tsx`)

**Code Pattern:**
```typescript
// After successful login
if (biometricEnabled && session.refresh_token) {
  await saveBiometricCredentials(session.refresh_token, session.user.id)
}
```

**What gets saved:**
- Refresh token → SecureStore (encrypted)
- User ID → SecureStore (encrypted)

### 3. Using Biometric on App Start

**Location:** `app/index.tsx` (boot process)

**Flow:**
1. Boot process starts
2. Checks if biometric is enabled (`getBiometricPreference()`)
3. If enabled:
   - Gets stored refresh token from SecureStore
   - Gets stored user ID from SecureStore
   - If both exist:
     - Prompts for FaceID/TouchID
     - If successful:
       - Uses refresh token to get new session
       - Continues boot process
     - If failed/cancelled:
       - Falls back to normal session check
4. If biometric not enabled OR no stored credentials:
   - Skips biometric, checks normal session

**Also:** `app/(onboarding)/welcome-1.tsx` attempts biometric login when screen loads (if user is logged out)

---

## Why FaceID Might Not Be Triggering

### Common Reasons

#### 1. **Biometric Not Enabled in App Settings** ⚠️ MOST LIKELY
- User has FaceID enabled on iPhone (system level)
- BUT hasn't enabled it in the app Settings
- **Check:** Go to Settings → Look for "Enable FaceID" toggle
- **Fix:** Enable it in app Settings, then log out and log back in

#### 2. **No Stored Credentials**
- User enabled biometric in Settings
- BUT never logged in after enabling it
- Credentials are only saved AFTER successful login
- **Fix:** Log out, log back in (this saves credentials)

#### 3. **Already Logged In**
- User is already logged in (session exists)
- Boot process checks normal session first
- If session exists, biometric is skipped
- **This is normal behavior** - biometric only used when logged out

#### 4. **Refresh Token Expired**
- Stored refresh token expired (after ~30 days of inactivity)
- Boot process clears credentials when refresh fails
- **Fix:** Log in again with password, credentials will be re-saved

#### 5. **App Never Fully Closed**
- If app is just backgrounded (not killed), session persists
- Biometric only triggers on cold start (app killed and reopened)
- **Fix:** Fully close app (swipe up, swipe away), then reopen

---

## Flow Diagram

### When Biometric IS Enabled

```
App Cold Start (No Session)
  ├─> Check biometric preference → YES
  ├─> Get stored refresh token → EXISTS
  ├─> Prompt FaceID → SUCCESS
  ├─> Use refresh token → Get new session
  └─> Navigate to Home ✅

App Cold Start (No Session)
  ├─> Check biometric preference → YES
  ├─> Get stored refresh token → EXISTS
  ├─> Prompt FaceID → USER CANCELLED
  ├─> Fall back to normal session check → NO SESSION
  └─> Navigate to Welcome Screen

App Resume (Session Exists)
  ├─> Check normal session → EXISTS
  ├─> Skip biometric (not needed)
  └─> Navigate to Home ✅
```

### When Biometric is NOT Enabled

```
App Cold Start (No Session)
  ├─> Check biometric preference → NO
  ├─> Skip biometric check
  ├─> Check normal session → NO SESSION
  └─> Navigate to Welcome Screen

App Resume (Session Exists)
  ├─> Check normal session → EXISTS
  └─> Navigate to Home ✅
```

---

## How This Relates to Session Persistence Fixes

### Current Behavior (Problematic)

**Issue:** Biometric check happens in boot process BEFORE AuthProvider initializes
- Boot process checks biometric independently
- AuthProvider initializes separately
- Race condition possible

**Impact:** 
- Biometric might work, but timing issues could cause problems
- If biometric succeeds but AuthProvider hasn't initialized, navigation might be wrong

### After Session Persistence Fixes

**Proposed:** Boot process waits for AuthProvider, then checks biometric

**Flow:**
```
App Start
  ├─> AuthProvider initializes
  │   ├─> Loads session from storage
  │   └─> Sets loading: false
  ├─> Boot process waits for AuthProvider
  ├─> If no user from AuthProvider:
  │   ├─> Check biometric preference
  │   ├─> If enabled, try biometric auth
  │   └─> If successful, AuthProvider picks up session
  └─> Navigate based on AuthProvider state
```

**Benefits:**
- No race conditions
- Single source of truth (AuthProvider)
- Biometric still works, but integrated properly

---

## Testing Biometric Flow

### To Test Biometric Login:

1. **Enable Biometric:**
   - Go to Settings
   - Enable "FaceID" toggle
   - Verify it's enabled

2. **Save Credentials:**
   - Log out completely
   - Log back in (password or OAuth)
   - This saves refresh token to SecureStore

3. **Test Biometric:**
   - Fully close app (swipe away)
   - Reopen app
   - FaceID should prompt immediately
   - After FaceID success, should go to Home

4. **Test Without Biometric:**
   - Disable biometric in Settings
   - Fully close app
   - Reopen app
   - Should go to Welcome screen (no FaceID prompt)

---

## Key Takeaways

1. **Biometric is Optional** - Users can stay logged in without it
2. **Two-Step Process:**
   - Enable in Settings (preference)
   - Log in after enabling (saves credentials)
3. **Biometric Only Used When:**
   - User is logged out (no session)
   - Biometric is enabled in Settings
   - Stored credentials exist
   - App cold starts (not just resumed)
4. **Session Persistence Works Without Biometric:**
   - Core session persistence is independent
   - Users stay logged in via Supabase session storage
   - Biometric is just a convenience feature

---

## Debugging: Why FaceID Isn't Triggering

### Check These in Order:

1. **Is biometric enabled in app Settings?**
   ```typescript
   const enabled = await getBiometricPreference()
   console.log("Biometric enabled:", enabled)
   ```

2. **Are credentials stored?**
   ```typescript
   const token = await getBiometricRefreshToken()
   const userId = await getBiometricUserId()
   console.log("Has credentials:", !!token && !!userId)
   ```

3. **Is there an existing session?**
   ```typescript
   const { data: { session } } = await supabase.auth.getSession()
   console.log("Has session:", !!session)
   // If session exists, biometric won't trigger (by design)
   ```

4. **Is app cold starting?**
   - Fully close app (not just background)
   - Reopen app
   - Check console logs for biometric check

5. **Check boot process logs:**
   - Look for `[boot] biometric enabled, attempting biometric login`
   - Look for `[boot] biometric login successful`
   - Look for `[boot] biometric authentication cancelled/failed`

---

## Recommendations for Session Persistence Fixes

1. **Keep Biometric in Boot Process** ✅
   - Don't remove it (as originally planned)
   - Check it AFTER AuthProvider initializes
   - If AuthProvider has no user, then try biometric

2. **Improve Credential Saving** ⚠️
   - Currently credentials only saved after login
   - Consider saving when user enables biometric (if already logged in)
   - Or prompt user to log out/in after enabling

3. **Better Error Handling** ⚠️
   - If biometric fails, don't clear credentials immediately
   - Retry once before clearing
   - Show user-friendly message

4. **User Education** 💡
   - When user enables biometric, show message:
     "FaceID enabled! Log out and log back in to use FaceID for quick login."
   - Or automatically save credentials if user is already logged in

