# Good Times App - Agent Context Document

## Project Overview

**Good Times** is a private, nostalgic journaling app for families and friends living apart. Users create groups, answer daily prompts together, and build a shared timeline of memories. The app emphasizes privacy, simplicity, and emotional connection.

### Core Concept
- Users create or join private groups
- Daily prompts are sent to group members
- Members respond with text, photos, videos, voice memos, or embedded music (Spotify/Apple Music)
- All responses are visible to group members in a timeline
- Groups can be memorial-focused (remembering loved ones) or living groups

---

## Tech Stack

### Frontend
- **React Native**: `^0.81.5` (Old Architecture - New Architecture disabled)
- **React**: `19.1.0` (pinned exact version - critical for compatibility)
- **Expo SDK**: `^54.0.23`
- **Expo Router**: `~6.0.14` (file-based routing)
- **TypeScript**: `~5.3.3`
- **React Query** (`@tanstack/react-query`): `^5.17.0` (data fetching/caching)
- **React Native Animated API**: Built-in (NOT `react-native-reanimated` - it was removed)

### Backend
- **Supabase**: Database, Auth, Storage, Edge Functions
- **PostgreSQL**: Via Supabase
- **Storage Buckets**: `entries-media`, `avatars`

### Key Libraries
- `expo-av`: Audio recording/playback for voice memos
- `expo-image-picker`: Photo/video selection
- `expo-notifications`: Push notifications
- `expo-local-authentication`: FaceID/TouchID
- `expo-secure-store`: Secure credential storage
- `expo-file-system`: File operations (using `/legacy` import)
- `react-native-webview`: Spotify/Apple Music embeds
- `date-fns`: Date manipulation
- `@react-native-community/datetimepicker`: Date selection

---

## Architecture Decisions

### 1. **React Native New Architecture: DISABLED**
- **Why**: Caused crashes during native module registration
- **Config**: `newArchEnabled: false` in `app.config.ts` and `ios/Podfile.properties.json`
- **Impact**: Cannot use libraries requiring New Architecture (e.g., Reanimated 4.x)

### 2. **React Version: Pinned to 19.1.0**
- **Why**: React Native renderer requires exact match
- **Critical**: Do NOT upgrade React without checking `react-native-renderer` compatibility
- **Error if mismatched**: "Incompatible React versions: react: 19.2.0 vs react-native-renderer: 19.1.0"

### 3. **No react-native-reanimated**
- **Why**: Removed due to compatibility issues with Old Architecture
- **Alternative**: Using React Native's built-in `Animated` API
- **Files**: `babel.config.js` does NOT include `react-native-reanimated/plugin`

### 4. **Group Context Management**
- **Storage**: `AsyncStorage` key `"current_group_id"` persists selected group
- **Sync**: `useFocusEffect` hooks sync group ID on screen focus
- **Critical**: All queries must filter by `currentGroupId` to prevent data leakage between groups

### 5. **Data Fetching Strategy**
- **React Query**: All server data fetched via `@tanstack/react-query`
- **Query Keys**: Include `currentGroupId` for group-specific data
- **Invalidation**: Use prefix matching (`exact: false`) when invalidating group queries
- **Stale Time**: `staleTime: 0` for history entries to ensure fresh data on group switch

---

## Key Features

### 1. **Multi-Group Support**
- Users can belong to multiple groups
- Group switcher in header shows all groups
- Red dot indicator for groups with unseen updates
- Each group has isolated data (entries, prompts, comments)

### 2. **Daily Prompts**
- Group-specific question queues (prevents duplicate questions across groups)
- Configurable question categories per group
- Birthday prompts automatically injected
- Prompts sent at 9am local time via Edge Functions

### 3. **Entry Types**
- **Text**: Rich text input
- **Photos**: Multiple images per entry
- **Videos**: Single video per entry
- **Voice Memos**: WhatsApp-style recording UI with play/pause/progress
- **Embedded Music**: Spotify and Apple Music links (parsed and embedded)

### 4. **History View**
- **Views**: Days, Weeks, Months, Years
- **Period Cards**: Show summary with background image from entries in that period
- **Entry Cards**: Film frame design with media carousel, text fade, comment previews
- **Auto-hide Header**: Scrolls up/down with smooth animation

