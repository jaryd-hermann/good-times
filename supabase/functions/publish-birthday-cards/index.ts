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

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    
    const todayStr = today.toISOString().split("T")[0]
    const tomorrowStr = tomorrow.toISOString().split("T")[0]
    
    // Current hour in UTC
    const currentHour = now.getUTCHours()
    
    // Cards should be published 12 hours before birthday
    // If birthday is today and it's >= noon (12:00) yesterday, publish
    // If birthday is tomorrow and it's >= noon (12:00) today, publish
    
    let targetDate: string | null = null
    
    if (currentHour >= 12) {
      // It's noon or later, check for cards with birthday_date = tomorrow
      targetDate = tomorrowStr
    } else {
      // It's before noon, check for cards with birthday_date = today
      targetDate = todayStr
    }

    console.log(`[publish-birthday-cards] Publishing cards with birthday_date = ${targetDate} (current hour: ${currentHour})`)

    // Get all cards with status='draft' where birthday_date matches target date
    const { data: cards, error: cardsError } = await supabaseClient
      .from("birthday_cards")
      .select("id, group_id, birthday_user_id, birthday_date, birthday_user:users(id, name)")
      .eq("status", "draft")
      .eq("birthday_date", targetDate)

    if (cardsError) throw cardsError

    if (!cards || cards.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          cards_published: 0,
          message: `No cards found for ${targetDate}`,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const publishedCards = []

    for (const card of cards) {
      // Update card status to 'published'
      const { error: updateError } = await supabaseClient
        .from("birthday_cards")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
        })
        .eq("id", card.id)

      if (updateError) {
        console.error(`[publish-birthday-cards] Error publishing card ${card.id}:`, updateError)
        continue
      }

      console.log(`[publish-birthday-cards] Published card ${card.id} for user ${card.birthday_user_id}`)
      publishedCards.push(card)

      // Send notification to birthday person
      const birthdayUser = card.birthday_user as any
      
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
          title: "You have a birthday card! 🎉",
          body: "Your friends wrote you a special birthday card. Open the app to see it!",
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
          console.log(`[publish-birthday-cards] Sent notification to birthday person ${card.birthday_user_id}:`, result.data?.status || "sent")
        } catch (error) {
          console.error(`[publish-birthday-cards] Error sending push notification:`, error)
        }
      }

      // Save notification to database
      const { error: insertError } = await supabaseClient.from("notifications").insert({
        user_id: card.birthday_user_id,
        type: "birthday_card_ready",
        title: "You have a birthday card! 🎉",
        body: "Your friends wrote you a special birthday card. Open the app to see it!",
        data: {
          group_id: card.group_id,
          card_id: card.id,
        },
      })

      if (insertError) {
        console.error(`[publish-birthday-cards] Error saving notification:`, insertError)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        cards_published: publishedCards.length,
        cards: publishedCards.map((c) => ({ id: c.id, birthday_user_id: c.birthday_user_id })),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[publish-birthday-cards] Fatal error:", errorMessage)
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    })
  }
})

