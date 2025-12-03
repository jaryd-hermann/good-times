// app/index.tsx
// Phase 2: Simplified boot flow - only routes based on AuthProvider state
// Phase 5: In-app vs cold start logic
// Phase 6: Black screen prevention

import { useEffect, useState, useRef } from "react";
import { View, ActivityIndicator, Text, Pressable, Alert, ImageBackground, StyleSheet, AppState } from "react-native";
import { useRouter, useSegments } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { typography, colors as themeColors } from "../lib/theme";
import { useAuth } from "../components/AuthProvider";
import {
  isColdStart,
  recordSessionStart,
  recordSuccessfulNavigation,
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
  const { user, loading: authLoading } = useAuth();
  const [booting, setBooting] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [loadingDots, setLoadingDots] = useState(".");
  const [shouldShowBootScreen, setShouldShowBootScreen] = useState(true);
  const [sessionRefreshing, setSessionRefreshing] = useState(false);
  const hasNavigatedRef = useRef(false);
  const bootStartTimeRef = useRef<number>(Date.now()); // Initialize immediately

  // CRITICAL: Always show boot screen on app open (from any source)
  // Record session start immediately
  useEffect(() => {
    async function initializeBoot() {
      try {
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
    const subscription = AppState.addEventListener("change", async (nextAppState) => {
      if (nextAppState === "active") {
        // Check if app was opened from a notification click
        const notificationClicked = await AsyncStorage.getItem("notification_clicked");
        const hasPendingNotification = await AsyncStorage.getItem("pending_notification");
        
        if (notificationClicked === "true" || hasPendingNotification) {
          console.log("[boot] App came to foreground from notification - forcing boot screen and session refresh");
          // Clear the flag
          if (notificationClicked === "true") {
            await AsyncStorage.removeItem("notification_clicked");
          }
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
            // Keep boot screen visible longer for notification opens (2 seconds)
            setTimeout(() => {
              setShouldShowBootScreen(false);
            }, 2000);
          }
        } else {
          console.log("[boot] App came to foreground - refreshing session and showing boot screen");
          // Always refresh session when app comes to foreground
          setSessionRefreshing(true);
          try {
            const { ensureValidSession } = await import("../lib/auth");
            await ensureValidSession();
            console.log("[boot] Session refreshed on foreground");
          } catch (error) {
            console.error("[boot] Failed to refresh session on foreground:", error);
          } finally {
            setSessionRefreshing(false);
          }
          // Show boot screen briefly to ensure smooth transition
          setShouldShowBootScreen(true);
          // Hide boot screen after a short delay
          setTimeout(() => {
            setShouldShowBootScreen(false);
          }, 500);
        }
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, []);

  // CRITICAL: Boot flow with forced session refresh
  // Always ensure session is valid before navigating
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Wait for AuthProvider to finish loading
        if (authLoading) {
          console.log("[boot] Waiting for AuthProvider to load...");
          return;
        }

        console.log("[boot] AuthProvider loaded, user:", !!user);

        // CRITICAL: Always refresh session during boot to ensure it's valid
        // This prevents black screens from stale sessions
        if (user) {
          console.log("[boot] User exists - refreshing session to ensure validity...");
          setSessionRefreshing(true);
          try {
            const { ensureValidSession } = await import("../lib/auth");
            const sessionValid = await ensureValidSession();
            if (!sessionValid) {
              console.warn("[boot] Session refresh failed - user may need to sign in again");
              // Don't navigate if session is invalid
              setBooting(false);
              return;
            }
            console.log("[boot] Session refreshed successfully");
          } catch (error: any) {
            console.error("[boot] Session refresh error:", error?.message);
            // If session refresh fails, still try to proceed (session might be valid)
            // But log the error for debugging
          } finally {
            setSessionRefreshing(false);
          }
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
        console.log("[boot] routing decision...");
        
        if (membership?.group_id) {
          console.log("[boot] user with group → (main)/home");
          if (!hasNavigatedRef.current) {
            hasNavigatedRef.current = true;
            router.replace("/(main)/home");
            await recordSuccessfulNavigation("/(main)/home");
          }
        } else {
          console.log("[boot] no group → onboarding/create-group/name-type");
          if (!hasNavigatedRef.current) {
            hasNavigatedRef.current = true;
            router.replace("/(onboarding)/create-group/name-type");
            await recordSuccessfulNavigation("/(onboarding)/create-group/name-type");
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
  }, [user, authLoading, router]);

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
