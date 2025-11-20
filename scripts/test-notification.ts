/**
 * Script to manually trigger a test notification
 * 
 * Usage:
 *   npx tsx scripts/test-notification.ts "user_id_here"
 *   OR
 *   npx tsx scripts/test-notification.ts
 * 
 * Note: If user_id contains special characters, wrap it in quotes
 * 
 * This will:
 * 1. Insert a test notification into the notification_queue
 * 2. Call the process-notification-queue Edge Function to process it
 * 
 * If user_id is not provided, it will use the first user with a push token
 */

import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"
import { resolve } from "path"

dotenv.config({ path: resolve(__dirname, "../.env") })

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing environment variables!")
  console.error("")
  console.error("Please add these to your .env file:")
  console.error("  EXPO_PUBLIC_SUPABASE_URL=your_supabase_url")
  console.error("  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key")
  console.error("")
  console.error("You can find these in your Supabase Dashboard:")
  console.error("  - URL: Settings > API > Project URL")
  console.error("  - Service Role Key: Settings > API > service_role key (secret)")
  console.error("")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testNotification(userId?: string) {
  console.log("Testing notification...")

  // If no user_id provided, find first user with a push token
  let targetUserId = userId
  if (!targetUserId) {
    const { data: pushTokens, error: tokenError } = await supabase
      .from("push_tokens")
      .select("user_id")
      .limit(1)
      .maybeSingle()

    if (tokenError || !pushTokens) {
      console.error("Error finding user with push token:", tokenError)
      console.error("Please provide a user_id or ensure a user has registered for push notifications")
      process.exit(1)
    }

    targetUserId = pushTokens.user_id
    console.log(`Using user_id: ${targetUserId}`)
  }

  // Insert test notification into queue
  const { data: queueItem, error: queueError } = await supabase
    .from("notification_queue")
    .insert({
      user_id: targetUserId,
      type: "test",
      title: "Test Notification",
      body: "This is a test notification sent at " + new Date().toISOString(),
      data: { type: "test", timestamp: new Date().toISOString() },
      processed: false,
    })
    .select()
    .single()

  if (queueError) {
    console.error("Error inserting notification into queue:", queueError)
    process.exit(1)
  }

  console.log(`✓ Inserted notification into queue (id: ${queueItem.id})`)

  // Call the Edge Function to process the queue
  console.log("Calling process-notification-queue Edge Function...")
  const { data: functionData, error: functionError } = await supabase.functions.invoke(
    "process-notification-queue",
    {
      body: {},
    }
  )

  if (functionError) {
    console.error("Error calling Edge Function:", functionError)
    process.exit(1)
  }

  console.log("✓ Edge Function response:", JSON.stringify(functionData, null, 2))

  // Check if notification was processed
  const { data: processedItem } = await supabase
    .from("notification_queue")
    .select("processed")
    .eq("id", queueItem.id)
    .single()

  if (processedItem?.processed) {
    console.log("✓ Notification was successfully processed")
  } else {
    console.log("⚠ Notification is still in queue (may need to wait for cron job)")
  }

  // Check if notification was saved
  const { data: savedNotification } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", targetUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (savedNotification) {
    console.log("✓ Notification saved to notifications table:", savedNotification.id)
  }
}

const userId = process.argv[2]
testNotification(userId)
  .then(() => {
    console.log("\nDone!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("Error:", error)
    process.exit(1)
  })

