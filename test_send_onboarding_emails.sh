#!/bin/bash
# Test script to manually trigger onboarding emails
# Usage: ./test_send_onboarding_emails.sh [user_id]

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Testing Onboarding Email System${NC}\n"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo "Install it: npm install -g supabase"
    exit 1
fi

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo -e "${RED}❌ Not logged in to Supabase${NC}"
    echo "Run: supabase login"
    exit 1
fi

# Get project reference (you may need to set this)
PROJECT_REF=${SUPABASE_PROJECT_REF:-""}
if [ -z "$PROJECT_REF" ]; then
    echo -e "${YELLOW}⚠️  SUPABASE_PROJECT_REF not set${NC}"
    echo "Set it: export SUPABASE_PROJECT_REF=your-project-ref"
    echo "Or find it in: Supabase Dashboard → Settings → General → Reference ID"
    read -p "Enter your project reference: " PROJECT_REF
fi

# Get anon key (you may need to set this)
ANON_KEY=${SUPABASE_ANON_KEY:-""}
if [ -z "$ANON_KEY" ]; then
    echo -e "${YELLOW}⚠️  SUPABASE_ANON_KEY not set${NC}"
    echo "Find it in: Supabase Dashboard → Settings → API → Project API keys → anon public"
    read -p "Enter your anon key: " ANON_KEY
fi

echo -e "\n${GREEN}Step 1: Invoking process-onboarding-emails function...${NC}"

# Invoke the function
RESPONSE=$(curl -s -X POST \
  "https://${PROJECT_REF}.supabase.co/functions/v1/process-onboarding-emails" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

# Check if user_id was provided
if [ -n "$1" ]; then
    USER_ID=$1
    echo -e "\n${GREEN}Step 2: Checking email logs for user ${USER_ID}...${NC}"
    
    # Query email_logs (requires service role key or RLS policy)
    echo -e "${YELLOW}Note: To check email_logs, you'll need to run SQL in Supabase Dashboard${NC}"
    echo "Run this query:"
    echo ""
    echo "SELECT * FROM email_logs WHERE user_id = '${USER_ID}' ORDER BY created_at DESC;"
    echo ""
    echo "Or check scheduled emails:"
    echo ""
    echo "SELECT * FROM onboarding_email_schedule WHERE user_id = '${USER_ID}' ORDER BY scheduled_for ASC;"
fi

echo -e "\n${GREEN}✅ Done!${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Check Supabase Dashboard → Edge Functions → process-onboarding-emails → Logs"
echo "2. Check Resend Dashboard → Logs to see if emails were sent"
echo "3. Check email_logs table in Supabase SQL Editor"
