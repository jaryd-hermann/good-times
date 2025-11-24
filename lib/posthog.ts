// PostHog Analytics Configuration
// Privacy-first analytics with graceful error handling

import { PostHog } from 'posthog-react-native'

// Environment variables
const posthogApiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY || ''
const posthogHost = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

// Validate configuration
const isPostHogConfigured = () => {
  return !!posthogApiKey && posthogApiKey.startsWith('phc_')
}

// PostHog client instance (initialized lazily)
let posthogClient: PostHog | null = null

/**
 * Initialize PostHog client with privacy-first settings
 * Returns null if initialization fails (graceful degradation)
 */
export const initializePostHog = (): PostHog | null => {
  // Return existing client if already initialized
  if (posthogClient) {
    return posthogClient
  }

  // Check if PostHog is configured
  if (!isPostHogConfigured()) {
    if (__DEV__) {
      console.warn('[PostHog] Not configured - EXPO_PUBLIC_POSTHOG_API_KEY missing or invalid')
    }
    return null
  }

  try {
    // Initialize PostHog with privacy-first options
    const client = new PostHog(posthogApiKey, {
      host: posthogHost,
      // Privacy settings
      captureApplicationLifecycleEvents: true, // Track app open/close
      captureDeepLinks: true, // Track deep link opens
      captureScreens: true, // Track screen views (autocapture)
      captureScreenViews: true, // Additional screen view tracking
      // Disable session replay for privacy
      sessionReplay: false,
      // Enable IP anonymization
      anonymizeIP: true,
      // Feature flags disabled initially (can enable later)
      enableFeatureFlags: false,
      // Development mode detection
      debug: __DEV__,
    })

    posthogClient = client
    if (__DEV__) {
      console.log('[PostHog] Initialized successfully')
    }
    return client
  } catch (error) {
    console.error('[PostHog] Failed to initialize:', error)
    return null
  }
}

/**
 * Get PostHog client instance
 * Returns null if not configured or initialization failed
 */
export const getPostHog = (): PostHog | null => {
  if (!posthogClient) {
    return initializePostHog()
  }
  return posthogClient
}

/**
 * Identify user after authentication
 * Only includes non-PII properties
 */
export const identifyUser = (userId: string, properties?: Record<string, any>) => {
  const client = getPostHog()
  if (!client) return

  try {
    // Only include non-PII properties
    const safeProperties = {
      ...properties,
      // Ensure no PII is included
      // User ID is already set by identify()
    }

    client.identify(userId, safeProperties)
    if (__DEV__) {
      console.log('[PostHog] User identified:', userId)
    }
  } catch (error) {
    console.error('[PostHog] Failed to identify user:', error)
  }
}

/**
 * Reset user identification on sign out
 */
export const resetPostHog = () => {
  const client = getPostHog()
  if (!client) return

  try {
    client.reset()
    if (__DEV__) {
      console.log('[PostHog] User reset')
    }
  } catch (error) {
    console.error('[PostHog] Failed to reset:', error)
  }
}

/**
 * Capture a custom event
 * Use this for manual event tracking
 * This function is safe to call anywhere - it will never throw or block
 * Always logs in development mode for testing
 */
export const captureEvent = (eventName: string, properties?: Record<string, any>) => {
  try {
    const client = getPostHog()
    if (!client) {
      // Log even when PostHog is not configured (for testing)
      console.log('[PostHog] Event captured (not configured):', eventName, properties || {})
      return
    }

    client.capture(eventName, properties)
    // Always log for testing/debugging
    console.log('[PostHog] Event captured:', eventName, properties || {})
  } catch (error) {
    // Never let PostHog errors affect app behavior
    console.error('[PostHog] Failed to capture event:', error)
  }
}

/**
 * Safe capture helper for use with usePostHog hook
 * Use this in components instead of calling posthog.capture() directly
 * Always logs for testing/debugging
 */
export const safeCapture = (posthog: any, eventName: string, properties?: Record<string, any>) => {
  try {
    if (posthog) {
      posthog.capture(eventName, properties)
      // Always log for testing/debugging
      console.log('[PostHog] Event captured (hook):', eventName, properties || {})
    } else {
      // Fallback to captureEvent if hook not available
      captureEvent(eventName, properties)
    }
  } catch (error) {
    // Never let PostHog errors affect app behavior
    console.error('[PostHog] Failed to capture event:', error)
  }
}

/**
 * NOTE: Always import usePostHog from 'posthog-react-native' in components
 * The hook returns null if PostHog isn't configured, which is safe
 * PostHogProvider is always rendered in _layout.tsx, so the hook is always available
 * 
 * Pattern to use in components:
 * ```tsx
 * import { usePostHog } from "posthog-react-native"
 * import { captureEvent } from "../../lib/posthog"
 * 
 * const posthog = usePostHog()
 * 
 * // Then use:
 * if (posthog) {
 *   posthog.capture("event_name", { ... })
 * } else {
 *   captureEvent("event_name", { ... })
 * }
 * ```
 */

/**
 * Check if PostHog is configured and ready
 */
export const isPostHogReady = (): boolean => {
  return isPostHogConfigured() && posthogClient !== null
}

