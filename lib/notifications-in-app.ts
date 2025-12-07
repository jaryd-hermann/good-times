import { supabase } from "./supabase"
import { getUserGroups, getDailyPrompt, getUserEntryForDate, getGroup, getPendingVotes } from "./db"
import { getTodayDate } from "./utils"
import AsyncStorage from "@react-native-async-storage/async-storage"

export interface InAppNotification {
  id: string
  type: "new_question" | "reply_to_entry" | "reply_to_thread" | "new_answers" | "deck_vote_requested"
  groupId: string
  groupName: string
  // For new_question
  date?: string
  // For reply notifications
  entryId?: string
  commentId?: string
  commenterName?: string
  commenterAvatarUrl?: string
  entryAuthorName?: string
  // For new_answers
  answererNames?: string[] // Array of names who answered
  // For deck_vote_requested
  deckId?: string
  deckName?: string
  requesterName?: string
  createdAt: string
}

const LAST_CHECKED_KEY = "notifications_last_checked"
const ENTRY_VISITED_KEY_PREFIX = "entry_visited_"
const GROUP_VISITED_KEY_PREFIX = "group_visited_"

// Get last visited timestamp for an entry
async function getEntryLastVisited(entryId: string): Promise<Date | null> {
  const key = `${ENTRY_VISITED_KEY_PREFIX}${entryId}`
  const timestamp = await AsyncStorage.getItem(key)
  return timestamp ? new Date(timestamp) : null
}

// Mark entry as visited
export async function markEntryAsVisited(entryId: string): Promise<void> {
  const key = `${ENTRY_VISITED_KEY_PREFIX}${entryId}`
  await AsyncStorage.setItem(key, new Date().toISOString())
}

// Get last checked notifications timestamp
async function getLastCheckedTimestamp(): Promise<Date | null> {
  const timestamp = await AsyncStorage.getItem(LAST_CHECKED_KEY)
  return timestamp ? new Date(timestamp) : null
}

// Mark notifications as checked (when modal opens)
export async function markNotificationsAsChecked(): Promise<void> {
  await AsyncStorage.setItem(LAST_CHECKED_KEY, new Date().toISOString())
}

// Clear all notifications by marking everything as visited/checked
export async function clearAllNotifications(userId: string): Promise<void> {
  const now = new Date().toISOString()
  
  // Set global last checked timestamp
  await AsyncStorage.setItem(LAST_CHECKED_KEY, now)
  
  // Mark all user's entries as visited
  try {
    const { data: userEntries } = await supabase
      .from("entries")
      .select("id")
      .eq("user_id", userId)
    
    if (userEntries) {
      for (const entry of userEntries) {
        const key = `${ENTRY_VISITED_KEY_PREFIX}${entry.id}`
        await AsyncStorage.setItem(key, now)
      }
    }
  } catch (error) {
    console.error("[clearAllNotifications] Error marking entries as visited:", error)
  }
  
  // Mark all entries where user has commented (for thread replies)
  try {
    const { data: userComments } = await supabase
      .from("comments")
      .select("entry_id")
      .eq("user_id", userId)
    
    if (userComments) {
      const uniqueEntryIds = Array.from(new Set(userComments.map((c) => c.entry_id)))
      for (const entryId of uniqueEntryIds) {
        const key = `${ENTRY_VISITED_KEY_PREFIX}${entryId}`
        await AsyncStorage.setItem(key, now)
      }
    }
  } catch (error) {
    console.error("[clearAllNotifications] Error marking commented entries as visited:", error)
  }
  
  // Mark all user's groups as visited
  try {
    const groups = await getUserGroups(userId)
    for (const group of groups) {
      const key = `${GROUP_VISITED_KEY_PREFIX}${group.id}`
      await AsyncStorage.setItem(key, now)
    }
  } catch (error) {
    console.error("[clearAllNotifications] Error marking groups as visited:", error)
  }
}

// Get last visited timestamp for a group
async function getGroupLastVisited(groupId: string): Promise<Date | null> {
  const key = `${GROUP_VISITED_KEY_PREFIX}${groupId}`
  const timestamp = await AsyncStorage.getItem(key)
  return timestamp ? new Date(timestamp) : null
}

// Mark group as visited
export async function markGroupAsVisited(groupId: string): Promise<void> {
  const key = `${GROUP_VISITED_KEY_PREFIX}${groupId}`
  await AsyncStorage.setItem(key, new Date().toISOString())
}

// Format names for notification text (e.g., "Jaryd, Rose, and Emily")
function formatNames(names: string[]): string {
  if (names.length === 0) return ""
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  // For 3+ names: "Jaryd, Rose, and Emily"
  const allButLast = names.slice(0, -1).join(", ")
  const last = names[names.length - 1]
  return `${allButLast}, and ${last}`
}

