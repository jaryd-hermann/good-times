import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { Deno } from "https://deno.land/std@0.168.0/node/globals.ts"

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

    // Get all group prompts for today
    const { data: groupPrompts, error: promptsError } = await supabaseClient
      .from("group_prompts")
      .select(`
        id,
        group_id,
        prompt_id,
        groups (
          id,
          name
        ),
        prompts (
          question
        )
      `)
      .eq("scheduled_for", today)

    if (promptsError) throw promptsError

    const notifications = []

    for (const groupPrompt of groupPrompts || []) {
      const group = groupPrompt.groups
      const prompt = groupPrompt.prompts

      // Get all members with push tokens from push_tokens table
      const { data: members, error: membersError } = await supabaseClient
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupPrompt.group_id)

      if (membersError) {
        console.error(`[send-daily-notifications] Error fetching members for group ${groupPrompt.group_id}:`, membersError)
        continue
      }

      for (const member of members || []) {
        // Get push token for this user
        const { data: pushTokens, error: tokenError } = await supabaseClient
          .from("push_tokens")
          .select("token")
          .eq("user_id", member.user_id)
          .limit(1)

        if (tokenError || !pushTokens || pushTokens.length === 0) continue

        const pushToken = pushTokens[0].token
        if (!pushToken) continue

        // Send push notification via Expo
        const message = {
          to: pushToken,
          sound: "default",
          title: `Today's question for ${group.name}`,
          body: prompt.question,
          data: {
            type: "daily_prompt",
            group_id: group.id,
            prompt_id: groupPrompt.prompt_id,
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
          await supabaseClient.from("notifications").insert({
            user_id: member.user_id,
            type: "daily_prompt",
            title: message.title,
            body: message.body,
            data: message.data,
          })

          notifications.push({ user_id: member.user_id, status: result.data?.status || "sent" })
        } catch (error) {
          console.error(`[send-daily-notifications] Error sending to user ${member.user_id}:`, error)
        }
      }
    }

    return new Response(JSON.stringify({ success: true, notifications_sent: notifications.length, notifications }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})
