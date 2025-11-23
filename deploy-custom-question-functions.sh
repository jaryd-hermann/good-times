#!/bin/bash

# Deploy Custom Question Feature Edge Functions
# Make sure you're logged into Supabase CLI: supabase login

echo "🚀 Deploying Custom Question Feature Edge Functions..."

echo "📦 Deploying check-custom-question-eligibility..."
supabase functions deploy check-custom-question-eligibility

echo "📦 Deploying assign-custom-question-opportunity..."
supabase functions deploy assign-custom-question-opportunity

echo "📦 Deploying send-custom-question-notifications..."
supabase functions deploy send-custom-question-notifications

echo "📦 Deploying process-skipped-custom-questions..."
supabase functions deploy process-skipped-custom-questions

echo "📦 Updating schedule-daily-prompts (now handles custom questions)..."
supabase functions deploy schedule-daily-prompts

echo "✅ All edge functions deployed successfully!"
echo ""
echo "⚠️  Don't forget to:"
echo "   1. Run the database migration (018_add_custom_questions.sql)"
echo "   2. Update cron jobs in Supabase SQL editor (002_add_cron_jobs.sql)"

