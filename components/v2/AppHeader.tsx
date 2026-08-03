import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native"
import { useRouter } from "expo-router"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { Avatar } from "../Avatar"
import { useV2Colors, v2Spacing as sp } from "../../lib/v2/theme"
import * as haptics from "../../lib/v2/haptics"

/**
 * Shared v2 header.
 *
 * Left:   feedback icon
 * Centre: Good Times wordmark
 * Right:  history icon + your avatar (avatar opens the menu)
 *
 * v2 has no bottom tab bar — History is reached from the icon here, and closes
 * back to Today with its own back arrow. Same `history.png` asset v1 used, not an
 * emoji stand-in.
 */
export function AppHeader({
  avatarUrl,
  name,
  showHistory = true,
  left,
  unseenCount = 0,
}: {
  /** Unseen messages across all groups; shown as a badge on the history icon. */
  unseenCount?: number
  /** Rendered in the top-left slot. Capture puts its day picker here. */
  left?: React.ReactNode
  avatarUrl?: string
  name?: string | null
  showHistory?: boolean
}) {
  const router = useRouter()
  const { c, isDark } = useV2Colors()
  const s = makeStyles(c, isDark)

  return (
    <View style={s.header}>
      {/* Feedback lives in Settings only. A permanent report-a-problem icon over
          the day's question set the wrong tone for the screen. */}
      <View style={s.left}>{left}</View>

      <View style={s.wordmarkWrap} pointerEvents="none">
        <Image
          source={
            isDark
              ? require("../../assets/images/wordmark-light.png")
              : require("../../assets/images/wordmark.png")
          }
          style={s.wordmark}
          resizeMode="contain"
        />
      </View>

      <View style={s.right}>
        {showHistory ? (
          <TouchableOpacity
            style={{ position: "relative" }}
            onPress={() => {
              haptics.tap()
              router.push("/(v2)/history")
            }}
            hitSlop={10}
            accessibilityLabel="History"
          >
            <Image
              source={require("../../assets/images/history.png")}
              style={[s.icon, isDark ? s.iconDark : null]}
              resizeMode="contain"
            />
            {/* Violet + black stroke: the same pairing History uses for unseen, so
                the badge and the rows it points at read as one idea. */}
            {unseenCount > 0 ? (
              <View style={s.unseenBadge}>
                <Text style={s.unseenText}>{unseenCount > 99 ? "99+" : unseenCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={() => {
            haptics.tap()
            router.push("/(v2)/menu")
          }}
          hitSlop={8}
          accessibilityLabel="Your profile and settings"
        >
          <Avatar uri={avatarUrl} name={name} size={34} borderColor={c.border} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

/** Header for pushed screens: back arrow instead of feedback, optional title. */
export function BackHeader({ title, onBack }: { title?: string; onBack?: () => void }) {
  const router = useRouter()
  const { c, isDark } = useV2Colors()
  const s = makeStyles(c, isDark)

  return (
    <View style={s.header}>
      <TouchableOpacity
        onPress={() => {
          haptics.tap()
          onBack ? onBack() : router.back()
        }}
        hitSlop={14}
        accessibilityLabel="Back"
      >
        <Text style={s.back}>‹</Text>
      </TouchableOpacity>
      <View style={s.wordmarkWrap} pointerEvents="none">
        <Text style={s.title}>{title ?? ""}</Text>
      </View>
      <View style={s.right} />
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useV2Colors>["c"], isDark: boolean) {
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: sp.lg,
      paddingVertical: sp.sm,
      minHeight: 56,
    },
    icon: { width: 26, height: 26 },
    // The v1 icon PNGs are dark artwork, so invert them on the dark theme.
    iconDark: { tintColor: c.text },
    wordmarkWrap: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
    },
    // The light wordmark reads heavier than the dark one at the same size, so it
    // is stepped down rather than matched pixel-for-pixel.
    wordmark: { width: isDark ? 158 : 186, height: isDark ? 32 : 38 },
    unseenBadge: {
      position: "absolute",
      top: -6,
      right: -8,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 5,
      backgroundColor: "#F0D7FF",
      borderWidth: 2,
      borderColor: "#000000",
      alignItems: "center",
      justifyContent: "center",
    },
    unseenText: { fontSize: 11, fontWeight: "800", color: "#000000" },
    title: { fontSize: 17, fontWeight: "800", color: c.text },
    // Fixed min-width on both sides so the centred wordmark stays centred
    // regardless of what the day chip says ("Today" is wider than "Mon").
    left: { minWidth: 78, alignItems: "flex-start" },
    right: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: sp.md, minWidth: 78 },
    back: { fontSize: 32, color: c.text, lineHeight: 34, marginTop: -4 },
  })
}
