# Dark Mode Implementation Audit

## Overview
This document outlines all logged-in screens, modals, and components that need dark mode support. Dark mode should NOT apply to onboarding/logged-out screens.

## Color Mapping (Dark Mode vs Light Mode)

### Background Colors
- **Page background**: `#E8E0D5` (beige) → `#000000` (black)
- **Card background** (`#F5F0EA` cream): → `#000000` (black) in EntryCard
- **Pure white** (`#FFFFFF`): → `#E8E0D5` (beige)

### Text Colors
- **Black text** (`#000000`): → `#F5F0EA` (cream)
- **Black outlines/borders**: → `#F5F0EA` (cream)
- **Text secondary** (`#404040`): → Appropriate light color (TBD)

### UI Elements
- **Avatar color outlines**: → White (instead of colored)
- **CTA colors**: Stay the same (no change)
- **Daily question colors**: Stay the same (no change)

---

## Screens & Modals to Update

### Main Screens (app/(main)/)
1. ✅ **home.tsx** - Primary home feed screen
2. ✅ **explore-decks.tsx** - Deck exploration screen
3. ✅ **collection-detail.tsx** - Collection detail view
4. ✅ **deck-detail.tsx** - Individual deck detail
5. ✅ **deck-vote.tsx** - Deck voting screen
6. ✅ **birthday-card-details.tsx** - Birthday card detail view
7. ✅ **custom-question-onboarding.tsx** - Custom question onboarding
8. ✅ **add-custom-question.tsx** - Add custom question screen
9. ✅ **settings.tsx** - Settings screen (needs dark mode toggle)
10. ✅ **settings/profile.tsx** - Profile settings
11. ✅ **settings/latest-changes.tsx** - Latest changes screen
12. ✅ **feedback.tsx** - Feedback screen
13. ✅ **ideas.tsx** - Ideas screen
14. ✅ **group-settings/index.tsx** - Group settings main
15. ✅ **group-settings/name.tsx** - Group name settings
16. ✅ **group-settings/invite.tsx** - Group invite settings
17. ✅ **group-settings/manage-members.tsx** - Manage members
18. ✅ **group-settings/question-types.tsx** - Question types settings
19. ✅ **group-settings/remembering-them.tsx** - Memorial settings
20. ✅ **group-settings/leave.tsx** - Leave group screen

### Modals (app/(main)/modals/)
1. ✅ **entry-composer.tsx** - Entry creation modal
2. ✅ **entry-detail.tsx** - Entry detail modal
3. ✅ **birthday-card-composer.tsx** - Birthday card composer modal
4. ✅ **birthday-card-entry-detail.tsx** - Birthday card entry detail
5. ✅ **custom-question-success.tsx** - Custom question success modal
6. ✅ **suggest-deck.tsx** - Suggest deck modal
7. ✅ **suggest-deck-success.tsx** - Suggest deck success modal
8. ✅ **contribute-featured-question.tsx** - Contribute featured question modal

### Components (components/)
1. ✅ **EntryCard.tsx** - Entry card component (critical - cream card → black)
2. ✅ **Avatar.tsx** - Avatar component (color outlines → white)
3. ✅ **Button.tsx** - Button component
4. ✅ **Input.tsx** - Input component
5. ✅ **UserProfileModal.tsx** - User profile modal component
6. ✅ **NotificationModal.tsx** - Notification modal component
7. ✅ **NotificationBell.tsx** - Notification bell component
8. ✅ **CustomQuestionBanner.tsx** - Custom question banner
9. ✅ **BirthdayCardYourCardBanner.tsx** - Birthday card banner
10. ✅ **BirthdayCardUpcomingBanner.tsx** - Upcoming birthday banner
11. ✅ **BirthdayCardEditBanner.tsx** - Birthday card edit banner
12. ✅ **CategoryTag.tsx** - Category tag component
13. ✅ **PromptSkeleton.tsx** - Loading skeleton
14. ✅ **EmojiPicker.tsx** - Emoji picker component
15. ✅ **MentionAutocomplete.tsx** - Mention autocomplete
16. ✅ **MentionableText.tsx** - Mentionable text component
17. ✅ **PhotoLightbox.tsx** - Photo lightbox viewer
18. ✅ **MediaViewer.tsx** - Media viewer component
19. ✅ **EmbeddedPlayer.tsx** - Embedded media player
20. ✅ **FilmFrame.tsx** - Film frame component
21. ✅ **OnboardingGallery.tsx** - Onboarding gallery (but NOT for logged-out onboarding)

