#!/usr/bin/env tsx
/**
 * Quick script to invoke the assign-custom-question-opportunity function
 * Usage: tsx scripts/invoke-custom-question-assignment.ts
 */

import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://ytnnsykbgohiscfgomfe.supabase.co"
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  console.log("🚀 Invoking assign-custom-question-opportunity function...\n")
  
  const { data, error } = await supabase.functions.invoke("assign-custom-question-opportunity", {
    body: {}
  })
  
  if (error) {
    console.error("❌ Error:", error)
    process.exit(1)
  }
  
  console.log("✅ Success!")
  console.log("\n📊 Results:")
  console.log(JSON.stringify(data, null, 2))
  
  if (data.results) {
    const assigned = data.results.filter((r: any) => r.status === "assigned").length
    console.log(`\n📈 Newly Assigned: ${assigned}`)
  }
}

main().catch((error) => {
  console.error("❌ Fatal error:", error)
  process.exit(1)
})
