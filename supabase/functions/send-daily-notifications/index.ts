import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
        let personalizedQuestion = prompt.question
        
        if (prompt.dynamic_variables && Array.isArray(prompt.dynamic_variables)) {
          const variables: Record<string, string> = {}
          
          // Handle member_name variable for birthday prompts
          if (prompt.birthday_type === "their_birthday" && members) {
            const todayMonthDay = today.substring(5) // MM-DD
            for (const member of members) {
              const user = member.user as any
              if (user?.birthday && user.birthday.substring(5) === todayMonthDay) {
                variables.member_name = user.name || "them"
                break
              }
            }
          }
          
          // Replace variables in question text
          if (Object.keys(variables).length > 0) {
            for (const [key, value] of Object.entries(variables)) {
              personalizedQuestion = personalizedQuestion.replace(
                new RegExp(`\\{\\{?${key}\\}?\\}`, "gi"),
                value
              )
            }
          }
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
