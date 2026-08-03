import * as Haptics from "expo-haptics"
import { Platform } from "react-native"

/**
 * Haptic vocabulary for v2.
 *
 * Deliberately small and consistent — a different buzz for every tap trains
 * nothing. Three meanings only:
 *   tap()      you moved somewhere (opening a thread, switching tab)
 *   commit()   you're about to do the thing (answer to unlock)
 *   success()  it landed (answer posted)
 *
 * Every call is fire-and-forget: haptics failing must never interrupt a flow, and
 * Android devices without a vibrator simply no-op.
 */
function safe(fn: () => Promise<void>) {
  fn().catch(() => {})
}

/** Light selection tick — navigation and toggles. */
export function tap() {
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))
}

/** Medium press — a deliberate action is starting. */
export function commit() {
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium))
}

/** Success notification — something completed. */
export function success() {
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))
}

/** Warning — a soft failure the user should notice. */
export function warn() {
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning))
}

/**
 * Three quick pulses — reserved for joining a group.
 *
 * A single success tap is what posting an answer gets; joining people is rarer and
 * worth a distinct rhythm. Spaced 90ms so it reads as a beat, not a stutter.
 */
export function celebrate() {
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))
  setTimeout(() => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)), 90)
  setTimeout(() => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)), 180)
}

/**
 * Android's selection tick is weak enough to be imperceptible on many devices,
 * so treat it as a light impact there instead.
 */
export function selection() {
  if (Platform.OS === "android") return tap()
  safe(() => Haptics.selectionAsync())
}
