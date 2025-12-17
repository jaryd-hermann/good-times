#!/usr/bin/env tsx
/**
 * Email Preview Generator
 * 
 * Generates HTML files for all email templates so you can preview them in a browser
 * without sending actual emails.
 * 
 * Usage: tsx scripts/preview-emails.ts
 */

import * as fs from 'fs'
import * as path from 'path'

// Copy of email template generation logic from send-email/index.ts
type EmailType = 
  | 'welcome' 
  | 'onboarding_day_2' 
  | 'onboarding_day_3' 
  | 'onboarding_day_4' 
  | 'onboarding_day_5' 
  | 'onboarding_day_6' 
  | 'onboarding_day_7'
  | 'birthday_card'
  | 'deck_suggestion'
  | 'featured_question_suggestion'

function generateEmailHTML(emailType: EmailType, templateData: Record<string, any>): string {
  switch (emailType) {
    case "welcome": {
      const memberName = templateData.member_name || "Alex"
      const groupName = templateData.group_name || "The Smith Family"
      
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
  <div style="background-color: #000000; border-radius: 12px; overflow: hidden;">
    <div style="padding: 40px 30px; background-color: #000000;">
      <p style="font-size: 18px; margin-bottom: 24px; color: #ffffff;">Hi ${memberName},</p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #ffffff; line-height: 1.7;">
        ${welcomeMessage}
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #ffffff; line-height: 1.7;">
        Good Times helps you and your loved ones capture and share meaningful moments together. 
        You'll receive daily prompts to spark conversations and create lasting memories.
      </p>
      <div style="background-color: #111111; border-left: 4px solid #de2f08; padding: 20px; margin: 30px 0; border-radius: 4px;">
        <p style="font-size: 16px; margin: 0; color: #ffffff; font-weight: 600;">
          ✨ Get started by opening the app and responding to today's prompt!
        </p>
      </div>
      <div style="margin: 30px 0;">
        <p style="font-size: 14px; font-weight: 600; color: #cccccc; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">What to expect:</p>
        <ul style="font-size: 15px; color: #ffffff; line-height: 1.8; padding-left: 20px; margin: 0;">
          <li style="margin-bottom: 8px;">Daily prompts delivered at 9 AM</li>
          <li style="margin-bottom: 8px;">Share photos, videos, or text responses</li>
          <li style="margin-bottom: 8px;">Build a beautiful timeline of memories</li>
        </ul>
      </div>
      <div style="margin-top: 40px; text-align: left;">
        <p style="font-size: 16px; color: #ffffff; margin: 0 0 4px 0;">Have a good one!</p>
        <p style="font-size: 16px; color: #ffffff; margin: 0 0 20px 0;"><em>Jaryd</em></p>
        <p style="font-size: 14px; color: #ffffff; margin: 0;">
          <a href="goodtimes://feedback" style="color: #ffffff; text-decoration: underline;">Have feedback or an idea? Let me know</a>
        </p>
      </div>
    </div>
    <div style="background-color: #000000; padding: 30px; text-align: center; border-top: 1px solid #333333;">
      <img src="wordmark.png" alt="Good Times" style="max-width: 200px; height: auto; margin: 0 auto; display: block;" />
    </div>
  </div>
</body>
</html>
      `.trim()
    }
    case "onboarding_day_2": {
      const memberName = templateData.member_name || "Alex"
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Day 2 - Getting Started</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background-color: #000; color: #fff; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 28px;">How's it going, ${memberName}?</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 40px; border-radius: 0 0 8px 8px;">
    <p style="font-size: 18px; margin-bottom: 20px;">Hi ${memberName},</p>
    <p style="font-size: 16px; margin-bottom: 20px;">
      We hope you're enjoying Good Times! Have you had a chance to respond to today's prompt yet?
    </p>
    <p style="font-size: 16px; margin-bottom: 20px;">
      Every day at 9 AM, you'll receive a new question designed to spark meaningful conversations with your group. 
      The best part? You can respond with text, photos, or videos to make your memories come alive.
    </p>
    <p style="font-size: 16px; margin-bottom: 30px;">
      If you haven't already, try responding to today's prompt and see how your group reacts!
    </p>
    <div style="text-align: center; margin-top: 30px;">
      <p style="font-size: 14px; color: #666; margin: 0;">
        Happy sharing! ✨
      </p>
    </div>
  </div>
</body>
</html>
      `.trim()
    }
    case "onboarding_day_3": {
      const memberName = templateData.member_name || "Alex"
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Day 3 - Exploring Features</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background-color: #000; color: #fff; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 28px;">Did you know?</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 40px; border-radius: 0 0 8px 8px;">
    <p style="font-size: 18px; margin-bottom: 20px;">Hi ${memberName},</p>
    <p style="font-size: 16px; margin-bottom: 20px;">
      Good Times is more than just daily prompts! Here are some features you might not have discovered yet:
    </p>
    <ul style="font-size: 16px; margin-bottom: 20px; padding-left: 20px;">
      <li style="margin-bottom: 10px;"><strong>Browse History:</strong> Look back at all your shared memories organized by day, week, month, or year</li>
      <li style="margin-bottom: 10px;"><strong>React & Comment:</strong> Show love for entries with hearts and leave comments to keep the conversation going</li>
      <li style="margin-bottom: 10px;"><strong>Custom Decks:</strong> Suggest new question decks tailored to your group's interests</li>
    </ul>
    <p style="font-size: 16px; margin-bottom: 30px;">
      Take a moment to explore the app and see what else Good Times has to offer!
    </p>
    <div style="text-align: center; margin-top: 30px;">
      <p style="font-size: 14px; color: #666; margin: 0;">
        Happy exploring! 🚀
      </p>
    </div>
  </div>
</body>
</html>
      `.trim()
    }
    case "onboarding_day_4": {
      const memberName = templateData.member_name || "Alex"
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Day 4 - Building Connections</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background-color: #000; color: #fff; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 28px;">Building deeper connections</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 40px; border-radius: 0 0 8px 8px;">
    <p style="font-size: 18px; margin-bottom: 20px;">Hi ${memberName},</p>
    <p style="font-size: 16px; margin-bottom: 20px;">
      The magic of Good Times happens when everyone in your group participates. 
      When you share your responses, you're creating a shared story that grows richer with each contribution.
    </p>
    <p style="font-size: 16px; margin-bottom: 20px;">
      <strong>Tip:</strong> Try responding with a photo or video this week! Visual memories often spark the most meaningful conversations and reactions from your group.
    </p>
    <p style="font-size: 16px; margin-bottom: 30px;">
      Keep the momentum going - your group is counting on you! 💫
    </p>
    <div style="text-align: center; margin-top: 30px;">
      <p style="font-size: 14px; color: #666; margin: 0;">
        Keep sharing! 📸
      </p>
    </div>
  </div>
</body>
</html>
      `.trim()
    }
    case "onboarding_day_5": {
      const memberName = templateData.member_name || "Alex"
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Day 5 - Making It a Habit</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background-color: #000; color: #fff; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 28px;">Making it a habit</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 40px; border-radius: 0 0 8px 8px;">
    <p style="font-size: 18px; margin-bottom: 20px;">Hi ${memberName},</p>
    <p style="font-size: 16px; margin-bottom: 20px;">
      Consistency is key to building lasting memories. When you respond to prompts regularly, 
      you're creating a beautiful timeline of your shared experiences.
    </p>
    <p style="font-size: 16px; margin-bottom: 20px;">
      <strong>Pro tip:</strong> Set a daily reminder or make responding to prompts part of your morning routine. 
      Even a quick response is better than no response - your group will appreciate it!
    </p>
    <p style="font-size: 16px; margin-bottom: 30px;">
      You're doing great! Keep up the amazing work. 🌟
    </p>
    <div style="text-align: center; margin-top: 30px;">
      <p style="font-size: 14px; color: #666; margin: 0;">
        You've got this! 💪
      </p>
    </div>
  </div>
</body>
</html>
      `.trim()
    }
    case "onboarding_day_6": {
      const memberName = templateData.member_name || "Alex"
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Day 6 - Invite Friends</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background-color: #000; color: #fff; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 28px;">Share the love!</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 40px; border-radius: 0 0 8px 8px;">
    <p style="font-size: 18px; margin-bottom: 20px;">Hi ${memberName},</p>
    <p style="font-size: 16px; margin-bottom: 20px;">
      The more people in your group, the richer your shared memories become! 
      Consider inviting more friends or family members to join your Good Times group.
    </p>
    <p style="font-size: 16px; margin-bottom: 20px;">
      You can invite people directly from the app - just look for the invite button in your group settings. 
      Each new member brings new perspectives and stories to your shared timeline.
    </p>
    <p style="font-size: 16px; margin-bottom: 30px;">
      Ready to grow your Good Times family? 🎉
    </p>
    <div style="text-align: center; margin-top: 30px;">
      <p style="font-size: 14px; color: #666; margin: 0;">
        Spread the joy! 🌈
      </p>
    </div>
  </div>
</body>
</html>
      `.trim()
    }
    case "onboarding_day_7": {
      const memberName = templateData.member_name || "Alex"
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Day 7 - You're All Set!</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background-color: #000; color: #fff; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 28px;">You're all set! 🎊</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 40px; border-radius: 0 0 8px 8px;">
    <p style="font-size: 18px; margin-bottom: 20px;">Hi ${memberName},</p>
    <p style="font-size: 16px; margin-bottom: 20px;">
      Congratulations! You've completed your first week with Good Times. 
      You now know everything you need to make the most of your shared memories.
    </p>
    <p style="font-size: 16px; margin-bottom: 20px;">
      From here on out, you'll continue receiving daily prompts at 9 AM. 
      Keep responding, keep sharing, and keep building those meaningful connections with your group.
    </p>
    <p style="font-size: 16px; margin-bottom: 20px;">
      If you ever have questions or feedback, we're here for you. 
      Just reply to this email - we'd love to hear from you!
    </p>
    <p style="font-size: 16px; margin-bottom: 30px;">
      Here's to many more good times ahead! 🥂
    </p>
    <div style="text-align: center; margin-top: 30px;">
      <p style="font-size: 14px; color: #666; margin: 0;">
        With love,<br>The Good Times Team ❤️
      </p>
    </div>
  </div>
</body>
</html>
      `.trim()
    }
    default:
      return `<html><body><p>Template not found for: ${emailType}</p></body></html>`
  }
}

// Generate preview files
const outputDir = path.join(process.cwd(), 'email-previews')
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

const emailTypes: EmailType[] = [
  'welcome',
  'onboarding_day_2',
  'onboarding_day_3',
  'onboarding_day_4',
  'onboarding_day_5',
  'onboarding_day_6',
  'onboarding_day_7',
]

const sampleData = {
  member_name: 'Alex',
  group_name: 'The Smith Family',
  user_name: 'Alex',
  group_type: 'family',
}

console.log('Generating email previews...\n')

emailTypes.forEach((emailType) => {
  const html = generateEmailHTML(emailType, sampleData)
  const filename = `${emailType}.html`
  const filepath = path.join(outputDir, filename)
  
  fs.writeFileSync(filepath, html, 'utf-8')
  console.log(`✓ Generated: ${filename}`)
})

console.log(`\n✅ All email previews generated in: ${outputDir}`)
console.log(`\nOpen the HTML files in your browser to preview the emails!`)
console.log(`\nTip: You can use "open email-previews/welcome.html" (Mac) or just double-click the files.`)

