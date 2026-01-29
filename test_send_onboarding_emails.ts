#!/usr/bin/env tsx
/**
 * Test script to manually trigger onboarding emails
 * 
 * Usage: 
 *   npx tsx test_send_onboarding_emails.ts [user_id]
 * 
 * Or add to package.json scripts:
 *   "test-send-emails": "tsx test_send_onboarding_emails.ts"
 */

// Load .env file manually if it exists
import * as fs from 'fs'
import * as path from 'path'

function loadEnvFile(filePath: string) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '')
          if (!process.env[key]) {
            process.env[key] = value
          }
        }
      }
    }
  }
}

// Try .env.local first (usually has overrides), then .env
loadEnvFile(path.join(process.cwd(), '.env.local'))
loadEnvFile(path.join(process.cwd(), '.env'))

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

async function invokeProcessOnboardingEmails() {
  console.log("\n🚀 Invoking process-onboarding-emails function...\n")
  
  const { data, error } = await supabase.functions.invoke("process-onboarding-emails", {
    body: {}
  })
  
  if (error) {
    console.error("❌ Error invoking function:", error)
    return false
  }
  
  console.log("✅ Function invoked successfully!")
  console.log("Response:", JSON.stringify(data, null, 2))
  
  return true
}

async function checkUserEmails(userId: string) {
  console.log(`\n📧 Checking emails for user: ${userId}\n`)
  
  // Check email_logs
  const { data: logs, error: logsError } = await supabase
    .from("email_logs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10)
  
  if (logsError) {
    console.error("❌ Error fetching email_logs:", logsError.message)
  } else {
    console.log(`📨 Email logs: ${logs?.length || 0} entries`)
    if (logs && logs.length > 0) {
      logs.forEach((log: any) => {
        console.log(`   - ${log.email_type} (resend_id: ${log.resend_id || 'none'}) at ${log.created_at || 'unknown'}`)
      })
    } else {
      console.log("   No emails sent yet")
    }
  }
  
  // Check scheduled emails
  const { data: scheduled, error: scheduledError } = await supabase
    .from("onboarding_email_schedule")
    .select("*")
    .eq("user_id", userId)
    .order("scheduled_for", { ascending: true })
  
  if (scheduledError) {
    console.error("❌ Error fetching scheduled emails:", scheduledError.message)
  } else {
    console.log(`\n📅 Scheduled emails: ${scheduled?.length || 0} total`)
    if (scheduled && scheduled.length > 0) {
      const pending = scheduled.filter((s: any) => !s.sent)
      const sent = scheduled.filter((s: any) => s.sent)
      console.log(`   - Pending: ${pending.length}`)
      console.log(`   - Sent: ${sent.length}`)
      
      if (pending.length > 0) {
        console.log("\n   Pending emails:")
        pending.forEach((s: any) => {
          const now = new Date()
          const scheduled = new Date(s.scheduled_for)
          const status = scheduled <= now ? "⏰ DUE NOW" : "⏳ Scheduled"
          console.log(`   - ${s.email_type}: ${status} for ${s.scheduled_for}`)
        })
      }
      
      if (sent.length > 0) {
        console.log("\n   Sent emails:")
        sent.forEach((s: any) => {
          console.log(`   - ${s.email_type}: sent at ${s.sent_at}`)
        })
      }
    }
  }
}

async function main() {
  const userId = process.argv[2]
  
  console.log("🧪 Testing Onboarding Email System\n")
  console.log("=".repeat(50))
  
  // Step 1: Invoke the function
  const success = await invokeProcessOnboardingEmails()
  
  if (!success) {
    console.error("\n❌ Failed to invoke function. Check logs above.")
    process.exit(1)
  }
  
  // Step 2: Check user emails if user_id provided
  if (userId) {
    await checkUserEmails(userId)
  } else {
    console.log("\n💡 Tip: Provide a user_id to check their emails:")
    console.log("   tsx scripts/test_send_onboarding_emails.ts <user_id>")
  }
  
  console.log("\n" + "=".repeat(50))
  console.log("\n✅ Test complete!")
  console.log("\nNext steps:")
  console.log("1. Check Supabase Dashboard → Edge Functions → process-onboarding-emails → Logs")
  console.log("2. Check Resend Dashboard → Logs to see if emails were sent")
  console.log("3. Check email_logs table in Supabase SQL Editor")
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
