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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #000000; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #F5F0EA;">
  <div style="background-color: #F5F0EA; border-radius: 12px; overflow: hidden;">
    <div style="padding: 40px 30px; background-color: #F5F0EA;">
      <p style="font-size: 18px; margin-bottom: 24px; color: #000000;">Hi ${memberName},</p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        ${welcomeMessage}
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        Good Times helps you and your loved ones capture and share meaningful moments together. 
        You'll receive daily prompts to spark conversations and create lasting memories.
      </p>
      <div style="background-color: #F5F0EA; border-left: 4px solid #D97393; padding: 20px; margin: 30px 0; border-radius: 4px;">
        <p style="font-size: 16px; margin: 0; color: #000000; font-weight: 600;">
          ✨ Get started by opening the app and responding to today's prompt!
        </p>
      </div>
      <div style="margin: 30px 0;">
        <p style="font-size: 14px; font-weight: 600; color: #404040; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">What to expect:</p>
        <ul style="font-size: 15px; color: #000000; line-height: 1.8; padding-left: 20px; margin: 0;">
          <li style="margin-bottom: 8px;">Daily prompts delivered at 9 AM</li>
          <li style="margin-bottom: 8px;">Share photos, videos, or text responses</li>
          <li style="margin-bottom: 8px;">Build a beautiful timeline of memories</li>
        </ul>
      </div>
      <div style="margin-top: 40px; text-align: left;">
        <p style="font-size: 16px; color: #000000; margin: 0 0 4px 0;">Have a good one!</p>
        <p style="font-size: 16px; color: #000000; margin: 0 0 20px 0;"><em>Jaryd</em></p>
        <p style="font-size: 14px; color: #000000; margin: 0;">
          <a href="goodtimes://feedback" style="color: #E8A037; text-decoration: underline;">Have feedback or an idea? Let me know</a>
        </p>
      </div>
    </div>
    <div style="background-color: #F5F0EA; padding: 30px; text-align: center; border-top: 1px solid #E8E0D5;">
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #000000; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #F5F0EA;">
  <div style="background-color: #F5F0EA; border-radius: 12px; overflow: hidden;">
    <div style="padding: 40px 30px; background-color: #F5F0EA;">
      <p style="font-size: 18px; margin-bottom: 24px; color: #000000;">Hi ${memberName},</p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        We hope you're enjoying Good Times! Have you had a chance to respond to today's prompt yet?
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        Every day at 9 AM, you'll receive a new question designed to spark meaningful conversations with your group. 
        The best part? You can respond with text, photos, or videos to make your memories come alive.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        If you haven't already, try responding to today's prompt and see how your group reacts!
      </p>
      <div style="margin-top: 40px; text-align: left;">
        <p style="font-size: 16px; color: #000000; margin: 0 0 4px 0;">Have a good one!</p>
        <p style="font-size: 16px; color: #000000; margin: 0 0 20px 0;"><em>Jaryd</em></p>
        <p style="font-size: 14px; color: #000000; margin: 0;">
          <a href="goodtimes://feedback" style="color: #E8A037; text-decoration: underline;">Have feedback or an idea? Let me know</a>
        </p>
      </div>
    </div>
    <div style="background-color: #F5F0EA; padding: 30px; text-align: center; border-top: 1px solid #E8E0D5;">
      <img src="wordmark.png" alt="Good Times" style="max-width: 200px; height: auto; margin: 0 auto; display: block;" />
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #000000; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #F5F0EA;">
  <div style="background-color: #F5F0EA; border-radius: 12px; overflow: hidden;">
    <div style="padding: 40px 30px; background-color: #F5F0EA;">
      <p style="font-size: 18px; margin-bottom: 24px; color: #000000;">Hi ${memberName},</p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        Good Times is more than just daily prompts! Here are some features you might not have discovered yet:
      </p>
      <ul style="font-size: 15px; color: #000000; line-height: 1.8; padding-left: 20px; margin: 0;">
        <li style="margin-bottom: 8px;"><strong style="color: #000000;">Browse History:</strong> Look back at all your shared memories organized by day, week, month, or year</li>
        <li style="margin-bottom: 8px;"><strong style="color: #000000;">React & Comment:</strong> Show love for entries with hearts and leave comments to keep the conversation going</li>
        <li style="margin-bottom: 8px;"><strong style="color: #000000;">Custom Decks:</strong> Suggest new question decks tailored to your group's interests</li>
      </ul>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        Take a moment to explore the app and see what else Good Times has to offer!
      </p>
      <div style="margin-top: 40px; text-align: left;">
        <p style="font-size: 16px; color: #000000; margin: 0 0 4px 0;">Have a good one!</p>
        <p style="font-size: 16px; color: #000000; margin: 0 0 20px 0;"><em>Jaryd</em></p>
        <p style="font-size: 14px; color: #000000; margin: 0;">
          <a href="goodtimes://feedback" style="color: #E8A037; text-decoration: underline;">Have feedback or an idea? Let me know</a>
        </p>
      </div>
    </div>
    <div style="background-color: #F5F0EA; padding: 30px; text-align: center; border-top: 1px solid #E8E0D5;">
      <img src="wordmark.png" alt="Good Times" style="max-width: 200px; height: auto; margin: 0 auto; display: block;" />
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #000000; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #F5F0EA;">
  <div style="background-color: #F5F0EA; border-radius: 12px; overflow: hidden;">
    <div style="padding: 40px 30px; background-color: #F5F0EA;">
      <p style="font-size: 18px; margin-bottom: 24px; color: #000000;">Hi ${memberName},</p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        The magic of Good Times happens when everyone in your group participates. 
        When you share your responses, you're creating a shared story that grows richer with each contribution.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        <strong style="color: #000000;">Tip:</strong> Try responding with a photo or video this week! Visual memories often spark the most meaningful conversations and reactions from your group.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        Keep the momentum going - your group is counting on you! 💫
      </p>
      <div style="margin-top: 40px; text-align: left;">
        <p style="font-size: 16px; color: #000000; margin: 0 0 4px 0;">Have a good one!</p>
        <p style="font-size: 16px; color: #000000; margin: 0 0 20px 0;"><em>Jaryd</em></p>
        <p style="font-size: 14px; color: #000000; margin: 0;">
          <a href="goodtimes://feedback" style="color: #E8A037; text-decoration: underline;">Have feedback or an idea? Let me know</a>
        </p>
      </div>
    </div>
    <div style="background-color: #F5F0EA; padding: 30px; text-align: center; border-top: 1px solid #E8E0D5;">
      <img src="wordmark.png" alt="Good Times" style="max-width: 200px; height: auto; margin: 0 auto; display: block;" />
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #000000; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #F5F0EA;">
  <div style="background-color: #F5F0EA; border-radius: 12px; overflow: hidden;">
    <div style="padding: 40px 30px; background-color: #F5F0EA;">
      <p style="font-size: 18px; margin-bottom: 24px; color: #000000;">Hi ${memberName},</p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        Consistency is key to building lasting memories. When you respond to prompts regularly, 
        you're creating a beautiful timeline of your shared experiences.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        <strong style="color: #000000;">Pro tip:</strong> Set a daily reminder or make responding to prompts part of your morning routine. 
        Even a quick response is better than no response - your group will appreciate it!
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        You're doing great! Keep up the amazing work. 🌟
      </p>
      <div style="margin-top: 40px; text-align: left;">
        <p style="font-size: 16px; color: #000000; margin: 0 0 4px 0;">Have a good one!</p>
        <p style="font-size: 16px; color: #000000; margin: 0 0 20px 0;"><em>Jaryd</em></p>
        <p style="font-size: 14px; color: #000000; margin: 0;">
          <a href="goodtimes://feedback" style="color: #E8A037; text-decoration: underline;">Have feedback or an idea? Let me know</a>
        </p>
      </div>
    </div>
    <div style="background-color: #F5F0EA; padding: 30px; text-align: center; border-top: 1px solid #E8E0D5;">
      <img src="wordmark.png" alt="Good Times" style="max-width: 200px; height: auto; margin: 0 auto; display: block;" />
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #000000; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #F5F0EA;">
  <div style="background-color: #F5F0EA; border-radius: 12px; overflow: hidden;">
    <div style="padding: 40px 30px; background-color: #F5F0EA;">
      <p style="font-size: 18px; margin-bottom: 24px; color: #000000;">Hi ${memberName},</p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        The more people in your group, the richer your shared memories become! 
        Consider inviting more friends or family members to join your Good Times group.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        You can invite people directly from the app - just look for the invite button in your group settings. 
        Each new member brings new perspectives and stories to your shared timeline.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        Ready to grow your Good Times family? 🎉
      </p>
      <div style="margin-top: 40px; text-align: left;">
        <p style="font-size: 16px; color: #000000; margin: 0 0 4px 0;">Have a good one!</p>
        <p style="font-size: 16px; color: #000000; margin: 0 0 20px 0;"><em>Jaryd</em></p>
        <p style="font-size: 14px; color: #000000; margin: 0;">
          <a href="goodtimes://feedback" style="color: #E8A037; text-decoration: underline;">Have feedback or an idea? Let me know</a>
        </p>
      </div>
    </div>
    <div style="background-color: #F5F0EA; padding: 30px; text-align: center; border-top: 1px solid #E8E0D5;">
      <img src="wordmark.png" alt="Good Times" style="max-width: 200px; height: auto; margin: 0 auto; display: block;" />
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #000000; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #F5F0EA;">
  <div style="background-color: #F5F0EA; border-radius: 12px; overflow: hidden;">
    <div style="padding: 40px 30px; background-color: #F5F0EA;">
      <p style="font-size: 18px; margin-bottom: 24px; color: #000000;">Hi ${memberName},</p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        Congratulations! You've completed your first week with Good Times. 
        You now know everything you need to make the most of your shared memories.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        From here on out, you'll continue receiving daily prompts at 9 AM. 
        Keep responding, keep sharing, and keep building those meaningful connections with your group.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        If you ever have questions or feedback, we're here for you. 
        Just reply to this email - we'd love to hear from you!
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        Here's to many more good times ahead! 🥂
      </p>
      <div style="margin-top: 40px; text-align: left;">
        <p style="font-size: 16px; color: #000000; margin: 0 0 4px 0;">Have a good one!</p>
        <p style="font-size: 16px; color: #000000; margin: 0 0 20px 0;"><em>Jaryd</em></p>
        <p style="font-size: 14px; color: #000000; margin: 0;">
          <a href="goodtimes://feedback" style="color: #E8A037; text-decoration: underline;">Have feedback or an idea? Let me know</a>
        </p>
      </div>
    </div>
    <div style="background-color: #F5F0EA; padding: 30px; text-align: center; border-top: 1px solid #E8E0D5;">
      <img src="wordmark.png" alt="Good Times" style="max-width: 200px; height: auto; margin: 0 auto; display: block;" />
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

// Copy wordmark.png to email-previews directory so HTML files can reference it
const wordmarkSource = path.join(process.cwd(), 'assets', 'images', 'wordmark.png')
const wordmarkDest = path.join(outputDir, 'wordmark.png')
if (fs.existsSync(wordmarkSource)) {
  fs.copyFileSync(wordmarkSource, wordmarkDest)
  console.log('✓ Copied wordmark.png to email-previews directory')
} else {
  console.warn('⚠️  wordmark.png not found at assets/images/wordmark.png')
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

