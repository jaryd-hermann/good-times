import { getTodayDate } from "../utils"

/**
 * Labels for "which day's question is on screen".
 *
 * v2 lets you answer past days, so a hardcoded "Today's question" was wrong the
 * moment someone opened an older thread. Shared by the composer and the locked
 * thread so the tag above the card and the CTA below it can never disagree.
 */

/** "Today" | "Yesterday" | "Friday" | "Aug 1" */
export function dayLabel(date: string, today = getTodayDate()): string {
  if (!date || date === today) return "Today"

  const [y, m, d] = date.split("-").map(Number)
  if (!y || !m || !d) return "Today"
  // Built from parts, NOT new Date(date): the string form is parsed as UTC
  // midnight and lands a day earlier for anyone west of Greenwich, which would
  // name the wrong weekday for half the users.
  const dt = new Date(y, m - 1, d)
  if (Number.isNaN(dt.getTime())) return "Today"

  const [ty, tm, td] = today.split("-").map(Number)
  const days = Math.round((new Date(ty, tm - 1, td).getTime() - dt.getTime()) / 86_400_000)

  if (days === 1) return "Yesterday"
  // Past a week a weekday name is ambiguous — "Friday" is which Friday?
  if (days > 6 || days < 0) return dt.toLocaleDateString([], { month: "short", day: "numeric" })
  return dt.toLocaleDateString([], { weekday: "long" })
}

/** True for the "Aug 1" form, which takes different grammar to a weekday. */
function isDated(label: string) {
  return /\d/.test(label)
}

/**
 * The tag above a question card.
 * "Today's question" | "Friday's question" | "Question from Aug 1"
 */
export function questionTag(date: string, today = getTodayDate()): string {
  const l = dayLabel(date, today)
  return isDated(l) ? `Question from ${l}` : `${l}'s question`
}

/**
 * The same thing mid-sentence, for a CTA.
 * "Answer today's question" | "Answer Friday's question" | "Answer the question from Aug 1"
 *
 * Only Today/Yesterday are lowercased — they are common nouns. Weekday and month
 * names stay capitalised.
 */
export function answerCta(date: string, today = getTodayDate()): string {
  const l = dayLabel(date, today)
  if (isDated(l)) return `Answer the question from ${l}`
  const noun = l === "Today" || l === "Yesterday" ? l.toLowerCase() : l
  return `Answer ${noun}'s question`
}
