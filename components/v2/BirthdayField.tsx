import { useState } from "react"
import { View, Text, StyleSheet, Pressable, Platform } from "react-native"
import DateTimePicker from "@react-native-community/datetimepicker"
import { useV2Colors, v2Spacing as sp } from "../../lib/v2/theme"

/**
 * Birthday picker, shared by onboarding and Settings.
 *
 * It lives here so the two can't drift: onboarding used to take a typed "DD/MM"
 * string while Settings used the native wheel, which meant two parsers and two
 * sets of validation for one field.
 *
 * Always starts empty. v1 pre-filled the wheel with 1969-03-15 and never forced a
 * change, so 24% of stored birthdays were that default — 11 users across 14 of 26
 * groups, all of whom would have triggered fake birthday banners every March.
 */
export function BirthdayField({
  value,
  onChange,
}: {
  value: Date | null
  onChange: (d: Date | null) => void
}) {
  const { c, isDark } = useV2Colors()
  const [open, setOpen] = useState(false)
  const s = makeStyles(c)

  return (
    <>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [s.input, pressed ? { opacity: 0.7 } : null]}
      >
        <Text style={value ? s.inputText : s.inputPlaceholder}>
          {value
            ? value.toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" })
            : "Choose your birthday"}
        </Text>
      </Pressable>

      {open ? (
        <View style={s.pickerWrap}>
          <DateTimePicker
            value={value ?? new Date(1995, 0, 1)}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            maximumDate={new Date()}
            // The picker follows the SYSTEM appearance unless told otherwise, so on
            // a dark-mode device it rendered white text on our light cream surface.
            // Pin it to the app's theme.
            themeVariant={isDark ? "dark" : "light"}
            textColor={c.text}
            onChange={(_e, d) => {
              if (Platform.OS !== "ios") setOpen(false)
              if (d) onChange(d)
            }}
          />
          {value ? (
            <Pressable
              onPress={() => {
                onChange(null)
                setOpen(false)
              }}
            >
              <Text style={s.clearDate}>Clear birthday</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </>
  )
}

function makeStyles(c: ReturnType<typeof useV2Colors>["c"]) {
  return StyleSheet.create({
    input: {
      backgroundColor: c.surfaceAlt,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 12,
      padding: sp.md,
      fontSize: 16,
      color: c.text,
    },
    inputText: { fontSize: 16, color: c.text },
    inputPlaceholder: { fontSize: 16, color: c.textSecondary },
    pickerWrap: {
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 14,
      marginTop: sp.sm,
      paddingBottom: sp.sm,
      alignItems: "center",
    },
    clearDate: { color: c.red, fontWeight: "700", paddingVertical: sp.sm },
  })
}
