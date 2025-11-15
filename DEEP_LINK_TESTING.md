# Testing Deep Links in iOS Simulator

## Prerequisites
1. The app must be **running** in the simulator before testing deep links
2. The URL scheme `goodtimes://` is configured in `app.config.ts`

## Method 1: Using Expo's Built-in Linking (Recommended)

1. **Start the app in the simulator:**
   ```bash
   npx expo start --ios
   ```
   Wait for the app to fully load in the simulator.

2. **In a new terminal, use Expo's linking command:**
   ```bash
   npx expo start --ios --open-url "goodtimes://join/9b0f1b50-ccd6-42da-a306-11a366a58bc6"
   ```

   OR use the simpler approach:
   ```bash
   npx uri-scheme open "goodtimes://join/9b0f1b50-ccd6-42da-a306-11a366a58bc6" --ios
   ```

## Method 2: Using xcrun simctl (Requires App Running)

1. **First, make sure the app is running in the simulator:**
   ```bash
   npx expo start --ios
   ```

2. **Wait for the app to fully load**, then in another terminal:
   ```bash
   xcrun simctl openurl booted "goodtimes://join/9b0f1b50-ccd6-42da-a306-11a366a58bc6"
   ```

## Method 3: Using Safari in Simulator (Easiest)

1. **Open Safari in the iOS Simulator**
2. **Type the URL in the address bar:**
   ```
   goodtimes://join/9b0f1b50-ccd6-42da-a306-11a366a58bc6
   ```
3. **Press Enter** - Safari will prompt to open in the app

## Method 4: Testing from Code (For Development)

You can also test deep linking programmatically by adding this to your app temporarily:

```typescript
import * as Linking from 'expo-linking';

// In a component or test function:
Linking.openURL('goodtimes://join/9b0f1b50-ccd6-42da-a306-11a366a58bc6');
```

## Troubleshooting

### Error -10814 (URL scheme not registered)
- **Solution**: Make sure the app is running first, then try the deep link
- If it still doesn't work, you may need to rebuild:
  ```bash
  npx expo run:ios
  ```

### Deep link not working
1. Verify the scheme in `app.config.ts` matches: `scheme: "goodtimes"`
2. Make sure the app is fully loaded in the simulator
3. Try restarting the Expo dev server: `npx expo start --clear --ios`
4. Check that the route `/join/[groupId]` exists in your app structure

### Testing the flow
1. **Unauthenticated user**: Should redirect to onboarding, then after sign-up/login, join the group
2. **Authenticated user**: Should join the group immediately and redirect to home
3. **Already a member**: Should just redirect to home with that group focused

## Expected Behavior

When the deep link is triggered:
- If user is **not logged in**: Stores groupId in AsyncStorage, redirects to onboarding
- If user is **logged in**: Checks if already a member, if not adds them, then redirects to home with `focusGroupId` param
- The home screen should switch to the new group context

