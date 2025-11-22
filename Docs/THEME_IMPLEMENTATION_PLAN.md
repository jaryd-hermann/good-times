# Theme System Implementation Plan

## Overview
Implement a light/dark theme toggle system that allows users to switch between themes. Dark mode is the default (current theme). Light mode changes backgrounds from black to #F9F4EC and text/icons from white to black.

## Scope
**Affected Screens (Logged-in only):**
- `app/(main)/home.tsx`
- `app/(main)/history.tsx`
- `app/(main)/modals/entry-detail.tsx`
- `app/(main)/modals/entry-composer.tsx`
- `app/(main)/settings.tsx`
- `app/(main)/group-settings/*` (all group settings screens and modals)
- `app/(main)/feedback.tsx`
- `app/(main)/_layout.tsx` (tab bar)

**NOT Affected:**
- All onboarding screens (`app/(onboarding)/*`)
- Boot screen (`app/index.tsx`)
- Auth screen (`app/(onboarding)/auth.tsx`)
- Join screen (`app/join/[groupId].tsx`)

## Architecture

### 1. Theme Context System
**File: `lib/theme-context.tsx`** (NEW)
- Create `ThemeContext` and `ThemeProvider` similar to `TabBarContext`
- Manage theme state: `"dark"` | `"light"` (default: `"dark"`)
- Provide `useTheme()` hook that returns:
  - `theme: "dark" | "light"`
  - `setTheme: (theme: "dark" | "light") => Promise<void>`
  - `colors: ThemeColors` (theme-aware color object)
  - `isDark: boolean`
- Load theme preference on mount:
  1. Check AsyncStorage first (fast)
  2. Fallback to user profile database
  3. Default to "dark" if neither exists
- Persist theme changes:
  1. Save to AsyncStorage immediately
  2. Save to user profile database (`users.theme_preference` column)

### 2. Database Schema Update
**File: `supabase/migrations/XXX_add_theme_preference.sql`** (NEW)
```sql
ALTER TABLE users ADD COLUMN theme_preference TEXT DEFAULT 'dark' CHECK (theme_preference IN ('dark', 'light'));
```

**File: `lib/types.ts`** (UPDATE)
- Add `theme_preference?: "dark" | "light"` to `User` type

### 3. Theme-Aware Color System
**File: `lib/theme.ts`** (REFACTOR)
- Keep existing `colors` object as base dark theme
- Create `getThemeColors(theme: "dark" | "light")` function that returns:
  - **Dark mode** (current): Unchanged
  - **Light mode**:
    - `black: "#F9F4EC"` (was `#000000`)
    - `white: "#000000"` (was `#ffffff`)
    - `accent: "#de2f08"` (unchanged - red stays red)
    - `gray` scale: Invert appropriately:
      - `gray[100]: "#171717"` (was `#f5f5f5`)
      - `gray[200]: "#262626"` (was `#e5e5e5`)
      - `gray[300]: "#404040"` (was `#d4d4d4`)
      - `gray[400]: "#737373"` (was `#a3a3a3`)
      - `gray[500]: "#a3a3a3"` (was `#737373`)
      - `gray[600]: "#d4d4d4"` (was `#525252`)
      - `gray[700]: "#e5e5e5"` (was `#404040`)
      - `gray[800]: "#f5f5f5"` (was `#262626`)
      - `gray[900]: "#ffffff"` (was `#171717`)
    - `filmInner: "#F9F4EC"` (was `#0D0F1B`)
- Update `typography` to use theme-aware colors (remove hardcoded `color: colors.white`)

### 4. Component Updates

#### Core Components
**File: `components/Button.tsx`** (UPDATE)
- Use `useTheme()` hook
- Update styles to use theme-aware colors
- Ensure ghost variant border color adapts
- Update ActivityIndicator color

**File: `components/Avatar.tsx`** (UPDATE)
- Use `useTheme()` hook
- Update background and text colors

**File: `components/EntryCard.tsx`** (UPDATE)
- Use `useTheme()` hook
- Update all color references:
  - Background colors
  - Text colors
  - Icon colors (FontAwesome)
  - Border colors
  - Separator colors

**File: `components/EmbeddedPlayer.tsx`** (UPDATE)
- Use `useTheme()` hook
- Update ActivityIndicator color (currently `colors.white`)
- Update container background if needed

**Components NOT to Update (Onboarding Only):**
- `components/OnboardingBack.tsx` - Used in onboarding, stays dark
- `components/OnboardingProgress.tsx` - Used in onboarding, stays dark
- `components/FilmFrame.tsx` - Not used in main screens
- `components/Input.tsx` - Check if used in main screens (if yes, update; if no, skip)
- `components/MediaViewer.tsx` - Check usage (if used in main screens, update)

#### Screen Components
All affected screens need to:
1. Import `useTheme()` hook
2. Replace `colors` import with theme-aware colors from hook
3. Update all `StyleSheet.create()` calls to use theme colors
4. Update inline styles that reference `colors.*`

**Files to update:**
- `app/(main)/home.tsx`
- `app/(main)/history.tsx`
- `app/(main)/modals/entry-detail.tsx`
- `app/(main)/modals/entry-composer.tsx`
- `app/(main)/settings.tsx`
- `app/(main)/feedback.tsx`
- `app/(main)/_layout.tsx`
- `app/(main)/group-settings/index.tsx`
- `app/(main)/group-settings/invite.tsx`
- `app/(main)/group-settings/leave.tsx`
- `app/(main)/group-settings/manage-members.tsx`
- `app/(main)/group-settings/name.tsx`
- `app/(main)/group-settings/question-types.tsx`
- `app/(main)/group-settings/remembering-them.tsx`

