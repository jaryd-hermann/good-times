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

    // Get group details
    const { data: groupData, error: groupError } = await supabaseClient
      .from("groups")
      .select("type, created_at")
      .eq("id", group_id)
      .single()

    if (groupError) throw groupError
    if (!groupData) throw new Error("Group not found")

    const groupType = groupData.type as "family" | "friends"

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
    const disabledCategories = new Set(
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

    // Get all prompts from eligible categories (excluding birthday prompts)
    console.log(`[initialize-group-queue] Fetching prompts for categories:`, eligibleCategories)
    const { data: allPrompts, error: promptsError } = await supabaseClient
      .from("prompts")
      .select("*")
      .in("category", eligibleCategories)
      .is("birthday_type", null) // Exclude birthday prompts

    if (promptsError) throw promptsError
    if (!allPrompts || allPrompts.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No prompts available for eligible categories",
          eligible_categories: eligibleCategories
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
    const dates: string[] = []
    const todayDate = new Date(today)
    
    for (let i = -7; i <= 7; i++) {
      const date = new Date(todayDate)
      date.setDate(date.getDate() + i)
      dates.push(date.toISOString().split("T")[0])
    }

    // Shuffle prompts using group-specific seed
    const seed = `${group_id}-${groupData.created_at}`
    const shuffledPrompts = seededShuffle(allPrompts, seed)
    const rng = seededRandom(seed)

    // Track category usage for variety
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
      const availablePrompts = shuffledPrompts.filter(
        (p) => !usedPromptIds.has(p.id)
      )

      // If we've used all prompts, reset and reuse
      if (availablePrompts.length === 0) {
        usedPromptIds.clear()
        const resetPrompts = seededShuffle(allPrompts, `${seed}-reset-${dateIndex}`)
        availablePrompts.push(...resetPrompts)
      }

      // Select prompt ensuring variety
      const selectedPrompt = selectPromptWithVariety(
        availablePrompts,
        eligibleCategories,
        categoryWeights,
        categoryUsage,
        rng
      )

      if (!selectedPrompt) {
        console.warn(`[initialize-group-queue] No prompt selected for ${date}, skipping`)
        continue
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

    // Log summary of scheduled prompts by category and validate
    const categoryCounts = new Map<string, number>()
    const invalidScheduledPrompts: Array<{ date: string; prompt_id: string; category: string }> = []
    
    for (const sp of scheduledPrompts) {
      const prompt = allPrompts.find((p) => p.id === sp.prompt_id)
      if (prompt) {
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

