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
    subject: "Answering with video (1/6)",
    templateId: null, // Uses inline HTML
  },
  onboarding_day_3: {
    subject: "Answering with voice (2/6)",
    templateId: null, // Uses inline HTML
  },
  onboarding_day_4: {
    subject: "What's your group into? (3/6)",
    templateId: null, // Uses inline HTML
  },
  onboarding_day_5: {
    subject: "Adding and switching groups (4/6)",
    templateId: null, // Uses inline HTML
  },
  onboarding_day_6: {
    subject: "It's your turn to ask a question (5/6)",
    templateId: null, // Uses inline HTML
  },
  onboarding_day_7: {
    subject: "Birthday cards on Good Times (6/6)",
    templateId: null, // Uses inline HTML
  },
  birthday_card: {
    subject: "Your group made you a birthday card!",
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
      
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Good Times</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #000000; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #F5F0EA;">
  <!-- Main container -->
  <div style="background-color: #F5F0EA; border-radius: 12px; overflow: hidden;">
    <!-- Content area -->
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
      
      <!-- Sign-off -->
      <div style="margin-top: 40px; text-align: left;">
        <p style="font-size: 16px; color: #000000; margin: 0 0 4px 0;">Have a good one!</p>
        <p style="font-size: 16px; color: #000000; margin: 0 0 20px 0;"><em>Jaryd</em></p>
        <p style="font-size: 14px; color: #000000; margin: 0;">
          <em>p.s I made this solo, so if you have any feedback or see a bug, <a href="goodtimes://feedback" style="color: #E8A037; text-decoration: underline;">please let me know</a>!</em>
        </p>
      </div>
    </div>
    
    <!-- Footer with wordmark -->
    <div style="background-color: #F5F0EA; padding: 30px; text-align: center; border-top: 1px solid #E8E0D5;">
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
      <img src="https://thegoodtimes.app/wordmark.png" alt="Good Times" style="max-width: 200px; height: auto; margin: 0 auto; display: block;" />
    </div>
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
      <img src="https://thegoodtimes.app/wordmark.png" alt="Good Times" style="max-width: 200px; height: auto; margin: 0 auto; display: block;" />
    </div>
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
      <img src="https://thegoodtimes.app/wordmark.png" alt="Good Times" style="max-width: 200px; height: auto; margin: 0 auto; display: block;" />
    </div>
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
      <img src="https://thegoodtimes.app/wordmark.png" alt="Good Times" style="max-width: 200px; height: auto; margin: 0 auto; display: block;" />
    </div>
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
      <img src="https://thegoodtimes.app/wordmark.png" alt="Good Times" style="max-width: 200px; height: auto; margin: 0 auto; display: block;" />
    </div>
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
      <img src="https://thegoodtimes.app/wordmark.png" alt="Good Times" style="max-width: 200px; height: auto; margin: 0 auto; display: block;" />
    </div>
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #000000; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #F5F0EA;">
  <div style="background-color: #F5F0EA; border-radius: 12px; overflow: hidden;">
    <div style="padding: 40px 30px; background-color: #F5F0EA;">
      <p style="font-size: 18px; margin-bottom: 24px; color: #000000;">Hi ${userName},</p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
      ${contributorNames.length > 0 
          ? `<strong style="color: #000000;">${contributorsText}</strong> wrote you a special birthday card!` 
        : `You have a special birthday card from ${groupGreeting}!`}
    </p>
      <p style="font-size: 16px; margin-bottom: 30px; color: #000000; line-height: 1.7;">
      Open the app to see the heartfelt messages ${groupType === "family" ? "your family" : "your friends"} left for you on your special day.
    </p>
    <div style="text-align: center; margin: 30px 0;">
        <a href="${cardLink}" style="display: inline-block; background-color: #D97393; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
        View Your Birthday Card
      </a>
    </div>
      <p style="font-size: 14px; color: #404040; margin-top: 30px; text-align: center;">
      If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${cardLink}" style="color: #E8A037; word-break: break-all;">${cardLink}</a>
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
      <img src="https://thegoodtimes.app/wordmark.png" alt="Good Times" style="max-width: 200px; height: auto; margin: 0 auto; display: block;" />
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #000000; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #F5F0EA;">
  <div style="background-color: #F5F0EA; border-radius: 12px; overflow: hidden;">
    <div style="padding: 40px 30px; background-color: #F5F0EA;">
      <p style="font-size: 18px; margin-bottom: 24px; color: #000000;">Deck Suggestion</p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        <strong style="color: #000000;">User:</strong> ${userName}<br>
        <strong style="color: #000000;">Email:</strong> ${userEmail}<br>
        <strong style="color: #000000;">Group:</strong> ${groupName} (ID: ${groupId})
      </p>
      <div style="background-color: #F5F0EA; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #D97393;">
        <p style="font-size: 16px; margin: 0 0 10px 0; color: #000000;"><strong style="color: #000000;">Suggestion:</strong></p>
        <p style="font-size: 16px; margin: 0; white-space: pre-wrap; color: #000000;">${suggestion}</p>
      </div>
      <div style="background-color: #F5F0EA; padding: 20px; border-radius: 8px; border-left: 4px solid #E8E0D5;">
        <p style="font-size: 16px; margin: 0 0 10px 0; color: #000000;"><strong style="color: #000000;">Sample Question:</strong></p>
        <p style="font-size: 16px; margin: 0; white-space: pre-wrap; color: #000000;">${sampleQuestion}</p>
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
      <img src="https://thegoodtimes.app/wordmark.png" alt="Good Times" style="max-width: 200px; height: auto; margin: 0 auto; display: block;" />
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
        <div style="background-color: #F5F0EA; padding: 20px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #D97393;">
          <p style="font-size: 16px; margin: 0 0 10px 0; color: #000000;"><strong style="color: #000000;">Question ${idx + 1}:</strong></p>
          <p style="font-size: 16px; margin: 0; white-space: pre-wrap; color: #000000;">${escapedQ}</p>
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #000000; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #F5F0EA;">
  <div style="background-color: #F5F0EA; border-radius: 12px; overflow: hidden;">
    <div style="padding: 40px 30px; background-color: #F5F0EA;">
      <p style="font-size: 18px; margin-bottom: 24px; color: #000000;">Featured Question Suggestion</p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #000000; line-height: 1.7;">
        <strong style="color: #000000;">User:</strong> ${userName}<br>
        <strong style="color: #000000;">Email:</strong> ${userEmail}<br>
        <strong style="color: #000000;">Group:</strong> ${groupName} (ID: ${groupId})
    </p>
    ${questions.length > 0 ? `
    <div style="margin-top: 20px;">
        <p style="font-size: 18px; margin-bottom: 15px; color: #000000;"><strong style="color: #000000;">Suggested Questions:</strong></p>
      ${questionsHTML}
    </div>
    ` : `
      <div style="background-color: #F5F0EA; padding: 20px; border-radius: 8px; border-left: 4px solid #E8E0D5;">
        <p style="font-size: 16px; margin: 0; color: #404040;">No questions provided.</p>
      </div>
      `}
      <div style="margin-top: 40px; text-align: left;">
        <p style="font-size: 16px; color: #000000; margin: 0 0 4px 0;">Have a good one!</p>
        <p style="font-size: 16px; color: #000000; margin: 0 0 20px 0;"><em>Jaryd</em></p>
        <p style="font-size: 14px; color: #000000; margin: 0;">
          <a href="goodtimes://feedback" style="color: #E8A037; text-decoration: underline;">Have feedback or an idea? Let me know</a>
        </p>
      </div>
    </div>
    <div style="background-color: #F5F0EA; padding: 30px; text-align: center; border-top: 1px solid #E8E0D5;">
      <img src="https://thegoodtimes.app/wordmark.png" alt="Good Times" style="max-width: 200px; height: auto; margin: 0 auto; display: block;" />
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
      
      return `
Hey ${memberName},

Welcome to Good Times, I'm Jaryd. I made this app because I was over scrolling through performative social media full of AI slop, and I found group texts can both quickly become overwhelming, and no actually interesting conversation is really ever going on in them.

I have friends and family all over the world after I moved to New York, and I've been craving something low-effort, yet meaningful that still kept me close to the people I care about.

I think a good question has so much power to get people thinking and bring people closer.

So I made Good Times with a dead simple premise:

1. We'll ask you and your group just one question a day.
2. Answer it however you like. Add photos, videos, or just keep it simple with text.
3. After you answer, you'll see what everyone else said and can reply.

That's it, see where the daily question takes you.

Thanks for being here, I hope you find it's a fun way to bring you closer to your favorite people.

Have a good one!
*Jaryd*

p.s I made this solo, so if you have any feedback or see a bug, please let me know: goodtimes://feedback
      `.trim()
    }
    case "onboarding_day_2": {
      const memberName = templateData.member_name || "there"
      return `
Hey ${memberName},

Welcome to your second day of Good Times.

I want to let you know about one of my personal favorite parts of the app, Video Answers.

When I was testing the app with my first group, I realized I often had quite a bit I wanted to say, like a story. And typing it out over text suddenly felt like work.

So, I solved my own problem and added the ability to answer the question with a video instead.

Because this isn't social media, the best part is the video is just for my group to see, and I found I never cared at all about polish or anything like that. Just raw, candid, authentic video.

It also just adds some personality and an extra layer of you to the answer.

The next time you're answering a question, tap the pink "Video" circle in the toolbar and record your answer.

Oh, you can also reply to other others with video.

Give it a go, and have fun with it!

*Jaryd*

p.s I made this solo, so if you have any feedback or see a bug, please let me know: goodtimes://feedback
      `.trim()
    }
    case "onboarding_day_3": {
      const memberName = templateData.member_name || "there"
      return `
Hey ${memberName},

Yesterday I told you about how you can use Video Messages to answer a question or comment on someone else's answer.

Today, I want to tell you about another similar feature: Voice Messages

So much research tells us that the power of voice does a ton to make people feel closer. And that hearing someone vs reading someone is a much better way of communicating.

I know some people (like my wife) are shy to send voice messages and avoid them. I get that.

But Good Times is all about small, intimate groups where performance is irrelevant.

If you want to give it a try, hit the "Mic" button the next time you answer a question (or comment).

Have a good one!

*Jaryd*

p.s I made this solo, so if you have any feedback or see a bug, please let me know: goodtimes://feedback
      `.trim()
    }
    case "onboarding_day_4": {
      const memberName = templateData.member_name || "there"
      return `
Hey ${memberName},

Who wants to answer questions that aren't interesting to them?

That's why in Good Times, you can tell us what you're into, and we'll make sure the one question we ask you a day is about something you care about.

You likely did this when you joined already, but to see what your current interests are, or make changed, just tap your group name in the top left corner.

Then hit "Edit what we're into" and you can set what you guys like. We'll take it from there

Have a good one!

*Jaryd*

p.s I made this solo, so if you have any feedback or see a bug, please let me know: goodtimes://feedback
      `.trim()
    }
    case "onboarding_day_5": {
      const memberName = templateData.member_name || "there"
      return `
Hey ${memberName},

Good Times isn't a social media. There are no ads, no strangers, and none of this recent AI slop flooding every feed.

It's all about you and your group having your own private, fun, and meaningful space to learn about each other, share opinions, and feel closer.

Each group has it's own space, and groups are interested in different things and have different norms and roles.

That's why on Good Times, you can be in multiple groups.

I have my family group, and then I'm in 4 different friends groups.

If you have another group in mind (small or big), just tap your group name in the top left corner, and tap "Create another group".

Then pick a name, invite your people, set the interests for the group, and start answering!

Have a good one!

*Jaryd*

p.s I made this solo, so if you have any feedback or see a bug, please let me know: goodtimes://feedback
      `.trim()
    }
    case "onboarding_day_6": {
      const memberName = templateData.member_name || "there"
      return `
Hey ${memberName},

Good Times is all about the question—the power of the question as a spark for conversation.

When my sister Lucy first saw the app, she instantly told me I have to make it possible for people to be able to ask their own questions to the group.

I thought it was a great idea, and it's now one of the most used parts of the app.

Here's how it works

1. Twice a week, someone in the group gets a chance to ask a question
2. This chance only lasts the day, if you skip it, it's passed along to someone else
3. Show your name, or keep it anonymous
4. Everyone then answers your question!

Simple, fun, and it gives you the power of the question.

Keep an eye out for it.

*Jaryd*

p.s I made this solo, so if you have any feedback or see a bug, please let me know: goodtimes://feedback
      `.trim()
    }
    case "onboarding_day_7": {
      const memberName = templateData.member_name || "there"
      return `
Hey ${memberName},

Day 7 of Good Times!

Thanks for being here, answering, and contributing to your groups daily connection.

You know everything you need to know: How to answer, how to edit what we ask, and how to add and switch groups.

My last note to you is just to tell about a few other cool things.

1. Keep an eye out for "Birthday Cards", where you add to someone's group card.
2. As your timeline grows, you can easily find conversations in your history with filters.
3. I made Good Times in memory of my mom who passed away. If your group has lost someone, open your group settings, and tap "Memorials". We'll ask occasional questions about them to your group. This is the favorite question I get with my family group.

I really hope you have fun here, and I hope this app brings you and your people more good times.

If you've enjoyed using it so far, it would mean a ton to me if you left a rating on the App Store.

Rate Good Times quickly: goodtimes://rate

Thanks again.

*Jaryd*

p.s I made this solo, so if you have any feedback or see a bug, please let me know: goodtimes://feedback
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

Have a good one!
*Jaryd*

Have feedback or an idea? Let me know: goodtimes://feedback
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