### 5. Settings UI
**File: `app/(main)/settings.tsx`** (UPDATE)
- Add theme toggle in settings section (similar to biometric toggle)
- Use `Switch` component
- Call `setTheme()` from `useTheme()` hook
- Show current theme state

### 6. Root Layout Integration
**File: `app/_layout.tsx`** (UPDATE)
- Wrap main app with `ThemeProvider`
- Ensure theme loads before rendering main screens
- Only wrap `(main)` routes, NOT `(onboarding)` routes

### 7. Database Functions
**File: `lib/db.ts`** (UPDATE)
- Update `getCurrentUser()` to include `theme_preference`
- Update `updateUser()` to handle `theme_preference` field

## Implementation Steps

### Phase 1: Foundation
1. ✅ Create database migration for `theme_preference` column
2. ✅ Create `lib/theme-context.tsx` with ThemeProvider
3. ✅ Refactor `lib/theme.ts` to support theme-aware colors
4. ✅ Update `lib/types.ts` with theme_preference type
5. ✅ Update `lib/db.ts` to handle theme_preference

### Phase 2: Core Integration
6. ✅ Wrap app with ThemeProvider in `app/_layout.tsx`
7. ✅ Update `components/Button.tsx` to use theme
8. ✅ Update `components/Avatar.tsx` to use theme
9. ✅ Update `components/EntryCard.tsx` to use theme
10. ✅ Update `components/EmbeddedPlayer.tsx` to use theme

### Phase 3: Screen Updates
10. ✅ Update `app/(main)/settings.tsx` (add toggle + theme support)
11. ✅ Update `app/(main)/home.tsx`
12. ✅ Update `app/(main)/history.tsx`
13. ✅ Update `app/(main)/modals/entry-detail.tsx`
14. ✅ Update `app/(main)/modals/entry-composer.tsx`
15. ✅ Update `app/(main)/feedback.tsx`
16. ✅ Update `app/(main)/_layout.tsx` (tab bar)
17. ✅ Update all `app/(main)/group-settings/*` files

### Phase 4: Testing & Validation
18. ✅ Test theme persistence (AsyncStorage + database)
19. ✅ Test theme switching in settings
20. ✅ Verify dark mode unchanged (default)
21. ✅ Verify light mode colors correct
22. ✅ Verify icons change color appropriately
23. ✅ Verify onboarding screens NOT affected
24. ✅ Test on multiple screens/navigation flows

## Color Mapping Reference

### Dark Mode (Default - Current)
- Background: `#000000` (black)
- Text: `#ffffff` (white)
- Icons: `#ffffff` (white)
- Accent: `#de2f08` (red - unchanged)

### Light Mode
- Background: `#F9F4EC` (cream/beige)
- Text: `#000000` (black)
- Icons: `#000000` (black)
- Accent: `#de2f08` (red - unchanged)

## Edge Cases & Considerations

1. **Icon Colors**: All FontAwesome icons using `color={colors.white}` need to change to `color={themeColors.text}` or `color={themeColors.white}` (which will be black in light mode)

2. **Border Colors**: Borders using `colors.gray[800]` or `colors.white` need theme awareness

3. **Modal Backdrops**: Dark overlays (`rgba(0,0,0,0.85)`) may need adjustment for light mode

4. **Image Overlays**: Text overlays on images may need contrast adjustments

5. **Status Bar**: May need to adjust status bar style based on theme (light content vs dark content)

6. **Loading States**: ActivityIndicator colors need theme awareness

7. **Placeholder Text**: `placeholderTextColor` needs theme awareness

8. **Separators/Dividers**: Currently `#3D3D3D` - may need lighter color in light mode

9. **Tab Bar**: Custom tab bar in `app/(main)/_layout.tsx` needs theme support

10. **React Query Cache**: Theme changes should trigger re-renders, but ensure StyleSheet updates properly

## Persistence Strategy

1. **AsyncStorage Key**: `user_theme_preference_{userId}` (for quick access)
2. **Database Column**: `users.theme_preference` (for persistence across devices)
3. **Load Order**:
   - On app start: Check AsyncStorage → Check DB → Default to "dark"
   - On theme change: Update AsyncStorage → Update DB → Trigger re-render

## Testing Checklist

- [ ] Theme persists after app restart
- [ ] Theme syncs across devices (if user logs in elsewhere)
- [ ] Dark mode looks identical to current app (no regressions)
- [ ] Light mode has correct colors (#F9F4EC background, black text)
- [ ] All icons change color appropriately
- [ ] Onboarding screens remain dark (not affected)
- [ ] Settings toggle works correctly
- [ ] Navigation between screens maintains theme
- [ ] Modals maintain theme
- [ ] Entry cards display correctly in both themes
- [ ] Group settings screens work in both themes
- [ ] No flash of wrong theme on app start

## Risk Mitigation

1. **Backward Compatibility**: Default to "dark" if no preference exists
2. **Migration**: Existing users will default to "dark" (current behavior)
3. **Performance**: Cache theme in AsyncStorage for fast access
4. **Type Safety**: Use TypeScript enums/types for theme values
5. **Testing**: Test both themes thoroughly before release

## Notes

- Accent color (red) stays the same in both themes for brand consistency
- Gray scale inversion ensures proper contrast in both themes
- All changes are scoped to logged-in screens only
- Onboarding flow remains unchanged (always dark)

