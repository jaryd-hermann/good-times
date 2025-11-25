import { forwardRef } from "react"
import { View, TextInput, Text, StyleSheet, type TextInputProps } from "react-native"
import { colors, typography, spacing } from "../lib/theme"

interface InputProps extends TextInputProps {
  label?: string
  error?: string
}

export const Input = forwardRef<TextInput, InputProps>(
  ({ label, error, style, onFocus, ...props }, ref) => {
    return (
      <View style={styles.container}>
        {label && <Text style={styles.label}>{label}</Text>}
        <TextInput
          ref={ref}
          style={[styles.input, error && styles.inputError, style]}
          placeholderTextColor={colors.gray[500]}
          onFocus={(e) => {
            console.log("[Input] onFocus fired in Input component")
            onFocus?.(e)
          }}
          {...props}
        />
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    )
  }
)

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.bodyMedium,
    marginBottom: spacing.xs,
    color: colors.white,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.gray[800],
    borderWidth: 1,
    borderColor: colors.gray[700],
    borderRadius: 0,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    color: colors.white,
    minHeight: 56,
  },
  inputError: {
    borderColor: colors.accent,
  },
  error: {
    ...typography.caption,
    color: colors.accent,
    marginTop: spacing.xs,
  },
})
