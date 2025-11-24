// @ts-expect-error - Deno URL imports are valid at runtime in Supabase Edge Functions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-expect-error - Deno URL imports are valid at runtime in Supabase Edge Functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const RESEND_API_URL = "https://api.resend.com/emails"
const FROM_EMAIL = "Good Times <welcome@thegoodtimes.app>"

// Email template configurations
const EMAIL_TEMPLATES = {
  welcome: {
    subject: "Welcome to Good Times!",
  },
} as const

type EmailType = keyof typeof EMAIL_TEMPLATES

// Generate HTML email content for each email type
function generateEmailHTML(emailType: EmailType, templateData: Record<string, any>): string {
  switch (emailType) {
    case "welcome": {
      const memberName = templateData.member_name || "there"
      const groupName = templateData.group_name
      
      // Build welcome message - handle both cases: with group name and without
      const welcomeMessage = groupName 
        ? `Welcome to Good Times! We're so excited to have you join <strong>${groupName}</strong>.`
        : `Welcome to Good Times! We're so excited to have you join us.`
      
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Good Times</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #000; color: #fff; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 28px;">Welcome to Good Times!</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 40px; border-radius: 0 0 8px 8px;">
    <p style="font-size: 18px; margin-bottom: 20px;">Hi ${memberName},</p>
    <p style="font-size: 16px; margin-bottom: 20px;">
      ${welcomeMessage}
    </p>
    <p style="font-size: 16px; margin-bottom: 20px;">
      Good Times helps you and your loved ones capture and share meaningful moments together. 
      You'll receive daily prompts to spark conversations and create lasting memories.
    </p>
    <p style="font-size: 16px; margin-bottom: 30px;">
      Get started by opening the app and responding to today's prompt!
    </p>
    <div style="text-align: center; margin-top: 30px;">
      <p style="font-size: 14px; color: #666; margin: 0;">
        Thanks for being part of the Good Times community! 🎉
      </p>
    </div>
  </div>
</body>
</html>
      `.trim()
    }
    default:
      throw new Error(`No HTML template defined for email type: ${emailType}`)
  }
}

// Generate plain text email content for each email type
function generateEmailText(emailType: EmailType, templateData: Record<string, any>): string {
  switch (emailType) {
    case "welcome": {
      const memberName = templateData.member_name || "there"
      const groupName = templateData.group_name
      
      // Build welcome message - handle both cases: with group name and without
      const welcomeMessage = groupName 
        ? `Welcome to Good Times! We're so excited to have you join ${groupName}.`
        : `Welcome to Good Times! We're so excited to have you join us.`
      
      return `
Hi ${memberName},

${welcomeMessage}

Good Times helps you and your loved ones capture and share meaningful moments together. 
You'll receive daily prompts to spark conversations and create lasting memories.

Get started by opening the app and responding to today's prompt!

Thanks for being part of the Good Times community! 🎉

- The Good Times Team
      `.trim()
    }
    default:
      throw new Error(`No text template defined for email type: ${emailType}`)
  }
}

interface EmailRequest {
  email_type: EmailType
  user_id?: string
  group_id?: string
  recipient_email?: string
  template_data?: Record<string, any>
}

serve(async (req: Request) => {
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
    // Note: We don't throw errors here - we still want to send welcome email even if group fetch fails
    if (group_id) {
      const { data: group, error: groupError } = await supabaseClient
        .from("groups")
        .select("id, name, type")
        .eq("id", group_id)
        .single()

      if (groupError) {
        // Log error but don't fail - still send welcome email without group name
        console.error("[send-email] Error fetching group (will send email without group name):", groupError)
      } else if (group) {
        // Add group name to template data
        finalTemplateData.group_name = group.name
      }
    }

    if (!finalRecipientEmail) {
      throw new Error("recipient_email is required or user_id must be provided")
    }

    // Validate email type
    if (!EMAIL_TEMPLATES[email_type]) {
      throw new Error(`Unknown email_type: ${email_type}`)
    }

    // Generate email content
    const htmlContent = generateEmailHTML(email_type, finalTemplateData)
    const textContent = generateEmailText(email_type, finalTemplateData)
    const subject = EMAIL_TEMPLATES[email_type].subject

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
        subject: subject,
        html: htmlContent,
        text: textContent,
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

