import { supabase } from "./supabase"
import type { User, Group, GroupMember, Prompt, DailyPrompt, Entry, Memorial, Reaction, Comment, CustomQuestion, CustomQuestionRotation, GroupActivityTracking, Collection, Deck, GroupDeckVote, GroupActiveDeck, BirthdayCard, BirthdayCardEntry, FeaturedPrompt, GroupFeaturedQuestion, Interest, GroupInterest, UserInterest, UserStatus } from "./types"
import { personalizeMemorialPrompt, replaceDynamicVariables } from "./prompts"
import { isSunday, getTodayDate } from "./utils"

export interface MarketingStorySlide {
  id: string
  story_id: string
  slide_number: number
  headline: string
  body: string
}

export async function getMarketingStory(storyId: string): Promise<MarketingStorySlide[]> {
  const { data, error } = await supabase
    .from("marketing_stories")
    .select("*")
    .eq("story_id", storyId)
    .order("slide_number", { ascending: true })

  if (error) {
    console.error("[getMarketingStory] Error fetching story:", error)
    return []
  }

  return data || []
}

// Helper function to select next memorial in rotation (week-based)
// Ensures: Week 1 = Person A, Week 2 = Person B, etc.
// CRITICAL: Check memorial usage across ALL Remembering prompts for this group, not just this specific prompt_id
// This ensures proper rotation even when different Remembering prompts are scheduled
async function selectNextMemorial(
  groupId: string,
  promptId: string,
  date: string,
  memorials: Memorial[]
): Promise<string> {
  const weekStart = getWeekStartDate(date)
  
  // CRITICAL: Check if a memorial was already used THIS WEEK for ANY Remembering prompt in this group
  // This is important because different Remembering prompts have different prompt_ids
  // If one was already used this week, we should NOT schedule another memorial question
  // But if somehow one was scheduled, we must ensure we use a DIFFERENT memorial name
  const { data: thisWeekUsage } = await supabase
    .from("prompt_name_usage")
    .select("name_used, prompt_id, date_used")
    .eq("group_id", groupId)
    .eq("variable_type", "memorial_name")
    .gte("date_used", weekStart)
    .lte("date_used", date)
    .order("date_used", { ascending: false })
  
  // If a memorial was already used this week, we MUST use a DIFFERENT one to prevent back-to-back
  // This should never happen due to weekly limit, but if it does, ensure alternation
  if (thisWeekUsage && thisWeekUsage.length > 0) {
    const usedNamesThisWeek = new Set(thisWeekUsage.map(u => u.name_used))
    
    // Check if there was a memorial used YESTERDAY (back-to-back check)
    const yesterday = new Date(date)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split("T")[0]
    
    const yesterdayUsage = thisWeekUsage.find(u => u.date_used === yesterdayStr)
    
    if (yesterdayUsage) {
      // Memorial was used yesterday - MUST use a different one today
      const yesterdayName = yesterdayUsage.name_used
      const availableMemorials = memorials.filter(m => m.name !== yesterdayName)
      
      if (availableMemorials.length > 0) {
        // Use a different memorial (prefer one not used this week)
        const unusedThisWeek = availableMemorials.filter(m => !usedNamesThisWeek.has(m.name))
        if (unusedThisWeek.length > 0) {
          return unusedThisWeek[0].name
        }
        // If all others were used this week, rotate from yesterday's name
        const yesterdayIndex = memorials.findIndex(m => m.name === yesterdayName)
        const nextIndex = (yesterdayIndex + 1) % memorials.length
        return memorials[nextIndex].name
      } else {
        // Only one memorial - shouldn't happen, but use it
        return memorials[0].name
      }
    }
    
    // Memorial was used this week but not yesterday - use a different one
    const usedNamesSet = new Set(thisWeekUsage.map(u => u.name_used))
    const availableMemorials = memorials.filter(m => !usedNamesSet.has(m.name))
    if (availableMemorials.length > 0) {
      return availableMemorials[0].name
    }
    
    // All memorials were used this week - rotate from most recent
    const mostRecentName = thisWeekUsage[0].name_used
    const mostRecentIndex = memorials.findIndex(m => m.name === mostRecentName)
    const nextIndex = (mostRecentIndex + 1) % memorials.length
    return memorials[nextIndex].name
  }
  
  // No memorial used this week - rotate to next person
  // Find which memorial was used LAST (across all Remembering prompts, not just this prompt_id)
  // This ensures proper rotation regardless of which specific Remembering prompt is scheduled
  const { data: lastUsage } = await supabase
    .from("prompt_name_usage")
    .select("name_used")
    .eq("group_id", groupId)
    .eq("variable_type", "memorial_name")
    .lt("date_used", weekStart) // Before this week
    .order("date_used", { ascending: false })
    .limit(1)
  
  const lastUsedName = lastUsage && lastUsage.length > 0 ? lastUsage[0].name_used : null
  
  // Find index of last used memorial
  const lastUsedIndex = lastUsedName 
    ? memorials.findIndex(m => m.name === lastUsedName)
    : -1
  
  // Select next memorial in rotation (cycle through)
  const nextIndex = lastUsedIndex >= 0 
    ? (lastUsedIndex + 1) % memorials.length  // Next in rotation
    : 0  // Start with first if none used before
  
  return memorials[nextIndex].name
}

// User queries
export async function getCurrentUser(): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase.from("users").select("*").eq("id", user.id).single()
  return data
}

export async function updateUser(userId: string, updates: Partial<User>) {
  const { data, error } = await supabase.from("users").update(updates).eq("id", userId).select().single()
  if (error) throw error
  return data
}

