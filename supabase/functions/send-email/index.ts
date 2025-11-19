import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const RESEND_API_URL = "https://api.resend.com/emails"
const FROM_EMAIL = "Good Times <welcome@thegoodtimes.app>"

// Email template IDs (hardcoded)
const EMAIL_TEMPLATES = {
  welcome: "welcome-email",
} as const

type EmailType = keyof typeof EMAIL_TEMPLATES

interface EmailRequest {
  email_type: EmailType
  user_id?: string
  group_id?: string
  recipient_email?: string
  template_data?: Record<string, any>
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY environment variable is not set")
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    const body: EmailRequest = await req.json()
    const { email_type, user_id, group_id, recipient_email, template_data } = body

    if (!email_type) {
      throw new Error("email_type is required")
    }

    let finalRecipientEmail = recipient_email
    let finalTemplateData = template_data || {}

    // Fetch user and group data if not provided
    if (user_id) {
      const { data: user, error: userError } = await supabaseClient
        .from("users")
        .select("id, email, name")
        .eq("id", user_id)
        .single()

      if (userError) {
        console.error("[send-email] Error fetching user:", userError)
        throw new Error(`Failed to fetch user: ${userError.message}`)
      }

      if (!user) {
        throw new Error(`User not found: ${user_id}`)
      }

      // Use user email if recipient_email not provided
      if (!finalRecipientEmail) {
        finalRecipientEmail = user.email
      }

      // Add user name to template data
      if (user.name) {
        finalTemplateData.member_name = user.name
      }
    }

    // Fetch group data if group_id provided
    if (group_id) {
      const { data: group, error: groupError } = await supabaseClient
        .from("groups")
        .select("id, name, type")
        .eq("id", group_id)
        .single()

      if (groupError) {
        console.error("[send-email] Error fetching group:", groupError)
        throw new Error(`Failed to fetch group: ${groupError.message}`)
      }

      if (group) {
        // Add group name to template data
        finalTemplateData.group_name = group.name
      }
    }

    if (!finalRecipientEmail) {
      throw new Error("recipient_email is required or user_id must be provided")
    }

    // Get template ID
    const templateId = EMAIL_TEMPLATES[email_type]
    if (!templateId) {
      throw new Error(`Unknown email_type: ${email_type}`)
    }

    // Call Resend API
    const resendResponse = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [finalRecipientEmail],
        template_id: templateId,
        data: finalTemplateData,
      }),
    })

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text()
      console.error("[send-email] Resend API error:", errorText)
      throw new Error(`Resend API error: ${resendResponse.status} - ${errorText}`)
    }

    const resendData = await resendResponse.json()

    // Log email send (optional - can be added to email_logs table if needed)
    console.log("[send-email] Email sent successfully:", {
      email_type,
      recipient_email: finalRecipientEmail,
      resend_id: resendData.id,
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email sent successfully",
        resend_id: resendData.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[send-email] Fatal error:", errorMessage)
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

