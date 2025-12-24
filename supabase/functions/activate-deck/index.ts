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

    const { group_id, deck_id } = await req.json()

    if (!group_id || !deck_id) {
      throw new Error("group_id and deck_id are required")
    }

    // Get the active deck record
    const { data: activeDeck, error: activeDeckError } = await supabaseClient
      .from("group_active_decks")
      .select("*, requested_by")
      .eq("group_id", group_id)
      .eq("deck_id", deck_id)
      .eq("status", "voting")
      .single()

    if (activeDeckError) throw activeDeckError
    if (!activeDeck) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No active voting found for this deck" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      )
    }

    // Get all group members (for calculating majority)
    const { data: members, error: membersError } = await supabaseClient
      .from("group_members")
      .select("user_id")
      .eq("group_id", group_id)

    if (membersError) throw membersError
    if (!members || members.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No members found in group" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      )
    }

    const totalMembers = members.length
    const majorityThreshold = Math.ceil(totalMembers / 2) // 50%+1

    // Get all votes for this deck
    const { data: votes, error: votesError } = await supabaseClient
      .from("group_deck_votes")
      .select("user_id, vote")
      .eq("group_id", group_id)
      .eq("deck_id", deck_id)

    if (votesError) throw votesError

    // Count votes
    let yesVotes = 0
    let noVotes = 0
    
    // The requester automatically votes yes (if not already voted)
    const requesterVoted = votes?.some((v: any) => v.user_id === activeDeck.requested_by)
    if (!requesterVoted) {
      yesVotes = 1 // Count requester's automatic yes vote
    }

    votes?.forEach((vote: any) => {
      if (vote.vote === "yes") {
        yesVotes++
      } else if (vote.vote === "no") {
        noVotes++
      }
    })

    console.log(`[activate-deck] Vote counts for deck ${deck_id}: ${yesVotes} yes, ${noVotes} no (threshold: ${majorityThreshold}, total members: ${totalMembers})`)

    // Check if majority has voted yes
    if (yesVotes >= majorityThreshold) {
      // CRITICAL: Check if group already has 3 active decks (limit is 3)
      const { data: activeDecks, error: activeDecksError } = await supabaseClient
        .from("group_active_decks")
        .select("id")
        .eq("group_id", group_id)
        .eq("status", "active")

      if (activeDecksError) throw activeDecksError
      if (activeDecks && activeDecks.length >= 3) {
        // Reject this deck instead of activating (group already has 3 active decks)
        const { error: rejectError } = await supabaseClient
          .from("group_active_decks")
          .update({
            status: "rejected",
          })
          .eq("group_id", group_id)
          .eq("deck_id", deck_id)

        if (rejectError) throw rejectError

        console.log(`[activate-deck] Deck ${deck_id} rejected for group ${group_id} - group already has 3 active decks`)

        return new Response(
          JSON.stringify({
            success: false,
            status: "rejected",
            error: "Group already has 3 active decks. Please finish or remove a deck before adding another.",
            yes_votes: yesVotes,
            no_votes: noVotes,
            total_members: totalMembers,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        )
      }

      // Activate the deck
      const { error: updateError } = await supabaseClient
        .from("group_active_decks")
        .update({
          status: "active",
          activated_at: new Date().toISOString(),
        })
        .eq("group_id", group_id)
        .eq("deck_id", deck_id)

      if (updateError) throw updateError

      console.log(`[activate-deck] Deck ${deck_id} activated for group ${group_id}`)

      // Track deck_activated event in PostHog
      try {
        // Get deck and collection details for event properties
        const { data: deckData } = await supabaseClient
          .from("decks")
          .select("name, collection_id")
          .eq("id", deck_id)
          .single()

        let collectionName: string | undefined
        if (deckData?.collection_id) {
          const { data: collectionData } = await supabaseClient
            .from("collections")
            .select("name")
            .eq("id", deckData.collection_id)
            .single()
          collectionName = collectionData?.name
        }

        // Send event to PostHog HTTP API
        const posthogApiKey = Deno.env.get("POSTHOG_API_KEY")
        const posthogHost = Deno.env.get("POSTHOG_HOST") || "https://us.i.posthog.com"
        
        if (posthogApiKey) {
          await fetch(`${posthogHost}/capture/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              api_key: posthogApiKey,
              event: "deck_activated",
              properties: {
                deck_id: deck_id,
                deck_name: deckData?.name,
                collection_id: deckData?.collection_id,
                collection_name: collectionName,
                group_id: group_id,
                yes_votes: yesVotes,
                no_votes: noVotes,
                total_members: totalMembers,
              },
              distinct_id: `group_${group_id}`, // Use group as distinct_id for server-side events
            }),
          })
          console.log(`[activate-deck] Tracked deck_activated event in PostHog`)
        }
      } catch (posthogError) {
        console.error(`[activate-deck] Error tracking PostHog event:`, posthogError)
        // Don't throw - activation succeeded
      }

      // Regenerate queue to include the new deck
      try {
        const { error: regenerateError } = await supabaseClient.functions.invoke("regenerate-queue-with-packs", {
          body: { group_id },
        })

        if (regenerateError) {
          console.error(`[activate-deck] Error regenerating queue:`, regenerateError)
          // Don't throw - activation succeeded, queue can be regenerated later
        } else {
          console.log(`[activate-deck] Queue regenerated successfully`)
        }
      } catch (regenerateErr) {
        console.error(`[activate-deck] Exception regenerating queue:`, regenerateErr)
        // Don't throw - activation succeeded
      }

      // Send notification to the requester
      try {
        const { error: notifyError } = await supabaseClient
          .from("notifications")
          .insert({
            user_id: activeDeck.requested_by,
            type: "deck_activated",
            title: "Deck Activated",
            body: "Your group voted yes! The deck has been added to your question rotation.",
            data: {
              group_id,
              deck_id,
            },
          })

        if (notifyError) {
          console.error(`[activate-deck] Error sending notification:`, notifyError)
          // Don't throw - activation succeeded
        }
      } catch (notifyErr) {
        console.error(`[activate-deck] Exception sending notification:`, notifyErr)
        // Don't throw - activation succeeded
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: "active",
          yes_votes: yesVotes,
          no_votes: noVotes,
          total_members: totalMembers,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Check if majority has voted no (or tie goes to activation per requirements)
    // Actually, per requirements: "If there is a tie in a condition like that, it activates"
    // So we only reject if noVotes > yesVotes (strict majority no)
    if (noVotes > yesVotes) {
      // Reject the deck
      const { error: updateError } = await supabaseClient
        .from("group_active_decks")
        .update({
          status: "rejected",
        })
        .eq("group_id", group_id)
        .eq("deck_id", deck_id)

      if (updateError) throw updateError

      console.log(`[activate-deck] Deck ${deck_id} rejected for group ${group_id}`)

      // Track deck_rejected event in PostHog
      try {
        // Get deck and collection details for event properties
        const { data: deckData } = await supabaseClient
          .from("decks")
          .select("name, collection_id")
          .eq("id", deck_id)
          .single()

        let collectionName: string | undefined
        if (deckData?.collection_id) {
          const { data: collectionData } = await supabaseClient
            .from("collections")
            .select("name")
            .eq("id", deckData.collection_id)
            .single()
          collectionName = collectionData?.name
        }

        // Send event to PostHog HTTP API
        const posthogApiKey = Deno.env.get("POSTHOG_API_KEY")
        const posthogHost = Deno.env.get("POSTHOG_HOST") || "https://us.i.posthog.com"
        
        if (posthogApiKey) {
          await fetch(`${posthogHost}/capture/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              api_key: posthogApiKey,
              event: "deck_rejected",
              properties: {
                deck_id: deck_id,
                deck_name: deckData?.name,
                collection_id: deckData?.collection_id,
                collection_name: collectionName,
                group_id: group_id,
                yes_votes: yesVotes,
                no_votes: noVotes,
                total_members: totalMembers,
              },
              distinct_id: `group_${group_id}`, // Use group as distinct_id for server-side events
            }),
          })
          console.log(`[activate-deck] Tracked deck_rejected event in PostHog`)
        }
      } catch (posthogError) {
        console.error(`[activate-deck] Error tracking PostHog event:`, posthogError)
        // Don't throw - rejection succeeded
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: "rejected",
          yes_votes: yesVotes,
          no_votes: noVotes,
          total_members: totalMembers,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Still voting - not enough votes yet
    return new Response(
      JSON.stringify({
        success: true,
        status: "voting",
        yes_votes: yesVotes,
        no_votes: noVotes,
        total_members: totalMembers,
        majority_threshold: majorityThreshold,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[activate-deck] Fatal error:", errorMessage)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    )
  }
})

