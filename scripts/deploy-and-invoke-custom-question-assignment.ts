#!/usr/bin/env tsx
/**
 * Script to deploy and invoke the assign-custom-question-opportunity Edge Function
 * Usage: tsx scripts/deploy-and-invoke-custom-question-assignment.ts
 * 
 * This will:
 * 1. Deploy the function (if needed)
 * 2. Invoke it to create opportunities for today (if Monday/Thursday)
 * 3. Verify the results in the database
 */

import { execSync } from "child_process"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://ytnnsykbgohiscfgomfe.supabase.co"
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required")
  console.error("\nTo get your service role key:")
  console.error("1. Go to Supabase Dashboard → Project Settings → API")
  console.error("2. Copy the 'service_role' key (not the anon key)")
  console.error("3. Set it as an environment variable:")
  console.error("   export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'")
  console.error("\nOr run with inline env var:")
  console.error("   SUPABASE_SERVICE_ROLE_KEY='your-key' tsx scripts/deploy-and-invoke-custom-question-assignment.ts")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function checkToday() {
  const today = new Date()
  const dayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, ..., 4 = Thursday
  const todayStr = today.toISOString().split("T")[0]
  
  console.log(`\n📅 Today: ${todayStr} (${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]})`)
  
  if (dayOfWeek !== 1 && dayOfWeek !== 4) {
    console.log("⚠️  Today is not Monday or Thursday. The function only assigns on those days.")
    console.log("   However, we can still invoke it to test deployment.")
    return { shouldAssign: false, todayStr, dayOfWeek }
  }
  
  console.log("✅ Today is Monday or Thursday - assignments should be created!\n")
  return { shouldAssign: true, todayStr, dayOfWeek }
}

async function deployFunction() {
  console.log("\n🚀 Step 1: Deploying assign-custom-question-opportunity function...")
  
  try {
    // Check if supabase CLI is available
    try {
      execSync("which supabase", { stdio: "ignore" })
    } catch {
      console.log("⚠️  Supabase CLI not found. Skipping deployment.")
      console.log("   You can deploy manually: supabase functions deploy assign-custom-question-opportunity")
      return false
    }
    
    // Check if logged in
    try {
      execSync("supabase projects list", { stdio: "ignore" })
    } catch {
      console.log("⚠️  Not logged in to Supabase CLI. Skipping deployment.")
      console.log("   Run: supabase login")
      console.log("   Then deploy: supabase functions deploy assign-custom-question-opportunity")
      return false
    }
    
    console.log("   Deploying...")
    execSync("supabase functions deploy assign-custom-question-opportunity", { 
      stdio: "inherit",
      cwd: process.cwd()
    })
    console.log("✅ Function deployed successfully!\n")
    return true
  } catch (error: any) {
    console.error("❌ Deployment failed:", error.message)
    console.log("\n⚠️  You can deploy manually:")
    console.log("   supabase functions deploy assign-custom-question-opportunity")
    return false
  }
}

async function invokeFunction() {
  console.log("\n🚀 Step 2: Invoking assign-custom-question-opportunity function...")
  
  const functionUrl = `${SUPABASE_URL}/functions/v1/assign-custom-question-opportunity`
  console.log(`🔗 URL: ${functionUrl}\n`)
  
  try {
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      console.error("❌ Error:", data)
      return { success: false, data }
    }
    
    console.log("✅ Function invoked successfully!")
    console.log("\n📊 Response:")
    console.log(JSON.stringify(data, null, 2))
    
    if (data.results) {
      const assigned = data.results.filter((r: any) => r.status === "assigned").length
      const alreadyAssigned = data.results.filter((r: any) => r.status === "already_assigned").length
      const skipped = data.results.filter((r: any) => r.status === "skipped_due_to_conflict").length
      const insufficient = data.results.filter((r: any) => r.status === "insufficient_members").length
      
      console.log(`\n📈 Summary:`)
      console.log(`   ✅ Newly Assigned: ${assigned}`)
      console.log(`   ℹ️  Already Assigned: ${alreadyAssigned}`)
      console.log(`   ⚠️  Skipped (conflicts): ${skipped}`)
      console.log(`   ❌ Insufficient Members: ${insufficient}`)
      console.log(`   📊 Total Results: ${data.results.length}`)
    }
    
    return { success: true, data }
  } catch (error: any) {
    console.error("❌ Fatal error:", error)
    return { success: false, error: error.message }
  }
}

async function verifyResults(todayStr: string) {
  console.log("\n🔍 Step 3: Verifying results in database...")
  
  // Check opportunities created today
  const { data: opportunities, error: oppError } = await supabase
    .from("custom_questions")
    .select("id, group_id, user_id, date_assigned, question, date_asked")
    .eq("date_assigned", todayStr)
  
  if (oppError) {
    console.error("❌ Error checking opportunities:", oppError)
    return
  }
  
  console.log(`\n📊 Opportunities for ${todayStr}:`)
  console.log(`   Total: ${opportunities?.length || 0}`)
  
  if (opportunities && opportunities.length > 0) {
    const pending = opportunities.filter(o => !o.date_asked).length
    const created = opportunities.filter(o => o.question && o.question !== "").length
    
    console.log(`   ✅ Pending (should show banner): ${pending}`)
    console.log(`   📝 Created (question filled): ${created}`)
    
    // Get group names
    const groupIds = [...new Set(opportunities.map(o => o.group_id))]
    const { data: groups } = await supabase
      .from("groups")
      .select("id, name")
      .in("id", groupIds)
    
    const groupMap = new Map(groups?.map(g => [g.id, g.name]) || [])
    
    console.log(`\n📋 Details:`)
    opportunities.forEach((opp, idx) => {
      const groupName = groupMap.get(opp.group_id) || opp.group_id
      const status = opp.date_asked ? "✅ Scheduled" : opp.question ? "📝 Created" : "⏳ Pending"
      console.log(`   ${idx + 1}. Group: ${groupName} | Status: ${status}`)
    })
  } else {
    console.log("   ⚠️  No opportunities found for today")
  }
  
  // Check eligible groups
  const { data: eligibleGroups, error: eligError } = await supabase
    .from("group_activity_tracking")
    .select("group_id")
    .eq("is_eligible_for_custom_questions", true)
  
  if (!eligError) {
    console.log(`\n👥 Eligible Groups: ${eligibleGroups?.length || 0}`)
  }
}

async function main() {
  console.log("=" .repeat(60))
  console.log("Custom Question Assignment - Deploy & Invoke")
  console.log("=" .repeat(60))
  
  const { shouldAssign, todayStr } = await checkToday()
  
  // Step 1: Deploy
  const deployed = await deployFunction()
  if (!deployed) {
    console.log("\n⚠️  Skipping deployment. Continuing with invoke...")
  }
  
  // Step 2: Invoke
  const result = await invokeFunction()
  
  if (!result.success) {
    console.error("\n❌ Function invocation failed. Check the error above.")
    process.exit(1)
  }
  
  // Step 3: Verify
  await verifyResults(todayStr)
  
  console.log("\n" + "=" .repeat(60))
  console.log("✅ Done! Check Supabase Dashboard > Edge Functions > Logs for details")
  console.log("=" .repeat(60))
}

main().catch((error) => {
  console.error("❌ Fatal error:", error)
  process.exit(1)
})
