import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Seeded random number generator for deterministic but unique randomization per group
function seededRandom(seed: string): () => number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  let value = Math.abs(hash) / 2147483647 // Normalize to 0-1
  
  return () => {
    value = (value * 9301 + 49297) % 233280
    return value / 233280
  }
}

// Shuffle array using seeded random
function seededShuffle<T>(array: T[], seed: string): T[] {
  const rng = seededRandom(seed)
  const shuffled = [...array]
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  
  return shuffled
}

// Determine eligible categories based on group settings
function getEligibleCategories(
  groupType: "family" | "friends",
  hasNSFW: boolean,
  hasMemorials: boolean,
  disabledCategories: Set<string>
): string[] {
  const eligible: string[] = []
  
  // Always eligible categories
  if (!disabledCategories.has("Fun")) {
    eligible.push("Fun")
  }
  if (!disabledCategories.has("A Bit Deeper")) {
    eligible.push("A Bit Deeper")
  }
  
  // Group type specific
  if (groupType === "family" && !disabledCategories.has("Family")) {
    eligible.push("Family")
  } else if (groupType === "friends" && !disabledCategories.has("Friends")) {
    eligible.push("Friends")
  }
  
  // Conditional categories
  if (hasNSFW && !disabledCategories.has("Edgy/NSFW")) {
    eligible.push("Edgy/NSFW")
  }
  
  if (hasMemorials && !disabledCategories.has("Remembering")) {
    eligible.push("Remembering")
  }
  
  return eligible
}

// Get category weights from preferences (default weight is 1.0)
function getCategoryWeights(preferences: any[]): Map<string, number> {
  const weights = new Map<string, number>()
  
  for (const pref of preferences) {
    if (pref.preference === "none") {
      weights.set(pref.category, 0) // Disabled
    } else {
      weights.set(pref.category, pref.weight || 1.0)
    }
  }
  
  return weights
}

