import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Helper function to check if a date string (YYYY-MM-DD) is a Sunday
function isSunday(dateString: string): boolean {
  const date = new Date(dateString + "T00:00:00") // Parse as local date
  return date.getDay() === 0 // 0 = Sunday
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
      // PRIORITY 2: SUNDAY JOURNAL QUESTION
      // ========================================================================
      // On Sundays, schedule the Journal prompt (weekly photo journal)
      // This takes priority over regular scheduling but not birthdays
      // CRITICAL: Only schedule for today (future Sundays will be handled when they become today)
      // This prevents overwriting past Sunday prompts
      if (isSunday(today)) {
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
        const { data: standardPromptsSinceRemembering } = await supabaseClient
          .from("daily_prompts")
          .select("prompt_id, prompt:prompts(category), is_discovery")
          .eq("group_id", group.id)
          .is("user_id", null)
          .gt("date", lastRememberingDate) // All prompts AFTER last Remembering
          .order("date", { ascending: true })

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
        const { data: allStandardPrompts } = await supabaseClient
          .from("daily_prompts")
          .select("prompt_id, prompt:prompts(category), is_discovery")
          .eq("group_id", group.id)
          .is("user_id", null)
          .order("date", { ascending: true })

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
      const { data: allStandardForDiscovery } = await supabaseClient
        .from("daily_prompts")
        .select("prompt_id, prompt:prompts(category), is_discovery")
        .eq("group_id", group.id)
        .is("user_id", null)
        .order("date", { ascending: true })

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
          const { data: rememberingPrompts } = await supabaseClient
            .from("prompts")
            .select("*")
            .eq("category", "Remembering")
            .not("id", "in", Array.from(askedPromptIds))

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
          // ========================================================================
          // DISCOVERY LOGIC: Every 10th Standard question (excluding discovery)
          // ========================================================================
          let isDiscoveryQuestion = false
          
          // Check if this should be a discovery question (every 10th Standard)
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
              
              // Get questions from this discovery interest
              const { data: discoveryPrompts } = await supabaseClient
                .from("prompts")
                .select("*")
                .eq("category", "Standard")
                .contains("interests", [discoveryInterest])
                .not("id", "in", Array.from(askedPromptIds))
                .not("id", "in", Array.from(askedCustomQuestionIds))
              
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
                  const { data: discoveryPrompts } = await supabaseClient
                    .from("prompts")
                    .select("*")
                    .eq("category", "Standard")
                    .contains("interests", [related.interest_name])
                    .not("id", "in", Array.from(askedPromptIds))
                    .not("id", "in", Array.from(askedCustomQuestionIds))
                  
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
            
            // If we found a discovery interest, select a question from it
            if (isDiscoveryQuestion && discoveryInterest) {
              const { data: discoveryPrompts } = await supabaseClient
                .from("prompts")
                .select("*")
                .eq("category", "Standard")
                .contains("interests", [discoveryInterest])
                .not("id", "in", Array.from(askedPromptIds))
                .not("id", "in", Array.from(askedCustomQuestionIds))
              
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
          }

          // ========================================================================
          // STANDARD INTEREST CYCLE LOGIC (if not discovery)
          // ========================================================================
          if (!selectedPrompt) {
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
            const { data: groupData } = await supabaseClient
              .from("groups")
              .select("interest_cycle_position, interest_cycle_interests, inferred_interests")
              .eq("id", group.id)
              .single()

            const inferredInterests = groupData?.inferred_interests || []
            
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

      // CRITICAL FIX: Final fallback - ensure a prompt is ALWAYS scheduled
      // Always use Standard questions for fallback - never repeat questions
      // This prevents blank prompt cards from appearing
      if (!selectedPrompt) {
        console.warn(`[schedule-daily-prompts] Group ${group.id}: No prompt available after all logic, using Standard fallback`)
        
        // CRITICAL: Always use Standard questions for fallback - never repeat
        // Get ANY Standard prompt from the database that hasn't been asked recently
        // First, try to find one that hasn't been asked in the last 30 days
        const thirtyDaysAgo = new Date(today)
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0]
        
        const { data: recentAskedPrompts } = await supabaseClient
          .from("daily_prompts")
          .select("prompt_id")
          .eq("group_id", group.id)
          .is("user_id", null)
          .gte("date", thirtyDaysAgoStr)
        
        const recentAskedPromptIds = new Set((recentAskedPrompts || []).map((dp: any) => dp.prompt_id))
        
        // Try to find a Standard prompt not asked in last 30 days
        const { data: unusedStandardPrompt } = await supabaseClient
          .from("prompts")
          .select("*")
          .eq("category", "Standard")
          .not("id", "in", Array.from(recentAskedPromptIds))
          .limit(1)
          .maybeSingle()
        
        if (unusedStandardPrompt) {
          selectedPrompt = unusedStandardPrompt
          selectionMethod = "fallback_standard_unused"
          console.log(`[schedule-daily-prompts] Group ${group.id}: Using unused Standard prompt as fallback: ${selectedPrompt.id}`)
        } else {
          // If all Standard prompts were asked recently, use any Standard prompt (better than no prompt)
          const { data: anyStandardPrompt } = await supabaseClient
            .from("prompts")
            .select("*")
            .eq("category", "Standard")
            .limit(1)
            .maybeSingle()
          
          if (anyStandardPrompt) {
            selectedPrompt = anyStandardPrompt
            selectionMethod = "fallback_standard_any"
            console.log(`[schedule-daily-prompts] Group ${group.id}: Using any Standard prompt as fallback: ${selectedPrompt.id}`)
          } else {
            // This should never happen, but log error and skip
            console.error(`[schedule-daily-prompts] Group ${group.id}: CRITICAL - No Standard prompts exist in database!`)
            results.push({ group_id: group.id, status: "error_no_standard_prompts_in_database" })
        continue
          }
        }
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
