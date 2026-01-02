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

// Calculate 8 AM local time for a user's timezone, converted to UTC
function get8AMLocalTimeUTC(userTimezone: string, date: Date = new Date()): Date {
  // Get current time in user's timezone
  const userTimeString = date.toLocaleString("en-US", { timeZone: userTimezone })
  const userTime = new Date(userTimeString)
  
  // Get current UTC time
  const utcTimeString = date.toLocaleString("en-US", { timeZone: "UTC" })
  const utcTime = new Date(utcTimeString)
  
  // Calculate offset between user timezone and UTC
  const offset = userTime.getTime() - utcTime.getTime()
  
  // Set to 8 AM in user's local time
  const local8AM = new Date(userTime)
  local8AM.setHours(8, 0, 0, 0)
  
  // Convert back to UTC by subtracting the offset
  const utc8AM = new Date(local8AM.getTime() - offset)
  
  return utc8AM
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

    // Get all daily prompts for today (both general and user-specific)
    const { data: dailyPrompts, error: promptsError } = await supabaseClient
      .from("daily_prompts")
      .select(`
        id,
        group_id,
        prompt_id,
        user_id,
        groups (
          id,
          name
        ),
        prompts (
          question,
          dynamic_variables,
          birthday_type
        )
      `)
      .eq("date", today)

    if (promptsError) throw promptsError

    const notifications = []

    for (const dailyPrompt of dailyPrompts || []) {
      const group = dailyPrompt.groups as any
      const prompt = dailyPrompt.prompts as any

      if (!group || !prompt) continue

      // Get members for this group
      const { data: members, error: membersError } = await supabaseClient
        .from("group_members")
        .select("user_id, user:users(id, name, birthday)")
        .eq("group_id", dailyPrompt.group_id)

      if (membersError) {
        console.error(`[send-daily-notifications] Error fetching members for group ${dailyPrompt.group_id}:`, membersError)
        continue
      }

      // Get memorials for this group (needed for {memorial_name} replacement)
      const { data: memorials, error: memorialsError } = await supabaseClient
        .from("memorials")
        .select("id, name")
        .eq("group_id", dailyPrompt.group_id)
        .order("created_at", { ascending: true })

      if (memorialsError) {
        console.error(`[send-daily-notifications] Error fetching memorials for group ${dailyPrompt.group_id}:`, memorialsError)
        // Continue anyway - memorials are optional
      }
      
      const groupMemorials = memorials || []

      // Determine which users should receive this prompt
      let targetUsers: Array<{ user_id: string }> = []
      
      if (dailyPrompt.user_id) {
        // User-specific prompt (e.g., birthday prompt)
        targetUsers = [{ user_id: dailyPrompt.user_id }]
      } else {
        // General prompt - send to all members
        targetUsers = (members || []).map((m: any) => ({ user_id: m.user_id }))
      }

      for (const targetUser of targetUsers) {
        // Get user info including timezone
        const { data: userData, error: userError } = await supabaseClient
          .from("users")
          .select("id, name, email, timezone")
          .eq("id", targetUser.user_id)
          .single()

        if (userError || !userData) {
          console.log(`[send-daily-notifications] User not found: ${targetUser.user_id}`)
          continue
        }

        // Get user's timezone (default to America/New_York if not set)
        const userTimezone = userData.timezone || "America/New_York"
        
        // Check if user has push token
        const { data: pushTokens, error: tokenError } = await supabaseClient
          .from("push_tokens")
          .select("token")
          .eq("user_id", targetUser.user_id)
          .limit(1)

        if (tokenError || !pushTokens || pushTokens.length === 0) {
          console.log(`[send-daily-notifications] No push token found for user ${targetUser.user_id}`)
          continue
        }

        // Personalize prompt text with dynamic variables
        // CRITICAL: Use prompt_name_usage table to get the EXACT same name that was selected
        // when getDailyPrompt ran. This ensures the notification matches what users see in the app.
        let personalizedQuestion = prompt.question
        const variables: Record<string, string> = {}
        
        // Check if prompt has dynamic variables that need replacement
        const hasMemorialName = personalizedQuestion.match(/\{.*memorial_name.*\}/i)
        const hasMemberName = personalizedQuestion.match(/\{.*member_name.*\}/i)
        
        // Handle memorial_name variable - MUST use prompt_name_usage for consistency
        // If not found, use week-based rotation (same as getDailyPrompt)
        if (hasMemorialName) {
          // CRITICAL: First check prompt_name_usage to get the exact name that was already selected
          const { data: memorialUsage } = await supabaseClient
            .from("prompt_name_usage")
            .select("name_used")
            .eq("group_id", dailyPrompt.group_id)
            .eq("prompt_id", dailyPrompt.prompt_id)
            .eq("variable_type", "memorial_name")
            .eq("date_used", today)
            .maybeSingle()
          
          if (memorialUsage?.name_used) {
            // Use the exact name from prompt_name_usage (ensures consistency with app)
            variables.memorial_name = memorialUsage.name_used
            console.log(`[send-daily-notifications] Using memorial name from prompt_name_usage: ${memorialUsage.name_used}`)
          } else if (groupMemorials.length > 0) {
            // Fallback: Use week-based rotation (same logic as getDailyPrompt)
            // Calculate week start (Monday of current week)
            const todayDate = new Date(today)
            const dayOfWeek = todayDate.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
            const weekStart = new Date(todayDate)
            
            if (dayOfWeek === 0) {
              weekStart.setDate(todayDate.getDate() - 6)
            } else {
              weekStart.setDate(todayDate.getDate() - (dayOfWeek - 1))
            }
            
            const weekStartStr = weekStart.toISOString().split("T")[0]
            
            // Check if a memorial was already used THIS WEEK
            const { data: thisWeekUsage } = await supabaseClient
              .from("prompt_name_usage")
              .select("name_used")
              .eq("group_id", dailyPrompt.group_id)
              .eq("prompt_id", dailyPrompt.prompt_id)
              .eq("variable_type", "memorial_name")
              .gte("date_used", weekStartStr)
              .lte("date_used", today)
              .order("date_used", { ascending: false })
              .limit(1)
            
            if (thisWeekUsage && thisWeekUsage.length > 0) {
              // Memorial already used this week - use same one
              variables.memorial_name = thisWeekUsage[0].name_used
              console.log(`[send-daily-notifications] Using memorial from this week: ${thisWeekUsage[0].name_used}`)
            } else {
              // No memorial used this week - rotate to next person
              // Find which memorial was used last week (if any)
              const { data: lastWeekUsage } = await supabaseClient
                .from("prompt_name_usage")
                .select("name_used")
                .eq("group_id", dailyPrompt.group_id)
                .eq("prompt_id", dailyPrompt.prompt_id)
                .eq("variable_type", "memorial_name")
                .lt("date_used", weekStartStr) // Before this week
                .order("date_used", { ascending: false })
                .limit(1)
              
              const lastUsedName = lastWeekUsage && lastWeekUsage.length > 0 ? lastWeekUsage[0].name_used : null
              
              // Find index of last used memorial
              const lastUsedIndex = lastUsedName 
                ? groupMemorials.findIndex((m: any) => m.name === lastUsedName)
                : -1
              
              // Select next memorial in rotation (cycle through)
              const nextIndex = lastUsedIndex >= 0 
                ? (lastUsedIndex + 1) % groupMemorials.length  // Next in rotation
                : 0  // Start with first if none used before
              
              const selectedMemorial = groupMemorials[nextIndex]
              if (selectedMemorial?.name) {
                variables.memorial_name = selectedMemorial.name
                console.log(`[send-daily-notifications] Rotating memorial: ${lastUsedName || 'none'} -> ${selectedMemorial.name}`)
              }
            }
          }
        }
        
        // Handle member_name variable - MUST use prompt_name_usage for consistency
        if (hasMemberName) {
          // CRITICAL: First check prompt_name_usage to get the exact name that was already selected
          const { data: memberUsage } = await supabaseClient
            .from("prompt_name_usage")
            .select("name_used")
            .eq("group_id", dailyPrompt.group_id)
            .eq("prompt_id", dailyPrompt.prompt_id)
            .eq("variable_type", "member_name")
            .eq("date_used", today)
            .maybeSingle()
          
          if (memberUsage?.name_used) {
            // Use the exact name from prompt_name_usage (ensures consistency with app)
            variables.member_name = memberUsage.name_used
            console.log(`[send-daily-notifications] Using member name from prompt_name_usage: ${memberUsage.name_used}`)
          } else if (prompt.birthday_type === "their_birthday" && members) {
            // Fallback for birthday prompts: get ALL birthday people's names and combine them
            const todayMonthDay = today.substring(5) // MM-DD
            const birthdayNames: string[] = []
            
            for (const member of members) {
              const user = member.user as any
              if (user?.birthday && user.birthday.substring(5) === todayMonthDay && user.name) {
                birthdayNames.push(user.name)
              }
            }
            
            // Combine names: "Name1 and Name2" or just "Name1" if only one
            if (birthdayNames.length > 0) {
              if (birthdayNames.length === 1) {
                variables.member_name = birthdayNames[0]
              } else {
                // Combine with "and": "Jaryd and Brett"
                variables.member_name = birthdayNames.join(" and ")
              }
              console.warn(`[send-daily-notifications] No prompt_name_usage found, calculated member name(s) for birthday: ${variables.member_name}`)
            } else {
              variables.member_name = "them"
            }
          }
        }
        
        // Replace variables in question text (support both {variable} and {{variable}} formats)
        for (const [key, value] of Object.entries(variables)) {
          personalizedQuestion = personalizedQuestion.replace(
            new RegExp(`\\{\\{?${key}\\}?\\}`, "gi"),
            value
          )
        }
        
        // Safety check: if variables weren't replaced, remove them to avoid showing raw variables
        if (personalizedQuestion.match(/\{.*(memorial_name|member_name).*\}/i)) {
          console.warn(`[send-daily-notifications] Variables not replaced in question for group ${dailyPrompt.group_id}: ${personalizedQuestion}`)
          // Replace any remaining variables with a fallback
          personalizedQuestion = personalizedQuestion.replace(
            /\{\{?memorial_name\}\}?/gi,
            "them"
          ).replace(
            /\{\{?member_name\}\}?/gi,
            "them"
          )
        }

        // Calculate 8 AM local time for this user (in UTC)
        const scheduledTime = get8AMLocalTimeUTC(userTimezone, new Date(today + "T00:00:00"))
        
        // Queue notification for 8 AM local time
        const notificationTitle = `Answer today's question in ${group.name}`
        const notificationBody = "Take a minute to answer so you can see what the others said"
        
        const { error: queueError } = await supabaseClient
          .from("notification_queue")
          .insert({
            user_id: targetUser.user_id,
            type: "daily_prompt",
            title: notificationTitle,
            body: notificationBody,
            data: {
              type: "daily_prompt",
              group_id: group.id,
              prompt_id: dailyPrompt.prompt_id,
            },
            scheduled_time: scheduledTime.toISOString(),
          })

        if (queueError) {
          console.error(`[send-daily-notifications] Error queueing notification for user ${targetUser.user_id}:`, queueError)
        } else {
          console.log(`[send-daily-notifications] Queued notification for user ${targetUser.user_id} at ${scheduledTime.toISOString()} (8 AM ${userTimezone})`)
          notifications.push({ 
            user_id: targetUser.user_id, 
            status: "queued",
            scheduled_time: scheduledTime.toISOString(),
            timezone: userTimezone
          })
        }
      }
    }

    return new Response(JSON.stringify({ success: true, notifications_sent: notifications.length, notifications }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[send-daily-notifications] Fatal error:", errorMessage)
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    })
  }
})