// Select prompt ensuring category variety
function selectPromptWithVariety(
  availablePrompts: any[],
  eligibleCategories: string[],
  categoryWeights: Map<string, number>,
  usedCategories: Map<string, number>, // category -> count in last 7 days
  rng: () => number
): any | null {
  if (availablePrompts.length === 0) return null
  
  // Find categories that haven't been used recently (priority)
  const unusedCategories = eligibleCategories.filter(
    (cat) => !usedCategories.has(cat) || usedCategories.get(cat)! === 0
  )
  
  // Find categories used least (secondary priority)
  const categoryUsageCounts = Array.from(usedCategories.entries())
    .filter(([cat]) => eligibleCategories.includes(cat))
    .sort((a, b) => a[1] - b[1])
  
  const leastUsedCategory = categoryUsageCounts.length > 0 
    ? categoryUsageCounts[0][0] 
    : null
  
  // Prefer unused categories, then least used
  const preferredCategory = unusedCategories.length > 0 
    ? unusedCategories[Math.floor(rng() * unusedCategories.length)]
    : leastUsedCategory || eligibleCategories[Math.floor(rng() * eligibleCategories.length)]
  
  // Filter prompts by preferred category
  const categoryPrompts = availablePrompts.filter(
    (p) => p.category === preferredCategory
  )
  
  // If no prompts in preferred category, use all available
  const promptsToSelect = categoryPrompts.length > 0 ? categoryPrompts : availablePrompts
  
  // Apply weights for selection
  const weightedPrompts: Array<{ prompt: any; weight: number }> = promptsToSelect.map((prompt) => {
    const weight = categoryWeights.get(prompt.category) ?? 1.0
    return { prompt, weight: Math.max(0, weight) } // Ensure non-negative
  })
  
  // Create selection pool based on weights
  const selectionPool: any[] = []
  weightedPrompts.forEach(({ prompt, weight }) => {
    const count = Math.max(1, Math.ceil(weight * 10)) // Scale weight
    for (let i = 0; i < count; i++) {
      selectionPool.push(prompt)
    }
  })
  
  if (selectionPool.length === 0) return null
  
  // Select random prompt from weighted pool
  return selectionPool[Math.floor(rng() * selectionPool.length)]
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    let requestBody
    try {
      requestBody = await req.json()
    } catch (jsonError) {
      console.error("[initialize-group-queue] Failed to parse request body:", jsonError)
      return new Response(
        JSON.stringify({ success: false, error: "Invalid request body" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      )
    }

    const { group_id, group_type, created_by, enable_nsfw, has_memorials } = requestBody

    console.log(`[initialize-group-queue] Received parameters:`, {
      group_id,
      group_type,
      enable_nsfw,
      enable_nsfw_type: typeof enable_nsfw,
      enable_nsfw_value: enable_nsfw
    })

    if (!group_id || !group_type) {
      throw new Error("group_id and group_type are required")
    }

    // Get group details including ice-breaker completion status
    const { data: groupData, error: groupError } = await supabaseClient
      .from("groups")
      .select("type, created_at, ice_breaker_queue_completed_date")
      .eq("id", group_id)
      .single()

    if (groupError) throw groupError
    if (!groupData) throw new Error("Group not found")

    const groupType = groupData.type as "family" | "friends"
    const isIceBreakerInitialization = !groupData.ice_breaker_queue_completed_date
    const groupCategory = groupType === "friends" ? "Friends" : "Family" // Used for ice-breaker queries
    
    console.log(`[initialize-group-queue] Ice-breaker initialization: ${isIceBreakerInitialization}, completion date: ${groupData.ice_breaker_queue_completed_date}`)

    // Check for memorials: use passed parameter first, then check database
    let hasMemorials = false
    if (has_memorials !== undefined && has_memorials !== null) {
      // Use passed parameter (avoids race condition when memorials are created after group)
      hasMemorials = has_memorials === true || has_memorials === "true"
      console.log(`[initialize-group-queue] Memorials from parameter: ${has_memorials} → hasMemorials: ${hasMemorials}`)
    } else {
      // Fallback: check database (might be set already)
      const { data: memorials } = await supabaseClient
        .from("memorials")
        .select("id")
        .eq("group_id", group_id)
        .limit(1)
      
      hasMemorials = (memorials?.length || 0) > 0
      console.log(`[initialize-group-queue] Memorials from database: ${memorials?.length || 0} → hasMemorials: ${hasMemorials}`)
    }

    // Get category preferences (may be empty for new groups)
    const { data: preferences } = await supabaseClient
      .from("question_category_preferences")
      .select("category, preference, weight")
      .eq("group_id", group_id)

    // Determine disabled categories
    const disabledCategories = new Set<string>(
      (preferences || []).filter((p) => p.preference === "none").map((p) => p.category)
    )

    // Check NSFW preference: use passed parameter first, then check preferences, then default to false
    // For friends groups, NSFW is opt-in (default false), for family groups it's always disabled
    let hasNSFW = false
    if (groupType === "friends") {
      if (enable_nsfw !== undefined && enable_nsfw !== null) {
        // Use passed parameter (avoids race condition)
        // Handle both boolean true/false and string "true"/"false"
        hasNSFW = enable_nsfw === true || enable_nsfw === "true"
        console.log(`[initialize-group-queue] NSFW from parameter: ${enable_nsfw} → hasNSFW: ${hasNSFW}`)
      } else {
        // Fallback: check preferences (might be set already)
        const nsfwPref = (preferences || []).find((p) => p.category === "Edgy/NSFW")
        hasNSFW = nsfwPref ? nsfwPref.preference !== "none" : false // Default to false if not set
        console.log(`[initialize-group-queue] NSFW from preferences:`, nsfwPref, `→ hasNSFW: ${hasNSFW}`)
      }
    } else {
      console.log(`[initialize-group-queue] Group type is ${groupType}, NSFW always disabled`)
    }
    // For family groups, NSFW is always disabled
    
    console.log(`[initialize-group-queue] Final hasNSFW value: ${hasNSFW}`)

    // Get category weights
    const categoryWeights = getCategoryWeights(preferences || [])

    // Determine eligible categories
    const eligibleCategories = getEligibleCategories(
      groupType,
      hasNSFW,
      hasMemorials,
      disabledCategories
    )
    
    console.log(`[initialize-group-queue] Eligible categories determined:`, {
      groupType,
      hasNSFW,
      hasMemorials,
      disabledCategories: Array.from(disabledCategories),
      eligibleCategories
    })

    if (eligibleCategories.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No eligible categories for this group" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      )
    }

    // Get prompts based on initialization type
    let allPrompts: any[] = []
    
    if (isIceBreakerInitialization) {
      // ICE-BREAKER INITIALIZATION: Use ice-breaker questions only
      console.log(`[initialize-group-queue] ICE-BREAKER MODE: Fetching ice-breaker questions for ${groupType} groups`)
      
      // Fetch ice-breaker questions: ice_breaker = TRUE, category matches group type
      // Exclude: birthday prompts, memorial prompts (filter dynamic variables in JS)
      const { data: iceBreakerPromptsRaw, error: iceBreakerError } = await supabaseClient
        .from("prompts")
        .select("*")
        .eq("ice_breaker", true)
        .eq("category", groupCategory)
        .is("birthday_type", null) // Exclude birthday prompts
        .neq("category", "Remembering") // Exclude memorial prompts
      
      if (iceBreakerError) throw iceBreakerError
      
      // Filter out dynamic variables in JavaScript (check for null or empty array)
      const iceBreakerPrompts = (iceBreakerPromptsRaw || []).filter((p: any) => {
        const hasDynamicVars = p.dynamic_variables && 
          Array.isArray(p.dynamic_variables) && 
          p.dynamic_variables.length > 0
        return !hasDynamicVars
      })
      
      console.log(`[initialize-group-queue] Found ${iceBreakerPrompts.length} ice-breaker questions (filtered from ${iceBreakerPromptsRaw?.length || 0} total)`)
      
      // If we have fewer than 15 ice-breaker questions, fill with fallback
      if ((iceBreakerPrompts?.length || 0) < 15) {
        const needed = 15 - (iceBreakerPrompts?.length || 0)
        console.log(`[initialize-group-queue] Need ${needed} more questions, fetching fallback questions`)
        
        // Fallback: FRIEND/FAMILY + Fun category, excluding Edgy/NSFW, A Bit Deeper
        const fallbackCategories = [groupCategory, "Fun"]
        const { data: fallbackPromptsRaw, error: fallbackError } = await supabaseClient
          .from("prompts")
          .select("*")
          .in("category", fallbackCategories)
          .not("category", "eq", "Edgy/NSFW")
          .not("category", "eq", "A Bit Deeper")
          .is("birthday_type", null)
          .neq("category", "Remembering")
          .eq("ice_breaker", false) // Don't double-count ice-breaker questions
        
        if (fallbackError) throw fallbackError
        
        // Filter out dynamic variables and exclude already-selected ice-breaker prompts
        const iceBreakerIds = new Set(iceBreakerPrompts.map((p: any) => p.id))
        const fallbackPrompts = (fallbackPromptsRaw || []).filter((p: any) => {
          const hasDynamicVars = p.dynamic_variables && 
            Array.isArray(p.dynamic_variables) && 
            p.dynamic_variables.length > 0
          return !hasDynamicVars && !iceBreakerIds.has(p.id)
        })
        
        // Combine ice-breaker + fallback, limit to needed amount
        const fallbackToAdd = fallbackPrompts.slice(0, needed)
        allPrompts = [...iceBreakerPrompts, ...fallbackToAdd]
        console.log(`[initialize-group-queue] Combined ${iceBreakerPrompts.length} ice-breaker + ${fallbackToAdd.length} fallback = ${allPrompts.length} total`)
      } else {
        // Use only ice-breaker questions (take first 15 if more exist)
        allPrompts = iceBreakerPrompts.slice(0, 15)
        console.log(`[initialize-group-queue] Using ${allPrompts.length} ice-breaker questions`)
      }
      
      // Full fallback: If no ice-breaker questions exist, use all FRIEND/FAMILY + Fun
      if (allPrompts.length === 0) {
        console.log(`[initialize-group-queue] No ice-breaker questions found, using full fallback`)
        const fallbackCategories = [groupCategory, "Fun"]
        const { data: fullFallbackPromptsRaw, error: fullFallbackError } = await supabaseClient
          .from("prompts")
          .select("*")
          .in("category", fallbackCategories)
          .not("category", "eq", "Edgy/NSFW")
          .not("category", "eq", "A Bit Deeper")
          .is("birthday_type", null)
          .neq("category", "Remembering")
        
        if (fullFallbackError) throw fullFallbackError
        
        // Filter out dynamic variables
        allPrompts = (fullFallbackPromptsRaw || []).filter((p: any) => {
          const hasDynamicVars = p.dynamic_variables && 
            Array.isArray(p.dynamic_variables) && 
            p.dynamic_variables.length > 0
          return !hasDynamicVars
        })
        console.log(`[initialize-group-queue] Full fallback found ${allPrompts.length} questions`)
      }
    } else {
      // NORMAL INITIALIZATION: Use existing logic
      console.log(`[initialize-group-queue] NORMAL MODE: Fetching prompts for categories:`, eligibleCategories)
      const { data: normalPrompts, error: promptsError } = await supabaseClient
      .from("prompts")
      .select("*")
      .in("category", eligibleCategories)
      .is("birthday_type", null) // Exclude birthday prompts

    if (promptsError) throw promptsError
      allPrompts = normalPrompts || []
    }

    if (allPrompts.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No prompts available for eligible categories",
          eligible_categories: isIceBreakerInitialization ? [groupType === "friends" ? "Friends" : "Family"] : eligibleCategories
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      )
    }

    // Verify all prompts are in eligible categories (safety check)
    const invalidPrompts = allPrompts.filter((p) => !eligibleCategories.includes(p.category))
    if (invalidPrompts.length > 0) {
      console.warn(`[initialize-group-queue] Found ${invalidPrompts.length} prompts with invalid categories:`, invalidPrompts.map(p => ({ id: p.id, category: p.category })))
    }
    
    console.log(`[initialize-group-queue] Found ${allPrompts.length} prompts across categories:`, 
      Array.from(new Set(allPrompts.map(p => p.category))))

    // For NEW groups, delete ALL existing prompts to ensure clean initialization
    // This prevents any pre-existing prompts from interfering
    console.log(`[initialize-group-queue] Checking for existing prompts for group ${group_id}`)
    const today = new Date().toISOString().split("T")[0]
    
    // First, check if prompts exist (without join to avoid potential issues)
    const { data: existingPromptIds, error: checkError } = await supabaseClient
      .from("daily_prompts")
      .select("prompt_id")
      .eq("group_id", group_id)
      .gte("date", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
      .is("user_id", null) // Only check general prompts
      .limit(1)
    
    if (checkError) {
      console.error(`[initialize-group-queue] Error checking existing prompts:`, checkError)
      // Continue anyway - better to regenerate than fail completely
    }
    
    console.log(`[initialize-group-queue] Found ${existingPromptIds?.length || 0} existing prompts`)
    
    // If prompts exist, fetch their categories to validate
    let needsRegeneration = false
    if (existingPromptIds && existingPromptIds.length > 0) {
      // Get the actual prompt categories
      const promptIds = existingPromptIds.map((ep: any) => ep.prompt_id)
      const { data: promptCategories } = await supabaseClient
        .from("prompts")
        .select("id, category")
        .in("id", promptIds)
      
      if (promptCategories) {
        for (const prompt of promptCategories) {
          // Check if prompt category doesn't match group type
          if (groupType === "friends" && prompt.category === "Family") {
            needsRegeneration = true
            break
          } else if (groupType === "family" && prompt.category === "Friends") {
            needsRegeneration = true
            break
          }
          
          // Check if prompt category is not in eligible categories
          if (!eligibleCategories.includes(prompt.category)) {
            needsRegeneration = true
            break
          }
        }
      }
      
      // If prompts are correct, skip initialization
      if (!needsRegeneration) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Queue already initialized with correct categories",
            prompts_scheduled: 0 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
      
      // Delete incorrect prompts before regenerating
      console.log(`[initialize-group-queue] Deleting incorrect prompts for group ${group_id}`)
      const { data: deletedData, error: deleteError } = await supabaseClient
        .from("daily_prompts")
        .delete()
        .eq("group_id", group_id)
        .gte("date", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
        .is("user_id", null) // Only delete general prompts, keep birthday prompts
        .select() // Return deleted rows to verify
      
      if (deleteError) {
        console.error(`[initialize-group-queue] Error deleting prompts:`, deleteError)
      } else {
        console.log(`[initialize-group-queue] Successfully deleted ${deletedData?.length || 0} prompts`)
      }
    } else {
      console.log(`[initialize-group-queue] No existing prompts found, proceeding with fresh initialization`)
    }

    // Generate dates: 7 days past + today + 7 days future (15 days total)
    // For ice-breaker mode, we'll extend this if birthdays are inserted
    const baseDates: string[] = []
    const todayDate = new Date(today)
    
    for (let i = -7; i <= 7; i++) {
      const date = new Date(todayDate)
      date.setDate(date.getDate() + i)
      baseDates.push(date.toISOString().split("T")[0])
    }

    // For ice-breaker initialization, check for birthdays and handle them
    let dates = [...baseDates]
    let birthdayPrompts: Array<{ date: string; prompt_id: string; user_id: string }> = []
    
    if (isIceBreakerInitialization) {
      // Check for birthdays in the date range
      const startDate = baseDates[0]
      const endDate = baseDates[baseDates.length - 1]
      
      // Get group members and their birthdays
      const { data: members, error: membersError } = await supabaseClient
        .from("group_members")
        .select("user_id, user:users(id, birthday)")
        .eq("group_id", group_id)
      
      if (membersError) {
        console.error(`[initialize-group-queue] Error fetching members:`, membersError)
      } else if (members && members.length > 0) {
        // Check each member's birthday
        for (const member of members) {
          const user = (member as any).user
          if (user && user.birthday) {
            const birthday = new Date(user.birthday)
            const birthdayMonthDay = `${String(birthday.getMonth() + 1).padStart(2, '0')}-${String(birthday.getDate()).padStart(2, '0')}`
            
            // Check if birthday falls within our date range
            for (const date of baseDates) {
              const dateMonthDay = date.substring(5) // MM-DD format
              if (dateMonthDay === birthdayMonthDay) {
                // Find birthday prompt for "their_birthday" (for other members)
                const { data: birthdayPrompt } = await supabaseClient
                  .from("prompts")
                  .select("*")
                  .eq("birthday_type", "their_birthday")
                  .eq("category", groupCategory)
                  .limit(1)
                  .maybeSingle()
                
                if (birthdayPrompt) {
                  birthdayPrompts.push({
                    date,
                    prompt_id: birthdayPrompt.id,
                    user_id: user.id
                  })
                  console.log(`[initialize-group-queue] Found birthday for user ${user.id} on ${date}`)
                }
                break
              }
            }
          }
        }
      }
      
      // If we have birthdays, we need to shift remaining prompts
      // For now, we'll handle this after initial scheduling
    }

    // Shuffle prompts using group-specific seed
    const seed = `${group_id}-${groupData.created_at}`
    let shuffledPrompts = seededShuffle(allPrompts, seed) // Use let to allow reassignment
    const rng = seededRandom(seed)

    // Track category usage for variety (only used in normal mode)
    const categoryUsage = new Map<string, number>() // category -> count in current 7-day window
    let scheduledPrompts: Array<{ date: string; prompt_id: string }> = [] // Use let to allow filtering
    const usedPromptIds = new Set<string>()

    // Generate queue for each date
    for (const date of dates) {
      // Reset category usage every 7 days
      const dateIndex = dates.indexOf(date)
      if (dateIndex % 7 === 0) {
        categoryUsage.clear()
      }

      // Get available prompts (not used in this queue yet)
      let availablePrompts = shuffledPrompts.filter(
        (p) => !usedPromptIds.has(p.id)
      )

      // If we've used all prompts, reset and reshuffle
      if (availablePrompts.length === 0) {
        console.log(`[initialize-group-queue] All prompts used, resetting for date ${date}`)
        usedPromptIds.clear()
        // Reshuffle all prompts with a new seed to ensure variety
        shuffledPrompts = seededShuffle(allPrompts, `${seed}-reset-${dateIndex}`)
        // Now get available prompts from the reshuffled list
        availablePrompts = shuffledPrompts.filter(
          (p) => !usedPromptIds.has(p.id)
        )
      }

      // Additional safety check: ensure we don't select a duplicate
      if (availablePrompts.length === 0) {
        console.error(`[initialize-group-queue] No available prompts after reset for ${date}`)
        // Last resort: use all prompts (shouldn't happen, but prevents crash)
        availablePrompts = [...allPrompts]
        usedPromptIds.clear()
      }

      // Select prompt - use simpler logic for ice-breaker mode
      let selectedPrompt: any | null = null
      if (isIceBreakerInitialization) {
        // For ice-breaker mode, just pick from available prompts (no category variety needed)
        if (availablePrompts.length > 0) {
          selectedPrompt = availablePrompts[Math.floor(rng() * availablePrompts.length)]
        }
      } else {
        // Normal mode: use variety selection
        selectedPrompt = selectPromptWithVariety(
        availablePrompts,
        eligibleCategories,
        categoryWeights,
        categoryUsage,
        rng
      )
      }

      if (!selectedPrompt) {
        console.warn(`[initialize-group-queue] No prompt selected for ${date}, skipping`)
        continue
      }

      // Safety check: ensure this prompt hasn't been used already
      if (usedPromptIds.has(selectedPrompt.id)) {
        console.warn(`[initialize-group-queue] Selected prompt ${selectedPrompt.id} was already used, finding alternative`)
        // Find an alternative prompt that hasn't been used
        const alternativePrompts = availablePrompts.filter(
          (p) => p.id !== selectedPrompt.id && !usedPromptIds.has(p.id)
        )
        if (alternativePrompts.length > 0) {
          // Use the first available alternative
          const alternative = alternativePrompts[0]
          console.log(`[initialize-group-queue] Using alternative prompt ${alternative.id} instead`)
          usedPromptIds.add(alternative.id)
          const currentCount = categoryUsage.get(alternative.category) || 0
          categoryUsage.set(alternative.category, currentCount + 1)
          scheduledPrompts.push({
            date,
            prompt_id: alternative.id,
          })
          continue
        } else {
          console.error(`[initialize-group-queue] No alternative prompts available for ${date}`)
          continue
        }
      }

      // Log selected prompt for debugging
      console.log(`[initialize-group-queue] Selected prompt for ${date}:`, {
        id: selectedPrompt.id,
        category: selectedPrompt.category,
        question: selectedPrompt.question?.substring(0, 50) + "..."
      })

      // Track usage
      usedPromptIds.add(selectedPrompt.id)
      const currentCount = categoryUsage.get(selectedPrompt.category) || 0
      categoryUsage.set(selectedPrompt.category, currentCount + 1)

      scheduledPrompts.push({
        date,
        prompt_id: selectedPrompt.id,
      })
    }

    // For ice-breaker mode, handle birthday insertion and shifting
    if (isIceBreakerInitialization && birthdayPrompts.length > 0) {
      console.log(`[initialize-group-queue] Processing ${birthdayPrompts.length} birthday prompts`)
      
      // Create a map of dates to scheduled prompts for easier manipulation
      const promptMap = new Map<string, { prompt_id: string }>()
      for (const sp of scheduledPrompts) {
        promptMap.set(sp.date, { prompt_id: sp.prompt_id })
      }
      
      // Insert birthday prompts and shift remaining prompts forward
      // Sort birthdays by date to process in order
      const sortedBirthdays = [...birthdayPrompts].sort((a, b) => a.date.localeCompare(b.date))
      
      for (const birthday of sortedBirthdays) {
        const birthdayDate = birthday.date
        
        // Check if there's already a prompt scheduled for this date
        if (promptMap.has(birthdayDate)) {
          // Shift all prompts from this date forward by 1 day
          const datesToShift: string[] = []
          for (const date of dates) {
            if (date >= birthdayDate) {
              datesToShift.push(date)
            }
          }
          
          // Shift prompts forward (working backwards to avoid overwriting)
          for (let i = datesToShift.length - 1; i >= 0; i--) {
            const currentDate = datesToShift[i]
            const nextDateIndex = dates.indexOf(currentDate) + 1
            
            if (nextDateIndex < dates.length) {
              const nextDate = dates[nextDateIndex]
              const currentPrompt = promptMap.get(currentDate)
              if (currentPrompt) {
                promptMap.set(nextDate, currentPrompt)
              }
            }
          }
          
          // Insert birthday prompt
          promptMap.set(birthdayDate, { prompt_id: birthday.prompt_id })
          
          // Extend dates array if needed (add one more day at the end)
          const lastDate = dates[dates.length - 1]
          const lastDateObj = new Date(lastDate)
          lastDateObj.setDate(lastDateObj.getDate() + 1)
          const newLastDate = lastDateObj.toISOString().split("T")[0]
          dates.push(newLastDate)
          
          console.log(`[initialize-group-queue] Inserted birthday prompt on ${birthdayDate}, shifted remaining prompts, extended to ${newLastDate}`)
        } else {
          // No prompt scheduled for this date, just insert birthday
          promptMap.set(birthdayDate, { prompt_id: birthday.prompt_id })
          console.log(`[initialize-group-queue] Inserted birthday prompt on ${birthdayDate} (no shift needed)`)
        }
      }
      
      // Rebuild scheduledPrompts from map
      scheduledPrompts = dates
        .filter(date => promptMap.has(date))
        .map(date => ({
          date,
          prompt_id: promptMap.get(date)!.prompt_id
        }))
      
      // Add birthday prompts with user_id for user-specific prompts
      // Note: We'll handle user-specific birthday prompts separately in the insert
    }

    // Log summary of scheduled prompts by category and validate for duplicates
    const categoryCounts = new Map<string, number>()
    const promptIdCounts = new Map<string, number>() // Track prompt ID usage
    const invalidScheduledPrompts: Array<{ date: string; prompt_id: string; category: string }> = []
    const duplicatePrompts: Array<{ date: string; prompt_id: string; count: number }> = []
    
    for (const sp of scheduledPrompts) {
      const prompt = allPrompts.find((p) => p.id === sp.prompt_id)
      if (prompt) {
        // Check for duplicates
        const promptCount = promptIdCounts.get(sp.prompt_id) || 0
        promptIdCounts.set(sp.prompt_id, promptCount + 1)
        if (promptCount > 0) {
          duplicatePrompts.push({
            date: sp.date,
            prompt_id: sp.prompt_id,
            count: promptCount + 1
          })
          console.error(`[initialize-group-queue] DUPLICATE: Prompt ${sp.prompt_id} appears ${promptCount + 1} times!`)
        }
        
        // Validate that prompt category is in eligible categories
        if (!eligibleCategories.includes(prompt.category)) {
          invalidScheduledPrompts.push({
            date: sp.date,
            prompt_id: sp.prompt_id,
            category: prompt.category
          })
          console.error(`[initialize-group-queue] INVALID: Prompt ${sp.prompt_id} has category "${prompt.category}" which is not in eligible categories!`)
        }
        
        const count = categoryCounts.get(prompt.category) || 0
        categoryCounts.set(prompt.category, count + 1)
      } else {
        console.warn(`[initialize-group-queue] Prompt ${sp.prompt_id} not found in allPrompts`)
      }
    }
    
    // Remove duplicates if found
    if (duplicatePrompts.length > 0) {
      console.error(`[initialize-group-queue] Found ${duplicatePrompts.length} duplicate prompts!`, duplicatePrompts)
      // Keep only first occurrence of each prompt
      const seenPromptIds = new Set<string>()
      scheduledPrompts = scheduledPrompts.filter((sp) => {
        if (seenPromptIds.has(sp.prompt_id)) {
          return false // Skip duplicate
        }
        seenPromptIds.add(sp.prompt_id)
        return true
      })
      console.log(`[initialize-group-queue] Removed duplicates, now have ${scheduledPrompts.length} unique prompts`)
    }
    
    console.log(`[initialize-group-queue] Scheduled prompts by category:`, 
      Object.fromEntries(categoryCounts))
    
    if (invalidScheduledPrompts.length > 0) {
      console.error(`[initialize-group-queue] Found ${invalidScheduledPrompts.length} invalid prompts!`, invalidScheduledPrompts)
      // Remove invalid prompts before insertion
      scheduledPrompts = scheduledPrompts.filter((sp) => {
        const prompt = allPrompts.find((p) => p.id === sp.prompt_id)
        return prompt && eligibleCategories.includes(prompt.category)
      })
      console.log(`[initialize-group-queue] Filtered to ${scheduledPrompts.length} valid prompts`)
    }

    // Batch insert all prompts using upsert to handle UNIQUE constraint
    if (scheduledPrompts.length > 0) {
      console.log(`[initialize-group-queue] Attempting to insert ${scheduledPrompts.length} prompts for group ${group_id}`)
      console.log(`[initialize-group-queue] Sample prompt data:`, scheduledPrompts.slice(0, 3))
      
      // Delete existing prompts first to ensure clean insert (handles UNIQUE constraint)
      // The UNIQUE index is on (group_id, date, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'))
      // Since we're inserting with user_id: null, we need to delete first to avoid conflicts
      const datesToInsert = scheduledPrompts.map(sp => sp.date)
      
      // Safely delete existing prompts - wrap in try-catch to handle any errors gracefully
      try {
        const { data: deletedData, error: deleteExistingError } = await supabaseClient
          .from("daily_prompts")
          .delete()
          .eq("group_id", group_id)
          .in("date", datesToInsert)
          .is("user_id", null) // Only delete general prompts
          .select() // Return deleted rows for logging
        
        if (deleteExistingError) {
          console.warn(`[initialize-group-queue] Warning deleting existing prompts (continuing anyway):`, deleteExistingError)
        } else {
          console.log(`[initialize-group-queue] Deleted ${deletedData?.length || 0} existing prompts for dates:`, datesToInsert)
        }
      } catch (deleteError) {
        console.warn(`[initialize-group-queue] Exception during delete (continuing anyway):`, deleteError)
        // Continue - insert will handle conflicts via upsert if needed
      }
      
      // Now insert fresh prompts - use insert since we've already deleted conflicts
      // If delete failed, we'll catch the insert error and handle it
      const { data: insertData, error: insertError } = await supabaseClient
        .from("daily_prompts")
        .insert(
          scheduledPrompts.map((sp) => ({
            group_id,
            prompt_id: sp.prompt_id,
            date: sp.date,
            user_id: null, // General prompts for all members
          }))
        )
        .select() // Return inserted rows to verify

      if (insertError) {
        console.error(`[initialize-group-queue] Error inserting prompts:`, insertError)
        console.error(`[initialize-group-queue] Error code:`, insertError.code)
        console.error(`[initialize-group-queue] Error message:`, insertError.message)
        console.error(`[initialize-group-queue] Error details:`, JSON.stringify(insertError, null, 2))
        throw insertError
      }
      
      console.log(`[initialize-group-queue] Successfully inserted/updated ${scheduledPrompts.length} prompts`)
      console.log(`[initialize-group-queue] Inserted/updated rows count:`, insertData?.length || 0)
      
      // Insert birthday prompts with user_id (user-specific prompts)
      if (isIceBreakerInitialization && birthdayPrompts.length > 0) {
        console.log(`[initialize-group-queue] Inserting ${birthdayPrompts.length} birthday prompts with user_id`)
        
        // Delete existing birthday prompts for these dates first
        const birthdayDates = birthdayPrompts.map(bp => bp.date)
        try {
          await supabaseClient
            .from("daily_prompts")
            .delete()
            .eq("group_id", group_id)
            .in("date", birthdayDates)
            .not("user_id", "is", null) // Only delete user-specific prompts
        } catch (deleteBirthdayError) {
          console.warn(`[initialize-group-queue] Warning deleting existing birthday prompts:`, deleteBirthdayError)
        }
        
        // Insert birthday prompts
        const { data: birthdayInsertData, error: birthdayInsertError } = await supabaseClient
          .from("daily_prompts")
          .insert(
            birthdayPrompts.map((bp) => ({
              group_id,
              prompt_id: bp.prompt_id,
              date: bp.date,
              user_id: bp.user_id, // User-specific prompt
            }))
          )
          .select()
        
        if (birthdayInsertError) {
          console.error(`[initialize-group-queue] Error inserting birthday prompts:`, birthdayInsertError)
        } else {
          console.log(`[initialize-group-queue] Successfully inserted ${birthdayInsertData?.length || 0} birthday prompts`)
        }
      }
      
      // Set completion date for ice-breaker initialization
      if (isIceBreakerInitialization) {
        // Completion date = date after the last prompt
        const lastDate = dates[dates.length - 1]
        const lastDateObj = new Date(lastDate)
        lastDateObj.setDate(lastDateObj.getDate() + 1)
        const completionDate = lastDateObj.toISOString().split("T")[0]
        
        console.log(`[initialize-group-queue] Setting ice_breaker_queue_completed_date to ${completionDate} (day after last prompt: ${lastDate})`)
        
        const { error: updateError } = await supabaseClient
          .from("groups")
          .update({ ice_breaker_queue_completed_date: completionDate })
          .eq("id", group_id)
        
        if (updateError) {
          console.error(`[initialize-group-queue] Error setting completion date:`, updateError)
        } else {
          console.log(`[initialize-group-queue] Successfully set completion date to ${completionDate}`)
        }
      }
      
      // Verify inserts by querying back
      const { data: verifyData, error: verifyError } = await supabaseClient
        .from("daily_prompts")
        .select("id, date, prompt_id")
        .eq("group_id", group_id)
        .in("date", scheduledPrompts.map(sp => sp.date))
        .is("user_id", null) // Only check general prompts
      
      if (verifyError) {
        console.error(`[initialize-group-queue] Error verifying inserts:`, verifyError)
      } else {
        console.log(`[initialize-group-queue] Verified ${verifyData?.length || 0} prompts in database for group ${group_id}`)
        if ((verifyData?.length || 0) !== scheduledPrompts.length) {
          console.warn(`[initialize-group-queue] WARNING: Expected ${scheduledPrompts.length} prompts, but found ${verifyData?.length || 0} in database!`)
          console.warn(`[initialize-group-queue] Missing dates:`, 
            scheduledPrompts
              .map(sp => sp.date)
              .filter(date => !verifyData?.some(v => v.date === date))
          )
        }
      }
    } else {
      console.warn(`[initialize-group-queue] No prompts to insert (scheduledPrompts.length = 0)`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        prompts_scheduled: scheduledPrompts.length,
        dates: scheduledPrompts.map((sp) => sp.date),
        eligible_categories: eligibleCategories,
        category_counts: Object.fromEntries(categoryCounts),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    
    // Safely serialize error details
    let errorDetails: any = {}
    try {
      if (error instanceof Error) {
        errorDetails = {
          name: error.name,
          message: error.message,
          stack: errorStack?.substring(0, 500)
        }
      } else {
        errorDetails = { message: String(error) }
      }
    } catch (serializeError) {
      errorDetails = { message: "Error serialization failed" }
    }
    
    console.error("[initialize-group-queue] Fatal error:", errorMessage)
    console.error("[initialize-group-queue] Error details:", errorDetails)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage,
        ...errorDetails
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    )
  }
})

