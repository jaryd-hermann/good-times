import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, type ViewStyle, type TextStyle } from "react-native"
import { typography, spacing } from "../lib/theme"
import { useTheme } from "../lib/theme-context"

interface ButtonProps {
  title: string
  onPress: () => void
  variant?: "primary" | "secondary" | "ghost"
  disabled?: boolean
  loading?: boolean
  style?: ViewStyle
  textStyle?: TextStyle
}

export function Button({ title, onPress, variant = "primary", disabled, loading, style, textStyle }: ButtonProps) {
  const { colors } = useTheme()
  
  const dynamicStyles = StyleSheet.create({
    primary: {
      backgroundColor: colors.accent,
    },
    secondary: {
      backgroundColor: colors.white,
    },
    ghost: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: colors.white,
    },
    primaryText: {
      color: "#ffffff", // Always white for red CTAs, regardless of theme
    },
    secondaryText: {
      color: colors.black,
    },
    ghostText: {
      color: colors.white,
    },
  })

  return (
    <TouchableOpacity
      style={[
        styles.button,
        variant === "primary" && dynamicStyles.primary,
        variant === "secondary" && dynamicStyles.secondary,
        variant === "ghost" && dynamicStyles.ghost,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#ffffff" : colors.accent} />
      ) : (
        <Text
          style={[
            styles.text,
            variant === "primary" && dynamicStyles.primaryText,
            variant === "secondary" && dynamicStyles.secondaryText,
            variant === "ghost" && dynamicStyles.ghostText,
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 0,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    ...typography.bodyBold,
    fontSize: 18,
    textAlign: "center",
  },
})
