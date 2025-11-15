import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"
import { resolve } from "path"

dotenv.config({ path: resolve(__dirname, "../.env") })

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createAvatarsBucket() {
  console.log("Creating avatars bucket...")

  const { data, error } = await supabase.storage.createBucket("avatars", {
    public: true,
    fileSizeLimit: 5242880, // 5MB
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  })

  if (error) {
    if (error.message.includes("already exists")) {
      console.log("Bucket 'avatars' already exists")
    } else {
      console.error("Error creating bucket:", error)
      process.exit(1)
    }
  } else {
    console.log("Successfully created 'avatars' bucket")
  }
}

createAvatarsBucket()
  .then(() => {
    console.log("Done!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("Error:", error)
    process.exit(1)
  })

