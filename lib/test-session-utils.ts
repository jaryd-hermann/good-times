// Test utilities for session management testing
// Only available in __DEV__ mode

import AsyncStorage from "@react-native-async-storage/async-storage"
import * as Linking from "expo-linking"
import { supabase } from "./supabase"
import { 
  clearSessionLifecycle, 
  getLastAppCloseTime,
  getLastAppActiveTime,
  isColdStart,
  wasInactiveTooLong 
} from "./session-lifecycle"
import { getCurrentSession } from "./auth"

export interface SessionState {
  hasSession: boolean
  sessionExpiresAt: string | null
  sessionExpiresIn: number | null
  lastCloseTime: string | null
  lastActiveTime: string | null
  isColdStart: boolean
  inactiveTooLong: boolean
  timeSinceClose: number | null
  timeSinceActive: number | null
}

export async function logSessionState(): Promise<SessionState> {
  const session = await getCurrentSession()
  const lastClose = await getLastAppCloseTime()
  const lastActive = await getLastAppActiveTime()
  const isCold = await isColdStart()
  const inactiveTooLong = await wasInactiveTooLong()
  
  const state: SessionState = {
    hasSession: !!session,
    sessionExpiresAt: session?.expires_at 
      ? new Date(session.expires_at * 1000).toISOString() 
      : null,
    sessionExpiresIn: session?.expires_at 
      ? Math.floor((session.expires_at * 1000 - Date.now()) / 1000 / 60) 
      : null,
    lastCloseTime: lastClose ? new Date(lastClose).toISOString() : null,
    lastActiveTime: lastActive ? new Date(lastActive).toISOString() : null,
    isColdStart: isCold,
    inactiveTooLong,
    timeSinceClose: lastClose 
      ? Math.floor((Date.now() - lastClose) / 1000 / 60) 
      : null,
    timeSinceActive: lastActive 
      ? Math.floor((Date.now() - lastActive) / 1000 / 60) 
      : null,
  }
  
  console.log('[TEST] Session State:', JSON.stringify(state, null, 2))
  return state
}

export async function forceSessionExpiry(): Promise<void> {
  console.log('[TEST] Forcing session expiry...')
  try {
    // Clear session from AsyncStorage
    // Supabase stores session in a specific key format
    const keys = await AsyncStorage.getAllKeys()
    const sessionKeys = keys.filter(k => 
      k.includes('supabase') || 
      k.includes('auth') ||
      k.startsWith('sb-') // Supabase session key format
    )
    
    if (sessionKeys.length > 0) {
      await AsyncStorage.multiRemove(sessionKeys)
      console.log('[TEST] ✅ Cleared session keys:', sessionKeys)
    } else {
      console.log('[TEST] ⚠️ No session keys found to clear')
    }
    
    console.log('[TEST] ✅ Session cleared. Restart app to test expired session flow.')
  } catch (error) {
    console.error('[TEST] ❌ Failed to clear session:', error)
    throw error
  }
}

