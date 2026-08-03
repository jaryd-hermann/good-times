import { useEffect, useMemo, useRef } from "react"
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from "react-native"

const COLORS = ["#D9788F", "#E5A13C", "#4A7A5C", "#3A5F8C", "#F0D7FF", "#B4534E"]
const PIECES = 42

/**
 * Confetti burst, hand-rolled on Animated.
 *
 * Deliberately not a new dependency — this is one moment in the app, and a
 * confetti/Lottie package would add a native module and its own upgrade burden
 * for ~60 lines of animation.
 *
 * pointerEvents="none" throughout: the celebration must never eat a tap from the
 * screen underneath it.
 */
export function Confetti({ onDone }: { onDone?: () => void }) {
  const { width, height } = useWindowDimensions()
  const progress = useRef(new Animated.Value(0)).current

  // Shapes are fixed on mount so a re-render doesn't reshuffle mid-flight.
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, i) => ({
        key: i,
        x: Math.random() * width,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.random() * 8,
        delay: Math.random() * 350,
        drift: (Math.random() - 0.5) * 120,
        spin: (Math.random() - 0.5) * 8,
      })),
    [width]
  )

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 2200,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(() => onDone?.())
  }, [progress, onDone])

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p) => {
        // Each piece runs on a delayed slice of the shared clock, so one timing
        // animation drives all of them rather than 42 separate ones.
        const t = Animated.subtract(progress, p.delay / 2200)
        const translateY = t.interpolate({
          inputRange: [0, 1],
          outputRange: [-40, height + 60],
          extrapolate: "clamp",
        })
        const translateX = t.interpolate({
          inputRange: [0, 1],
          outputRange: [0, p.drift],
          extrapolate: "clamp",
        })
        const rotate = t.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", `${p.spin * 360}deg`],
          extrapolate: "clamp",
        })
        const opacity = t.interpolate({
          inputRange: [0, 0.1, 0.8, 1],
          outputRange: [0, 1, 1, 0],
          extrapolate: "clamp",
        })

        return (
          <Animated.View
            key={p.key}
            style={{
              position: "absolute",
              left: p.x,
              top: 0,
              width: p.size,
              height: p.size * 1.6,
              borderRadius: 2,
              backgroundColor: p.color,
              opacity,
              transform: [{ translateY }, { translateX }, { rotate }],
            }}
          />
        )
      })}
    </View>
  )
}
