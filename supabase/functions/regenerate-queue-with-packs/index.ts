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

// Determine eligible categories based on group settings
// Note: Fun/A Bit Deeper removed - replaced with deck system
// Note: Friends/Family merged to Standard category
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
  // NSFW only available for friends groups
  if (groupType === "friends" && hasNSFW && !disabledCategories.has("Edgy/NSFW")) {
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
      .select("type, created_at, ice_breaker_queue_completed_date")
      .eq("id", group_id)
      .single()

    if (groupError) throw groupError
    if (!groupData) throw new Error("Group not found")

    const groupType = groupData.type as "family" | "friends"
    
    // Only regenerate if ice-breaker period is complete
    if (!groupData.ice_breaker_queue_completed_date) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Group is still in ice-breaker period" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      )
    }

    // Check for memorials
    const { data: memorials } = await supabaseClient
      .from("memorials")
      .select("id")
      .eq("group_id", group_id)
      .limit(1)
    
    const hasMemorials = (memorials?.length || 0) > 0

    // Get category preferences
    const { data: preferences } = await supabaseClient
      .from("question_category_preferences")
      .select("category, preference, weight")
      .eq("group_id", group_id)

    const disabledCategories = new Set(
      (preferences || []).filter((p) => p.preference === "none").map((p) => p.category)
    )

    const categoryWeights = getCategoryWeights(preferences || [])

    // Check if NSFW is enabled for friends groups
    // NSFW is only available for friends groups, and must be explicitly enabled
    const hasNSFW = groupType === "friends" && 
      (preferences || []).some((p) => p.category === "Edgy/NSFW" && p.preference !== "none")

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

    // Fetch active decks
    const { data: activeDecksData } = await supabaseClient
      .from("group_active_decks")
      .select("deck_id, deck:decks(id, name)")
      .eq("group_id", group_id)
      .eq("status", "active")
    
    const activeDecks: Array<{ id: string; name: string }> = []
    let deckPrompts: any[] = []
    
    if (activeDecksData && activeDecksData.length > 0) {
      activeDecks = activeDecksData.map((ad: any) => ({
        id: ad.deck_id,
        name: ad.deck?.name || "Unknown Deck"
      }))
      
      // Get prompts from active decks
      const deckIds = activeDecks.map(d => d.id)
      const { data: deckPromptsData, error: deckPromptsError } = await supabaseClient
        .from("prompts")
        .select("*")
        .in("deck_id", deckIds)
        .not("deck_id", "is", null)
        .order("deck_id", { ascending: true })
        .order("deck_order", { ascending: true })
      
      if (deckPromptsError) {
        console.error(`[regenerate-queue-with-packs] Error fetching deck prompts:`, deckPromptsError)
      } else {
        deckPrompts = deckPromptsData || []
        console.log(`[regenerate-queue-with-packs] Found ${activeDecks.length} active decks with ${deckPrompts.length} total prompts`)
      }
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
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No prompts available for eligible categories" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      )
    }

    const today = new Date().toISOString().split("T")[0]
    const todayDate = new Date(today)
    const tomorrow = new Date(todayDate)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split("T")[0]

    // Delete future prompts that don't match new preferences
    // Keep today and tomorrow, only update future dates
    // Also preserve custom questions and birthdays
    const { error: deleteError } = await supabaseClient
      .from("daily_prompts")
      .delete()
      .eq("group_id", group_id)
      .gt("date", tomorrowStr) // Only delete dates after tomorrow
      .is("user_id", null) // Only general prompts (not birthday-specific)
      .is("deck_id", null) // Don't delete deck prompts - we'll regenerate them

    if (deleteError) {
      console.warn("[regenerate-queue-with-packs] Error deleting future prompts:", deleteError)
      // Continue anyway - we'll regenerate
    }

    // Get prompts already used (today, tomorrow, and past) to avoid duplicates
    const { data: usedPrompts } = await supabaseClient
      .from("daily_prompts")
      .select("prompt_id")
      .eq("group_id", group_id)
      .lte("date", tomorrowStr)
      .is("user_id", null)

    const usedPromptIds = new Set(usedPrompts?.map((p) => p.prompt_id) || [])

    // Generate dates: next 7 days (future only, starting from day after tomorrow)
    const dates: string[] = []
    for (let i = 2; i <= 8; i++) {
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
    const scheduledPrompts: Array<{ date: string; prompt_id: string; deck_id?: string }> = []
    const newUsedPromptIds = new Set<string>()
    
    // Track deck usage per week (for ensuring 1 per week per active deck)
    const deckUsagePerWeek = new Map<string, Set<string>>() // week_key -> Set<deck_id>
    const getWeekKey = (date: string) => {
      const d = new Date(date)
      const dayOfWeek = d.getDay()
      const weekStart = new Date(d)
      weekStart.setDate(d.getDate() - dayOfWeek) // Get Sunday of the week
      return weekStart.toISOString().split("T")[0]
    }

    // Generate queue for each future date
    for (const date of dates) {
      const weekKey = getWeekKey(date)
      
      // Reset category usage every 7 days
      const dateIndex = dates.indexOf(date)
      if (dateIndex % 7 === 0) {
        categoryUsage.clear()
        deckUsagePerWeek.delete(weekKey)
      }
      
      // Initialize week tracking if needed
      if (!deckUsagePerWeek.has(weekKey)) {
        deckUsagePerWeek.set(weekKey, new Set<string>())
      }
      const weekDeckUsage = deckUsagePerWeek.get(weekKey)!

      // Get available prompts (not used in past or in this new queue)
      const availablePrompts = shuffledPrompts.filter(
        (p) => !usedPromptIds.has(p.id) && !newUsedPromptIds.has(p.id)
      )

      // If we've used all prompts, reset and reuse
      if (availablePrompts.length === 0) {
        newUsedPromptIds.clear()
        const resetPrompts = seededShuffle(allPrompts, `${seed}-reset-${dateIndex}`)
        availablePrompts.push(...resetPrompts.filter((p) => !usedPromptIds.has(p.id)))
      }

      // Select prompt - prioritize deck questions (1 per week per active deck)
      let selectedPrompt: any | null = null
      let selectedDeckId: string | null = null
      
      // Check if we need to schedule a deck question this week
      const unusedDecksThisWeek = activeDecks.filter(deck => !weekDeckUsage.has(deck.id))
      
      if (unusedDecksThisWeek.length > 0 && deckPrompts.length > 0) {
        // Schedule a deck question - pick a random unused deck
        const deckToUse = unusedDecksThisWeek[Math.floor(rng() * unusedDecksThisWeek.length)]
        
        // Get available prompts from this deck (not used yet in this queue)
        const availableDeckPrompts = deckPrompts.filter(
          (p) => p.deck_id === deckToUse.id && !usedPromptIds.has(p.id) && !newUsedPromptIds.has(p.id)
        )
        
        if (availableDeckPrompts.length > 0) {
          // Select a prompt from this deck (use deck_order for deterministic selection)
          availableDeckPrompts.sort((a, b) => (a.deck_order || 0) - (b.deck_order || 0))
          selectedPrompt = availableDeckPrompts[0] // Use first available (by order)
          selectedDeckId = deckToUse.id
          weekDeckUsage.add(deckToUse.id)
          console.log(`[regenerate-queue-with-packs] Scheduling deck question from "${deckToUse.name}" for ${date}`)
        } else {
          // No more prompts available from this deck - mark as used for this week anyway
          weekDeckUsage.add(deckToUse.id)
          console.log(`[regenerate-queue-with-packs] Deck "${deckToUse.name}" has no more available prompts, skipping for this week`)
        }
      }
      
      // If no deck question scheduled, use category variety selection
      if (!selectedPrompt) {
        selectedPrompt = selectPromptWithVariety(
          availablePrompts,
          eligibleCategories,
          categoryWeights,
          categoryUsage,
          rng
        )
      }

      if (!selectedPrompt) {
        console.warn(`[regenerate-queue-with-packs] No prompt selected for ${date}, skipping`)
        continue
      }

      // Track usage
      newUsedPromptIds.add(selectedPrompt.id)
      const currentCount = categoryUsage.get(selectedPrompt.category) || 0
      categoryUsage.set(selectedPrompt.category, currentCount + 1)

      scheduledPrompts.push({
        date,
        prompt_id: selectedPrompt.id,
        deck_id: selectedDeckId || undefined,
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
            deck_id: sp.deck_id || null,
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
        active_decks: activeDecks.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[regenerate-queue-with-packs] Fatal error:", errorMessage)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    )
  }
})

