import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Helper function to check if a date string (YYYY-MM-DD) is a Sunday
// CRITICAL: Parse date components directly to avoid timezone issues
// This matches the implementation in lib/utils.ts
function isSunday(dateString: string): boolean {
  // Parse date as local date (not UTC) to check day of week in user's timezone
  const [year, month, day] = dateString.split("-").map(Number)
  const date = new Date(year, month - 1, day) // month is 0-indexed
  return date.getDay() === 0 // 0 = Sunday
}

// Helper function to get available Standard prompts with reliable filtering and debugging
// Fetches all Standard prompts, then filters in JavaScript with explicit comparison
async function getAvailableStandardPrompts(
  supabaseClient: any,
  askedStandardPromptIds: Set<string>,
  lastStandardPromptId: string | null,
  askedCustomQuestionIds: Set<string>,
  groupId: string
): Promise<{ prompts: any[], debug: any }> {
  const debug: any = {
    askedStandardCount: askedStandardPromptIds.size,
    askedCustomCount: askedCustomQuestionIds.size,
    lastStandardPromptId,
    groupId
  }
  
  // Fetch ALL Standard prompts with pagination
  let allStandardPrompts: any[] = []
  let from = 0
  const pageSize = 1000
  let hasMore = true
  
  while (hasMore) {
    const { data: pagePrompts, error } = await supabaseClient
      .from("prompts")
      .select("*")
      .eq("category", "Standard")
      .range(from, from + pageSize - 1)
    
    if (error) {
      debug.error = error.message
      return { prompts: [], debug }
    }
    
    if (pagePrompts && pagePrompts.length > 0) {
      allStandardPrompts = allStandardPrompts.concat(pagePrompts)
      from += pageSize
      if (pagePrompts.length < pageSize) {
        hasMore = false
      }
    } else {
      hasMore = false
    }
  }
  
  debug.totalFetched = allStandardPrompts.length
  
  // Convert Sets to Arrays for explicit comparison (more reliable than Set.has())
  const askedStandardArray = Array.from(askedStandardPromptIds)
  const askedCustomArray = Array.from(askedCustomQuestionIds)
  
  // Filter using explicit Array.includes() instead of Set.has() to avoid any Set issues
  const availablePrompts = allStandardPrompts.filter((p: any) => {
    // Exclude Standard prompts that have been asked
    if (askedStandardArray.includes(p.id)) return false
    // Exclude custom question prompts that have been asked
    if (askedCustomArray.includes(p.id)) return false
    // Exclude last Standard prompt to prevent back-to-back
    if (lastStandardPromptId && p.id === lastStandardPromptId) return false
    return true
  })
  
  // Calculate exclusion counts for debugging
  const excludedByAsked = allStandardPrompts.filter((p: any) => askedStandardArray.includes(p.id)).length
  const excludedByCustom = allStandardPrompts.filter((p: any) => askedCustomArray.includes(p.id)).length
  const excludedByLast = lastStandardPromptId ? allStandardPrompts.filter((p: any) => p.id === lastStandardPromptId).length : 0
  
  debug.availableAfterFilter = availablePrompts.length
  debug.excludedByAsked = excludedByAsked
  debug.excludedByCustom = excludedByCustom
  debug.excludedByLast = excludedByLast
  
  // Test: Check if first fetched prompt is in asked array
  if (allStandardPrompts.length > 0 && askedStandardArray.length > 0) {
    const firstFetchedId = allStandardPrompts[0].id
    debug.firstFetchedId = firstFetchedId
    debug.firstAskedId = askedStandardArray[0]
    debug.firstFetchedInAskedArray = askedStandardArray.includes(firstFetchedId)
    debug.firstFetchedInSet = askedStandardPromptIds.has(firstFetchedId)
  }
  
  return { prompts: availablePrompts, debug }
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

    // Allow date to be passed in request body for backfilling missing dates
    // If not provided, use today's date
    let requestBody: { date?: string } = {}
    try {
      requestBody = await req.json().catch(() => ({}))
    } catch {
      // Request body is optional
    }
    
    const today = requestBody.date || new Date().toISOString().split("T")[0]
    
    // Log if backfilling
    if (requestBody.date) {
      console.log(`[schedule-daily-prompts] Backfilling prompts for date: ${today}`)
    }
    
    // CRITICAL: Log function start
    console.error(`[schedule-daily-prompts] FUNCTION START - Processing date: ${today}`)
    
    const todayMonthDay = today.substring(5) // MM-DD format for birthday comparison
    const results = []

    // Get all groups
    const { data: groups, error: groupsError } = await supabaseClient
      .from("groups")
      .select("id, name")

    if (groupsError) throw groupsError

    console.error(`[schedule-daily-prompts] Processing ${groups?.length || 0} groups for date: ${today}`)

    for (const group of groups || []) {
      try {
        console.error(`[schedule-daily-prompts] Group ${group.id}: STARTING PROCESSING`)
        // Check if group already has a prompt scheduled for today
      const { data: existingPrompt } = await supabaseClient
        .from("daily_prompts")
        .select("id")
        .eq("group_id", group.id)
        .eq("date", today)
        .is("user_id", null) // Only check general prompts (not user-specific birthday prompts)
        .maybeSingle()

      if (existingPrompt) {
        results.push({ group_id: group.id, status: "already_scheduled" })
        continue
      }

      // Get group members for various checks
      const { data: members, error: membersError } = await supabaseClient
        .from("group_members")
        .select("user_id, user:users(id, name, birthday)")
        .eq("group_id", group.id)

      if (membersError) throw membersError

      // ========================================================================
      // PRIORITY 1: BIRTHDAYS (HIGHEST PRIORITY - cannot be skipped)
      // ========================================================================
      const birthdayMembers: Array<{ user_id: string; name: string }> = []
      if (members) {
        for (const member of members) {
          const user = member.user as any
          if (user?.birthday) {
            const birthdayMonthDay = user.birthday.substring(5) // MM-DD format
            if (birthdayMonthDay === todayMonthDay) {
              birthdayMembers.push({
                user_id: user.id,
                name: user.name || "them",
              })
            }
          }
        }
      }

      if (birthdayMembers.length > 0) {
        // Get "their_birthday" prompt once (used for all non-birthday members)
        const { data: theirBirthdayPrompt } = await supabaseClient
          .from("prompts")
          .select("id")
          .eq("category", "Birthday")
          .eq("birthday_type", "their_birthday")
          .limit(1)
          .maybeSingle()

        // Handle birthday prompts
        for (const birthdayMember of birthdayMembers) {
          // Get "your_birthday" prompt for the birthday person
          const { data: yourBirthdayPrompt } = await supabaseClient
            .from("prompts")
            .select("id")
            .eq("category", "Birthday")
            .eq("birthday_type", "your_birthday")
            .limit(1)
            .maybeSingle()

          if (yourBirthdayPrompt) {
            await supabaseClient.from("daily_prompts").insert({
              group_id: group.id,
              prompt_id: yourBirthdayPrompt.id,
              date: today,
              user_id: birthdayMember.user_id, // User-specific prompt
            })
          }

          // Use the "their_birthday" prompt for all other members
          if (theirBirthdayPrompt && members) {
            for (const member of members) {
              // Skip the birthday person (they already got their prompt)
              if (member.user_id === birthdayMember.user_id) continue

              await supabaseClient.from("daily_prompts").insert({
                group_id: group.id,
                prompt_id: theirBirthdayPrompt.id,
                date: today,
                user_id: member.user_id, // User-specific prompt
              })
            }
          }
        }

        // Also create a general prompt entry for the group (for display purposes)
        if (theirBirthdayPrompt) {
          await supabaseClient.from("daily_prompts").insert({
            group_id: group.id,
            prompt_id: theirBirthdayPrompt.id,
            date: today,
            user_id: null, // General prompt
          })
        }

        results.push({
          group_id: group.id,
          status: "birthday_scheduled",
          birthday_members: birthdayMembers.map((m) => m.name),
        })
        continue // Skip all other scheduling - birthday is highest priority
      }

      // ========================================================================
      // PRIORITY 2: SUNDAY JOURNAL QUESTION
      // ========================================================================
      // On Sundays, schedule the Journal prompt (weekly photo journal)
      // This takes priority over regular scheduling but not birthdays
      // CRITICAL: Only schedule for today (future Sundays will be handled when they become today)
      // This prevents overwriting past Sunday prompts
      // CRITICAL: Journal prompts MUST ONLY be scheduled on Sundays
      const isTodaySunday = isSunday(today)
      if (isTodaySunday) {
        // DOUBLE-CHECK: Verify it's actually Sunday before proceeding
        // This is a safeguard against any potential bugs in isSunday()
        const [year, month, day] = today.split("-").map(Number)
        const dateCheck = new Date(year, month - 1, day)
        const dayOfWeek = dateCheck.getDay()
        
        if (dayOfWeek !== 0) {
          // This should never happen, but log error and skip Journal scheduling
          console.error(`[schedule-daily-prompts] Group ${group.id}: CRITICAL ERROR - Attempted to schedule Journal prompt on non-Sunday date ${today} (day of week: ${dayOfWeek}). Skipping Journal scheduling.`)
          // Fall through to regular scheduling instead of scheduling Journal
        } else {
          // Get the Journal prompt
          const { data: journalPrompt } = await supabaseClient
            .from("prompts")
            .select("id")
            .eq("category", "Journal")
            .limit(1)
            .maybeSingle()

          if (journalPrompt) {
            // Schedule Journal prompt for today (only)
            await supabaseClient.from("daily_prompts").insert({
              group_id: group.id,
              prompt_id: journalPrompt.id,
              date: today,
            })

            results.push({
              group_id: group.id,
              status: "journal_scheduled",
            })
            continue // Skip all other scheduling - Sunday is Journal day
          }
        }
      } else {
        // Log if someone tries to backfill a non-Sunday date (for debugging)
        if (requestBody.date) {
          const [year, month, day] = today.split("-").map(Number)
          const dateCheck = new Date(year, month - 1, day)
          const dayOfWeek = dateCheck.getDay()
          console.log(`[schedule-daily-prompts] Group ${group.id}: Skipping Journal prompt for non-Sunday date ${today} (day of week: ${dayOfWeek})`)
        }
      }

      // ========================================================================
      // PRIORITY 3: CUSTOM QUESTIONS
      // ========================================================================
      // Check for custom question scheduled for today
      const { data: customQuestion } = await supabaseClient
        .from("custom_questions")
        .select("id, prompt_id, date_asked")
        .eq("group_id", group.id)
        .eq("date_asked", today)
        .not("prompt_id", "is", null)
        .maybeSingle()

      if (customQuestion && customQuestion.prompt_id) {
        // CRITICAL FIX: Check if this prompt_id was EVER asked before (never repeat custom questions)
        const { data: everAsked } = await supabaseClient
          .from("daily_prompts")
          .select("id")
          .eq("group_id", group.id)
          .eq("prompt_id", customQuestion.prompt_id)
          .limit(1)
          .maybeSingle()

        if (everAsked) {
          console.log(`[schedule-daily-prompts] Group ${group.id}: Custom question prompt_id ${customQuestion.prompt_id} was already asked before, skipping (custom questions are one-time only)`)
          // Clear date_asked so it doesn't keep trying
          await supabaseClient
            .from("custom_questions")
            .update({ date_asked: null })
            .eq("id", customQuestion.id)
          // Fall through to next priority
        } else {
          // CRITICAL FIX: Check if a daily_prompt already exists for TODAY with this prompt_id
          // This prevents duplicate scheduling if function runs multiple times on same day
          const { data: alreadyScheduledToday } = await supabaseClient
            .from("daily_prompts")
            .select("id")
            .eq("group_id", group.id)
            .eq("prompt_id", customQuestion.prompt_id)
            .eq("date", today)
            .limit(1)
            .maybeSingle()

          if (alreadyScheduledToday) {
            console.log(`[schedule-daily-prompts] Group ${group.id}: Custom question prompt_id ${customQuestion.prompt_id} already scheduled for today, skipping duplicate (race condition protection)`)
            // Clear date_asked to prevent future attempts
            await supabaseClient
              .from("custom_questions")
              .update({ date_asked: null })
              .eq("id", customQuestion.id)
            // Fall through to next priority
          } else {
            // Safe to schedule - this custom question has never been asked and not scheduled today
            const { error: insertError } = await supabaseClient.from("daily_prompts").insert({
            group_id: group.id,
            prompt_id: customQuestion.prompt_id,
            date: today,
          })

            if (insertError) {
              console.error(`[schedule-daily-prompts] Group ${group.id}: Failed to insert custom question daily_prompt:`, insertError)
              // Fall through to next priority instead of continuing
            } else {
          // Mark as asked by clearing date_asked (prevents re-scheduling)
          await supabaseClient
            .from("custom_questions")
            .update({ date_asked: null })
            .eq("id", customQuestion.id)

          results.push({ group_id: group.id, status: "custom_question_scheduled" })
          continue // Skip regular prompt scheduling
            }
          }
        }
      }

      // ========================================================================
      // TEMPORARILY HIDDEN: PRIORITY 3: FEATURED QUESTIONS (from queue)
      // ========================================================================
      // const { data: queuedFeaturedItem } = await supabaseClient
      //   .from("group_prompt_queue")
      //   .select("id, prompt_id, prompt:prompts(category)")
      //   .eq("group_id", group.id)
      //   .order("position", { ascending: true })
      //   .limit(1)
      //   .maybeSingle()

      // if (queuedFeaturedItem) {
      //   const queuedPrompt = queuedFeaturedItem.prompt as any
      //   if (queuedPrompt?.category === "Featured") {
      //     // Check if this prompt was asked recently (back-to-back prevention)
      //     const yesterday = new Date(today)
      //     yesterday.setDate(yesterday.getDate() - 1)
      //     const yesterdayStr = yesterday.toISOString().split("T")[0]

      //     const { data: recentPrompt } = await supabaseClient
      //       .from("daily_prompts")
      //       .select("id, date")
      //       .eq("group_id", group.id)
      //       .eq("prompt_id", queuedFeaturedItem.prompt_id)
      //       .gte("date", yesterdayStr)
      //       .order("date", { ascending: false })
      //       .limit(1)
      //       .maybeSingle()

      //     if (!recentPrompt) {
      //       // Safe to schedule
      //       await supabaseClient.from("daily_prompts").insert({
      //         group_id: group.id,
      //         prompt_id: queuedFeaturedItem.prompt_id,
      //         date: today,
      //       })

      //       // Remove from queue
      //       await supabaseClient
      //         .from("group_prompt_queue")
      //         .delete()
      //         .eq("id", queuedFeaturedItem.id)

      //       results.push({ group_id: group.id, status: "featured_question_scheduled" })
      //       continue
      //     } else {
      //       // Remove from queue since it can't be scheduled (back-to-back)
      //       await supabaseClient
      //         .from("group_prompt_queue")
      //         .delete()
      //         .eq("id", queuedFeaturedItem.id)
      //       // Fall through to next priority
      //     }
      //   }
      // }

      // ========================================================================
      // PRIORITY 4: ICE-BREAKER QUESTIONS
      // ========================================================================
      // Get all ice-breaker questions that have been asked for this group
      const { data: askedIceBreakers } = await supabaseClient
        .from("daily_prompts")
        .select("prompt_id, prompt:prompts(ice_breaker_order)")
        .eq("group_id", group.id)
        .is("user_id", null) // Only general prompts
      
      const askedIceBreakerOrders = new Set<number>()
      if (askedIceBreakers) {
        for (const dp of askedIceBreakers) {
          const prompt = dp.prompt as any
          if (prompt?.ice_breaker_order !== null && prompt?.ice_breaker_order !== undefined) {
            askedIceBreakerOrders.add(prompt.ice_breaker_order)
          }
        }
      }

      // Get next unasked ice-breaker question (ordered by ice_breaker_order)
      const { data: nextIceBreaker } = await supabaseClient
        .from("prompts")
        .select("id, ice_breaker_order")
        .eq("ice_breaker", true)
        .not("ice_breaker_order", "is", null)
        .order("ice_breaker_order", { ascending: true })
        .maybeSingle()

      if (nextIceBreaker && !askedIceBreakerOrders.has(nextIceBreaker.ice_breaker_order)) {
        // Schedule this ice-breaker question
        await supabaseClient.from("daily_prompts").insert({
          group_id: group.id,
          prompt_id: nextIceBreaker.id,
          date: today,
        })

        results.push({ 
          group_id: group.id, 
          status: "ice_breaker_scheduled",
          ice_breaker_order: nextIceBreaker.ice_breaker_order
        })
        continue
      }

      // ========================================================================
      // PRIORITY 5-7: STANDARD, DECK, REMEMBERING (with interspersing logic)
      // ========================================================================
      
      // Get all prompts that have been asked (to exclude from selection)
      // CRITICAL FIX: Paginate to fetch ALL asked prompts (not just first 1000)
      let allAskedPrompts: any[] = []
      let from = 0
      const pageSize = 1000
      let hasMore = true
      
      while (hasMore) {
        const { data: pagePrompts, error } = await supabaseClient
          .from("daily_prompts")
          .select("prompt_id, date, prompt:prompts(category, deck_id)")
          .eq("group_id", group.id)
          .is("user_id", null) // Only general prompts
          .order("date", { ascending: false })
          .range(from, from + pageSize - 1)
        
        if (error) {
          console.error(`[schedule-daily-prompts] Group ${group.id}: Error fetching asked prompts:`, error)
          break
        }
        
        if (pagePrompts && pagePrompts.length > 0) {
          allAskedPrompts = allAskedPrompts.concat(pagePrompts)
          from += pageSize
          if (pagePrompts.length < pageSize) {
            hasMore = false
          }
        } else {
          hasMore = false
        }
      }
      
      const askedPromptIds = new Set<string>()
      const askedStandardPromptIds = new Set<string>() // Track Standard prompts separately
      const askedCustomQuestionIds = new Set<string>()
      let filteringDebug: any = null // Store filtering debug info for response
      
      // CRITICAL FIX: Get the last prompt asked to prevent back-to-back repeats
      let lastPromptId: string | null = null
      let lastStandardPromptId: string | null = null // Track last Standard prompt separately
      
      // CRITICAL FIX: Get prompts asked in the last 14 days to prevent frequent repeats
      const fourteenDaysAgo = new Date(today)
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
      const fourteenDaysAgoStr = fourteenDaysAgo.toISOString().split("T")[0]
      
      const recentPromptIds = new Set<string>()
      
      if (allAskedPrompts && allAskedPrompts.length > 0) {
        // Get the most recent prompt (first in descending order)
        lastPromptId = allAskedPrompts[0].prompt_id
        
        // DEBUG: Log total asked prompts and how many have category info
        let promptsWithCategory = 0
        let promptsWithoutCategory = 0
        
        for (const dp of allAskedPrompts) {
          askedPromptIds.add(dp.prompt_id)
          const prompt = dp.prompt as any
          
          if (!prompt) {
            promptsWithoutCategory++
            console.warn(`[schedule-daily-prompts] Group ${group.id}: Prompt ${dp.prompt_id} has no category info (join may have failed)`)
            continue
          }
          
          promptsWithCategory++
          
          // Track Standard prompts separately for better filtering
          // CRITICAL: Log category to debug filtering issue
          const category = prompt?.category
          if (category === "Standard") {
            askedStandardPromptIds.add(dp.prompt_id)
            // Track last Standard prompt for back-to-back prevention
            if (!lastStandardPromptId) {
              lastStandardPromptId = dp.prompt_id
            }
          } else if (category) {
            // Log non-Standard categories to see what we're getting
            console.log(`[schedule-daily-prompts] Group ${group.id}: Prompt ${dp.prompt_id} has category "${category}" (not Standard)`)
          }
          
          // Track custom question IDs separately (never repeat)
          if (prompt?.category === "Custom") {
            askedCustomQuestionIds.add(dp.prompt_id)
          }
          
          // Track prompts asked in the last 14 days (to prevent frequent repeats)
          if (dp.date >= fourteenDaysAgoStr) {
            recentPromptIds.add(dp.prompt_id)
          }
        }
        
        // DEBUG: Log category tracking stats with ERROR level
        const categoryBreakdown: Record<string, number> = {}
        for (const dp of allAskedPrompts) {
          const prompt = dp.prompt as any
          const cat = prompt?.category || 'null'
          categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1
        }
        console.error(`[schedule-daily-prompts] Group ${group.id}: Category breakdown: ${JSON.stringify(categoryBreakdown)}`)
        console.error(`[schedule-daily-prompts] Group ${group.id}: Total asked prompts: ${allAskedPrompts.length}, With category: ${promptsWithCategory}, Without category: ${promptsWithoutCategory}, Standard tracked: ${askedStandardPromptIds.size}`)
      }
      
      // CRITICAL: Verify askedStandardPromptIds only contains Standard prompts
      // This ensures data integrity before filtering
      if (askedStandardPromptIds.size > 0) {
        const askedArray = Array.from(askedStandardPromptIds)
        // Chunk verification if needed (Supabase has limits on array size in .in())
        const chunkSize = 100
        let allNonStandard: any[] = []
        
        for (let i = 0; i < askedArray.length; i += chunkSize) {
          const chunk = askedArray.slice(i, i + chunkSize)
          const { data: verifyPrompts } = await supabaseClient
            .from("prompts")
            .select("id, category")
            .in("id", chunk)
          
          if (verifyPrompts) {
            const nonStandardInChunk = verifyPrompts.filter((p: any) => p.category !== "Standard")
            allNonStandard = allNonStandard.concat(nonStandardInChunk)
          }
        }
        
        if (allNonStandard.length > 0) {
          console.error(`[schedule-daily-prompts] Group ${group.id}: DATA INTEGRITY ERROR - askedStandardPromptIds contains ${allNonStandard.length} non-Standard prompts! Removing them.`)
          // Remove non-Standard prompts from the Set
          for (const prompt of allNonStandard) {
            askedStandardPromptIds.delete(prompt.id)
          }
          console.error(`[schedule-daily-prompts] Group ${group.id}: Cleaned askedStandardPromptIds - now has ${askedStandardPromptIds.size} Standard prompts`)
        }
      }
      
      // Log diagnostic info with ERROR level
      console.error(`[schedule-daily-prompts] Group ${group.id}: Asked prompts - Total: ${askedPromptIds.size}, Standard: ${askedStandardPromptIds.size}, Custom: ${askedCustomQuestionIds.size}, Last Standard: ${lastStandardPromptId || 'none'}`)

      // CRITICAL: Convert Sets to Arrays for reliable filtering (used throughout Standard prompt selection)
      // This ensures consistent filtering behavior and prevents the Set.has() bug
      const askedStandardArray = Array.from(askedStandardPromptIds)
      const askedCustomArray = Array.from(askedCustomQuestionIds)

      // Get all custom question IDs that have been asked (for exclusion)
      const { data: allCustomQuestions } = await supabaseClient
        .from("custom_questions")
        .select("prompt_id")
        .eq("group_id", group.id)
        .not("prompt_id", "is", null)
      
      if (allCustomQuestions) {
        for (const cq of allCustomQuestions) {
          if (cq.prompt_id) {
            askedCustomQuestionIds.add(cq.prompt_id)
          }
        }
      }

      // Count Standard questions since last Remembering questions
      // CRITICAL FIX: Find the last Remembering question date, then count ALL Standard questions since then
      // Logic: Maximum 1 Remembering question between every 10 Standard questions, never more frequent than that
      
      // First, find the last Remembering question date
      const { data: lastRememberingPrompt } = await supabaseClient
        .from("daily_prompts")
        .select("date, prompt_id, prompt:prompts(category)")
        .eq("group_id", group.id)
        .is("user_id", null)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle()

      let lastRememberingDate: string | null = null
      if (lastRememberingPrompt) {
        const prompt = lastRememberingPrompt.prompt as any
        if (prompt?.category === "Remembering") {
          lastRememberingDate = lastRememberingPrompt.date
        }
      }

      // If not found in most recent prompt, query specifically for Remembering questions
      if (!lastRememberingDate) {
        const { data: lastRemembering } = await supabaseClient
          .from("daily_prompts")
          .select("date, prompt:prompts(category)")
          .eq("group_id", group.id)
          .is("user_id", null)
          .order("date", { ascending: false })
          .limit(200) // Look back further to find Remembering questions

        if (lastRemembering) {
          for (const dp of lastRemembering) {
          const prompt = dp.prompt as any
          if (prompt?.category === "Remembering") {
              lastRememberingDate = dp.date
              break
            }
          }
        }
      }

      // CRITICAL FIX: Count ALL Standard questions since last Remembering question
      // If lastRememberingDate exists, count from that date forward
      // If it doesn't exist, count all Standard questions (no Remembering question has been asked yet)
      // IMPORTANT: Exclude discovery questions from this count (they count toward Standard but shouldn't trigger discovery)
      let standardCountSinceRemembering = 0
      
      if (lastRememberingDate) {
        // Count Standard questions since the last Remembering question date (excluding discovery)
        // CRITICAL FIX: Paginate to fetch ALL prompts since last Remembering
        let standardPromptsSinceRemembering: any[] = []
        let from = 0
        const pageSize = 1000
        let hasMore = true
        
        while (hasMore) {
          const { data: pagePrompts, error } = await supabaseClient
            .from("daily_prompts")
            .select("prompt_id, prompt:prompts(category), is_discovery")
            .eq("group_id", group.id)
            .is("user_id", null)
            .gt("date", lastRememberingDate) // All prompts AFTER last Remembering
            .order("date", { ascending: true })
            .range(from, from + pageSize - 1)
          
          if (error) {
            console.error(`[schedule-daily-prompts] Group ${group.id}: Error fetching Standard prompts since Remembering:`, error)
            break
          }
          
          if (pagePrompts && pagePrompts.length > 0) {
            standardPromptsSinceRemembering = standardPromptsSinceRemembering.concat(pagePrompts)
            from += pageSize
            if (pagePrompts.length < pageSize) {
              hasMore = false
            }
          } else {
            hasMore = false
          }
        }

        if (standardPromptsSinceRemembering) {
          for (const dp of standardPromptsSinceRemembering) {
            const prompt = dp.prompt as any
            // Count Standard questions, but exclude discovery questions from the count
            if (prompt?.category === "Standard" && !dp.is_discovery) {
              standardCountSinceRemembering++
            }
          }
        }
      } else {
        // No Remembering question found - count all Standard questions ever asked (excluding discovery)
        // CRITICAL FIX: Paginate to fetch ALL Standard prompts
        let allStandardPrompts: any[] = []
        let from = 0
        const pageSize = 1000
        let hasMore = true
        
        while (hasMore) {
          const { data: pagePrompts, error } = await supabaseClient
            .from("daily_prompts")
            .select("prompt_id, prompt:prompts(category), is_discovery")
            .eq("group_id", group.id)
            .is("user_id", null)
            .order("date", { ascending: true })
            .range(from, from + pageSize - 1)
          
          if (error) {
            console.error(`[schedule-daily-prompts] Group ${group.id}: Error fetching all Standard prompts:`, error)
            break
          }
          
          if (pagePrompts && pagePrompts.length > 0) {
            allStandardPrompts = allStandardPrompts.concat(pagePrompts)
            from += pageSize
            if (pagePrompts.length < pageSize) {
              hasMore = false
            }
          } else {
            hasMore = false
          }
        }

        if (allStandardPrompts) {
          for (const dp of allStandardPrompts) {
            const prompt = dp.prompt as any
            // Count Standard questions, but exclude discovery questions from the count
            if (prompt?.category === "Standard" && !dp.is_discovery) {
              standardCountSinceRemembering++
            }
          }
        }
      }

      // Count Standard questions (excluding discovery) for discovery trigger (every 10th)
      // This is separate from Remembering count - discovery can happen independently
      // CRITICAL FIX: Paginate to fetch ALL Standard prompts for discovery counting
      let allStandardForDiscovery: any[] = []
      let from = 0
      const pageSize = 1000
      let hasMore = true
      
      while (hasMore) {
        const { data: pagePrompts, error } = await supabaseClient
          .from("daily_prompts")
          .select("prompt_id, prompt:prompts(category), is_discovery")
          .eq("group_id", group.id)
          .is("user_id", null)
          .order("date", { ascending: true })
          .range(from, from + pageSize - 1)
        
        if (error) {
          console.error(`[schedule-daily-prompts] Group ${group.id}: Error fetching Standard prompts for discovery:`, error)
          break
        }
        
        if (pagePrompts && pagePrompts.length > 0) {
          allStandardForDiscovery = allStandardForDiscovery.concat(pagePrompts)
          from += pageSize
          if (pagePrompts.length < pageSize) {
            hasMore = false
          }
        } else {
          hasMore = false
        }
      }

      let standardCountForDiscovery = 0
      if (allStandardForDiscovery) {
        for (const dp of allStandardForDiscovery) {
          const prompt = dp.prompt as any
          // Count Standard questions, excluding discovery questions
          if (prompt?.category === "Standard" && !dp.is_discovery) {
            standardCountForDiscovery++
          }
        }
      }

      // Check for memorials
      const { data: memorialsCheck } = await supabaseClient
        .from("memorials")
        .select("id")
        .eq("group_id", group.id)
        .limit(1)
      const hasMemorials = (memorialsCheck?.length || 0) > 0

      // TEMPORARILY HIDDEN: Check active decks (max 3) - removed since Deck questions are disabled
      // const { data: activeDecksData } = await supabaseClient
      //   .from("group_active_decks")
      //   .select("deck_id, deck:decks(id, name)")
      //   .eq("group_id", group.id)
      //   .eq("status", "active")
      //   .order("created_at", { ascending: true })
      //   .limit(3) // Enforce max 3 active decks

      // const activeDecks = activeDecksData || []
      
      // Determine which type of question to ask next
      let selectedPrompt: any = null
      let selectedDeckId: string | null = null
      let selectionMethod = "standard"
      let discoveryInterest: string | null = null // Track discovery interest for marking questions

      // TEMPORARILY HIDDEN: PRIORITY 6: DECK QUESTION (every 3 Standard questions)
      // if (activeDecks.length > 0 && standardCountSinceDeck >= 3) {
      //   // Get all deck questions that have been asked
      //   const { data: askedDeckPrompts } = await supabaseClient
      //     .from("daily_prompts")
      //     .select("prompt_id")
      //     .eq("group_id", group.id)
      //     .is("user_id", null)
      //     .not("deck_id", "is", null)

      //   const askedDeckPromptIds = new Set((askedDeckPrompts || []).map((dp: any) => dp.prompt_id))

      //   // Find which deck to use (rotate through active decks)
      //   // Get the last deck question asked to determine rotation
      //   const { data: lastDeckQuestionData } = await supabaseClient
      //     .from("daily_prompts")
      //     .select("prompt_id, prompt:prompts(deck_id)")
      //     .eq("group_id", group.id)
      //     .is("user_id", null)
      //     .order("date", { ascending: false })
      //     .limit(10) // Get recent prompts to find deck questions
      //   
      //   let lastDeckId: string | null = null
      //   if (lastDeckQuestionData) {
      //     for (const dp of lastDeckQuestionData) {
      //       const prompt = dp.prompt as any
      //       if (prompt?.deck_id) {
      //         lastDeckId = prompt.deck_id
      //         break
      //       }
      //     }
      //   }

      //   let deckToUse = activeDecks[0] // Default to first deck
      //   if (lastDeckId) {
      //     // Find index of last used deck
      //     const lastDeckIndex = activeDecks.findIndex((ad: any) => ad.deck_id === lastDeckId)
      //     if (lastDeckIndex >= 0 && lastDeckIndex < activeDecks.length - 1) {
      //       // Use next deck in rotation
      //       deckToUse = activeDecks[lastDeckIndex + 1]
      //     } else {
      //       // Wrap around to first deck
      //       deckToUse = activeDecks[0]
      //     }
      //   }

      //   // Get available prompts from this deck (ordered by deck_order)
      //   const { data: deckPrompts } = await supabaseClient
      //     .from("prompts")
      //     .select("*")
      //     .eq("deck_id", deckToUse.deck_id)
      //     .not("deck_id", "is", null)
      //     .order("deck_order", { ascending: true })

      //   // Find first unasked prompt from this deck
      //   const availableDeckPrompt = (deckPrompts || []).find(
      //     (p: any) => !askedDeckPromptIds.has(p.id)
      //   )

      //   if (availableDeckPrompt) {
      //     selectedPrompt = availableDeckPrompt
      //     selectedDeckId = deckToUse.deck_id
      //     selectionMethod = "deck"
      //   }
      // }

      // PRIORITY 7: REMEMBERING QUESTION
      // Logic: Maximum 1 Remembering question between every 10 Standard questions, never more frequent than that
      // Requirements:
      // 1. At least 10 Standard questions have been asked since the last Remembering question
      // 2. At least 10 days have passed since the last Remembering question (prevents back-to-back)
      if (!selectedPrompt && hasMemorials && standardCountSinceRemembering >= 10) {
        let canScheduleRemembering = true
        
        // CRITICAL FIX: Always check date-based restriction to prevent back-to-back scheduling
        if (lastRememberingDate) {
          const lastRememberingDateObj = new Date(lastRememberingDate)
          const todayDateObj = new Date(today)
          const daysSinceLastRemembering = Math.floor((todayDateObj.getTime() - lastRememberingDateObj.getTime()) / (1000 * 60 * 60 * 24))
          
          // Require at least 10 days between Remembering questions (prevents back-to-back)
          if (daysSinceLastRemembering < 10) {
            console.log(`[schedule-daily-prompts] Group ${group.id}: Cannot schedule Remembering question - only ${daysSinceLastRemembering} days since last one (minimum 10 days required, ${standardCountSinceRemembering} Standard questions since last Remembering)`)
            canScheduleRemembering = false
          } else {
            console.log(`[schedule-daily-prompts] Group ${group.id}: Can schedule Remembering question - ${daysSinceLastRemembering} days since last one, ${standardCountSinceRemembering} Standard questions since last Remembering`)
          }
        } else {
          // No Remembering question found in history - check if there's one in the last 10 days as a safeguard
          const tenDaysAgo = new Date(today)
          tenDaysAgo.setDate(tenDaysAgo.getDate() - 10)
          const tenDaysAgoStr = tenDaysAgo.toISOString().split("T")[0]
          
          const { data: recentRemembering } = await supabaseClient
            .from("daily_prompts")
            .select("id, date, prompt:prompts(category)")
            .eq("group_id", group.id)
            .is("user_id", null)
            .gte("date", tenDaysAgoStr)
            .order("date", { ascending: false })
            .limit(1)
            .maybeSingle()
          
          if (recentRemembering) {
            const prompt = recentRemembering.prompt as any
            if (prompt?.category === "Remembering") {
              console.log(`[schedule-daily-prompts] Group ${group.id}: Cannot schedule Remembering question - found one on ${recentRemembering.date} (within last 10 days, ${standardCountSinceRemembering} Standard questions since last Remembering)`)
              canScheduleRemembering = false
            }
          } else {
            console.log(`[schedule-daily-prompts] Group ${group.id}: Can schedule Remembering question - no Remembering question in last 10 days, ${standardCountSinceRemembering} Standard questions total`)
          }
        }
        
        if (canScheduleRemembering) {
          // Get available Remembering prompts
          // CRITICAL FIX: Paginate to fetch ALL Remembering prompts, then filter in JavaScript
          let allRememberingPrompts: any[] = []
          let from = 0
          const pageSize = 1000
          let hasMore = true
          
          while (hasMore) {
            const { data: pagePrompts, error } = await supabaseClient
              .from("prompts")
              .select("*")
              .eq("category", "Remembering")
              .range(from, from + pageSize - 1)
            
            if (error) {
              console.error(`[schedule-daily-prompts] Group ${group.id}: Error fetching Remembering prompts:`, error)
              break
            }
            
            if (pagePrompts && pagePrompts.length > 0) {
              allRememberingPrompts = allRememberingPrompts.concat(pagePrompts)
              from += pageSize
              if (pagePrompts.length < pageSize) {
                hasMore = false
              }
            } else {
              hasMore = false
            }
          }
          
          // Filter in JavaScript to exclude asked prompts (avoids Supabase array size limits)
          const askedPromptIdsArray = Array.from(askedPromptIds)
          const rememberingPrompts = allRememberingPrompts.filter((p: any) => !askedPromptIdsArray.includes(p.id))

          if (rememberingPrompts && rememberingPrompts.length > 0) {
            // Select one (we'll rotate memorial names in getDailyPrompt)
            selectedPrompt = rememberingPrompts[0]
            selectionMethod = "remembering"
            console.log(`[schedule-daily-prompts] Group ${group.id}: Scheduling Remembering question (${standardCountSinceRemembering} Standard questions since last Remembering)`)
          }
        }
      } else if (!selectedPrompt && hasMemorials) {
        // Log why Remembering question wasn't scheduled (for debugging)
        if (standardCountSinceRemembering < 10) {
          console.log(`[schedule-daily-prompts] Group ${group.id}: Cannot schedule Remembering question - only ${standardCountSinceRemembering} Standard questions since last Remembering (need 10)`)
        }
      }

      // PRIORITY 5: STANDARD QUESTION (with interest-based personalization)
      if (!selectedPrompt) {
        // Check if all ice breakers have been asked (including null order ones)
        // CRITICAL FIX: Paginate to fetch ALL ice breaker prompts
        let allIceBreakers: any[] = []
        let from = 0
        const pageSize = 1000
        let hasMore = true
        
        while (hasMore) {
          const { data: pagePrompts, error } = await supabaseClient
            .from("prompts")
            .select("id")
            .eq("ice_breaker", true)
            .range(from, from + pageSize - 1)
          
          if (error) {
            console.error(`[schedule-daily-prompts] Group ${group.id}: Error fetching ice breaker prompts:`, error)
            break
          }
          
          if (pagePrompts && pagePrompts.length > 0) {
            allIceBreakers = allIceBreakers.concat(pagePrompts)
            from += pageSize
            if (pagePrompts.length < pageSize) {
              hasMore = false
            }
          } else {
            hasMore = false
          }
        }
        
        const allIceBreakerIds = new Set((allIceBreakers || []).map((p: any) => p.id))
        
        // Get all asked prompts that are ice breakers
        // CRITICAL FIX: Paginate to fetch ALL asked prompts for ice breaker check
        let allAskedPromptsForIceBreakerCheck: any[] = []
        from = 0
        hasMore = true
        
        while (hasMore) {
          const { data: pagePrompts, error } = await supabaseClient
            .from("daily_prompts")
            .select("prompt_id, prompt:prompts(ice_breaker)")
            .eq("group_id", group.id)
            .is("user_id", null)
            .range(from, from + pageSize - 1)
          
          if (error) {
            console.error(`[schedule-daily-prompts] Group ${group.id}: Error fetching asked prompts for ice breaker check:`, error)
            break
          }
          
          if (pagePrompts && pagePrompts.length > 0) {
            allAskedPromptsForIceBreakerCheck = allAskedPromptsForIceBreakerCheck.concat(pagePrompts)
            from += pageSize
            if (pagePrompts.length < pageSize) {
              hasMore = false
            }
          } else {
            hasMore = false
          }
        }
        
        const askedIceBreakerIds = new Set<string>()
        if (allAskedPromptsForIceBreakerCheck) {
          for (const dp of allAskedPromptsForIceBreakerCheck) {
            const prompt = dp.prompt as any
            if (prompt?.ice_breaker && allIceBreakerIds.has(dp.prompt_id)) {
              askedIceBreakerIds.add(dp.prompt_id)
            }
          }
        }
        
        const allIceBreakersAsked = allIceBreakerIds.size > 0 && askedIceBreakerIds.size >= allIceBreakerIds.size

        // Only use interest-based logic if all ice breakers are complete
        if (allIceBreakersAsked) {
          // ========================================================================
          // DISCOVERY LOGIC: Every 10th Standard question (excluding discovery)
          // ========================================================================
          let isDiscoveryQuestion = false
          
          // Check if this should be a discovery question (every 10th Standard)
          // BUG FIX 3: Only trigger discovery if group has asked questions for all their own interests at least once
          if (standardCountForDiscovery > 0 && standardCountForDiscovery % 10 === 0) {
            // Get group's explicit and inferred interests
            const { data: groupDataForDiscovery } = await supabaseClient
              .from("groups")
              .select("inferred_interests")
              .eq("id", group.id)
              .single()
            
            const inferredInterests = groupDataForDiscovery?.inferred_interests || []
            
            // Get explicit interests
            const { data: explicitInterestsData } = await supabaseClient
              .from("group_interests")
              .select("interest:interests(name)")
              .eq("group_id", group.id)
            
            const explicitInterests = (explicitInterestsData || [])
              .map((gi: any) => gi.interest?.name)
              .filter((name: string) => name)
            
            const allGroupInterests = [...explicitInterests, ...inferredInterests]
            
            // BUG FIX 3: Check if group has asked questions for all their interests at least once
            // Get all Standard prompts asked by this group and check which interests they cover
            const { data: askedPromptsWithInterests } = await supabaseClient
              .from("daily_prompts")
              .select("prompt:prompts(interests)")
              .eq("group_id", group.id)
              .is("user_id", null)
              .not("is_discovery", "eq", true) // Exclude discovery questions
            
            const askedInterestsSet = new Set<string>()
            if (askedPromptsWithInterests) {
              for (const dp of askedPromptsWithInterests) {
                const prompt = dp.prompt as any
                if (prompt?.interests && Array.isArray(prompt.interests)) {
                  for (const interest of prompt.interests) {
                    askedInterestsSet.add(interest)
                  }
                }
              }
            }
            
            // Check if all group interests have been asked at least once
            const allInterestsAsked = allGroupInterests.length === 0 || 
              allGroupInterests.every(interest => askedInterestsSet.has(interest))
            
            // Only proceed with discovery if all group interests have been asked
            if (!allInterestsAsked) {
              console.log(`[schedule-daily-prompts] Group ${group.id}: Skipping discovery - not all group interests have been asked yet. Group interests: ${allGroupInterests.join(', ')}, Asked interests: ${Array.from(askedInterestsSet).join(', ')}`)
              // Fall through to standard interest cycle instead
            } else {
            
            // Check if we're already testing a discovery interest
            const { data: activeDiscovery } = await supabaseClient
              .from("discovery_attempts")
              .select("interest_name, question_count")
              .eq("group_id", group.id)
              .eq("status", "testing")
              .order("last_tested_date", { ascending: false })
              .limit(1)
              .maybeSingle()
            
            if (activeDiscovery && activeDiscovery.question_count < 3) {
              // Continue testing the active discovery interest
              discoveryInterest = activeDiscovery.interest_name
              isDiscoveryQuestion = true
              
              // CRITICAL FIX: Fetch all Standard prompts with this interest, then filter in JavaScript
              // This avoids PGRST100 error when excludeIds array is too large
              const { data: allDiscoveryPrompts } = await supabaseClient
                .from("prompts")
                .select("*")
                .eq("category", "Standard")
                .contains("interests", [discoveryInterest])
              
              // Filter in JavaScript using Array.includes() for consistency
              const discoveryPrompts = (allDiscoveryPrompts || []).filter((p: any) => {
                if (askedStandardArray.includes(p.id)) return false
                if (askedCustomArray.includes(p.id)) return false
                if (lastStandardPromptId && p.id === lastStandardPromptId) return false
                return true
              })
              
              if (discoveryPrompts && discoveryPrompts.length > 0) {
                const randomIndex = Math.floor(Math.random() * discoveryPrompts.length)
                selectedPrompt = discoveryPrompts[randomIndex]
                selectionMethod = `discovery_${discoveryInterest}`
              } else {
                // No more questions for this interest - fallback to standard cycle
                isDiscoveryQuestion = false
                discoveryInterest = null
              }
            } else {
              // Get related interests (not already in group's interests)
              // Use the get_related_interests function
              const { data: relatedInterests } = await supabaseClient
                .rpc("get_related_interests", {
                  p_group_id: group.id,
                  p_limit: 5,
                })
              
              // Try each related interest until we find one with available questions
              if (relatedInterests && relatedInterests.length > 0) {
                for (const related of relatedInterests) {
                  // CRITICAL FIX: Fetch all Standard prompts with this interest, then filter in JavaScript
                  const { data: allDiscoveryPrompts } = await supabaseClient
                    .from("prompts")
                    .select("*")
                    .eq("category", "Standard")
                    .contains("interests", [related.interest_name])
                  
                  // Filter in JavaScript
                  const discoveryPrompts = (allDiscoveryPrompts || []).filter((p: any) => {
                    if (askedStandardPromptIds.has(p.id)) return false
                    if (askedCustomQuestionIds.has(p.id)) return false
                    if (lastStandardPromptId && p.id === lastStandardPromptId) return false
                    return true
                  })
                  
                  if (discoveryPrompts && discoveryPrompts.length > 0) {
                    discoveryInterest = related.interest_name
                    isDiscoveryQuestion = true
                    
                    // Start or update discovery attempt
                    const { data: existingAttempt } = await supabaseClient
                      .from("discovery_attempts")
                      .select("id")
                      .eq("group_id", group.id)
                      .eq("interest_name", discoveryInterest)
                      .maybeSingle()
                    
                    if (existingAttempt) {
                      // Update existing attempt (shouldn't happen in this branch, but handle it)
                      await supabaseClient
                        .from("discovery_attempts")
                        .update({
                          last_tested_date: today,
                        })
                        .eq("id", existingAttempt.id)
                    } else {
                      // Create new attempt
                      await supabaseClient
                        .from("discovery_attempts")
                        .insert({
                          group_id: group.id,
                          interest_name: discoveryInterest,
                          question_count: 0, // Will be incremented when engagement is calculated
                          last_tested_date: today,
                          status: "testing",
                        })
                    }
                    break
                  }
                }
              }
            }
            
            // If we found a discovery interest, select a question from it (excluding last prompt)
            if (isDiscoveryQuestion && discoveryInterest) {
              // CRITICAL FIX: Fetch all Standard prompts with this interest, then filter in JavaScript
              const { data: allDiscoveryPrompts } = await supabaseClient
                .from("prompts")
                .select("*")
                .eq("category", "Standard")
                .contains("interests", [discoveryInterest])
              
              // Filter in JavaScript using Array.includes() for consistency
              const discoveryPrompts = (allDiscoveryPrompts || []).filter((p: any) => {
                if (askedStandardArray.includes(p.id)) return false
                if (askedCustomArray.includes(p.id)) return false
                if (lastStandardPromptId && p.id === lastStandardPromptId) return false
                return true
              })
              
              if (discoveryPrompts && discoveryPrompts.length > 0) {
                const randomIndex = Math.floor(Math.random() * discoveryPrompts.length)
                selectedPrompt = discoveryPrompts[randomIndex]
                selectionMethod = `discovery_${discoveryInterest}`
              } else {
                // Discovery interest has no questions - fallback to standard cycle
                isDiscoveryQuestion = false
                discoveryInterest = null
              }
            }
            } // End of allInterestsAsked check - only proceed with discovery if all group interests asked
          } // End of discovery check (every 10th Standard)

          // ========================================================================
          // STANDARD INTEREST CYCLE LOGIC (if not discovery)
          // ========================================================================
          if (!selectedPrompt) {
            // Note: askedStandardArray and askedCustomArray are already created above for use throughout
            
            // Get group interests with weights (user counts)
            // First get all group interests (explicit)
            const { data: groupInterestsData } = await supabaseClient
              .from("group_interests")
              .select(`
                interest_id,
                interest:interests(name)
              `)
              .eq("group_id", group.id)

            // Calculate weights (user counts) for each interest
            const interestWeights = new Map<string, number>()
            if (groupInterestsData && groupInterestsData.length > 0) {
              // Get all group members
              const { data: groupMembers } = await supabaseClient
                .from("group_members")
                .select("user_id")
                .eq("group_id", group.id)
              
              const memberIds = (groupMembers || []).map((m: any) => m.user_id)
              
              // For each interest, count how many members selected it
              for (const gi of groupInterestsData) {
                const interest = gi.interest as any
                if (interest?.name && gi.interest_id) {
                  // Count users who selected this interest
                  const { data: userInterests } = await supabaseClient
                    .from("user_interests")
                    .select("user_id")
                    .eq("interest_id", gi.interest_id)
                    .in("user_id", memberIds)
                  
                  const userCount = (userInterests || []).length
                  if (userCount > 0) {
                    interestWeights.set(interest.name, userCount)
                  }
                }
              }
            }

            // Get group's inferred interests and add them to the cycle
            // BUG FIX 2: Also get last_interest_used to prevent back-to-back same interest
            const { data: groupData } = await supabaseClient
              .from("groups")
              .select("interest_cycle_position, interest_cycle_interests, inferred_interests, last_interest_used")
              .eq("id", group.id)
              .single()

            const inferredInterests = groupData?.inferred_interests || []
            const lastInterestUsed = groupData?.last_interest_used || null
            
            // Add inferred interests to weights (with weight = 1, or we could use a different weight)
            // For now, treat inferred interests as having weight 1 (they're less prominent)
            for (const inferred of inferredInterests) {
              if (!interestWeights.has(inferred)) {
                interestWeights.set(inferred, 1)
              }
            }

            let cyclePosition = groupData?.interest_cycle_position || 0
            let cycleInterests = groupData?.interest_cycle_interests || []

            // If no cycle interests set or interests have changed, rebuild cycle
            // Compare total count (explicit + inferred) with cycle length
            const totalInterestCount = interestWeights.size
            if (cycleInterests.length === 0 || totalInterestCount !== cycleInterests.length) {
              // Sort interests by weight (descending), then by name for consistency
              const sortedInterests = Array.from(interestWeights.entries())
                .sort((a, b) => {
                  if (b[1] !== a[1]) return b[1] - a[1] // Higher weight first
                  return a[0].localeCompare(b[0]) // Alphabetical if same weight
                })
                .map(([name]) => name)
              
              cycleInterests = sortedInterests
              cyclePosition = 0
              
              // Update group with new cycle
              await supabaseClient
                .from("groups")
                .update({
                  interest_cycle_interests: cycleInterests,
                  interest_cycle_position: 0,
                })
                .eq("id", group.id)
            }

          // Determine which interest to use (or null for break)
          // BUG FIX 2: Prevent back-to-back same interest by skipping if it matches lastInterestUsed
          let targetInterest: string | null = null
          
          if (cycleInterests.length === 0) {
            // No interests - use null (fallback to random Standard)
            targetInterest = null
          } else if (cycleInterests.length === 1) {
            // Single interest - alternate with null, but skip if last was this interest
            if (lastInterestUsed === cycleInterests[0]) {
              // Last was this interest, use null break
              targetInterest = null
            } else {
              // Alternate: 0 (interest), 1 (null), 0, 1...
              targetInterest = cyclePosition % 2 === 0 ? cycleInterests[0] : null
            }
          } else {
            // Multiple interests - cycle through them, then null break
            // BUG FIX 2: Skip the interest if it matches lastInterestUsed
            if (cyclePosition < cycleInterests.length) {
              const candidateInterest = cycleInterests[cyclePosition]
              // If this interest was used last time, skip to next or null break
              if (lastInterestUsed === candidateInterest && cycleInterests.length > 1) {
                // Skip to next interest or null break
                if (cyclePosition + 1 < cycleInterests.length) {
                  targetInterest = cycleInterests[cyclePosition + 1]
                  cyclePosition = cyclePosition + 1 // Adjust position
                } else {
                  // Was last interest, use null break
                  targetInterest = null
                }
              } else {
                targetInterest = candidateInterest
              }
            } else if (cyclePosition === cycleInterests.length) {
              // Null break after all interests
              targetInterest = null
            } else {
              // Reset cycle - but skip if first interest was last used
              if (lastInterestUsed === cycleInterests[0] && cycleInterests.length > 1) {
                targetInterest = cycleInterests[1]
                cyclePosition = 1
              } else {
                targetInterest = cycleInterests[0]
                cyclePosition = 0
              }
            }
          }

          // Get Standard questions matching the target interest
          let standardPrompts: any[] = []
          
          // CRITICAL FIX: Fetch all Standard prompts first, then filter in JavaScript
          // This avoids PGRST100 error when excludeIds array is too large
          const excludeRecentIds = Array.from(recentPromptIds)
          
          if (targetInterest === null) {
            // Get Standard questions with null/empty interests - paginate to get ALL
            let allNullInterestPrompts: any[] = []
            let from = 0
            const pageSize = 1000
            let hasMore = true
            
            while (hasMore) {
              const { data: pagePrompts, error } = await supabaseClient
                .from("prompts")
                .select("*")
                .eq("category", "Standard")
                .or("interests.is.null,interests.eq.{}")
                .range(from, from + pageSize - 1)
              
              if (error) {
                console.error(`[schedule-daily-prompts] Group ${group.id}: Error fetching null-interest prompts:`, error)
                break
              }
              
              if (pagePrompts && pagePrompts.length > 0) {
                allNullInterestPrompts = allNullInterestPrompts.concat(pagePrompts)
                from += pageSize
                if (pagePrompts.length < pageSize) {
                  hasMore = false
                }
              } else {
                hasMore = false
              }
            }
            
            // Filter in JavaScript using Array.includes() for consistency with fallback
            let availablePrompts = allNullInterestPrompts.filter((p: any) => {
              if (askedStandardArray.includes(p.id)) return false
              if (askedCustomArray.includes(p.id)) return false
              if (lastStandardPromptId && p.id === lastStandardPromptId) return false
              return true
            })
            
            // DEBUG: Log filtering results for interest-based selection
            if (availablePrompts.length === 0 && allNullInterestPrompts.length > 0) {
              const excludedByAsked = allNullInterestPrompts.filter((p: any) => askedStandardArray.includes(p.id)).length
              console.error(`[schedule-daily-prompts] Group ${group.id}: INTEREST-BASED NULL - Fetched: ${allNullInterestPrompts.length}, Available: 0, Excluded by asked: ${excludedByAsked}`)
            }
            
            // Filter out recent prompts if we have enough options
            if (availablePrompts.length > excludeRecentIds.length) {
              availablePrompts = availablePrompts.filter((p: any) => !excludeRecentIds.includes(p.id))
            }
            standardPrompts = availablePrompts
          } else {
            // Get Standard questions where interests array contains targetInterest - paginate to get ALL
            let allInterestPrompts: any[] = []
            let from = 0
            const pageSize = 1000
            let hasMore = true
            
            while (hasMore) {
              const { data: pagePrompts, error } = await supabaseClient
                .from("prompts")
                .select("*")
                .eq("category", "Standard")
                .contains("interests", [targetInterest])
                .range(from, from + pageSize - 1)
              
              if (error) {
                console.error(`[schedule-daily-prompts] Group ${group.id}: Error fetching interest prompts for ${targetInterest}:`, error)
                break
              }
              
              if (pagePrompts && pagePrompts.length > 0) {
                allInterestPrompts = allInterestPrompts.concat(pagePrompts)
                from += pageSize
                if (pagePrompts.length < pageSize) {
                  hasMore = false
                }
              } else {
                hasMore = false
              }
            }
            
            // Filter in JavaScript using Array.includes() for consistency with fallback
            let availablePrompts = allInterestPrompts.filter((p: any) => {
              if (askedStandardArray.includes(p.id)) return false
              if (askedCustomArray.includes(p.id)) return false
              if (lastStandardPromptId && p.id === lastStandardPromptId) return false
              return true
            })
            
            // DEBUG: Log filtering results for interest-based selection
            if (availablePrompts.length === 0 && allInterestPrompts.length > 0) {
              const excludedByAsked = allInterestPrompts.filter((p: any) => askedStandardArray.includes(p.id)).length
              console.error(`[schedule-daily-prompts] Group ${group.id}: INTEREST-BASED ${targetInterest} - Fetched: ${allInterestPrompts.length}, Available: 0, Excluded by asked: ${excludedByAsked}`)
            }
            
            // Filter out recent prompts if we have enough options
            if (availablePrompts.length > excludeRecentIds.length) {
              availablePrompts = availablePrompts.filter((p: any) => !excludeRecentIds.includes(p.id))
            }
            standardPrompts = availablePrompts
          }

          // If no questions found for target interest, check if interest is exhausted
          if (standardPrompts.length === 0 && targetInterest !== null) {
            // Track the index before removing
            const removedIndex = cycleInterests.indexOf(targetInterest)
            
            // Interest is exhausted - remove from cycle
            cycleInterests = cycleInterests.filter((name) => name !== targetInterest)
            
            // Update group with shortened cycle
            await supabaseClient
              .from("groups")
              .update({
                interest_cycle_interests: cycleInterests,
              })
              .eq("id", group.id)
            
            // Adjust cycle position if we removed an interest at or before current position
            if (removedIndex >= 0 && removedIndex <= cyclePosition) {
              cyclePosition = Math.max(0, cyclePosition - 1)
            }
            
            // If cycle is now empty, fallback to null-interest questions (excluding last prompt)
            if (cycleInterests.length === 0) {
              // CRITICAL FIX: Fetch all Standard prompts with null interests, then filter in JavaScript - paginate to get ALL
              let allNullInterestPrompts: any[] = []
              let from = 0
              const pageSize = 1000
              let hasMore = true
              
              while (hasMore) {
                const { data: pagePrompts, error } = await supabaseClient
                  .from("prompts")
                  .select("*")
                  .eq("category", "Standard")
                  .or("interests.is.null,interests.eq.{}")
                  .range(from, from + pageSize - 1)
                
                if (error) {
                  console.error(`[schedule-daily-prompts] Group ${group.id}: Error fetching null-interest prompts (fallback):`, error)
                  break
                }
                
                if (pagePrompts && pagePrompts.length > 0) {
                  allNullInterestPrompts = allNullInterestPrompts.concat(pagePrompts)
                  from += pageSize
                  if (pagePrompts.length < pageSize) {
                    hasMore = false
                  }
                } else {
                  hasMore = false
                }
              }
              
              // Filter in JavaScript using Array.includes() for consistency with fallback
              standardPrompts = allNullInterestPrompts.filter((p: any) => {
                if (askedStandardArray.includes(p.id)) return false
                if (askedCustomArray.includes(p.id)) return false
                if (lastStandardPromptId && p.id === lastStandardPromptId) return false
                return true
              })
              targetInterest = null
            } else {
              // Recalculate target interest based on updated cycle
              if (cycleInterests.length === 1) {
                targetInterest = cyclePosition % 2 === 0 ? cycleInterests[0] : null
              } else {
                if (cyclePosition < cycleInterests.length) {
                  targetInterest = cycleInterests[cyclePosition]
                } else if (cyclePosition === cycleInterests.length) {
                  targetInterest = null
                } else {
                  targetInterest = cycleInterests[0]
                  cyclePosition = 0
                }
              }
              
              // Try to get questions for the new target interest (excluding last prompt)
              if (targetInterest === null) {
                // CRITICAL FIX: Fetch all Standard prompts with null interests, then filter in JavaScript - paginate to get ALL
                let allNullInterestPrompts: any[] = []
                let from = 0
                const pageSize = 1000
                let hasMore = true
                
                while (hasMore) {
                  const { data: pagePrompts, error } = await supabaseClient
                    .from("prompts")
                    .select("*")
                    .eq("category", "Standard")
                    .or("interests.is.null,interests.eq.{}")
                    .range(from, from + pageSize - 1)
                  
                  if (error) {
                    console.error(`[schedule-daily-prompts] Group ${group.id}: Error fetching null-interest prompts (recalc):`, error)
                    break
                  }
                  
                  if (pagePrompts && pagePrompts.length > 0) {
                    allNullInterestPrompts = allNullInterestPrompts.concat(pagePrompts)
                    from += pageSize
                    if (pagePrompts.length < pageSize) {
                      hasMore = false
                    }
                  } else {
                    hasMore = false
                  }
                }
                
                // Filter in JavaScript using Array.includes() for consistency with fallback
                standardPrompts = allNullInterestPrompts.filter((p: any) => {
                  if (askedStandardArray.includes(p.id)) return false
                  if (askedCustomArray.includes(p.id)) return false
                  if (lastStandardPromptId && p.id === lastStandardPromptId) return false
                  return true
                })
              } else {
                // CRITICAL FIX: Fetch all Standard prompts with target interest, then filter in JavaScript - paginate to get ALL
                let allNextInterestPrompts: any[] = []
                let from = 0
                const pageSize = 1000
                let hasMore = true
                
                while (hasMore) {
                  const { data: pagePrompts, error } = await supabaseClient
                    .from("prompts")
                    .select("*")
                    .eq("category", "Standard")
                    .contains("interests", [targetInterest])
                    .range(from, from + pageSize - 1)
                  
                  if (error) {
                    console.error(`[schedule-daily-prompts] Group ${group.id}: Error fetching interest prompts for ${targetInterest} (recalc):`, error)
                    break
                  }
                  
                  if (pagePrompts && pagePrompts.length > 0) {
                    allNextInterestPrompts = allNextInterestPrompts.concat(pagePrompts)
                    from += pageSize
                    if (pagePrompts.length < pageSize) {
                      hasMore = false
                    }
                  } else {
                    hasMore = false
                  }
                }
                
                // Filter in JavaScript using Array.includes() for consistency with fallback
                standardPrompts = allNextInterestPrompts.filter((p: any) => {
                  if (askedStandardArray.includes(p.id)) return false
                  if (askedCustomArray.includes(p.id)) return false
                  if (lastStandardPromptId && p.id === lastStandardPromptId) return false
                  return true
                })
              }
            }
          }
          }

          // Select random question from available prompts (already filtered to exclude last Standard prompt)
          const availablePrompts = standardPrompts
          
          if (availablePrompts.length > 0) {
            const randomIndex = Math.floor(Math.random() * availablePrompts.length)
            selectedPrompt = availablePrompts[randomIndex]
            selectionMethod = targetInterest ? `standard_interest_${targetInterest}` : "standard_null_break"
            console.error(`[schedule-daily-prompts] Group ${group.id}: INTEREST-BASED SELECTION - Selected prompt ${selectedPrompt.id} via ${selectionMethod}`)
            
            // Update cycle position for next time
            let nextPosition: number
            if (cycleInterests.length === 0) {
              // No interests - keep position at 0
              nextPosition = 0
            } else if (cycleInterests.length === 1) {
              // Single interest - alternate: 0 (interest), 1 (null), 0, 1...
              nextPosition = (cyclePosition + 1) % 2
            } else {
              // Multiple interests - cycle: 0..N-1 (interests), N (null), then reset to 0
              nextPosition = cyclePosition + 1
              if (nextPosition > cycleInterests.length) {
                // Completed full cycle (all interests + null break), reset
                nextPosition = 0
              }
            }
            
            // BUG FIX 2: Update last_interest_used to prevent back-to-back same interest
            await supabaseClient
              .from("groups")
              .update({
                interest_cycle_position: nextPosition,
                last_interest_used: targetInterest, // Track which interest was just used
              })
              .eq("id", group.id)
          }
        }

        // Fallback: If no interest-based selection worked, use random Standard (original behavior)
        // BUG FIX 1 & 5: Check if group has interests - if not, only use null-interest prompts
        console.error(`[schedule-daily-prompts] Group ${group.id}: BEFORE FALLBACK CHECK - selectedPrompt: ${selectedPrompt ? selectedPrompt.id : 'null'}`)
        if (!selectedPrompt) {
          console.error(`[schedule-daily-prompts] Group ${group.id}: FALLBACK TRIGGERED - Checking group interests for filtering`)
          
          // BUG FIX 1: Check if group has any interests
          const { data: groupInterestsCheck } = await supabaseClient
            .from("group_interests")
            .select("interest_id")
            .eq("group_id", group.id)
            .limit(1)
          
          const { data: groupDataCheck } = await supabaseClient
            .from("groups")
            .select("inferred_interests")
            .eq("id", group.id)
            .single()
          
          const hasExplicitInterests = (groupInterestsCheck?.length || 0) > 0
          const hasInferredInterests = (groupDataCheck?.inferred_interests?.length || 0) > 0
          const hasAnyInterests = hasExplicitInterests || hasInferredInterests
          
          let availablePrompts: any[] = []
          let fallbackDebug: any = {}
          
          if (!hasAnyInterests) {
            // BUG FIX 1: Group has no interests - only use null-interest Standard prompts
            console.error(`[schedule-daily-prompts] Group ${group.id}: FALLBACK - Group has no interests, filtering to null-interest prompts only`)
            
            // Fetch all Standard prompts with null/empty interests
            let allNullInterestPrompts: any[] = []
            let from = 0
            const pageSize = 1000
            let hasMore = true
            
            while (hasMore) {
              const { data: pagePrompts, error } = await supabaseClient
                .from("prompts")
                .select("*")
                .eq("category", "Standard")
                .or("interests.is.null,interests.eq.{}")
                .range(from, from + pageSize - 1)
              
              if (error) {
                console.error(`[schedule-daily-prompts] Group ${group.id}: Error fetching null-interest prompts in fallback:`, error)
                break
              }
              
              if (pagePrompts && pagePrompts.length > 0) {
                allNullInterestPrompts = allNullInterestPrompts.concat(pagePrompts)
                from += pageSize
                if (pagePrompts.length < pageSize) {
                  hasMore = false
                }
              } else {
                hasMore = false
              }
            }
            
            // Filter using same logic as getAvailableStandardPrompts
            const askedStandardArray = Array.from(askedStandardPromptIds)
            const askedCustomArray = Array.from(askedCustomQuestionIds)
            
            availablePrompts = allNullInterestPrompts.filter((p: any) => {
              if (askedStandardArray.includes(p.id)) return false
              if (askedCustomArray.includes(p.id)) return false
              if (lastStandardPromptId && p.id === lastStandardPromptId) return false
              return true
            })
            
            fallbackDebug = {
              askedStandardCount: askedStandardPromptIds.size,
              askedCustomCount: askedCustomQuestionIds.size,
              lastStandardPromptId,
              totalFetched: allNullInterestPrompts.length,
              availableAfterFilter: availablePrompts.length,
              filteredToNullInterestOnly: true,
              groupHasInterests: false
            }
          } else {
            // Group has interests - use standard fallback (all Standard prompts)
            console.error(`[schedule-daily-prompts] Group ${group.id}: FALLBACK - Group has interests, using all Standard prompts`)
            
            const result = await getAvailableStandardPrompts(
              supabaseClient,
              askedStandardPromptIds,
              lastStandardPromptId,
              askedCustomQuestionIds,
              group.id
            )
            
            availablePrompts = result.prompts
            fallbackDebug = { ...result.debug, filteredToNullInterestOnly: false, groupHasInterests: true }
          }
          
          // Store debug info
          filteringDebug = fallbackDebug
          
          console.error(`[schedule-daily-prompts] Group ${group.id}: FALLBACK RESULTS - Available: ${availablePrompts.length}, Debug: ${JSON.stringify(fallbackDebug)}`)
          
          // BUG FIX 5: Ensure we always select something if prompts are available
          if (availablePrompts && availablePrompts.length > 0) {
            const randomIndex = Math.floor(Math.random() * availablePrompts.length)
            selectedPrompt = availablePrompts[randomIndex]
            selectionMethod = hasAnyInterests ? "standard_fallback" : "standard_null_fallback"
            console.error(`[schedule-daily-prompts] Group ${group.id}: FALLBACK SELECTION - Selected Standard prompt: ${selectedPrompt.id} from ${availablePrompts.length} available`)
          } else {
            // BUG FIX 5: If still no prompts, try removing last prompt restriction as last resort
            console.error(`[schedule-daily-prompts] Group ${group.id}: FALLBACK - No prompts available after filtering. Trying without last prompt restriction...`)
            
            // Last resort: try without last prompt restriction
            let lastResortPrompts: any[] = []
            if (!hasAnyInterests) {
              // Fetch null-interest prompts without last prompt restriction
              const { data: nullPrompts } = await supabaseClient
                .from("prompts")
                .select("*")
                .eq("category", "Standard")
                .or("interests.is.null,interests.eq.{}")
              
              const askedStandardArray = Array.from(askedStandardPromptIds)
              const askedCustomArray = Array.from(askedCustomQuestionIds)
              
              lastResortPrompts = (nullPrompts || []).filter((p: any) => {
                if (askedStandardArray.includes(p.id)) return false
                if (askedCustomArray.includes(p.id)) return false
                return true
              })
            } else {
              // Fetch all Standard prompts without last prompt restriction
              const { data: allStandardPrompts } = await supabaseClient
                .from("prompts")
                .select("*")
                .eq("category", "Standard")
              
              const askedStandardArray = Array.from(askedStandardPromptIds)
              const askedCustomArray = Array.from(askedCustomQuestionIds)
              
              lastResortPrompts = (allStandardPrompts || []).filter((p: any) => {
                if (askedStandardArray.includes(p.id)) return false
                if (askedCustomArray.includes(p.id)) return false
                return true
              })
            }
            
            if (lastResortPrompts.length > 0) {
              const randomIndex = Math.floor(Math.random() * lastResortPrompts.length)
              selectedPrompt = lastResortPrompts[randomIndex]
              selectionMethod = hasAnyInterests ? "standard_fallback_last_resort" : "standard_null_fallback_last_resort"
              console.error(`[schedule-daily-prompts] Group ${group.id}: LAST RESORT SELECTION - Selected Standard prompt: ${selectedPrompt.id} from ${lastResortPrompts.length} available (ignoring last prompt restriction)`)
            } else {
              console.error(`[schedule-daily-prompts] Group ${group.id}: FALLBACK - No prompts available even after removing last prompt restriction. Debug info in response.`)
            }
          }
        }
      }

      // CRITICAL: If all prompts have been asked, DO NOT schedule anything
      // Prompts MUST NEVER repeat - once asked, they are permanently excluded
      console.error(`[schedule-daily-prompts] Group ${group.id}: FINAL CHECK - selectedPrompt: ${selectedPrompt ? selectedPrompt.id : 'null'}, selectionMethod: ${selectionMethod || 'none'}`)
      if (!selectedPrompt) {
        // Enhanced logging to help debug why no prompt was selected
        const { count: totalStandardPromptsCount, error: countError } = await supabaseClient
          .from("prompts")
          .select("id", { count: "exact", head: true })
          .eq("category", "Standard")
        
        if (countError) {
          console.error(`[schedule-daily-prompts] Group ${group.id}: Error counting Standard prompts:`, countError)
        }
        
        // If filteringDebug wasn't set (fallback didn't run), set it here with basic info
        // This ensures we always have debug info in the response
        if (!filteringDebug) {
          filteringDebug = {
            askedStandardCount: askedStandardPromptIds.size,
            totalInDB: totalStandardPromptsCount || null,
            selectionMethodAttempted: selectionMethod || 'none',
            fallbackDidNotRun: true
          }
        }
        
        console.error(`[schedule-daily-prompts] Group ${group.id}: NO PROMPT SELECTED! Total Standard prompts in DB: ${totalStandardPromptsCount || 'unknown'}, Asked Standard prompts: ${askedStandardPromptIds.size}, Custom asked: ${askedCustomQuestionIds.size}, Last Standard prompt: ${lastStandardPromptId || 'none'}, Selection method attempted: ${selectionMethod || 'none'}`)
        
        results.push({ 
          group_id: group.id, 
          status: "no_prompts_available",
          message: `No available prompts. Total Standard in DB: ${totalStandardPromptsCount || 'unknown'}, Asked Standard: ${askedStandardPromptIds.size}`,
          debug: filteringDebug
        })
        continue // Skip to next group - do NOT schedule a repeat prompt
      }

      // CRITICAL FIX: Schedule the selected prompt with error handling
      // Ensure we always insert a prompt, even if there's a race condition
      const insertData: any = {
        group_id: group.id,
        prompt_id: selectedPrompt.id,
        date: today,
      }
      
      // Mark discovery questions
      if (discoveryInterest) {
        insertData.is_discovery = true
        insertData.discovery_interest = discoveryInterest
      }
      
      const { error: insertError } = await supabaseClient.from("daily_prompts").insert(insertData)

      if (insertError) {
        // Check if error is due to duplicate key (race condition - another instance already scheduled)
        if (insertError.code === "23505") {
          console.log(`[schedule-daily-prompts] Group ${group.id}: Prompt already scheduled (race condition), skipping insert`)
          results.push({ group_id: group.id, status: "already_scheduled_race_condition" })
        } else {
          console.error(`[schedule-daily-prompts] Group ${group.id}: Failed to insert prompt:`, insertError)
          results.push({ group_id: group.id, status: "error_insert_failed", error: insertError.message })
          // Don't continue - try to insert again or use a different approach
          // For now, log error but don't block other groups
        }
        continue
      }

      console.error(`[schedule-daily-prompts] Group ${group.id}: PROMPT SELECTED - ID: ${selectedPrompt.id}, Method: ${selectionMethod}`)
      results.push({
        group_id: group.id,
        status: "scheduled",
        prompt_id: selectedPrompt.id,
        selection_method: selectionMethod,
        deck_id: selectedDeckId,
      })
      } catch (groupError) {
        const groupErrorMessage = groupError instanceof Error ? groupError.message : String(groupError)
        console.error(`[schedule-daily-prompts] Group ${group.id}: ERROR - ${groupErrorMessage}`)
        results.push({
          group_id: group.id,
          status: "error",
          error: groupErrorMessage
        })
      }
    }

    // Include debug summary in response
    const debugSummary = {
      totalGroups: groups?.length || 0,
      date: today,
      resultsSummary: {
        scheduled: results.filter((r: any) => r.status === "scheduled").length,
        noPromptsAvailable: results.filter((r: any) => r.status === "no_prompts_available").length,
        errors: results.filter((r: any) => r.status === "error").length,
      }
    }
    
    return new Response(JSON.stringify({ success: true, results, debug: debugSummary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[schedule-daily-prompts] Fatal error:", errorMessage)
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    })
  }
})