// Get device timezone (e.g., "America/New_York", "Europe/London")
export function getDeviceTimezone(): string {
  try {
    // Use Intl API to get IANA timezone identifier
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch (error) {
    console.error("[db] Failed to get device timezone:", error)
    // Fallback to America/New_York if detection fails
    return "America/New_York"
  }
}

// Ensure user has timezone set and update it if it has changed (e.g., user traveled)
// This updates the timezone whenever called, so notifications adjust to user's current location
export async function ensureUserTimezone(userId: string): Promise<void> {
  try {
    const deviceTimezone = getDeviceTimezone()
    
    // Get current user data
    const { data: user, error: fetchError } = await supabase
      .from("users")
      .select("timezone")
      .eq("id", userId)
      .single()

    if (fetchError) {
      console.error("[db] Failed to fetch user for timezone check:", fetchError)
      return
    }

    // Update timezone if:
    // 1. It's not set, OR
    // 2. It has changed (user traveled to different timezone)
    if (!user?.timezone || user.timezone !== deviceTimezone) {
      const { error: updateError } = await supabase
        .from("users")
        .update({ timezone: deviceTimezone })
        .eq("id", userId)

      if (updateError) {
        console.error("[db] Failed to update user timezone:", updateError)
      } else {
        if (!user?.timezone) {
          console.log(`[db] Set timezone for user ${userId}: ${deviceTimezone}`)
        } else {
          console.log(`[db] Updated timezone for user ${userId}: ${user.timezone} -> ${deviceTimezone}`)
        }
      }
    }
  } catch (error) {
    console.error("[db] Error ensuring user timezone:", error)
  }
}

export async function markAppTutorialSeen(userId: string) {
  const { data, error } = await supabase
    .from("users")
    .update({ app_tutorial_seen: true })
    .eq("id", userId)
    .select()
    .single()
  if (error) throw error
  return data
}

// Group queries
export async function getUserGroups(userId: string): Promise<Group[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select("group:groups(*)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false })

  if (error) throw error
  return data?.map((item: any) => item.group) || []
}

export async function getGroup(groupId: string): Promise<Group | null> {
  const { data, error } = await supabase.from("groups").select("*").eq("id", groupId).single()
  if (error) throw error
  return data
}

export async function getGroupMembers(groupId: string): Promise<(GroupMember & { user: User })[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select("*, user:users(*)")
    .eq("group_id", groupId)
    .order("joined_at", { ascending: true })

  if (error) throw error
  return data || []
}

export async function createGroup(
  name: string, 
  type: "family" | "friends", 
  userId: string,
  enableNSFW?: boolean, // Optional: pass NSFW preference to avoid race condition
  hasMemorials?: boolean // Optional: pass memorial info to avoid race condition
): Promise<Group> {
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .insert({ name, type, created_by: userId })
    .select()
    .single()

  if (groupError) throw groupError

  const { error: memberError } = await supabase
    .from("group_members")
    .insert({ group_id: group.id, user_id: userId, role: "admin" })

  if (memberError) throw memberError

  // Track created_group event
  try {
    const { captureEvent } = await import("./posthog")
    captureEvent("created_group", {
      group_id: group.id,
      group_type: type,
      has_memorial: hasMemorials ?? false,
      nsfw_enabled: enableNSFW ?? false,
    })
  } catch (error) {
    // Never let PostHog errors affect group creation
    if (__DEV__) {
      console.error("[createGroup] Failed to track created_group event:", error)
    }
  }

  // Initialize question queue for the new group (non-blocking)
  // If this fails, group creation still succeeds (graceful degradation)
  try {
    console.log(`[createGroup] Initializing queue for group ${group.id} (type: ${type}, NSFW: ${enableNSFW ?? false}, Memorials: ${hasMemorials ?? false})`)
    const { data, error: queueError } = await supabase.functions.invoke("initialize-group-queue", {
      body: {
        group_id: group.id,
        group_type: type,
        created_by: userId,
        enable_nsfw: enableNSFW ?? false, // Pass NSFW preference to avoid race condition
        has_memorials: hasMemorials ?? false, // Pass memorial info to avoid race condition
      },
    })

    if (queueError) {
      console.error("[createGroup] Failed to initialize queue:", queueError)
      // Try to get error details from the response
      if (queueError.context) {
        const context = queueError.context as any
        console.error("[createGroup] Error context:", context)
        
        // Try to read the response body if available
        try {
          // Try to read from response if it's a Response object
          if (context instanceof Response) {
            const text = await context.text()
            console.error("[createGroup] Error response body:", text)
          } else if (context._bodyBlob && typeof context._bodyBlob.text === 'function' && !context.bodyUsed) {
            const text = await context._bodyBlob.text()
            console.error("[createGroup] Error response body:", text)
          } else if (context._bodyInit && typeof context._bodyInit.text === 'function') {
            const text = await context._bodyInit.text()
            console.error("[createGroup] Error response body:", text)
          } else if (context.status === 400) {
            // For 400 errors, try to get the error from data if available
            console.error("[createGroup] 400 error - check Supabase function logs for details")
          }
        } catch (e) {
          console.error("[createGroup] Could not read error response body:", e)
        }
      }
      if (queueError.message) {
        console.error("[createGroup] Error message:", queueError.message)
      }
      // Log the data if available (might contain error details)
      if (data) {
        console.error("[createGroup] Error data:", data)
      }
      // Don't throw - group creation succeeded, queue can be initialized later
    } else {
      console.log(`[createGroup] Queue initialization result:`, data)
    }
  } catch (error: any) {
    console.error("[createGroup] Error calling initialize-group-queue:", error)
    if (error.message) {
      console.error("[createGroup] Error message:", error.message)
    }
    if (error.context) {
      console.error("[createGroup] Error context:", error.context)
    }
    // Don't throw - group creation succeeded
  }

  return group
}

// Prompt queries
export async function getAllPrompts(): Promise<Prompt[]> {
  const { data, error } = await supabase.from("prompts").select("*").order("category", { ascending: true })
  if (error) throw error
  return data || []
}

export async function getPromptsByCategory(category: string): Promise<Prompt[]> {
  const { data, error } = await supabase.from("prompts").select("*").eq("category", category)
  if (error) throw error
  return data || []
}

// Helper function to get day index (moved from home.tsx)
function getDayIndex(dateString: string, groupId?: string): number {
  const base = new Date(dateString)
  const start = new Date("2020-01-01")
  const diff = Math.floor((base.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  const groupOffset = groupId ? groupId.length : 0
  return diff + groupOffset
}

export async function getDailyPrompt(groupId: string, date: string, userId?: string): Promise<DailyPrompt | null> {
  // First, check for user-specific prompt (for birthdays)
  if (userId) {
    const { data: userSpecificPrompt, error: userPromptError } = await supabase
      .from("daily_prompts")
      .select("*, prompt:prompts(*)")
      .eq("group_id", groupId)
      .eq("date", date)
      .eq("user_id", userId)
      .maybeSingle()

    if (userSpecificPrompt && !userPromptError && userSpecificPrompt.prompt) {
      const prompt = userSpecificPrompt.prompt as any
      let personalizedQuestion = prompt.question

      // Handle dynamic variables for birthday prompts
      if (prompt.dynamic_variables && Array.isArray(prompt.dynamic_variables)) {
        const variables: Record<string, string> = {}
        
        // If it's a "their_birthday" prompt, we need ALL birthday people's names (combined)
        if (prompt.birthday_type === "their_birthday") {
          // Get ALL members with birthdays today and combine their names
          const { data: members } = await supabase
            .from("group_members")
            .select("user_id, user:users(id, name, birthday)")
            .eq("group_id", groupId)
          
          if (members) {
            const todayMonthDay = date.substring(5) // MM-DD
            const birthdayNames: string[] = []
            
            for (const member of members) {
              const user = member.user as any
              if (user?.birthday && user.birthday.substring(5) === todayMonthDay && user.name) {
                birthdayNames.push(user.name)
              }
            }
            
            // Combine names: "Name1 and Name2" or just "Name1" if only one
            if (birthdayNames.length > 0) {
              if (birthdayNames.length === 1) {
                variables.member_name = birthdayNames[0]
              } else {
                // Combine with "and": "Jaryd and Brett"
                variables.member_name = birthdayNames.join(" and ")
              }
            } else {
              variables.member_name = "them"
            }
          }
        }

        // Replace variables in question text
        if (Object.keys(variables).length > 0) {
          personalizedQuestion = replaceDynamicVariables(prompt.question, variables)
        }
      }

      return {
        ...userSpecificPrompt,
        prompt: {
          ...prompt,
          question: personalizedQuestion,
        },
      }
    }
  }

  // Check for general prompt (applies to all members) - CHECK THIS FIRST
  // CRITICAL: We must check existing prompts BEFORE the Journal check to prevent overriding
  // prompts that already exist and may have entries
  // CRITICAL FIX: Check for MULTIPLE prompts and handle duplicates
  // Order by created_at to ensure consistency, prefer non-Journal prompts if today is not Sunday
  const todayDate = getTodayDate()
  const isTodaySunday = isSunday(date)
  
  const { data: allPrompts, error: existingError } = await supabase
    .from("daily_prompts")
    .select("*, prompt:prompts(*)")
    .eq("group_id", groupId)
    .eq("date", date)
    .is("user_id", null)
    .order("created_at", { ascending: true }) // Order by creation time for consistency
  
  // Handle multiple prompts - this is a bug that needs fixing
  let existing: any = null
  if (allPrompts && allPrompts.length > 0) {
    if (allPrompts.length > 1) {
      // Multiple prompts detected - this is a bug!
      console.warn(`[getDailyPrompt] Found ${allPrompts.length} general prompts for group ${groupId} on date ${date}. This should not happen.`)
      
      // Check which prompts have entries
      const promptsWithEntries: any[] = []
      const promptsWithoutEntries: any[] = []
      
      for (const prompt of allPrompts) {
        const { data: entries } = await supabase
          .from("entries")
          .select("id")
          .eq("group_id", groupId)
          .eq("date", date)
          .limit(1)
        
        if (entries && entries.length > 0) {
          promptsWithEntries.push(prompt)
        } else {
          promptsWithoutEntries.push(prompt)
        }
      }
      
      // Prefer prompt with entries
      if (promptsWithEntries.length > 0) {
        existing = promptsWithEntries[0] // Use first one with entries
        // Delete other prompts with entries (duplicates)
        for (let i = 1; i < promptsWithEntries.length; i++) {
          await supabase.from("daily_prompts").delete().eq("id", promptsWithEntries[i].id)
        }
        // Delete all prompts without entries (they're invalid)
        for (const prompt of promptsWithoutEntries) {
          await supabase.from("daily_prompts").delete().eq("id", prompt.id)
        }
      } else {
        // No entries - prefer non-Journal prompt if today is not Sunday
        if (!isTodaySunday) {
          const nonJournalPrompt = promptsWithoutEntries.find((p: any) => p.prompt?.category !== "Journal")
          if (nonJournalPrompt) {
            existing = nonJournalPrompt
            // Delete Journal prompts (invalid for non-Sunday)
            for (const prompt of promptsWithoutEntries) {
              if (prompt.prompt?.category === "Journal") {
                await supabase.from("daily_prompts").delete().eq("id", prompt.id)
              } else if (prompt.id !== nonJournalPrompt.id) {
                // Delete other non-Journal duplicates
                await supabase.from("daily_prompts").delete().eq("id", prompt.id)
              }
            }
          } else {
            // All are Journal prompts on non-Sunday - use first one but log warning
            existing = promptsWithoutEntries[0]
            // Delete duplicates
            for (let i = 1; i < promptsWithoutEntries.length; i++) {
              await supabase.from("daily_prompts").delete().eq("id", promptsWithoutEntries[i].id)
            }
          }
        } else {
          // Today is Sunday - prefer Journal prompt
          const journalPrompt = promptsWithoutEntries.find((p: any) => p.prompt?.category === "Journal")
          if (journalPrompt) {
            existing = journalPrompt
            // Delete non-Journal prompts (should be Journal on Sunday)
            for (const prompt of promptsWithoutEntries) {
              if (prompt.prompt?.category !== "Journal") {
                await supabase.from("daily_prompts").delete().eq("id", prompt.id)
              } else if (prompt.id !== journalPrompt.id) {
                // Delete duplicate Journal prompts
                await supabase.from("daily_prompts").delete().eq("id", prompt.id)
              }
            }
          } else {
            // No Journal prompt on Sunday - use first one
            existing = promptsWithoutEntries[0]
            // Delete duplicates
            for (let i = 1; i < promptsWithoutEntries.length; i++) {
              await supabase.from("daily_prompts").delete().eq("id", promptsWithoutEntries[i].id)
            }
          }
        }
      }
    } else {
      // Single prompt - use it
      existing = allPrompts[0]
    }
  }

  // If daily_prompts record exists but prompt join failed, fetch prompt directly
  if (existing && !existing.prompt && (existing as any).prompt_id) {
    const promptId = (existing as any).prompt_id
    const { data: directPrompt, error: directPromptError } = await supabase
      .from("prompts")
      .select("*")
      .eq("id", promptId)
      .maybeSingle()
    
    if (directPrompt && !directPromptError) {
      // Return existing daily_prompts with directly fetched prompt
      return {
        ...existing,
        prompt: directPrompt,
      }
    }
  }

  // CRITICAL: If a prompt exists, we MUST return it to ensure all members see the same prompt
  // This preserves consistency across all group members
  if (existing && existing.prompt) {
    const prompt = existing.prompt as any
    const promptId = (existing as any).prompt_id
    
    // CRITICAL FIX: Check if there are entries for THIS SPECIFIC PROMPT (not just any entries for the date/group)
    // This ensures we correctly identify if this prompt was answered or not
    // If another prompt was answered, this one should be deleted (if invalid)
    const { data: entriesForThisPrompt } = await supabase
      .from("entries")
      .select("id")
      .eq("group_id", groupId)
      .eq("date", date)
      .eq("prompt_id", promptId) // Check entries for THIS specific prompt
      .limit(1)
    
    const hasEntriesForThisPrompt = entriesForThisPrompt && entriesForThisPrompt.length > 0
    
    // CRITICAL FIX: Validate Journal prompts - they should ONLY appear on Sundays
    // If it's not Sunday and this prompt has no entries, delete it immediately
    // This ensures all members see the correct prompt
    if (prompt.category === "Journal" && !isSunday(date)) {
      if (!hasEntriesForThisPrompt) {
        // No entries exist for this Journal prompt - delete invalid Journal prompt
        console.warn(`[getDailyPrompt] Found invalid Journal prompt for non-Sunday date ${date} with no entries. Deleting invalid prompt (prompt_id: ${promptId}).`)
        await supabase
          .from("daily_prompts")
          .delete()
          .eq("id", existing.id)
        // Treat as if no prompt exists - fall through to regular prompt logic below
        existing = null
      } else {
        // Entries exist for this Journal prompt - keep it to preserve user data, but log warning
        console.warn(`[getDailyPrompt] Found invalid Journal prompt for non-Sunday date ${date} with entries. Keeping prompt to preserve user data, but this is incorrect.`)
        return existing
      }
    } else {
      // Valid prompt (not Journal, or Journal on Sunday) - return it
      // Note: We don't check for entries here because valid prompts should be returned regardless
      return existing
    }
  }

  // ========================================================================
  // SUNDAY JOURNAL CHECK
  // ========================================================================
  // On Sundays (in user's timezone) AND only for today or future dates, return the Journal prompt
  // CRITICAL: This now runs AFTER checking existing prompts, so it only applies when:
  // 1. No existing prompt exists, OR
  // 2. Existing prompt was invalid (e.g., Journal on non-Sunday) and was deleted above
  // This ensures we don't override existing valid prompts
  // Note: todayDate is already declared above
  if (isSunday(date) && date >= todayDate) {
    // Get the Journal prompt
    const { data: journalPrompt, error: journalError } = await supabase
      .from("prompts")
      .select("id, question, description, category, is_default, is_custom, custom_question_id, dynamic_variables, birthday_type, deck_id, ice_breaker, ice_breaker_order")
      .eq("category", "Journal")
      .limit(1)
      .maybeSingle()

    if (journalPrompt && !journalError) {
      // Check if a daily_prompt already exists for this date (might have been scheduled by schedule-daily-prompts)
      // CRITICAL: Re-check after potential deletion above
      const { data: existingJournalPrompt } = await supabase
        .from("daily_prompts")
        .select("id")
        .eq("group_id", groupId)
        .eq("date", date)
        .is("user_id", null)
        .maybeSingle()

      // If it doesn't exist, create it (for consistency)
      if (!existingJournalPrompt) {
        const { data: newJournalPrompt, error: insertError } = await supabase
          .from("daily_prompts")
          .insert({
            group_id: groupId,
            prompt_id: journalPrompt.id,
            date: date,
          })
          .select("id")
          .single()

        if (newJournalPrompt && !insertError) {
          // Return the newly created Journal prompt
          return {
            id: newJournalPrompt.id,
            group_id: groupId,
            prompt_id: journalPrompt.id,
            date: date,
            user_id: null,
            prompt: journalPrompt,
          }
        } else if (insertError && insertError.code === "23505") {
          // Duplicate key - another request created it, fetch it
          const { data: fetchedJournalPrompt } = await supabase
            .from("daily_prompts")
            .select("*, prompt:prompts(*)")
            .eq("group_id", groupId)
            .eq("date", date)
            .is("user_id", null)
            .maybeSingle()
          
          if (fetchedJournalPrompt && fetchedJournalPrompt.prompt) {
            return fetchedJournalPrompt
          }
        }
      } else {
        // Journal prompt already exists - fetch and return it
        const { data: fetchedJournalPrompt } = await supabase
          .from("daily_prompts")
          .select("*, prompt:prompts(*)")
          .eq("group_id", groupId)
          .eq("date", date)
          .is("user_id", null)
          .maybeSingle()
        
        if (fetchedJournalPrompt && fetchedJournalPrompt.prompt) {
          return fetchedJournalPrompt
        }
      }

      // Fallback: Return Journal prompt structure even if daily_prompts insert failed
      // This should rarely happen, but ensures users see the Journal prompt
      return {
        id: existingJournalPrompt?.id || `journal_${date}`,
        group_id: groupId,
        prompt_id: journalPrompt.id,
        date: date,
        user_id: null,
        prompt: journalPrompt,
      }
    }
  }

  // If no prompt exists (or Journal prompt was filtered out), check if this is a new group and create an ice breaker
  if (!existing || existingError || !existing.prompt) {
    // Check if group was created recently (within last 24 hours) or has no prompts at all
    const { data: group } = await supabase
      .from("groups")
      .select("created_at")
      .eq("id", groupId)
      .maybeSingle()
    
    // Check if group has any prompts at all
    const { data: anyPrompts } = await supabase
      .from("daily_prompts")
      .select("id")
      .eq("group_id", groupId)
      .limit(1)
    
    const isNewGroup = group && (!anyPrompts || anyPrompts.length === 0)
    const groupCreatedAt = group?.created_at ? new Date(group.created_at) : null
    const isRecentlyCreated = groupCreatedAt && (Date.now() - groupCreatedAt.getTime()) < 24 * 60 * 60 * 1000 // 24 hours
    
    // If this is a new group or recently created, create an ice breaker prompt
    if (isNewGroup || isRecentlyCreated) {
      console.log(`[getDailyPrompt] No prompt found for new/recent group ${groupId}, creating ice breaker...`)
      
      // Get the first ice breaker question (ice_breaker_order = 1)
      const { data: iceBreakerPrompt, error: iceBreakerError } = await supabase
        .from("prompts")
        .select("id, question, description, category, is_default, is_custom, custom_question_id, dynamic_variables, birthday_type, deck_id, ice_breaker, ice_breaker_order")
        .eq("ice_breaker", true)
        .eq("ice_breaker_order", 1)
        .maybeSingle()
      
      if (iceBreakerPrompt && !iceBreakerError) {
        // Try to insert the ice breaker question
        // Use upsert or handle duplicate key error gracefully
        const { data: newPrompt, error: insertError } = await supabase
          .from("daily_prompts")
          .insert({
            group_id: groupId,
            prompt_id: iceBreakerPrompt.id,
            date: date,
          })
          .select("*, prompt:prompts(*)")
          .single()
        
        // If insert failed due to duplicate key, fetch the existing prompt instead
        if (insertError && insertError.code === "23505") {
          console.log(`[getDailyPrompt] Prompt already exists (duplicate key), fetching existing...`)
          // Fetch the existing prompt that was just inserted (possibly by another concurrent call)
          const { data: existingPrompt } = await supabase
            .from("daily_prompts")
            .select("*, prompt:prompts(*)")
            .eq("group_id", groupId)
            .eq("date", date)
            .is("user_id", null)
            .maybeSingle()
          
          if (existingPrompt && existingPrompt.prompt) {
            console.log(`[getDailyPrompt] ✅ Fetched existing ice breaker prompt`)
            return existingPrompt
          }
        } else if (newPrompt && !insertError && newPrompt.prompt) {
          console.log(`[getDailyPrompt] ✅ Created ice breaker prompt for new group`)
          return {
            ...newPrompt,
            prompt: {
              ...iceBreakerPrompt,
              ...newPrompt.prompt,
            },
          }
        } else if (insertError) {
          console.error(`[getDailyPrompt] Failed to insert ice breaker prompt:`, insertError)
        }
      } else {
        console.warn(`[getDailyPrompt] Ice breaker question (order 1) not found:`, iceBreakerError)
      }
    }
    
    // CRITICAL: If no prompt exists for this date, return null
    // Prompts should be scheduled by schedule-daily-prompts function, not created on-the-fly
    // Creating prompts on-the-fly causes questions to change when navigating between dates
    console.warn(`[getDailyPrompt] No prompt scheduled for date ${date}, group ${groupId}. This should be scheduled by schedule-daily-prompts function.`)
    return null
  }

  if (existing && !existingError && existing.prompt) {
    // Check if this is a custom question
    const prompt = existing.prompt as any
    
    // SAFETY CHECK: If this is a "Remembering" prompt, verify the group has memorials
    // If not, return null so it can be rescheduled
    if (prompt.category === "Remembering") {
      const memorials = await getMemorials(groupId)
      if (memorials.length === 0) {
        // This shouldn't happen, but if it does, delete the prompt and return null
        console.warn(`[getDailyPrompt] Found Remembering prompt for group ${groupId} without memorials on ${date}. Deleting invalid prompt.`)
        await supabase
          .from("daily_prompts")
          .delete()
          .eq("id", existing.id)
        return null
      }
    }
    
    if (prompt.is_custom && prompt.custom_question_id) {
      // Fetch custom question details
      const { data: customQuestion } = await supabase
        .from("custom_questions")
        .select("*, user:users(id, name, avatar_url)")
        .eq("id", prompt.custom_question_id)
        .maybeSingle()

      if (customQuestion) {
        // Return prompt with custom question metadata
        return {
          ...existing,
          prompt: {
            ...prompt,
            customQuestion: customQuestion as any,
          },
        }
      }
    }
    // Personalize prompts with dynamic variables using usage tracking
    let personalizedQuestion = prompt.question
    const variables: Record<string, string> = {}

    // Check if prompt has member_name variable (either in dynamic_variables OR in question text)
    const hasMemberNameVariable = (prompt.dynamic_variables && Array.isArray(prompt.dynamic_variables) && prompt.dynamic_variables.includes("member_name")) || prompt.question?.match(/\{.*member_name.*\}/i)
    
    // Handle dynamic variables
    if (prompt.dynamic_variables && Array.isArray(prompt.dynamic_variables)) {
      // Handle memorial_name variable
      if (prompt.dynamic_variables.includes("memorial_name") && prompt.category === "Remembering") {
        const memorials = await getMemorials(groupId)
        if (memorials.length > 0) {
          // CRITICAL: FIRST check if this exact date/prompt already has a memorial selected
          // This prevents switching memorial names if getDailyPrompt is called multiple times
          const { data: existingUsage } = await supabase
            .from("prompt_name_usage")
            .select("name_used")
            .eq("group_id", groupId)
            .eq("prompt_id", prompt.id)
            .eq("variable_type", "memorial_name")
            .eq("date_used", date)
            .maybeSingle()

          if (existingUsage?.name_used) {
            // This date already has a memorial selected - use it EXACTLY as-is
            // This is the most important safeguard against name switching
            variables.memorial_name = existingUsage.name_used
            console.log(`[getDailyPrompt] Using existing memorial selection for ${date}: ${existingUsage.name_used}`)
          } else {
            // No existing selection for this date - calculate which memorial to use
            // CRITICAL: Check which memorial was used THIS WEEK (not just recently)
            // This ensures proper week-by-week rotation: Week 1 = Person A, Week 2 = Person B, etc.
            const weekStart = getWeekStartDate(date)
            // IMPORTANT: Check across ALL Remembering prompts, not just this specific prompt_id
            // This ensures proper rotation even when different Remembering prompts are scheduled
            const { data: thisWeekUsage } = await supabase
              .from("prompt_name_usage")
              .select("name_used, date_used")
              .eq("group_id", groupId)
              .eq("variable_type", "memorial_name")
              .gte("date_used", weekStart)
              .lte("date_used", date)
              .order("date_used", { ascending: false })
            
            // Also get the last memorial used in previous weeks (for rotation)
            // IMPORTANT: Check across ALL Remembering prompts, not just this specific prompt_id
            const { data: lastWeekUsage } = await supabase
              .from("prompt_name_usage")
              .select("name_used")
              .eq("group_id", groupId)
              .eq("variable_type", "memorial_name")
              .lt("date_used", weekStart) // Before this week
              .order("date_used", { ascending: false })
              .limit(1)
            
            // CRITICAL: If a memorial was already used this week, we MUST use a DIFFERENT one
            // This should never happen due to weekly limit, but if it does, ensure alternation
            // Check if memorial was used YESTERDAY (back-to-back prevention)
            const yesterday = new Date(date)
            yesterday.setDate(yesterday.getDate() - 1)
            const yesterdayStr = yesterday.toISOString().split("T")[0]
            
            const yesterdayUsage = thisWeekUsage?.find((u: any) => u.date_used === yesterdayStr)
            
            if (yesterdayUsage) {
              // Memorial was used yesterday - MUST use a different one to prevent back-to-back
              const yesterdayName = yesterdayUsage.name_used
              const usedNamesThisWeek = new Set(thisWeekUsage.map((u: any) => u.name_used))
              const availableMemorials = memorials.filter(m => m.name !== yesterdayName)
              
              if (availableMemorials.length > 0) {
                // Use a different memorial (prefer one not used this week)
                const unusedThisWeek = availableMemorials.filter(m => !usedNamesThisWeek.has(m.name))
                const selectedMemorialName = unusedThisWeek.length > 0 
                  ? unusedThisWeek[0].name 
                  : availableMemorials[0].name // Fallback to any different one
                variables.memorial_name = selectedMemorialName
                console.log(`[getDailyPrompt] Memorial used yesterday (${yesterdayName}), using different one: ${selectedMemorialName}`)
              } else {
                // Only one memorial - shouldn't happen, but use it
                variables.memorial_name = memorials[0].name
                console.log(`[getDailyPrompt] Only one memorial available, using: ${memorials[0].name}`)
              }
            } else if (thisWeekUsage && thisWeekUsage.length > 0) {
              // Memorial was used this week but not yesterday - use a different one
              const usedNamesSet = new Set(thisWeekUsage.map((u: any) => u.name_used))
              const availableMemorials = memorials.filter(m => !usedNamesSet.has(m.name))
              if (availableMemorials.length > 0) {
                variables.memorial_name = availableMemorials[0].name
                console.log(`[getDailyPrompt] Memorial already used this week, using different one: ${availableMemorials[0].name}`)
              } else {
                // All memorials were used this week - rotate from most recent
                const mostRecentName = thisWeekUsage[0].name_used
                const mostRecentIndex = memorials.findIndex(m => m.name === mostRecentName)
                const nextIndex = (mostRecentIndex + 1) % memorials.length
                variables.memorial_name = memorials[nextIndex].name
                console.log(`[getDailyPrompt] All memorials used this week, rotating to: ${memorials[nextIndex].name}`)
              }
            } else {
              // No memorial used this week - rotate to next person
              const selectedMemorialName = await selectNextMemorial(groupId, prompt.id, date, memorials)
              variables.memorial_name = selectedMemorialName
              console.log(`[getDailyPrompt] Rotating memorial to: ${selectedMemorialName}`)
            }
            
            // Record usage for this date (only if not already recorded)
            if (!existingUsage?.name_used) {
              
              // Record usage for this date (ignore errors if already exists - might be race condition)
              const { error: insertError } = await supabase.from("prompt_name_usage").insert({
                group_id: groupId,
                prompt_id: prompt.id,
                variable_type: "memorial_name",
                name_used: variables.memorial_name,
                date_used: date,
              })
              
              if (insertError) {
                // Log error for debugging, but don't throw (might be duplicate or RLS issue)
                // Check if it's a duplicate constraint violation (23505 is unique violation)
                if (insertError.code !== '23505') {
                  console.warn(`[getDailyPrompt] Failed to insert prompt_name_usage for ${prompt.id} on ${date}:`, insertError.message)
                } else {
                  // Duplicate - another call already inserted this. Re-fetch to get the correct name
                  const { data: duplicateUsage } = await supabase
                    .from("prompt_name_usage")
                    .select("name_used")
                    .eq("group_id", groupId)
                    .eq("prompt_id", prompt.id)
                    .eq("variable_type", "memorial_name")
                    .eq("date_used", date)
                    .maybeSingle()
                  
                  if (duplicateUsage?.name_used) {
                    // Use the name that was already inserted (prevents race condition issues)
                    variables.memorial_name = duplicateUsage.name_used
                    console.log(`[getDailyPrompt] Duplicate insert detected, using existing: ${duplicateUsage.name_used}`)
                  }
                }
              }
            }
            
            // Record usage for existing usage case too (if memorial was already used this week)
            if (thisWeekUsage && thisWeekUsage.length > 0) {
              // Ensure we have it recorded for this date
              const { error: insertError } = await supabase.from("prompt_name_usage").insert({
                group_id: groupId,
                prompt_id: prompt.id,
                variable_type: "memorial_name",
                name_used: variables.memorial_name,
                date_used: date,
              })
              
              if (insertError && insertError.code !== '23505') {
                console.warn(`[getDailyPrompt] Failed to insert prompt_name_usage for existing usage:`, insertError.message)
              }
            }
          }
        }
      }

      // Handle member_name variable (if in dynamic_variables)
      if (prompt.dynamic_variables.includes("member_name")) {
        if (prompt.birthday_type === "their_birthday" || prompt.category === "Birthday") {
          // For birthday prompts, get ALL birthday people's names and combine them
          // CRITICAL: FIRST check if this exact date/prompt already has a member name selected
          const { data: existingUsage } = await supabase
            .from("prompt_name_usage")
            .select("name_used")
            .eq("group_id", groupId)
            .eq("prompt_id", prompt.id)
            .eq("variable_type", "member_name")
            .eq("date_used", date)
            .maybeSingle()

          if (existingUsage?.name_used) {
            // This date already has a member name selected - use it EXACTLY as-is
            variables.member_name = existingUsage.name_used
            console.log(`[getDailyPrompt] Using existing member name selection for ${date}: ${existingUsage.name_used}`)
          } else {
            // Missing record - create it using birthday logic (same as new prompts)
            const { data: members } = await supabase
              .from("group_members")
              .select("user_id, user:users(id, name, birthday)")
              .eq("group_id", groupId)
            
            if (members) {
              const todayMonthDay = date.substring(5) // MM-DD
              const birthdayNames: string[] = []
              
              for (const member of members) {
                const user = member.user as any
                if (user?.birthday && user.birthday.substring(5) === todayMonthDay && user.name) {
                  birthdayNames.push(user.name)
                }
              }
              
              // Combine names: "Name1 and Name2" or just "Name1" if only one
              if (birthdayNames.length > 0) {
                if (birthdayNames.length === 1) {
                  variables.member_name = birthdayNames[0]
                } else {
                  variables.member_name = birthdayNames.join(" and ")
                }
                
                // Create the missing record (this fixes data inconsistency)
                const { error: insertError } = await supabase.from("prompt_name_usage").insert({
                  group_id: groupId,
                  prompt_id: prompt.id,
                  variable_type: "member_name",
                  name_used: variables.member_name,
                  date_used: date,
                })
                
                if (insertError) {
                  if (insertError.code !== '23505') {
                    console.warn(`[getDailyPrompt] Failed to insert prompt_name_usage for ${prompt.id} on ${date}:`, insertError.message)
                  } else {
                    // Duplicate - re-fetch to get the correct name
                    const { data: duplicateUsage } = await supabase
                      .from("prompt_name_usage")
                      .select("name_used")
                      .eq("group_id", groupId)
                      .eq("prompt_id", prompt.id)
                      .eq("variable_type", "member_name")
                      .eq("date_used", date)
                      .maybeSingle()
                    
                    if (duplicateUsage?.name_used) {
                      variables.member_name = duplicateUsage.name_used
                      console.log(`[getDailyPrompt] Duplicate insert detected, using existing: ${duplicateUsage.name_used}`)
                    }
                  }
                } else {
                  console.log(`[getDailyPrompt] Created missing prompt_name_usage record for birthday prompt ${prompt.id} on ${date}: ${variables.member_name}`)
                }
              } else {
                variables.member_name = "them"
              }
            }
          }
        } else {
          // For general prompts with member_name, cycle through all group members
          // CRITICAL: Exclude the current user from member_name selection
          // CRITICAL: FIRST check if this exact date/prompt already has a member name selected
          const { data: existingUsage } = await supabase
            .from("prompt_name_usage")
            .select("name_used")
            .eq("group_id", groupId)
            .eq("prompt_id", prompt.id)
            .eq("variable_type", "member_name")
            .eq("date_used", date)
            .maybeSingle()

          if (existingUsage?.name_used) {
            // This date already has a member name selected - use it EXACTLY as-is
            variables.member_name = existingUsage.name_used
            console.log(`[getDailyPrompt] Using existing member name selection for ${date}: ${existingUsage.name_used}`)
          } else {
            // Missing record - create it using the SAME deterministic logic as new prompts
            // This fixes data inconsistencies while ensuring consistency
            const members = await getGroupMembers(groupId)
            
            // Get current user ID to exclude them
            const { data: { user: currentUser } } = await supabase.auth.getUser()
            const currentUserId = currentUser?.id
            
            // Filter out current user from available members
            const otherMembers = members.filter((m) => m.user_id !== currentUserId)
            
            if (otherMembers.length > 0) {
              // Get recently used member names across ALL member_name prompts (excluding this date)
              const { data: recentUsage } = await supabase
                .from("prompt_name_usage")
                .select("name_used")
                .eq("group_id", groupId)
                .eq("variable_type", "member_name")
                .neq("date_used", date) // Exclude this date to avoid conflicts
                .order("date_used", { ascending: false })
                .limit(otherMembers.length)

              const usedNames = new Set(recentUsage?.map((u) => u.name_used) || [])
              
              // Find unused members first (filter by name, excluding current user)
              // CRITICAL: Sort members by user_id to ensure deterministic ordering (prevents race conditions)
              const sortedOtherMembers = [...otherMembers].sort((a, b) => 
                (a.user_id || "").localeCompare(b.user_id || "")
              )
              
              const unusedMembers = sortedOtherMembers.filter((m) => {
                const memberName = m.user?.name || "Unknown"
                return !usedNames.has(memberName)
              })
              
              // If all have been used, reset and start fresh (still excluding current user)
              const availableMembers = unusedMembers.length > 0 ? unusedMembers : sortedOtherMembers
              
              // Select next member using SAME deterministic logic as new prompts
              const dayIndex = getDayIndex(date, groupId)
              const memberIndex = dayIndex % availableMembers.length
              const selectedMember = availableMembers[memberIndex]
              
              variables.member_name = selectedMember.user?.name || "them"

              // Create the missing record (this fixes data inconsistency)
              const { error: insertError } = await supabase.from("prompt_name_usage").insert({
                group_id: groupId,
                prompt_id: prompt.id,
                variable_type: "member_name",
                name_used: variables.member_name,
                date_used: date,
              })
              
              if (insertError) {
                // Check if it's a duplicate constraint violation (23505 is unique violation)
                if (insertError.code !== '23505') {
                  console.warn(`[getDailyPrompt] Failed to insert prompt_name_usage for ${prompt.id} on ${date}:`, insertError.message)
                } else {
                  // Duplicate - another call already inserted this. Re-fetch to get the correct name
                  const { data: duplicateUsage } = await supabase
                    .from("prompt_name_usage")
                    .select("name_used")
                    .eq("group_id", groupId)
                    .eq("prompt_id", prompt.id)
                    .eq("variable_type", "member_name")
                    .eq("date_used", date)
                    .maybeSingle()
                  
                  if (duplicateUsage?.name_used) {
                    variables.member_name = duplicateUsage.name_used
                    console.log(`[getDailyPrompt] Duplicate insert detected, using existing: ${duplicateUsage.name_used}`)
                  }
                }
              } else {
                console.log(`[getDailyPrompt] Created missing prompt_name_usage record for ${prompt.id} on ${date}: ${variables.member_name}`)
              }
            } else {
              // No other members available
              variables.member_name = "them"
              console.warn(`[getDailyPrompt] No other members available for member_name replacement in group ${groupId}, using fallback "them"`)
            }
          }
        }
      }

      // Replace variables in question text
      if (Object.keys(variables).length > 0) {
        personalizedQuestion = replaceDynamicVariables(prompt.question, variables)
      }
    }
    
    // Handle member_name variable if it's in question text but NOT in dynamic_variables
    // This handles prompts that have {member_name} in the question but don't have dynamic_variables set
    if (hasMemberNameVariable && (!prompt.dynamic_variables || !Array.isArray(prompt.dynamic_variables) || !prompt.dynamic_variables.includes("member_name"))) {
      if (prompt.birthday_type === "their_birthday" || prompt.category === "Birthday") {
        // For birthday prompts, get ALL birthday people's names and combine them
        const { data: existingUsage } = await supabase
          .from("prompt_name_usage")
          .select("name_used")
          .eq("group_id", groupId)
          .eq("prompt_id", prompt.id)
          .eq("variable_type", "member_name")
          .eq("date_used", date)
          .maybeSingle()

        if (existingUsage?.name_used) {
          variables.member_name = existingUsage.name_used
          console.log(`[getDailyPrompt] Using existing member name selection for ${date}: ${existingUsage.name_used}`)
        } else {
          // Missing record - create it using birthday logic
          const { data: members } = await supabase
            .from("group_members")
            .select("user_id, user:users(id, name, birthday)")
            .eq("group_id", groupId)
          
          if (members) {
            const todayMonthDay = date.substring(5) // MM-DD
            const birthdayNames: string[] = []
            
            for (const member of members) {
              const user = member.user as any
              if (user?.birthday && user.birthday.substring(5) === todayMonthDay && user.name) {
                birthdayNames.push(user.name)
              }
            }
            
            if (birthdayNames.length > 0) {
              variables.member_name = birthdayNames.length === 1 ? birthdayNames[0] : birthdayNames.join(" and ")
              
              const { error: insertError } = await supabase.from("prompt_name_usage").insert({
                group_id: groupId,
                prompt_id: prompt.id,
                variable_type: "member_name",
                name_used: variables.member_name,
                date_used: date,
              })
              
              if (insertError && insertError.code !== '23505') {
                console.warn(`[getDailyPrompt] Failed to insert prompt_name_usage for ${prompt.id} on ${date}:`, insertError.message)
              } else if (insertError?.code === '23505') {
                const { data: duplicateUsage } = await supabase
                  .from("prompt_name_usage")
                  .select("name_used")
                  .eq("group_id", groupId)
                  .eq("prompt_id", prompt.id)
                  .eq("variable_type", "member_name")
                  .eq("date_used", date)
                  .maybeSingle()
                
                if (duplicateUsage?.name_used) {
                  variables.member_name = duplicateUsage.name_used
                }
              }
            } else {
              variables.member_name = "them"
            }
          }
        }
      } else {
        // For general prompts with member_name, cycle through all group members
        const { data: existingUsage } = await supabase
          .from("prompt_name_usage")
          .select("name_used")
          .eq("group_id", groupId)
          .eq("prompt_id", prompt.id)
          .eq("variable_type", "member_name")
          .eq("date_used", date)
          .maybeSingle()

        if (existingUsage?.name_used) {
          variables.member_name = existingUsage.name_used
          console.log(`[getDailyPrompt] Using existing member name selection for ${date}: ${existingUsage.name_used}`)
        } else {
          // Missing record - create it using the SAME deterministic logic as new prompts
          const members = await getGroupMembers(groupId)
          
          const { data: { user: currentUser } } = await supabase.auth.getUser()
          const currentUserId = currentUser?.id
          
          const otherMembers = members.filter((m) => m.user_id !== currentUserId)
          
          if (otherMembers.length > 0) {
            // CRITICAL: Sort members by user_id to ensure deterministic ordering (prevents race conditions)
            const sortedOtherMembers = [...otherMembers].sort((a, b) => 
              (a.user_id || "").localeCompare(b.user_id || "")
            )
            
            const { data: recentUsage } = await supabase
              .from("prompt_name_usage")
              .select("name_used")
              .eq("group_id", groupId)
              .eq("variable_type", "member_name")
              .neq("date_used", date)
              .order("date_used", { ascending: false })
              .limit(sortedOtherMembers.length)

            const usedNames = new Set(recentUsage?.map((u) => u.name_used) || [])
            
            const unusedMembers = sortedOtherMembers.filter((m) => {
              const memberName = m.user?.name || "Unknown"
              return !usedNames.has(memberName)
            })
            
            const availableMembers = unusedMembers.length > 0 ? unusedMembers : sortedOtherMembers
            
            const dayIndex = getDayIndex(date, groupId)
            const memberIndex = dayIndex % availableMembers.length
            const selectedMember = availableMembers[memberIndex]
            
            variables.member_name = selectedMember.user?.name || "them"

            const { error: insertError } = await supabase.from("prompt_name_usage").insert({
              group_id: groupId,
              prompt_id: prompt.id,
              variable_type: "member_name",
              name_used: variables.member_name,
              date_used: date,
            })
            
            if (insertError && insertError.code !== '23505') {
              console.warn(`[getDailyPrompt] Failed to insert prompt_name_usage for ${prompt.id} on ${date}:`, insertError.message)
            } else if (insertError?.code === '23505') {
              const { data: duplicateUsage } = await supabase
                .from("prompt_name_usage")
                .select("name_used")
                .eq("group_id", groupId)
                .eq("prompt_id", prompt.id)
                .eq("variable_type", "member_name")
                .eq("date_used", date)
                .maybeSingle()
              
              if (duplicateUsage?.name_used) {
                variables.member_name = duplicateUsage.name_used
              }
            } else {
              console.log(`[getDailyPrompt] Created missing prompt_name_usage record for ${prompt.id} on ${date}: ${variables.member_name}`)
            }
          } else {
            variables.member_name = "them"
          }
        }
      }
      
      // Replace variables in question text
      if (variables.member_name) {
        personalizedQuestion = replaceDynamicVariables(prompt.question, variables)
      }
    } else if (prompt.category === "Remembering") {
      // Legacy support: if no dynamic_variables but category is Remembering, use old logic
      const memorials = await getMemorials(groupId)
      if (memorials.length > 0) {
        // CRITICAL: FIRST check if this exact date/prompt already has a memorial selected
        const { data: existingUsage } = await supabase
          .from("prompt_name_usage")
          .select("name_used")
          .eq("group_id", groupId)
          .eq("prompt_id", prompt.id)
          .eq("variable_type", "memorial_name")
          .eq("date_used", date)
          .maybeSingle()

        if (existingUsage?.name_used) {
          // This date already has a memorial selected - use it EXACTLY as-is
          personalizedQuestion = personalizeMemorialPrompt(prompt.question, existingUsage.name_used)
        } else {
          // No existing selection for this date - calculate which memorial to use (week-based rotation)
          const selectedMemorialName = await selectNextMemorial(groupId, prompt.id, date, memorials)
          personalizedQuestion = personalizeMemorialPrompt(prompt.question, selectedMemorialName)

          // Record usage for this date (ignore errors if already exists - might be race condition)
          const { error: insertError } = await supabase.from("prompt_name_usage").insert({
            group_id: groupId,
            prompt_id: prompt.id,
            variable_type: "memorial_name",
            name_used: selectedMemorialName,
            date_used: date,
          })
          
          if (insertError) {
            // Check if it's a duplicate constraint violation (23505 is unique violation)
            if (insertError.code !== '23505') {
              console.warn(`[getDailyPrompt] Failed to insert prompt_name_usage for ${prompt.id} on ${date}:`, insertError.message)
            } else {
              // Duplicate - another call already inserted this. Re-fetch to get the correct name
              const { data: duplicateUsage } = await supabase
                .from("prompt_name_usage")
                .select("name_used")
                .eq("group_id", groupId)
                .eq("prompt_id", prompt.id)
                .eq("variable_type", "memorial_name")
                .eq("date_used", date)
                .maybeSingle()
              
              if (duplicateUsage?.name_used) {
                personalizedQuestion = personalizeMemorialPrompt(prompt.question, duplicateUsage.name_used)
                console.log(`[getDailyPrompt] Duplicate insert detected, using existing: ${duplicateUsage.name_used}`)
              }
            }
          }
        }
      }
    }

    if (personalizedQuestion !== prompt.question) {
      return {
        ...existing,
        prompt: {
          ...prompt,
          question: personalizedQuestion,
        },
      }
    }
    return existing
  }

  // If no existing prompt, select one using queue-first approach
  if (existingError && existingError.code === "PGRST116") {
    // Check if group has memorials early - needed for filtering and personalization
    const memorials = await getMemorials(groupId)
    const hasMemorials = memorials.length > 0
    
    // Get group type early for filtering
    const group = await getGroup(groupId)
    
    let selectedPrompt: Prompt | null = null

    // Step 1: Check queue first (group-specific queue)
    const { data: queuedItem } = await supabase
      .from("group_prompt_queue")
      .select("prompt_id, prompt:prompts(*)")
      .eq("group_id", groupId)
      .order("position", { ascending: true })
      .limit(1)
      .single()

    if (queuedItem && queuedItem.prompt) {
      const queuedPrompt = queuedItem.prompt as Prompt
      
      // Get member count to filter {member_name} questions
      const members = await getGroupMembers(groupId)
      const memberCount = members.length
      
      // Filter out "Remembering" category if no memorials
      if (queuedPrompt.category === "Remembering" && !hasMemorials) {
        // Skip this queued prompt if it's Remembering and group has no memorials
        // Continue to Step 2 to find another prompt
      } else if (group?.type === "family" && queuedPrompt.category === "Friends") {
        // Skip Friends category prompts for Family groups
      } else if (group?.type === "friends" && queuedPrompt.category === "Family") {
        // Skip Family category prompts for Friends groups
      } else if (queuedPrompt.dynamic_variables && Array.isArray(queuedPrompt.dynamic_variables) && queuedPrompt.dynamic_variables.includes("member_name")) {
        // Skip {member_name} questions unless group has 3+ members
        if (memberCount < 3) {
          // Skip this queued prompt, continue to Step 2
        } else {
          selectedPrompt = queuedPrompt
          // Remove from queue after selection
          await supabase
            .from("group_prompt_queue")
            .delete()
            .eq("group_id", groupId)
            .eq("prompt_id", queuedItem.prompt_id)
        }
      } else {
        selectedPrompt = queuedPrompt
        // Remove from queue after selection
        await supabase
          .from("group_prompt_queue")
          .delete()
          .eq("group_id", groupId)
          .eq("prompt_id", queuedItem.prompt_id)
      }
    }

    // Step 2: If no queue item, get prompts that haven't been used for this group
    if (!selectedPrompt) {
      // Get all prompts used for this group
      const { data: usedPrompts } = await supabase
        .from("daily_prompts")
        .select("prompt_id")
        .eq("group_id", groupId)

      const usedPromptIds = usedPrompts?.map((p) => p.prompt_id) || []

      // Get preferences and group type
      const preferences = await getQuestionCategoryPreferences(groupId)
      const disabledCategories = new Set(preferences.filter((p) => p.preference === "none").map((p) => p.category))

      // Filter prompts by group type (group already fetched above)
      if (group?.type === "family") {
        disabledCategories.add("Edgy/NSFW")
        disabledCategories.add("Friends") // Exclude Friends category for Family groups
      } else if (group?.type === "friends") {
        disabledCategories.add("Family") // Exclude Family category for Friends groups
      }

      // Filter out "Remembering" category if no memorials
      if (!hasMemorials) {
        disabledCategories.add("Remembering")
      }

      // Get member count to filter {member_name} questions
      const members = await getGroupMembers(groupId)
      const memberCount = members.length

      // Get all prompts, excluding used ones and {member_name} questions if < 3 members
      let availablePrompts: Prompt[] = []
      
      if (usedPromptIds.length > 0) {
        // Get all prompts and filter out used ones in JavaScript
        const { data: allPromptsData, error: promptsError } = await supabase
          .from("prompts")
          .select("*")
        
        if (promptsError) throw promptsError
        availablePrompts = (allPromptsData || []).filter((p) => {
          // Exclude used prompts
          if (usedPromptIds.includes(p.id)) return false
          
          // Exclude {member_name} questions unless group has 3+ members
          if (p.dynamic_variables && Array.isArray(p.dynamic_variables) && p.dynamic_variables.includes("member_name")) {
            if (memberCount < 3) return false
          }
          
          return true
        })
      } else {
        // No used prompts yet, get all
        const { data: allPromptsData, error: promptsError } = await supabase
          .from("prompts")
          .select("*")
        
        if (promptsError) throw promptsError
        
        // Filter out {member_name} questions unless group has 3+ members
        availablePrompts = (allPromptsData || []).filter((p) => {
          if (p.dynamic_variables && Array.isArray(p.dynamic_variables) && p.dynamic_variables.includes("member_name")) {
            return memberCount >= 3
          }
          return true
        })
      }

      if (!availablePrompts || availablePrompts.length === 0) {
        // If all prompts have been used, reset and use all prompts again
        const { data: allPromptsRaw, error: allPromptsError } = await supabase
          .from("prompts")
          .select("*")

        if (allPromptsError) throw allPromptsError
        if (!allPromptsRaw || allPromptsRaw.length === 0) {
          return null
        }

        // Filter out disabled categories
        const allPrompts = disabledCategories.size > 0 
          ? allPromptsRaw.filter((p) => !disabledCategories.has(p.category))
          : allPromptsRaw

        if (allPrompts.length === 0) {
          return null
        }

        // Apply weighted selection based on preferences
        const weightedPrompts: Array<{ prompt: Prompt; weight: number }> = allPrompts.map((prompt) => {
          const pref = preferences.find((p) => p.category === prompt.category)
          const weight = pref?.weight ?? 1.0
          return { prompt, weight }
        })

        // Create selection pool with weighted prompts
        const selectionPool: Prompt[] = []
        weightedPrompts.forEach(({ prompt, weight }) => {
          const count = Math.ceil(weight)
          for (let i = 0; i < count; i++) {
            selectionPool.push(prompt)
          }
        })

        // Select prompt based on day index (group-specific)
        const dayIndex = getDayIndex(date, groupId)
        selectedPrompt = selectionPool[dayIndex % selectionPool.length]
      } else {
        // Filter out disabled categories from available prompts
        const filteredPrompts = disabledCategories.size > 0 
          ? availablePrompts.filter((p) => !disabledCategories.has(p.category))
          : availablePrompts

        if (filteredPrompts.length === 0) {
          return null
        }

        // Apply weighted selection based on preferences
        const weightedPrompts: Array<{ prompt: Prompt; weight: number }> = filteredPrompts.map((prompt) => {
          const pref = preferences.find((p) => p.category === prompt.category)
          const weight = pref?.weight ?? 1.0
          return { prompt, weight }
        })

        // Create selection pool with weighted prompts
        const selectionPool: Prompt[] = []
        weightedPrompts.forEach(({ prompt, weight }) => {
          const count = Math.ceil(weight)
          for (let i = 0; i < count; i++) {
            selectionPool.push(prompt)
          }
        })

        // Select prompt based on day index (group-specific)
        const dayIndex = getDayIndex(date, groupId)
        selectedPrompt = selectionPool[dayIndex % selectionPool.length]
      }
    }

    if (!selectedPrompt) {
      return null
    }

    // Personalize prompts with dynamic variables before saving
    let personalizedPrompt = selectedPrompt
    const prompt = selectedPrompt as any

    // Handle dynamic variables
    if (prompt.dynamic_variables && Array.isArray(prompt.dynamic_variables)) {
      const variables: Record<string, string> = {}

      // Handle memorial_name variable
      if (prompt.dynamic_variables.includes("memorial_name") && prompt.category === "Remembering" && memorials.length > 0) {
        // CRITICAL: FIRST check if this exact date/prompt already has a memorial selected
        const { data: existingUsage } = await supabase
          .from("prompt_name_usage")
          .select("name_used")
          .eq("group_id", groupId)
          .eq("prompt_id", prompt.id)
          .eq("variable_type", "memorial_name")
          .eq("date_used", date)
          .maybeSingle()

        if (existingUsage?.name_used) {
          // This date already has a memorial selected - use it EXACTLY as-is
          variables.memorial_name = existingUsage.name_used
        } else {
          // No existing selection for this date - calculate which memorial to use (week-based rotation)
          const selectedMemorialName = await selectNextMemorial(groupId, prompt.id, date, memorials)
          variables.memorial_name = selectedMemorialName

          // Record usage for this date (ignore errors if already exists - might be race condition)
          const { error: insertError } = await supabase.from("prompt_name_usage").insert({
            group_id: groupId,
            prompt_id: prompt.id,
            variable_type: "memorial_name",
            name_used: selectedMemorialName,
            date_used: date,
          })
          
          if (insertError) {
            // Check if it's a duplicate constraint violation (23505 is unique violation)
            if (insertError.code !== '23505') {
              console.warn(`[getDailyPrompt] Failed to insert prompt_name_usage for ${prompt.id} on ${date}:`, insertError.message)
            } else {
              // Duplicate - another call already inserted this. Re-fetch to get the correct name
              const { data: duplicateUsage } = await supabase
                .from("prompt_name_usage")
                .select("name_used")
                .eq("group_id", groupId)
                .eq("prompt_id", prompt.id)
                .eq("variable_type", "memorial_name")
                .eq("date_used", date)
                .maybeSingle()
              
              if (duplicateUsage?.name_used) {
                variables.memorial_name = duplicateUsage.name_used
                console.log(`[getDailyPrompt] Duplicate insert detected, using existing: ${duplicateUsage.name_used}`)
              }
            }
          }
        }
      }

      // Handle member_name variable
      // Check if prompt has dynamic_variables OR question contains {member_name} pattern
      const hasMemberNameVariable = (prompt.dynamic_variables && Array.isArray(prompt.dynamic_variables) && prompt.dynamic_variables.includes("member_name")) || prompt.question?.match(/\{.*member_name.*\}/i)
      if (hasMemberNameVariable) {
        // CRITICAL: FIRST check if this exact date/prompt already has a member name selected
        const { data: existingUsage } = await supabase
          .from("prompt_name_usage")
          .select("name_used")
          .eq("group_id", groupId)
          .eq("prompt_id", prompt.id)
          .eq("variable_type", "member_name")
          .eq("date_used", date)
          .maybeSingle()

        if (existingUsage?.name_used) {
          // This date already has a member name selected - use it EXACTLY as-is
          variables.member_name = existingUsage.name_used
          console.log(`[getDailyPrompt] Using existing member name selection for ${date}: ${existingUsage.name_used}`)
        } else {
          // No existing selection for this date - calculate which member to use
          if (prompt.birthday_type === "their_birthday") {
            // For birthday prompts, get the birthday person's name
            const { data: members } = await supabase
              .from("group_members")
              .select("user_id, user:users(id, name, birthday)")
              .eq("group_id", groupId)
            
            if (members) {
              const todayMonthDay = date.substring(5) // MM-DD
              for (const member of members) {
                const user = member.user as any
                if (user?.birthday && user.birthday.substring(5) === todayMonthDay) {
                  variables.member_name = user.name || "them"
                  
                  // Record usage for this date (ignore errors if already exists - might be race condition)
                  const { error: insertError } = await supabase.from("prompt_name_usage").insert({
                    group_id: groupId,
                    prompt_id: prompt.id,
                    variable_type: "member_name",
                    name_used: variables.member_name,
                    date_used: date,
                  })
                  
                  if (insertError) {
                    // Check if it's a duplicate constraint violation (23505 is unique violation)
                    if (insertError.code !== '23505') {
                      console.warn(`[getDailyPrompt] Failed to insert prompt_name_usage for ${prompt.id} on ${date}:`, insertError.message)
                    } else {
                      // Duplicate - another call already inserted this. Re-fetch to get the correct name
                      const { data: duplicateUsage } = await supabase
                        .from("prompt_name_usage")
                        .select("name_used")
                        .eq("group_id", groupId)
                        .eq("prompt_id", prompt.id)
                        .eq("variable_type", "member_name")
                        .eq("date_used", date)
                        .maybeSingle()
                      
                      if (duplicateUsage?.name_used) {
                        variables.member_name = duplicateUsage.name_used
                        console.log(`[getDailyPrompt] Duplicate insert detected, using existing: ${duplicateUsage.name_used}`)
                      }
                    }
                  }
                  break
                }
              }
            }
          } else {
            // For general prompts with member_name, cycle through all group members
            // CRITICAL: Exclude the current user from member_name selection
            const members = await getGroupMembers(groupId)
            
            // Get current user ID to exclude them
            const { data: { user: currentUser } } = await supabase.auth.getUser()
            const currentUserId = currentUser?.id || userId // Fallback to userId parameter if auth fails
            
            // Filter out current user from available members
            const otherMembers = members.filter((m) => m.user_id !== currentUserId)
            
            if (otherMembers.length > 0) {
              // CRITICAL: Sort members by user_id to ensure deterministic ordering (prevents race conditions)
              const sortedOtherMembers = [...otherMembers].sort((a, b) => 
                (a.user_id || "").localeCompare(b.user_id || "")
              )
              
              // Get recently used member names across ALL member_name prompts (excluding this date)
              // This ensures fair rotation across all prompts, not just this specific one
              const { data: recentUsage } = await supabase
                .from("prompt_name_usage")
                .select("name_used")
                .eq("group_id", groupId)
                .eq("variable_type", "member_name")
                .neq("date_used", date) // Exclude this date to avoid conflicts
                .order("date_used", { ascending: false })
                .limit(sortedOtherMembers.length)

              const usedNames = new Set(recentUsage?.map((u) => u.name_used) || [])
              
              // Find unused members first (filter by name, excluding current user)
              const unusedMembers = sortedOtherMembers.filter((m) => {
                const memberName = m.user?.name || "Unknown"
                return !usedNames.has(memberName)
              })
              
              // If all have been used, reset and start fresh (still excluding current user)
              const availableMembers = unusedMembers.length > 0 ? unusedMembers : sortedOtherMembers
              
              // Select next member (cycle through)
            const dayIndex = getDayIndex(date, groupId)
            const memberIndex = dayIndex % availableMembers.length
            const selectedMember = availableMembers[memberIndex]
            
            variables.member_name = selectedMember.user?.name || "them"

            // Record usage for this date (ignore errors if already exists - might be race condition)
            const { error: insertError } = await supabase.from("prompt_name_usage").insert({
              group_id: groupId,
              prompt_id: prompt.id,
              variable_type: "member_name",
              name_used: variables.member_name,
              date_used: date,
            })
            
            if (insertError) {
              // Check if it's a duplicate constraint violation (23505 is unique violation)
              if (insertError.code !== '23505') {
                console.warn(`[getDailyPrompt] Failed to insert prompt_name_usage for ${prompt.id} on ${date}:`, insertError.message)
              } else {
                // Duplicate - another call already inserted this. Re-fetch to get the correct name
                const { data: duplicateUsage } = await supabase
                  .from("prompt_name_usage")
                  .select("name_used")
                  .eq("group_id", groupId)
                  .eq("prompt_id", prompt.id)
                  .eq("variable_type", "member_name")
                  .eq("date_used", date)
                  .maybeSingle()
                
                if (duplicateUsage?.name_used) {
                  variables.member_name = duplicateUsage.name_used
                  console.log(`[getDailyPrompt] Duplicate insert detected, using existing: ${duplicateUsage.name_used}`)
                }
              }
            }
          } else {
            // No members available - use fallback
            variables.member_name = "them"
            console.warn(`[getDailyPrompt] No members available for member_name replacement in group ${groupId}, using fallback "them"`)
          }
        }
        }
      }

      // Replace variables in question text
      if (Object.keys(variables).length > 0) {
        const personalizedQuestion = replaceDynamicVariables(prompt.question, variables)
        personalizedPrompt = {
          ...prompt,
          question: personalizedQuestion,
        }
      }
    } else if (prompt.category === "Remembering" && memorials.length > 0) {
      // Legacy support: if no dynamic_variables but category is Remembering
      // CRITICAL: FIRST check if this exact date/prompt already has a memorial selected
      const { data: existingUsage } = await supabase
        .from("prompt_name_usage")
        .select("name_used")
        .eq("group_id", groupId)
        .eq("prompt_id", prompt.id)
        .eq("variable_type", "memorial_name")
        .eq("date_used", date)
        .maybeSingle()

      if (existingUsage?.name_used) {
        // This date already has a memorial selected - use it EXACTLY as-is
        const personalizedQuestion = personalizeMemorialPrompt(prompt.question, existingUsage.name_used)
        personalizedPrompt = {
          ...prompt,
          question: personalizedQuestion,
        }
      } else {
        // No existing selection for this date - calculate which memorial to use (week-based rotation)
        const selectedMemorialName = await selectNextMemorial(groupId, prompt.id, date, memorials)
        const personalizedQuestion = personalizeMemorialPrompt(prompt.question, selectedMemorialName)
        personalizedPrompt = {
          ...prompt,
          question: personalizedQuestion,
        }

        // Record usage for this date (ignore errors if already exists - might be race condition)
        const { error: insertError } = await supabase.from("prompt_name_usage").insert({
          group_id: groupId,
          prompt_id: prompt.id,
          variable_type: "memorial_name",
          name_used: selectedMemorialName,
          date_used: date,
        })
        
        if (insertError) {
          // Check if it's a duplicate constraint violation (23505 is unique violation)
          if (insertError.code !== '23505') {
            console.warn(`[getDailyPrompt] Failed to insert prompt_name_usage for ${prompt.id} on ${date}:`, insertError.message)
          } else {
            // Duplicate - another call already inserted this. Re-fetch to get the correct name
            const { data: duplicateUsage } = await supabase
              .from("prompt_name_usage")
              .select("name_used")
              .eq("group_id", groupId)
              .eq("prompt_id", prompt.id)
              .eq("variable_type", "memorial_name")
              .eq("date_used", date)
              .maybeSingle()
            
            if (duplicateUsage?.name_used) {
              const personalizedQuestion = personalizeMemorialPrompt(prompt.question, duplicateUsage.name_used)
              personalizedPrompt = {
                ...prompt,
                question: personalizedQuestion,
              }
              console.log(`[getDailyPrompt] Duplicate insert detected, using existing: ${duplicateUsage.name_used}`)
            }
          }
        }
      }
    }

    // Assign prompt for this date
    const { data: dailyPrompt, error: insertError } = await supabase
      .from("daily_prompts")
      .insert({
        group_id: groupId,
        prompt_id: selectedPrompt.id, // Store original prompt ID
        date,
      })
      .select("*, prompt:prompts(*)")
      .single()

    if (insertError) throw insertError
    
    // Return with personalized question if it's a Remembering prompt
    if (personalizedPrompt !== selectedPrompt) {
      return {
        ...dailyPrompt,
        prompt: personalizedPrompt,
      }
    }
    
    return dailyPrompt
  }

  return existing || null
}

// Queue management functions
export async function addPromptToQueue(groupId: string, promptId: string, userId: string): Promise<void> {
  // Get current max position
  const { data: queueItems } = await supabase
    .from("group_prompt_queue")
    .select("position")
    .eq("group_id", groupId)
    .order("position", { ascending: false })
    .limit(1)

  const nextPosition = queueItems && queueItems.length > 0 ? queueItems[0].position + 1 : 1

  const { error } = await supabase.from("group_prompt_queue").insert({
    group_id: groupId,
    prompt_id: promptId,
    added_by: userId,
    position: nextPosition,
  })

  if (error) throw error
}

export async function getGroupQueue(groupId: string) {
  const { data, error } = await supabase
    .from("group_prompt_queue")
    .select("*, prompt:prompts(*)")
    .eq("group_id", groupId)
    .order("position", { ascending: true })

  if (error) throw error
  return data || []
}

// Entry queries
export async function getEntriesForDate(groupId: string, date: string): Promise<Entry[]> {
  const { data, error } = await supabase
    .from("entries")
    .select("*, user:users(*), prompt:prompts(*)")
    .eq("group_id", groupId)
    .eq("date", date)
    .order("created_at", { ascending: false })

  if (error) throw error
  return data || []
}

export async function getAllEntriesForGroup(groupId: string): Promise<Entry[]> {
  const { data, error } = await supabase
    .from("entries")
    .select("*, user:users(*), prompt:prompts(*)")
    .eq("group_id", groupId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) throw error
  return data || []
}

export async function getUserEntryForDate(groupId: string, userId: string, date: string): Promise<Entry | null> {
  const { data, error } = await supabase
    .from("entries")
    .select("*, user:users(*), prompt:prompts(*)")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .eq("date", date)
    .single()

  if (error && error.code !== "PGRST116") throw error
  return data
}

export async function createEntry(entry: {
  group_id: string
  user_id: string
  prompt_id: string
  date: string
  text_content?: string
  media_urls?: string[]
  media_types?: ("photo" | "video" | "audio")[]
  captions?: (string | null)[] // Array of captions parallel to media_urls. NULL indicates no caption.
  embedded_media?: any[] // JSONB array
  mentions?: string[] // Array of user IDs mentioned in the entry
}): Promise<Entry> {
  const { data, error } = await supabase
    .from("entries")
    .insert(entry)
    .select("*, user:users(*), prompt:prompts(*)")
    .single()

  if (error) throw error

  // Store songs in user_songs and group_songs for personalization
  if (entry.embedded_media && entry.embedded_media.length > 0) {
    const songPromises = entry.embedded_media.map(async (embed) => {
      // Upsert to user_songs
      await supabase
        .from("user_songs")
        .upsert(
          {
            user_id: entry.user_id,
            platform: embed.platform,
            url: embed.url,
            embed_id: embed.embedId,
            embed_type: embed.embedType,
          },
          { onConflict: "user_id,platform,embed_id" }
        )
        .select()

      // Upsert to group_songs
      await supabase
        .from("group_songs")
        .upsert(
          {
            group_id: entry.group_id,
            user_id: entry.user_id,
            platform: embed.platform,
            url: embed.url,
            embed_id: embed.embedId,
            embed_type: embed.embedType,
          },
          { onConflict: "group_id,platform,embed_id" }
        )
        .select()
    })

    // Don't await - fire and forget for performance
    Promise.all(songPromises).catch((err) => {
      console.warn("[createEntry] Failed to store songs:", err)
    })
  }

  return data
}

export async function updateEntry(
  entryId: string,
  userId: string, // For validation
  updates: {
    text_content?: string
    media_urls?: string[]
    media_types?: ("photo" | "video" | "audio")[]
    captions?: (string | null)[] // Array of captions parallel to media_urls. NULL indicates no caption.
    embedded_media?: any[] // JSONB array
    mentions?: string[] // Array of user IDs mentioned in the entry
  }
): Promise<Entry> {
  // First, verify the entry exists and belongs to the user
  const { data: existingEntry, error: fetchError } = await supabase
    .from("entries")
    .select("*, user:users(*), prompt:prompts(*)")
    .eq("id", entryId)
    .eq("user_id", userId)
    .single()

  if (fetchError || !existingEntry) {
    throw new Error("Entry not found or you don't have permission to edit it")
  }

  // Update the entry
  const { data, error } = await supabase
    .from("entries")
    .update(updates)
    .eq("id", entryId)
    .eq("user_id", userId) // Double-check ownership
    .select("*, user:users(*), prompt:prompts(*)")
    .single()

  if (error) throw error

  // Update songs in user_songs and group_songs if embedded_media changed
  if (updates.embedded_media && updates.embedded_media.length > 0) {
    const songPromises = updates.embedded_media.map(async (embed) => {
      // Upsert to user_songs
      await supabase
        .from("user_songs")
        .upsert(
          {
            user_id: userId,
            platform: embed.platform,
            url: embed.url,
            embed_id: embed.embedId,
            embed_type: embed.embedType,
          },
          { onConflict: "user_id,platform,embed_id" }
        )
        .select()

      // Upsert to group_songs
      await supabase
        .from("group_songs")
        .upsert(
          {
            group_id: existingEntry.group_id,
            user_id: userId,
            platform: embed.platform,
            url: embed.url,
            embed_id: embed.embedId,
            embed_type: embed.embedType,
          },
          { onConflict: "group_id,platform,embed_id" }
        )
        .select()
    })

    // Don't await - fire and forget for performance
    Promise.all(songPromises).catch((err) => {
      console.warn("[updateEntry] Failed to store songs:", err)
    })
  }

  return data
}

// History query functions
export async function getEntriesByDateRange(groupId: string, startDate: string, endDate: string): Promise<Entry[]> {
  const { data, error } = await supabase
    .from("entries")
    .select("*, user:users(*), prompt:prompts(*)")
    .eq("group_id", groupId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) throw error
  return data || []
}

export async function getEntryById(entryId: string): Promise<Entry | null> {
  const { data, error } = await supabase
    .from("entries")
    .select("*, user:users(*), prompt:prompts(*)")
    .eq("id", entryId)
    .single()

  if (error && error.code !== "PGRST116") throw error
  return data
}

// Get daily prompts for a group from the past 7 days
export async function getGroupPromptsPast7Days(groupId: string): Promise<DailyPrompt[]> {
  const today = new Date().toISOString().split("T")[0]
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  
  const { data, error } = await supabase
    .from("daily_prompts")
    .select("*, prompt:prompts(*)")
    .eq("group_id", groupId)
    .gte("date", sevenDaysAgo)
    .lte("date", today)
    .order("date", { ascending: false })

  if (error) throw error
  return data || []
}

// Memorial queries
export async function getMemorials(groupId: string): Promise<Memorial[]> {
  const { data, error } = await supabase.from("memorials").select("*").eq("group_id", groupId)
  if (error) throw error
  return data || []
}

export async function createMemorial(memorial: {
  user_id: string
  group_id: string
  name: string
  photo_url?: string
}): Promise<Memorial> {
  const { data, error } = await supabase.from("memorials").insert(memorial).select().single()
  if (error) throw error
  return data
}

export async function updateMemorial(
  memorialId: string,
  updates: { photo_url?: string; name?: string },
  userId: string
): Promise<Memorial> {
  // Verify user has permission (must be admin of the group)
  const { data: memorial } = await supabase.from("memorials").select("group_id").eq("id", memorialId).single()
  if (!memorial) {
    throw new Error("Memorial not found")
  }
  
  const isAdmin = await isGroupAdmin(memorial.group_id, userId)
  if (!isAdmin) {
    throw new Error("Only admins can update memorials")
  }

  const { data, error } = await supabase
    .from("memorials")
    .update(updates)
    .eq("id", memorialId)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export async function deleteMemorial(memorialId: string, userId: string): Promise<void> {
  // Verify user has permission (must be admin of the group)
  const { data: memorial } = await supabase.from("memorials").select("group_id").eq("id", memorialId).single()
  if (!memorial) {
    throw new Error("Memorial not found")
  }
  
  const isAdmin = await isGroupAdmin(memorial.group_id, userId)
  if (!isAdmin) {
    throw new Error("Only admins can delete memorials")
  }

  const { error } = await supabase.from("memorials").delete().eq("id", memorialId)
  if (error) throw error
}

// Reaction queries
export async function getReactions(entryId: string): Promise<(Reaction & { user?: { id: string; name: string; avatar_url?: string } })[]> {
  const { data, error } = await supabase
    .from("reactions")
    .select("*, user:users(id, name, avatar_url)")
    .eq("entry_id", entryId)
  if (error) throw error
  return data || []
}

export async function toggleReaction(entryId: string, userId: string): Promise<void> {
  const { data: existing } = await supabase
    .from("reactions")
    .select("id")
    .eq("entry_id", entryId)
    .eq("user_id", userId)
    .single()

  if (existing) {
    await supabase.from("reactions").delete().eq("id", existing.id)
  } else {
    await supabase.from("reactions").insert({ entry_id: entryId, user_id: userId, type: "heart" })
  }
}

/**
 * Add or remove an emoji reaction for an entry
 * If user already has this emoji reaction, remove it
 * If user has a different emoji reaction, replace it
 * If user has no reaction, add it
 */
export async function toggleEmojiReaction(entryId: string, userId: string, emoji: string): Promise<void> {
  // Check if user already has this exact emoji reaction
  const { data: existing } = await supabase
    .from("reactions")
    .select("id")
    .eq("entry_id", entryId)
    .eq("user_id", userId)
    .eq("type", emoji)
    .maybeSingle()

  if (existing) {
    // User already has this emoji - remove it
    await supabase.from("reactions").delete().eq("id", existing.id)
  } else {
    // Check if user has any other reaction for this entry
    const { data: otherReaction } = await supabase
      .from("reactions")
      .select("id")
      .eq("entry_id", entryId)
      .eq("user_id", userId)
      .maybeSingle()

    if (otherReaction) {
      // User has a different reaction - replace it
      await supabase
        .from("reactions")
        .update({ type: emoji })
        .eq("id", otherReaction.id)
    } else {
      // User has no reaction - add new one
      await supabase.from("reactions").insert({ 
        entry_id: entryId, 
        user_id: userId, 
        type: emoji 
      })
    }
  }
}

// Comment queries
export async function getComments(entryId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("id, entry_id, user_id, text, created_at, media_url, media_type, user:users(*)")
    .eq("entry_id", entryId)
    .order("created_at", { ascending: true })

  if (error) {
    // If error is due to missing columns (migration not run), try without media columns
    if (error.message?.includes("column") && error.message?.includes("media")) {
      console.warn("[getComments] Media columns not found, fetching without them:", error.message)
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("comments")
        .select("id, entry_id, user_id, text, created_at, user:users(*)")
        .eq("entry_id", entryId)
        .order("created_at", { ascending: true })
      
      if (fallbackError) throw fallbackError
      return (fallbackData || []).map((comment: any) => ({
        ...comment,
        media_url: undefined,
        media_type: undefined,
      }))
    }
    throw error
  }
  return data || []
}

export async function createComment(
  entryId: string,
  userId: string,
  text: string,
  mediaUrl?: string,
  mediaType?: "photo" | "video" | "audio"
): Promise<Comment> {
  // Build insert object conditionally based on whether media columns exist
  const insertData: any = {
    entry_id: entryId,
    user_id: userId,
    text,
  }
  
  // Only include media fields if they're provided (migration should be run, but be defensive)
  if (mediaUrl && mediaType) {
    insertData.media_url = mediaUrl
    insertData.media_type = mediaType
  }
  
  const { data, error } = await supabase
    .from("comments")
    .insert(insertData)
    .select("*, user:users(*)")
    .single()

  if (error) {
    // If error is due to missing columns, try without media columns
    if (error.message?.includes("column") && error.message?.includes("media") && mediaUrl && mediaType) {
      console.warn("[createComment] Media columns not found, creating comment without media:", error.message)
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("comments")
        .insert({
          entry_id: entryId,
          user_id: userId,
          text,
        })
        .select("*, user:users(*)")
        .single()
      
      if (fallbackError) throw fallbackError
      return {
        ...fallbackData,
        media_url: undefined,
        media_type: undefined,
      }
    }
    throw error
  }
  return data
}

export async function updateComment(
  commentId: string,
  userId: string,
  text: string,
  mediaUrl?: string | null,
  mediaType?: "photo" | "video" | "audio" | null
): Promise<Comment> {
  // Verify the comment belongs to the user
  const { data: existingComment, error: fetchError } = await supabase
    .from("comments")
    .select("user_id")
    .eq("id", commentId)
    .single()

  if (fetchError) throw fetchError
  if (existingComment.user_id !== userId) {
    throw new Error("You can only edit your own comments")
  }

  // Build update object
  const updateData: any = {
    text,
  }

  // Handle media - if mediaUrl is null, remove media; if provided, update it
  if (mediaUrl === null) {
    // Remove media
    updateData.media_url = null
    updateData.media_type = null
  } else if (mediaUrl && mediaType) {
    // Update media
    updateData.media_url = mediaUrl
    updateData.media_type = mediaType
  }
  // If neither provided, keep existing media

  const { data, error } = await supabase
    .from("comments")
    .update(updateData)
    .eq("id", commentId)
    .select("*, user:users(*)")
    .single()

  if (error) {
    // If error is due to missing columns, try without media columns
    if (error.message?.includes("column") && error.message?.includes("media")) {
      console.warn("[updateComment] Media columns not found, updating comment without media:", error.message)
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("comments")
        .update({ text })
        .eq("id", commentId)
        .select("*, user:users(*)")
        .single()
      
      if (fallbackError) throw fallbackError
      return {
        ...fallbackData,
        media_url: undefined,
        media_type: undefined,
      }
    }
    throw error
  }
  return data
}

export async function deleteComment(commentId: string, userId: string): Promise<void> {
  // Verify the comment belongs to the user
  const { data: existingComment, error: fetchError } = await supabase
    .from("comments")
    .select("user_id")
    .eq("id", commentId)
    .single()

  if (fetchError) throw fetchError
  if (existingComment.user_id !== userId) {
    throw new Error("You can only delete your own comments")
  }

  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId)

  if (error) throw error
}

// Comment reaction queries
export async function getCommentReactions(commentId: string): Promise<(Reaction & { user?: { id: string; name: string; avatar_url?: string } })[]> {
  const { data, error } = await supabase
    .from("comment_reactions")
    .select("*, user:users(id, name, avatar_url)")
    .eq("comment_id", commentId)
  if (error) throw error
  return data || []
}

// Get all comment reactions for an entry (for efficiency)
export async function getAllCommentReactionsForEntry(entryId: string): Promise<Record<string, (Reaction & { user?: { id: string; name: string; avatar_url?: string } })[]>> {
  // First get all comment IDs for this entry
  const { data: entryComments, error: commentsError } = await supabase
    .from("comments")
    .select("id")
    .eq("entry_id", entryId)
  
  if (commentsError || !entryComments || entryComments.length === 0) {
    return {}
  }
  
  const commentIds = entryComments.map(c => c.id)
  
  // Fetch all reactions for these comments
  const { data, error } = await supabase
    .from("comment_reactions")
    .select("*, user:users(id, name, avatar_url), comment_id")
    .in("comment_id", commentIds)
  
  if (error) {
    console.error("[getAllCommentReactionsForEntry] Error:", error)
    return {}
  }
  
  // Group by comment_id
  const grouped: Record<string, (Reaction & { user?: { id: string; name: string; avatar_url?: string } })[]> = {}
  ;(data || []).forEach((reaction: any) => {
    const commentId = reaction.comment_id
    if (!grouped[commentId]) {
      grouped[commentId] = []
    }
    grouped[commentId].push(reaction)
  })
  
  return grouped
}

/**
 * Add or remove an emoji reaction for a comment
 * If user already has this emoji reaction, remove it
 * If user has a different emoji reaction, replace it
 * If user has no reaction, add it
 */
export async function toggleCommentEmojiReaction(commentId: string, userId: string, emoji: string): Promise<void> {
  // Check if user already has this exact emoji reaction
  const { data: existing } = await supabase
    .from("comment_reactions")
    .select("id")
    .eq("comment_id", commentId)
    .eq("user_id", userId)
    .eq("type", emoji)
    .maybeSingle()

  if (existing) {
    // User already has this emoji - remove it
    await supabase.from("comment_reactions").delete().eq("id", existing.id)
  } else {
    // Check if user has any other reaction for this comment
    const { data: otherReaction } = await supabase
      .from("comment_reactions")
      .select("id")
      .eq("comment_id", commentId)
      .eq("user_id", userId)
      .maybeSingle()

    if (otherReaction) {
      // User has a different reaction - replace it
      await supabase
        .from("comment_reactions")
        .update({ type: emoji })
        .eq("id", otherReaction.id)
    } else {
      // User has no reaction - add new one
      await supabase.from("comment_reactions").insert({ 
        comment_id: commentId, 
        user_id: userId, 
        type: emoji 
      })
    }
  }
}

// Group Settings functions
export async function isGroupAdmin(groupId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .single()

  if (error) return false
  return data?.role === "admin"
}

export async function updateGroupName(groupId: string, newName: string, userId: string): Promise<Group> {
  // Verify admin status
  const isAdmin = await isGroupAdmin(groupId, userId)
  if (!isAdmin) {
    throw new Error("Only admins can update group name")
  }

  const { data, error } = await supabase
    .from("groups")
    .update({ name: newName })
    .eq("id", groupId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getQuestionCategoryPreferences(groupId: string) {
  const { data, error } = await supabase
    .from("question_category_preferences")
    .select("*")
    .eq("group_id", groupId)

  if (error) throw error
  return data || []
}

export async function updateQuestionCategoryPreference(
  groupId: string,
  category: string,
  preference: "more" | "less" | "none",
  userId: string
) {
  // Verify admin status
  const isAdmin = await isGroupAdmin(groupId, userId)
  if (!isAdmin) {
    throw new Error("Only admins can update question preferences")
  }

  const weightMap: Record<string, number> = {
    more: 1.5,
    less: 0.5,
    none: 0,
  }

  const { data, error } = await supabase
    .from("question_category_preferences")
    .upsert(
      {
        group_id: groupId,
        category,
        preference,
        weight: weightMap[preference],
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "group_id,category",
      }
    )
    .select()
    .single()

  if (error) throw error

  // Update queue to honor new preferences (non-blocking)
  // If this fails, preference update still succeeds (graceful degradation)
  try {
    const { error: queueError } = await supabase.functions.invoke("update-group-queue", {
      body: {
        group_id: groupId,
      },
    })

    if (queueError) {
      console.warn("[updateQuestionCategoryPreference] Failed to update queue:", queueError)
      // Don't throw - preference update succeeded, queue can be updated later
    }
  } catch (error) {
    console.warn("[updateQuestionCategoryPreference] Error calling update-group-queue:", error)
    // Don't throw - preference update succeeded
  }

  return data
}

export async function clearQuestionCategoryPreference(groupId: string, category: string, userId: string) {
  // Verify admin status
  const isAdmin = await isGroupAdmin(groupId, userId)
  if (!isAdmin) {
    throw new Error("Only admins can update question preferences")
  }

  const { error } = await supabase
    .from("question_category_preferences")
    .delete()
    .eq("group_id", groupId)
    .eq("category", category)

  if (error) throw error
}

export async function removeGroupMember(groupId: string, memberId: string, adminUserId: string): Promise<void> {
  // Verify admin status
  const isAdmin = await isGroupAdmin(groupId, adminUserId)
  if (!isAdmin) {
    throw new Error("Only admins can remove members")
  }

  // Prevent removing yourself
  if (memberId === adminUserId) {
    throw new Error("Cannot remove yourself from the group")
  }

  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", memberId)

  if (error) throw error
}

export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  // Check if user is the last admin
  const { data: admins, error: adminError } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("role", "admin")

  if (adminError) throw adminError

  if (admins?.length === 1 && admins[0].user_id === userId) {
    throw new Error("Cannot leave group as the last admin. Please transfer admin or delete the group.")
  }

  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId)

  if (error) throw error
}

// Custom Question queries
export async function checkCustomQuestionEligibility(groupId: string): Promise<boolean> {
  // Check if group has 3+ members
  const { data: members, error: membersError } = await supabase
    .from("group_members")
    .select("user_id, role, joined_at")
    .eq("group_id", groupId)

  if (membersError) throw membersError
  if (!members || members.length < 3) return false

  // Get activity tracking record
  const { data: tracking } = await supabase
    .from("group_activity_tracking")
    .select("*")
    .eq("group_id", groupId)
    .maybeSingle()

  // Groups are eligible if they have 3+ members (7-day requirement removed)
  // The check-custom-question-eligibility function updates the tracking table
  if (tracking?.is_eligible_for_custom_questions) {
    return true
  }

  // If tracking doesn't exist or says not eligible, but group has 3+ members, they're eligible
  // (The cron job will update the tracking table, but this provides a fallback check)
  return members.length >= 3
}

export async function getCustomQuestionOpportunity(
  userId: string,
  groupId: string,
  date: string
): Promise<CustomQuestion | null> {
  const { data, error } = await supabase
    .from("custom_questions")
    .select("*, user:users(*), group:groups(*)")
    .eq("user_id", userId)
    .eq("group_id", groupId)
    .eq("date_assigned", date)
    .is("date_asked", null)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function getCustomQuestionForDate(
  groupId: string,
  date: string
): Promise<CustomQuestion | null> {
  const { data, error } = await supabase
    .from("custom_questions")
    .select("*, user:users(*), group:groups(*), prompt:prompts(*)")
    .eq("group_id", groupId)
    .eq("date_asked", date)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function createCustomQuestion(data: {
  groupId: string
  userId: string
  question: string
  isAnonymous: boolean
  dateAssigned: string
}): Promise<CustomQuestion> {
  // Validate question length (30 words max)
  const wordCount = data.question.trim().split(/\s+/).length
  if (wordCount > 30) {
    throw new Error("Question must be 30 words or less")
  }

  // Get the existing custom_question record (created by edge function)
  const { data: existingOpportunity, error: fetchError } = await supabase
    .from("custom_questions")
    .select("*")
    .eq("group_id", data.groupId)
    .eq("user_id", data.userId)
    .eq("date_assigned", data.dateAssigned)
    .is("date_asked", null)
    .maybeSingle()

  if (fetchError) throw fetchError
  if (!existingOpportunity) {
    throw new Error("No custom question opportunity found for this date")
  }

  // Get user and group names for custom_questions table
  const { data: userData } = await supabase
    .from("users")
    .select("name")
    .eq("id", data.userId)
    .single()
  
  const { data: groupData } = await supabase
    .from("groups")
    .select("name")
    .eq("id", data.groupId)
    .single()

  // Create prompt entry for the custom question
  const { data: prompt, error: promptError } = await supabase
    .from("prompts")
    .insert({
      question: data.question,
      category: "Custom",
      is_custom: true,
      custom_question_id: existingOpportunity.id,
    })
    .select()
    .single()

  if (promptError) throw promptError

  // Calculate next available date (tomorrow, or after birthdays)
  const tomorrow = new Date(data.dateAssigned)
  tomorrow.setDate(tomorrow.getDate() + 1)
  let nextAvailableDate = tomorrow.toISOString().split("T")[0]

  // Check for birthdays in the next 7 days and adjust
  const { data: members } = await supabase
    .from("group_members")
    .select("user_id, user:users(birthday)")
    .eq("group_id", data.groupId)

  if (members) {
    // Check for birthdays starting from tomorrow
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(tomorrow)
      checkDate.setDate(checkDate.getDate() + i)
      const checkDateStr = checkDate.toISOString().split("T")[0]
      const checkMonthDay = checkDateStr.substring(5) // MM-DD

      const hasBirthday = members.some((m: any) => {
        const user = m.user as any
        if (!user?.birthday) return false
        return user.birthday.substring(5) === checkMonthDay
      })

      if (!hasBirthday) {
        nextAvailableDate = checkDateStr
        break
      }
    }
  }

  // Update custom_question record
  // CRITICAL: Specify foreign key explicitly to avoid ambiguous relationship error
  // There are two relationships between custom_questions and prompts:
  // 1. custom_questions.prompt_id -> prompts.id (what we want)
  // 2. prompts.custom_question_id -> custom_questions.id (reverse relationship)
  // Using !prompt_id tells Supabase to use the prompt_id foreign key
  const { data: updatedQuestion, error: updateError } = await supabase
    .from("custom_questions")
    .update({
      question: data.question,
      is_anonymous: data.isAnonymous,
      date_asked: nextAvailableDate,
      prompt_id: prompt.id,
      user_name: userData?.name || null,
      group_name: groupData?.name || null,
    })
    .eq("id", existingOpportunity.id)
    .select("*, user:users(*), group:groups(*), prompt:prompts!prompt_id(*)")
    .single()

  if (updateError) throw updateError

  // Update rotation status
  const weekStart = getWeekStartDate(data.dateAssigned)
  await supabase
    .from("custom_question_rotation")
    .update({ status: "completed" })
    .eq("group_id", data.groupId)
    .eq("user_id", data.userId)
    .eq("week_start_date", weekStart)

  // Insert custom question prompt into group_prompt_queue at position 0
  // First, shift all existing positions up by 1
  const { data: existingQueue } = await supabase
    .from("group_prompt_queue")
    .select("id, position")
    .eq("group_id", data.groupId)
    .order("position", { ascending: true })

  if (existingQueue && existingQueue.length > 0) {
    // Update all positions
    for (const item of existingQueue) {
      await supabase
        .from("group_prompt_queue")
        .update({ position: item.position + 1 })
        .eq("id", item.id)
    }
  }

  // Insert custom question at position 0
  await supabase.from("group_prompt_queue").insert({
    group_id: data.groupId,
    prompt_id: prompt.id,
    added_by: data.userId,
    position: 0,
  })

  return updatedQuestion
}

export async function hasSeenCustomQuestionOnboarding(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("users")
    .select("has_seen_custom_question_onboarding")
    .eq("id", userId)
    .single()

  if (error) throw error
  return data?.has_seen_custom_question_onboarding || false
}

export async function markCustomQuestionOnboardingSeen(userId: string): Promise<void> {
  const { error } = await supabase
    .from("users")
    .update({ has_seen_custom_question_onboarding: true })
    .eq("id", userId)

  if (error) throw error
}

export async function getGroupActivityTracking(groupId: string): Promise<GroupActivityTracking | null> {
  const { data, error } = await supabase
    .from("group_activity_tracking")
    .select("*, group:groups(*)")
    .eq("group_id", groupId)
    .maybeSingle()

  if (error) throw error
  return data
}

// Helper function to get Monday of the week for a given date
function getWeekStartDate(dateString: string): string {
  const date = new Date(dateString)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1) // Adjust to Monday
  const monday = new Date(date.setDate(diff))
  return monday.toISOString().split("T")[0]
}

// Collections & Decks queries
export async function getCollections(): Promise<Collection[]> {
  const { data, error } = await supabase
    .from("collections")
    .select("*")
    .order("display_order", { ascending: true })

  if (error) throw error
  return data || []
}

export async function getCollectionDetails(collectionId: string): Promise<Collection | null> {
  const { data, error } = await supabase
    .from("collections")
    .select("*")
    .eq("id", collectionId)
    .single()

  if (error) throw error
  return data
}

export async function getDecksByCollection(collectionId: string): Promise<Deck[]> {
  const { data, error } = await supabase
    .from("decks")
    .select("*, collection:collections(*)")
    .eq("collection_id", collectionId)
    .order("display_order", { ascending: true })

  if (error) throw error
  return data || []
}

export async function getDeckDetails(deckId: string): Promise<Deck | null> {
  const { data, error } = await supabase
    .from("decks")
    .select("*, collection:collections(*)")
    .eq("id", deckId)
    .single()

  if (error) throw error
  return data
}

export async function getDeckQuestions(deckId: string): Promise<Prompt[]> {
  const { data, error } = await supabase
    .from("prompts")
    .select("*")
    .eq("deck_id", deckId)
    .not("deck_id", "is", null)
    .order("deck_order", { ascending: true })

  if (error) throw error
  return data || []
}

// Voting queries
export async function requestDeckVote(groupId: string, deckId: string, userId: string, bypassMemberLimit?: boolean): Promise<void> {
  // Check if group has 3+ members (unless bypassed in dev mode)
  if (!bypassMemberLimit) {
    const { data: members, error: membersError } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupId)

    if (membersError) throw membersError
    if (!members || members.length < 3) {
      throw new Error("Group must have at least 3 members to vote on decks")
    }
  }

  // Check if group already has 3 active decks (limit is 3)
  const { data: activeDecks, error: activeDecksError } = await supabase
    .from("group_active_decks")
    .select("id")
    .eq("group_id", groupId)
    .eq("status", "active")

  if (activeDecksError) throw activeDecksError
  if (activeDecks && activeDecks.length >= 3) {
    throw new Error("Group already has 3 active decks. Please finish or remove a deck before adding another.")
  }

  // Check if deck is already active/voting/rejected for this group
  const { data: existing } = await supabase
    .from("group_active_decks")
    .select("status")
    .eq("group_id", groupId)
    .eq("deck_id", deckId)
    .maybeSingle()

  if (existing) {
    if (existing.status === "active" || existing.status === "voting") {
      throw new Error("This deck is already active or being voted on")
    }
    if (existing.status === "rejected") {
      // Allow re-voting on rejected decks - update status to voting
      const { error: updateError } = await supabase
        .from("group_active_decks")
        .update({
          status: "voting",
          requested_by: userId,
          activated_at: null,
          finished_at: null,
        })
        .eq("group_id", groupId)
        .eq("deck_id", deckId)

      if (updateError) throw updateError

      // Delete old votes
      await supabase
        .from("group_deck_votes")
        .delete()
        .eq("group_id", groupId)
        .eq("deck_id", deckId)

      // Create vote for requester (automatic yes)
      await supabase.from("group_deck_votes").insert({
        group_id: groupId,
        deck_id: deckId,
        user_id: userId,
        vote: "yes",
      })

      // Send notifications to all members except requester
      await sendDeckVoteNotifications(groupId, deckId, userId)
      return
    }
  }

  // Create new voting record
  const { error: createError } = await supabase
    .from("group_active_decks")
    .insert({
      group_id: groupId,
      deck_id: deckId,
      status: "voting",
      requested_by: userId,
    })

  if (createError) throw createError

  // Create vote for requester (automatic yes)
  await supabase.from("group_deck_votes").insert({
    group_id: groupId,
    deck_id: deckId,
    user_id: userId,
    vote: "yes",
  })

  // Send notifications to all members except requester
  await sendDeckVoteNotifications(groupId, deckId, userId)
}

async function sendDeckVoteNotifications(groupId: string, deckId: string, requestedBy: string): Promise<void> {
  // Get all group members except requester
  const { data: members } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .neq("user_id", requestedBy)

  if (!members || members.length === 0) return

  // Get requester name
  const { data: requester } = await supabase
    .from("users")
    .select("name")
    .eq("id", requestedBy)
    .single()

  const requesterName = requester?.name || "Someone"

  // Get deck name
  const { data: deck } = await supabase
    .from("decks")
    .select("name")
    .eq("id", deckId)
    .single()

  const deckName = deck?.name || "a deck"

  // Get group name for notification
  const { data: group } = await supabase
    .from("groups")
    .select("name")
    .eq("id", groupId)
    .single()

  const groupName = group?.name || "your group"

  // Prepare notification content
  const notificationTitle = "New Deck Vote"
  const notificationBody = `${requesterName} wants to add "${deckName}" to ${groupName}'s question rotation. Vote now!`
  const notificationData = {
    type: "deck_vote_requested",
    group_id: groupId,
    deck_id: deckId,
  }

  // Send push notifications and create database notifications for all members
  for (const member of members) {
    try {
      // Get push token for this user
      const { data: pushTokens, error: tokenError } = await supabase
        .from("push_tokens")
        .select("token")
        .eq("user_id", member.user_id)
        .limit(1)

      // Send push notification if token exists
      if (!tokenError && pushTokens && pushTokens.length > 0) {
        const pushToken = pushTokens[0].token
        if (pushToken) {
          try {
            const message = {
              to: pushToken,
              sound: "default",
              title: notificationTitle,
              body: notificationBody,
              data: notificationData,
            }

            const response = await fetch("https://exp.host/--/api/v2/push/send", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(message),
            })

            if (!response.ok) {
              console.error(`[sendDeckVoteNotifications] Failed to send push notification to user ${member.user_id}:`, await response.text())
            }
          } catch (error) {
            console.error(`[sendDeckVoteNotifications] Error sending push notification to user ${member.user_id}:`, error)
          }
        }
      }

      // Create database notification (for in-app notification center)
      await supabase.from("notifications").insert({
        user_id: member.user_id,
        type: "pack_vote_requested",
        title: notificationTitle,
        body: notificationBody,
        data: notificationData,
      })
    } catch (error) {
      console.error(`[sendDeckVoteNotifications] Error processing notification for user ${member.user_id}:`, error)
      // Continue with other members even if one fails
    }
  }
}

export async function castVote(groupId: string, deckId: string, userId: string, vote: "yes" | "no"): Promise<void> {
  // Upsert vote (allows changing vote)
  const { error } = await supabase
    .from("group_deck_votes")
    .upsert(
      {
        group_id: groupId,
        deck_id: deckId,
        user_id: userId,
        vote,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "group_id,deck_id,user_id",
      }
    )

  if (error) throw error

  // Check if majority has been reached and activate if needed
  // Only call if there's an active voting record
  try {
    const { data: activeDeck } = await supabase
      .from("group_active_decks")
      .select("status")
      .eq("group_id", groupId)
      .eq("deck_id", deckId)
      .eq("status", "voting")
      .maybeSingle()

    if (activeDeck) {
      const { data, error: activateError } = await supabase.functions.invoke("activate-deck", {
        body: { group_id: groupId, deck_id: deckId },
      })

      if (activateError) {
        console.warn("[castVote] Error checking activation:", activateError)
        // Don't throw - vote was recorded successfully
      }
    }
  } catch (err) {
    console.warn("[castVote] Exception checking activation:", err)
    // Don't throw - vote was recorded successfully
  }
}

export async function getVoteStatus(groupId: string, deckId: string): Promise<{
  yes_votes: number
  no_votes: number
  total_members: number
  majority_threshold: number
  status: "voting" | "active" | "rejected" | "finished"
}> {
  // Get group members count
  const { data: members, error: membersError } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)

  if (membersError) throw membersError
  const totalMembers = members?.length || 0
  const majorityThreshold = Math.ceil(totalMembers / 2)

  // Get active deck status
  const { data: activeDeck, error: activeDeckError } = await supabase
    .from("group_active_decks")
    .select("status, requested_by")
    .eq("group_id", groupId)
    .eq("deck_id", deckId)
    .maybeSingle()

  if (activeDeckError) throw activeDeckError

  const status = (activeDeck?.status as "voting" | "active" | "rejected" | "finished") || "voting"

  // Get votes (include user_id to check requester)
  const { data: votes, error: votesError } = await supabase
    .from("group_deck_votes")
    .select("vote, user_id")
    .eq("group_id", groupId)
    .eq("deck_id", deckId)

  if (votesError) throw votesError

  let yesVotes = 0
  let noVotes = 0

  // Count all votes from database
  votes?.forEach((vote: any) => {
    if (vote.vote === "yes") {
      yesVotes++
    } else if (vote.vote === "no") {
      noVotes++
    }
  })

  // If requester hasn't voted yet (shouldn't happen, but handle edge case)
  // Note: requestDeckVote creates a vote for requester, so this should always be false
  if (activeDeck && votes) {
    const requesterVoted = votes.some((v: any) => v.user_id === activeDeck.requested_by)
    if (!requesterVoted) {
      // This shouldn't happen, but if it does, don't double count
      // The requester's vote should already be in the database
    }
  }

  return {
    yes_votes: yesVotes,
    no_votes: noVotes,
    total_members: totalMembers,
    majority_threshold: majorityThreshold,
    status,
  }
}

export async function getUserVote(groupId: string, deckId: string, userId: string): Promise<"yes" | "no" | null> {
  const { data, error } = await supabase
    .from("group_deck_votes")
    .select("vote")
    .eq("group_id", groupId)
    .eq("deck_id", deckId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) throw error
  return data?.vote || null
}

// Active Decks queries
export async function getGroupActiveDecks(groupId: string): Promise<GroupActiveDeck[]> {
  const { data, error } = await supabase
    .from("group_active_decks")
    .select("*, deck:decks(*), requested_by_user:users(id, name, avatar_url)")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })

  if (error) throw error
  return data || []
}

