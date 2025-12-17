// @ts-expect-error - Deno URL imports are valid at runtime in Supabase Edge Functions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-expect-error - Deno URL imports are valid at runtime in Supabase Edge Functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    // Get all pending onboarding emails that are due to be sent
    const now = new Date().toISOString()
    const { data: pendingEmails, error: fetchError } = await supabaseClient
      .from("onboarding_email_schedule")
      .select("*")
      .eq("sent", false)
      .lte("scheduled_for", now)

    if (fetchError) {
      throw new Error(`Failed to fetch pending emails: ${fetchError.message}`)
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No pending emails to send",
          processed: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      )
    }

    let processed = 0
    let errors = 0

    // Process each pending email
    for (const emailSchedule of pendingEmails) {
      try {
        // Call the send-email Edge Function
        const { data: emailResponse, error: emailError } = await supabaseClient.functions.invoke(
          "send-email",
          {
            body: {
              email_type: emailSchedule.email_type,
              user_id: emailSchedule.user_id,
            },
          }
        )

        if (emailError) {
          console.error(
            `[process-onboarding-emails] Error sending email ${emailSchedule.email_type} to user ${emailSchedule.user_id}:`,
            emailError
          )
          errors++
          continue
        }

        // Mark email as sent
        const { error: updateError } = await supabaseClient
          .from("onboarding_email_schedule")
          .update({
            sent: true,
            sent_at: new Date().toISOString(),
          })
          .eq("id", emailSchedule.id)

        if (updateError) {
          console.error(
            `[process-onboarding-emails] Error updating email schedule ${emailSchedule.id}:`,
            updateError
          )
          errors++
          continue
        }

        processed++
        console.log(
          `[process-onboarding-emails] Successfully sent ${emailSchedule.email_type} to user ${emailSchedule.user_id}`
        )
      } catch (error) {
        console.error(
          `[process-onboarding-emails] Unexpected error processing email ${emailSchedule.id}:`,
          error
        )
        errors++
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processed} emails, ${errors} errors`,
        processed,
        errors,
        total: pendingEmails.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[process-onboarding-emails] Fatal error:", errorMessage)
    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    )
  }
})

