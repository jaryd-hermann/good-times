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

    // Get all groups
    const { data: groups, error: groupsError } = await supabaseClient
      .from("groups")
      .select("id, name, created_by")

    if (groupsError) throw groupsError

    const results = []

    for (const group of groups || []) {
      // Get all members
      const { data: members, error: membersError } = await supabaseClient
        .from("group_members")
        .select("user_id, role, joined_at")
        .eq("group_id", group.id)

      if (membersError) {
        console.error(`[check-custom-question-eligibility] Error fetching members for group ${group.id}:`, membersError)
        continue
      }

      // Check member count (must be >= 3)
      if (!members || members.length < 3) {
        // Ensure tracking record exists but mark as not eligible
        await supabaseClient
          .from("group_activity_tracking")
          .upsert(
            {
              group_id: group.id,
              is_eligible_for_custom_questions: false,
            },
            { onConflict: "group_id" }
          )
        results.push({ group_id: group.id, status: "not_eligible", reason: "insufficient_members" })
        continue
      }

      // Get first non-admin member join date
      const nonAdminMembers = members.filter((m) => m.role !== "admin")
      if (nonAdminMembers.length === 0) {
        results.push({ group_id: group.id, status: "not_eligible", reason: "no_non_admin_members" })
        continue
      }

      const firstMemberJoin = nonAdminMembers.sort((a, b) =>
        new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
      )[0]

      // Get first entry date
      const { data: firstEntry } = await supabaseClient
        .from("entries")
        .select("created_at, date")
        .eq("group_id", group.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle()

      const firstEntryDate = firstEntry?.date || null

      // Check if 7 days have passed since first non-admin member joined
      const daysSinceFirstMember = Math.floor(
        (Date.now() - new Date(firstMemberJoin.joined_at).getTime()) / (1000 * 60 * 60 * 24)
      )

      const isEligible = daysSinceFirstMember >= 7
      const eligibleSince = isEligible && !firstEntryDate
        ? new Date(Date.now() - (daysSinceFirstMember - 7) * 24 * 60 * 60 * 1000).toISOString()
        : null

      // Upsert activity tracking record
      const { error: trackingError } = await supabaseClient
        .from("group_activity_tracking")
        .upsert(
          {
            group_id: group.id,
            first_member_joined_at: firstMemberJoin.joined_at,
            first_entry_date: firstEntryDate,
            is_eligible_for_custom_questions: isEligible,
            eligible_since: eligibleSince,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "group_id" }
        )

      if (trackingError) {
        console.error(`[check-custom-question-eligibility] Error updating tracking for group ${group.id}:`, trackingError)
        continue
      }

      results.push({
        group_id: group.id,
        status: isEligible ? "eligible" : "not_eligible",
        days_since_first_member: daysSinceFirstMember,
        member_count: members.length,
      })
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error: any) {
    console.error("[check-custom-question-eligibility] Error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})

