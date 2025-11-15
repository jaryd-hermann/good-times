# FaceID Implementation Plan

## Overview
Add FaceID/TouchID authentication to allow users to quickly log in without entering their password.

## Required Packages

1. **expo-local-authentication**
   - Provides biometric authentication (FaceID, TouchID, fingerprint)
   - Works on both iOS and Android
   - Install: `npm install expo-local-authentication`

## Implementation Steps

### 1. Install Package
```bash
npm install expo-local-authentication
```

### 2. Add Permissions
Update `app.config.ts` to include FaceID usage description:
```typescript
ios: {
  infoPlist: {
    NSFaceIDUsageDescription: "Good Times uses FaceID to securely log you in quickly.",
    // ... existing permissions
  },
}
```

### 3. Create Authentication Service
Create `lib/biometric.ts`:
- `authenticateWithBiometric()` - prompts user for FaceID/TouchID
- `isBiometricAvailable()` - checks if device supports biometrics
- `isBiometricEnrolled()` - checks if user has biometrics set up
- `saveBiometricPreference()` - stores user's preference in AsyncStorage
- `getBiometricPreference()` - retrieves user's preference

### 4. Update Settings Screen
Add toggle in `app/(main)/settings.tsx`:
- Check if biometrics are available
- Show toggle only if available
- Store preference in AsyncStorage (key: `biometric_enabled`)
- When enabled, prompt user to authenticate once to enable

### 5. Update Auth Flow
Modify `app/(onboarding)/auth.tsx` and `app/index.tsx`:
- After successful password login, if biometrics enabled:
  - Store encrypted session token/refresh token in SecureStore
  - On next app launch, check if biometrics enabled
  - If enabled, prompt for FaceID
  - On success, retrieve stored credentials and auto-login

### 6. Use SecureStore for Credentials
- Use `expo-secure-store` (already available in Expo) to store:
  - Session refresh token (encrypted)
  - User ID
- Never store passwords

### 7. Handle Edge Cases
- User disables biometrics in device settings → show fallback to password
- Biometric fails → allow password fallback
- Multiple failed attempts → temporarily disable biometrics
- User changes password → invalidate stored biometric credentials

## Database Changes
No database changes needed - preference stored locally in AsyncStorage.

## Security Considerations
- Never store passwords, only session tokens
- Use SecureStore for sensitive data
- Biometric is convenience, not security - still validate session with Supabase
- Clear stored credentials on logout

## User Experience Flow

1. **Enable FaceID:**
   - User goes to Settings
   - Toggles "Enable FaceID" ON
   - Prompted to authenticate with FaceID once
   - Preference saved

2. **Login with FaceID:**
   - App launches
   - Checks if FaceID enabled
   - Prompts for FaceID
   - On success, auto-logs in using stored session
   - On failure/cancel, shows password login screen

3. **Disable FaceID:**
   - User toggles OFF in Settings
   - Clears stored credentials
   - Next login requires password

## Testing Checklist
- [ ] Test on device with FaceID
- [ ] Test on device with TouchID
- [ ] Test on device without biometrics (should hide toggle)
- [ ] Test enabling/disabling
- [ ] Test fallback to password when biometric fails
- [ ] Test clearing credentials on logout
- [ ] Test session expiration handling

