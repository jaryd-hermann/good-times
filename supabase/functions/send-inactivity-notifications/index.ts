// @ts-expect-error Deno doesn't recognize these imports in VS Code, but they are valid at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-expect-error Deno doesn't recognize these imports in VS Code, but they are valid at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send"

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    const today = new Date().toISOString().split("T")[0]
    const threeDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] // 2 days ago (today, yesterday, day before = 3 days)

    console.log(`[send-inactivity-notifications] Checking for inactivity from ${threeDaysAgo} to ${today}`)

    // Find users who:
    // 1. Have been members for at least 3 days (joined_at <= 3 days ago)
    // 2. Have NO entries in the last 3 days (today, yesterday, day before)
    // 3. Are in groups that have daily prompts for those 3 days
    // 4. Haven't received an inactivity notification in the last 24 hours
    
    // Try to use PostgreSQL function for better performance
    let inactiveUsers: any[] = []
    let queryError: any = null
    
    try {
      const { data, error } = await supabaseClient.rpc(
        'get_inactive_users',
        {
          check_date_start: threeDaysAgo,
          check_date_end: today,
        }
      )
      
      if (error) {
        queryError = error
        // If function doesn't exist, fall back to manual query
        if (!error.message?.includes('function') || !error.message?.includes('does not exist')) {
          throw error
        }
      } else {
        inactiveUsers = data || []
      }
    } catch (error) {
      queryError = error
    }

    // Fallback to manual query if RPC function doesn't exist
    if (queryError && queryError.message?.includes('function') && queryError.message?.includes('does not exist')) {
      console.log('[send-inactivity-notifications] RPC function not found, using manual query')
      
      // Manual approach: Get all group members who joined at least 3 days ago
      const { data: allMembers, error: membersError } = await supabaseClient
        .from("group_members")
        .select(`
          user_id,
          group_id,
          joined_at,
          groups!inner (
            id,
            name
          )
        `)
        .lte("joined_at", threeDaysAgo)

      if (membersError) {
        console.error("[send-inactivity-notifications] Error fetching members:", membersError)
        throw membersError
      }

      // Filter manually: check each member for entries
      inactiveUsers = []
      for (const member of allMembers || []) {
        const { data: entries } = await supabaseClient
          .from("entries")
          .select("id")
          .eq("user_id", member.user_id)
          .eq("group_id", member.group_id)
          .gte("date", threeDaysAgo)
          .lte("date", today)
          .limit(1)

        if (!entries || entries.length === 0) {
          inactiveUsers.push(member)
        }
      }
    } else if (queryError) {
      console.error("[send-inactivity-notifications] Error querying inactive users:", queryError)
      throw queryError
    }

    if (!inactiveUsers || inactiveUsers.length === 0) {
      console.log("[send-inactivity-notifications] No inactive users found")
      return new Response(
        JSON.stringify({ success: true, notifications_sent: 0, message: "No inactive users found" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      )
    }

    console.log(`[send-inactivity-notifications] Found ${inactiveUsers.length} potential inactive users`)

    const notifications = []
    let sentCount = 0
    let skippedCount = 0

    for (const member of inactiveUsers) {
      const userId = member.user_id
      const groupId = member.group_id
      // Handle both RPC result (has group_name) and manual query result (has groups object)
      const groupName = (member as any).group_name || (member as any).groups?.name
      const group = (member as any).groups || { id: groupId, name: groupName }

      if (!group || !group.name) {
        // Try to fetch group name if missing
        const { data: groupData } = await supabaseClient
          .from("groups")
          .select("name")
          .eq("id", groupId)
          .single()
        
        if (!groupData || !groupData.name) {
          console.warn(`[send-inactivity-notifications] Skipping member ${userId} - group not found`)
          skippedCount++
          continue
        }
        group.name = groupData.name
      }

      // Check if prompts exist for the last 3 days for this group
      const { data: prompts, error: promptsError } = await supabaseClient
        .from("daily_prompts")
        .select("date")
        .eq("group_id", groupId)
        .gte("date", threeDaysAgo)
        .lte("date", today)

      if (promptsError) {
        console.error(`[send-inactivity-notifications] Error checking prompts for group ${groupId}:`, promptsError)
        skippedCount++
        continue
      }

      // Only send if prompts exist for at least one of the last 3 days
      if (!prompts || prompts.length === 0) {
        console.log(`[send-inactivity-notifications] Skipping group ${groupId} - no prompts in last 3 days`)
        skippedCount++
        continue
      }

      // Double-check: Verify user has no entries in last 3 days (race condition protection)
      const { data: recentEntries, error: entriesError } = await supabaseClient
        .from("entries")
        .select("id")
        .eq("user_id", userId)
        .eq("group_id", groupId)
        .gte("date", threeDaysAgo)
        .lte("date", today)
        .limit(1)

      if (entriesError) {
        console.error(`[send-inactivity-notifications] Error checking entries for user ${userId}:`, entriesError)
        skippedCount++
        continue
      }

      if (recentEntries && recentEntries.length > 0) {
        console.log(`[send-inactivity-notifications] Skipping user ${userId} - has entry in last 3 days (race condition)`)
        skippedCount++
        continue
      }

      // Check if we've sent a notification in the last 24 hours
      const { data: recentNotification, error: logError } = await supabaseClient
        .from("inactivity_notification_log")
        .select("last_sent_at")
        .eq("user_id", userId)
        .eq("group_id", groupId)
        .single()

      if (logError && logError.code !== "PGRST116") { // PGRST116 = not found, which is OK
        console.error(`[send-inactivity-notifications] Error checking notification log:`, logError)
        skippedCount++
        continue
      }

      if (recentNotification) {
        const lastSent = new Date(recentNotification.last_sent_at)
        const hoursSinceLastSent = (Date.now() - lastSent.getTime()) / (1000 * 60 * 60)
        
        if (hoursSinceLastSent < 24) {
          console.log(`[send-inactivity-notifications] Skipping user ${userId} - notification sent ${hoursSinceLastSent.toFixed(1)} hours ago`)
          skippedCount++
          continue
        }
      }

      // Get push token for this user
      const { data: pushTokens, error: tokenError } = await supabaseClient
        .from("push_tokens")
        .select("token")
        .eq("user_id", userId)
        .limit(1)

      if (tokenError || !pushTokens || pushTokens.length === 0) {
        console.log(`[send-inactivity-notifications] Skipping user ${userId} - no push token`)
        skippedCount++
        continue
      }

      const pushToken = pushTokens[0].token
      if (!pushToken) {
        skippedCount++
        continue
      }

      // Send push notification
      const message = {
        to: pushToken,
        sound: "default",
        title: "Don't leave gaps in your group's history!",
        body: `You haven't answered a question in ${group.name} in 3 days, don't leave gaps in your group's growing history!`,
        data: {
          type: "inactivity_reminder",
          group_id: groupId,
        },
      }

      try {
        const response = await fetch(EXPO_PUSH_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(message),
        })

        const result = await response.json()

        // Save notification to database
        const { error: insertError } = await supabaseClient.from("notifications").insert({
          user_id: userId,
          type: "inactivity_reminder",
          title: message.title,
          body: message.body,
          data: message.data,
        })

        if (insertError) {
          console.error(`[send-inactivity-notifications] Error saving notification for user ${userId}:`, insertError)
        }

        // Update or insert inactivity notification log
        const { error: upsertError } = await supabaseClient
          .from("inactivity_notification_log")
          .upsert(
            {
              user_id: userId,
              group_id: groupId,
              last_sent_at: new Date().toISOString(),
            },
            {
              onConflict: "user_id,group_id",
            }
          )

        if (upsertError) {
          console.error(`[send-inactivity-notifications] Error updating notification log:`, upsertError)
        }

        notifications.push({
          user_id: userId,
          group_id: groupId,
          group_name: group.name,
          status: result.data?.status || "sent",
        })
        sentCount++

        console.log(`[send-inactivity-notifications] Sent notification to user ${userId} for group ${group.name}`)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[send-inactivity-notifications] Error sending to user ${userId}:`, errorMessage)
        skippedCount++
      }
    }

    console.log(`[send-inactivity-notifications] Completed: ${sentCount} sent, ${skippedCount} skipped`)

    return new Response(
      JSON.stringify({
        success: true,
        notifications_sent: sentCount,
        notifications_skipped: skippedCount,
        notifications,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[send-inactivity-notifications] Fatal error:", errorMessage)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    )
  }
})

