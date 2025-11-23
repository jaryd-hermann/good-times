import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Helper function to get Monday of the week for a given date
function getWeekStartDate(dateString: string): string {
  const date = new Date(dateString)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1) // Adjust to Monday
  const monday = new Date(date.setDate(diff))
  return monday.toISOString().split("T")[0]
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
    const weekStart = getWeekStartDate(today)

    // Find custom questions that were assigned today but not created
    const { data: skippedOpportunities, error: fetchError } = await supabaseClient
      .from("custom_questions")
      .select("id, group_id, user_id, date_assigned")
      .eq("date_assigned", today)
      .is("date_asked", null)

    if (fetchError) throw fetchError

    const results = []

    for (const opportunity of skippedOpportunities || []) {
      // Update rotation status to skipped
      const { error: rotationError } = await supabaseClient
        .from("custom_question_rotation")
        .update({ status: "skipped" })
        .eq("group_id", opportunity.group_id)
        .eq("user_id", opportunity.user_id)
        .eq("week_start_date", weekStart)

      if (rotationError) {
        console.error(`[process-skipped-custom-questions] Error updating rotation for ${opportunity.id}:`, rotationError)
        continue
      }

      // Try to reassign to another member if same week and other members available
      const { data: members } = await supabaseClient
        .from("group_members")
        .select("user_id")
        .eq("group_id", opportunity.group_id)

      const { data: weekAssignments } = await supabaseClient
        .from("custom_question_rotation")
        .select("user_id")
        .eq("group_id", opportunity.group_id)
        .eq("week_start_date", weekStart)

      const assignedUserIds = new Set((weekAssignments || []).map((a: any) => a.user_id))
      const availableMembers = (members || []).filter((m: any) => !assignedUserIds.has(m.user_id))

      if (availableMembers.length > 0) {
        // Reassign to another member
        const newMember = availableMembers[Math.floor(Math.random() * availableMembers.length)]
        
        // Create new opportunity for tomorrow (or next available day)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        const tomorrowStr = tomorrow.toISOString().split("T")[0]

        await supabaseClient.from("custom_questions").insert({
          group_id: opportunity.group_id,
          user_id: newMember.user_id,
          question: "",
          date_assigned: tomorrowStr,
          date_asked: null,
        })

        await supabaseClient.from("custom_question_rotation").insert({
          group_id: opportunity.group_id,
          user_id: newMember.user_id,
          week_start_date: weekStart,
          date_assigned: tomorrowStr,
          status: "assigned",
        })

        results.push({
          group_id: opportunity.group_id,
          status: "reassigned",
          old_user_id: opportunity.user_id,
          new_user_id: newMember.user_id,
          new_date: tomorrowStr,
        })
      } else {
        results.push({
          group_id: opportunity.group_id,
          status: "skipped",
          user_id: opportunity.user_id,
          reason: "no_available_members",
        })
      }

      // Delete the skipped opportunity record
      await supabaseClient.from("custom_questions").delete().eq("id", opportunity.id)
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error: any) {
    console.error("[process-skipped-custom-questions] Error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})

