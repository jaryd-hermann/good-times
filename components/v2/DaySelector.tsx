import { useMemo, useState } from "react"
import { View, Text, StyleSheet, Pressable, Modal } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useV2Colors, v2Spacing as sp } from "../../lib/v2/theme"
import * as haptics from "../../lib/v2/haptics"
import type { RangeQuestionMap } from "../../lib/v2/types"

/** Today plus the four days behind it. */
export const DAY_WINDOW = 5

export function shiftDate(base: string, days: number) {
  const d = new Date(base + "T00:00:00")
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** "Today" for the current date, otherwise the weekday: Mon, Tue, Wed… */
export function dayChipLabel(date: string, today: string) {
  if (date === today) return "Today"
  return new Date(date + "T00:00:00").toLocaleDateString([], { weekday: "short" })
}

/**
 * Day picker for Capture.
 *
 * Replaces the swipe-carousel this screen used to have. A dropdown states plainly
 * which days exist and which are already answered — the carousel made you swipe
 * blind to find out, and paging state was a recurring source of jumping and blank
 * pages.
 */
export function DaySelector({
  today,
  selectedDate,
  questions,
  onSelect,
}: {
  today: string
  selectedDate: string
  questions: RangeQuestionMap
  onSelect: (date: string) => void
}) {
  const { c } = useV2Colors()
  const [open, setOpen] = useState(false)
  const s = useMemo(() => makeStyles(c), [c])

  const days = useMemo(
    () => Array.from({ length: DAY_WINDOW }, (_, i) => shiftDate(today, -i)),
    [today]
  )

  return (
    <>
      <Pressable
        onPress={() => {
          haptics.tap()
          setOpen(true)
        }}
        hitSlop={8}
        style={({ pressed }) => [s.chip, pressed ? { opacity: 0.7 } : null]}
        accessibilityLabel="Choose a day"
      >
        <Text style={s.chipText}>{dayChipLabel(selectedDate, today)}</Text>
        <MaterialCommunityIcons name="chevron-down" size={15} color={c.text} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {/* Backdrop closes — a dropdown you can only dismiss by choosing is a trap. */}
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            {/* Names what the list is. Without it the sheet is a bare column of
                weekdays with no statement of what picking one does. */}
            <Text style={s.sheetTitle}>Recent questions</Text>
            {days.map((d) => {
              const q = questions[d]
              const isSel = d === selectedDate
              return (
                <Pressable
                  key={d}
                  onPress={() => {
                    haptics.selection()
                    onSelect(d)
                    setOpen(false)
                  }}
                  style={({ pressed }) => [
                    s.row,
                    isSel ? s.rowSelected : null,
                    pressed ? { opacity: 0.75 } : null,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowDay}>{dayChipLabel(d, today)}</Text>
                    <Text style={s.rowQuestion} numberOfLines={1}>
                      {q?.text ?? "No question"}
                    </Text>
                  </View>

                  {q?.answered ? (
                    <View style={s.answered}>
                      <MaterialCommunityIcons name="check" size={14} color="#fff" />
                    </View>
                  ) : (
                    <View style={s.notAnswered} />
                  )}
                </Pressable>
              )
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

function makeStyles(c: ReturnType<typeof useV2Colors>["c"]) {
  return StyleSheet.create({
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      // Transparent: a filled chip competed with the question card for attention,
      // and this is a control, not a status.
      backgroundColor: "transparent",
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 8,
      paddingLeft: 9,
      paddingRight: 5,
      paddingVertical: 3,
    },
    chipText: { color: c.text, fontSize: 12, fontWeight: "800", letterSpacing: 0.4 },

    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", paddingTop: 100, paddingHorizontal: sp.lg },
    sheet: {
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 16,
      overflow: "hidden",
    },
    sheetTitle: {
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: c.textSecondary,
      paddingHorizontal: sp.md,
      paddingTop: sp.md,
      paddingBottom: sp.sm,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: sp.md,
      paddingHorizontal: sp.lg,
      paddingVertical: sp.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    rowSelected: { backgroundColor: c.surfaceAlt },
    rowDay: { fontSize: 16, fontWeight: "800", color: c.text },
    rowQuestion: { fontSize: 13, color: c.textSecondary, marginTop: 1 },
    answered: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: c.green,
      alignItems: "center",
      justifyContent: "center",
    },
    notAnswered: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: c.border,
      opacity: 0.35,
    },
  })
}
