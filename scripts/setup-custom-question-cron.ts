#!/usr/bin/env tsx
/**
 * Script to set up the cron schedule for assign-custom-question-opportunity
 * This creates a pg_cron job that calls the Edge Function on Monday and Thursday at 12:01 AM UTC
 * 
 * Usage: tsx scripts/setup-custom-question-cron.ts
 */

import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { join } from "path"

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://ytnnsykbgohiscfgomfe.supabase.co"
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required")
  console.error("\nTo get your service role key:")
  console.error("1. Go to Supabase Dashboard → Project Settings → API")
  console.error("2. Copy the 'service_role' key (not the anon key)")
  console.error("3. Set it as an environment variable:")
  console.error("   export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function checkExtensions() {
  console.log("🔍 Checking required extensions...")
  
  // Check if pg_cron is enabled
  const { data: cronCheck, error: cronError } = await supabase.rpc('exec_sql', {
    sql: "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') as enabled"
  }).catch(() => ({ data: null, error: null }))
  
  // Check if pg_net is enabled
  const { data: netCheck, error: netError } = await supabase.rpc('exec_sql', {
    sql: "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_net') as enabled"
  }).catch(() => ({ data: null, error: null }))
  
  // If RPC doesn't work, try direct SQL query
  const { data: extensions, error } = await supabase
    .from('_realtime')
    .select('*')
    .limit(0)
    .then(() => {
      // Try to query extensions via raw SQL
      return supabase.rpc('exec_sql', {
        sql: `
          SELECT 
            EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') as pg_cron_enabled,
            EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_net') as pg_net_enabled
        `
      }).catch(() => ({ data: null, error: 'Cannot check extensions via RPC' }))
    })
    .catch(() => ({ data: null, error: 'Cannot check extensions' }))
  
  console.log("⚠️  Note: Extension check requires direct database access")
  console.log("   The migration will create extensions if they don't exist")
  
  return true
}

async function ensureAppSettings() {
  console.log("\n⚙️  Ensuring app_settings are configured...")
  
  // Update supabase_url if needed
  const { error: urlError } = await supabase
    .from('app_settings')
    .upsert({
      key: 'supabase_url',
      value: SUPABASE_URL,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'key'
    })
  
  if (urlError) {
    console.log("⚠️  Could not update supabase_url (might need to run migration first)")
  } else {
    console.log("✅ Updated supabase_url in app_settings")
  }
  
  // Update service_role_key
  const { error: keyError } = await supabase
    .from('app_settings')
    .upsert({
      key: 'supabase_service_role_key',
      value: SUPABASE_SERVICE_ROLE_KEY,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'key'
    })
  
  if (keyError) {
    console.log("⚠️  Could not update service_role_key (might need to run migration first)")
    return false
  } else {
    console.log("✅ Updated supabase_service_role_key in app_settings")
    return true
  }
}

async function runMigration() {
  console.log("\n📝 Running migration SQL...")
  
  const migrationPath = join(process.cwd(), 'supabase/migrations/076_schedule_custom_question_assignment_cron.sql')
  
  try {
    const migrationSQL = readFileSync(migrationPath, 'utf-8')
    
    // Replace placeholder with actual service role key
    const sql = migrationSQL.replace(
      "'YOUR_SERVICE_ROLE_KEY'",
      `'${SUPABASE_SERVICE_ROLE_KEY}'`
    )
    
    // Split SQL into individual statements and execute them
    // Note: Supabase client doesn't support multi-statement SQL directly
    // We'll need to execute via SQL editor or use a different approach
    
    console.log("⚠️  Direct SQL execution not supported via client")
    console.log("   Please run the migration SQL manually in Supabase SQL Editor")
    console.log(`   Migration file: ${migrationPath}`)
    
    return false
  } catch (error: any) {
    console.error("❌ Error reading migration file:", error.message)
    return false
  }
}

async function setupCronJob() {
  console.log("\n⏰ Setting up cron job...")
  
  // First, unschedule existing job if it exists
  const unscheduleSQL = `
    SELECT cron.unschedule('assign-custom-question-opportunity') 
    WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'assign-custom-question-opportunity'
    );
  `
  
  // Schedule the new job
  const scheduleSQL = `
    SELECT cron.schedule(
      'assign-custom-question-opportunity',
      '1 0 * * 1,4',
      $$
      SELECT
        net.http_post(
          url := get_app_setting('supabase_url') || '/functions/v1/assign-custom-question-opportunity',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || get_app_setting('supabase_service_role_key')
          ),
          body := '{}'::jsonb
        ) AS request_id;
      $$
    );
  `
  
  console.log("⚠️  Cron job setup requires direct SQL execution")
  console.log("   Please run the following SQL in Supabase SQL Editor:")
  console.log("\n" + "=".repeat(60))
  console.log("SQL to run:")
  console.log("=".repeat(60))
  console.log(unscheduleSQL)
  console.log("\n" + scheduleSQL)
  console.log("=".repeat(60))
  
  return false
}

async function verifyCronJob() {
  console.log("\n🔍 Verifying cron job...")
  
  const checkSQL = `
    SELECT 
      jobid,
      schedule,
      command,
      jobname,
      active
    FROM cron.job
    WHERE jobname = 'assign-custom-question-opportunity';
  `
  
  console.log("Run this SQL to verify:")
  console.log(checkSQL)
  
  return false
}

async function main() {
  console.log("=".repeat(60))
  console.log("Custom Question Assignment - Cron Setup")
  console.log("=".repeat(60))
  
  // Step 1: Check extensions (informational)
  await checkExtensions()
  
  // Step 2: Ensure app_settings are configured
  const settingsOk = await ensureAppSettings()
  
  if (!settingsOk) {
    console.log("\n⚠️  Could not update app_settings automatically")
    console.log("   This might be because the migration hasn't been run yet")
    console.log("   The migration will create the table if needed")
  }
  
  // Step 3: Show migration instructions
  console.log("\n" + "=".repeat(60))
  console.log("📋 SETUP INSTRUCTIONS")
  console.log("=".repeat(60))
  console.log("\nSince Supabase doesn't allow direct SQL execution via client,")
  console.log("you need to run the migration SQL manually:")
  console.log("\n1. Go to Supabase Dashboard → SQL Editor")
  console.log("2. Copy and paste the contents of:")
  console.log("   supabase/migrations/076_schedule_custom_question_assignment_cron.sql")
  console.log("3. Replace YOUR_SERVICE_ROLE_KEY with your actual key (or it will use the one from app_settings)")
  console.log("4. Run the SQL")
  console.log("\nAlternatively, use the Supabase CLI:")
  console.log("   supabase db push")
  console.log("\n" + "=".repeat(60))
  
  // Step 4: Show manual SQL
  await setupCronJob()
  
  // Step 5: Show verification query
  await verifyCronJob()
  
  console.log("\n✅ Setup instructions complete!")
  console.log("   After running the migration, the cron job will:")
  console.log("   - Run every Monday and Thursday at 12:01 AM UTC")
  console.log("   - Call assign-custom-question-opportunity Edge Function")
  console.log("   - Create opportunities for eligible groups")
}

main().catch((error) => {
  console.error("❌ Fatal error:", error)
  process.exit(1)
})