### 5. **Push Notifications**
- New group member joins
- New entry posted by another member
- Daily prompt available
- New comment on user's entry
- Scheduled via Supabase Edge Functions + `pg_cron`

### 6. **Authentication**
- Email/password
- Google OAuth
- Apple OAuth
- Biometric (FaceID/TouchID) for quick login
- Secure refresh token storage

### 7. **Onboarding Flow**
- Welcome screens → About (name, birthday, photo) → Auth → How It Works → Create Group → Invite
- Group join flow: Join link → Landing page → About → Auth → How It Works → Home

---

## Current State & Recent Fixes

### Latest Commits (Most Recent First)
1. **Date picker visibility fix**: Changed modal background to black (matches settings.tsx pattern)
2. **Keyboard behavior fix**: Added ScrollView wrapper to auth screen, adjusted KeyboardAvoidingView
3. **App icon update**: Changed to `icon-ios.png`
4. **useRef import fix**: Added missing import in auth.tsx
5. **EAS build fixes**: Added `NPM_CONFIG_LEGACY_PEER_DEPS` for npm ci compatibility

### Known Working Features
✅ Multi-group switching with data isolation  
✅ Entry creation with all media types  
✅ Voice memo recording and playback  
✅ Spotify/Apple Music embeds  
✅ History view with period filtering  
✅ Push notifications (configured, needs testing)  
✅ OAuth sign-in (Google/Apple)  
✅ Biometric authentication  
✅ Group settings and question category preferences  

### Known Issues/Workarounds

#### 1. **Local Builds (`npx expo run:ios`)**
- **Status**: Works but requires manual RCT-Folly patch
- **Issue**: `folly/coro/Coroutine.h` header error
- **Workaround**: `ios/Podfile` has `post_install` hook that patches headers
- **Note**: If `pod install` is run, patch is reapplied automatically

#### 2. **EAS Development Builds**
- **Status**: Recommended for local testing
- **Command**: `eas build --profile development --platform ios`
- **Why**: Handles all compatibility issues automatically

#### 3. **Expo Go Not Supported**
- **Why**: App uses native modules (camera, audio, secure storage, etc.)
- **Solution**: Must use development build or production build

#### 4. **OAuth Redirects in Simulator**
- **Issue**: OAuth redirects often don't work in iOS simulators
- **Workaround**: Test OAuth on physical device or use email/password in simulator
- **Code**: Timeout handler in `auth.tsx` shows user-friendly message after 30 seconds

---

## Development Workflow

### Local Development (Recommended)
```bash
# Start Metro bundler with dev client
npx expo start --dev-client

# Or build locally (requires Xcode)
npx expo run:ios
```

### EAS Development Build
```bash
# Build development client
eas build --profile development --platform ios

# Install on device/simulator, then:
npx expo start --dev-client
```

### Production Build & TestFlight
```bash
# Build for production
eas build --platform ios --profile production

# Submit to TestFlight
eas submit --platform ios --latest
```

### Hot Reload
- JavaScript changes: Hot reload automatically
- Native changes: Requires rebuild
- Config changes (`app.config.ts`): Requires rebuild

---

## Git Repository Setup

### Repository Information
- **Remote URL**: `git@github.com:jaryd-hermann/good-times.git` (SSH)
- **Default Branch**: `main`
- **Repository Type**: Private GitHub repository

### SSH Setup for New Agent Sessions

When starting a new agent session, SSH keys may not be loaded in the SSH agent. Follow these steps to enable git operations:

#### 1. Verify SSH Key Exists
```bash
ls -la ~/.ssh/id_ed25519
# Should show: -rw-------  1 user  staff  419 [date] /Users/[user]/.ssh/id_ed25519
```

#### 2. Add SSH Key to SSH Agent
```bash
ssh-add ~/.ssh/id_ed25519
# Should output: Identity added: /Users/[user]/.ssh/id_ed25519 ([email])
```

#### 3. Verify SSH Connection to GitHub
```bash
ssh -T git@github.com
# Should output: Hi jaryd-hermann! You've successfully authenticated, but GitHub does not provide shell access.
```

