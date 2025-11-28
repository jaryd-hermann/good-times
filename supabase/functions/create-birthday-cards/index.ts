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
    
    // Get MM-DD format for birthday comparison (check birthdays within next 7 days)
    const targetMonthDays: string[] = []
    for (let i = 1; i <= 7; i++) {
      const checkDate = new Date(today)
      checkDate.setDate(today.getDate() + i)
      targetMonthDays.push(checkDate.toISOString().split("T")[0].substring(5)) // MM-DD
    }

    console.log(`[create-birthday-cards] Looking for birthdays in next 7 days (${todayDateStr} to ${sevenDaysFromNowStr})`)

    // Get all groups
    const { data: groups, error: groupsError } = await supabaseClient
      .from("groups")
      .select("id")

    if (groupsError) throw groupsError

    const results = []
    const cardsCreated = []

    for (const group of groups || []) {
      // Get all group members with their birthdays
      const { data: members, error: membersError } = await supabaseClient
        .from("group_members")
        .select("user_id, user:users(id, name, birthday)")
        .eq("group_id", group.id)

      if (membersError) {
        console.error(`[create-birthday-cards] Error fetching members for group ${group.id}:`, membersError)
        continue
      }

      if (!members || members.length === 0) continue

      // Check for birthdays within next 7 days
      for (const member of members) {
        const user = member.user as any
        if (!user?.birthday) continue

        const birthdayMonthDay = user.birthday.substring(5) // MM-DD format
        
        // Check if birthday matches any of the next 7 days
        let birthdayDateStr: string | null = null
        let birthdayYear: number | null = null
        
        for (let i = 1; i <= 7; i++) {
          const checkDate = new Date(today)
          checkDate.setDate(today.getDate() + i)
          const checkDateStr = checkDate.toISOString().split("T")[0]
          const checkMonthDay = checkDateStr.substring(5) // MM-DD
          
          if (birthdayMonthDay === checkMonthDay) {
            birthdayDateStr = checkDateStr
            birthdayYear = checkDate.getFullYear()
            break
          }
        }
        
        if (!birthdayDateStr) continue // Birthday not in next 7 days
        
        // Check if card already exists
        const { data: existingCard } = await supabaseClient
          .from("birthday_cards")
          .select("id")
          .eq("group_id", group.id)
          .eq("birthday_user_id", user.id)
          .eq("birthday_date", birthdayDateStr)
          .maybeSingle()

        if (existingCard) {
          console.log(`[create-birthday-cards] Card already exists for user ${user.id} on ${birthdayDateStr}`)
          results.push({
            group_id: group.id,
            birthday_user_id: user.id,
            birthday_date: birthdayDateStr,
            status: "already_exists",
          })
          continue
        }

        // Create card
        const { data: newCard, error: createError } = await supabaseClient
          .from("birthday_cards")
          .insert({
            group_id: group.id,
            birthday_user_id: user.id,
            birthday_date: birthdayDateStr,
            birthday_year: birthdayYear!,
            status: "draft",
            is_public: false,
          })
          .select()
          .single()

        if (createError) {
          console.error(`[create-birthday-cards] Error creating card for user ${user.id}:`, createError)
          results.push({
            group_id: group.id,
            birthday_user_id: user.id,
            birthday_date: birthdayDateStr,
            status: "error",
            error: createError.message,
          })
        } else {
          console.log(`[create-birthday-cards] Created card ${newCard.id} for user ${user.id} (${user.name}) on ${birthdayDateStr}`)
          cardsCreated.push(newCard)
          results.push({
            group_id: group.id,
            birthday_user_id: user.id,
            birthday_date: birthdayDateStr,
            status: "created",
            card_id: newCard.id,
          })
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        cards_created: cardsCreated.length,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[create-birthday-cards] Fatal error:", errorMessage)
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    })
  }
})

