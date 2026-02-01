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

// Calculate 8 AM Eastern Time (EST/EDT) for a given date, converted to UTC
// dateOrDateStr: Either a Date object or a date string (YYYY-MM-DD)
// Returns UTC time that represents 8 AM Eastern Time on the given date
// All users receive notifications at 8 AM EST regardless of their timezone
function get8AMEasternTimeUTC(dateOrDateStr: Date | string = new Date()): Date {
  // Determine the target date string
  let targetDateStr: string
  
  if (typeof dateOrDateStr === 'string') {
    // Date string provided - use it directly
    targetDateStr = dateOrDateStr
  } else {
    // Date object provided - format it as YYYY-MM-DD
    const year = dateOrDateStr.getFullYear()
    const month = String(dateOrDateStr.getMonth() + 1).padStart(2, '0')
    const day = String(dateOrDateStr.getDate()).padStart(2, '0')
    targetDateStr = `${year}-${month}-${day}`
  }
  
  // Parse the date components
  const [year, month, day] = targetDateStr.split('-').map(Number)
  
  // Create a date formatter for Eastern Time
  const easternFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  
  // We need to find the UTC time that equals 8:00 AM Eastern Time on the target date
  // Start testing from 11:00 UTC (covers both EST and EDT cases)
  // 8 AM EST = 1 PM UTC (UTC-5), 8 AM EDT = 12 PM UTC (UTC-4)
  for (let utcHour = 11; utcHour <= 14; utcHour++) {
    const testUTC = new Date(Date.UTC(year, month - 1, day, utcHour, 0, 0))
    
    // Format this UTC time in Eastern Time to see what time it represents
    const parts = easternFormatter.formatToParts(testUTC)
    const etYear = parts.find(p => p.type === "year")?.value
    const etMonth = parts.find(p => p.type === "month")?.value
    const etDay = parts.find(p => p.type === "day")?.value
    const etHour = parseInt(parts.find(p => p.type === "hour")?.value || "0")
    const etMinute = parseInt(parts.find(p => p.type === "minute")?.value || "0")
    
    if (!etYear || !etMonth || !etDay) continue
    
    const etDateStr = `${etYear}-${etMonth.padStart(2, '0')}-${etDay.padStart(2, '0')}`
    
    // Check if this UTC time equals 8:00 AM Eastern Time on the target date
    if (etDateStr === targetDateStr && etHour === 8 && etMinute === 0) {
      return testUTC
    }
  }
  
  // Fallback: calculate manually
  // 8 AM EST = 1 PM UTC (UTC-5), 8 AM EDT = 12 PM UTC (UTC-4)
  // Default to 13:00 UTC (1 PM) which covers EST
  return new Date(Date.UTC(year, month - 1, day, 13, 0, 0))
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

    // Get "today" in Eastern Time, not UTC
    // The cron runs at 00:05 UTC, which might still be "yesterday" in EST
    // We want to schedule notifications for 8 AM EST on the Eastern "today"
    const now = new Date()
    const easternFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    const today = easternFormatter.format(now) // Returns YYYY-MM-DD in Eastern Time

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
        // Get user info (timezone no longer needed - all notifications sent at 8 AM EST)
        const { data: userData, error: userError } = await supabaseClient
          .from("users")
          .select("id, name, email")
          .eq("id", targetUser.user_id)
          .single()

        if (userError || !userData) {
          console.log(`[send-daily-notifications] User not found: ${targetUser.user_id}`)
          continue
        }
        
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

        // Calculate 8 AM Eastern Time (EST/EDT) for today, converted to UTC
        // All users receive notifications at the same time: 8 AM Eastern Time
        const scheduledTime = get8AMEasternTimeUTC(today)
        
        // Queue notification for 8 AM Eastern Time
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
          console.log(`[send-daily-notifications] Queued notification for user ${targetUser.user_id} at ${scheduledTime.toISOString()} (8 AM Eastern Time)`)
          notifications.push({ 
            user_id: targetUser.user_id, 
            status: "queued",
            scheduled_time: scheduledTime.toISOString(),
            timezone: "America/New_York"
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