#### 4. Verify Git Remote Configuration
```bash
git remote -v
# Should show:
# origin	git@github.com:jaryd-hermann/good-times.git (fetch)
# origin	git@github.com:jaryd-hermann/good-times.git (push)
```

### Standard Git Operations

Once SSH is configured, you can perform standard git operations:

```bash
# Stage all changes
git add -A

# Commit changes
git commit -m "Your commit message"

# Push to remote main branch
git push origin main

# Pull latest changes
git pull origin main

# Check status
git status
```

### Troubleshooting Git/SSH Issues

#### "The agent has no identities"
- **Fix**: Run `ssh-add ~/.ssh/id_ed25519` to load your SSH key

#### "Could not read from remote repository"
- **Check**: Verify SSH connection with `ssh -T git@github.com`
- **Check**: Ensure SSH key is added with `ssh-add -l`
- **Check**: Verify remote URL with `git remote -v`
- **Note**: If GitHub is experiencing issues, check https://www.githubstatus.com

#### "upstream connect error" or "Connection refused"
- **Possible causes**: 
  - Temporary GitHub connectivity issues
  - Network/VPN blocking SSH port 22
  - GitHub service outage
- **Solution**: Wait a few minutes and retry, or check GitHub status page

#### SSH Key Not Persisting Between Sessions
- **macOS Solution**: Add to `~/.ssh/config`:
  ```
  Host github.com
    AddKeysToAgent yes
    UseKeychain yes
    IdentityFile ~/.ssh/id_ed25519
  ```
- This will automatically add the key to the agent and macOS keychain

### Important Notes
- **Always verify SSH connection** before attempting git push/pull operations
- **Commit messages** should be descriptive and follow project conventions
- **Never force push** to main branch without explicit approval
- **Check git status** before committing to see what changes will be included

---

## Build Configuration

### `app.config.ts`
- **Version**: `1.1.0`
- **Build Number**: `5` (increment for each TestFlight submission)
- **Icon**: `./assets/images/icon-ios.png`
- **Scheme**: `goodtimes://` (for deep links)
- **New Architecture**: `false`
- **iOS Deployment Target**: `15.1` (set in `ios/Podfile.properties.json`)

### `eas.json`
- **Production Profile**:
  - Uses `image: "latest"` for Xcode 16 compatibility
  - `autoIncrement: true` for build numbers
  - `NPM_CONFIG_LEGACY_PEER_DEPS: "true"` for npm ci compatibility

### Environment Variables
Required in `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Set as EAS secrets for cloud builds:
```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value your_url
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value your_key
```

---

## Important Files & Their Purpose

### Core App Files
- `app/_layout.tsx`: Root layout, error boundaries, OAuth redirect handling
- `app/index.tsx`: Boot logic, auth state check, routing
- `app/(main)/home.tsx`: Daily feed, prompt display, entry cards
- `app/(main)/history.tsx`: Timeline view, period filtering, entry summaries
- `app/(main)/modals/entry-composer.tsx`: Entry creation with media upload
- `app/(main)/modals/entry-detail.tsx`: Full entry view with comments/reactions
- `app/(onboarding)/auth.tsx`: Sign in/sign up, OAuth handling
- `app/(onboarding)/about.tsx`: Profile creation, date picker

### Library Files
- `lib/supabase.ts`: Supabase client initialization (with safe require)
- `lib/db.ts`: Database query functions
- `lib/storage.ts`: Media upload/deletion (uses `expo-file-system/legacy`)
- `lib/embed-parser.ts`: Spotify/Apple Music URL parsing
- `lib/biometric.ts`: FaceID/TouchID authentication
- `lib/theme.ts`: Design tokens (colors, typography, spacing)

### Components
- `components/EntryCard.tsx`: Reusable entry summary card
- `components/EmbeddedPlayer.tsx`: Spotify/Apple Music WebView player
- `components/Avatar.tsx`: User avatar display
- `components/Button.tsx`: Styled button component
- `components/ErrorBoundary.tsx`: Global error boundary

### Configuration
- `babel.config.js`: Babel config (NO reanimated plugin)
- `tsconfig.json`: TypeScript config (extends Expo base, ts-node config for EAS)
- `ios/Podfile`: CocoaPods config (includes RCT-Folly patch)
- `react-native.config.js`: Excludes reanimated from autolinking

---

## Database Schema (Supabase)

### Key Tables
- `users`: User profiles (name, email, birthday, avatar_url)
- `groups`: Group info (name, type, settings)
- `group_members`: Many-to-many relationship (user_id, group_id, joined_at)
- `prompts`: Question library (text, category, frequency)
- `daily_prompts`: Daily prompt assignments (group_id, prompt_id, date)
- `entries`: User responses (user_id, group_id, prompt_id, text, date, media_urls, embedded_media)
- `comments`: Comments on entries
- `reactions`: Emoji reactions on entries
- `notifications`: Push notification records

### Storage Buckets
- `entries-media`: Public bucket for entry photos/videos/audio
- `avatars`: Public bucket for user profile photos

### Edge Functions
- `schedule-daily-prompts`: Scheduled via pg_cron, selects prompts for each group
- `send-daily-notifications`: Sends push notifications for new prompts/entries

---

## Styling & Design System

### Colors (`lib/theme.ts`)
- `colors.black`: `#000000` (background)
- `colors.white`: `#FFFFFF` (text)
- `colors.accent`: `#de2f08` (red CTA)
- `colors.gray[400-900]`: Various grays for UI elements
- Film Frame Inner: `#0D0F1B` (dark navy for entry cards)

