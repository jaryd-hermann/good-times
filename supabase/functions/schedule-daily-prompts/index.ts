import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { Deno } from "https://deno.land/std@0.168.0/node/process.ts" // Added import for Deno

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

    // Get all active groups
    const { data: groups, error: groupsError } = await supabaseClient
      .from("groups")
      .select("id, name, timezone")
      .eq("is_active", true)

    if (groupsError) throw groupsError

    const results = []

    for (const group of groups || []) {
      // Check if group already has a prompt for today
      const today = new Date().toISOString().split("T")[0]
      const { data: existingPrompt } = await supabaseClient
        .from("group_prompts")
        .select("id")
        .eq("group_id", group.id)
        .eq("scheduled_for", today)
        .single()

      if (existingPrompt) {
        results.push({ group_id: group.id, status: "already_scheduled" })
        continue
      }

      // Get next prompt from queue or random prompt
      const { data: queuedPrompt } = await supabaseClient
        .from("group_prompt_queue")
        .select("prompt_id")
        .eq("group_id", group.id)
        .order("position", { ascending: true })
        .limit(1)
        .single()

      let promptId = queuedPrompt?.prompt_id

      // If no queued prompt, get a random unused prompt
      if (!promptId) {
        const { data: usedPrompts } = await supabaseClient
          .from("group_prompts")
          .select("prompt_id")
          .eq("group_id", group.id)

        const usedPromptIds = usedPrompts?.map((p) => p.prompt_id) || []

        const { data: randomPrompt } = await supabaseClient
          .from("prompts")
          .select("id")
          .not("id", "in", `(${usedPromptIds.join(",") || "0"})`)
          .limit(1)
          .single()

        promptId = randomPrompt?.id
      }

      if (!promptId) {
        results.push({ group_id: group.id, status: "no_prompts_available" })
        continue
      }

      // Create group_prompt for today
      const { error: insertError } = await supabaseClient.from("group_prompts").insert({
        group_id: group.id,
        prompt_id: promptId,
        scheduled_for: today,
      })

      if (insertError) throw insertError

      // Remove from queue if it was queued
      if (queuedPrompt) {
        await supabaseClient.from("group_prompt_queue").delete().eq("group_id", group.id).eq("prompt_id", promptId)
      }

      results.push({ group_id: group.id, status: "scheduled", prompt_id: promptId })
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})
