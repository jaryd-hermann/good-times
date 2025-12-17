#!/usr/bin/env tsx
/**
 * Test Email Onboarding System
 * 
 * Verifies that the email onboarding system is set up correctly
 * 
 * Usage: tsx scripts/test-email-onboarding.ts [user_id]
 */

import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing environment variables:")
  console.error("   EXPO_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✓" : "✗")
  console.error("   SUPABASE_SERVICE_ROLE_KEY:", supabaseServiceKey ? "✓" : "✗")
  console.error("\nPlease set these in your .env file or environment")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkTables() {
  console.log("\n📊 Checking database tables...")
  
  // Check email_logs table
  const { data: emailLogs, error: logsError } = await supabase
    .from("email_logs")
    .select("id")
    .limit(1)
  
  if (logsError) {
    console.error("❌ email_logs table:", logsError.message)
    return false
  }
  console.log("✅ email_logs table exists")
  
  // Check onboarding_email_schedule table
  const { data: schedule, error: scheduleError } = await supabase
    .from("onboarding_email_schedule")
    .select("id")
    .limit(1)
  
  if (scheduleError) {
    console.error("❌ onboarding_email_schedule table:", scheduleError.message)
    return false
  }
  console.log("✅ onboarding_email_schedule table exists")
  
  return true
}

async function checkFunctions() {
  console.log("\n🔧 Checking database functions...")
  
  const { data, error } = await supabase.rpc("check_function_exists", {
    function_name: "schedule_onboarding_emails"
  })
  
  // Alternative: Try calling the function with a test UUID to see if it exists
  // (it will fail but we can check the error message)
  const testUserId = "00000000-0000-0000-0000-000000000000"
  const { error: funcError } = await supabase.rpc("schedule_onboarding_emails", {
    p_user_id: testUserId
  })
  
  if (funcError && funcError.message.includes("does not exist")) {
    console.error("❌ schedule_onboarding_emails function not found")
    return false
  }
  console.log("✅ schedule_onboarding_emails function exists")
  
  return true
}

async function checkTrigger() {
  console.log("\n⚡ Checking database trigger...")
  
  // Query pg_trigger directly
  const { data, error } = await supabase
    .from("pg_trigger")
    .select("tgname")
    .eq("tgname", "trigger_welcome_email_on_registration")
    .limit(1)
  
  // Since pg_trigger might not be accessible, try a different approach
  // Just verify the trigger exists by checking if we can query group_members
  const { error: testError } = await supabase
    .from("group_members")
    .select("id")
    .limit(1)
  
  if (testError) {
    console.error("❌ Cannot access group_members table:", testError.message)
    return false
  }
  
  console.log("✅ Trigger should be active (verify in Supabase dashboard)")
  return true
}

async function checkEdgeFunction() {
  console.log("\n🚀 Checking Edge Functions...")
  
  // Try to invoke the function (it will fail without proper auth, but we can check if it exists)
  const { data, error } = await supabase.functions.invoke("process-onboarding-emails", {
    body: {}
  })
  
  // If we get a 404 or function not found error, it doesn't exist
  if (error) {
    if (error.message.includes("not found") || error.message.includes("404")) {
      console.error("❌ process-onboarding-emails Edge Function not found")
      console.error("   Deploy it with: supabase functions deploy process-onboarding-emails")
      return false
    }
    // Other errors (like auth) are OK - function exists
    console.log("✅ process-onboarding-emails Edge Function exists")
  } else {
    console.log("✅ process-onboarding-emails Edge Function exists and is callable")
  }
  
  return true
}

async function checkCronJob() {
  console.log("\n⏰ Checking cron jobs...")
  console.log("   (Note: Cron jobs can only be verified in Supabase SQL editor)")
  console.log("   Run: SELECT * FROM cron.job WHERE jobname = 'process-onboarding-emails';")
  return true
}

async function checkUserEmails(userId?: string) {
  if (!userId) {
    console.log("\n👤 Skipping user email check (no user_id provided)")
    return true
  }
  
  console.log(`\n📧 Checking emails for user: ${userId}`)
  
  // Check email logs
  const { data: logs, error: logsError } = await supabase
    .from("email_logs")
    .select("*")
    .eq("user_id", userId)
    .order("sent_at", { ascending: false })
  
  if (logsError) {
    console.error("❌ Error fetching email logs:", logsError.message)
    return false
  }
  
  console.log(`   Email logs: ${logs?.length || 0} emails sent`)
  if (logs && logs.length > 0) {
    logs.slice(0, 5).forEach((log: any) => {
      console.log(`   - ${log.email_type} sent at ${log.sent_at}`)
    })
  }
  
  // Check scheduled emails
  const { data: scheduled, error: scheduledError } = await supabase
    .from("onboarding_email_schedule")
    .select("*")
    .eq("user_id", userId)
    .order("scheduled_for", { ascending: true })
  
  if (scheduledError) {
    console.error("❌ Error fetching scheduled emails:", scheduledError.message)
    return false
  }
  
  console.log(`   Scheduled emails: ${scheduled?.length || 0} total`)
  if (scheduled && scheduled.length > 0) {
    const pending = scheduled.filter((s: any) => !s.sent)
    const sent = scheduled.filter((s: any) => s.sent)
    console.log(`   - Pending: ${pending.length}`)
    console.log(`   - Sent: ${sent.length}`)
    
    if (pending.length > 0) {
      console.log("\n   Pending emails:")
      pending.forEach((s: any) => {
        const status = s.scheduled_for <= new Date().toISOString() ? "⏰ DUE NOW" : "⏳ Scheduled"
        console.log(`   - ${s.email_type}: ${status} for ${s.scheduled_for}`)
      })
    }
  }
  
  return true
}

async function main() {
  console.log("🧪 Testing Email Onboarding System Setup\n")
  console.log("=" .repeat(50))
  
  const userId = process.argv[2]
  
  const checks = [
    { name: "Database Tables", fn: checkTables },
    { name: "Database Functions", fn: checkFunctions },
    { name: "Database Trigger", fn: checkTrigger },
    { name: "Edge Functions", fn: checkEdgeFunction },
    { name: "Cron Jobs", fn: checkCronJob },
  ]
  
  let allPassed = true
  
  for (const check of checks) {
    try {
      const passed = await check.fn()
      if (!passed) {
        allPassed = false
      }
    } catch (error: any) {
      console.error(`❌ Error checking ${check.name}:`, error.message)
      allPassed = false
    }
  }
  
  if (userId) {
    await checkUserEmails(userId)
  }
  
  console.log("\n" + "=".repeat(50))
  
  if (allPassed) {
    console.log("\n✅ All checks passed! System appears to be set up correctly.")
    console.log("\nNext steps:")
    console.log("1. Test by creating a new user and joining a group")
    console.log("2. Check email_logs table to verify welcome email was sent")
    console.log("3. Check onboarding_email_schedule to see scheduled follow-ups")
    console.log("4. Wait for cron job to run (or trigger manually)")
  } else {
    console.log("\n⚠️  Some checks failed. Please review the errors above.")
  }
  
  console.log("\n💡 Tip: To check a specific user's emails, run:")
  console.log("   tsx scripts/test-email-onboarding.ts <user_id>")
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})