export async function getPendingVotes(groupId: string, userId: string): Promise<GroupActiveDeck[]> {
  // Get decks that are being voted on and user hasn't voted yet
  const { data: votingDecks, error: votingError } = await supabase
    .from("group_active_decks")
    .select("deck_id")
    .eq("group_id", groupId)
    .eq("status", "voting")

  if (votingError) throw votingError
  if (!votingDecks || votingDecks.length === 0) return []

  const deckIds = votingDecks.map((vd: any) => vd.deck_id)

  // Get decks where user has voted
  // Only query if we have deck IDs to check
  let userVotes: any[] = []
  if (deckIds.length > 0) {
    const { data: votesData, error: votesError } = await supabase
      .from("group_deck_votes")
      .select("deck_id")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .in("deck_id", deckIds)

    if (votesError) throw votesError
    userVotes = votesData || []
  }

  const votedDeckIds = new Set((userVotes || []).map((v: any) => v.deck_id))
  const pendingDeckIds = deckIds.filter((id: string) => !votedDeckIds.has(id))

  if (pendingDeckIds.length === 0) return []

  // Get full deck details
  const { data: pendingDecks, error: pendingError } = await supabase
    .from("group_active_decks")
    .select("*, deck:decks(*), requested_by_user:users(id, name, avatar_url)")
    .eq("group_id", groupId)
    .in("deck_id", pendingDeckIds)
    .eq("status", "voting")

  if (pendingError) throw pendingError
  return pendingDecks || []
}

