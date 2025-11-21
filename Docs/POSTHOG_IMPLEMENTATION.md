# PostHog Analytics Implementation

## Overview

PostHog analytics has been successfully integrated into the Good Times app with a privacy-first approach. The implementation includes automatic screen view tracking, user identification, and graceful degradation when PostHog is not configured.

## What Was Implemented

### 1. PostHog Configuration (`lib/posthog.ts`)
- Centralized PostHog initialization logic
- Privacy-first settings (IP anonymization, no session replay)
- Helper functions for identify, reset, and custom event capture
- Graceful error handling

### 2. Provider Integration (`app/_layout.tsx`)
- `PostHogProvider` wraps the entire app
- Privacy-first configuration:
  - Autocapture enabled (screen views, basic interactions)
  - Session replay disabled
  - IP anonymization enabled
  - Feature flags disabled initially
- Graceful degradation when PostHog is not configured

### 3. User Identification (`components/AuthProvider.tsx`)
- Users are automatically identified after successful authentication
- Non-PII properties tracked:
  - `has_groups`: Boolean indicating if user has groups
  - `group_count`: Number of groups user belongs to
  - `account_age_days`: Days since account creation
- User identification is reset on sign out

## Environment Variables

### Local Development (`.env` file)

Add these variables to your `.env` file:

```bash
EXPO_PUBLIC_POSTHOG_API_KEY=phc_TCi62A0oOaKJZIQoHXiZTuTvuITnGUYkHrvhVYUTfIy
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

**Note:** The API key is already provided. For EU cloud, use `https://eu.i.posthog.com` as the host.

### EAS Builds (Cloud)

Add PostHog secrets to EAS for cloud builds:

```bash
eas secret:create --scope project --name EXPO_PUBLIC_POSTHOG_API_KEY --value phc_TCi62A0oOaKJZIQoHXiZTuTvuITnGUYkHrvhVYUTfIy
eas secret:create --scope project --name EXPO_PUBLIC_POSTHOG_HOST --value https://us.i.posthog.com
```

## Privacy Settings

The implementation follows privacy-first principles:

- ✅ **Autocapture**: Enabled (screen views, basic interactions)
- ❌ **Session Replay**: Disabled (privacy)
- ✅ **IP Anonymization**: Enabled
- ✅ **User Identification**: Only non-PII data (user ID, group count, account age)
- ❌ **Feature Flags**: Disabled initially (can be enabled later)

## What Gets Tracked Automatically

1. **Screen Views**: Every screen navigation is automatically tracked
2. **App Lifecycle**: App open/close events
3. **Deep Links**: Deep link opens are tracked
4. **User Identification**: After authentication, user is identified with non-PII properties

## Testing

### 1. Local Testing

1. Add PostHog API key to `.env` file
2. Start the app: `npx expo start --dev-client`
3. Navigate through the app
4. Check PostHog dashboard → Live Events to see events coming in

### 2. Verify User Identification

1. Sign in to the app
2. Check PostHog dashboard → Persons
3. You should see a person with your user ID
4. Check properties - should see `has_groups`, `group_count`, `account_age_days`

### 3. Verify Sign Out Reset

1. Sign out of the app
2. Check PostHog dashboard - user identification should be reset

## Manual Event Tracking (Future)

To track custom events, use the `usePostHog` hook:

```typescript
import { usePostHog } from 'posthog-react-native'

function MyComponent() {
  const posthog = usePostHog()
  
  const handleCustomAction = () => {
    posthog?.capture('custom_event_name', {
      property1: 'value1',
      property2: 'value2',
    })
  }
  
  // ... rest of component
}
```

## Architecture Decisions

1. **Always Render PostHogProvider**: Ensures React hooks can be called safely
2. **Graceful Degradation**: App works normally if PostHog is not configured
3. **Privacy-First**: No PII tracked, IP anonymization enabled, session replay disabled
4. **Centralized Configuration**: All PostHog logic in `lib/posthog.ts` for easy maintenance

## Files Modified

1. `app/_layout.tsx` - Added PostHogProvider wrapper
2. `components/AuthProvider.tsx` - Added user identification and reset logic
3. `lib/posthog.ts` - Created PostHog configuration and helper functions
4. `README.md` - Updated with PostHog environment variables

## Next Steps

1. ✅ Add PostHog API key to `.env` file
2. ✅ Add PostHog secrets to EAS for cloud builds
3. ✅ Test locally and verify events in PostHog dashboard
4. ⏭️ (Future) Add manual event tracking for key user actions
5. ⏭️ (Future) Enable feature flags if needed

## Troubleshooting

### Events Not Appearing in PostHog

1. Check that `EXPO_PUBLIC_POSTHOG_API_KEY` is set correctly
2. Verify API key starts with `phc_`
3. Check PostHog dashboard → Project Settings → Project API Key matches
4. Check console logs for PostHog errors (in dev mode)

### User Not Identified

1. Verify user successfully authenticated
2. Check that `loadUser` function in AuthProvider completes successfully
3. Check console logs for PostHog identification errors

### PostHog Causing App Crashes

1. PostHogProvider is wrapped in ErrorBoundary - crashes should be caught
2. Check that PostHog package is installed: `npm list posthog-react-native`
3. Verify all required Expo modules are installed

## Support

- PostHog React Native Docs: https://posthog.com/docs/libraries/react-native
- PostHog Dashboard: https://app.posthog.com

