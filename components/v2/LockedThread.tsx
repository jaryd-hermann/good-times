import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native"
import { BlurView } from "expo-blur"
import { LinearGradient } from "expo-linear-gradient"
import { useV2Colors, v2Spacing as sp } from "../../lib/v2/theme"
import * as haptics from "../../lib/v2/haptics"

/**
 * The gate (screenshot: "Answer first, then you're in").
 *
 * Renders skeleton shapes, not content. The server already strips text and media
 * for a locked thread (v2_get_thread returns redacted:true), so there is nothing
 * real to leak here — the blur is the visual language, not the security boundary.
 *
 * A gradient fades the whole stream into the CTA so the eye lands on the button.
 */
export function LockedThread({
  answeredCount,
  onAnswer,
}: {
  answeredCount: number
  onAnswer: () => void
}) {
  const { c, isDark } = useV2Colors()
  const s = makeStyles(c)

  return (
    <View style={s.wrap}>
      <ScrollView
        scrollEnabled={false}
        contentContainerStyle={{ padding: sp.lg }}
        showsVerticalScrollIndicator={false}
      >
        {/* question banner ghost */}
        <View style={s.questionGhost} />

        {/* a few answer-card ghosts */}
        <View style={s.card}>
          <View style={[s.line, { width: "82%" }]} />
          <View style={[s.line, { width: "64%" }]} />
        </View>
        <View style={[s.line, { width: "44%", marginLeft: sp.md, marginBottom: sp.lg }]} />
        <View style={[s.bubble, s.bubbleMine]} />
        <View style={s.card}>
          <View style={[s.line, { width: "72%" }]} />
          <View style={[s.line, { width: "88%" }]} />
          <View style={[s.line, { width: "50%" }]} />
        </View>
        <View style={s.bubble} />
        <View style={s.card}>
          <View style={[s.line, { width: "66%" }]} />
        </View>
      </ScrollView>

      {/* the blur itself */}
      <BlurView
        intensity={38}
        tint={isDark ? "dark" : "light"}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* fade the stream out into the CTA */}
      <LinearGradient
        colors={[`${c.bg}00`, `${c.bg}C0`, c.bg]}
        locations={[0, 0.55, 0.82]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={s.footer}>
        <Text style={s.padlock}>🔒</Text>
        <Text style={s.title}>Answer first, then you&rsquo;re in</Text>
        <Text style={s.sub}>
          {answeredCount > 0
            ? "Nobody sees anyone's answer until they've written their own. That's the whole trick."
            : "Nobody sees anyone's answer until they've written their own. Be the one who starts it."}
        </Text>
        <Pressable
          onPress={() => {
            haptics.commit()
            onAnswer()
          }}
          style={({ pressed }) => [s.cta, pressed ? s.ctaPressed : null]}
        >
          <Text style={s.ctaText}>Answer today&rsquo;s question</Text>
        </Pressable>
      </View>
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useV2Colors>["c"]) {
  return StyleSheet.create({
    wrap: { flex: 1 },
    questionGhost: {
      height: 76,
      borderRadius: 14,
      backgroundColor: c.accent,
      opacity: 0.85,
      marginBottom: sp.lg,
    },
    card: {
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 14,
      padding: sp.md,
      marginBottom: sp.sm,
      gap: 9,
    },
    line: { height: 12, borderRadius: 6, backgroundColor: c.textSecondary, opacity: 0.35 },
    bubble: {
      height: 46,
      width: "62%",
      borderRadius: 14,
      backgroundColor: c.bubble,
      borderWidth: 1.5,
      borderColor: c.border,
      marginBottom: sp.sm,
    },
    bubbleMine: { alignSelf: "flex-end", backgroundColor: c.blue, opacity: 0.75, width: "55%" },

    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      padding: sp.xl,
      alignItems: "center",
      gap: sp.sm,
    },
    padlock: { fontSize: 22 },
    title: {
      fontSize: 24,
      fontWeight: "800",
      color: c.text,
      textAlign: "center",
      letterSpacing: -0.4,
    },
    sub: {
      color: c.textSecondary,
      textAlign: "center",
      lineHeight: 21,
      marginBottom: sp.sm,
      paddingHorizontal: sp.sm,
    },
    cta: {
      backgroundColor: c.pink,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 30,
      paddingVertical: 17,
      alignItems: "center",
      alignSelf: "stretch",
      shadowColor: c.border,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 5,
    },
    ctaPressed: {
      transform: [{ translateY: 5 }],
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      elevation: 0,
    },
    ctaText: { color: "#fff", fontWeight: "800", fontSize: 17 },
  })
}