export async function getDeckQuestionsAskedCount(groupId: string, deckId: string): Promise<number> {
  const { data, error } = await supabase
    .from("daily_prompts")
    .select("prompt_id")
    .eq("group_id", groupId)
    .eq("deck_id", deckId)
    .is("user_id", null) // Only count general prompts

  if (error) throw error

  // Count unique prompts asked
  const uniquePromptIds = new Set((data || []).map((p: any) => p.prompt_id))
  return uniquePromptIds.size
}

export async function getDeckQuestionsLeftCount(groupId: string, deckId: string): Promise<number> {
  // Get total questions in deck
  const { data: deckPrompts, error: deckError } = await supabase
    .from("prompts")
    .select("id")
    .eq("deck_id", deckId)
    .not("deck_id", "is", null)

  if (deckError) throw deckError
  const totalQuestions = deckPrompts?.length || 0

  // Get questions asked
  const askedCount = await getDeckQuestionsAskedCount(groupId, deckId)

  return Math.max(0, totalQuestions - askedCount)
}

// Birthday Card Functions

// Get upcoming birthday cards user needs to contribute to
export async function getUpcomingBirthdayCards(
  groupId: string,
  userId: string,
  todayDate: string
): Promise<BirthdayCard[]> {
  const today = new Date(todayDate)
  const sevenDaysFromNow = new Date(today)
  sevenDaysFromNow.setDate(today.getDate() + 7)
  const sevenDaysFromNowStr = sevenDaysFromNow.toISOString().split("T")[0]
  
  console.log(`[getUpcomingBirthdayCards] Querying for group ${groupId}, user ${userId}, today: ${todayDate}, range: ${todayDate} to ${sevenDaysFromNowStr}`)
  
  // Get cards where:
  // - group_id matches
  // - birthday_user_id != userId (not their own birthday)
  // - status = 'draft'
  // - birthday_date is within next 7 days
  // - user hasn't contributed yet
  
  const { data: cards, error } = await supabase
    .from("birthday_cards")
    .select("*, birthday_user:users(id, name, avatar_url)")
    .eq("group_id", groupId)
    .eq("status", "draft")
    .neq("birthday_user_id", userId)
    .gte("birthday_date", todayDate)
    .lte("birthday_date", sevenDaysFromNowStr)

  if (error) {
    console.error(`[getUpcomingBirthdayCards] Error fetching cards:`, error)
    throw error
  }
  
  console.log(`[getUpcomingBirthdayCards] Found ${cards?.length || 0} cards before filtering contributions`)

  if (!cards) return []

  // Filter out cards where user has already contributed
  const cardsWithoutContribution: BirthdayCard[] = []
  
  for (const card of cards) {
    const { data: entry } = await supabase
      .from("birthday_card_entries")
      .select("id")
      .eq("card_id", card.id)
      .eq("contributor_user_id", userId)
      .maybeSingle()

    if (!entry) {
      cardsWithoutContribution.push(card)
    }
  }

  console.log(`[getUpcomingBirthdayCards] Returning ${cardsWithoutContribution.length} cards without user contribution`)
  return cardsWithoutContribution
}

