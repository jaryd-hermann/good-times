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
    templateId: null, // Uses inline HTML
  },
  onboarding_day_2: {
    subject: "How's it going?",
    templateId: null, // Uses inline HTML
  },
  onboarding_day_3: {
    subject: "Did you know?",
    templateId: null, // Uses inline HTML
  },
  onboarding_day_4: {
    subject: "Building deeper connections",
    templateId: null, // Uses inline HTML
  },
  onboarding_day_5: {
    subject: "Making it a habit",
    templateId: null, // Uses inline HTML
  },
  onboarding_day_6: {
    subject: "Share the love!",
    templateId: null, // Uses inline HTML
  },
  onboarding_day_7: {
    subject: "You're all set! 🎊",
    templateId: null, // Uses inline HTML
  },
  birthday_card: {
    subject: "Your birthday card is ready! 🎂",
    templateId: "birthday-card-email", // Resend template ID
  },
  deck_suggestion: {
    subject: "Deck Suggestion from Good Times",
    templateId: null, // Uses inline HTML
  },
  featured_question_suggestion: {
    subject: "Featured Question Suggestion from Good Times",
    templateId: null, // Uses inline HTML
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #ffffff; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #000000;">
  <!-- Main container -->
  <div style="background-color: #000000; border-radius: 12px; overflow: hidden;">
    <!-- Content area -->
    <div style="padding: 40px 30px; background-color: #000000;">
      <p style="font-size: 18px; margin-bottom: 24px; color: #ffffff;">Hi ${memberName},</p>
      
      <p style="font-size: 16px; margin-bottom: 20px; color: #ffffff; line-height: 1.7;">
        ${welcomeMessage}
      </p>
      
      <p style="font-size: 16px; margin-bottom: 20px; color: #ffffff; line-height: 1.7;">
        Good Times helps you and your loved ones capture and share meaningful moments together. 
        You'll receive daily prompts to spark conversations and create lasting memories.
      </p>
      
      <!-- CTA Section -->
      <div style="background-color: #111111; border-left: 4px solid #D35E3C; padding: 20px; margin: 30px 0; border-radius: 4px;">
        <p style="font-size: 16px; margin: 0; color: #ffffff; font-weight: 600;">
          ✨ Get started by opening the app and responding to today's prompt!
        </p>
      </div>
      
      <!-- Features list -->
      <div style="margin: 30px 0;">
        <p style="font-size: 14px; font-weight: 600; color: #cccccc; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">What to expect:</p>
        <ul style="font-size: 15px; color: #ffffff; line-height: 1.8; padding-left: 20px; margin: 0;">
          <li style="margin-bottom: 8px;">Daily prompts delivered at 9 AM</li>
          <li style="margin-bottom: 8px;">Share photos, videos, or text responses</li>
          <li style="margin-bottom: 8px;">Build a beautiful timeline of memories</li>
        </ul>
      </div>
      
      <!-- Sign-off -->
      <div style="margin-top: 40px; text-align: left;">
        <p style="font-size: 16px; color: #ffffff; margin: 0 0 4px 0;">Have a good one!</p>
        <p style="font-size: 16px; color: #ffffff; margin: 0 0 20px 0;"><em>Jaryd</em></p>
        <p style="font-size: 14px; color: #ffffff; margin: 0;">
          <a href="goodtimes://feedback" style="color: #ffffff; text-decoration: underline;">Have feedback or an idea? Let me know</a>
        </p>
      </div>
    </div>
    
    <!-- Footer with wordmark -->
    <div style="background-color: #000000; padding: 30px; text-align: center; border-top: 1px solid #333333;">
      <img src="https://thegoodtimes.app/wordmark.png" alt="Good Times" style="max-width: 200px; height: auto; margin: 0 auto; display: block;" />
    </div>
  </div>
</body>
</html>
      `.trim()
    }
    case "onboarding_day_2": {
      const memberName = templateData.member_name || "there"
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Day 2 - Getting Started</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #ffffff; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #000000;">
  <div style="background-color: #000000; padding: 40px 30px;">
    <p style="font-size: 18px; margin-bottom: 20px; color: #ffffff;">Hi ${memberName},</p>
    <p style="font-size: 16px; margin-bottom: 20px; color: #ffffff;">
      We hope you're enjoying Good Times! Have you had a chance to respond to today's prompt yet?
    </p>
    <p style="font-size: 16px; margin-bottom: 20px; color: #ffffff;">
      Every day at 9 AM, you'll receive a new question designed to spark meaningful conversations with your group. 
      The best part? You can respond with text, photos, or videos to make your memories come alive.
    </p>
    <p style="font-size: 16px; margin-bottom: 30px; color: #ffffff;">
      If you haven't already, try responding to today's prompt and see how your group reacts!
    </p>
    <div style="margin-top: 40px; text-align: left;">
      <p style="font-size: 16px; color: #ffffff; margin: 0 0 4px 0;">Have a good one!</p>
      <p style="font-size: 16px; color: #ffffff; margin: 0 0 20px 0;"><em>Jaryd</em></p>
      <p style="font-size: 14px; color: #ffffff; margin: 0;">
        <a href="goodtimes://feedback" style="color: #ffffff; text-decoration: underline;">Have feedback or an idea? Let me know</a>
      </p>
    </div>
  </div>
  <div style="background-color: #000000; padding: 30px; text-align: center; border-top: 1px solid #333333;">
    <img src="https://thegoodtimes.app/wordmark.png" alt="Good Times" style="max-width: 200px; height: auto; margin: 0 auto; display: block;" />
  </div>
</body>
</html>
      `.trim()
    }
    case "onboarding_day_3": {
      const memberName = templateData.member_name || "there"
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Day 3 - Exploring Features</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #ffffff; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #000000;">
  <div style="background-color: #000000; padding: 40px 30px;">
    <p style="font-size: 18px; margin-bottom: 20px; color: #ffffff;">Hi ${memberName},</p>
    <p style="font-size: 16px; margin-bottom: 20px; color: #ffffff;">
      Good Times is more than just daily prompts! Here are some features you might not have discovered yet:
    </p>
    <ul style="font-size: 16px; margin-bottom: 20px; padding-left: 20px; color: #ffffff;">
      <li style="margin-bottom: 10px;"><strong style="color: #ffffff;">Browse History:</strong> Look back at all your shared memories organized by day, week, month, or year</li>
      <li style="margin-bottom: 10px;"><strong style="color: #ffffff;">React & Comment:</strong> Show love for entries with hearts and leave comments to keep the conversation going</li>
      <li style="margin-bottom: 10px;"><strong style="color: #ffffff;">Custom Decks:</strong> Suggest new question decks tailored to your group's interests</li>
    </ul>
    <p style="font-size: 16px; margin-bottom: 30px; color: #ffffff;">
      Take a moment to explore the app and see what else Good Times has to offer!
    </p>
    <div style="margin-top: 40px; text-align: left;">
      <p style="font-size: 16px; color: #ffffff; margin: 0 0 4px 0;">Have a good one!</p>
      <p style="font-size: 16px; color: #ffffff; margin: 0 0 20px 0;"><em>Jaryd</em></p>
      <p style="font-size: 14px; color: #ffffff; margin: 0;">
        <a href="goodtimes://feedback" style="color: #ffffff; text-decoration: underline;">Have feedback or an idea? Let me know</a>
      </p>
    </div>
  </div>
  <div style="background-color: #000000; padding: 30px; text-align: center; border-top: 1px solid #333333;">
    <img src="https://thegoodtimes.app/wordmark.png" alt="Good Times" style="max-width: 200px; height: auto; margin: 0 auto; display: block;" />
  </div>
</body>
</html>
      `.trim()
    }
    case "onboarding_day_4": {
      const memberName = templateData.member_name || "there"
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Day 4 - Building Connections</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #ffffff; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #000000;">
  <div style="background-color: #000000; padding: 40px 30px;">
    <p style="font-size: 18px; margin-bottom: 20px; color: #ffffff;">Hi ${memberName},</p>
    <p style="font-size: 16px; margin-bottom: 20px; color: #ffffff;">
      The magic of Good Times happens when everyone in your group participates. 
      When you share your responses, you're creating a shared story that grows richer with each contribution.
    </p>
    <p style="font-size: 16px; margin-bottom: 20px; color: #ffffff;">
      <strong style="color: #ffffff;">Tip:</strong> Try responding with a photo or video this week! Visual memories often spark the most meaningful conversations and reactions from your group.
    </p>
    <p style="font-size: 16px; margin-bottom: 30px; color: #ffffff;">
      Keep the momentum going - your group is counting on you! 💫
    </p>
    <div style="margin-top: 40px; text-align: left;">
      <p style="font-size: 16px; color: #ffffff; margin: 0 0 4px 0;">Have a good one!</p>
      <p style="font-size: 16px; color: #ffffff; margin: 0 0 20px 0;"><em>Jaryd</em></p>
      <p style="font-size: 14px; color: #ffffff; margin: 0;">
        <a href="goodtimes://feedback" style="color: #ffffff; text-decoration: underline;">Have feedback or an idea? Let me know</a>
      </p>
    </div>
  </div>
  <div style="background-color: #000000; padding: 30px; text-align: center; border-top: 1px solid #333333;">
    <img src="https://thegoodtimes.app/wordmark.png" alt="Good Times" style="max-width: 200px; height: auto; margin: 0 auto; display: block;" />
  </div>
</body>
</html>
      `.trim()
    }
    case "onboarding_day_5": {
      const memberName = templateData.member_name || "there"
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Day 5 - Making It a Habit</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #ffffff; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #000000;">
  <div style="background-color: #000000; padding: 40px 30px;">
    <p style="font-size: 18px; margin-bottom: 20px; color: #ffffff;">Hi ${memberName},</p>
    <p style="font-size: 16px; margin-bottom: 20px; color: #ffffff;">
      Consistency is key to building lasting memories. When you respond to prompts regularly, 
      you're creating a beautiful timeline of your shared experiences.
    </p>
    <p style="font-size: 16px; margin-bottom: 20px; color: #ffffff;">
      <strong style="color: #ffffff;">Pro tip:</strong> Set a daily reminder or make responding to prompts part of your morning routine. 
      Even a quick response is better than no response - your group will appreciate it!
    </p>
    <p style="font-size: 16px; margin-bottom: 30px; color: #ffffff;">
      You're doing great! Keep up the amazing work. 🌟
    </p>
    <div style="margin-top: 40px; text-align: left;">
      <p style="font-size: 16px; color: #ffffff; margin: 0 0 4px 0;">Have a good one!</p>
      <p style="font-size: 16px; color: #ffffff; margin: 0 0 20px 0;"><em>Jaryd</em></p>
      <p style="font-size: 14px; color: #ffffff; margin: 0;">
        <a href="goodtimes://feedback" style="color: #ffffff; text-decoration: underline;">Have feedback or an idea? Let me know</a>
      </p>
    </div>
  </div>
  <div style="background-color: #000000; padding: 30px; text-align: center; border-top: 1px solid #333333;">
    <img src="https://thegoodtimes.app/wordmark.png" alt="Good Times" style="max-width: 200px; height: auto; margin: 0 auto; display: block;" />
  </div>
</body>
</html>
      `.trim()
    }
    case "onboarding_day_6": {
      const memberName = templateData.member_name || "there"
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Day 6 - Invite Friends</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #ffffff; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #000000;">
  <div style="background-color: #000000; padding: 40px 30px;">
    <p style="font-size: 18px; margin-bottom: 20px; color: #ffffff;">Hi ${memberName},</p>
    <p style="font-size: 16px; margin-bottom: 20px; color: #ffffff;">
      The more people in your group, the richer your shared memories become! 
      Consider inviting more friends or family members to join your Good Times group.
    </p>
    <p style="font-size: 16px; margin-bottom: 20px; color: #ffffff;">
      You can invite people directly from the app - just look for the invite button in your group settings. 
      Each new member brings new perspectives and stories to your shared timeline.
    </p>
    <p style="font-size: 16px; margin-bottom: 30px; color: #ffffff;">
      Ready to grow your Good Times family? 🎉
    </p>
    <div style="margin-top: 40px; text-align: left;">
      <p style="font-size: 16px; color: #ffffff; margin: 0 0 4px 0;">Have a good one!</p>
      <p style="font-size: 16px; color: #ffffff; margin: 0 0 20px 0;"><em>Jaryd</em></p>
      <p style="font-size: 14px; color: #ffffff; margin: 0;">
        <a href="goodtimes://feedback" style="color: #ffffff; text-decoration: underline;">Have feedback or an idea? Let me know</a>
      </p>
    </div>
  </div>
  <div style="background-color: #000000; padding: 30px; text-align: center; border-top: 1px solid #333333;">
    <img src="https://thegoodtimes.app/wordmark.png" alt="Good Times" style="max-width: 200px; height: auto; margin: 0 auto; display: block;" />
  </div>
</body>
</html>
      `.trim()
    }
    case "onboarding_day_7": {
      const memberName = templateData.member_name || "there"
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Day 7 - You're All Set!</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #ffffff; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #000000;">
  <div style="background-color: #000000; padding: 40px 30px;">
    <p style="font-size: 18px; margin-bottom: 20px; color: #ffffff;">Hi ${memberName},</p>
    <p style="font-size: 16px; margin-bottom: 20px; color: #ffffff;">
      Congratulations! You've completed your first week with Good Times. 
      You now know everything you need to make the most of your shared memories.
    </p>
    <p style="font-size: 16px; margin-bottom: 20px; color: #ffffff;">
      From here on out, you'll continue receiving daily prompts at 9 AM. 
      Keep responding, keep sharing, and keep building those meaningful connections with your group.
    </p>
    <p style="font-size: 16px; margin-bottom: 20px; color: #ffffff;">
      If you ever have questions or feedback, we're here for you. 
      Just reply to this email - we'd love to hear from you!
    </p>
    <p style="font-size: 16px; margin-bottom: 30px; color: #ffffff;">
      Here's to many more good times ahead! 🥂
    </p>
    <div style="margin-top: 40px; text-align: left;">
      <p style="font-size: 16px; color: #ffffff; margin: 0 0 4px 0;">Have a good one!</p>
      <p style="font-size: 16px; color: #ffffff; margin: 0 0 20px 0;"><em>Jaryd</em></p>
      <p style="font-size: 14px; color: #ffffff; margin: 0;">
        <a href="goodtimes://feedback" style="color: #ffffff; text-decoration: underline;">Have feedback or an idea? Let me know</a>
      </p>
    </div>
  </div>
  <div style="background-color: #000000; padding: 30px; text-align: center; border-top: 1px solid #333333;">
    <img src="https://thegoodtimes.app/wordmark.png" alt="Good Times" style="max-width: 200px; height: auto; margin: 0 auto; display: block;" />
  </div>
</body>
</html>
      `.trim()
    }
    case "birthday_card": {
      const userName = templateData.user_name || "there"
      const groupType = templateData.group_type || "friends" // "friends" or "family"
      const contributorNames = templateData.contributor_names || []
      const cardLink = templateData.card_link || "#"
      
      // Personalize greeting based on group type
      const groupGreeting = groupType === "family" 
        ? "your family" 
        : "your friends"
      
      // Format contributor names
      let contributorsText = ""
      if (contributorNames.length === 0) {
        contributorsText = groupType === "family" ? "your family members" : "your friends"
      } else if (contributorNames.length === 1) {
        contributorsText = contributorNames[0]
      } else if (contributorNames.length === 2) {
        contributorsText = `${contributorNames[0]} and ${contributorNames[1]}`
      } else {
        const lastName = contributorNames[contributorNames.length - 1]
        const otherNames = contributorNames.slice(0, -1).join(", ")
        contributorsText = `${otherNames}, and ${lastName}`
      }
      
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Birthday Card is Ready!</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #000; color: #fff; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 28px;">🎂 Happy Birthday! 🎉</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 40px; border-radius: 0 0 8px 8px;">
    <p style="font-size: 18px; margin-bottom: 20px;">Hi ${userName},</p>
    <p style="font-size: 16px; margin-bottom: 20px;">
      ${contributorNames.length > 0 
        ? `<strong>${contributorsText}</strong> wrote you a special birthday card!` 
        : `You have a special birthday card from ${groupGreeting}!`}
    </p>
    <p style="font-size: 16px; margin-bottom: 30px;">
      Open the app to see the heartfelt messages ${groupType === "family" ? "your family" : "your friends"} left for you on your special day.
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${cardLink}" style="display: inline-block; background-color: #D35E3C; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
        View Your Birthday Card
      </a>
    </div>
    <p style="font-size: 14px; color: #666; margin-top: 30px; text-align: center;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${cardLink}" style="color: #D35E3C; word-break: break-all;">${cardLink}</a>
    </p>
    <div style="text-align: center; margin-top: 30px;">
      <p style="font-size: 14px; color: #666; margin: 0;">
        Have a wonderful birthday! 🎈
      </p>
    </div>
  </div>
</body>
</html>
      `.trim()
    }
    case "deck_suggestion": {
      // Escape HTML to prevent XSS
      const escapeHtml = (text: string) => {
        return String(text)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;")
      }
      
      const userName = escapeHtml(templateData.user_name || "User")
      const userEmail = escapeHtml(templateData.user_email || "No email")
      const groupName = escapeHtml(templateData.group_name || "Unknown Group")
      const groupId = escapeHtml(templateData.group_id || "Unknown")
      const suggestion = escapeHtml(templateData.suggestion || "")
      const sampleQuestion = escapeHtml(templateData.sample_question || "None provided")
      
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Deck Suggestion</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #000; color: #fff; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 28px;">Deck Suggestion</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 40px; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      <strong>User:</strong> ${userName}<br>
      <strong>Email:</strong> ${userEmail}<br>
      <strong>Group:</strong> ${groupName} (ID: ${groupId})
    </p>
    <div style="background-color: #fff; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #D35E3C;">
      <p style="font-size: 16px; margin: 0 0 10px 0;"><strong>Suggestion:</strong></p>
      <p style="font-size: 16px; margin: 0; white-space: pre-wrap;">${suggestion}</p>
    </div>
    <div style="background-color: #fff; padding: 20px; border-radius: 8px; border-left: 4px solid #666;">
      <p style="font-size: 16px; margin: 0 0 10px 0;"><strong>Sample Question:</strong></p>
      <p style="font-size: 16px; margin: 0; white-space: pre-wrap;">${sampleQuestion}</p>
    </div>
  </div>
</body>
</html>
      `.trim()
    }
    case "featured_question_suggestion": {
      // Escape HTML to prevent XSS
      const escapeHtml = (text: string) => {
        return String(text)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;")
      }
      
      const userName = escapeHtml(templateData.user_name || "User")
      const userEmail = escapeHtml(templateData.user_email || "No email")
      const groupName = escapeHtml(templateData.group_name || "Unknown Group")
      const groupId = escapeHtml(templateData.group_id || "Unknown")
      const questions = Array.isArray(templateData.questions) ? templateData.questions : []
      
      const questionsHTML = questions.map((q: string, idx: number) => {
        const escapedQ = escapeHtml(q)
        return `
        <div style="background-color: #fff; padding: 20px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #D35E3C;">
          <p style="font-size: 16px; margin: 0 0 10px 0;"><strong>Question ${idx + 1}:</strong></p>
          <p style="font-size: 16px; margin: 0; white-space: pre-wrap;">${escapedQ}</p>
        </div>
        `
      }).join("")
      
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Featured Question Suggestion</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #000; color: #fff; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 28px;">Featured Question Suggestion</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 40px; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      <strong>User:</strong> ${userName}<br>
      <strong>Email:</strong> ${userEmail}<br>
      <strong>Group:</strong> ${groupName} (ID: ${groupId})
    </p>
    ${questions.length > 0 ? `
    <div style="margin-top: 20px;">
      <p style="font-size: 18px; margin-bottom: 15px;"><strong>Suggested Questions:</strong></p>
      ${questionsHTML}
    </div>
    ` : `
    <div style="background-color: #fff; padding: 20px; border-radius: 8px; border-left: 4px solid #666;">
      <p style="font-size: 16px; margin: 0; color: #666;">No questions provided.</p>
    </div>
    `}
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

Have a good one!
*Jaryd*

Have feedback or an idea? Let me know: goodtimes://feedback
      `.trim()
    }
    case "onboarding_day_2": {
      const memberName = templateData.member_name || "there"
      return `
Hi ${memberName},

We hope you're enjoying Good Times! Have you had a chance to respond to today's prompt yet?

Every day at 9 AM, you'll receive a new question designed to spark meaningful conversations with your group. 
The best part? You can respond with text, photos, or videos to make your memories come alive.

If you haven't already, try responding to today's prompt and see how your group reacts!

Have a good one!
*Jaryd*

Have feedback or an idea? Let me know: goodtimes://feedback
      `.trim()
    }
    case "onboarding_day_3": {
      const memberName = templateData.member_name || "there"
      return `
Hi ${memberName},

Good Times is more than just daily prompts! Here are some features you might not have discovered yet:

• Browse History: Look back at all your shared memories organized by day, week, month, or year
• React & Comment: Show love for entries with hearts and leave comments to keep the conversation going
• Custom Decks: Suggest new question decks tailored to your group's interests

Take a moment to explore the app and see what else Good Times has to offer!

Have a good one!
*Jaryd*

Have feedback or an idea? Let me know: goodtimes://feedback
      `.trim()
    }
    case "onboarding_day_4": {
      const memberName = templateData.member_name || "there"
      return `
Hi ${memberName},

The magic of Good Times happens when everyone in your group participates. 
When you share your responses, you're creating a shared story that grows richer with each contribution.

Tip: Try responding with a photo or video this week! Visual memories often spark the most meaningful conversations and reactions from your group.

Keep the momentum going - your group is counting on you! 💫

Have a good one!
*Jaryd*

Have feedback or an idea? Let me know: goodtimes://feedback
      `.trim()
    }
    case "onboarding_day_5": {
      const memberName = templateData.member_name || "there"
      return `
Hi ${memberName},

Consistency is key to building lasting memories. When you respond to prompts regularly, 
you're creating a beautiful timeline of your shared experiences.

Pro tip: Set a daily reminder or make responding to prompts part of your morning routine. 
Even a quick response is better than no response - your group will appreciate it!

You're doing great! Keep up the amazing work. 🌟

Have a good one!
*Jaryd*

Have feedback or an idea? Let me know: goodtimes://feedback
      `.trim()
    }
    case "onboarding_day_6": {
      const memberName = templateData.member_name || "there"
      return `
Hi ${memberName},

The more people in your group, the richer your shared memories become! 
Consider inviting more friends or family members to join your Good Times group.

You can invite people directly from the app - just look for the invite button in your group settings. 
Each new member brings new perspectives and stories to your shared timeline.

Ready to grow your Good Times family? 🎉

Have a good one!
*Jaryd*

Have feedback or an idea? Let me know: goodtimes://feedback
      `.trim()
    }
    case "onboarding_day_7": {
      const memberName = templateData.member_name || "there"
      return `
Hi ${memberName},

Congratulations! You've completed your first week with Good Times. 
You now know everything you need to make the most of your shared memories.

From here on out, you'll continue receiving daily prompts at 9 AM. 
Keep responding, keep sharing, and keep building those meaningful connections with your group.

If you ever have questions or feedback, we're here for you. 
Just reply to this email - we'd love to hear from you!

Here's to many more good times ahead! 🥂

Have a good one!
*Jaryd*

Have feedback or an idea? Let me know: goodtimes://feedback
      `.trim()
    }
    case "birthday_card": {
      const userName = templateData.user_name || "there"
      const groupType = templateData.group_type || "friends" // "friends" or "family"
      const contributorNames = templateData.contributor_names || []
      const cardLink = templateData.card_link || "#"
      
      // Personalize greeting based on group type
      const groupGreeting = groupType === "family" 
        ? "your family" 
        : "your friends"
      
      // Format contributor names
      let contributorsText = ""
      if (contributorNames.length === 0) {
        contributorsText = groupType === "family" ? "your family members" : "your friends"
      } else if (contributorNames.length === 1) {
        contributorsText = contributorNames[0]
      } else if (contributorNames.length === 2) {
        contributorsText = `${contributorNames[0]} and ${contributorNames[1]}`
      } else {
        const lastName = contributorNames[contributorNames.length - 1]
        const otherNames = contributorNames.slice(0, -1).join(", ")
        contributorsText = `${otherNames}, and ${lastName}`
      }
      
      return `
Hi ${userName},

🎂 Happy Birthday! 🎉

${contributorNames.length > 0 
  ? `${contributorsText} wrote you a special birthday card!` 
  : `You have a special birthday card from ${groupGreeting}!`}

Open the app to see the heartfelt messages ${groupType === "family" ? "your family" : "your friends"} left for you on your special day.

View your card: ${cardLink}

Have a wonderful birthday! 🎈

- The Good Times Team
      `.trim()
    }
    case "deck_suggestion": {
      const userName = templateData.user_name || "User"
      const userEmail = templateData.user_email || "No email"
      const groupName = templateData.group_name || "Unknown Group"
      const groupId = templateData.group_id || "Unknown"
      const suggestion = templateData.suggestion || ""
      const sampleQuestion = templateData.sample_question || "None provided"
      
      return `
Deck Suggestion

User: ${userName}
Email: ${userEmail}
Group: ${groupName} (ID: ${groupId})

Suggestion:
${suggestion}

Sample Question:
${sampleQuestion}
      `.trim()
    }
    case "featured_question_suggestion": {
      const userName = templateData.user_name || "User"
      const userEmail = templateData.user_email || "No email"
      const groupName = templateData.group_name || "Unknown Group"
      const groupId = templateData.group_id || "Unknown"
      const questions = Array.isArray(templateData.questions) ? templateData.questions : []
      
      const questionsText = questions.length > 0
        ? questions.map((q: string, idx: number) => `Question ${idx + 1}:\n${q}`).join("\n\n")
        : "No questions provided."
      
      return `
Featured Question Suggestion

User: ${userName}
Email: ${userEmail}
Group: ${groupName} (ID: ${groupId})

Suggested Questions:
${questionsText}
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

    // For deck_suggestion and featured_question_suggestion emails, send to hermannjaryd@gmail.com instead of user email
    if (email_type === "deck_suggestion" || email_type === "featured_question_suggestion") {
      finalRecipientEmail = "hermannjaryd@gmail.com"
    } else if (!finalRecipientEmail) {
      throw new Error("recipient_email is required or user_id must be provided")
    }

    // Validate email type
    if (!EMAIL_TEMPLATES[email_type]) {
      throw new Error(`Unknown email_type: ${email_type}`)
    }

    const templateConfig = EMAIL_TEMPLATES[email_type]
    const subject = templateConfig.subject

    // Prepare Resend API request body
    let requestBody: any = {
      from: FROM_EMAIL,
      to: [finalRecipientEmail],
      subject: subject,
    }

    // Use Resend template if configured, otherwise use inline HTML
    if (templateConfig.templateId) {
      // Use Resend template
      requestBody.template = {
        id: templateConfig.templateId,
        variables: finalTemplateData,
      }
    } else {
      // Use inline HTML/text (for welcome email)
      const htmlContent = generateEmailHTML(email_type, finalTemplateData)
      const textContent = generateEmailText(email_type, finalTemplateData)
      requestBody.html = htmlContent
      requestBody.text = textContent
    }

    // Call Resend API
    const resendResponse = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text()
      console.error("[send-email] Resend API error:", errorText)
      throw new Error(`Resend API error: ${resendResponse.status} - ${errorText}`)
    }

    const resendData = await resendResponse.json()

    // Log email send to email_logs table
    if (user_id) {
      const { error: logError } = await supabaseClient
        .from("email_logs")
        .insert({
          user_id: user_id,
          email_type: email_type,
          resend_id: resendData.id,
          template_data: finalTemplateData,
        })

      if (logError) {
        console.error("[send-email] Error logging email:", logError)
        // Don't fail the request if logging fails
      }
    }

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

