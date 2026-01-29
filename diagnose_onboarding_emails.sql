-- Diagnostic query to check onboarding email system
-- Run this to see what's happening

-- 1. Check if emails are scheduled and ready to send
SELECT 
  oes.id,
  oes.user_id,
  u.email,
  oes.email_type,
  oes.scheduled_for,
  oes.sent,
  oes.sent_at,
  oes.created_at,
  CASE 
    WHEN oes.sent = TRUE THEN '✅ ALREADY SENT'
    WHEN oes.scheduled_for <= NOW() THEN '⏰ READY TO SEND (overdue)'
    WHEN oes.scheduled_for > NOW() THEN '⏳ SCHEDULED (waiting)'
    ELSE '❓ UNKNOWN'
  END as status,
  EXTRACT(EPOCH FROM (NOW() - oes.scheduled_for)) / 60 as minutes_overdue
FROM onboarding_email_schedule oes
LEFT JOIN auth.users u ON u.id = oes.user_id
WHERE oes.sent = FALSE
ORDER BY oes.scheduled_for ASC
LIMIT 50;

-- 2. Check app_settings (CRITICAL - cron job will fail if these aren't configured)
SELECT 
  key,
  value,
  CASE 
    WHEN key = 'supabase_url' AND value LIKE '%YOUR_PROJECT_REF%' THEN '❌ NOT CONFIGURED (placeholder value)'
    WHEN key = 'supabase_anon_key' AND value = 'YOUR_ANON_KEY' THEN '❌ NOT CONFIGURED (placeholder value)'
    ELSE '✅ CONFIGURED'
  END as status
FROM app_settings
WHERE key IN ('supabase_url', 'supabase_anon_key');

-- 3. Check if cron job exists and is scheduled
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  CASE 
    WHEN active = TRUE THEN '✅ ACTIVE'
    ELSE '❌ INACTIVE'
  END as job_status
FROM cron.job
WHERE jobname = 'process-onboarding-emails';

-- 4. Check cron job execution history (if available)
SELECT 
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'process-onboarding-emails')
ORDER BY start_time DESC
LIMIT 10;

-- 5. Check for any email_logs entries (to see if send-email was ever called)
SELECT 
  COUNT(*) as total_email_logs,
  COUNT(*) FILTER (WHERE resend_id IS NOT NULL) as emails_with_resend_id,
  COUNT(*) FILTER (WHERE resend_id IS NULL) as emails_without_resend_id,
  MIN(created_at) as oldest_log,
  MAX(created_at) as newest_log
FROM email_logs;

-- 6. Check recent email_logs (if any exist)
SELECT 
  el.id,
  el.user_id,
  u.email as recipient_email,
  el.email_type,
  el.resend_id,
  el.created_at
FROM email_logs el
LEFT JOIN auth.users u ON u.id = el.user_id
ORDER BY el.created_at DESC
LIMIT 10;
