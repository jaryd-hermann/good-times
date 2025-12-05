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

// Get user's local time (9 AM)
function getUserLocalTime(userTimezone: string = "America/New_York"): Date {
  const now = new Date()
  const userTime = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }))
  const utcTime = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }))
  const offset = userTime.getTime() - utcTime.getTime()
  
  // Set to 9 AM local time
  const local9AM = new Date(userTime)
  local9AM.setHours(9, 0, 0, 0)
  
  // Convert back to UTC
  const utc9AM = new Date(local9AM.getTime() - offset)
  return utc9AM
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
        // Get push token for this user
        const { data: pushTokens, error: tokenError } = await supabaseClient
          .from("push_tokens")
          .select("token")
          .eq("user_id", targetUser.user_id)
          .limit(1)

        if (tokenError || !pushTokens || pushTokens.length === 0) continue

        const pushToken = pushTokens[0].token
        if (!pushToken) continue

        // Personalize prompt text with dynamic variables
        // CRITICAL: Use prompt_name_usage table to get the EXACT same name that was selected
        // when getDailyPrompt ran. This ensures the notification matches what users see in the app.
        let personalizedQuestion = prompt.question
        const variables: Record<string, string> = {}
        
        // Check if prompt has dynamic variables that need replacement
        const hasMemorialName = personalizedQuestion.match(/\{.*memorial_name.*\}/i)
        const hasMemberName = personalizedQuestion.match(/\{.*member_name.*\}/i)
        
        // Handle memorial_name variable - MUST use prompt_name_usage for consistency
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
            // Fallback: if prompt_name_usage doesn't exist yet (shouldn't happen if getDailyPrompt ran first)
            // Use the same deterministic logic as getDailyPrompt
            const dayIndex = getDayIndex(today, dailyPrompt.group_id)
            const memorialIndex = dayIndex % groupMemorials.length
            const selectedMemorial = groupMemorials[memorialIndex]
            
            if (selectedMemorial?.name) {
              variables.memorial_name = selectedMemorial.name
              console.warn(`[send-daily-notifications] No prompt_name_usage found, calculated memorial name: ${selectedMemorial.name}`)
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
            // Fallback for birthday prompts: get the birthday person's name
            const todayMonthDay = today.substring(5) // MM-DD
            for (const member of members) {
              const user = member.user as any
              if (user?.birthday && user.birthday.substring(5) === todayMonthDay) {
                variables.member_name = user.name || "them"
                console.warn(`[send-daily-notifications] No prompt_name_usage found, calculated member name for birthday: ${variables.member_name}`)
                break
              }
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

        // Send push notification via Expo
        const message = {
          to: pushToken,
          sound: "default",
          title: `Today's question for ${group.name}`,
          body: personalizedQuestion,
          data: {
            type: "daily_prompt",
            group_id: group.id,
            prompt_id: dailyPrompt.prompt_id,
          },
        }

        try {
          const response = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(message),
          })

          const result = await response.json()
          
          // Save notification to database
          const { error: insertError } = await supabaseClient.from("notifications").insert({
            user_id: targetUser.user_id,
            type: "daily_prompt",
            title: message.title,
            body: message.body,
            data: message.data,
          })

          if (insertError) {
            console.error(`[send-daily-notifications] Error saving notification for user ${targetUser.user_id}:`, insertError)
          }

          notifications.push({ user_id: targetUser.user_id, status: result.data?.status || "sent" })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          console.error(`[send-daily-notifications] Error sending to user ${targetUser.user_id}:`, errorMessage)
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
