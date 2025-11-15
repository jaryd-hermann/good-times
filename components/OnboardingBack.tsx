import { TouchableOpacity, Text, StyleSheet } from "react-native"
import { useRouter } from "expo-router"
import { colors, spacing } from "../lib/theme"

interface OnboardingBackProps {
  color?: string
}

export function OnboardingBack({ color = colors.white }: OnboardingBackProps) {
  const router = useRouter()
  const canGoBack = router.canGoBack()

  if (!canGoBack) {
    return null
  }

  return (
    <TouchableOpacity onPress={() => router.back()} style={styles.button}>
      <Text style={[styles.text, { color }]}>Back</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.sm,
    paddingHorizontal: 0, // Remove horizontal padding to align with page margin
  },
  text: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
  },
})

