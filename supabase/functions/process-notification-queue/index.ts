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

    // Get unprocessed notifications from queue that are ready to send
    // Either scheduled_time is NULL (send immediately) or scheduled_time <= now()
    const now = new Date().toISOString()
    const { data: queueItems, error: queueError } = await supabaseClient
      .from("notification_queue")
      .select("*")
      .eq("processed", false)
      .or(`scheduled_time.is.null,scheduled_time.lte.${now}`)
      .order("scheduled_time", { ascending: true, nullsFirst: false })
      .limit(50)

    if (queueError) throw queueError

    if (!queueItems || queueItems.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const results = []

    for (const item of queueItems) {
      // Get user's push token
      const { data: pushTokens } = await supabaseClient
        .from("push_tokens")
        .select("token")
        .eq("user_id", item.user_id)
        .limit(1)

      if (!pushTokens || pushTokens.length === 0) {
        // No push token - mark as processed anyway
        await supabaseClient
          .from("notification_queue")
          .update({ processed: true })
          .eq("id", item.id)
        continue
      }

      const pushToken = pushTokens[0].token

      // Send push notification via Expo
      const message = {
        to: pushToken,
        sound: "default",
        title: item.title,
        body: item.body,
        data: item.data || {},
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
          user_id: item.user_id,
          type: item.type,
          title: item.title,
          body: item.body,
          data: item.data,
        })

        // Mark as processed
        await supabaseClient
          .from("notification_queue")
          .update({ processed: true })
          .eq("id", item.id)

        results.push({ id: item.id, status: "sent" })
      } catch (error) {
        console.error(`[process-notification-queue] Error processing ${item.id}:`, error)
        results.push({ id: item.id, status: "error", error: error.message })
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})

