/**
 * Script to create the entries-media storage bucket in Supabase
 * 
 * Run this script with:
 * npx tsx scripts/create-storage-bucket.ts
 * 
 * Or use the Supabase Dashboard:
 * 1. Go to Storage in your Supabase project
 * 2. Click "New bucket"
 * 3. Name: "entries-media"
 * 4. Public: true (checked)
 * 5. Click "Create bucket"
 */

import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Error: Missing environment variables")
  console.error("Please set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

// Use service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function createBucket() {
  console.log("Creating entries-media bucket...")

  const { data, error } = await supabase.storage.createBucket("entries-media", {
    public: true, // Make bucket public so getPublicUrl works
    fileSizeLimit: 52428800, // 50MB limit
    allowedMimeTypes: ["image/*", "video/*", "audio/*"],
  })

  if (error) {
    if (error.message.includes("already exists")) {
      console.log("✓ Bucket 'entries-media' already exists")
      return
    }
    console.error("Error creating bucket:", error)
    process.exit(1)
  }

  console.log("✓ Successfully created bucket 'entries-media'")
  console.log("Next step: Run migration 003_create_storage_bucket.sql to set up RLS policies")
}

createBucket().catch((error) => {
  console.error("Unexpected error:", error)
  process.exit(1)
})

