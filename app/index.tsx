// app/index.tsx
// Phase 2: Simplified boot flow - only routes based on AuthProvider state
// Phase 5: In-app vs cold start logic
// Phase 6: Black screen prevention

import { useEffect, useState, useRef } from "react";
import { View, ActivityIndicator, Text, Pressable, Alert, ImageBackground, StyleSheet, AppState } from "react-native";
import { useRouter, useSegments } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const [booting, setBooting] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [loadingDots, setLoadingDots] = useState(".");
  const [shouldShowBootScreen, setShouldShowBootScreen] = useState(true);
  const [sessionRefreshing, setSessionRefreshing] = useState(false);
  const [forceBootRecheck, setForceBootRecheck] = useState(0); // Trigger to force boot flow re-evaluation
  const hasNavigatedRef = useRef(false);
  const bootStartTimeRef = useRef<number>(Date.now()); // Initialize immediately
  const userRef = useRef(user); // Keep ref to latest user for AppState listener

  // Keep userRef in sync with user
  useEffect(() => {
    userRef.current = user;
  }, [user]);

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
  useEffect(() => {
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
    
    // When app comes to foreground, always refresh session and show boot screen if needed
    console.log("[boot] AppState listener: Setting up AppState listener", {
      hasUser: !!user,
      userId: user?.id,
      timestamp: new Date().toISOString(),
    });
    const subscription = AppState.addEventListener("change", async (nextAppState) => {
      const currentUser = userRef.current; // Use ref to get latest user
      console.log("[boot] AppState listener: AppState changed", {
        nextAppState,
        currentUser: !!currentUser,
        userId: currentUser?.id,
        timestamp: new Date().toISOString(),
      });
      if (nextAppState === "active") {
        // Record that app is now active
        await recordAppActive();
        
        // CRITICAL: Reset navigation ref when app comes back to foreground
        // This ensures navigation can happen again if needed (prevents black screen)
        hasNavigatedRef.current = false;
        
        // Check if app was inactive for too long (treat as cold start)
        const inactiveTooLong = await wasInactiveTooLong();
        
        // Check if app was opened from a notification click
        const notificationClicked = await AsyncStorage.getItem("notification_clicked");
        const hasPendingNotification = await AsyncStorage.getItem("pending_notification");
        
        // CRITICAL: Check if we should skip session refresh (Supabase already refreshed)
        const { shouldSkipSessionCheck } = await import("../lib/auth");
        const skipCheck = shouldSkipSessionCheck();
        
        if (skipCheck) {
          console.log("[boot] AppState: Recent token refresh detected - skipping foreground refresh, letting boot flow handle navigation");
          // Don't block - let boot flow handle navigation immediately
        } else if (notificationClicked === "true" || hasPendingNotification || inactiveTooLong) {
          const reason = notificationClicked === "true" || hasPendingNotification 
            ? "notification" 
            : "long inactivity";
          console.log(`[boot] App came to foreground from ${reason} - forcing boot screen and session refresh`);
          
          // Clear the flag
          if (notificationClicked === "true") {
            await AsyncStorage.removeItem("notification_clicked");
          }
          
          // CRITICAL: Force boot screen to show BEFORE session refresh
          // This prevents black screen if session refresh fails or takes time
          setShouldShowBootScreen(true);
          setBooting(true);
          setSessionRefreshing(true);
          
          // CRITICAL: Don't block navigation - run refresh in background
          const refreshPromise = (async () => {
            try {
              const { ensureValidSession } = await import("../lib/auth");
              const sessionValid = await ensureValidSession();
              if (!sessionValid) {
                console.warn("[boot] Session invalid after refresh - may need to sign in");
              } else {
                console.log("[boot] Session refreshed successfully");
              }
            } catch (error) {
              console.error("[boot] Failed to refresh session:", error);
            } finally {
              setSessionRefreshing(false);
            }
          })();
          
          // Don't await - let boot flow handle navigation immediately
        } else {
          console.log("[boot] App came to foreground - refreshing session (background)");
          // Short inactivity - refresh session in background, don't block
          setSessionRefreshing(true);
          const refreshPromise = (async () => {
            try {
              const { ensureValidSession } = await import("../lib/auth");
              const sessionValid = await ensureValidSession();
              console.log("[boot] Session refreshed on foreground (background)", { sessionValid });
              
              // CRITICAL: If session refresh fails but user exists, we need to handle navigation
              // Don't auto-logout - keep user logged in, but ensure navigation happens
              if (!sessionValid && currentUser) {
                console.warn("[boot] Session refresh failed but user exists - triggering boot flow re-evaluation", {
                  userId: currentUser.id,
                });
                // Reset hasNavigatedRef to allow boot flow to re-evaluate navigation
                hasNavigatedRef.current = false;
                // Force boot flow to re-run by incrementing trigger
                setForceBootRecheck(prev => prev + 1);
              }
            } catch (error) {
              console.error("[boot] Failed to refresh session on foreground:", error);
              // If refresh fails, show boot screen as fallback
              setShouldShowBootScreen(true);
              setBooting(true);
              // Reset hasNavigatedRef to allow boot flow to re-evaluate navigation
              if (currentUser) {
                console.warn("[boot] Session refresh error but user exists - triggering boot flow re-evaluation", {
                  userId: currentUser.id,
                });
                hasNavigatedRef.current = false;
                // Force boot flow to re-run by incrementing trigger
                setForceBootRecheck(prev => prev + 1);
              }
            } finally {
              setSessionRefreshing(false);
            }
          })();
          
          // Don't await - let boot flow handle navigation immediately
        }
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
    
    let cancelled = false;

    (async () => {
      try {
        // Wait for AuthProvider to finish loading
        if (authLoading) {
          console.log("[boot] Boot flow useEffect: Waiting for AuthProvider to load...");
          return;
        }
        
        console.log("[boot] Boot flow useEffect: AuthProvider loaded, proceeding with boot flow");

        // CRITICAL: Ensure boot screen is visible during boot process
        // This prevents black screens if navigation hasn't happened yet
        if (!shouldShowBootScreen && !booting) {
          setShouldShowBootScreen(true);
          setBooting(true);
        }

        console.log("[boot] Boot flow: AuthProvider loaded", {
          hasUser: !!user,
          userId: user?.id,
          authLoading,
          segmentsLength: segments.length,
          hasNavigated: hasNavigatedRef.current,
          timestamp: new Date().toISOString(),
        });

        // CRITICAL: Always invalidate React Query cache to force fresh data
        // This ensures data is fresh when app opens (like hitting "R" to refresh)
        console.log("[boot] Boot flow: Invalidating React Query cache to force fresh data...");
        try {
          await queryClient.invalidateQueries();
          console.log("[boot] Boot flow: React Query cache invalidated - fresh data will load");
        } catch (invalidateError) {
          console.error("[boot] Boot flow: Failed to invalidate queries:", invalidateError);
          // Don't block - continue with boot flow
        }

        // CRITICAL: Check if we should skip session refresh (Supabase already refreshed)
        // If TOKEN_REFRESHED fired recently, trust it and skip blocking refresh
        // But still show boot screen and invalidate queries (already done above)
        if (user) {
          const { shouldSkipSessionCheck } = await import("../lib/auth");
          const skipCheck = shouldSkipSessionCheck();
          
          if (skipCheck) {
            console.log("[boot] Boot flow: Recent token refresh detected - skipping session check, but boot screen will show briefly", {
              userId: user.id,
            });
            // CRITICAL: Ensure boot screen is visible even when skipping session check
            // This provides consistent UX and ensures fresh data loads
            setShouldShowBootScreen(true);
            setBooting(true);
            // Don't wait for session refresh - but boot screen will still show
            // Queries are already invalidated above, so fresh data will load
          } else {
            console.log("[boot] Boot flow: User exists - refreshing session to ensure validity...", {
              userId: user.id,
            });
            setSessionRefreshing(true);
            const sessionRefreshStartTime = Date.now();
            
            // CRITICAL: Don't block navigation - run refresh in background
            // Start refresh but don't await it - navigate immediately
            const refreshPromise = (async () => {
              try {
                const { ensureValidSession } = await import("../lib/auth");
                const sessionValid = await ensureValidSession();
                const sessionRefreshElapsed = Date.now() - sessionRefreshStartTime;
                console.log("[boot] Boot flow: Session refresh completed (background)", {
                  sessionValid,
                  elapsedMs: sessionRefreshElapsed,
                });
                if (!sessionValid) {
                  console.warn("[boot] Boot flow: Session refresh failed - session invalid", {
                    userId: user.id,
                    elapsedMs: sessionRefreshElapsed,
                  });
                }
              } catch (error: any) {
                const sessionRefreshElapsed = Date.now() - sessionRefreshStartTime;
                console.error("[boot] Boot flow: Session refresh error (background)", {
                  error: error?.message,
                  errorType: error?.constructor?.name,
                  elapsedMs: sessionRefreshElapsed,
                });
              } finally {
                setSessionRefreshing(false);
              }
            })();
            
            // Don't await - let it run in background while we navigate
            // Navigation will proceed immediately
          }
        } else {
          console.log("[boot] Boot flow: No user - skipping session refresh");
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

        // Phase 2: Route based on AuthProvider state only
        if (!user) {
          console.log("[boot] No user → onboarding/welcome-1");
          // Keep pendingGroupId in storage for after auth
          if (!hasNavigatedRef.current) {
            hasNavigatedRef.current = true;
            router.replace("/(onboarding)/welcome-1");
            await recordSuccessfulNavigation("/(onboarding)/welcome-1");
          }
          return;
        }

        // User exists - check profile and group membership
        const { data: userData, error: userErr } = await supabase
          .from("users")
          .select("name, birthday")
          .eq("id", user.id)
          .maybeSingle();

        if (userErr) {
          console.log("[boot] users query error:", userErr.message);
        }

        // Check if user has complete profile
        if (!userData?.name || !userData?.birthday) {
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

        // Check group membership
        console.log("[boot] checking group membership...");
        const { data: membership, error: memErr } = await supabase
          .from("group_members")
          .select("group_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        console.log("[boot] membership query result:", { membership, error: memErr?.message });

        if (memErr) {
          console.log("[boot] group_members error:", memErr.message);
          console.log("[boot] → onboarding/create-group/name-type");
          
          if (!hasNavigatedRef.current) {
            hasNavigatedRef.current = true;
            router.replace("/(onboarding)/create-group/name-type");
            await recordSuccessfulNavigation("/(onboarding)/create-group/name-type");
          }
          return;
        }

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
            
            // Only process if notification is recent (within last 5 minutes)
            // This prevents stale notifications from being processed
            const notificationAge = Date.now() - (timestamp || 0);
            const maxAge = 5 * 60 * 1000; // 5 minutes
            
            if (notificationAge < maxAge) {
              console.log("[boot] Processing pending notification:", type);
              await AsyncStorage.removeItem("pending_notification");
              
              // CRITICAL: Force session refresh before navigating from notification
              // This ensures we never navigate with a stale session
              console.log("[boot] Forcing session refresh before notification navigation...");
              setSessionRefreshing(true);
              setShouldShowBootScreen(true); // Ensure boot screen shows during refresh
              try {
                const { ensureValidSession } = await import("../lib/auth");
                const sessionValid = await ensureValidSession();
                if (!sessionValid) {
                  console.warn("[boot] Session invalid after refresh - skipping notification navigation");
                  setSessionRefreshing(false);
                  return; // Don't navigate if session is invalid
                }
                console.log("[boot] Session validated successfully for notification navigation");
              } catch (sessionError) {
                console.error("[boot] Session refresh failed for notification navigation:", sessionError);
                setSessionRefreshing(false);
                return; // Don't navigate if session refresh fails
              } finally {
                setSessionRefreshing(false);
              }
              
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
        // If navigation doesn't happen within 3 seconds, force navigation
        const navigationTimeout = setTimeout(() => {
          if (hasNavigatedRef.current) {
            clearTimeout(navigationTimeout);
            return;
          }
          console.warn("[boot] Boot flow: Navigation timeout - forcing navigation", {
            hasMembership: !!membership,
            groupId: membership?.group_id,
          });
          if (membership?.group_id) {
            router.replace("/(main)/home");
          } else {
            router.replace("/(onboarding)/create-group/name-type");
          }
        }, 3000);
        
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
  }, [user, authLoading, router, forceBootRecheck]); // Add forceBootRecheck to dependencies

  // CRITICAL: Always show boot screen during boot process
  // Show boot screen if:
  // 1. Still booting
  // 2. AuthProvider is loading
  // 3. Session is refreshing
  // 4. No route matched (prevents black screen)
  // 5. Explicitly set to show boot screen
  const segmentsLength = (segments as string[]).length;
  const hasNoRoute = segmentsLength === 0;
  const shouldShowBooting = booting || authLoading || sessionRefreshing || (!err && hasNoRoute) || shouldShowBootScreen;
  
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

  // CRITICAL: Always show boot screen during boot to prevent black screens
  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      {shouldShowBooting || shouldForceShowBoot ? (
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
