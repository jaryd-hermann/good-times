import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Seeded random number generator (same as initialize-group-queue)
function seededRandom(seed: string): () => number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  let value = Math.abs(hash) / 2147483647
  
  return () => {
    value = (value * 9301 + 49297) % 233280
    return value / 233280
  }
}

function seededShuffle<T>(array: T[], seed: string): T[] {
  const rng = seededRandom(seed)
  const shuffled = [...array]
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  
  return shuffled
}

function getEligibleCategories(
  groupType: "family" | "friends",
  hasNSFW: boolean,
  hasMemorials: boolean,
  disabledCategories: Set<string>
): string[] {
  const eligible: string[] = []
  
  // Standard category (replaces Friends/Family)
  if (!disabledCategories.has("Standard")) {
    eligible.push("Standard")
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

function getCategoryWeights(preferences: any[]): Map<string, number> {
  const weights = new Map<string, number>()
  
  for (const pref of preferences) {
    if (pref.preference === "none") {
      weights.set(pref.category, 0)
    } else {
      weights.set(pref.category, pref.weight || 1.0)
    }
  }
  
  return weights
}

function selectPromptWithVariety(
  availablePrompts: any[],
  eligibleCategories: string[],
  categoryWeights: Map<string, number>,
  usedCategories: Map<string, number>,
  rng: () => number
): any | null {
  if (availablePrompts.length === 0) return null
  
  const unusedCategories = eligibleCategories.filter(
    (cat) => !usedCategories.has(cat) || usedCategories.get(cat)! === 0
  )
  
  const categoryUsageCounts = Array.from(usedCategories.entries())
    .filter(([cat]) => eligibleCategories.includes(cat))
    .sort((a, b) => a[1] - b[1])
  
  const leastUsedCategory = categoryUsageCounts.length > 0 
    ? categoryUsageCounts[0][0] 
    : null
  
  const preferredCategory = unusedCategories.length > 0 
    ? unusedCategories[Math.floor(rng() * unusedCategories.length)]
    : leastUsedCategory || eligibleCategories[Math.floor(rng() * eligibleCategories.length)]
  
  const categoryPrompts = availablePrompts.filter(
    (p) => p.category === preferredCategory
  )
  
  const promptsToSelect = categoryPrompts.length > 0 ? categoryPrompts : availablePrompts
  
  const weightedPrompts: Array<{ prompt: any; weight: number }> = promptsToSelect.map((prompt) => {
    const weight = categoryWeights.get(prompt.category) ?? 1.0
    return { prompt, weight: Math.max(0, weight) }
  })
  
  const selectionPool: any[] = []
  weightedPrompts.forEach(({ prompt, weight }) => {
    const count = Math.max(1, Math.ceil(weight * 10))
    for (let i = 0; i < count; i++) {
      selectionPool.push(prompt)
    }
  })
  
  if (selectionPool.length === 0) return null
  
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

    const { group_id } = await req.json()

    if (!group_id) {
      throw new Error("group_id is required")
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

    // Check for memorials
    const { data: memorials } = await supabaseClient
      .from("memorials")
      .select("id")
      .eq("group_id", group_id)
      .limit(1)
    
    const hasMemorials = (memorials?.length || 0) > 0

    // Get updated category preferences
    const { data: preferences } = await supabaseClient
      .from("question_category_preferences")
      .select("category, preference, weight")
      .eq("group_id", group_id)

    const disabledCategories = new Set(
      (preferences || []).filter((p) => p.preference === "none").map((p) => p.category)
    )

    const categoryWeights = getCategoryWeights(preferences || [])

    // Check NSFW preference: for friends groups, NSFW is opt-in (default false)
    // For family groups, NSFW is always disabled
    let hasNSFW = false
    if (groupType === "friends") {
      const nsfwPref = (preferences || []).find((p) => p.category === "Edgy/NSFW")
      hasNSFW = nsfwPref ? nsfwPref.preference !== "none" : false // Default to false if not set
    } else {
      // Family groups: NSFW always disabled
      hasNSFW = false
    }

    const eligibleCategories = getEligibleCategories(
      groupType,
      hasNSFW,
      hasMemorials,
      disabledCategories
    )

    if (eligibleCategories.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No eligible categories for this group" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      )
    }

    // Get all prompts from eligible categories
    const { data: allPrompts, error: promptsError } = await supabaseClient
      .from("prompts")
      .select("*")
      .in("category", eligibleCategories)
      .is("birthday_type", null)
      .is("deck_id", null) // Exclude deck prompts (handled separately)

    if (promptsError) throw promptsError
    if (!allPrompts || allPrompts.length === 0) {
      console.error(`[update-group-queue] No prompts found!`, {
        eligibleCategories,
        groupType,
        hasNSFW: !disabledCategories.has("Edgy/NSFW"),
        hasMemorials,
        disabledCategories: Array.from(disabledCategories),
      })
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No prompts available for eligible categories",
          eligible_categories: eligibleCategories,
          debug: {
            groupType,
            hasNSFW: !disabledCategories.has("Edgy/NSFW"),
            hasMemorials,
            disabledCategories: Array.from(disabledCategories),
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      )
    }

    const today = new Date().toISOString().split("T")[0]
    const todayDate = new Date(today)

    // Delete future prompts that don't match new preferences
    // Keep today and past prompts, only update future dates
    const { error: deleteError } = await supabaseClient
      .from("daily_prompts")
      .delete()
      .eq("group_id", group_id)
      .gt("date", today) // Only delete future dates
      .is("user_id", null) // Only general prompts (not birthday-specific)

    if (deleteError) {
      console.warn("[update-group-queue] Error deleting future prompts:", deleteError)
      // Continue anyway - we'll regenerate
    }

    // Get prompts already used (today and past) to avoid duplicates
    const { data: usedPrompts } = await supabaseClient
      .from("daily_prompts")
      .select("prompt_id")
      .eq("group_id", group_id)
      .lte("date", today)
      .is("user_id", null)

    const usedPromptIds = new Set(usedPrompts?.map((p) => p.prompt_id) || [])

    // Generate dates: next 7 days (future only)
    const dates: string[] = []
    for (let i = 1; i <= 7; i++) {
      const date = new Date(todayDate)
      date.setDate(date.getDate() + i)
      dates.push(date.toISOString().split("T")[0])
    }

    // Shuffle prompts using group-specific seed
    const seed = `${group_id}-${groupData.created_at}`
    const shuffledPrompts = seededShuffle(allPrompts, seed)
    const rng = seededRandom(seed)

    // Track category usage for variety
    const categoryUsage = new Map<string, number>()
    const scheduledPrompts: Array<{ date: string; prompt_id: string }> = []
    const newUsedPromptIds = new Set<string>()

    // Generate queue for each future date
    for (const date of dates) {
      // Get available prompts (not used in past or in this new queue)
      const availablePrompts = shuffledPrompts.filter(
        (p) => !usedPromptIds.has(p.id) && !newUsedPromptIds.has(p.id)
      )

      // If we've used all prompts, reset and reuse
      if (availablePrompts.length === 0) {
        newUsedPromptIds.clear()
        const resetPrompts = seededShuffle(allPrompts, `${seed}-reset-${dates.indexOf(date)}`)
        availablePrompts.push(...resetPrompts.filter((p) => !usedPromptIds.has(p.id)))
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
        console.warn(`[update-group-queue] No prompt selected for ${date}, skipping`)
        continue
      }

      // Track usage
      newUsedPromptIds.add(selectedPrompt.id)
      const currentCount = categoryUsage.get(selectedPrompt.category) || 0
      categoryUsage.set(selectedPrompt.category, currentCount + 1)

      scheduledPrompts.push({
        date,
        prompt_id: selectedPrompt.id,
      })
    }

    // Batch insert new prompts
    if (scheduledPrompts.length > 0) {
      const { error: insertError } = await supabaseClient
        .from("daily_prompts")
        .insert(
          scheduledPrompts.map((sp) => ({
            group_id,
            prompt_id: sp.prompt_id,
            date: sp.date,
            user_id: null,
          }))
        )

      if (insertError) throw insertError
    }

    return new Response(
      JSON.stringify({
        success: true,
        prompts_scheduled: scheduledPrompts.length,
        dates: scheduledPrompts.map((sp) => sp.date),
        eligible_categories: eligibleCategories,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[update-group-queue] Fatal error:", errorMessage)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    )
  }
})

