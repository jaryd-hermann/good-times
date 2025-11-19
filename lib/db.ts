import { supabase } from "./supabase"
import type { User, Group, GroupMember, Prompt, DailyPrompt, Entry, Memorial, Reaction, Comment } from "./types"
import { personalizeMemorialPrompt, replaceDynamicVariables } from "./prompts"

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

export async function createGroup(name: string, type: "family" | "friends", userId: string): Promise<Group> {
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
        
        // If it's a "their_birthday" prompt, we need the birthday person's name
        if (prompt.birthday_type === "their_birthday") {
          // Get the birthday person's name from the group members
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
                break
              }
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

  // Check for general prompt (applies to all members)
  const { data: existing, error: existingError } = await supabase
    .from("daily_prompts")
    .select("*, prompt:prompts(*)")
    .eq("group_id", groupId)
    .eq("date", date)
    .is("user_id", null)
    .maybeSingle()

  if (existing && !existingError && existing.prompt) {
    // Personalize prompts with dynamic variables using usage tracking
    const prompt = existing.prompt as any
    let personalizedQuestion = prompt.question

    // Handle dynamic variables
    if (prompt.dynamic_variables && Array.isArray(prompt.dynamic_variables)) {
      const variables: Record<string, string> = {}

      // Handle memorial_name variable
      if (prompt.dynamic_variables.includes("memorial_name") && prompt.category === "Remembering") {
        const memorials = await getMemorials(groupId)
        if (memorials.length > 0) {
          // Get recently used memorial names for this prompt
          const { data: recentUsage } = await supabase
            .from("prompt_name_usage")
            .select("name_used")
            .eq("group_id", groupId)
            .eq("prompt_id", prompt.id)
            .eq("variable_type", "memorial_name")
            .order("date_used", { ascending: false })
            .limit(memorials.length)

          const usedNames = new Set(recentUsage?.map((u) => u.name_used) || [])
          
          // Find unused memorials first
          const unusedMemorials = memorials.filter((m) => !usedNames.has(m.name))
          
          // If all have been used, reset and start fresh
          const availableMemorials = unusedMemorials.length > 0 ? unusedMemorials : memorials
          
          // Select next memorial (cycle through)
          const dayIndex = getDayIndex(date, groupId)
          const memorialIndex = dayIndex % availableMemorials.length
          const selectedMemorial = availableMemorials[memorialIndex]
          
          variables.memorial_name = selectedMemorial.name

          // Record usage for this date (ignore errors if already exists)
          await supabase.from("prompt_name_usage").insert({
            group_id: groupId,
            prompt_id: prompt.id,
            variable_type: "memorial_name",
            name_used: selectedMemorial.name,
            date_used: date,
          }).catch(() => {
            // Ignore duplicate errors - usage already recorded
          })
        }
      }

      // Handle member_name variable
      if (prompt.dynamic_variables.includes("member_name")) {
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
                
                // Record usage for this date (ignore errors if already exists)
                await supabase.from("prompt_name_usage").insert({
                  group_id: groupId,
                  prompt_id: prompt.id,
                  variable_type: "member_name",
                  name_used: variables.member_name,
                  date_used: date,
                }).catch(() => {
                  // Ignore duplicate errors - usage already recorded
                })
                break
              }
            }
          }
        } else {
          // For general prompts with member_name, cycle through all group members
          const members = await getGroupMembers(groupId)
          if (members.length > 0) {
            // Get recently used member names for this prompt
            const { data: recentUsage } = await supabase
              .from("prompt_name_usage")
              .select("name_used")
              .eq("group_id", groupId)
              .eq("prompt_id", prompt.id)
              .eq("variable_type", "member_name")
              .order("date_used", { ascending: false })
              .limit(members.length)

            const usedNames = new Set(recentUsage?.map((u) => u.name_used) || [])
            
            // Find unused members first (filter by name)
            const unusedMembers = members.filter((m) => {
              const memberName = m.user?.name || "Unknown"
              return !usedNames.has(memberName)
            })
            
            // If all have been used, reset and start fresh
            const availableMembers = unusedMembers.length > 0 ? unusedMembers : members
            
            // Select next member (cycle through)
            const dayIndex = getDayIndex(date, groupId)
            const memberIndex = dayIndex % availableMembers.length
            const selectedMember = availableMembers[memberIndex]
            
            variables.member_name = selectedMember.user?.name || "them"

            // Record usage for this date (ignore errors if already exists)
            await supabase.from("prompt_name_usage").insert({
              group_id: groupId,
              prompt_id: prompt.id,
              variable_type: "member_name",
              name_used: variables.member_name,
              date_used: date,
            }).catch(() => {
              // Ignore duplicate errors - usage already recorded
            })
          }
        }
      }

      // Replace variables in question text
      if (Object.keys(variables).length > 0) {
        personalizedQuestion = replaceDynamicVariables(prompt.question, variables)
      }
    } else if (prompt.category === "Remembering") {
      // Legacy support: if no dynamic_variables but category is Remembering, use old logic
      const memorials = await getMemorials(groupId)
      if (memorials.length > 0) {
        // Get recently used memorial names for this prompt
        const { data: recentUsage } = await supabase
          .from("prompt_name_usage")
          .select("name_used")
          .eq("group_id", groupId)
          .eq("prompt_id", prompt.id)
          .eq("variable_type", "memorial_name")
          .order("date_used", { ascending: false })
          .limit(memorials.length)

        const usedNames = new Set(recentUsage?.map((u) => u.name_used) || [])
        const unusedMemorials = memorials.filter((m) => !usedNames.has(m.name))
        const availableMemorials = unusedMemorials.length > 0 ? unusedMemorials : memorials
        
        const dayIndex = getDayIndex(date, groupId)
        const memorialIndex = dayIndex % availableMemorials.length
        const selectedMemorial = availableMemorials[memorialIndex]
        
        personalizedQuestion = personalizeMemorialPrompt(prompt.question, selectedMemorial.name)

        // Record usage
        await supabase.from("prompt_name_usage").insert({
          group_id: groupId,
          prompt_id: prompt.id,
          variable_type: "memorial_name",
          name_used: selectedMemorial.name,
          date_used: date,
        }).catch(() => {
          // Ignore duplicate errors
        })
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
      // Filter out "Remembering" category if no memorials
      if (queuedPrompt.category === "Remembering" && !hasMemorials) {
        // Skip this queued prompt if it's Remembering and group has no memorials
        // Continue to Step 2 to find another prompt
      } else if (group?.type === "family" && queuedPrompt.category === "Friends") {
        // Skip Friends category prompts for Family groups
      } else if (group?.type === "friends" && queuedPrompt.category === "Family") {
        // Skip Family category prompts for Friends groups
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

      // Get all prompts, excluding used ones
      let availablePrompts: Prompt[] = []
      
      if (usedPromptIds.length > 0) {
        // Get all prompts and filter out used ones in JavaScript
        const { data: allPromptsData, error: promptsError } = await supabase
          .from("prompts")
          .select("*")
        
        if (promptsError) throw promptsError
        availablePrompts = (allPromptsData || []).filter((p) => !usedPromptIds.includes(p.id))
      } else {
        // No used prompts yet, get all
        const { data: allPromptsData, error: promptsError } = await supabase
          .from("prompts")
          .select("*")
        
        if (promptsError) throw promptsError
        availablePrompts = allPromptsData || []
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
        // Get recently used memorial names for this prompt
        const { data: recentUsage } = await supabase
          .from("prompt_name_usage")
          .select("name_used")
          .eq("group_id", groupId)
          .eq("prompt_id", prompt.id)
          .eq("variable_type", "memorial_name")
          .order("date_used", { ascending: false })
          .limit(memorials.length)

        const usedNames = new Set(recentUsage?.map((u) => u.name_used) || [])
        const unusedMemorials = memorials.filter((m) => !usedNames.has(m.name))
        const availableMemorials = unusedMemorials.length > 0 ? unusedMemorials : memorials
        
        const dayIndex = getDayIndex(date, groupId)
        const memorialIndex = dayIndex % availableMemorials.length
        const selectedMemorial = availableMemorials[memorialIndex]
        
        variables.memorial_name = selectedMemorial.name

        // Record usage
        await supabase.from("prompt_name_usage").insert({
          group_id: groupId,
          prompt_id: prompt.id,
          variable_type: "memorial_name",
          name_used: selectedMemorial.name,
          date_used: date,
        }).catch(() => {
          // Ignore duplicate errors
        })
      }

      // Handle member_name variable
      if (prompt.dynamic_variables.includes("member_name")) {
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
                
                // Record usage
                await supabase.from("prompt_name_usage").insert({
                  group_id: groupId,
                  prompt_id: prompt.id,
                  variable_type: "member_name",
                  name_used: variables.member_name,
                  date_used: date,
                }).catch(() => {
                  // Ignore duplicate errors
                })
                break
              }
            }
          }
        } else {
          // For general prompts with member_name, cycle through all group members
          const members = await getGroupMembers(groupId)
          if (members.length > 0) {
            // Get recently used member names for this prompt
            const { data: recentUsage } = await supabase
              .from("prompt_name_usage")
              .select("name_used")
              .eq("group_id", groupId)
              .eq("prompt_id", prompt.id)
              .eq("variable_type", "member_name")
              .order("date_used", { ascending: false })
              .limit(members.length)

            const usedNames = new Set(recentUsage?.map((u) => u.name_used) || [])
            
            // Find unused members first (filter by name)
            const unusedMembers = members.filter((m) => {
              const memberName = m.user?.name || "Unknown"
              return !usedNames.has(memberName)
            })
            
            // If all have been used, reset and start fresh
            const availableMembers = unusedMembers.length > 0 ? unusedMembers : members
            
            // Select next member (cycle through)
            const dayIndex = getDayIndex(date, groupId)
            const memberIndex = dayIndex % availableMembers.length
            const selectedMember = availableMembers[memberIndex]
            
            variables.member_name = selectedMember.user?.name || "them"

            // Record usage
            await supabase.from("prompt_name_usage").insert({
              group_id: groupId,
              prompt_id: prompt.id,
              variable_type: "member_name",
              name_used: variables.member_name,
              date_used: date,
            }).catch(() => {
              // Ignore duplicate errors
            })
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
      const { data: recentUsage } = await supabase
        .from("prompt_name_usage")
        .select("name_used")
        .eq("group_id", groupId)
        .eq("prompt_id", prompt.id)
        .eq("variable_type", "memorial_name")
        .order("date_used", { ascending: false })
        .limit(memorials.length)

      const usedNames = new Set(recentUsage?.map((u) => u.name_used) || [])
      const unusedMemorials = memorials.filter((m) => !usedNames.has(m.name))
      const availableMemorials = unusedMemorials.length > 0 ? unusedMemorials : memorials
      
      const dayIndex = getDayIndex(date, groupId)
      const memorialIndex = dayIndex % availableMemorials.length
      const selectedMemorial = availableMemorials[memorialIndex]
      
      const personalizedQuestion = personalizeMemorialPrompt(prompt.question, selectedMemorial.name)
      personalizedPrompt = {
        ...prompt,
        question: personalizedQuestion,
      }

      // Record usage
      await supabase.from("prompt_name_usage").insert({
        group_id: groupId,
        prompt_id: prompt.id,
        variable_type: "memorial_name",
        name_used: selectedMemorial.name,
        date_used: date,
      }).catch(() => {
        // Ignore duplicate errors
      })
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
    .order("created_at", { ascending: true })

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
  embedded_media?: any[] // JSONB array
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
export async function getReactions(entryId: string): Promise<Reaction[]> {
  const { data, error } = await supabase.from("reactions").select("*").eq("entry_id", entryId)
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

// Comment queries
export async function getComments(entryId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("*, user:users(*)")
    .eq("entry_id", entryId)
    .order("created_at", { ascending: true })

  if (error) throw error
  return data || []
}

export async function createComment(entryId: string, userId: string, text: string): Promise<Comment> {
  const { data, error } = await supabase
    .from("comments")
    .insert({ entry_id: entryId, user_id: userId, text })
    .select("*, user:users(*)")
    .single()

  if (error) throw error
  return data
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
