import { supabase } from "./supabase"
import { getUserGroups, getDailyPrompt, getUserEntryForDate } from "./db"
import { getTodayDate } from "./utils"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as Notifications from "expo-notifications"

const LAST_CHECKED_KEY = "notifications_last_checked"
const ENTRY_VISITED_KEY_PREFIX = "entry_visited_"
const GROUP_VISITED_KEY_PREFIX = "group_visited_"

// Get last visited timestamp for an entry
async function getEntryLastVisited(entryId: string): Promise<Date | null> {
  const key = `${ENTRY_VISITED_KEY_PREFIX}${entryId}`
  const timestamp = await AsyncStorage.getItem(key)
  return timestamp ? new Date(timestamp) : null
}

// Get last visited timestamp for a group
async function getGroupLastVisited(groupId: string): Promise<Date | null> {
  const key = `${GROUP_VISITED_KEY_PREFIX}${groupId}`
  const timestamp = await AsyncStorage.getItem(key)
  return timestamp ? new Date(timestamp) : null
}

// Get last checked notifications timestamp
async function getLastCheckedTimestamp(): Promise<Date | null> {
  const timestamp = await AsyncStorage.getItem(LAST_CHECKED_KEY)
  return timestamp ? new Date(timestamp) : null
}

// Calculate badge count for app icon
// Includes all in-app notifications PLUS new question count (even for single-group users)
export async function getBadgeCount(userId: string): Promise<number> {
  let count = 0
  const todayDate = getTodayDate()
  const lastChecked = await getLastCheckedTimestamp()

  // Get all user's groups
  const groups = await getUserGroups(userId)

  // 1. Count new unanswered questions (ALWAYS, even for single-group users)
  for (const group of groups) {
    try {
      const dailyPrompt = await getDailyPrompt(group.id, todayDate, userId)
      if (dailyPrompt) {
        // Check if user has answered today's question
        const userEntry = await getUserEntryForDate(group.id, userId, todayDate)
        if (!userEntry) {
          // User hasn't answered today's question - count it
          count++
        }
      }
    } catch (error) {
      console.error(`[badge] Error checking new question for group ${group.id}:`, error)
      // Continue with other groups
    }
  }

  // 2. Count replies to user's entries
  const { data: userEntries, error: entriesError } = await supabase
    .from("entries")
    .select("id, group_id, created_at")
    .eq("user_id", userId)

  if (!entriesError && userEntries) {
    for (const entry of userEntries) {
      try {
        // Get last visited timestamp for this entry
        const lastVisited = await getEntryLastVisited(entry.id)
        const checkSince = lastVisited || lastChecked || new Date(0)

        // Count comments on this entry created after last visit/check
        const { data: comments, error: commentsError } = await supabase
          .from("comments")
          .select("id")
          .eq("entry_id", entry.id)
          .neq("user_id", userId) // Exclude user's own comments
          .gt("created_at", checkSince.toISOString())

        if (!commentsError && comments && comments.length > 0) {
          // Count all replies (we aggregate in UI, but count individually for badge)
          count += comments.length
        }
      } catch (error) {
        console.error(`[badge] Error checking replies for entry ${entry.id}:`, error)
        // Continue with other entries
      }
    }
  }

  // 3. Count new answers shared in groups since last visit
  for (const group of groups) {
    try {
      // Get last visited timestamp for this group
      const groupLastVisited = await getGroupLastVisited(group.id)
      const checkSince = groupLastVisited || lastChecked || new Date(0)

      // Count entries in this group created after last visit, excluding user's own entries
      const { data: newEntries, error: entriesError } = await supabase
        .from("entries")
        .select("id")
        .eq("group_id", group.id)
        .neq("user_id", userId) // Exclude user's own entries
        .gt("created_at", checkSince.toISOString())

      if (!entriesError && newEntries && newEntries.length > 0) {
        // Count new entries (we aggregate names in UI, but count individually for badge)
        count += newEntries.length
      }
    } catch (error) {
      console.error(`[badge] Error checking new answers for group ${group.id}:`, error)
      // Continue with other groups
    }
  }

  // 4. Count replies to threads user participated in
  const { data: userComments, error: userCommentsError } = await supabase
    .from("comments")
    .select("entry_id, created_at")
    .eq("user_id", userId)

  if (!userCommentsError && userComments) {
    // Get unique entry IDs
    const entryIds = Array.from(new Set(userComments.map((c) => c.entry_id)))

    for (const entryId of entryIds) {
      try {
        // Get last visited timestamp for this entry
        const lastVisited = await getEntryLastVisited(entryId)
        const checkSince = lastVisited || lastChecked || new Date(0)

        // Get user's comment timestamp (to only count replies after user commented)
        const userComment = userComments.find((c) => c.entry_id === entryId)
        const userCommentedAt = userComment?.created_at
          ? new Date(userComment.created_at)
          : new Date(0)

        // Count comments on this entry created after user's comment and after last visit
        const { data: threadComments, error: threadCommentsError } = await supabase
          .from("comments")
          .select("id")
          .eq("entry_id", entryId)
          .neq("user_id", userId) // Exclude user's own comments
          .gt("created_at", new Date(Math.max(checkSince.getTime(), userCommentedAt.getTime())).toISOString())

        if (!threadCommentsError && threadComments && threadComments.length > 0) {
          // Count all thread replies (we aggregate in UI, but count individually for badge)
          count += threadComments.length
        }
      } catch (error) {
        console.error(`[badge] Error checking thread replies for entry ${entryId}:`, error)
        // Continue with other entries
      }
    }
  }

  return count
}

// Update app icon badge count
export async function updateBadgeCount(userId: string | undefined): Promise<void> {
  if (!userId) return

  try {
    // Check if notifications are enabled
    const { status } = await Notifications.getPermissionsAsync()
    if (status !== "granted") {
      // Permission not granted - can't set badge
      return
    }

    const count = await getBadgeCount(userId)
    await Notifications.setBadgeCountAsync(count)
  } catch (error) {
    console.error("[badge] Error updating badge count:", error)
    // Don't throw - badge is not critical functionality
  }
}

