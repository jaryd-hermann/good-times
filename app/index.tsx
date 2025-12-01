// app/index.tsx
// Phase 2: Simplified boot flow - only routes based on AuthProvider state
// Phase 5: In-app vs cold start logic
// Phase 6: Black screen prevention

import { useEffect, useState, useRef } from "react";
import { View, ActivityIndicator, Text, Pressable, Alert, ImageBackground, StyleSheet } from "react-native";
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
  const hasNavigatedRef = useRef(false);

  // Phase 5: Determine if boot screen should show based on cold start
  useEffect(() => {
    async function checkColdStart() {
      try {
        const isCold = await isColdStart();
        setShouldShowBootScreen(isCold);
        
        // Record session start if cold start
        if (isCold) {
          await recordSessionStart();
        }
      } catch (error) {
        console.error("[index] Failed to check cold start:", error);
        // On error, show boot screen to be safe
        setShouldShowBootScreen(true);
      }
    }
    
    checkColdStart();
  }, []);

  // Phase 2: Simplified boot flow - only route based on AuthProvider state
  // No session checking here - AuthProvider handles all session management
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
          setBooting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, router]);

  // Phase 6: Black screen prevention - always show boot screen if no route
  // Also show boot screen during AuthProvider loading or if booting
  const segmentsLength = (segments as string[]).length;
  const hasNoRoute = segmentsLength === 0;
  const shouldShowBooting = booting || authLoading || (!err && hasNoRoute) || shouldShowBootScreen;

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

  // Phase 6: Always show booting screen if no route (prevents black screen)
  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      {shouldShowBooting ? (
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
