// app/index.tsx
// Phase 2: Simplified boot flow - only routes based on AuthProvider state
// Phase 5: In-app vs cold start logic
// Phase 6: Black screen prevention

import { useEffect, useState, useRef } from "react";
import { View, ActivityIndicator, Text, Pressable, Alert, ImageBackground, StyleSheet, AppState } from "react-native";
import { useRouter, useSegments, usePathname } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { typography, colors as themeColors } from "../lib/theme";
import { useAuth } from "../components/AuthProvider";
import {
  isColdStart,
  recordSessionStart,
  recordSuccessfulNavigation,
  recordAppActive,
  wasInactiveTooLong,
} from "../lib/session-lifecycle";

// Import supabase safely to prevent crashes
let supabase: any
try {
  const supabaseModule = require("../lib/supabase")
  supabase = supabaseModule.supabase
} catch (error) {
  console.error("[index] Failed to import supabase:", error)
  supabase = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  }
}

const colors = { black: "#000", accent: "#de2f08", white: "#fff" };
const PENDING_GROUP_KEY = "pending_group_join";

export default function Index() {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { user, loading: authLoading, restoringSession } = useAuth();
  const [booting, setBooting] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [loadingDots, setLoadingDots] = useState(".");
  // CRITICAL: Initialize boot screen state to true immediately to prevent black screen
  // This ensures the boot screen shows on first render, before useEffect runs
  const [shouldShowBootScreen, setShouldShowBootScreen] = useState(true);
  const [sessionRefreshing, setSessionRefreshing] = useState(false);
  const [forceBootRecheck, setForceBootRecheck] = useState<number>(0); // Trigger to force boot flow re-evaluation
  const [isPasswordResetLink, setIsPasswordResetLink] = useState(false); // Track if we're handling password reset
  const hasNavigatedRef = useRef(false);
  const bootStartTimeRef = useRef<number>(Date.now()); // Initialize immediately
  const userRef = useRef(user); // Keep ref to latest user for AppState listener

  // Keep userRef in sync with user
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  
  // CRITICAL: Check for password reset links on mount - if detected, skip boot screen
  useEffect(() => {
    async function checkForPasswordReset() {
      try {
        const url = await Linking.getInitialURL()
        // Check for both expired and valid reset links
        if (url && (url.includes("otp_expired") || url.includes("reset-password") || url.includes("type=recovery"))) {
          console.log("[boot] Password reset link detected, skipping boot screen")
          setIsPasswordResetLink(true)
          setBooting(false)
          setShouldShowBootScreen(false)
        }
      } catch (e) {
        // Ignore errors
      }
    }
    checkForPasswordReset()
    
    // Also listen for URL changes
    const subscription = Linking.addEventListener("url", (event) => {
      const url = event.url
      // Check for both expired and valid reset links
      if (url && (url.includes("otp_expired") || url.includes("reset-password") || url.includes("type=recovery"))) {
        console.log("[boot] Password reset link detected via listener, skipping boot screen")
        setIsPasswordResetLink(true)
        setBooting(false)
        setShouldShowBootScreen(false)
      }
    })
    
    return () => subscription.remove()
  }, [])

  // Check for boot recheck trigger from AuthProvider
  useEffect(() => {
    console.log("[boot] Boot recheck trigger useEffect: START - Setting up trigger checker");
    let checkInterval: ReturnType<typeof setInterval> | null = null;
    
    const checkTrigger = async () => {
      try {
        const trigger = await AsyncStorage.getItem("trigger_boot_recheck");
        if (trigger) {
          console.log("[boot] Boot recheck trigger detected from AuthProvider, forcing re-evaluation", {
            triggerValue: trigger,
            timestamp: new Date().toISOString(),
          });
          await AsyncStorage.removeItem("trigger_boot_recheck");
          // Force boot flow to re-run
          hasNavigatedRef.current = false;
          setForceBootRecheck(prev => {
            const newValue = prev + 1;
            console.log("[boot] Incrementing forceBootRecheck", { from: prev, to: newValue });
            return newValue;
          });
        }
      } catch (error) {
        console.error("[boot] Failed to check boot recheck trigger:", error);
      }
    };

    // Check immediately
    console.log("[boot] Boot recheck trigger: Checking immediately");
    checkTrigger();
    
    // Check periodically (every 2 seconds) while app is active
    // Reduced frequency to avoid log spam - only logs when trigger found
    checkInterval = setInterval(() => {
      checkTrigger(); // Don't log every check - only log when trigger is found
    }, 2000); // Reduced from 500ms to 2s

    return () => {
      console.log("[boot] Boot recheck trigger useEffect: CLEANUP");
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    };
  }, []);
  
  // Also check trigger when user/authLoading changes (component re-renders)
  useEffect(() => {
    const checkTrigger = async () => {
      try {
        const trigger = await AsyncStorage.getItem("trigger_boot_recheck");
        if (trigger) {
          console.log("[boot] Boot recheck trigger detected on user/authLoading change, forcing re-evaluation");
          await AsyncStorage.removeItem("trigger_boot_recheck");
          hasNavigatedRef.current = false;
          setForceBootRecheck(prev => prev + 1);
        }
      } catch (error) {
        console.error("[boot] Failed to check boot recheck trigger on change:", error);
      }
    };
    checkTrigger();
  }, [user, authLoading]);

  // CRITICAL: Always show boot screen on app open (from any source)
  // Record session start immediately
  // CRITICAL: Check for force_boot_refresh flag SYNCHRONOUSLY on mount to prevent black screen
  // This ensures boot screen shows immediately when navigating from ForegroundQueryRefresher
  useEffect(() => {
    // Check for force_boot_refresh flag immediately (synchronously via closure)
    // This prevents black screen when ForegroundQueryRefresher navigates to root
    AsyncStorage.getItem("force_boot_refresh").then((flag) => {
      if (flag) {
        console.log("[boot] force_boot_refresh flag detected on mount - showing boot screen immediately");
        setShouldShowBootScreen(true);
        setBooting(true);
      }
    }).catch(() => {});
    
    async function initializeBoot() {
      try {
        // Check if boot screen was forced (from BootRecheckHandler)
        const forceBootScreen = await AsyncStorage.getItem("force_boot_screen");
        if (forceBootScreen === "true") {
          console.log("[boot] Boot screen forced from BootRecheckHandler - showing boot screen");
          await AsyncStorage.removeItem("force_boot_screen");
          setShouldShowBootScreen(true);
          setBooting(true);
        }
        
        // Check if app was opened from a notification click
        const notificationClicked = await AsyncStorage.getItem("notification_clicked");
        if (notificationClicked === "true") {
          console.log("[boot] App opened from notification - forcing boot screen and session refresh");
          // Clear the flag
          await AsyncStorage.removeItem("notification_clicked");
          // Force boot screen to show and refresh session
          setShouldShowBootScreen(true);
          setSessionRefreshing(true);
          try {
            const { ensureValidSession } = await import("../lib/auth");
            await ensureValidSession();
            console.log("[boot] Session refreshed after notification click");
          } catch (error) {
            console.error("[boot] Failed to refresh session after notification:", error);
          } finally {
            setSessionRefreshing(false);
          }
        }
        
        // Always record session start - ensures we track app opens
        await recordSessionStart();
        // Record app active on boot
        await recordAppActive();
        console.log("[boot] Boot screen initialized - always showing boot screen");
        setShouldShowBootScreen(true);
      } catch (error) {
        console.error("[index] Failed to initialize boot:", error);
        // On error, still show boot screen to be safe
        setShouldShowBootScreen(true);
      }
    }
    
    initializeBoot();
    
    // SIMPLIFIED: When app comes to foreground, just record activity
    // ForegroundQueryRefresher handles long inactivity (treats like "R")
    // Don't try to be smart here - let the boot flow handle everything
    const subscription = AppState.addEventListener("change", async (nextAppState) => {
      if (nextAppState === "active") {
        // Just record that app is active - that's it
        await recordAppActive();
      } else if (nextAppState === "background" || nextAppState === "inactive") {
        // Record app going to background
        await recordAppActive(); // Update last active time before going inactive
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, []);

  // CRITICAL: Boot flow with forced session refresh
  // Always ensure session is valid before navigating
  useEffect(() => {
    console.log("[boot] Boot flow useEffect: START", {
      authLoading,
      hasUser: !!user,
      userId: user?.id,
      segmentsLength: segments.length,
      timestamp: new Date().toISOString(),
    });
    
    // CRITICAL: Prevent duplicate boot flow runs
    // Skip if:
    // 1. We've already navigated AND we're not on root (segments.length > 0) - we're on a different screen
    // 2. OR we've already navigated AND we're on root AND forceBootRecheck wasn't triggered - duplicate run
    // UNLESS: forceBootRecheck was explicitly triggered (which resets hasNavigatedRef)
    // Note: force_boot_refresh flag is checked inside the async function, not here
    // This prevents race conditions where navigation to root triggers multiple boot flow runs
    const isOnRoot = (segments.length as number) === 0;
    const wasRecheckTriggered = forceBootRecheck > 0;
    const shouldSkip = hasNavigatedRef.current && !wasRecheckTriggered && (
      (!isOnRoot) || // Already navigated and not on root
      (isOnRoot && authLoading === false && !user && !restoringSession) // On root but no user and auth done
    );
    
    if (shouldSkip) {
      console.log("[boot] Boot flow: Skipping duplicate run - already navigated", {
        hasNavigated: hasNavigatedRef.current,
        segmentsLength: segments.length,
        isOnRoot,
        forceBootRecheck,
        wasRecheckTriggered,
        authLoading,
        hasUser: !!user,
        restoringSession,
      });
      return;
    }
    
    let cancelled = false;

    (async () => {
      try {
        // CRITICAL: Always show boot screen immediately when boot flow starts
        // This prevents black screens during the boot process
        setShouldShowBootScreen(true);
        setBooting(true);
        bootStartTimeRef.current = Date.now(); // Reset boot start time
        
        // Wait for AuthProvider to finish loading
        if (authLoading) {
          console.log("[boot] Boot flow useEffect: Waiting for AuthProvider to load...");
          return;
        }
        
        // Check if this is a background open (not cold start) for optimization
        const isBackgroundOpen = !(await isColdStart());
        
        // CRITICAL: Wait for session restoration if in progress (max 5 seconds, or 2s for background opens)
        // This ensures we don't navigate to welcome while restoration is happening
        // Note: We check restoringSession from the hook (not closure) - if it changes, useEffect will re-run
        if (restoringSession) {
          const maxWaitTime = isBackgroundOpen ? 2000 : 5000; // Faster timeout for background opens
          console.log(`[boot] Boot flow: Session restoration in progress - waiting (max ${maxWaitTime}ms)...`);
          const restorationStartTime = Date.now();
          
          // Wait for restoration to complete (check every 100ms)
          // IMPORTANT: restoringSession is from useAuth() hook, so if it changes, this useEffect will re-run
          // The while loop is a best-effort wait, but the real check happens via useEffect dependency
          let waited = 0;
          while (waited < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, 100)); // Check every 100ms
            waited = Date.now() - restorationStartTime;
            if (cancelled) return;
            
            // Re-check restoringSession from hook (not closure) - if false, break early
            // This is a best-effort optimization - useEffect will re-run when restoringSession changes
            if (!restoringSession) {
              console.log("[boot] Boot flow: Session restoration completed after", waited, "ms");
              break;
            }
          }
          
          if (restoringSession) {
            console.warn("[boot] Boot flow: Session restoration timeout after", waited, "ms - proceeding anyway");
          }
        }
        
        console.log("[boot] Boot flow useEffect: AuthProvider loaded, proceeding with boot flow");

        console.log("[boot] Boot flow: AuthProvider loaded", {
          hasUser: !!user,
          userId: user?.id,
          authLoading,
          restoringSession,
          segmentsLength: segments.length,
          hasNavigated: hasNavigatedRef.current,
          timestamp: new Date().toISOString(),
        });

        // CRITICAL: Always invalidate React Query cache to force fresh data
        // This ensures data is fresh when app opens (like hitting "R" to refresh)
        // For background opens, make this non-blocking to speed up navigation
        console.log("[boot] Boot flow: Invalidating React Query cache to force fresh data...");
        if (isBackgroundOpen) {
          // Non-blocking for background opens - invalidate in background
          queryClient.invalidateQueries().catch((invalidateError) => {
            console.error("[boot] Boot flow: Failed to invalidate queries:", invalidateError);
          });
          console.log("[boot] Boot flow: React Query cache invalidation started (non-blocking for background open)");
        } else {
          // Blocking for cold starts to ensure fresh data
          try {
            await queryClient.invalidateQueries();
            console.log("[boot] Boot flow: React Query cache invalidated - fresh data will load");
          } catch (invalidateError) {
            console.error("[boot] Boot flow: Failed to invalidate queries:", invalidateError);
            // Don't block - continue with boot flow
          }
        }

        // CRITICAL: Check for user from AuthProvider OR directly from Supabase session
        // If user load timed out in AuthProvider, we can still get user ID from session
        let effectiveUser = user;
        if (!effectiveUser) {
          // User load may have timed out - check session directly (like ForegroundQueryRefresher does)
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
              console.log("[boot] Boot flow: User load timed out in AuthProvider, but found user in session", {
                userId: session.user.id,
              });
              // Create a minimal user object from session
              effectiveUser = { id: session.user.id } as any;
            }
          } catch (error) {
            console.warn("[boot] Boot flow: Failed to get session:", error);
          }
        }

        if (effectiveUser) {
          // CRITICAL: Trust session - if user exists (from AuthProvider or session), proceed immediately (like hitting "R")
          // Don't try to refresh - AuthProvider/session already validated it
          // Session refresh happens automatically via Supabase's onAuthStateChange
          // Just proceed immediately like a cold start
          console.log("[boot] Boot flow: User exists - trusting session, proceeding immediately (like cold start/R)", {
            userId: effectiveUser.id,
            fromAuthProvider: !!user,
            fromSession: !user,
          });
          // Don't try to refresh session - AuthProvider/session already validated it
          // Just invalidate queries (already done above) and navigate
        } else {
          console.log("[boot] Boot flow: No user found (neither AuthProvider nor session) - navigating to welcome");
        }

        // Check if Supabase is configured
        console.log("[boot] Checking Supabase configuration...");
        let isConfigured = false;
        try {
          const { isSupabaseConfigured } = await import("../lib/supabase");
          isConfigured = isSupabaseConfigured();
          console.log("[boot] Supabase configured:", isConfigured);
        } catch (error: any) {
          console.error("[boot] Failed to check Supabase config:", error);
          const errorMsg = `Failed to check Supabase: ${error?.message || String(error)}`;
          setErr(errorMsg);
          if (__DEV__) Alert.alert("Boot Error", errorMsg);
          setBooting(false);
          return;
        }

        if (!isConfigured) {
          const errorMsg = "Supabase is not configured. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY as EAS secrets.";
          console.error("[boot]", errorMsg);
          setErr(errorMsg);
          if (__DEV__) Alert.alert("Configuration Error", errorMsg);
          setBooting(false);
          return;
        }

        // Check for pending group join (from deep link before auth)
        const pendingGroupId = await AsyncStorage.getItem(PENDING_GROUP_KEY);

        // CRITICAL: Route based on effectiveUser (from AuthProvider OR session), not just AuthProvider user
        // This ensures we route correctly even if AuthProvider's user load timed out
        if (!effectiveUser) {
          console.log("[boot] No user (neither AuthProvider nor session) → onboarding/welcome-1");
          
          // CRITICAL: Check if we're handling a password reset error - if so, don't navigate
          // The deep link handler in _layout.tsx will handle navigation
          try {
            const initialURL = await Linking.getInitialURL()
            if (initialURL && (initialURL.includes("otp_expired") || initialURL.includes("reset-password"))) {
              console.log("[boot] Password reset link detected, skipping boot navigation (deep link handler will navigate)")
              setBooting(false)
              setShouldShowBootScreen(false)
              return // Don't navigate - let deep link handler do it
            }
          } catch (e) {
            // Ignore errors checking URL
          }
          
          // Keep pendingGroupId in storage for after auth
          if (!hasNavigatedRef.current) {
            hasNavigatedRef.current = true;
            router.replace("/(onboarding)/welcome-1");
            await recordSuccessfulNavigation("/(onboarding)/welcome-1");
          }
          return;
        }

        // User exists (from AuthProvider or session) - check profile and group membership
        // OPTIMIZATION: For background opens with user from AuthProvider, skip profile check (trust AuthProvider)
        // For cold starts or session-only users, still check profile to catch orphaned sessions
        const shouldSkipProfileCheck = isBackgroundOpen && !!user; // Skip if background open AND user from AuthProvider
        
        let userQueryTimedOut = false;
        let userData: any = null;
        
        if (!shouldSkipProfileCheck) {
          // Only check profile for cold starts or when user is from session (not AuthProvider)
          console.log("[boot] Boot flow: effectiveUser exists, proceeding with profile check", {
            userId: effectiveUser.id,
            fromAuthProvider: !!user,
            fromSession: !user,
            isBackgroundOpen,
          });
          
          console.log("[boot] Boot flow: Querying user profile...");
          const userQueryPromise = supabase
            .from("users")
            .select("name, birthday")
            .eq("id", effectiveUser.id)
            .maybeSingle();
          
          // Faster timeout for background opens (2s) vs cold starts (5s)
          const userQueryTimeoutMs = isBackgroundOpen ? 2000 : 5000;
          const userQueryTimeout = new Promise<{ data: null, error: { message: string, timeout: boolean } }>((resolve) => {
            setTimeout(() => {
              resolve({
                data: null,
                error: { message: `User query timeout after ${userQueryTimeoutMs / 1000} seconds`, timeout: true }
              });
            }, userQueryTimeoutMs);
          });
          
          const { data: userDataResult, error: userErr } = await Promise.race([userQueryPromise, userQueryTimeout]) as any;
          userData = userDataResult;
          
          if (userErr) {
            const isTimeout = userErr.timeout === true;
            console.log(`[boot] users query ${isTimeout ? 'timed out' : 'error'}:`, userErr.message);
            // If timeout, skip profile check and continue (don't block navigation)
            // CRITICAL: Don't check for orphaned session on timeout - trust AuthProvider
            if (isTimeout) {
              userQueryTimedOut = true;
              console.warn("[boot] User query timed out - skipping profile check and continuing (trusting AuthProvider)");
            }
          }

          // Check if user has complete profile (ONLY if query didn't timeout)
          // If timeout occurred, skip this check and proceed - AuthProvider already validated the user
          if (!userQueryTimedOut && (!userData?.name || !userData?.birthday)) {
            console.log("[boot] ⚠️ User exists but no profile - orphaned session");
            console.log("[boot] Clearing orphaned session and redirecting to welcome-1");
            
            try {
              await supabase.auth.signOut();
              console.log("[boot] ✅ Orphaned session cleared");
            } catch (signOutError) {
              console.warn("[boot] Failed to clear orphaned session:", signOutError);
            }
            
            if (!hasNavigatedRef.current) {
              hasNavigatedRef.current = true;
              router.replace("/(onboarding)/welcome-1");
              await recordSuccessfulNavigation("/(onboarding)/welcome-1");
            }
            return;
          }
        } else {
          console.log("[boot] Boot flow: Background open with user from AuthProvider - skipping profile check (trusting AuthProvider)");
        }

        // Check group membership
        // Add timeout to prevent hanging if session refresh is slow
        // Faster timeout for background opens
        console.log("[boot] checking group membership...");
        const membershipQueryPromise = supabase
          .from("group_members")
          .select("group_id")
          .eq("user_id", effectiveUser.id)
          .limit(1)
          .maybeSingle();
        
        // Faster timeout for background opens (2s) vs cold starts (5s)
        const membershipQueryTimeoutMs = isBackgroundOpen ? 2000 : 5000;
        const membershipQueryTimeout = new Promise<{ data: null, error: { message: string, timeout: boolean } }>((resolve) => {
          setTimeout(() => {
            resolve({
              data: null,
              error: { message: `Membership query timeout after ${membershipQueryTimeoutMs / 1000} seconds`, timeout: true }
            });
          }, membershipQueryTimeoutMs);
        });
        
        const { data: membership, error: memErr } = await Promise.race([membershipQueryPromise, membershipQueryTimeout]) as any;

        if (memErr) {
          const isTimeout = memErr.timeout === true;
          console.log(`[boot] membership query ${isTimeout ? 'timed out' : 'error'}:`, memErr.message);
          
          // CRITICAL: On timeout, trust the session - if user has session, they likely have a group
          // Navigate to home instead of create-group to avoid wrong routing
          // This matches cold start behavior where we trust the session
          if (isTimeout) {
            console.warn("[boot] Membership query timed out - trusting session, navigating to home (user has session, likely has group)");
            if (!hasNavigatedRef.current) {
              hasNavigatedRef.current = true;
              router.replace("/(main)/home");
              await recordSuccessfulNavigation("/(main)/home");
              await recordAppActive();
            }
            return;
          }
          
          // Non-timeout error - assume no membership
          console.log("[boot] → onboarding/create-group/name-type");
          if (!hasNavigatedRef.current) {
            hasNavigatedRef.current = true;
            router.replace("/(onboarding)/create-group/name-type");
            await recordSuccessfulNavigation("/(onboarding)/create-group/name-type");
          }
          return;
        }
        
        console.log("[boot] membership query result:", { membership, error: memErr?.message });

        // Handle pending group join
        if (pendingGroupId) {
          await AsyncStorage.removeItem(PENDING_GROUP_KEY);
          if (!hasNavigatedRef.current) {
            hasNavigatedRef.current = true;
            router.replace({
              pathname: `/join/${pendingGroupId}`,
            });
            await recordSuccessfulNavigation(`/join/${pendingGroupId}`);
          }
          return;
        }

        // Handle pending notification (from notification click)
        const pendingNotificationStr = await AsyncStorage.getItem("pending_notification");
        if (pendingNotificationStr) {
          try {
            const pendingNotification = JSON.parse(pendingNotificationStr);
            const { type, group_id, entry_id, prompt_id, timestamp } = pendingNotification;
            
            // Check if we had long inactivity - if so, extend notification validity
            // This ensures notifications work even after hours of inactivity
            const { wasInactiveTooLong } = await import("../lib/session-lifecycle");
            const inactiveTooLong = await wasInactiveTooLong();
            
            // If inactive too long, accept notification regardless of age (user just tapped it)
            // Otherwise, only process if notification is recent (within last 5 minutes)
            const notificationAge = Date.now() - (timestamp || 0);
            const maxAge = inactiveTooLong ? Infinity : (5 * 60 * 1000); // 5 minutes or unlimited if long inactivity
            
            if (notificationAge < maxAge || inactiveTooLong) {
              console.log("[boot] Processing pending notification:", type, {
                notificationAge,
                inactiveTooLong,
                maxAge: inactiveTooLong ? "unlimited (long inactivity)" : maxAge,
              });
              await AsyncStorage.removeItem("pending_notification");
              
              // CRITICAL: Session refresh is already handled by boot flow above
              // If we had long inactivity, ForegroundQueryRefresher already cleared cache
              // and navigated to root. We just need to navigate to the notification destination.
              // No need to refresh session again - boot flow already did it.
              console.log("[boot] Session already refreshed by boot flow, navigating to notification destination");
              
              // Navigate based on notification type
              if (type === "daily_prompt" && group_id && prompt_id) {
                if (!hasNavigatedRef.current) {
                  hasNavigatedRef.current = true;
                  router.replace({
                    pathname: "/(main)/modals/entry-composer",
                    params: {
                      promptId: prompt_id,
                      date: new Date().toISOString().split("T")[0],
                      returnTo: "/(main)/home",
                    },
                  });
                  await recordSuccessfulNavigation("/(main)/modals/entry-composer");
                }
                return;
              } else if (type === "new_entry" && group_id && entry_id) {
                if (!hasNavigatedRef.current) {
                  hasNavigatedRef.current = true;
                  router.replace({
                    pathname: "/(main)/modals/entry-detail",
                    params: {
                      entryId: entry_id,
                      returnTo: "/(main)/home",
                    },
                  });
                  await recordSuccessfulNavigation("/(main)/modals/entry-detail");
                }
                return;
              } else if (type === "new_comment" && entry_id) {
                if (!hasNavigatedRef.current) {
                  hasNavigatedRef.current = true;
                  router.replace({
                    pathname: "/(main)/modals/entry-detail",
                    params: {
                      entryId: entry_id,
                      returnTo: "/(main)/home",
                    },
                  });
                  await recordSuccessfulNavigation("/(main)/modals/entry-detail");
                }
                return;
              } else if ((type === "member_joined" || type === "inactivity_reminder") && group_id) {
                if (!hasNavigatedRef.current) {
                  hasNavigatedRef.current = true;
                  router.replace({
                    pathname: "/(main)/home",
                    params: { focusGroupId: group_id },
                  });
                  await recordSuccessfulNavigation("/(main)/home");
                }
                return;
              }
            } else {
              // Notification is stale - remove it
              console.log("[boot] Pending notification is stale, removing");
              await AsyncStorage.removeItem("pending_notification");
            }
          } catch (notificationError) {
            console.error("[boot] Error processing pending notification:", notificationError);
            // Remove invalid notification data
            await AsyncStorage.removeItem("pending_notification");
          }
        }

        // Route to appropriate screen based on group membership
        console.log("[boot] Boot flow: Routing decision", {
          hasMembership: !!membership,
          groupId: membership?.group_id,
          segmentsLength: segments.length,
          hasNavigated: hasNavigatedRef.current,
        });
        
        // CRITICAL: Set a timeout to ensure we don't get stuck in boot screen
        // Faster timeout for background opens (3s) vs cold starts (5s)
        // Background opens should be faster since we trust the session more
        const navigationTimeoutMs = isBackgroundOpen ? 3000 : 5000;
        const navigationTimeout = setTimeout(() => {
          if (hasNavigatedRef.current) {
            clearTimeout(navigationTimeout);
            return;
          }
          console.warn("[boot] Boot flow: Navigation timeout - forcing navigation to home (trusting session)", {
            hasMembership: !!membership,
            groupId: membership?.group_id,
            effectiveUserId: effectiveUser?.id,
            isBackgroundOpen,
          });
          // CRITICAL: Always navigate to home on timeout if we have effectiveUser
          // Trust the session - user has session, likely has group
          // This matches cold start behavior
          if (effectiveUser) {
            hasNavigatedRef.current = true;
            router.replace("/(main)/home");
            recordSuccessfulNavigation("/(main)/home").catch(() => {});
            recordAppActive().catch(() => {});
          }
        }, navigationTimeoutMs);
        
        if (membership?.group_id) {
          console.log("[boot] Boot flow: user with group → (main)/home");
          // CRITICAL: Always navigate if we haven't navigated yet OR if segments are empty (black screen prevention)
          const segmentsLength = (segments as string[]).length;
          const needsNavigation = !hasNavigatedRef.current || segmentsLength === 0;
          console.log("[boot] Boot flow: Navigation check", {
            needsNavigation,
            hasNavigated: hasNavigatedRef.current,
            segmentsLength,
          });
          if (needsNavigation) {
            hasNavigatedRef.current = true;
            clearTimeout(navigationTimeout);
            console.log("[boot] Boot flow: Navigating to /(main)/home");
            router.replace("/(main)/home");
            await recordSuccessfulNavigation("/(main)/home");
            // Record app active after successful navigation
            await recordAppActive();
            console.log("[boot] Boot flow: Navigation completed to /(main)/home");
          } else {
            console.log("[boot] Boot flow: Navigation skipped (already navigated or segments exist)");
          }
        } else {
          console.log("[boot] Boot flow: no group → onboarding/create-group/name-type");
          // CRITICAL: Always navigate if we haven't navigated yet OR if segments are empty (black screen prevention)
          const segmentsLength = (segments as string[]).length;
          const needsNavigation = !hasNavigatedRef.current || segmentsLength === 0;
          console.log("[boot] Boot flow: Navigation check", {
            needsNavigation,
            hasNavigated: hasNavigatedRef.current,
            segmentsLength,
          });
          if (needsNavigation) {
            hasNavigatedRef.current = true;
            clearTimeout(navigationTimeout);
            console.log("[boot] Boot flow: Navigating to /(onboarding)/create-group/name-type");
            router.replace("/(onboarding)/create-group/name-type");
            await recordSuccessfulNavigation("/(onboarding)/create-group/name-type");
            // Record app active after successful navigation
            await recordAppActive();
            console.log("[boot] Boot flow: Navigation completed to /(onboarding)/create-group/name-type");
          } else {
            console.log("[boot] Boot flow: Navigation skipped (already navigated or segments exist)");
          }
        }
      } catch (e: any) {
        const msg = e?.message || String(e);
        const stack = e?.stack || '';
        console.error("[boot] FATAL ERROR:", msg, stack);
        setErr(`Boot failed: ${msg}`);
        Alert.alert(
          "App Failed to Start",
          `Error: ${msg}\n\nPlease check your configuration and try again.`,
          [{ text: "OK" }]
        );
      } finally {
        if (!cancelled) {
          // Ensure minimum boot screen display time (1 second) for smooth UX
          const bootElapsed = Date.now() - bootStartTimeRef.current;
          const remainingTime = Math.max(0, 1000 - bootElapsed);
          
          if (remainingTime > 0) {
            setTimeout(() => {
              if (!cancelled) {
                setBooting(false);
                setShouldShowBootScreen(false);
              }
            }, remainingTime);
          } else {
            setBooting(false);
            setShouldShowBootScreen(false);
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, restoringSession, router, forceBootRecheck]); // Add restoringSession to dependencies

  // CRITICAL: Always show boot screen during boot process to prevent black screens
  // Show boot screen if:
  // 1. Still booting
  // 2. AuthProvider is loading
  // 3. Session is restoring
  // 4. Session is refreshing
  // 5. No route matched (prevents black screen)
  // 6. Explicitly set to show boot screen
  // 7. We haven't navigated yet (hasNavigatedRef is false)
  // Default behavior: Show boot screen unless we've explicitly navigated away from root
  // BUT: Don't show if we're handling a password reset link (let deep link handler navigate)
  const segmentsLength = (segments as string[]).length;
  const hasNoRoute = segmentsLength === 0;
  // Only consider navigation complete if we've navigated AND we're not on root anymore
  const hasNavigated = hasNavigatedRef.current && (pathname && pathname !== "/" && pathname !== "");
  // Always show boot screen by default when on root route - only hide if we've explicitly navigated away
  // This prevents black screens when opening from background (component shows boot screen immediately)
  const isOnRootRoute = !pathname || pathname === "/" || pathname === "";
  const shouldShowBooting = !isPasswordResetLink && !hasNavigated && (isOnRootRoute || booting || authLoading || restoringSession || sessionRefreshing || (!err && hasNoRoute) || shouldShowBootScreen);
  
  // Ensure minimum boot screen display time (1 second) for smooth UX
  const minBootTime = 1000;
  const bootElapsed = Date.now() - bootStartTimeRef.current;
  const shouldForceShowBoot = bootElapsed < minBootTime;

  // Animate loading dots
  useEffect(() => {
    if (!shouldShowBooting) return;

    const interval = setInterval(() => {
      setLoadingDots((prev) => {
        if (prev === ".") return "..";
        if (prev === "..") return "...";
        return ".";
      });
    }, 500);

    return () => clearInterval(interval);
  }, [shouldShowBooting]);

  // CRITICAL: If we're handling a password reset link, don't render boot screen - let navigation happen
  // Also, if we're not on the root route anymore, don't render (navigation has happened)
  if (isPasswordResetLink || (pathname && pathname !== "/" && pathname !== "")) {
    return null; // Don't render anything - navigation has happened or will happen
  }
  
  // CRITICAL: Always show boot screen during boot to prevent black screens
  // Show boot screen immediately if we're on root route and haven't navigated yet
  // This prevents black screens when opening from background
  const shouldRenderBootScreen = shouldShowBooting || shouldForceShowBoot || (isOnRootRoute && !hasNavigated && !isPasswordResetLink);
  
  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      {shouldRenderBootScreen ? (
        <ImageBackground
          source={require("../assets/images/welcome-home.png")}
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
          resizeMode="cover"
        >
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingText}>Loading Good Times{loadingDots}</Text>
          </View>
        </ImageBackground>
      ) : (
        <>
          <Text style={{ color: colors.white, textAlign: "center", paddingHorizontal: 24 }}>
            {err ? `Boot error: ${err}` : "No route matched. Use the button below to open onboarding."}
          </Text>
          <Pressable 
            style={{ paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.white, borderRadius: 8 }}
            onPress={() => router.replace("/(onboarding)/welcome-1")}
          >
            <Text style={{ color: colors.white }}>Go to Onboarding</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    // No background - text directly over image
  },
  loadingText: {
    ...typography.body,
    fontSize: 18,
    color: themeColors.white,
    textAlign: "center",
  },
});
