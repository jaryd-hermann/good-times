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

    // Get all groups
    const { data: groups, error: groupsError } = await supabaseClient
      .from("groups")
      .select("id, name")

    if (groupsError) throw groupsError

    const today = new Date().toISOString().split("T")[0]
    const todayMonthDay = today.substring(5) // MM-DD format for birthday comparison
    const results = []

    for (const group of groups || []) {
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
        continue
      }

      // No birthdays today - proceed with regular prompt logic
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
      const eligibleCategories: string[] = []
      
      // Always eligible categories
      if (!disabledCategories.has("Fun")) {
        eligibleCategories.push("Fun")
      }
      if (!disabledCategories.has("A Bit Deeper")) {
        eligibleCategories.push("A Bit Deeper")
      }
      
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
      if (hasMemorials && !disabledCategories.has("Remembering")) {
        eligibleCategories.push("Remembering")
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

      if (queuedItem && queuedItem.prompt) {
        const queuedPrompt = queuedItem.prompt as any
        const memberCount = members?.length || 0
        
        // Filter out "Remembering" category if no memorials
        if (queuedPrompt.category === "Remembering" && !hasMemorials) {
          // Skip this queued prompt, continue to selection logic
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
          }
        } else {
          selectedPrompt = queuedPrompt
        }
      }

      // If no queued prompt, use weighted selection
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
        const { data: allPromptsData } = await supabaseClient
          .from("prompts")
          .select("*")
          .in("category", eligibleCategories.length > 0 ? eligibleCategories : ["Fun", "A Bit Deeper"]) // Fallback if no eligible
          .is("birthday_type", null) // Exclude birthday prompts

        // Filter out used prompts and prompts with {member_name} unless group has 3+ members
        const memberCount = members?.length || 0
        availablePrompts = (allPromptsData || []).filter((p) => {
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

        if (!availablePrompts || availablePrompts.length === 0) {
          // If all prompts have been used, reset and use all eligible prompts again
          const memberCount = members?.length || 0
          const { data: allPromptsRaw } = await supabaseClient
            .from("prompts")
            .select("*")
            .in("category", eligibleCategories.length > 0 ? eligibleCategories : ["Fun", "A Bit Deeper"])
            .is("birthday_type", null)
          
          // Filter out prompts with {member_name} unless group has 3+ members
          const filteredPromptsRaw = (allPromptsRaw || []).filter((p: any) => {
            if (p.dynamic_variables && Array.isArray(p.dynamic_variables) && p.dynamic_variables.includes("member_name")) {
              return memberCount >= 3
            }
            return true
          })

          if (!filteredPromptsRaw || filteredPromptsRaw.length === 0) {
            results.push({ group_id: group.id, status: "no_prompts_available" })
            continue
          }

          const allPrompts = filteredPromptsRaw

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
      })

      if (insertError) throw insertError

      // Remove from queue if it was queued
      if (queuedItem) {
        await supabaseClient.from("group_prompt_queue").delete().eq("group_id", group.id).eq("prompt_id", promptId)
      }

      results.push({ group_id: group.id, status: "scheduled", prompt_id: promptId })
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
