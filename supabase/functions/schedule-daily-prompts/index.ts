import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const today = new Date().toISOString().split("T")[0]
    const todayMonthDay = today.substring(5) // MM-DD format for birthday comparison
    const results = []

    // Get all groups
    const { data: groups, error: groupsError } = await supabaseClient
      .from("groups")
      .select("id, name")

    if (groupsError) throw groupsError

    for (const group of groups || []) {
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
      // PRIORITY 2: CUSTOM QUESTIONS
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
        // CRITICAL: Check if this prompt_id was EVER asked before (never repeat custom questions)
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
          // Safe to schedule - this custom question has never been asked
          await supabaseClient.from("daily_prompts").insert({
            group_id: group.id,
            prompt_id: customQuestion.prompt_id,
            date: today,
          })

          // Mark as asked by clearing date_asked (prevents re-scheduling)
          await supabaseClient
            .from("custom_questions")
            .update({ date_asked: null })
            .eq("id", customQuestion.id)

          results.push({ group_id: group.id, status: "custom_question_scheduled" })
          continue // Skip regular prompt scheduling
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
      const { data: allAskedPrompts } = await supabaseClient
        .from("daily_prompts")
        .select("prompt_id, prompt:prompts(category, deck_id)")
        .eq("group_id", group.id)
        .is("user_id", null) // Only general prompts
      
      const askedPromptIds = new Set<string>()
      const askedCustomQuestionIds = new Set<string>()
      
      if (allAskedPrompts) {
        for (const dp of allAskedPrompts) {
          askedPromptIds.add(dp.prompt_id)
          const prompt = dp.prompt as any
          // Track custom question IDs separately (never repeat)
          if (prompt?.category === "Custom") {
            askedCustomQuestionIds.add(dp.prompt_id)
          }
        }
      }

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
      // TEMPORARILY HIDDEN: Deck counting logic removed
      // Get recent prompts with dates to count properly (ordered chronologically)
      const { data: recentPromptsWithDates } = await supabaseClient
        .from("daily_prompts")
        .select("date, prompt_id, prompt:prompts(category, deck_id)")
        .eq("group_id", group.id)
        .is("user_id", null)
        .order("date", { ascending: false })
        .limit(30) // Look back at recent prompts

      // TEMPORARILY HIDDEN: standardCountSinceDeck removed (no longer using Deck questions)
      // let standardCountSinceDeck = 0
      let standardCountSinceRemembering = 0
      let lastRememberingDate: string | null = null

      if (recentPromptsWithDates) {
        // TEMPORARILY HIDDEN: Deck counting logic removed
        // // Count Standard questions since last Deck question
        // for (const dp of recentPromptsWithDates) {
        //   const prompt = dp.prompt as any
        //   // Check if it's a Deck question (category is "Deck" OR has deck_id)
        //   if (prompt?.category === "Deck" || (prompt?.deck_id && prompt.deck_id !== null)) {
        //     break // Found last Deck question, stop counting
        //   } else if (prompt?.category === "Standard") {
        //     standardCountSinceDeck++
        //   }
        // }

        // Count Standard questions since last Remembering question
        // CRITICAL FIX: Track the date of the last Remembering question to prevent back-to-back
        for (const dp of recentPromptsWithDates) {
          const prompt = dp.prompt as any
          if (prompt?.category === "Remembering") {
            lastRememberingDate = dp.date // Store the date of the last Remembering question
            break // Found last Remembering question, stop counting
          } else if (prompt?.category === "Standard") {
            standardCountSinceRemembering++
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

      // PRIORITY 7: REMEMBERING QUESTION (every 10 Standard questions, minimum 10 days apart)
      // CRITICAL FIX: Ensure at least 10 Standard questions have been asked since the last Remembering
      // AND ensure we haven't scheduled a Remembering question in the last 10 days
      if (!selectedPrompt && hasMemorials && standardCountSinceRemembering >= 10) {
        // Additional safety check: Ensure the last Remembering question was at least 10 days ago
        // This prevents back-to-back Remembering prompts even if counting logic has edge cases
        let canScheduleRemembering = true
        if (lastRememberingDate) {
          const lastRememberingDateObj = new Date(lastRememberingDate)
          const todayDateObj = new Date(today)
          const daysSinceLastRemembering = Math.floor((todayDateObj.getTime() - lastRememberingDateObj.getTime()) / (1000 * 60 * 60 * 24))
          
          // Require at least 10 days between Remembering questions (minimum, never more)
          if (daysSinceLastRemembering < 10) {
            canScheduleRemembering = false
          }
        }
        
        if (canScheduleRemembering) {
          // Get available Remembering prompts
          const { data: rememberingPrompts } = await supabaseClient
            .from("prompts")
            .select("*")
            .eq("category", "Remembering")
            .not("id", "in", Array.from(askedPromptIds))

          if (rememberingPrompts && rememberingPrompts.length > 0) {
            // Select one (we'll rotate memorial names in getDailyPrompt)
            selectedPrompt = rememberingPrompts[0]
            selectionMethod = "remembering"
          }
        }
      }

      // PRIORITY 5: STANDARD QUESTION (with interest-based personalization)
      if (!selectedPrompt) {
        // Check if all ice breakers have been asked (including null order ones)
        const { data: allIceBreakers } = await supabaseClient
          .from("prompts")
          .select("id")
          .eq("ice_breaker", true)
        
        const allIceBreakerIds = new Set((allIceBreakers || []).map((p: any) => p.id))
        
        // Get all asked prompts that are ice breakers
        const { data: allAskedPromptsForIceBreakerCheck } = await supabaseClient
          .from("daily_prompts")
          .select("prompt_id, prompt:prompts(ice_breaker)")
          .eq("group_id", group.id)
          .is("user_id", null)
        
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
          // Get group interests with weights (user counts)
          // First get all group interests
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

          // Get group's current cycle state
          const { data: groupData } = await supabaseClient
            .from("groups")
            .select("interest_cycle_position, interest_cycle_interests")
            .eq("id", group.id)
            .single()

          let cyclePosition = groupData?.interest_cycle_position || 0
          let cycleInterests = groupData?.interest_cycle_interests || []

          // If no cycle interests set or interests have changed, rebuild cycle
          if (cycleInterests.length === 0 || interestWeights.size !== cycleInterests.length) {
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
          let targetInterest: string | null = null
          
          if (cycleInterests.length === 0) {
            // No interests - use null (fallback to random Standard)
            targetInterest = null
          } else if (cycleInterests.length === 1) {
            // Single interest - alternate with null
            targetInterest = cyclePosition % 2 === 0 ? cycleInterests[0] : null
          } else {
            // Multiple interests - cycle through them, then null break
            if (cyclePosition < cycleInterests.length) {
              targetInterest = cycleInterests[cyclePosition]
            } else if (cyclePosition === cycleInterests.length) {
              // Null break after all interests
              targetInterest = null
            } else {
              // Reset cycle
              targetInterest = cycleInterests[0]
              cyclePosition = 0
            }
          }

          // Get Standard questions matching the target interest
          let standardPrompts: any[] = []
          
          if (targetInterest === null) {
            // Get Standard questions with null/empty interests
            const { data: nullInterestPrompts } = await supabaseClient
              .from("prompts")
              .select("*")
              .eq("category", "Standard")
              .or("interests.is.null,interests.eq.{}")
              .not("id", "in", Array.from(askedPromptIds))
              .not("id", "in", Array.from(askedCustomQuestionIds))
            
            standardPrompts = nullInterestPrompts || []
          } else {
            // Get Standard questions where interests array contains targetInterest
            const { data: interestPrompts } = await supabaseClient
              .from("prompts")
              .select("*")
              .eq("category", "Standard")
              .contains("interests", [targetInterest])
              .not("id", "in", Array.from(askedPromptIds))
              .not("id", "in", Array.from(askedCustomQuestionIds))
            
            standardPrompts = interestPrompts || []
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
            
            // If cycle is now empty, fallback to null-interest questions
            if (cycleInterests.length === 0) {
              const { data: nullInterestPrompts } = await supabaseClient
                .from("prompts")
                .select("*")
                .eq("category", "Standard")
                .or("interests.is.null,interests.eq.{}")
                .not("id", "in", Array.from(askedPromptIds))
                .not("id", "in", Array.from(askedCustomQuestionIds))
              
              standardPrompts = nullInterestPrompts || []
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
              
              // Try to get questions for the new target interest
              if (targetInterest === null) {
                const { data: nullInterestPrompts } = await supabaseClient
                  .from("prompts")
                  .select("*")
                  .eq("category", "Standard")
                  .or("interests.is.null,interests.eq.{}")
                  .not("id", "in", Array.from(askedPromptIds))
                  .not("id", "in", Array.from(askedCustomQuestionIds))
                
                standardPrompts = nullInterestPrompts || []
              } else {
                const { data: nextInterestPrompts } = await supabaseClient
                  .from("prompts")
                  .select("*")
                  .eq("category", "Standard")
                  .contains("interests", [targetInterest])
                  .not("id", "in", Array.from(askedPromptIds))
                  .not("id", "in", Array.from(askedCustomQuestionIds))
                
                standardPrompts = nextInterestPrompts || []
              }
            }
          }

          // Select random question from available prompts
          if (standardPrompts.length > 0) {
            const randomIndex = Math.floor(Math.random() * standardPrompts.length)
            selectedPrompt = standardPrompts[randomIndex]
            selectionMethod = targetInterest ? `standard_interest_${targetInterest}` : "standard_null_break"
            
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
            
            await supabaseClient
              .from("groups")
              .update({
                interest_cycle_position: nextPosition,
              })
              .eq("id", group.id)
          }
        }

        // Fallback: If no interest-based selection worked, use random Standard (original behavior)
        if (!selectedPrompt) {
          const { data: standardPrompts } = await supabaseClient
            .from("prompts")
            .select("*")
            .eq("category", "Standard")
            .not("id", "in", Array.from(askedPromptIds))
            .not("id", "in", Array.from(askedCustomQuestionIds))

          if (standardPrompts && standardPrompts.length > 0) {
            const randomIndex = Math.floor(Math.random() * standardPrompts.length)
            selectedPrompt = standardPrompts[randomIndex]
            selectionMethod = "standard"
          }
        }
      }

      // If we still don't have a prompt, try resetting (all prompts have been used)
      if (!selectedPrompt) {
        // Reset: use all Standard prompts again
        const { data: allStandardPrompts } = await supabaseClient
          .from("prompts")
          .select("*")
          .eq("category", "Standard")
          .not("id", "in", Array.from(askedCustomQuestionIds)) // Still exclude custom questions

        if (allStandardPrompts && allStandardPrompts.length > 0) {
          const randomIndex = Math.floor(Math.random() * allStandardPrompts.length)
          selectedPrompt = allStandardPrompts[randomIndex]
          selectionMethod = "standard_reset"
        }
      }

      if (!selectedPrompt) {
        results.push({ group_id: group.id, status: "no_prompts_available" })
        continue
      }

      // Schedule the selected prompt
      await supabaseClient.from("daily_prompts").insert({
        group_id: group.id,
        prompt_id: selectedPrompt.id,
        date: today,
      })

      results.push({
        group_id: group.id,
        status: "scheduled",
        prompt_id: selectedPrompt.id,
        selection_method: selectionMethod,
        deck_id: selectedDeckId,
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
