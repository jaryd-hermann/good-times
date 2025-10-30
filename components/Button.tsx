import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, type ViewStyle, type TextStyle } from "react-native"
import { colors, typography, spacing } from "../lib/theme"

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
  return (
    <TouchableOpacity
      style={[
        styles.button,
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "ghost" && styles.ghost,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.white : colors.accent} />
      ) : (
        <Text
          style={[
            styles.text,
            variant === "primary" && styles.primaryText,
            variant === "secondary" && styles.secondaryText,
            variant === "ghost" && styles.ghostText,
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
  disabled: {
    opacity: 0.5,
  },
  text: {
    ...typography.bodyBold,
    fontSize: 18,
  },
  primaryText: {
    color: colors.white,
  },
  secondaryText: {
    color: colors.black,
  },
  ghostText: {
    color: colors.white,
  },
})