// Get card entries user has written for a specific date
export async function getMyCardEntriesForDate(
  groupId: string,
  userId: string,
  date: string
): Promise<BirthdayCardEntry[]> {
  // Get entries created on this date
  const dateStart = new Date(date + "T00:00:00Z")
  const dateEnd = new Date(date + "T23:59:59Z")

  const { data: entries, error } = await supabase
    .from("birthday_card_entries")
    .select("*, card:birthday_cards(*, birthday_user:users(id, name, avatar_url))")
    .eq("contributor_user_id", userId)
    .gte("created_at", dateStart.toISOString())
    .lte("created_at", dateEnd.toISOString())
    .order("created_at", { ascending: true })

  if (error) throw error
  if (!entries) return []

  // Filter to only entries for cards in this group
  return entries.filter((entry: any) => entry.card?.group_id === groupId)
}

// Get user's own birthday card (if it's their birthday)
export async function getMyBirthdayCard(
  groupId: string,
  userId: string,
  date: string
): Promise<BirthdayCard | null> {
  const { data: card, error } = await supabase
    .from("birthday_cards")
    .select("*, birthday_user:users(id, name, avatar_url)")
    .eq("group_id", groupId)
    .eq("birthday_user_id", userId)
    .eq("birthday_date", date)
    .eq("status", "published")
    .maybeSingle()

  if (error) throw error
  return card || null
}

