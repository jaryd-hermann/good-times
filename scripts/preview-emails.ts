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
      <p style="font-size: 18px; margin-bottom: 24px; color: #000000;">Hey ${memberName},</p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        Welcome to Good Times, I'm Jaryd. I made this app because I was over scrolling through performative social media full of AI slop, and I found group texts can both quickly become overwhelming, and no actually interesting conversation is really ever going on in them.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        I have friends and family all over the world after I moved to New York, and I've been craving something low-effort, yet meaningful that still kept me close to the people I care about.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        I think a good question has so much power to get people thinking and bring people closer.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        So I made Good Times with a dead simple premise:
      </p>
      <ol style="font-size: 16px; color: #000000; line-height: 1.8; padding-left: 20px; margin: 20px 0;">
        <li style="margin-bottom: 12px;">We'll ask you and your group just one question a day.</li>
        <li style="margin-bottom: 12px;">Answer it however you like. Add photos, videos, or just keep it simple with text.</li>
        <li style="margin-bottom: 12px;">After you answer, you'll see what everyone else said and can reply.</li>
      </ol>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        That's it, see where the daily question takes you.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        Thanks for being here, I hope you find it's a fun way to bring you closer to your favorite people.
      </p>
      <div style="margin-top: 40px; text-align: left;">
        <p style="font-size: 16px; color: #000000; margin: 0 0 4px 0;">Have a good one!</p>
        <p style="font-size: 16px; color: #000000; margin: 0 0 20px 0;"><em>Jaryd</em></p>
        <p style="font-size: 14px; color: #000000; margin: 0;">
          <em>p.s I made this solo, so if you have any feedback or see a bug, <a href="goodtimes://feedback" style="color: #E8A037; text-decoration: underline;">please let me know</a>!</em>
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
      <p style="font-size: 18px; margin-bottom: 24px; color: #000000;">Hey ${memberName},</p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        Welcome to your second day of Good Times.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        I want to let you know about one of my personal favorite parts of the app, Video Answers.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        When I was testing the app with my first group, I realized I often had quite a bit I wanted to say, like a story. And typing it out over text suddenly felt like work.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        So, I solved my own problem and added the ability to answer the question with a video instead.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        Because this isn't social media, the best part is the video is just for my group to see, and I found I never cared at all about polish or anything like that. Just raw, candid, authentic video.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        It also just adds some personality and an extra layer of you to the answer.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        The next time you're answering a question, tap the pink "Video" circle in the toolbar and record your answer.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        Oh, you can also reply to other others with video.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        Give it a go, and have fun with it!
      </p>
      <div style="margin-top: 40px; text-align: left;">
        <p style="font-size: 16px; color: #000000; margin: 0 0 20px 0;"><em>Jaryd</em></p>
        <p style="font-size: 14px; color: #000000; margin: 0;">
          <em>p.s I made this solo, so if you have any feedback or see a bug, <a href="goodtimes://feedback" style="color: #E8A037; text-decoration: underline;">please let me know</a>!</em>
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
      <p style="font-size: 18px; margin-bottom: 24px; color: #000000;">Hey ${memberName},</p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        Yesterday I told you about how you can use Video Messages to answer a question or comment on someone else's answer.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        Today, I want to tell you about another similar feature: Voice Messages
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        So much research tells us that the power of voice does a ton to make people feel closer. And that hearing someone vs reading someone is a much better way of communicating.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        I know some people (like my wife) are shy to send voice messages and avoid them. I get that.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        But Good Times is all about small, intimate groups where performance is irrelevant.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        If you want to give it a try, hit the "Mic" button the next time you answer a question (or comment).
      </p>
      <div style="margin-top: 40px; text-align: left;">
        <p style="font-size: 16px; color: #000000; margin: 0 0 20px 0;">Have a good one!</p>
        <p style="font-size: 16px; color: #000000; margin: 0 0 20px 0;"><em>Jaryd</em></p>
        <p style="font-size: 14px; color: #000000; margin: 0;">
          <em>p.s I made this solo, so if you have any feedback or see a bug, <a href="goodtimes://feedback" style="color: #E8A037; text-decoration: underline;">please let me know</a>!</em>
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
      <p style="font-size: 18px; margin-bottom: 24px; color: #000000;">Hey ${memberName},</p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        Who wants to answer questions that aren't interesting to them?
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        That's why in Good Times, you can tell us what you're into, and we'll make sure the one question we ask you a day is about something you care about.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        You likely did this when you joined already, but to see what your current interests are, or make changed, just tap your group name in the top left corner.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        Then hit "Edit what we're into" and you can set what you guys like. We'll take it from there
      </p>
      <div style="margin-top: 40px; text-align: left;">
        <p style="font-size: 16px; color: #000000; margin: 0 0 20px 0;">Have a good one!</p>
        <p style="font-size: 16px; color: #000000; margin: 0 0 20px 0;"><em>Jaryd</em></p>
        <p style="font-size: 14px; color: #000000; margin: 0;">
          <em>p.s I made this solo, so if you have any feedback or see a bug, <a href="goodtimes://feedback" style="color: #E8A037; text-decoration: underline;">please let me know</a>!</em>
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
      <p style="font-size: 18px; margin-bottom: 24px; color: #000000;">Hey ${memberName},</p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        Good Times isn't a social media. There are no ads, no strangers, and none of this recent AI slop flooding every feed.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        It's all about you and your group having your own private, fun, and meaningful space to learn about each other, share opinions, and feel closer.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        Each group has it's own space, and groups are interested in different things and have different norms and roles.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        That's why on Good Times, you can be in multiple groups.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        I have my family group, and then I'm in 4 different friends groups.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        If you have another group in mind (small or big), just tap your group name in the top left corner, and tap "Create another group".
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        Then pick a name, invite your people, set the interests for the group, and start answering!
      </p>
      <div style="margin-top: 40px; text-align: left;">
        <p style="font-size: 16px; color: #000000; margin: 0 0 20px 0;">Have a good one!</p>
        <p style="font-size: 16px; color: #000000; margin: 0 0 20px 0;"><em>Jaryd</em></p>
        <p style="font-size: 14px; color: #000000; margin: 0;">
          <em>p.s I made this solo, so if you have any feedback or see a bug, <a href="goodtimes://feedback" style="color: #E8A037; text-decoration: underline;">please let me know</a>!</em>
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
      <p style="font-size: 18px; margin-bottom: 24px; color: #000000;">Hey ${memberName},</p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        Good Times is all about the question—the power of the question as a spark for conversation.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        When my sister Lucy first saw the app, she instantly told me I have to make it possible for people to be able to ask their own questions to the group.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        I thought it was a great idea, and it's now one of the most used parts of the app.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        Here's how it works
      </p>
      <ol style="font-size: 16px; color: #000000; line-height: 1.8; padding-left: 20px; margin: 20px 0;">
        <li style="margin-bottom: 12px;">Twice a week, someone in the group gets a chance to ask a question</li>
        <li style="margin-bottom: 12px;">This chance only lasts the day, if you skip it, it's passed along to someone else</li>
        <li style="margin-bottom: 12px;">Show your name, or keep it anonymous</li>
        <li style="margin-bottom: 12px;">Everyone then answers your question!</li>
      </ol>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        Simple, fun, and it gives you the power of the question.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        Keep an eye out for it.
      </p>
      <div style="margin-top: 40px; text-align: left;">
        <p style="font-size: 16px; color: #000000; margin: 0 0 20px 0;"><em>Jaryd</em></p>
        <p style="font-size: 14px; color: #000000; margin: 0;">
          <em>p.s I made this solo, so if you have any feedback or see a bug, <a href="goodtimes://feedback" style="color: #E8A037; text-decoration: underline;">please let me know</a>!</em>
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
      <p style="font-size: 18px; margin-bottom: 24px; color: #000000;">Hey ${memberName},</p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        Day 7 of Good Times!
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        Thanks for being here, answering, and contributing to your groups daily connection.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        You know everything you need to know: How to answer, how to edit what we ask, and how to add and switch groups.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        My last note to you is just to tell about a few other cool things.
      </p>
      <ol style="font-size: 16px; color: #000000; line-height: 1.8; padding-left: 20px; margin: 20px 0;">
        <li style="margin-bottom: 12px;">Keep an eye out for "Birthday Cards", where you add to someone's group card.</li>
        <li style="margin-bottom: 12px;">As your timeline grows, you can easily find conversations in your history with filters.</li>
        <li style="margin-bottom: 12px;">I made Good Times in memory of my mom who passed away. If your group has lost someone, open your group settings, and tap "Memorials". We'll ask occasional questions about them to your group. This is the favorite question I get with my family group.</li>
      </ol>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        I really hope you have fun here, and I hope this app brings you and your people more good times.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        If you've enjoyed using it so far, it would mean a ton to me if you left a rating on the App Store.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        <a href="goodtimes://rate" style="color: #E8A037; text-decoration: underline;">Rate Good Times quickly</a>
      </p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        Thanks again.
      </p>
      <div style="margin-top: 40px; text-align: left;">
        <p style="font-size: 16px; color: #000000; margin: 0 0 20px 0;"><em>Jaryd</em></p>
        <p style="font-size: 14px; color: #000000; margin: 0;">
          <em>p.s I made this solo, so if you have any feedback or see a bug, <a href="goodtimes://feedback" style="color: #E8A037; text-decoration: underline;">please let me know</a>!</em>
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



