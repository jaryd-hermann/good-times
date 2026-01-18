#!/bin/bash
# Backfill script to schedule prompts for missing dates
# Usage: ./backfill_script.sh

# Set your Supabase project URL and Service Role Key
# IMPORTANT: Get your Service Role Key from Supabase Dashboard > Settings > API > service_role key
SUPABASE_URL="https://ytnnsykbgohiscfgomfe.supabase.co"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0bm5zeWtiZ29oaXNjZmdvbWZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTg1MDEyNiwiZXhwIjoyMDc3NDI2MTI2fQ.9Mme2JYT_hrWbSjmw3Pnz054YEvxqM9vClI5rfvkvxw"  # Replace with actual service role key

# Missing dates to backfill (from Query 1 results)
DATES=(
  "2026-01-10"
  "2026-01-12"
  "2026-01-13"
  "2026-01-14"
  "2026-01-15"
  "2026-01-16"
  "2026-01-17"
)

echo "Starting backfill for ${#DATES[@]} dates..."

for date in "${DATES[@]}"; do
  echo "Scheduling prompts for date: $date"
  
  # Use a temp file to capture both response body and HTTP code (macOS compatible)
  temp_file=$(mktemp)
  http_code=$(curl -s -w "%{http_code}" -o "$temp_file" -X POST \
    "${SUPABASE_URL}/functions/v1/schedule-daily-prompts" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"date\": \"${date}\"}")
  
  body=$(cat "$temp_file")
  rm "$temp_file"
  
  if [ "$http_code" -eq 200 ]; then
    echo "✅ Successfully scheduled prompts for $date"
    echo "Response: $body"
  else
    echo "❌ Failed to schedule prompts for $date (HTTP $http_code)"
    echo "Response: $body"
    if [ "$http_code" -eq 401 ]; then
      echo "   → Authentication failed. Check that SERVICE_ROLE_KEY is correct."
    fi
  fi
  
  # Small delay to avoid rate limiting
  sleep 1
done

echo "Backfill complete!"
