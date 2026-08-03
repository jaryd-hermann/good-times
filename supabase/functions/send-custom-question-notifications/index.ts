import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// EST hour check: convert current UTC hour to EST (UTC-5)
function getCurrentEstHour(): number {
  const now = new Date()
  return (now.getUTCHours() - 5 + 24) % 24
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
    const now = new Date()
    const currentHour = now.getUTCHours()

    // Determine notification type based on current hour
    // This function should be called twice: once at 8 AM and once at 4 PM user's local time
    // For simplicity, we'll check both conditions and send appropriate notifications
    const notifications = []

    // Get all custom question opportunities for today that haven't been created yet
    const { data: opportunities, error: opportunitiesError } = await supabaseClient
      .from("custom_questions")
      .select(`
        id,
        group_id,
        user_id,
        date_assigned,
        created_at,
        user:users(id, name),
        group:groups(id, name)
      `)
      .eq("date_assigned", today)
      .is("date_asked", null)

    if (opportunitiesError) throw opportunitiesError

    for (const opportunity of opportunities || []) {
      const user = opportunity.user as any
      const group = opportunity.group as any

      if (!user || !group) continue

      const assignedAt = new Date(opportunity.created_at)
      const hoursSinceAssignment = (now.getTime() - assignedAt.getTime()) / (1000 * 60 * 60)

      const estHour = getCurrentEstHour()

      // Send initial notification at 8 AM EST
      if (estHour === 8 && hoursSinceAssignment < 1) {
        // Get push token for user
        const { data: pushTokens } = await supabaseClient
          .from("push_tokens")
          .select("token")
          .eq("user_id", opportunity.user_id)
          .like("token", "ExponentPushToken%")

        if (pushTokens && pushTokens.length > 0) {
          for (const tokenData of pushTokens) {
            notifications.push({
              user_id: opportunity.user_id,
              token: tokenData.token,
              title: "You've been selected!",
              body: "You've been selected to ask a custom question to your group. Tap to create yours.",
              data: {
                type: "custom_question_opportunity",
                groupId: opportunity.group_id,
                date: today,
              },
            })
          }
        }
      }

      // Send reminder notification at 4 PM EST if question not created
      if (estHour === 16 && hoursSinceAssignment >= 6) {
        // Get push token for user
        const { data: pushTokens } = await supabaseClient
          .from("push_tokens")
          .select("token")
          .eq("user_id", opportunity.user_id)
          .like("token", "ExponentPushToken%")

        if (pushTokens && pushTokens.length > 0) {
          const hoursRemaining = Math.max(0, 24 - hoursSinceAssignment)
          for (const tokenData of pushTokens) {
            notifications.push({
              user_id: opportunity.user_id,
              token: tokenData.token,
              title: "Don't forget!",
              body: `You have ${Math.floor(hoursRemaining)} hours left to ask your custom question. Tap to create yours.`,
              data: {
                type: "custom_question_opportunity",
                groupId: opportunity.group_id,
                date: today,
              },
            })
          }
        }
      }
    }

    // Send notifications via Expo Push Notification service
    if (notifications.length > 0) {
      const expoPushUrl = "https://exp.host/--/api/v2/push/send"
      const pushPromises = notifications.map(async (notification) => {
        try {
          const response = await fetch(expoPushUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
            body: JSON.stringify({
              to: notification.token,
              sound: "default",
              title: notification.title,
              body: notification.body,
              data: notification.data,
            }),
          })

          if (!response.ok) {
            console.error(`[send-custom-question-notifications] Failed to send notification to ${notification.user_id}:`, await response.text())
          }
        } catch (error) {
          console.error(`[send-custom-question-notifications] Error sending notification to ${notification.user_id}:`, error)
        }
      })

      await Promise.all(pushPromises)
    }

    return new Response(
      JSON.stringify({
        success: true,
        notifications_sent: notifications.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (error: any) {
    console.error("[send-custom-question-notifications] Error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})

