# Loading Screen Logic Analysis

## Current Flow (Background App Open)

1. **Native Splash Screen** (static loading.png)
   - Shows immediately when app opens
   - Controlled by Expo's native splash screen system

2. **Component Mounts** (`app/index.tsx`)
   - Beige background (`theme2Colors.beige`) renders immediately
   - `shouldRenderBootScreen` is calculated based on:
     - `shouldShowBooting` (booting/authLoading/restoringSession/etc)
     - `shouldForceShowBoot` (minimum 1 second display time)
     - `isOnRootRoute && !isPasswordResetLink` (always show on root)

3. **Spinner Animation Starts** (line 1378-1393)
   - Animation starts immediately on mount
   - Always runs, regardless of `shouldShowBooting`

4. **Native Splash Hides** (line 1414-1422)
   - Hides 100ms after `shouldRenderBootScreen` becomes true
   - This creates a gap if `shouldRenderBootScreen` is false initially

5. **Spinner Renders** (line 1427-1443)
   - Only renders if `shouldRenderBootScreen` is true
   - If false, shows error/fallback UI instead

## The Problem

**Blank beige screen occurs when:**
- Native splash hides (line 1418)
- But `shouldRenderBootScreen` is still false
- So spinner doesn't render yet
- Result: Blank beige background with no spinner

**Why `shouldRenderBootScreen` might be false:**
- `shouldShowBooting` is false (booting/authLoading/etc all false)
- `shouldForceShowBoot` is false (more than 1 second elapsed)
- `isOnRootRoute` might be false initially (pathname not set yet)

## The Fix

Ensure spinner is **always visible** when on root route, even before state settles. The animation already starts immediately, so we just need to ensure the component renders immediately.

**Solution:** Always render spinner when on root route, regardless of other state. The beige background is already showing, so we should always show the spinner too.
