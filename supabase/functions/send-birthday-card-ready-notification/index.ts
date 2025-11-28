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
    const todayStr = today.toISOString().split("T")[0]

    console.log(`[send-birthday-card-ready-notification] Looking for published cards with birthday_date = ${todayStr}`)

    // Get all cards with status='published' where birthday_date is today
    const { data: cards, error: cardsError } = await supabaseClient
      .from("birthday_cards")
      .select("id, group_id, birthday_user_id, birthday_date")
      .eq("status", "published")
      .eq("birthday_date", todayStr)

    if (cardsError) throw cardsError

    if (!cards || cards.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          notifications_sent: 0,
          message: "No published cards found for today",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const notifications = []

    for (const card of cards) {
      // Check if birthday person has already been notified today
      const todayStart = new Date(todayStr + "T00:00:00Z")
      const todayEnd = new Date(todayStr + "T23:59:59Z")

      const { data: existingNotification } = await supabaseClient
        .from("notifications")
        .select("id")
        .eq("user_id", card.birthday_user_id)
        .eq("type", "birthday_card_ready")
        .gte("created_at", todayStart.toISOString())
        .lte("created_at", todayEnd.toISOString())
        .maybeSingle()

      if (existingNotification) {
        console.log(`[send-birthday-card-ready-notification] User ${card.birthday_user_id} already notified today for card ${card.id}`)
        continue
      }

      // Get push token for birthday person
      const { data: pushTokens, error: tokenError } = await supabaseClient
        .from("push_tokens")
        .select("token")
        .eq("user_id", card.birthday_user_id)
        .limit(1)

      const pushToken = pushTokens?.[0]?.token

      if (pushToken) {
        const message = {
          to: pushToken,
          sound: "default",
          title: "Your birthday card is ready! 🎂",
          body: "Open the app to see the special card your friends wrote for you!",
          data: {
            type: "birthday_card_ready",
            group_id: card.group_id,
            card_id: card.id,
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
          console.log(`[send-birthday-card-ready-notification] Sent notification to user ${card.birthday_user_id}:`, result.data?.status || "sent")
        } catch (error) {
          console.error(`[send-birthday-card-ready-notification] Error sending push notification:`, error)
        }
      }

      // Save notification to database
      const { error: insertError } = await supabaseClient.from("notifications").insert({
        user_id: card.birthday_user_id,
        type: "birthday_card_ready",
        title: "Your birthday card is ready! 🎂",
        body: "Open the app to see the special card your friends wrote for you!",
        data: {
          group_id: card.group_id,
          card_id: card.id,
        },
      })

      if (insertError) {
        console.error(`[send-birthday-card-ready-notification] Error saving notification:`, insertError)
      } else {
        notifications.push({
          user_id: card.birthday_user_id,
          card_id: card.id,
          status: "sent",
        })
      }

      // Send email notification
      try {
        // Get user details
        const { data: user, error: userError } = await supabaseClient
          .from("users")
          .select("id, email, name")
          .eq("id", card.birthday_user_id)
          .single()

        if (userError || !user || !user.email) {
          console.error(`[send-birthday-card-ready-notification] Error fetching user for email:`, userError)
        } else {
          // Get group details
          const { data: group, error: groupError } = await supabaseClient
            .from("groups")
            .select("id, name, type")
            .eq("id", card.group_id)
            .single()

          if (groupError) {
            console.error(`[send-birthday-card-ready-notification] Error fetching group for email:`, groupError)
          } else {
            // Get contributor names (people who wrote entries)
            const { data: entries, error: entriesError } = await supabaseClient
              .from("birthday_card_entries")
              .select("contributor:users(name)")
              .eq("card_id", card.id)

            const contributorNames: string[] = []
            if (!entriesError && entries) {
              for (const entry of entries) {
                const contributor = entry.contributor as any
                if (contributor?.name) {
                  contributorNames.push(contributor.name)
                }
              }
            }

            // Format contributor names as a readable string
            let contributorsText = ""
            const groupGreeting = group?.type === "family" ? "your family" : "your friends"
            if (contributorNames.length === 0) {
              contributorsText = group?.type === "family" ? "your family members" : "your friends"
            } else if (contributorNames.length === 1) {
              contributorsText = contributorNames[0]
            } else if (contributorNames.length === 2) {
              contributorsText = `${contributorNames[0]} and ${contributorNames[1]}`
            } else {
              const lastName = contributorNames[contributorNames.length - 1]
              const otherNames = contributorNames.slice(0, -1).join(", ")
              contributorsText = `${otherNames}, and ${lastName}`
            }

            // Generate deep link
            const deepLink = `https://thegoodtimes.app/birthday-card-details?cardId=${card.id}&groupId=${card.group_id}`

            // Call send-email function
            const emailResponse = await supabaseClient.functions.invoke("send-email", {
              body: {
                email_type: "birthday_card",
                user_id: card.birthday_user_id,
                recipient_email: user.email,
                template_data: {
                  user_name: user.name,
                  group_type: group?.type || "friends",
                  contributor_names: contributorNames, // Array of names
                  contributors_text: contributorsText, // Formatted string (e.g., "John, Jane, and Bob")
                  group_greeting: groupGreeting, // "your family" or "your friends"
                  card_link: deepLink,
                },
              },
            })

            if (emailResponse.error) {
              console.error(`[send-birthday-card-ready-notification] Error sending email:`, emailResponse.error)
            } else {
              console.log(`[send-birthday-card-ready-notification] Email sent successfully to ${user.email}`)
            }
          }
        }
      } catch (emailError) {
        console.error(`[send-birthday-card-ready-notification] Exception sending email:`, emailError)
        // Don't throw - push notification was sent successfully
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
    console.error("[send-birthday-card-ready-notification] Fatal error:", errorMessage)
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    })
  }
})

