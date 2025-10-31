// app/index.tsx
import { useEffect, useState } from "react";
import { View, ActivityIndicator, Text, Pressable } from "react-native";
import { useRouter, Link } from "expo-router";
import { supabase } from "../lib/supabase";
// If you use a theme, keep it — otherwise hardcode colors:
const colors = { black: "#000", accent: "#de2f08", white: "#fff" };

export default function Index() {
  const router = useRouter();
  const [booting, setBooting] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data: { session }, error: sessErr } = await supabase.auth.getSession();
        if (sessErr) throw sessErr;

        if (!session) {
          router.replace("/(onboarding)/welcome-1"); // <-- ensure this exists
          return;
        }

        // NOTE: do you actually have a "users" table?
        // If not, either create one or skip this block.
        const { data: user, error: userErr } = await supabase
          .from("users")
          .select("name, birthday")
          .eq("id", session.user.id)
          .single();

        if (userErr) {
          console.log("users query error:", userErr);
          // fallback to onboarding about if profile missing or table doesn’t exist
          router.replace("/(onboarding)/about"); // <-- ensure this exists
          return;
        }

        if (user?.name && user?.birthday) {
          const { data: membership, error: mErr } = await supabase
            .from("group_members")
            .select("group_id")
            .eq("user_id", session.user.id)
            .limit(1)
            .maybeSingle(); // avoids throw if none found

          if (mErr) {
            console.log("group_members error:", mErr);
            router.replace("/(onboarding)/create-group/name-type"); // ensure exists
            return;
          }

          if (membership?.group_id) {
            router.replace("/(main)/home"); // ensure exists
          } else {
            router.replace("/(onboarding)/create-group/name-type");
          }
        } else {
          router.replace("/(onboarding)/about");
        }
      } catch (e: any) {
        console.log("boot error:", e?.message || e);
        setErr(String(e?.message || e));
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();

    return () => { cancelled = true; };
  }, [router]);

  // Visible fallback while redirects happen (or if something fails)
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
