import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Helper function to calculate day index (group-specific randomization)
function getDayIndex(dateString: string, groupId: string): number {
  const base = new Date(dateString)
  const start = new Date("2020-01-01")
  const diff = Math.floor((base.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  const groupOffset = groupId.length
  return diff + groupOffset
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

    // Get all groups with ice-breaker completion status
    const { data: groups, error: groupsError } = await supabaseClient
      .from("groups")
      .select("id, name, ice_breaker_queue_completed_date")

    if (groupsError) throw groupsError

    const today = new Date().toISOString().split("T")[0]
    const todayMonthDay = today.substring(5) // MM-DD format for birthday comparison
    const results = []

    for (const group of groups || []) {
      // Check if group is still in ice-breaker period
      // BUT: Allow queued items (Featured, Custom, etc.) to be scheduled even during ice-breaker period
      let isInIceBreakerPeriod = false
      if (group.ice_breaker_queue_completed_date) {
        const completionDate = new Date(group.ice_breaker_queue_completed_date)
        const todayDate = new Date(today)
        
        if (completionDate > todayDate) {
          isInIceBreakerPeriod = true
        }
      } else {
        // If completion date is NULL, group hasn't initialized ice-breaker queue yet
        // This shouldn't happen for active groups, but we'll skip to be safe
        console.log(`[schedule-daily-prompts] Group ${group.id} has NULL ice_breaker_queue_completed_date, skipping (may need initialization)`)
        results.push({ 
          group_id: group.id, 
          status: "skipped_no_completion_date"
        })
        continue
      }
      
      // Check if there are queued items (Featured, Custom, etc.) that should be processed
      // These should be scheduled even during ice-breaker period
      const { data: queuedItems } = await supabaseClient
        .from("group_prompt_queue")
        .select("id, prompt_id, prompt:prompts(category)")
        .eq("group_id", group.id)
        .order("position", { ascending: true })
        .limit(1)
      
      const hasQueuedItems = queuedItems && queuedItems.length > 0
      
      // If in ice-breaker period and no queued items, skip normal generation
      if (isInIceBreakerPeriod && !hasQueuedItems) {
        console.log(`[schedule-daily-prompts] Group ${group.id} still in ice-breaker period (completes ${group.ice_breaker_queue_completed_date}), skipping normal generation`)
        results.push({ 
          group_id: group.id, 
          status: "skipped_ice_breaker_period",
          completion_date: group.ice_breaker_queue_completed_date
        })
        continue
      }
      
      // If in ice-breaker period but has queued items, log and continue (will process queue)
      if (isInIceBreakerPeriod && hasQueuedItems) {
        console.log(`[schedule-daily-prompts] Group ${group.id} in ice-breaker period but has queued items, processing queue`)
      }
      
      // PRIORITY 1: Check for birthdays TODAY (HIGHEST PRIORITY - cannot be skipped)
      // Get all group members with their birthdays
      const { data: members, error: membersError } = await supabaseClient
        .from("group_members")
        .select("user_id, user:users(id, name, birthday)")
        .eq("group_id", group.id)

      if (membersError) throw membersError

      // Check for birthdays today
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

          // Get "their_birthday" prompt for all other members
          const { data: theirBirthdayPrompt } = await supabaseClient
            .from("prompts")
            .select("id")
            .eq("category", "Birthday")
            .eq("birthday_type", "their_birthday")
            .limit(1)
            .maybeSingle()

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

        results.push({
          group_id: group.id,
          status: "birthday_scheduled",
          birthday_members: birthdayMembers.map((m) => m.name),
        })
        continue // Skip all other scheduling - birthday is highest priority
      }

      // PRIORITY 2: Check for custom question scheduled for today
      const { data: customQuestion } = await supabaseClient
        .from("custom_questions")
        .select("id, prompt_id, date_asked")
        .eq("group_id", group.id)
        .eq("date_asked", today)
        .not("prompt_id", "is", null)
        .maybeSingle()

      if (customQuestion && customQuestion.prompt_id) {
        // CRITICAL: Check if daily_prompt already exists for this custom question TODAY
        const { data: existingCustomPrompt } = await supabaseClient
          .from("daily_prompts")
          .select("id")
          .eq("group_id", group.id)
          .eq("date", today)
          .eq("prompt_id", customQuestion.prompt_id)
          .maybeSingle()

        if (existingCustomPrompt) {
          results.push({ group_id: group.id, status: "already_scheduled", type: "custom" })
          continue
        }

        // CRITICAL: Check if this same prompt_id was already asked recently (prevent back-to-back)
        // We should NEVER show the same question back-to-back, even if it's a custom question
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split("T")[0]

        const { data: recentPrompt } = await supabaseClient
          .from("daily_prompts")
          .select("id, date, prompt_id")
          .eq("group_id", group.id)
          .eq("prompt_id", customQuestion.prompt_id)
          .gte("date", yesterdayStr) // Check yesterday and today
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle()

        if (recentPrompt) {
          console.log(`[schedule-daily-prompts] Group ${group.id}: Custom question prompt_id ${customQuestion.prompt_id} was already asked on ${recentPrompt.date}, skipping to prevent back-to-back`)
          results.push({ 
            group_id: group.id, 
            status: "skipped_custom_question_back_to_back",
            prompt_id: customQuestion.prompt_id,
            last_asked_date: recentPrompt.date
          })
          // Continue to regular prompt scheduling instead of skipping
          // Don't use 'continue' here - let it fall through to regular scheduling
        } else {
          // Safe to schedule - this prompt_id hasn't been asked recently
          // Create daily_prompt entry for custom question
          await supabaseClient.from("daily_prompts").insert({
            group_id: group.id,
            prompt_id: customQuestion.prompt_id,
            date: today,
          })

          results.push({ group_id: group.id, status: "custom_question_scheduled" })
          continue // Skip regular prompt scheduling
        }
      }

      // Check if group already has prompts for today (general or user-specific)
      const { data: existingPrompts } = await supabaseClient
        .from("daily_prompts")
        .select("id, user_id, prompt_id, prompt:prompts(category)")
        .eq("group_id", group.id)
        .eq("date", today)

      // Check if existing prompt is Remembering category and group has no memorials
      // If so, delete it and reschedule
      const hasMemorialsCheck = await supabaseClient
        .from("memorials")
        .select("id")
        .eq("group_id", group.id)
        .limit(1)
      const hasMemorials = (hasMemorialsCheck.data?.length || 0) > 0

      if (existingPrompts && existingPrompts.length > 0) {
        // Check if any existing prompt is Remembering without memorials
        const hasRememberingWithoutMemorials = existingPrompts.some((ep: any) => {
          const prompt = ep.prompt as any
          return prompt?.category === "Remembering" && !hasMemorials
        })

        if (hasRememberingWithoutMemorials) {
          // Delete the Remembering prompt and reschedule
          await supabaseClient
            .from("daily_prompts")
            .delete()
            .eq("group_id", group.id)
            .eq("date", today)
            .in("prompt_id", 
              existingPrompts
                .filter((ep: any) => ep.prompt?.category === "Remembering")
                .map((ep: any) => ep.prompt_id)
            )
          // Continue to reschedule below
        } else {
          results.push({ group_id: group.id, status: "already_scheduled" })
          continue
        }
      }

      // No birthdays or custom questions today - proceed with regular prompt logic
      // Get group type
      const { data: groupData } = await supabaseClient
        .from("groups")
        .select("type")
        .eq("id", group.id)
        .single()

      // hasMemorials already checked above

      // Get category preferences
      const { data: preferences } = await supabaseClient
        .from("question_category_preferences")
        .select("category, preference, weight")
        .eq("group_id", group.id)

      const disabledCategories = new Set(
        (preferences || []).filter((p) => p.preference === "none").map((p) => p.category)
      )

      // Determine eligible categories (same logic as initialize-group-queue)
      // Note: Fun/A Bit Deeper removed - replaced with deck system
      const eligibleCategories: string[] = []
      
      // Group type specific
      if (groupData?.type === "family") {
        if (!disabledCategories.has("Family")) {
          eligibleCategories.push("Family")
        }
        // Exclude Friends and Edgy/NSFW for Family groups
        disabledCategories.add("Friends")
        disabledCategories.add("Edgy/NSFW")
      } else if (groupData?.type === "friends") {
        if (!disabledCategories.has("Friends")) {
          eligibleCategories.push("Friends")
        }
        // Exclude Family for Friends groups
        disabledCategories.add("Family")
        // Edgy/NSFW is eligible ONLY if explicitly enabled (not disabled)
        // For friends groups, NSFW is opt-in (default disabled)
        const nsfwPref = (preferences || []).find((p) => p.category === "Edgy/NSFW")
        const nsfwEnabled = nsfwPref ? nsfwPref.preference !== "none" : false // Default to false (opt-in)
        if (nsfwEnabled && !disabledCategories.has("Edgy/NSFW")) {
          eligibleCategories.push("Edgy/NSFW")
        }
      }

      // Conditional categories
      // Don't include "Remembering" during ice-breaker period (even if group has memorials)
      // CRITICAL: Also check if a memorial question was already scheduled THIS WEEK
      // Maximum 1 memorial question per week, rotating by person
      let canScheduleMemorial = false
      if (hasMemorials && !disabledCategories.has("Remembering") && !isInIceBreakerPeriod) {
        // Check if a memorial question was already scheduled this week
        const todayDate = new Date(today)
        const dayOfWeek = todayDate.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        const weekStart = new Date(todayDate)
        
        // Calculate Monday of current week
        if (dayOfWeek === 0) {
          // If today is Sunday, subtract 6 days to get previous Monday
          weekStart.setDate(todayDate.getDate() - 6)
        } else {
          // Otherwise, subtract (dayOfWeek - 1) days to get Monday of current week
          weekStart.setDate(todayDate.getDate() - (dayOfWeek - 1))
        }
        
        const weekStartStr = weekStart.toISOString().split("T")[0]
        
        // Check if any "Remembering" prompts were scheduled this week
        const { data: weekMemorialPrompts } = await supabaseClient
          .from("daily_prompts")
          .select("id, prompt:prompts(category)")
          .eq("group_id", group.id)
          .gte("date", weekStartStr)
          .lte("date", today)
          .is("user_id", null) // Only check general prompts (not user-specific)
        
        const hasMemorialThisWeek = (weekMemorialPrompts || []).some((dp: any) => {
          const prompt = dp.prompt as any
          return prompt?.category === "Remembering"
        })
        
        if (!hasMemorialThisWeek) {
          canScheduleMemorial = true
          eligibleCategories.push("Remembering")
        } else {
          console.log(`[schedule-daily-prompts] Group ${group.id} already has a memorial question scheduled this week, skipping`)
          disabledCategories.add("Remembering")
        }
      } else {
        disabledCategories.add("Remembering")
      }

      // Get next prompt from queue first
      const { data: queuedItem } = await supabaseClient
        .from("group_prompt_queue")
        .select("prompt_id, prompt:prompts(*)")
        .eq("group_id", group.id)
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle()

      let selectedPrompt: any = null
      let selectionMethod: string = "random" // Track how prompt was selected

      if (queuedItem && queuedItem.prompt) {
        const queuedPrompt = queuedItem.prompt as any
        const memberCount = members?.length || 0
        
        // CRITICAL: Check if this prompt was asked recently (prevent back-to-back, including custom questions)
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split("T")[0]
        
        const { data: recentQueuedPrompt } = await supabaseClient
          .from("daily_prompts")
          .select("id, date, prompt_id")
          .eq("group_id", group.id)
          .eq("prompt_id", queuedItem.prompt_id)
          .gte("date", yesterdayStr) // Check yesterday and today
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle()
        
        if (recentQueuedPrompt) {
          console.log(`[schedule-daily-prompts] Group ${group.id}: Queued prompt_id ${queuedItem.prompt_id} was already asked on ${recentQueuedPrompt.date}, skipping to prevent back-to-back`)
          // Remove from queue since it can't be scheduled (already asked recently)
          await supabaseClient.from("group_prompt_queue").delete().eq("group_id", group.id).eq("prompt_id", queuedItem.prompt_id)
          // Continue to selection logic below (don't select this queued prompt)
        } else if (queuedPrompt.category === "Remembering") {
          // CRITICAL: Check if memorial question was already scheduled this week (hard limit: 1 per week)
          if (!hasMemorials || isInIceBreakerPeriod) {
            // Skip this queued prompt, continue to selection logic
            // Memorial questions should not be scheduled during ice-breaker period or without memorials
          } else {
            // Check if a memorial question was already scheduled this week
            const todayDate = new Date(today)
            const dayOfWeek = todayDate.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
            const weekStart = new Date(todayDate)
            
            // Calculate Monday of current week
            if (dayOfWeek === 0) {
              weekStart.setDate(todayDate.getDate() - 6)
            } else {
              weekStart.setDate(todayDate.getDate() - (dayOfWeek - 1))
            }
            
            const weekStartStr = weekStart.toISOString().split("T")[0]
            
            const { data: weekMemorialPrompts } = await supabaseClient
              .from("daily_prompts")
              .select("id, prompt:prompts(category)")
              .eq("group_id", group.id)
              .gte("date", weekStartStr)
              .lte("date", today)
              .is("user_id", null)
            
            const hasMemorialThisWeek = (weekMemorialPrompts || []).some((dp: any) => {
              const prompt = dp.prompt as any
              return prompt?.category === "Remembering"
            })
            
            if (hasMemorialThisWeek) {
              console.log(`[schedule-daily-prompts] Group ${group.id}: Memorial question already scheduled this week, skipping queued Remembering prompt`)
              // Remove from queue since it can't be scheduled (weekly limit reached)
              await supabaseClient.from("group_prompt_queue").delete().eq("group_id", group.id).eq("prompt_id", queuedItem.prompt_id)
              // Continue to selection logic below (don't select this queued prompt)
            } else {
              // Safe to schedule - no memorial question this week yet
              selectedPrompt = queuedPrompt
              selectionMethod = "queued"
            }
          }
        } else if (groupData?.type === "family" && queuedPrompt.category === "Friends") {
          // Skip Friends category prompts for Family groups
        } else if (groupData?.type === "friends" && queuedPrompt.category === "Family") {
          // Skip Family category prompts for Friends groups
        } else if (queuedPrompt.dynamic_variables && Array.isArray(queuedPrompt.dynamic_variables) && queuedPrompt.dynamic_variables.includes("member_name")) {
          // Skip {member_name} questions unless group has 3+ members
          if (memberCount < 3) {
            // Skip this queued prompt, continue to selection logic
          } else {
            selectedPrompt = queuedPrompt
            selectionMethod = "queued"
          }
        } else {
          selectedPrompt = queuedPrompt
          selectionMethod = "queued"
        }
      }

      // Check for deck questions (1 per week per active deck)
      // Note: Queued items take priority, but deck questions should still be checked
      // so they can be scheduled once queued items are processed
      let selectedDeckId: string | null = null
      let deckPromptCandidate: any = null
      
      // Check active decks and see if we need to schedule a deck question this week
      const { data: activeDecksData } = await supabaseClient
        .from("group_active_decks")
        .select("deck_id, deck:decks(id, name)")
        .eq("group_id", group.id)
        .eq("status", "active")
      
      if (activeDecksData && activeDecksData.length > 0) {
        // Get week start date (Monday of current week)
        // This matches the SQL function get_current_week_monday()
        const todayDate = new Date(today)
        const dayOfWeek = todayDate.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        const weekStart = new Date(todayDate)
        
        // Calculate Monday of current week
        if (dayOfWeek === 0) {
          // If today is Sunday, subtract 6 days to get previous Monday
          weekStart.setDate(todayDate.getDate() - 6)
        } else {
          // Otherwise, subtract (dayOfWeek - 1) days to get Monday of current week
          weekStart.setDate(todayDate.getDate() - (dayOfWeek - 1))
        }
        
        const weekStartStr = weekStart.toISOString().split("T")[0]
        
        // Check which decks have been used this week
        const { data: weekDeckPrompts } = await supabaseClient
          .from("daily_prompts")
          .select("deck_id")
          .eq("group_id", group.id)
          .gte("date", weekStartStr)
          .lte("date", today)
          .not("deck_id", "is", null)
          .is("user_id", null)
        
        const usedDeckIdsThisWeek = new Set((weekDeckPrompts || []).map((dp: any) => dp.deck_id))
        
        // Find decks that haven't been used this week
        const unusedDecksThisWeek = activeDecksData.filter(
          (ad: any) => !usedDeckIdsThisWeek.has(ad.deck_id)
        )
        
        if (unusedDecksThisWeek.length > 0) {
          // Pick a random unused deck
          const deckToUse = unusedDecksThisWeek[Math.floor(Math.random() * unusedDecksThisWeek.length)]
          
          // Get prompts from this deck that haven't been used
          const { data: usedPrompts } = await supabaseClient
            .from("daily_prompts")
            .select("prompt_id")
            .eq("group_id", group.id)
            .is("user_id", null)
          
          const usedPromptIds = usedPrompts?.map((p) => p.prompt_id) || []
          
          // Get available prompts from this deck
          const { data: deckPromptsData } = await supabaseClient
            .from("prompts")
            .select("*")
            .eq("deck_id", deckToUse.deck_id)
            .not("deck_id", "is", null)
            .order("deck_order", { ascending: true })
          
          const availableDeckPrompts = (deckPromptsData || []).filter(
            (p: any) => !usedPromptIds.includes(p.id)
          )
          
          if (availableDeckPrompts.length > 0) {
            // Store deck prompt candidate (will use if no queued prompt is selected)
            deckPromptCandidate = availableDeckPrompts[0]
            selectedDeckId = deckToUse.deck_id
          }
        }
      }
      
      // Use deck prompt if no queued prompt was selected
      // Queued items take priority, but deck questions should be scheduled once queued items are processed
      if (!selectedPrompt && deckPromptCandidate) {
        selectedPrompt = deckPromptCandidate
        selectionMethod = "deck"
        console.log(`[schedule-daily-prompts] Scheduling deck question from deck ${selectedDeckId} for ${today}`)
      }
      
      // PHASE 5: If no prompt selected yet, try personalized suggestions
      if (!selectedPrompt) {
        try {
          // Get prompts already asked (to exclude from personalized suggestions)
          const { data: usedPromptsForPersonalization } = await supabaseClient
            .from("daily_prompts")
            .select("prompt_id")
            .eq("group_id", group.id)
            .is("user_id", null)
          
          const excludePromptIds = (usedPromptsForPersonalization || []).map((p: any) => p.prompt_id)
          
          // Call personalized suggestion function
          // Limit to 5 suggestions, exclude already asked prompts
          const { data: personalizedSuggestions, error: suggestionError } = await supabaseClient
            .rpc("suggest_questions_for_group", {
              p_group_id: group.id,
              p_limit: 5,
              p_exclude_prompt_ids: excludePromptIds.length > 0 ? excludePromptIds : null
            })
          
          if (!suggestionError && personalizedSuggestions && personalizedSuggestions.length > 0) {
            // Use the top suggestion (highest fit score)
            const topSuggestion = personalizedSuggestions[0]
            
            // Get full prompt details
            const { data: promptDetails } = await supabaseClient
              .from("prompts")
              .select("*")
              .eq("id", topSuggestion.prompt_id)
              .single()
            
            if (promptDetails) {
              // Verify it matches group type and is eligible
              const groupCategory = groupData?.type === "family" ? "Family" : "Friends"
              if (promptDetails.category === groupCategory && 
                  !disabledCategories.has(promptDetails.category) &&
                  promptDetails.category !== "Remembering" &&
                  promptDetails.category !== "Birthday" &&
                  promptDetails.category !== "Featured") {
                selectedPrompt = promptDetails
                selectionMethod = "personalized"
                console.log(`[schedule-daily-prompts] Using personalized suggestion (fit_score: ${topSuggestion.fit_score?.toFixed(2)}) for group ${group.id}`)
              }
            }
          }
        } catch (error) {
          // Log error but continue to fallback logic
          console.error(`[schedule-daily-prompts] Error getting personalized suggestions for group ${group.id}:`, error)
        }
      }
      
      // If no personalized prompt selected, use weighted selection from categories (existing fallback)
      if (!selectedPrompt) {
        // Get all prompts used for this group (general prompts only)
        const { data: usedPrompts } = await supabaseClient
          .from("daily_prompts")
          .select("prompt_id")
          .eq("group_id", group.id)
          .is("user_id", null)

        const usedPromptIds = usedPrompts?.map((p) => p.prompt_id) || []

        // Get all prompts, excluding used ones and birthday prompts
        let availablePrompts: any[] = []

        // Get prompts from eligible categories only
        // Note: No fallback to Fun/A Bit Deeper - these categories are removed
        const { data: allPromptsData } = await supabaseClient
          .from("prompts")
          .select("*")
          .in("category", eligibleCategories.length > 0 ? eligibleCategories : []) // No fallback
          .is("birthday_type", null) // Exclude birthday prompts
          .is("deck_id", null) // Exclude deck prompts (handled separately)

        // Get matched questions for this group's category (Friends or Family)
        const groupCategory = groupData?.type === "family" ? "Family" : "Friends"
        const { data: matches } = await supabaseClient
          .from("group_question_matches")
          .select("prompt_id, prompt:prompts(id, ice_breaker)")
          .eq("group_id", group.id)
          .eq("asked", false)
        
        const matchedPromptIds = new Set<string>()
        const matchedIceBreakerIds = new Set<string>()
        
        if (matches) {
          for (const match of matches) {
            const prompt = match.prompt as any
            if (prompt?.id && prompt?.category === groupCategory) {
              matchedPromptIds.add(prompt.id)
              if (prompt.ice_breaker) {
                matchedIceBreakerIds.add(prompt.id)
              }
            }
          }
        }

        // Filter out used prompts and prompts with {member_name} unless group has 3+ members
        const memberCount = members?.length || 0
        const allFilteredPrompts = (allPromptsData || []).filter((p) => {
          // Exclude used prompts
          if (usedPromptIds.includes(p.id)) return false
          
          // Exclude prompts with {member_name} dynamic variables unless group has 3+ members
          if (p.dynamic_variables && Array.isArray(p.dynamic_variables) && p.dynamic_variables.includes("member_name")) {
            // Only allow {member_name} questions if group has at least 3 members
            // (need at least 2 other members besides the current user)
            if (memberCount < 3) return false
          }
          
          return true
        })

        // Separate matched and non-matched prompts, prioritizing ice_breaker matched
        const matchedIceBreakerPrompts = allFilteredPrompts.filter((p) => matchedIceBreakerIds.has(p.id))
        const matchedRegularPrompts = allFilteredPrompts.filter((p) => matchedPromptIds.has(p.id) && !matchedIceBreakerIds.has(p.id))
        const nonMatchedPrompts = allFilteredPrompts.filter((p) => !matchedPromptIds.has(p.id))
        
        // Prioritize: matched ice_breaker > matched regular > non-matched
        availablePrompts = [...matchedIceBreakerPrompts, ...matchedRegularPrompts, ...nonMatchedPrompts]

        if (!availablePrompts || availablePrompts.length === 0) {
          // If all prompts have been used, reset and use all eligible prompts again
          const memberCount = members?.length || 0
          const { data: allPromptsRaw } = await supabaseClient
            .from("prompts")
            .select("*")
            .in("category", eligibleCategories.length > 0 ? eligibleCategories : []) // No fallback
            .is("birthday_type", null)
            .is("deck_id", null) // Exclude deck prompts (handled separately)

          // Filter out prompts with {member_name} unless group has 3+ members
          const filteredPromptsRaw = (allPromptsRaw || []).filter((p: any) => {
            if (p.dynamic_variables && Array.isArray(p.dynamic_variables) && p.dynamic_variables.includes("member_name")) {
              return memberCount >= 3
            }
            return true
          })

          // Get matched questions for this group's category (Friends or Family) - reset case
          const groupCategoryReset = groupData?.type === "family" ? "Family" : "Friends"
          const { data: matchesReset } = await supabaseClient
            .from("group_question_matches")
            .select("prompt_id, prompt:prompts(id, ice_breaker, category)")
            .eq("group_id", group.id)
            .eq("asked", false)
          
          const matchedPromptIdsReset = new Set<string>()
          const matchedIceBreakerIdsReset = new Set<string>()
          
          if (matchesReset) {
            for (const match of matchesReset) {
              const prompt = match.prompt as any
              if (prompt?.id && prompt?.category === groupCategoryReset) {
                matchedPromptIdsReset.add(prompt.id)
                if (prompt.ice_breaker) {
                  matchedIceBreakerIdsReset.add(prompt.id)
                }
              }
            }
          }

          // Separate matched and non-matched prompts, prioritizing ice_breaker matched
          const matchedIceBreakerPromptsReset = filteredPromptsRaw.filter((p: any) => matchedIceBreakerIdsReset.has(p.id))
          const matchedRegularPromptsReset = filteredPromptsRaw.filter((p: any) => matchedPromptIdsReset.has(p.id) && !matchedIceBreakerIdsReset.has(p.id))
          const nonMatchedPromptsReset = filteredPromptsRaw.filter((p: any) => !matchedPromptIdsReset.has(p.id))
          
          // Prioritize: matched ice_breaker > matched regular > non-matched
          const prioritizedPromptsReset = [...matchedIceBreakerPromptsReset, ...matchedRegularPromptsReset, ...nonMatchedPromptsReset]

          if (!prioritizedPromptsReset || prioritizedPromptsReset.length === 0) {
            results.push({ group_id: group.id, status: "no_prompts_available" })
            continue
          }

          const allPrompts = prioritizedPromptsReset

          if (allPrompts.length === 0) {
            results.push({ group_id: group.id, status: "no_prompts_available" })
            continue
          }

          // Apply weighted selection based on preferences
          const weightedPrompts: Array<{ prompt: any; weight: number }> = allPrompts.map((prompt) => {
            const pref = (preferences || []).find((p) => p.category === prompt.category)
            const weight = pref?.weight ?? 1.0
            return { prompt, weight }
          })

          // Create selection pool with weighted prompts
          const selectionPool: any[] = []
          weightedPrompts.forEach(({ prompt, weight }) => {
            const count = Math.ceil(weight)
            for (let i = 0; i < count; i++) {
              selectionPool.push(prompt)
            }
          })

          // Select prompt based on day index (group-specific)
          const dayIndex = getDayIndex(today, group.id)
          selectedPrompt = selectionPool[dayIndex % selectionPool.length]
        } else {
          // availablePrompts already filtered by eligible categories
          const filteredPrompts = availablePrompts

          if (filteredPrompts.length === 0) {
            results.push({ group_id: group.id, status: "no_prompts_available" })
            continue
          }

          // Apply weighted selection based on preferences
          const weightedPrompts: Array<{ prompt: any; weight: number }> = filteredPrompts.map((prompt) => {
            const pref = (preferences || []).find((p) => p.category === prompt.category)
            const weight = pref?.weight ?? 1.0
            return { prompt, weight: Math.max(0, weight) } // Ensure non-negative
          })

          // Create selection pool with weighted prompts
          const selectionPool: any[] = []
          weightedPrompts.forEach(({ prompt, weight }) => {
            const count = Math.max(1, Math.ceil(weight * 10)) // Scale weight similar to initialize function
            for (let i = 0; i < count; i++) {
              selectionPool.push(prompt)
            }
          })

          // Select prompt based on day index (group-specific)
          const dayIndex = getDayIndex(today, group.id)
          selectedPrompt = selectionPool[dayIndex % selectionPool.length]
        }
      }

      if (!selectedPrompt) {
        results.push({ group_id: group.id, status: "no_prompts_available" })
        continue
      }

      const promptId = selectedPrompt.id

      // Personalize prompt with dynamic variables before saving (if needed)
      // Note: Full personalization happens in getDailyPrompt, but we can do basic variable replacement here
      // For now, we'll save the prompt_id and let getDailyPrompt handle personalization

      // Create daily_prompt for today (general prompt, user_id is NULL)
      const { error: insertError } = await supabaseClient.from("daily_prompts").insert({
        group_id: group.id,
        prompt_id: promptId,
        date: today,
        user_id: null, // General prompt for all members
        deck_id: selectedDeckId || null, // Track which deck this prompt belongs to
      })

      if (insertError) throw insertError

      // Mark matched question as asked if it was a match
      await supabaseClient
        .from("group_question_matches")
        .update({ asked: true })
        .eq("group_id", group.id)
        .eq("prompt_id", promptId)

      // Remove from queue if it was queued
      if (queuedItem) {
        await supabaseClient.from("group_prompt_queue").delete().eq("group_id", group.id).eq("prompt_id", promptId)
      }

      // Update selection method if it was custom or birthday (set earlier in flow)
      if (customQuestion) {
        selectionMethod = "custom"
      } else if (birthdayMembers.length > 0) {
        selectionMethod = "birthday"
      }
      // Note: deck, queued, and personalized are already set above
      // random is the default if none of the above

      results.push({ 
        group_id: group.id, 
        status: "scheduled", 
        prompt_id: promptId,
        selection_method: selectionMethod
      })
    }

    return new Response(JSON.stringify({ success: true, results }), {
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
