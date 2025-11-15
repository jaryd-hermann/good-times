import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { Deno } from "https://deno.land/std@0.168.0/node/globals.ts"

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

    const { user_id, type, title, body, data } = await req.json()

    if (!user_id || !type || !title || !body) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    // Get user's push token
    const { data: pushTokens, error: tokenError } = await supabaseClient
      .from("push_tokens")
      .select("token")
      .eq("user_id", user_id)
      .limit(1)

    if (tokenError || !pushTokens || pushTokens.length === 0) {
      return new Response(JSON.stringify({ error: "No push token found for user" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      })
    }

    const pushToken = pushTokens[0].token

    // Send push notification via Expo
    const message = {
      to: pushToken,
      sound: "default",
      title,
      body,
      data: data || {},
    }

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
      user_id,
      type,
      title,
      body,
      data: data || {},
    })

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})

