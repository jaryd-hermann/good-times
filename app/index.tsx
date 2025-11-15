// app/index.tsx
import { useEffect, useState } from "react";
import { View, ActivityIndicator, Text, Pressable, Alert } from "react-native";
import { useRouter, Link } from "expo-router";
import { supabase } from "../lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getBiometricPreference,
  authenticateWithBiometric,
  getBiometricRefreshToken,
  getBiometricUserId,
  clearBiometricCredentials,
} from "../lib/biometric";
import { registerForPushNotifications, savePushToken } from "../lib/notifications";

const colors = { black: "#000", accent: "#de2f08", white: "#fff" };
const PENDING_GROUP_KEY = "pending_group_join";

type MaybeUser = { name?: string | null; birthday?: string | null } | null;

export default function Index() {
  const router = useRouter();
  const [booting, setBooting] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        console.log("[boot] start");

        // Check for pending group join (from deep link before auth)
        const pendingGroupId = await AsyncStorage.getItem(PENDING_GROUP_KEY);

        // Check if biometric login is enabled and try to authenticate
        const biometricEnabled = await getBiometricPreference();
        let session = null;

        if (biometricEnabled) {
          console.log("[boot] biometric enabled, attempting biometric login");
          const refreshToken = await getBiometricRefreshToken();
          const userId = await getBiometricUserId();

          if (refreshToken && userId) {
            // Try biometric authentication
            const authResult = await authenticateWithBiometric("Log in with FaceID");
            if (authResult.success) {
              try {
                // Use refresh token to get new session
                const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
                  refresh_token: refreshToken,
                });

                if (!refreshError && refreshData.session) {
                  session = refreshData.session;
                  console.log("[boot] biometric login successful");
                } else {
                  console.log("[boot] refresh token invalid, clearing credentials");
                  await clearBiometricCredentials();
                }
              } catch (error: any) {
                console.log("[boot] biometric refresh failed:", error.message);
                await clearBiometricCredentials();
              }
            } else {
              console.log("[boot] biometric authentication cancelled/failed:", authResult.error);
              // User cancelled or failed - fall through to normal session check
            }
          }
        }

        // If no session from biometric, check normal session
        if (!session) {
          const { data: { session: normalSession }, error: sessErr } = await supabase.auth.getSession();
          if (sessErr) throw new Error(`getSession: ${sessErr.message}`);
          session = normalSession;
          console.log("[boot] normal session:", !!session);
        }

        if (!session) {
          console.log("[boot] no session → onboarding/welcome-1");
          // Keep pendingGroupId in storage for after auth
          router.replace("/(onboarding)/welcome-1"); // make sure file exists
          return;
        }

        // If there's a pending group join, handle it after checking profile
        if (pendingGroupId) {
          await AsyncStorage.removeItem(PENDING_GROUP_KEY);
          // After auth, redirect to join handler
          router.replace({
            pathname: `/join/${pendingGroupId}`,
          });
          return;
        }

        // Save biometric credentials if biometric is enabled and we just logged in
        if (biometricEnabled && session.refresh_token) {
          try {
            const { saveBiometricCredentials } = await import("../lib/biometric");
            await saveBiometricCredentials(session.refresh_token, session.user.id);
          } catch (error) {
            console.warn("[boot] failed to save biometric credentials:", error);
            // Don't block boot if saving fails
          }
        }

        // 2) user profile (if your table is 'users'; if it's 'profiles', change this)
        let user: MaybeUser = null;
        const { data: userData, error: userErr } = await supabase
          .from("users")
          .select("name, birthday")
          .eq("id", session.user.id)
          .maybeSingle();

        if (userErr) {
          console.log("[boot] users query error:", userErr.message);
        } else {
          user = userData as MaybeUser;
        }
        console.log("[boot] user:", user);

        if (!user?.name || !user?.birthday) {
          console.log("[boot] missing name/birthday → onboarding/welcome-1");
          router.replace("/(onboarding)/welcome-1");
          return;
        }

        // 3) group membership
        console.log("[boot] checking group membership...");
        const { data: membership, error: memErr } = await supabase
          .from("group_members")
          .select("group_id")
          .eq("user_id", session.user.id)
          .limit(1)
          .maybeSingle();

        console.log("[boot] membership query result:", { membership, error: memErr?.message });

        if (memErr) {
          console.log("[boot] group_members error:", memErr.message);
          console.log("[boot] → onboarding/create-group/name-type");
          router.replace("/(onboarding)/create-group/name-type"); // make sure file exists
          return;
        }

        // Push notifications will be requested on first visit to home.tsx
        console.log("[boot] routing decision...");
        if (membership?.group_id) {
          console.log("[boot] has group → (main)/home");
          router.replace("/(main)/home"); // make sure file exists
        } else {
          console.log("[boot] no group → onboarding/create-group/name-type");
          router.replace("/(onboarding)/create-group/name-type");
        }
        console.log("[boot] router.replace called");
      } catch (e: any) {
        const msg = e?.message || String(e);
        console.log("[boot] error:", msg);
        setErr(msg);
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.black, justifyContent: "center", alignItems: "center", gap: 16 }}>
      {booting ? (
        <>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={{ color: colors.white, opacity: 0.8 }}>Booting…</Text>
        </>
      ) : (
        <>
          <Text style={{ color: colors.white, textAlign: "center", paddingHorizontal: 24 }}>
            {err ? `Boot error: ${err}` : "No route matched. Use the button below to open onboarding."}
          </Text>
          <Link href="/(onboarding)/welcome-1" asChild>
            <Pressable style={{ paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.white, borderRadius: 8 }}>
              <Text style={{ color: colors.white }}>Go to Onboarding</Text>
            </Pressable>
          </Link>
        </>
      )}
    </View>
  );
}
