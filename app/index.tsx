// app/index.tsx
//
// Boot. There is exactly one app now — nothing here routes into v1.
//
// The old v1 boot flow re-armed itself from ten places (an AppState listener, a
// pathname watcher, and a setInterval polling `trigger_boot_recheck` every 2s),
// each resetting a navigation guard so it could replace() into /(main)/home. That
// is how signing in used to dump you back into the old app. It is deleted, not
// guarded — a flag would only have hidden it.

import { useEffect, useState } from "react";
import { View, Image, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../components/AuthProvider";
import { routeAfterAuth } from "../lib/v2/onboarding";

/**
 * Boot: wait for auth to settle, then hand off declaratively.
 *
 * <Redirect> rather than router.replace() in an effect — it can't fire twice and
 * can't race the auth state settling, so there is no navigation ref to keep. That
 * ref-juggling is exactly what made the v1 flow re-enterable.
 *
 * Signed-in users go through routeAfterAuth for the same reason the auth screen
 * does: someone who quit the app midway through onboarding still has a session but
 * no profile, and sending them to /(v2)/today would show a nameless account.
 */
export default function Index() {
  const { user, loading, restoringSession } = useAuth();
  const [dest, setDest] = useState<string | null>(null);

  useEffect(() => {
    if (loading || restoringSession || !user) return;
    let cancelled = false;
    routeAfterAuth(user.id)
      .then((d) => !cancelled && setDest(d))
      // Never strand the user on a splash because a lookup failed — the (v2)
      // layout's auth guard is the backstop if the session is genuinely bad.
      .catch(() => !cancelled && setDest("/(v2)/today"));
    return () => {
      cancelled = true;
    };
  }, [user, loading, restoringSession]);

  if (loading || restoringSession) return <BootSplash />;
  if (!user) return <Redirect href="/(onboarding-v2)/splash" />;
  if (!dest) return <BootSplash />;
  return <Redirect href={dest as never} />;
}

function BootSplash() {
  return (
    <View style={s.screen}>
      <Image
        source={require("../assets/images/loading.png")}
        style={s.logo}
        resizeMode="contain"
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#E8E0D5", alignItems: "center", justifyContent: "center" },
  logo: { width: 160, height: 160 },
});