export async function simulateLongInactivity(minutes: number = 35): Promise<void> {
  const startTime = Date.now()
  console.log(`[TEST] ========================================`)
  console.log(`[TEST] SIMULATING LONG INACTIVITY`)
  console.log(`[TEST] ========================================`)
  console.log(`[TEST] Minutes to simulate: ${minutes}`)
  console.log(`[TEST] Current time: ${new Date().toISOString()}`)
  
  try {
    // Get current state before simulation
    const beforeState = {
      lastClose: await AsyncStorage.getItem('last_app_close_time'),
      lastActive: await AsyncStorage.getItem('last_app_active_time'),
    }
    console.log(`[TEST] Before simulation:`)
    console.log(`[TEST]   - Last close time: ${beforeState.lastClose ? new Date(parseInt(beforeState.lastClose)).toISOString() : 'null'}`)
    console.log(`[TEST]   - Last active time: ${beforeState.lastActive ? new Date(parseInt(beforeState.lastActive)).toISOString() : 'null'}`)
    
    // Calculate the time in the past
    const timeAgo = Date.now() - (minutes * 60 * 1000)
    const simulatedTime = new Date(timeAgo)
    
    console.log(`[TEST] Setting simulated times:`)
    console.log(`[TEST]   - Simulated time: ${simulatedTime.toISOString()}`)
    console.log(`[TEST]   - Time difference: ${minutes} minutes (${minutes * 60} seconds)`)
    console.log(`[TEST]   - Milliseconds ago: ${minutes * 60 * 1000}`)
    
    // Set the simulated times
    await AsyncStorage.setItem('last_app_close_time', timeAgo.toString())
    await AsyncStorage.setItem('last_app_active_time', timeAgo.toString())
    
    // Verify the values were set correctly
    const afterClose = await AsyncStorage.getItem('last_app_close_time')
    const afterActive = await AsyncStorage.getItem('last_app_active_time')
    
    console.log(`[TEST] After simulation:`)
    console.log(`[TEST]   - Last close time: ${afterClose ? new Date(parseInt(afterClose)).toISOString() : 'null'}`)
    console.log(`[TEST]   - Last active time: ${afterActive ? new Date(parseInt(afterActive)).toISOString() : 'null'}`)
    
    // Verify the simulation worked
    if (afterClose === timeAgo.toString() && afterActive === timeAgo.toString()) {
      console.log(`[TEST] ✅ Values verified correctly`)
    } else {
      console.error(`[TEST] ⚠️ WARNING: Values may not have been set correctly!`)
      console.error(`[TEST]   Expected: ${timeAgo.toString()}`)
      console.error(`[TEST]   Got close: ${afterClose}`)
      console.error(`[TEST]   Got active: ${afterActive}`)
    }
    
    // Test the wasInactiveTooLong function to see if it detects the inactivity
    const inactiveTooLong = await wasInactiveTooLong()
    console.log(`[TEST] Testing wasInactiveTooLong(): ${inactiveTooLong ? '✅ YES (inactive too long)' : '❌ NO (not inactive)'}`)
    
    // Calculate what the function should return (threshold is typically 30 minutes)
    const thresholdMinutes = 30
    const shouldBeInactive = minutes >= thresholdMinutes
    if (inactiveTooLong === shouldBeInactive) {
      console.log(`[TEST] ✅ wasInactiveTooLong() returned expected value (${shouldBeInactive})`)
    } else {
      console.error(`[TEST] ⚠️ WARNING: wasInactiveTooLong() returned unexpected value!`)
      console.error(`[TEST]   Expected: ${shouldBeInactive} (minutes=${minutes} >= threshold=${thresholdMinutes})`)
      console.error(`[TEST]   Got: ${inactiveTooLong}`)
    }
    
    const elapsed = Date.now() - startTime
    console.log(`[TEST] ========================================`)
    console.log(`[TEST] ✅ Simulation complete in ${elapsed}ms`)
    console.log(`[TEST] ========================================`)
    console.log(`[TEST] Next steps:`)
    console.log(`[TEST]   1. Close the app completely`)
    console.log(`[TEST]   2. Reopen the app`)
    console.log(`[TEST]   3. Check console logs for boot flow behavior`)
    console.log(`[TEST]   4. Expected: Boot screen should show, then route to home.tsx`)
    console.log(`[TEST] ========================================`)
  } catch (error) {
    console.error('[TEST] ========================================')
    console.error('[TEST] ❌ FAILED TO SIMULATE INACTIVITY')
    console.error('[TEST] ========================================')
    console.error('[TEST] Error:', error)
    console.error('[TEST] Stack:', (error as Error).stack)
    console.error('[TEST] ========================================')
    throw error
  }
}

export async function clearAllSessionData(): Promise<void> {
  console.log('[TEST] Clearing all session lifecycle data...')
  try {
    await clearSessionLifecycle()
    await forceSessionExpiry()
    console.log('[TEST] ✅ All session data cleared. Restart app to test cold start.')
  } catch (error) {
    console.error('[TEST] ❌ Failed to clear session data:', error)
    throw error
  }
}

export async function testPasswordResetLink(verificationUrl: string, email?: string): Promise<{ success: boolean; email?: string; error?: string }> {
  console.log('[TEST] Testing password reset link:', verificationUrl)
  try {
    // Extract token from Supabase verification URL
    // Format: https://project.supabase.co/auth/v1/verify?token=...&type=recovery&redirect_to=goodtimes://
    const url = new URL(verificationUrl)
    const token = url.searchParams.get('token')
    const type = url.searchParams.get('type')
    const redirectTo = url.searchParams.get('redirect_to') || 'goodtimes://'
    
    if (!token || type !== 'recovery') {
      throw new Error('Invalid verification URL. Must contain token and type=recovery')
    }
    
    console.log('[TEST] Extracted from URL:', {
      tokenLength: token.length,
      type,
      redirectTo
    })
    
    // The verification URL needs to be processed by Supabase's server
    // When clicked, Supabase processes it and redirects to redirect_to with tokens
    // We can simulate this by calling the verify endpoint with the full URL
    // But actually, the best way is to use Linking to open it, which will trigger the redirect
    
    // For testing, let's construct what the redirect URL would look like
    // and try to extract tokens from it, or simulate the redirect flow
    
    // The verification URL needs to be processed by Supabase's server
    // When you click it, Supabase processes it and redirects to redirect_to with tokens
    // For testing, we can't easily simulate this without opening a browser
    // Instead, let's check if the token format looks valid and provide guidance
    
    console.log('[TEST] Token extracted successfully')
    console.log('[TEST] Note: To fully test, you need to click the link in email or open it in browser')
    console.log('[TEST] Supabase will process it and redirect to:', redirectTo)
    
    // For now, just validate the URL format
    // The actual test happens when the link is clicked and Supabase redirects
    return { 
      success: true, 
      email: email || 'Email will be available after Supabase processes the link',
      error: 'This tool validates the URL format. To fully test, click the link in email. Supabase will redirect to the app with tokens if valid, or with error if expired.'
    }
  } catch (error: any) {
    console.error('[TEST] ❌ Failed to test password reset link:', error)
    return { success: false, error: error.message || String(error) }
  }
}

// Make available globally for console access (if needed)
if (__DEV__) {
  (global as any).testSession = {
    logState: logSessionState,
    forceExpiry: forceSessionExpiry,
    simulateInactivity: simulateLongInactivity,
    clearAll: clearAllSessionData,
    testPasswordReset: testPasswordResetLink,
  }
}