// Check if user has received any birthday cards
export async function hasReceivedBirthdayCards(
  groupId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("birthday_cards")
    .select("id")
    .eq("group_id", groupId)
    .eq("birthday_user_id", userId)
    .eq("status", "published")
    .limit(1)

  if (error) throw error
  return (data?.length || 0) > 0
}

// Get user's own birthday cards (only cards where they are the birthday person)
export async function getMyBirthdayCards(
  groupId: string,
  userId: string
): Promise<BirthdayCard[]> {
  const { data: cards, error } = await supabase
    .from("birthday_cards")
    .select("*, birthday_user:users(id, name, avatar_url)")
    .eq("group_id", groupId)
    .eq("birthday_user_id", userId)
    .eq("status", "published")
    .order("birthday_date", { ascending: false })

  if (error) throw error
  return cards || []
}

// Get card entries for a card
export async function getBirthdayCardEntries(
  cardId: string
): Promise<BirthdayCardEntry[]> {
  const { data: entries, error } = await supabase
    .from("birthday_card_entries")
    .select("*, contributor:users(id, name, avatar_url)")
    .eq("card_id", cardId)
    .order("created_at", { ascending: true })

  if (error) throw error
  return entries || []
}

// Create birthday card entry
export async function createBirthdayCardEntry(data: {
  cardId: string
  contributorUserId: string
  textContent?: string
  mediaUrls?: string[]
  mediaTypes?: ("photo" | "video" | "audio")[]
  embeddedMedia?: any[]
}): Promise<BirthdayCardEntry> {
  const { data: entry, error } = await supabase
    .from("birthday_card_entries")
    .insert({
      card_id: data.cardId,
      contributor_user_id: data.contributorUserId,
      text_content: data.textContent || null,
      media_urls: data.mediaUrls || null,
      media_types: data.mediaTypes || null,
      embedded_media: data.embeddedMedia || null,
    })
    .select("*, contributor:users(id, name, avatar_url)")
    .single()

  if (error) throw error
  return entry
}

