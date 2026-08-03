import { Image, StyleSheet, View, type ViewStyle, type StyleProp } from "react-native"

/**
 * Brand paper texture, tiled.
 *
 * Two things this gets right that a bare <Image> did not:
 *
 *  - `resizeMode="repeat"` on iOS needs EXPLICIT width/height. With only
 *    StyleSheet.absoluteFill the image drew once at its intrinsic 183x183 in the
 *    top-left corner instead of tiling across the card.
 *  - It must live inside a clipped wrapper, never on the shadow-casting view —
 *    `overflow: "hidden"` clips the hard offset shadow, which is what silently
 *    removed the 3D bevel from every card it was added to.
 *
 * Use TexturedCard below rather than placing this by hand.
 */
export function Texture({ radius = 16, opacity = 0.25 }: { radius?: number; opacity?: number }) {
  return (
    <View
      style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" }]}
      pointerEvents="none"
    >
      <Image
        source={require("../../assets/images/texture.png")}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity }}
        resizeMode="repeat"
      />
    </View>
  )
}

/**
 * A card that keeps its bevel AND carries the texture.
 *
 * outer  → border, radius, background, hard shadow (never clipped)
 * inner  → overflow hidden, holds the texture + content
 */
export function TexturedCard({
  children,
  style,
  radius = 16,
  opacity = 0.25,
  pressed = false,
  bevel = 4,
}: {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  radius?: number
  opacity?: number
  pressed?: boolean
  bevel?: number
}) {
  return (
    <View
      style={[
        {
          borderRadius: radius,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: pressed ? 0 : bevel },
          shadowOpacity: pressed ? 0 : 1,
          shadowRadius: 0,
          elevation: pressed ? 0 : bevel,
          transform: [{ translateY: pressed ? bevel : 0 }],
        },
        style,
      ]}
    >
      <Texture radius={radius} opacity={opacity} />
      {children}
    </View>
  )
}
