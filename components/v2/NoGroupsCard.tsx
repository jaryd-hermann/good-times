import { useMemo } from "react"
import { View, Text, Image, StyleSheet, Pressable } from "react-native"
import { useRouter } from "expo-router"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useV2Colors, v2Spacing as sp } from "../../lib/v2/theme"
import * as haptics from "../../lib/v2/haptics"

/**
 * "You have no groups" prompt, shared by Today and History.
 *
 * One component rather than two copies: the two screens hit the same dead end and
 * a user who dismisses the idea on Today shouldn't meet a different-looking version
 * of it on History.
 *
 * The groupcard.png gradient is the background in BOTH themes, so unlike the rest
 * of v2 nothing here is theme-conditional — the artwork is light either way, so the
 * text and CTA stay black-on-gradient rather than inverting in dark mode.
 */
export function NoGroupsCard({
  title,
  body,
  style,
}: {
  title: string
  body: string
  style?: object
}) {
  const router = useRouter()
  const { c } = useV2Colors()
  const s = useMemo(() => makeStyles(c), [c])

  return (
    <Pressable
      onPress={() => {
        haptics.tap()
        router.push("/(onboarding-v2)/alone")
      }}
      style={({ pressed }) => [s.card, pressed ? { transform: [{ translateY: 2 }] } : null, style]}
    >
      {/* Absolute fill under the content, inside the clipped card, so the gradient
          takes the border radius without the text inheriting any of it. */}
      {/* "stretch", not "cover": the card is far wider than it is tall, so cover
          was scaling the 1880x945 source up to fill the width and cropping most of
          it away — which is what read as zoomed and soft. Stretch fits the whole
          gradient with no crop and no upscale. Safe here because the artwork is an
          abstract gradient with nothing to distort. */}
      <Image
        source={require("../../assets/images/groupcard.png")}
        style={StyleSheet.absoluteFill}
        resizeMode="stretch"
      />
      <Text style={s.title}>{title}</Text>
      <Text style={s.body}>{body}</Text>
      <View style={s.cta}>
        <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
        <Text style={s.ctaText}>Create or join a group</Text>
      </View>
    </Pressable>
  )
}

function makeStyles(_c: ReturnType<typeof useV2Colors>["c"]) {
  return StyleSheet.create({
    card: {
      borderWidth: 2,
      borderColor: "#000000",
      borderRadius: 16,
      padding: sp.lg,
      // Clips the gradient to the radius. Safe here — this card casts no shadow,
      // and overflow:"hidden" on a shadow-caster is what kills a bevel.
      overflow: "hidden",
    },
    title: { fontSize: 17, fontWeight: "800", color: "#000000" },
    body: { fontSize: 14, fontWeight: "700", color: "#000000", opacity: 0.8, marginTop: 4, lineHeight: 20 },
    cta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: "#000000",
      borderWidth: 2,
      borderColor: "#000000",
      borderRadius: 24,
      paddingVertical: 12,
      marginTop: sp.md,
    },
    ctaText: { fontSize: 15, fontWeight: "800", color: "#FFFFFF" },
  })
}
