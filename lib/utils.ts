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

  for (let i = 0; i < 7; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() - today.getDay() + i)
    dates.push({
      date: format(date, "yyyy-MM-dd"),
      day: format(date, "EEE"),
      dayNum: date.getDate(),
    })
  }

  return dates
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + "..."
}
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
