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

    const today = new Date()
    const todayDateStr = today.toISOString().split("T")[0]
    
    // Calculate date 7 days from now
    const sevenDaysFromNow = new Date(today)
    sevenDaysFromNow.setDate(today.getDate() + 7)
    const sevenDaysFromNowStr = sevenDaysFromNow.toISOString().split("T")[0]

    console.log(`[send-birthday-card-notifications] Looking for cards with birthday_date = ${sevenDaysFromNowStr}`)

    // Get all cards with status='draft' where birthday_date is exactly 7 days away
    const { data: cards, error: cardsError } = await supabaseClient
      .from("birthday_cards")
      .select("id, group_id, birthday_user_id, birthday_date, birthday_user:users(id, name)")
      .eq("status", "draft")
      .eq("birthday_date", sevenDaysFromNowStr)

    if (cardsError) throw cardsError

    if (!cards || cards.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          notifications_sent: 0,
          message: "No cards found for 7 days from now",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const notifications = []
    const notificationRecords = []

    for (const card of cards) {
      const birthdayUser = card.birthday_user as any
      const birthdayUserName = birthdayUser?.name || "Someone"

      // Get all group members EXCEPT birthday_user_id
      const { data: members, error: membersError } = await supabaseClient
        .from("group_members")
        .select("user_id, user:users(id, name)")
        .eq("group_id", card.group_id)
        .neq("user_id", card.birthday_user_id)

      if (membersError) {
        console.error(`[send-birthday-card-notifications] Error fetching members for group ${card.group_id}:`, membersError)
        continue
      }

      if (!members || members.length === 0) continue

      // Get group name
      const { data: group } = await supabaseClient
        .from("groups")
        .select("name")
        .eq("id", card.group_id)
        .single()

      const groupName = group?.name || "your group"

      for (const member of members) {
        // Check if they've already been notified
        const { data: existingNotification } = await supabaseClient
          .from("birthday_card_notifications")
          .select("id")
          .eq("card_id", card.id)
          .eq("user_id", member.user_id)
          .eq("notification_type", "initial")
          .maybeSingle()

        if (existingNotification) {
          console.log(`[send-birthday-card-notifications] User ${member.user_id} already notified for card ${card.id}`)
          continue
        }

        // Get push token for this user
        const { data: pushTokens, error: tokenError } = await supabaseClient
          .from("push_tokens")
          .select("token")
          .eq("user_id", member.user_id)
          .limit(1)

        if (tokenError || !pushTokens || pushTokens.length === 0) {
          console.log(`[send-birthday-card-notifications] No push token for user ${member.user_id}`)
          // Still record notification in database even if no push token
        }

        const pushToken = pushTokens?.[0]?.token

        // Send push notification if token exists
        if (pushToken) {
          const message = {
            to: pushToken,
            sound: "default",
            title: `It's ${birthdayUserName}'s birthday in 7 days!`,
            body: `Write them a birthday card in ${groupName}.`,
            data: {
              type: "birthday_card_contribute",
              group_id: card.group_id,
              card_id: card.id,
              birthday_user_id: card.birthday_user_id,
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
            console.log(`[send-birthday-card-notifications] Sent notification to user ${member.user_id}:`, result.data?.status || "sent")
          } catch (error) {
            console.error(`[send-birthday-card-notifications] Error sending push notification to user ${member.user_id}:`, error)
          }
        }

        // Save notification to database
        const { error: insertError } = await supabaseClient.from("notifications").insert({
          user_id: member.user_id,
          type: "birthday_card_contribute",
          title: `It's ${birthdayUserName}'s birthday in 7 days!`,
          body: `Write them a birthday card in ${groupName}.`,
          data: {
            group_id: card.group_id,
            card_id: card.id,
            birthday_user_id: card.birthday_user_id,
          },
        })

        if (insertError) {
          console.error(`[send-birthday-card-notifications] Error saving notification for user ${member.user_id}:`, insertError)
        }

        // Record notification tracking
        const { error: trackingError } = await supabaseClient
          .from("birthday_card_notifications")
          .insert({
            card_id: card.id,
            user_id: member.user_id,
            notification_type: "initial",
          })

        if (trackingError) {
          console.error(`[send-birthday-card-notifications] Error tracking notification for user ${member.user_id}:`, trackingError)
        } else {
          notifications.push({
            user_id: member.user_id,
            card_id: card.id,
            status: "sent",
          })
          notificationRecords.push({
            card_id: card.id,
            user_id: member.user_id,
            notification_type: "initial",
          })
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        notifications_sent: notifications.length,
        notifications,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[send-birthday-card-notifications] Fatal error:", errorMessage)
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    })
  }
})

