#!/usr/bin/env tsx
/**
 * Script to manually invoke the schedule-daily-prompts Edge Function
 * Usage: tsx scripts/invoke-schedule-prompts.ts [date]
 * 
 * If date is provided (YYYY-MM-DD format), schedules for that date.
 * Otherwise, schedules for today.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ytnnsykbgohiscfgomfe.supabase.co"
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required")
  console.error("\nTo get your service role key:")
  console.error("1. Go to Supabase Dashboard → Project Settings → API")
  console.error("2. Copy the 'service_role' key (not the anon key)")
  console.error("3. Set it as an environment variable:")
  console.error("   export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'")
  console.error("\nOr run with inline env var:")
  console.error("   SUPABASE_SERVICE_ROLE_KEY='your-key' tsx scripts/invoke-schedule-prompts.ts")
  process.exit(1)
}

async function main() {
  const dateArg = process.argv[2]
  const requestBody = dateArg ? { date: dateArg } : {}

  const functionUrl = `${SUPABASE_URL}/functions/v1/schedule-daily-prompts`

  console.log(`🚀 Invoking schedule-daily-prompts function...`)
  if (dateArg) {
    console.log(`📅 Scheduling for date: ${dateArg}`)
  } else {
    console.log(`📅 Scheduling for today: ${new Date().toISOString().split("T")[0]}`)
  }
  console.log(`🔗 URL: ${functionUrl}\n`)

  try {
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("❌ Error:", data)
      process.exit(1)
    }

    console.log("✅ Success!")
    console.log("\n📊 Results:")
    console.log(JSON.stringify(data, null, 2))
    
    if (data.results) {
      const scheduled = data.results.filter((r: any) => r.status === "scheduled").length
      const errors = data.results.filter((r: any) => r.status === "error").length
      const noPrompts = data.results.filter((r: any) => r.status === "no_prompts_available").length
      
      console.log(`\n📈 Summary:`)
      console.log(`   ✅ Scheduled: ${scheduled}`)
      console.log(`   ⚠️  No prompts available: ${noPrompts}`)
      console.log(`   ❌ Errors: ${errors}`)
    }
  } catch (error) {
    console.error("❌ Fatal error:", error)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error("❌ Fatal error:", error)
  process.exit(1)
})