### Typography
- **Headings**: Libre Baskerville (Regular, Bold)
- **Body**: Roboto (Regular, Medium, Bold)
- **Sizes**: Defined in `typography` object (h1, h2, body, caption)

### Spacing
- Defined in `spacing` object (xs, sm, md, lg, xl, xxl)

---

## Critical Code Patterns

### 1. Group Context Sync
```typescript
// Always sync group ID from AsyncStorage on focus
useFocusEffect(
  useCallback(() => {
    async function syncGroupId() {
      const persistedGroupId = await AsyncStorage.getItem("current_group_id")
      if (persistedGroupId && persistedGroupId !== currentGroupId) {
        setCurrentGroupId(persistedGroupId)
      }
    }
    syncGroupId()
  }, [currentGroupId])
)
```

### 2. Query Invalidation with Group Context
```typescript
// Use prefix matching to invalidate all group queries
await queryClient.invalidateQueries({ 
  queryKey: ["entries", currentGroupId], 
  exact: false 
})
```

### 3. Safe Supabase Import
```typescript
// Use try-catch to prevent crashes during module initialization
let supabase: any
try {
  supabase = require("../lib/supabase").supabase
} catch (error) {
  console.error("Failed to load Supabase:", error)
  // Fallback client or error handling
}
```

### 4. Date Picker Modal Pattern
```typescript
// iOS date picker requires dark background for visibility
<Modal transparent animationType="fade" visible={showPicker}>
  <TouchableOpacity 
    style={styles.modalBackdrop} 
    activeOpacity={1} 
    onPress={() => setShowPicker(false)}
  >
    <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
      <DateTimePicker
        value={date}
        mode="date"
        display="spinner"
        style={styles.iosPicker}
      />
      <Button title="Done" onPress={() => setShowPicker(false)} />
    </View>
  </TouchableOpacity>
</Modal>
// modalContent backgroundColor must be colors.black for text visibility
```

---

## Testing Checklist

### Before TestFlight Submission
- [ ] Test multi-group switching (data isolation)
- [ ] Test entry creation with all media types
- [ ] Test voice memo recording and playback
- [ ] Test Spotify/Apple Music embeds
- [ ] Test OAuth sign-in (on physical device)
- [ ] Test push notifications
- [ ] Test date picker modals
- [ ] Test keyboard behavior on auth screen
- [ ] Verify app icon displays correctly
- [ ] Test group join flow via deep link

