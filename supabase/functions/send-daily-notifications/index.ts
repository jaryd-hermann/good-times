import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { Deno } from "https://deno.land/std@0.168.0/node/globals.ts" // Declare Deno variable

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

    // Get all group prompts for today
    const { data: groupPrompts, error: promptsError } = await supabaseClient
      .from("group_prompts")
      .select(`
        id,
        group_id,
        groups (
          id,
          name,
          members (
            user_id,
            users (
              id,
              push_token
            )
          )
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

      // Get all members with push tokens
      const members = group.members.map((m) => m.users).filter((u) => u.push_token)

      for (const user of members) {
        // Send push notification via Expo
        const message = {
          to: user.push_token,
          sound: "default",
          title: `Today's question for ${group.name}`,
          body: prompt.question,
          data: {
            type: "daily_prompt",
            group_id: group.id,
            prompt_id: groupPrompt.id,
          },
        }

        const response = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(message),
        })

        const result = await response.json()
        notifications.push({ user_id: user.id, status: result.data?.status || "sent" })
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
