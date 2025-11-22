# Auth Testing Workflow for Simulator

## ⚠️ The Problem

When testing auth flows in the simulator, if auth fails and you don't properly log out, **partial session data can persist** in AsyncStorage. This can cause:

1. **Stale session tokens** - Supabase may think you're still logged in
2. **Onboarding flags** - App may skip onboarding steps
3. **Partial user data** - Incomplete user records may interfere with new sign-ups
4. **OAuth state** - OAuth redirects may be cached

## ✅ Best Practice: Always Reset Between Tests

### Option 1: Use Dev Reset Button (Recommended)

1. **Open Settings** (if logged in) or use the dev reset before testing
2. **Tap "🧹 DEV: Clear All Auth State"** button (only visible in dev mode)
3. **Restart the app** manually (Cmd+R in simulator or shake → Reload)
4. **Test your auth flow** as a fresh user

### Option 2: Manual Logout

1. **Complete logout** via Settings → "Log out"
2. This clears:
   - Supabase session
   - Biometric credentials
   - User-specific onboarding flags
   - PostHog user data
3. **Restart the app** to ensure clean state
4. **Test your auth flow**

### Option 3: Programmatic Reset (For Automated Testing)

```typescript
import { clearAllAuthState } from "../lib/dev-auth-reset"

// In your test setup
beforeEach(async () => {
  await clearAllAuthState()
  // Restart app or wait for state to clear
})
```

## 🧹 What Gets Cleared

The `clearAllAuthState()` function clears:

### Supabase Storage
- All keys starting with `sb-` (Supabase session tokens)
- Calls `supabase.auth.signOut()` to properly clear session

### Onboarding State
- `has_completed_post_auth_onboarding_*` (user-specific flags)
- `onboarding_data_*` (OnboardingProvider state)

### App State
- `pending_group_join` (pending group invitations)
- `current_group_id` (selected group)
- `group_visited_*` (group visit timestamps)
- `has_requested_notifications` (notification permission flag)

### Biometric & Security
- Biometric credentials (via `clearBiometricCredentials()`)

## 📋 Testing Checklist

Before testing auth flows:

- [ ] Clear auth state (use dev reset button or logout)
- [ ] Restart the app
- [ ] Verify you're on the boot/login screen
- [ ] Test the auth flow
- [ ] If auth fails, **clear state again** before retrying
- [ ] Never test multiple auth attempts without clearing state

## 🔍 Verifying Clean State

To check what auth keys exist in storage:

```typescript
import { listAuthKeys } from "../lib/dev-auth-reset"

const keys = await listAuthKeys()
console.log("Auth keys in storage:", keys)
// Should be empty array for clean state
```

## 🚨 Common Issues

### Issue: "Still logged in" after failed auth
**Cause**: Partial session data persisted  
**Fix**: Use dev reset button, restart app

### Issue: OAuth redirects to wrong screen
**Cause**: Cached OAuth state  
**Fix**: Clear auth state, restart app

### Issue: Onboarding skipped unexpectedly
**Cause**: Onboarding flag still set from previous test  
**Fix**: Clear auth state (removes `has_completed_post_auth_onboarding_*` keys)

### Issue: "User already exists" error
**Cause**: Partial user record in database from failed sign-up  
**Fix**: 
1. Clear auth state (won't fix DB, but clears local state)
2. Delete user from Supabase dashboard if needed
3. Or use a different email for testing

## 💡 Pro Tips

1. **Use test emails**: Create test accounts with predictable emails (`test1@example.com`, `test2@example.com`) to avoid conflicts

2. **Check Supabase Dashboard**: If auth fails, check Supabase Auth dashboard to see if partial user records were created

3. **Monitor Logs**: Watch console logs for `[dev-auth-reset]` messages to confirm what was cleared

4. **Restart After Reset**: Always restart the app after clearing auth state to ensure React state is also reset

5. **Test Both Paths**: Test both successful and failed auth flows to ensure cleanup works in both cases

## 🔐 Production Safety

The `clearAllAuthState()` function is **only available in development mode** (`__DEV__ === true`). It will not work in production builds, ensuring users can't accidentally clear their auth state.

## 📝 Implementation Details

See `lib/dev-auth-reset.ts` for the full implementation. The function:
- Checks `__DEV__` flag before running
- Clears all auth-related AsyncStorage keys
- Calls Supabase signOut for proper cleanup
- Clears biometric credentials
- Provides detailed console logging