### Common Test Scenarios
1. **Group Switching**: Create Group A, post entry, create Group B, verify Group A entry still exists
2. **Media Upload**: Upload multiple photos, verify carousel displays correctly
3. **Voice Memo**: Record, verify playback UI matches entry-detail.tsx
4. **History Persistence**: Switch groups, verify history doesn't clear
5. **OAuth**: Test Google/Apple sign-in (use physical device)

---

## Troubleshooting Guide

### Build Errors

#### "folly/coro/Coroutine.h file not found"
- **Fix**: `ios/Podfile` has `post_install` hook that patches headers
- **If persists**: Manually patch `ios/Pods/RCT-Folly/folly/Expected.h` and `Optional.h`

#### "Incompatible React versions"
- **Fix**: Ensure `react` is pinned to `19.1.0` (no `^` prefix)
- **Check**: `package.json` should have `"react": "19.1.0"` (exact)

#### "npm ci failed"
- **Fix**: `eas.json` has `NPM_CONFIG_LEGACY_PEER_DEPS: "true"` in production env
- **If persists**: Check for other peer dependency conflicts

### Runtime Errors

#### "History wiped when switching groups"
- **Fix**: Ensure `staleTime: 0` and proper `placeholderData` logic in history query
- **Check**: `useFocusEffect` syncs group ID from AsyncStorage

#### "OAuth redirect not working"
- **Simulator**: Expected behavior - OAuth redirects don't work reliably in simulators
- **Device**: Ensure `goodtimes://` is in Supabase allowed redirect URLs
- **Code**: Timeout handler shows message after 30 seconds

#### "Date picker text not visible"
- **Fix**: Modal background must be `colors.black` (not white)
- **Pattern**: Match `settings.tsx` date picker implementation

---

## Next Steps & Recommendations

### Immediate Priorities
1. **TestFlight Testing**: Submit current build and test on physical devices
2. **Push Notifications**: Verify notifications are being sent and received
3. **OAuth Testing**: Test Google/Apple sign-in on physical devices
4. **Performance**: Monitor app performance with multiple groups and entries

### Future Enhancements
1. **Android Support**: Currently iOS-only, Android config exists but untested
2. **Offline Support**: Consider offline-first data sync
3. **Media Compression**: Optimize image/video upload sizes
4. **Analytics**: Add usage analytics (privacy-focused)

### Code Quality
1. **Error Handling**: Add more comprehensive error boundaries
2. **Type Safety**: Improve TypeScript types for Supabase responses
3. **Testing**: Add unit tests for critical functions
4. **Documentation**: Add JSDoc comments to complex functions

---

## Important Notes for New Agent

1. **DO NOT** enable New Architecture without thorough testing
2. **DO NOT** upgrade React without checking renderer compatibility
3. **DO NOT** add `react-native-reanimated` - use built-in Animated API
4. **ALWAYS** filter queries by `currentGroupId` to prevent data leakage
5. **ALWAYS** sync group ID from AsyncStorage on screen focus
6. **ALWAYS** use prefix matching (`exact: false`) when invalidating group queries
7. **REMEMBER**: Date picker modals need dark background for text visibility
8. **REMEMBER**: OAuth redirects don't work in simulators - test on device
9. **REMEMBER**: Local builds require RCT-Folly patch (handled in Podfile)
10. **REMEMBER**: EAS builds are recommended for production/TestFlight
11. **SETUP REQUIRED**: Before git operations, run `ssh-add ~/.ssh/id_ed25519` to load SSH key (see Git Repository Setup section)

---

## Contact & Resources

- **Repository**: GitHub (private)
- **EAS Project ID**: `ccd4fdb7-0126-46d1-a518-5839fae48a76`
- **Bundle ID**: `com.jarydhermann.goodtimes`
- **Expo Account**: Linked to EAS project

### Documentation Files
- `README.md`: Basic setup and project structure
- `WORKFLOW_CLARIFICATION.md`: Development vs. TestFlight workflow
- `TESTFLIGHT_GUIDE.md`: TestFlight submission guide
- `DEVELOPMENT_BUILD_GUIDE.md`: EAS development build guide

---

**Last Updated**: Based on commits through `3cbbea6` (birthday prompts, cron jobs, UI improvements)  
**App Version**: `1.1.0` (Build `5`)  
**Status**: Ready for TestFlight testing

