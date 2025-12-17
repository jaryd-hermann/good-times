#!/usr/bin/env tsx
/**
 * Setup Email Migrations Script
 * 
 * Updates migration files with your Supabase project URL and anon key
 * 
 * Usage: tsx scripts/setup-email-migrations.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

// Read project ref from Supabase temp directory
function getProjectRef(): string | null {
  const projectRefPath = path.join(process.cwd(), 'supabase', '.temp', 'project-ref')
  if (fs.existsSync(projectRefPath)) {
    return fs.readFileSync(projectRefPath, 'utf-8').trim()
  }
  return null
}

// Read anon key from environment or prompt user
async function getAnonKey(): Promise<string> {
  // Try to read from environment first
  const envAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  
  if (envAnonKey) {
    console.log('✓ Found anon key in environment variables')
    return envAnonKey
  }

  // Prompt user for anon key
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise((resolve) => {
    rl.question('Enter your Supabase anon key (or press Enter to skip and set manually): ', (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

// Update migration file with project details
function updateMigrationFile(filePath: string, projectRef: string, anonKey: string): void {
  if (!fs.existsSync(filePath)) {
    console.error(`✗ Migration file not found: ${filePath}`)
    return
  }

  let content = fs.readFileSync(filePath, 'utf-8')
  let updated = false

  // Replace project ref placeholders
  const projectUrl = `https://${projectRef}.supabase.co`
  if (content.includes('YOUR_PROJECT_REF')) {
    content = content.replace(/YOUR_PROJECT_REF/g, projectRef)
    content = content.replace(/https:\/\/YOUR_PROJECT_REF\.supabase\.co/g, projectUrl)
    updated = true
  }

  // Replace anon key placeholder (only if provided)
  if (anonKey && content.includes('YOUR_ANON_KEY')) {
    content = content.replace(/YOUR_ANON_KEY/g, anonKey)
    updated = true
  }

  if (updated) {
    fs.writeFileSync(filePath, content, 'utf-8')
    console.log(`✓ Updated: ${path.basename(filePath)}`)
  } else {
    console.log(`- No changes needed: ${path.basename(filePath)}`)
  }
}

async function main() {
  console.log('🔧 Setting up email migration files...\n')

  // Get project ref
  const projectRef = getProjectRef()
  if (!projectRef) {
    console.error('✗ Could not find project reference in supabase/.temp/project-ref')
    console.log('\nPlease run this script from your project root, or set up Supabase CLI first.')
    process.exit(1)
  }

  console.log(`✓ Found project reference: ${projectRef}`)
  const projectUrl = `https://${projectRef}.supabase.co`
  console.log(`✓ Project URL: ${projectUrl}\n`)

  // Get anon key
  const anonKey = await getAnonKey()
  if (!anonKey) {
    console.log('\n⚠️  No anon key provided. You\'ll need to update the migration files manually.')
    console.log('   Or set EXPO_PUBLIC_SUPABASE_ANON_KEY environment variable and run again.\n')
  }

  // Update migration files
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
  
  const migration013 = path.join(migrationsDir, '013_add_onboarding_email_tracking.sql')
  const migration014 = path.join(migrationsDir, '014_add_onboarding_email_cron.sql')

  console.log('\nUpdating migration files...')
  updateMigrationFile(migration013, projectRef, anonKey)
  updateMigrationFile(migration014, projectRef, anonKey)

  console.log('\n✅ Migration files updated!')
  console.log('\nNext steps:')
  console.log('1. Review the updated migration files')
  if (!anonKey) {
    console.log('2. Add your anon key to migration 014 (or set as database setting)')
  }
  console.log('3. Deploy the Edge Function: supabase functions deploy process-onboarding-emails')
  console.log('4. Run the migrations in your Supabase dashboard or via CLI')
  console.log('\nTo set anon key as database setting, run:')
  console.log(`   ALTER DATABASE postgres SET app.settings.supabase_url = '${projectUrl}';`)
  if (anonKey) {
    console.log(`   ALTER DATABASE postgres SET app.settings.supabase_anon_key = '${anonKey}';`)
  } else {
    console.log(`   ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'YOUR_ANON_KEY';`)
  }
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})