### Layout Components
1. ✅ **_layout.tsx** (app/(main)/_layout.tsx) - Tab bar component

---

## Implementation Plan

### Phase 1: Theme Context & Settings Toggle
1. Update `lib/theme-context.tsx`:
   - Change default theme from "dark" to "light"
   - Ensure theme persistence works correctly

2. Update `app/(main)/settings.tsx`:
   - Add dark mode toggle with light/dark icons
   - Position toggle appropriately in settings UI
   - Use `setTheme` from `useTheme()` hook

### Phase 2: Core Screens (Start with home.tsx)
1. **home.tsx** - Verify color mapping works correctly
   - Update all `theme2Colors` references
   - Map beige → black for backgrounds
   - Map black text → cream (#F5F0EA)
   - Map white → beige (#E8E0D5)
   - Keep CTA colors and daily question colors unchanged
   - Test all UI elements

### Phase 3: Components
1. **EntryCard.tsx** - Critical component
   - Map cream card (#F5F0EA) → black
   - Update text colors
   - Update border colors

2. **Avatar.tsx** - Update border colors
   - Color outlines → white in dark mode

3. Other components as needed

### Phase 4: Remaining Screens & Modals
- Apply same color mapping pattern to all remaining screens
- Test each screen thoroughly

---

## Color Reference

### Light Mode (Current)
```typescript
const theme2Colors = {
  red: "#B94444",
  yellow: "#E8A037",
  green: "#2D6F4A",
  blue: "#3A5F8C",
  beige: "#E8E0D5",      // Page background
  cream: "#F5F0EA",       // Card background
  white: "#FFFFFF",       // Pure white
  text: "#000000",        // Black text
  textSecondary: "#404040", // Gray text
  onboardingPink: "#D97393",
}
```

### Dark Mode (New)
```typescript
const theme2ColorsDark = {
  red: "#B94444",         // Same
  yellow: "#E8A037",      // Same
  green: "#2D6F4A",       // Same
  blue: "#3A5F8C",        // Same
  beige: "#000000",       // Black (was beige)
  cream: "#000000",       // Black (was cream) - for EntryCard
  white: "#E8E0D5",       // Beige (was white)
  text: "#F5F0EA",        // Cream (was black)
  textSecondary: "#A0A0A0", // Light gray (was dark gray) - TBD exact value
  onboardingPink: "#D97393", // Same
}
```

---

## Notes

1. **Daily Question Colors**: Keep as-is (yellow background, blue border, etc.)
2. **CTA Colors**: Keep as-is (blue buttons, pink buttons, etc.)
3. **Avatar Borders**: In dark mode, use white instead of colored borders
4. **EntryCard**: Cream (#F5F0EA) card becomes black in dark mode
5. **Text Contrast**: Ensure all text has sufficient contrast in dark mode
6. **Borders/Outlines**: Black borders become cream (#F5F0EA) in dark mode

---

## Testing Checklist

For each screen/component:
- [ ] Background colors update correctly
- [ ] Text colors are readable (sufficient contrast)
- [ ] Borders/outlines update correctly
- [ ] Avatar borders are white in dark mode
- [ ] EntryCard background is black in dark mode
- [ ] CTA colors remain unchanged
- [ ] Daily question colors remain unchanged
- [ ] Toggle works and persists across app restarts
- [ ] No visual glitches or flashing when toggling

---

## Files NOT to Update (Logged-out/Onboarding)

- `app/(onboarding)/**` - All onboarding screens
- `app/(auth)/**` - Sign in/sign up screens
- `app/index.tsx` - Boot screen
- Any screens accessed before user authentication

