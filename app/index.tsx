// app/index.tsx
import { useEffect, useState } from "react";
import { View, ActivityIndicator, Text, Pressable } from "react-native";
import { useRouter, Link } from "expo-router";
import { supabase } from "../lib/supabase";

const colors = { black: "#000", accent: "#de2f08", white: "#fff" };

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

        // 1) session
        const { data: { session }, error: sessErr } = await supabase.auth.getSession();
        if (sessErr) throw new Error(`getSession: ${sessErr.message}`);
        console.log("[boot] session:", !!session);

        if (!session) {
          console.log("[boot] no session → onboarding/welcome-1");
          router.replace("/(onboarding)/welcome-1"); // make sure file exists
          return;
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
        const { data: membership, error: memErr } = await supabase
          .from("group_members")
          .select("group_id")
          .eq("user_id", session.user.id)
          .limit(1)
          .maybeSingle();

        if (memErr) {
          console.log("[boot] group_members error:", memErr.message);
          console.log("[boot] → onboarding/create-group/name-type");
          router.replace("/(onboarding)/create-group/name-type"); // make sure file exists
          return;
        }

        if (membership?.group_id) {
          console.log("[boot] has group → (main)/home");
          router.replace("/(main)/home"); // make sure file exists
        } else {
          console.log("[boot] no group → onboarding/create-group/name-type");
          router.replace("/(onboarding)/create-group/name-type");
        }
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