// Fetch all in-app notifications for a user
export async function getInAppNotifications(userId: string): Promise<InAppNotification[]> {
  const notifications: InAppNotification[] = []
  const todayDate = getTodayDate()
  const lastChecked = await getLastCheckedTimestamp()

  // Get all user's groups
  const groups = await getUserGroups(userId)

  // 1. Check for new unanswered questions (today only)
  // Only show this notification if user is in multiple groups
  // Single-group users will see the question when they open the app anyway
  if (groups.length > 1) {
    for (const group of groups) {
      try {
        // Only show if user hasn't checked notifications since today started
        // If lastChecked exists and is today, don't show (user has already seen/cleared it)
        const todayStart = new Date(todayDate + "T00:00:00")
        const shouldShowNewQuestion = !lastChecked || lastChecked < todayStart
        
        if (shouldShowNewQuestion) {
          const dailyPrompt = await getDailyPrompt(group.id, todayDate, userId)
          if (dailyPrompt) {
            // Check if user has answered today's question
            const userEntry = await getUserEntryForDate(group.id, userId, todayDate)
            if (!userEntry) {
              // User hasn't answered today's question
              notifications.push({
                id: `new_question_${group.id}_${todayDate}`,
                type: "new_question",
                groupId: group.id,
                groupName: group.name,
                date: todayDate,
                createdAt: dailyPrompt.created_at || new Date().toISOString(),
              })
            }
          }
        }
      } catch (error) {
        console.error(`[notifications] Error checking new question for group ${group.id}:`, error)
        // Continue with other groups
      }
    }
  }

  // 2. Check for replies to user's entries
  // Get all entries by the user across all groups
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

        // Get comments on this entry created after last visit/check
        const { data: comments, error: commentsError } = await supabase
          .from("comments")
          .select("*, user:users(*)")
          .eq("entry_id", entry.id)
          .neq("user_id", userId) // Exclude user's own comments
          .gt("created_at", checkSince.toISOString())
          .order("created_at", { ascending: false })

        if (!commentsError && comments && comments.length > 0) {
          // Get group name
          const group = groups.find((g) => g.id === entry.group_id)
          const groupName = group?.name || "your group"

          // Aggregate multiple replies
          if (comments.length === 1) {
            const comment = comments[0] as any
            notifications.push({
              id: `reply_to_entry_${comment.id}`,
              type: "reply_to_entry",
              groupId: entry.group_id,
              groupName,
              entryId: entry.id,
              commentId: comment.id,
              commenterName: comment.user?.name || "Someone",
              commenterAvatarUrl: comment.user?.avatar_url,
              createdAt: comment.created_at,
            })
          } else {
            // Multiple replies - use most recent commenter for display
            const mostRecent = comments[0] as any
            notifications.push({
              id: `reply_to_entry_${entry.id}_aggregate`,
              type: "reply_to_entry",
              groupId: entry.group_id,
              groupName,
              entryId: entry.id,
              commentId: mostRecent.id,
              commenterName: `${comments.length} people`,
              commenterAvatarUrl: mostRecent.user?.avatar_url,
              createdAt: mostRecent.created_at,
            })
          }
        }
      } catch (error) {
        console.error(`[notifications] Error checking replies for entry ${entry.id}:`, error)
        // Continue with other entries
      }
    }
  }

  // 3. Check for new answers shared in groups since last visit
  for (const group of groups) {
    try {
      // Get last visited timestamp for this group
      const groupLastVisited = await getGroupLastVisited(group.id)
      const checkSince = groupLastVisited || lastChecked || new Date(0)

      // Get all entries in this group created after last visit, excluding user's own entries
      const { data: newEntries, error: entriesError } = await supabase
        .from("entries")
        .select("id, user_id, created_at, user:users(name)")
        .eq("group_id", group.id)
        .neq("user_id", userId) // Exclude user's own entries
        .gt("created_at", checkSince.toISOString())
        .order("created_at", { ascending: false })

      if (!entriesError && newEntries && newEntries.length > 0) {
        // Get unique users who answered
        const userMap = new Map<string, string>()
        for (const entry of newEntries) {
          const user = entry.user as any
          if (user && user.name && !userMap.has(entry.user_id)) {
            userMap.set(entry.user_id, user.name)
          }
        }

        const answererNames = Array.from(userMap.values())
        if (answererNames.length > 0) {
          // Use most recent entry's created_at
          const mostRecentEntry = newEntries[0]
          notifications.push({
            id: `new_answers_${group.id}_${mostRecentEntry.id}`,
            type: "new_answers",
            groupId: group.id,
            groupName: group.name,
            answererNames,
            createdAt: mostRecentEntry.created_at || new Date().toISOString(),
          })
        }
      }
    } catch (error) {
      console.error(`[notifications] Error checking new answers for group ${group.id}:`, error)
      // Continue with other groups
    }
  }

  // 4. Check for replies to threads user participated in
  // Get all entries where user has commented
  const { data: userComments, error: userCommentsError } = await supabase
    .from("comments")
    .select("entry_id, created_at")
    .eq("user_id", userId)

  if (!userCommentsError && userComments) {
    // Get unique entry IDs
    const entryIds = Array.from(new Set(userComments.map((c) => c.entry_id)))

    for (const entryId of entryIds) {
      try {
        // Get entry details
        const { data: entry, error: entryError } = await supabase
          .from("entries")
          .select("id, group_id, user_id, user:users(*)")
          .eq("id", entryId)
          .single()

        if (entryError || !entry) continue

        // Get last visited timestamp for this entry
        const lastVisited = await getEntryLastVisited(entryId)
        const checkSince = lastVisited || lastChecked || new Date(0)

        // Get user's comment timestamp (to only show replies after user commented)
        const userComment = userComments.find((c) => c.entry_id === entryId)
        const userCommentedAt = userComment?.created_at
          ? new Date(userComment.created_at)
          : new Date(0)

        // Get comments on this entry created after user's comment and after last visit
        const { data: threadComments, error: threadCommentsError } = await supabase
          .from("comments")
          .select("*, user:users(*)")
          .eq("entry_id", entryId)
          .neq("user_id", userId) // Exclude user's own comments
          .gt("created_at", new Date(Math.max(checkSince.getTime(), userCommentedAt.getTime())).toISOString())
          .order("created_at", { ascending: false })

        if (!threadCommentsError && threadComments && threadComments.length > 0) {
          // Get group name
          const group = groups.find((g) => g.id === entry.group_id)
          const groupName = group?.name || "your group"
          const entryAuthor = entry.user as any

          // Aggregate multiple replies
          if (threadComments.length === 1) {
            const comment = threadComments[0] as any
            notifications.push({
              id: `reply_to_thread_${comment.id}`,
              type: "reply_to_thread",
              groupId: entry.group_id,
              groupName,
              entryId: entry.id,
              commentId: comment.id,
              commenterName: comment.user?.name || "Someone",
              commenterAvatarUrl: comment.user?.avatar_url,
              entryAuthorName: entryAuthor?.name || "someone",
              createdAt: comment.created_at,
            })
          } else {
            // Multiple replies - use most recent commenter for display
            const mostRecent = threadComments[0] as any
            notifications.push({
              id: `reply_to_thread_${entryId}_aggregate`,
              type: "reply_to_thread",
              groupId: entry.group_id,
              groupName,
              entryId: entry.id,
              commentId: mostRecent.id,
              commenterName: `${threadComments.length} people`,
              commenterAvatarUrl: mostRecent.user?.avatar_url,
              entryAuthorName: entryAuthor?.name || "someone",
              createdAt: mostRecent.created_at,
            })
          }
        }
      } catch (error) {
        console.error(`[notifications] Error checking thread replies for entry ${entryId}:`, error)
        // Continue with other entries
      }
    }
  }

  // 5. Check for pending deck votes (user hasn't voted yet)
  // Only show if vote was requested after last check
  const checkSince = lastChecked || new Date(0)
  for (const group of groups) {
    try {
      const pendingVotes = await getPendingVotes(group.id, userId)
      if (pendingVotes && pendingVotes.length > 0) {
        // Filter to only votes requested after last check
        const recentVotes = pendingVotes.filter((vote) => {
          const voteCreatedAt = vote.created_at ? new Date(vote.created_at) : new Date(0)
          return voteCreatedAt > checkSince
        })
        
        if (recentVotes.length > 0) {
          // Get the most recent pending vote (first one)
          const pendingVote = recentVotes[0]
          const deck = pendingVote.deck
          const requester = pendingVote.requested_by_user

          if (deck && requester) {
            notifications.push({
              id: `deck_vote_requested_${group.id}_${pendingVote.deck_id}`,
              type: "deck_vote_requested",
              groupId: group.id,
              groupName: group.name,
              deckId: pendingVote.deck_id,
              deckName: deck.name,
              requesterName: requester.name || "Someone",
              createdAt: pendingVote.created_at || new Date().toISOString(),
            })
          }
        }
      }
    } catch (error) {
      console.error(`[notifications] Error checking pending deck votes for group ${group.id}:`, error)
      // Continue with other groups
    }
  }

  // Sort by most recent first
  return notifications.sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

