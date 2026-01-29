-- Check recent function invocations and errors
-- Run this in Supabase SQL Editor to see what went wrong

-- Note: Edge Function logs are in Supabase Dashboard, not SQL
-- But we can check the email_logs and scheduled emails to see what happened

-- Check for any recent email_logs entries (should have entries if emails were sent)
SELECT 
  COUNT(*) as total_logs,
  COUNT(*) FILTER (WHERE resend_id IS NOT NULL) as successful_sends,
  COUNT(*) FILTER (WHERE resend_id IS NULL) as failed_sends,
  MAX(created_at) as most_recent_log
FROM email_logs;

-- Check scheduled emails that should have been sent but weren't
SELECT 
  oes.id,
  oes.user_id,
  u.email,
  oes.email_type,
  oes.scheduled_for,
  oes.sent,
  oes.sent_at,
  CASE 
    WHEN oes.sent = FALSE AND oes.scheduled_for <= NOW() THEN '⏰ OVERDUE - Should have been sent'
    WHEN oes.sent = FALSE AND oes.scheduled_for > NOW() THEN '⏳ SCHEDULED - Waiting'
    WHEN oes.sent = TRUE THEN '✅ SENT'
    ELSE '❓ UNKNOWN'
  END as status,
  EXTRACT(EPOCH FROM (NOW() - oes.scheduled_for)) / 60 as minutes_overdue
FROM onboarding_email_schedule oes
LEFT JOIN auth.users u ON u.id = oes.user_id
WHERE oes.sent = FALSE
  AND oes.scheduled_for <= NOW()
ORDER BY oes.scheduled_for ASC
LIMIT 50;