// Update birthday card entry
export async function updateBirthdayCardEntry(
  entryId: string,
  userId: string,
  updates: {
    textContent?: string
    mediaUrls?: string[]
    mediaTypes?: ("photo" | "video" | "audio")[]
    embeddedMedia?: any[]
  }
): Promise<BirthdayCardEntry> {
  const { data: entry, error } = await supabase
    .from("birthday_card_entries")
    .update({
      text_content: updates.textContent !== undefined ? updates.textContent : undefined,
      media_urls: updates.mediaUrls !== undefined ? updates.mediaUrls : undefined,
      media_types: updates.mediaTypes !== undefined ? updates.mediaTypes : undefined,
      embedded_media: updates.embeddedMedia !== undefined ? updates.embeddedMedia : undefined,
    })
    .eq("id", entryId)
    .eq("contributor_user_id", userId)
    .select("*, contributor:users(id, name, avatar_url)")
    .single()

  if (error) throw error
  return entry
}

// Make card public
export async function makeBirthdayCardPublic(
  cardId: string,
  userId: string
): Promise<BirthdayCard> {
  const { data: card, error } = await supabase
    .from("birthday_cards")
    .update({
      status: "public",
      is_public: true,
    })
    .eq("id", cardId)
    .eq("birthday_user_id", userId)
    .select("*, birthday_user:users(id, name, avatar_url)")
    .single()

  if (error) throw error
  return card
}

// Get birthday card by ID
export async function getBirthdayCard(cardId: string): Promise<BirthdayCard | null> {
  const { data: card, error } = await supabase
    .from("birthday_cards")
    .select("*, birthday_user:users(id, name, avatar_url, birthday)")
    .eq("id", cardId)
    .maybeSingle()

  if (error) throw error
  return card || null
}

// Get birthday card entry by ID
export async function getBirthdayCardEntry(entryId: string): Promise<BirthdayCardEntry | null> {
  const { data: entry, error } = await supabase
    .from("birthday_card_entries")
    .select("*, contributor:users(id, name, avatar_url), card:birthday_cards(*)")
    .eq("id", entryId)
    .maybeSingle()

  if (error) throw error
  return entry || null
}

// Get public birthday cards for group (for history filter)
export async function trackBirthdayCardView(cardId: string, userId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("track-birthday-card-view", {
    body: { card_id: cardId, user_id: userId },
  })

  if (error) {
    console.error("[trackBirthdayCardView] Error tracking view:", error)
    // Don't throw - tracking failure shouldn't break the UI
  }
}

export async function getPublicBirthdayCards(
  groupId: string
): Promise<BirthdayCard[]> {
  const { data: cards, error } = await supabase
    .from("birthday_cards")
    .select("*, birthday_user:users(id, name, avatar_url)")
    .eq("group_id", groupId)
    .eq("is_public", true)
    .eq("status", "public")
    .order("birthday_date", { ascending: false })

  if (error) throw error
  return cards || []
}

// Featured Questions Functions

// Get current week's Monday date
function getCurrentWeekMonday(): string {
  const today = new Date()
  const dayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const monday = new Date(today)
  monday.setDate(today.getDate() - daysToSubtract)
  return monday.toISOString().split("T")[0]
}

// Get featured prompts for current week
export async function getFeaturedPromptsForCurrentWeek() {
  const weekMonday = getCurrentWeekMonday()
  
  const { data, error } = await supabase
    .from("featured_prompts")
    .select("*")
    .eq("week_starting", weekMonday)
    .order("display_order", { ascending: true })
    .limit(10)

  if (error) throw error
  return data || []
}

// Get featured question count for a group this week
export async function getGroupFeaturedQuestionCount(groupId: string): Promise<number> {
  const weekMonday = getCurrentWeekMonday()
  
  const { data, error } = await supabase
    .from("group_featured_question_count")
    .select("count")
    .eq("group_id", groupId)
    .eq("week_starting", weekMonday)
    .maybeSingle()

  if (error) throw error
  return data?.count || 0
}

// Check if a featured prompt is already in group's queue
export async function isFeaturedPromptInGroupQueue(
  groupId: string,
  featuredPromptId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("group_featured_questions")
    .select("id")
    .eq("group_id", groupId)
    .eq("featured_prompt_id", featuredPromptId)
    .maybeSingle()

  if (error) throw error
  return !!data
}

