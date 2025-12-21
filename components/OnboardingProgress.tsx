import { View, StyleSheet } from "react-native"
import { colors, spacing } from "../lib/theme"

interface OnboardingProgressProps {
  total: number
  current: number
}

export function OnboardingProgress({ total, current }: OnboardingProgressProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: total }, (_, i) => i + 1).map((index) => (
        <View
          key={index}
          style={[styles.dot, index === current && styles.dotActive]}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
  },
  dotActive: {
    backgroundColor: "#000000",
  },
})

