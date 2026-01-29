-- Check which emails are due to be sent right now
-- Run this to see what emails should be sent immediately

SELECT 
  oes.id,
  oes.user_id,
  u.email as user_email,
  oes.email_type,
  oes.scheduled_for,
  oes.sent,
  oes.sent_at,
  CASE 
    WHEN oes.sent = TRUE THEN '✅ ALREADY SENT'
    WHEN oes.scheduled_for <= NOW() THEN '⏰ DUE NOW - Should be sent'
    WHEN oes.scheduled_for > NOW() THEN '⏳ SCHEDULED - Waiting'
    ELSE '❓ UNKNOWN'
  END as status,
  EXTRACT(EPOCH FROM (NOW() - oes.scheduled_for)) / 60 as minutes_overdue
FROM onboarding_email_schedule oes
LEFT JOIN auth.users u ON u.id = oes.user_id
WHERE oes.sent = FALSE
ORDER BY 
  CASE 
    WHEN oes.scheduled_for <= NOW() THEN 1  -- Due emails first
    ELSE 2
  END,
  oes.scheduled_for ASC
LIMIT 50;

-- Summary
SELECT 
  COUNT(*) FILTER (WHERE sent = FALSE AND scheduled_for <= NOW()) as due_now,
  COUNT(*) FILTER (WHERE sent = FALSE AND scheduled_for > NOW()) as scheduled_future,
  COUNT(*) FILTER (WHERE sent = TRUE) as already_sent,
  COUNT(*) as total
FROM onboarding_email_schedule;
