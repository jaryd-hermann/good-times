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

// Helper function to get Thursday of the current week as date string
function getThursdayOfWeek(weekStart: string): string {
  const monday = new Date(weekStart)
  const thursday = new Date(monday)
  thursday.setDate(monday.getDate() + 3) // Thursday is 3 days after Monday
  return thursday.toISOString().split("T")[0]
}

// Helper function to determine target date based on current day
// This function is called when cron runs on Monday or Thursday at 12:01 AM UTC
function getTargetDate(today: Date): { date: string; dayName: string } {
  const dayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, ..., 4 = Thursday
  const todayStr = today.toISOString().split("T")[0]
  
  if (dayOfWeek === 1) {
    // Today is Monday - assign for today (Monday)
    return { date: todayStr, dayName: "Monday" }
  } else if (dayOfWeek === 4) {
    // Today is Thursday - assign for today (Thursday)
    return { date: todayStr, dayName: "Thursday" }
  } else {
    // Should not happen if cron is set correctly, but handle gracefully
    // Log warning and default to today
    console.warn(`[assign-custom-question-opportunity] Unexpected day of week: ${dayOfWeek}, defaulting to today`)
    return { date: todayStr, dayName: dayOfWeek === 1 ? "Monday" : "Thursday" }
  }
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

    // Get current date and determine target date (Monday or Thursday)
    const today = new Date()
    const todayStr = today.toISOString().split("T")[0]
    const { date: targetDate, dayName } = getTargetDate(today)
    const weekStart = getWeekStartDate(todayStr)

    console.log(`[assign-custom-question-opportunity] Running for ${dayName} (${targetDate})`)

    // Get all eligible groups
    const { data: eligibleGroups, error: groupsError } = await supabaseClient
      .from("group_activity_tracking")
      .select("group_id")
      .eq("is_eligible_for_custom_questions", true)

    if (groupsError) throw groupsError

    const results = []

    for (const tracking of eligibleGroups || []) {
      const groupId = tracking.group_id

      // Check if group already has an assignment for this specific date (Monday or Thursday)
      const { data: existingAssignment } = await supabaseClient
        .from("custom_question_rotation")
        .select("user_id, date_assigned")
        .eq("group_id", groupId)
        .eq("date_assigned", targetDate)
        .maybeSingle()

      if (existingAssignment) {
        results.push({ 
          group_id: groupId, 
          status: "already_assigned", 
          user_id: existingAssignment.user_id,
          date: targetDate,
          day: dayName
        })
        continue
      }

      // Get all group members
      const { data: members, error: membersError } = await supabaseClient
        .from("group_members")
        .select("user_id, role, user:users(id, name)")
        .eq("group_id", groupId)

      if (membersError) {
        console.error(`[assign-custom-question-opportunity] Error fetching members for group ${groupId}:`, membersError)
        continue
      }

      if (!members || members.length < 3) {
        results.push({ group_id: groupId, status: "insufficient_members" })
        continue
      }

      // Get rotation history to prioritize members who haven't been assigned
      const { data: rotationHistory } = await supabaseClient
        .from("custom_question_rotation")
        .select("user_id")
        .eq("group_id", groupId)

      const assignedUserIds = new Set((rotationHistory || []).map((r: any) => r.user_id))
      const unassignedMembers = members.filter((m) => !assignedUserIds.has(m.user_id))

      // Select member: prioritize unassigned, otherwise random from all members
      let selectedMember
      if (unassignedMembers.length > 0) {
        // Random from unassigned members
        selectedMember = unassignedMembers[Math.floor(Math.random() * unassignedMembers.length)]
      } else {
        // All members have been assigned, reset rotation - random from all members
        selectedMember = members[Math.floor(Math.random() * members.length)]
      }

      // Check for same-day conflicts across all groups for this user on the target date
      const { data: sameDayConflicts } = await supabaseClient
        .from("custom_questions")
        .select("id")
        .eq("user_id", selectedMember.user_id)
        .eq("date_assigned", targetDate)
        .is("date_asked", null)

      // If conflict exists, try to find another member for this date
      if (sameDayConflicts && sameDayConflicts.length > 0) {
        // Try other members who don't have conflicts
        const membersWithoutConflicts = members.filter((m: any) => {
          // Check if this member has a conflict on targetDate
          // We'll check this by trying to find them in conflicts
          return m.user_id !== selectedMember.user_id
        })
        
        let foundMember = false
        for (const member of membersWithoutConflicts) {
          const { data: conflicts } = await supabaseClient
            .from("custom_questions")
            .select("id")
            .eq("user_id", member.user_id)
            .eq("date_assigned", targetDate)
            .is("date_asked", null)
          
          if (!conflicts || conflicts.length === 0) {
            selectedMember = member
            foundMember = true
            break
          }
        }
        
        // If no member found without conflicts, skip this assignment
        if (!foundMember) {
          results.push({ 
            group_id: groupId, 
            status: "skipped_due_to_conflict", 
            user_id: selectedMember.user_id,
            date: targetDate,
            day: dayName
          })
          continue
        }
      }

      const finalDate = targetDate

      // Create rotation record
      const { error: rotationError } = await supabaseClient
        .from("custom_question_rotation")
        .insert({
          group_id: groupId,
          user_id: selectedMember.user_id,
          week_start_date: weekStart,
          date_assigned: finalDate,
          status: "assigned",
        })

      if (rotationError) {
        console.error(`[assign-custom-question-opportunity] Error creating rotation for group ${groupId}:`, rotationError)
        continue
      }

      // Create custom_question opportunity record (empty question, will be filled when user creates it)
      const { error: questionError } = await supabaseClient
        .from("custom_questions")
        .insert({
          group_id: groupId,
          user_id: selectedMember.user_id,
          question: "", // Will be filled when user creates question
          date_assigned: finalDate,
          date_asked: null,
        })

      if (questionError) {
        console.error(`[assign-custom-question-opportunity] Error creating custom question for group ${groupId}:`, questionError)
        // Rollback rotation record
        await supabaseClient
          .from("custom_question_rotation")
          .delete()
          .eq("group_id", groupId)
          .eq("user_id", selectedMember.user_id)
          .eq("week_start_date", weekStart)
        continue
      }

      results.push({
        group_id: groupId,
        status: "assigned",
        user_id: selectedMember.user_id,
        date_assigned: finalDate,
        day: dayName,
        week_start: weekStart,
      })
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error: any) {
    console.error("[assign-custom-question-opportunity] Error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})

