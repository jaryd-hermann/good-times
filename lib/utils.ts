import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

import { format, parseISO, isToday, isYesterday } from "date-fns"

export function formatDate(date: string | Date): string {
  const dateObj = typeof date === "string" ? parseISO(date) : date

  if (isToday(dateObj)) {
    return "Today"
  } else if (isYesterday(dateObj)) {
    return "Yesterday"
  } else {
    return format(dateObj, "EEEE, d MMMM")
  }
}

export function formatTime(date: string | Date): string {
  const dateObj = typeof date === "string" ? parseISO(date) : date
  return format(dateObj, "h:mm a")
}

export function getTodayDate(): string {
  return format(new Date(), "yyyy-MM-dd")
}

export function getDayOfWeek(date: string): string {
  return format(parseISO(date), "EEE")
}

export function getWeekDates(): { date: string; day: string; dayNum: number }[] {
  const today = new Date()
  const dates = []

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    dates.push({
      date: format(date, "yyyy-MM-dd"),
      day: format(date, "EEE"),
      dayNum: date.getDate(),
    })
  }

  return dates
}

// Format a Date as local yyyy-MM-dd without timezone shifting.
// This uses the Date's local components instead of ISO/UTC conversions.
export function formatDateAsLocalISO(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

// Helper to convert a UTC timestamp string (e.g. from Supabase `created_at`)
// into a local calendar date string in yyyy-MM-dd format.
// This is used to anchor timelines to the group creation date in the user's local time.
export function utcStringToLocalDate(utcString: string): string {
  const date = new Date(utcString)
  return format(date, "yyyy-MM-dd")
}

export function getPreviousDay(dateString: string): string {
  // Parse date string as local date (not UTC) to avoid timezone issues
  // Format: "yyyy-MM-dd" -> create Date object in local timezone
  const [year, month, day] = dateString.split("-").map(Number)
  const date = new Date(year, month - 1, day) // month is 0-indexed
  date.setDate(date.getDate() - 1)
  return format(date, "yyyy-MM-dd")
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + "..."
}
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
