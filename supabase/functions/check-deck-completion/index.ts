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

    // Get all active decks
    const { data: activeDecks, error: activeDecksError } = await supabaseClient
      .from("group_active_decks")
      .select("group_id, deck_id")
      .eq("status", "active")

    if (activeDecksError) throw activeDecksError

    const results: Array<{ group_id: string; deck_id: string; status: string }> = []

    for (const activeDeck of activeDecks || []) {
      // Get total number of questions in this deck
      const { data: deckPrompts, error: deckPromptsError } = await supabaseClient
        .from("prompts")
        .select("id")
        .eq("deck_id", activeDeck.deck_id)
        .not("deck_id", "is", null)

      if (deckPromptsError) {
        console.error(`[check-deck-completion] Error fetching deck prompts for deck ${activeDeck.deck_id}:`, deckPromptsError)
        continue
      }

      const totalQuestions = deckPrompts?.length || 0

      if (totalQuestions === 0) {
        console.warn(`[check-deck-completion] Deck ${activeDeck.deck_id} has no questions, skipping`)
        continue
      }

      // Get count of questions asked for this group/deck combination
      const { data: askedPrompts, error: askedPromptsError } = await supabaseClient
        .from("daily_prompts")
        .select("prompt_id")
        .eq("group_id", activeDeck.group_id)
        .eq("deck_id", activeDeck.deck_id)
        .is("user_id", null) // Only count general prompts

      if (askedPromptsError) {
        console.error(`[check-deck-completion] Error fetching asked prompts for group ${activeDeck.group_id}, deck ${activeDeck.deck_id}:`, askedPromptsError)
        continue
      }

      // Count unique prompts asked
      const uniqueAskedPrompts = new Set(askedPrompts?.map((p: any) => p.prompt_id) || [])
      const questionsAsked = uniqueAskedPrompts.size

      console.log(`[check-deck-completion] Deck ${activeDeck.deck_id} for group ${activeDeck.group_id}: ${questionsAsked}/${totalQuestions} questions asked`)

      // If all questions have been asked, mark as finished
      if (questionsAsked >= totalQuestions) {
        const { error: updateError } = await supabaseClient
          .from("group_active_decks")
          .update({
            status: "finished",
            finished_at: new Date().toISOString(),
          })
          .eq("group_id", activeDeck.group_id)
          .eq("deck_id", activeDeck.deck_id)
          .eq("status", "active")

        if (updateError) {
          console.error(`[check-deck-completion] Error marking deck as finished:`, updateError)
        } else {
          console.log(`[check-deck-completion] Marked deck ${activeDeck.deck_id} as finished for group ${activeDeck.group_id}`)
          results.push({
            group_id: activeDeck.group_id,
            deck_id: activeDeck.deck_id,
            status: "finished",
          })
        }
      } else {
        results.push({
          group_id: activeDeck.group_id,
          deck_id: activeDeck.deck_id,
          status: "active",
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked: results.length,
        finished: results.filter((r) => r.status === "finished").length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[check-deck-completion] Fatal error:", errorMessage)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    )
  }
})