// Add featured question to group queue
export async function addFeaturedQuestionToQueue(
  groupId: string,
  featuredPromptId: string,
  userId: string
): Promise<void> {
  // Check if already added
  const alreadyAdded = await isFeaturedPromptInGroupQueue(groupId, featuredPromptId)
  if (alreadyAdded) {
    throw new Error("This featured question is already in your group's queue")
  }

  // Check weekly limit
  const currentCount = await getGroupFeaturedQuestionCount(groupId)
  if (currentCount >= 2) {
    throw new Error("Your group has already added 2 featured questions this week")
  }

  // Get featured prompt details
  const { data: featuredPrompt, error: promptError } = await supabase
    .from("featured_prompts")
    .select("*")
    .eq("id", featuredPromptId)
    .single()

  if (promptError || !featuredPrompt) {
    throw new Error("Featured prompt not found")
  }

  // Create prompt entry in prompts table
  const { data: newPrompt, error: createPromptError } = await supabase
    .from("prompts")
    .insert({
      question: featuredPrompt.question,
      category: "Featured",
      featured_prompt_id: featuredPromptId,
    })
    .select()
    .single()

  if (createPromptError) {
    console.error("[addFeaturedQuestionToQueue] Error creating prompt:", createPromptError)
    throw new Error(`Failed to create prompt: ${createPromptError.message}`)
  }
  
  if (!newPrompt) {
    console.error("[addFeaturedQuestionToQueue] No prompt returned from insert")
    throw new Error("Failed to create prompt: No data returned")
  }

  // Get current queue to find insertion position
  // Priority: Birthday > Custom > Featured > Deck > Default (Friends/Family)
  const { data: queueItems, error: queueError } = await supabase
    .from("group_prompt_queue")
    .select("id, position, prompt:prompts(category)")
    .eq("group_id", groupId)
    .order("position", { ascending: true })

  if (queueError) throw queueError

  // Find insertion position: after Custom questions, before Deck/Default
  let insertPosition = 0
  if (queueItems && queueItems.length > 0) {
    // Find the last Custom/Birthday question index
    let lastCustomIndex = -1
    for (let i = 0; i < queueItems.length; i++) {
      const item = queueItems[i]
      const prompt = item.prompt as any
      if (prompt?.category === "Custom" || prompt?.category === "Birthday") {
        lastCustomIndex = i
      }
    }
    
    // Insert after the last Custom/Birthday question, or at position 0
    insertPosition = lastCustomIndex + 1
    
    // Shift all items at or after insertPosition forward by 1
    // We need to update positions starting from the end to avoid conflicts
    for (let i = queueItems.length - 1; i >= insertPosition; i--) {
      const item = queueItems[i]
      const newPosition = item.position + 1
      await supabase
        .from("group_prompt_queue")
        .update({ position: newPosition })
        .eq("id", item.id)
    }
  }

  // Insert featured question at the calculated position
  const { error: insertError } = await supabase
    .from("group_prompt_queue")
    .insert({
      group_id: groupId,
      prompt_id: newPrompt.id,
      added_by: userId,
      position: insertPosition,
    })

  if (insertError) throw insertError

  // Record in group_featured_questions table
  const weekMonday = getCurrentWeekMonday()
  const { error: recordError } = await supabase
    .from("group_featured_questions")
    .insert({
      group_id: groupId,
      featured_prompt_id: featuredPromptId,
      added_by: userId,
      prompt_id: newPrompt.id,
    })

  if (recordError) throw recordError

  // Update or create count record
  const { data: countRecord } = await supabase
    .from("group_featured_question_count")
    .select("id")
    .eq("group_id", groupId)
    .eq("week_starting", weekMonday)
    .maybeSingle()

  if (countRecord) {
    // Update existing count
    await supabase
      .from("group_featured_question_count")
      .update({ count: currentCount + 1 })
      .eq("id", countRecord.id)
  } else {
    // Create new count record
    await supabase
      .from("group_featured_question_count")
      .insert({
        group_id: groupId,
        week_starting: weekMonday,
        count: 1,
      })
  }
}

// Get user who added a featured question (for display)
export async function getFeaturedQuestionAddedBy(
  groupId: string,
  featuredPromptId: string
): Promise<{ user_id: string; user_name: string } | null> {
  const { data, error } = await supabase
    .from("group_featured_questions")
    .select("added_by, user:users(id, name)")
    .eq("group_id", groupId)
    .eq("featured_prompt_id", featuredPromptId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const user = data.user as any
  return {
    user_id: data.added_by,
    user_name: user?.name || "Someone",
  }
}

// ==================== QUESTION SWIPES FUNCTIONS ====================

// Get swipeable questions for a group (excluding user's swipes and already matched/asked)
export async function getSwipeableQuestionsForGroup(
  groupId: string,
  userId: string
): Promise<Prompt[]> {
  // Get group type early for filtering
  const group = await getGroup(groupId)
  if (!group) {
    throw new Error(`Group ${groupId} not found`)
  }

  // Get user's existing swipes for this group
  const { data: userSwipes, error: swipesError } = await supabase
    .from("group_question_swipes")
    .select("prompt_id")
    .eq("group_id", groupId)
    .eq("user_id", userId)

  if (swipesError) throw swipesError

  const swipedPromptIds = new Set((userSwipes || []).map((s: any) => s.prompt_id))

  // Get already matched questions for this group
  const { data: matches, error: matchesError } = await supabase
    .from("group_question_matches")
    .select("prompt_id")
    .eq("group_id", groupId)

  if (matchesError) throw matchesError

  const matchedPromptIds = new Set((matches || []).map((m: any) => m.prompt_id))

  // Get questions that have been asked (from daily_prompts)
  const { data: askedPrompts, error: askedError } = await supabase
    .from("daily_prompts")
    .select("prompt_id")
    .eq("group_id", groupId)

  if (askedError) throw askedError

  const askedPromptIds = new Set((askedPrompts || []).map((p: any) => p.prompt_id))

  // Get swipeable questions, excluding user's swipes, matches, and asked questions
  const excludeIds = Array.from(
    new Set([...swipedPromptIds, ...matchedPromptIds, ...askedPromptIds])
  )

  // Get all swipeable questions
  const { data: allSwipeable, error } = await supabase
    .from("prompts")
    .select("*")
    .eq("swipeable", true)

  if (error) throw error

  // Filter by category based on group type
  // Family groups only see Family category questions
  // Friends groups only see Friends category questions
  let categoryFiltered = allSwipeable || []
  if (group.type === "family") {
    categoryFiltered = categoryFiltered.filter((p) => p.category === "Family")
  } else if (group.type === "friends") {
    categoryFiltered = categoryFiltered.filter((p) => p.category === "Friends")
  }

  // Filter out excluded prompts in JavaScript (more reliable than SQL .not() with arrays)
  const filtered = categoryFiltered.filter((p) => !excludeIds.includes(p.id))

  // Shuffle the results for randomization
  const shuffled = filtered.sort(() => Math.random() - 0.5)

  return shuffled as Prompt[]
}

// Record a swipe and check for matches
export async function recordSwipe(
  groupId: string,
  promptId: string,
  userId: string,
  response: "yes" | "no"
): Promise<{ matched: boolean; matchedWithUsers?: string[] }> {
  // Upsert the swipe (allows updating if user sees question again)
  const { error: swipeError } = await supabase
    .from("group_question_swipes")
    .upsert(
      {
        user_id: userId,
        group_id: groupId,
        prompt_id: promptId,
        response,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,group_id,prompt_id",
      }
    )

  if (swipeError) throw swipeError

  // Update prompt swipe counts using database function
  // This bypasses RLS and ensures atomic increment
  const { error: countUpdateError } = await supabase.rpc("increment_prompt_swipe_count", {
    p_prompt_id: promptId,
    p_response: response,
  })

  if (countUpdateError) {
    console.error(`[recordSwipe] Error updating swipe count for prompt ${promptId}:`, countUpdateError)
    // Don't throw - swipe recording succeeded, count update is secondary
  } else {
    console.log(`[recordSwipe] Successfully updated ${response}_swipes_count for prompt ${promptId}`)
  }

  // Check for matches if response is "yes"
  if (response === "yes") {
    // Count yes swipes for this group and prompt
    const { data: yesSwipes, error: yesError } = await supabase
      .from("group_question_swipes")
      .select("user_id, user:users(id, name)")
      .eq("group_id", groupId)
      .eq("prompt_id", promptId)
      .eq("response", "yes")

    if (yesError) throw yesError

    const yesCount = (yesSwipes || []).length

    // If 2+ yes swipes, create match
    if (yesCount >= 2) {
      // Check if match already exists
      const { data: existingMatch } = await supabase
        .from("group_question_matches")
        .select("id")
        .eq("group_id", groupId)
        .eq("prompt_id", promptId)
        .maybeSingle()

      if (!existingMatch) {
        // Create match
        const { error: matchError } = await supabase
          .from("group_question_matches")
          .insert({
            group_id: groupId,
            prompt_id: promptId,
            matched_at: new Date().toISOString(),
            asked: false,
          })

        if (matchError) throw matchError

        // Get other users who swiped yes (excluding current user)
        const matchedWithUsers = (yesSwipes || [])
          .filter((s: any) => s.user_id !== userId)
          .map((s: any) => {
            const user = s.user as any
            return user?.name || "Someone"
          })

        return { matched: true, matchedWithUsers }
      }
    }
  }

  return { matched: false }
}

// Get matched questions for a group (for queue prioritization)
export async function getMatchedQuestionsForGroup(
  groupId: string,
  category: "Friends" | "Family"
): Promise<string[]> {
  // Get matched prompt IDs that haven't been asked yet
  const { data: matches, error } = await supabase
    .from("group_question_matches")
    .select("prompt_id, prompt:prompts(category, ice_breaker)")
    .eq("group_id", groupId)
    .eq("asked", false)

  if (error) throw error

  // Filter by category and return prompt IDs
  const matchedIds = (matches || [])
    .filter((m: any) => {
      const prompt = m.prompt as any
      return prompt?.category === category
    })
    .map((m: any) => m.prompt_id)

  return matchedIds
}

// Get members who have participated in swiping (for display)
export async function getSwipingParticipants(groupId: string, userId: string): Promise<User[]> {
  // Get distinct users who have swiped in this group (excluding current user)
  const { data: swipes, error } = await supabase
    .from("group_question_swipes")
    .select("user_id, user:users(id, name, avatar_url)")
    .eq("group_id", groupId)
    .neq("user_id", userId)

  if (error) throw error

  // Get unique users
  const userMap = new Map<string, User>()
  for (const swipe of swipes || []) {
    const user = swipe.user as any
    if (user && !userMap.has(user.id)) {
      userMap.set(user.id, {
        id: user.id,
        name: user.name || "Someone",
        avatar_url: user.avatar_url,
        email: "", // Not needed for display
        birthday: "",
        created_at: "",
      } as User)
    }
  }

  return Array.from(userMap.values())
}

// Get match info for a prompt (who matched on it)
export async function getMatchInfo(
  groupId: string,
  promptId: string
): Promise<{ matched: boolean; matchedWithUsers: string[] } | null> {
  // Check if matched
  const { data: match } = await supabase
    .from("group_question_matches")
    .select("id")
    .eq("group_id", groupId)
    .eq("prompt_id", promptId)
    .maybeSingle()

  if (!match) return null

  // Get users who swiped yes
  const { data: yesSwipes, error } = await supabase
    .from("group_question_swipes")
    .select("user_id, user:users(id, name)")
    .eq("group_id", groupId)
    .eq("prompt_id", promptId)
    .eq("response", "yes")

  if (error) throw error

  const matchedWithUsers = (yesSwipes || []).map((s: any) => {
    const user = s.user as any
    return user?.name || "Someone"
  })

  return { matched: true, matchedWithUsers }
}

// ============================================================================
// INTERESTS FUNCTIONS
// ============================================================================

export async function getAllInterests(): Promise<Interest[]> {
  const { data, error } = await supabase
    .from("interests")
    .select("*")
    .order("display_order", { ascending: true })

  if (error) throw error
  return data || []
}

export async function getGroupInterests(groupId: string): Promise<(Interest & { users: User[] })[]> {
  // Get all interests that have been selected by this group
  const { data: groupInterests, error: groupError } = await supabase
    .from("group_interests")
    .select("interest:interests(*)")
    .eq("group_id", groupId)

  if (groupError) throw groupError

  // Get all users in the group
  const { data: members, error: membersError } = await supabase
    .from("group_members")
    .select("user:users(*)")
    .eq("group_id", groupId)

  if (membersError) throw membersError

  const memberIds = (members || []).map((m: any) => m.user?.id).filter(Boolean)

  // For each group interest, get users who selected it
  const result: (Interest & { users: User[] })[] = []
  
  if (groupInterests) {
    for (const item of groupInterests) {
      const interest = item.interest as any
      if (!interest) continue

      // Get users in this group who selected this interest
      const { data: userInterests } = await supabase
        .from("user_interests")
        .select("user:users(*)")
        .eq("interest_id", interest.id)
        .in("user_id", memberIds)

      const users = (userInterests || [])
        .map((ui: any) => ui.user)
        .filter(Boolean) as User[]

      result.push({
        ...interest,
        users,
      })
    }
  }
  
  return result
}

export async function getUserInterestsForGroup(groupId: string, userId: string): Promise<string[]> {
  // Get interest IDs that this user has selected
  const { data, error } = await supabase
    .from("user_interests")
    .select("interest:interests(name)")
    .eq("user_id", userId)

  if (error) throw error
  
  // Also check if these interests are selected by the group
  const userInterestNames = (data || []).map((item: any) => item.interest?.name).filter(Boolean)
  
  // Get group interests to filter
  const { data: groupInterests } = await supabase
    .from("group_interests")
    .select("interest:interests(name)")
    .eq("group_id", groupId)
  
  const groupInterestNames = new Set((groupInterests || []).map((item: any) => item.interest?.name).filter(Boolean))
  
  // Return only interests that are both user and group interests
  return userInterestNames.filter((name: string) => groupInterestNames.has(name))
}

export async function toggleUserInterest(groupId: string, userId: string, interestId: string, isSelected: boolean): Promise<void> {
  if (isSelected) {
    // Add user interest
    const { error: userError } = await supabase
      .from("user_interests")
      .upsert({ user_id: userId, interest_id: interestId }, { onConflict: "user_id,interest_id" })
    
    if (userError) throw userError
    
    // Ensure group interest exists
    const { error: groupError } = await supabase
      .from("group_interests")
      .upsert({ group_id: groupId, interest_id: interestId }, { onConflict: "group_id,interest_id" })
    
    if (groupError) throw groupError
  } else {
    // Remove user interest
    const { error: userError } = await supabase
      .from("user_interests")
      .delete()
      .eq("user_id", userId)
      .eq("interest_id", interestId)
    
    if (userError) throw userError
    
    // Check if any other users in the group have this interest
    const { data: otherUsers } = await supabase
      .from("user_interests")
      .select("user_id")
      .eq("interest_id", interestId)
      .neq("user_id", userId)
    
    // Check if any of these users are in the group
    if (otherUsers && otherUsers.length > 0) {
      const { data: groupMembers } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId)
        .in("user_id", otherUsers.map(u => u.user_id))
      
      // If no group members have this interest, remove from group_interests
      if (!groupMembers || groupMembers.length === 0) {
        const { error: groupError } = await supabase
          .from("group_interests")
          .delete()
          .eq("group_id", groupId)
          .eq("interest_id", interestId)
        
        if (groupError) throw groupError
      }
    } else {
      // No other users have this interest, remove from group_interests
      const { error: groupError } = await supabase
        .from("group_interests")
        .delete()
        .eq("group_id", groupId)
        .eq("interest_id", interestId)
      
      if (groupError) throw groupError
    }
  }
}

// Status functions
export async function getUserStatus(
  userId: string,
  groupId: string,
  date: string
): Promise<UserStatus | null> {
  const { data: status, error } = await supabase
    .from("user_statuses")
    .select("*, user:users(id, name, avatar_url)")
    .eq("user_id", userId)
    .eq("group_id", groupId)
    .eq("date", date)
    .maybeSingle()

  if (error) {
    console.error("[db] Error fetching user status:", error)
    throw error
  }

  return status || null
}

export async function getStatusesForDate(
  groupId: string,
  date: string
): Promise<UserStatus[]> {
  const { data: statuses, error } = await supabase
    .from("user_statuses")
    .select("*, user:users(id, name, avatar_url)")
    .eq("group_id", groupId)
    .eq("date", date)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("[db] Error fetching statuses for date:", error)
    throw error
  }

  return statuses || []
}

export async function createOrUpdateUserStatus(
  userId: string,
  groupId: string,
  date: string,
  statusText: string
): Promise<UserStatus> {
  // Check if status already exists
  const existing = await getUserStatus(userId, groupId, date)

  if (existing) {
    // Update existing status
    const { data: status, error } = await supabase
      .from("user_statuses")
      .update({
        status_text: statusText,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("*, user:users(id, name, avatar_url)")
      .single()

    if (error) {
      console.error("[db] Error updating user status:", error)
      throw error
    }

    return status
  } else {
    // Create new status
    const { data: status, error } = await supabase
      .from("user_statuses")
      .insert({
        user_id: userId,
        group_id: groupId,
        date: date,
        status_text: statusText,
      })
      .select("*, user:users(id, name, avatar_url)")
      .single()

    if (error) {
      console.error("[db] Error creating user status:", error)
      throw error
    }

    return status
  }
}

export async function deleteUserStatus(
  userId: string,
  groupId: string,
  date: string
): Promise<void> {
  const { error } = await supabase
    .from("user_statuses")
    .delete()
    .eq("user_id", userId)
    .eq("group_id", groupId)
    .eq("date", date)

  if (error) {
    console.error("[db] Error deleting user status:", error)
    throw error
  }
}
