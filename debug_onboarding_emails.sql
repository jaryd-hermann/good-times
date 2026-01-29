-- Debug query to check onboarding email system status
-- This helps identify why onboarding emails aren't being sent

-- 1. Check recent user signups and their email schedules
WITH recent_users AS (
  SELECT 
    id as user_id,
    email,
    created_at as user_created_at
  FROM auth.users
  WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
  ORDER BY created_at DESC
  LIMIT 20
),
user_groups AS (
  SELECT 
    ru.user_id,
    ru.email,
    ru.user_created_at,
    COUNT(gm.id) as group_count,
    MIN(gm.joined_at) as first_group_joined_at
  FROM recent_users ru
  LEFT JOIN group_members gm ON gm.user_id = ru.user_id
  GROUP BY ru.user_id, ru.email, ru.user_created_at
),
email_schedules AS (
  SELECT 
    ug.*,
    oes.email_type,
    oes.scheduled_for,
    oes.sent,
    oes.sent_at,
    oes.created_at as schedule_created_at
  FROM user_groups ug
  LEFT JOIN onboarding_email_schedule oes ON oes.user_id = ug.user_id
)
SELECT 
  user_id,
  email,
  user_created_at,
  group_count,
  first_group_joined_at,
  CASE 
    WHEN group_count = 0 THEN '❌ NO GROUPS - Emails not scheduled (trigger requires group_members insert)'
    WHEN group_count > 0 AND email_type IS NULL THEN '⚠️ HAS GROUPS BUT NO EMAIL SCHEDULE - Trigger may have failed'
    ELSE '✅ Email schedule exists'
  END as status,
  email_type,
  scheduled_for,
  sent,
  sent_at,
  schedule_created_at,
  CASE 
    WHEN scheduled_for IS NOT NULL AND scheduled_for <= NOW() AND sent = FALSE THEN '⏰ OVERDUE - Should have been sent'
    WHEN scheduled_for IS NOT NULL AND scheduled_for > NOW() AND sent = FALSE THEN '⏳ PENDING - Waiting for scheduled time'
    WHEN sent = TRUE THEN '✅ SENT'
    ELSE '❓ UNKNOWN'
  END as email_status
FROM email_schedules
ORDER BY user_created_at DESC, email_type;

-- 2. Check if trigger exists and is enabled
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as enabled,
  CASE tgenabled
    WHEN 'O' THEN '✅ ENABLED'
    WHEN 'D' THEN '❌ DISABLED'
    WHEN 'R' THEN '⚠️ REPLICA'
    WHEN 'A' THEN '✅ ALWAYS'
    ELSE '❓ UNKNOWN'
  END as trigger_status
FROM pg_trigger
WHERE tgname = 'trigger_welcome_email_on_registration';

-- 3. Check recent group_members inserts to see if trigger fired
SELECT 
  gm.id,
  gm.user_id,
  u.email,
  gm.group_id,
  g.name as group_name,
  gm.joined_at as group_member_joined_at,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM onboarding_email_schedule oes 
      WHERE oes.user_id = gm.user_id 
      AND oes.created_at >= gm.joined_at - INTERVAL '1 minute'
      AND oes.created_at <= gm.joined_at + INTERVAL '1 minute'
    ) THEN '✅ Email schedule created (trigger fired)'
    ELSE '❌ NO EMAIL SCHEDULE - Trigger may not have fired'
  END as trigger_status
FROM group_members gm
INNER JOIN auth.users u ON u.id = gm.user_id
LEFT JOIN groups g ON g.id = gm.group_id
WHERE gm.joined_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
ORDER BY gm.joined_at DESC
LIMIT 20;

-- 4. Check email_logs for any sent emails
-- Based on send-email function code, these columns definitely exist: id, user_id, email_type, resend_id, template_data
-- Using only columns that are definitely inserted by the code (no date filtering since we don't know which date column exists)
SELECT 
  el.id,
  el.user_id,
  u.email as recipient_email,
  el.email_type,
  el.resend_id,
  CASE 
    WHEN el.resend_id IS NOT NULL THEN '✅ SENT (has resend_id)'
    ELSE '⚠️ NO RESEND_ID (may have failed)'
  END as log_status
FROM email_logs el
LEFT JOIN auth.users u ON u.id = el.user_id
ORDER BY el.id DESC
LIMIT 20;

-- 5. Summary statistics
SELECT 
  '=== SUMMARY ===' as section,
  NULL::uuid as user_id,
  NULL::text as email,
  NULL::timestamp with time zone as user_created_at,
  NULL::bigint as group_count,
  NULL::timestamp with time zone as first_group_joined_at,
  NULL::text as status,
  NULL::text as email_type,
  NULL::timestamp with time zone as scheduled_for,
  NULL::boolean as sent,
  NULL::timestamp with time zone as sent_at,
  NULL::timestamp with time zone as schedule_created_at,
  NULL::text as email_status

UNION ALL

SELECT 
  'Total users created (last 7 days)' as section,
  NULL::uuid,
  NULL::text,
  NULL::timestamp with time zone,
  COUNT(*)::bigint,
  NULL::timestamp with time zone,
  NULL::text,
  NULL::text,
  NULL::timestamp with time zone,
  NULL::boolean,
  NULL::timestamp with time zone,
  NULL::timestamp with time zone,
  NULL::text
FROM auth.users
WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'

UNION ALL

SELECT 
  'Users with groups (last 7 days)' as section,
  NULL::uuid,
  NULL::text,
  NULL::timestamp with time zone,
  COUNT(DISTINCT gm.user_id)::bigint,
  NULL::timestamp with time zone,
  NULL::text,
  NULL::text,
  NULL::timestamp with time zone,
  NULL::boolean,
  NULL::timestamp with time zone,
  NULL::timestamp with time zone,
  NULL::text
FROM group_members gm
WHERE gm.joined_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'

UNION ALL

SELECT 
  'Email schedules created (last 7 days)' as section,
  NULL::uuid,
  NULL::text,
  NULL::timestamp with time zone,
  COUNT(*)::bigint,
  NULL::timestamp with time zone,
  NULL::text,
  NULL::text,
  NULL::timestamp with time zone,
  NULL::boolean,
  NULL::timestamp with time zone,
  NULL::timestamp with time zone,
  NULL::text
FROM onboarding_email_schedule
WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'

UNION ALL

SELECT 
  'Emails sent (last 7 days - has resend_id)' as section,
  NULL::uuid,
  NULL::text,
  NULL::timestamp with time zone,
  COUNT(*)::bigint,
  NULL::timestamp with time zone,
  NULL::text,
  NULL::text,
  NULL::timestamp with time zone,
  NULL::boolean,
  NULL::timestamp with time zone,
  NULL::timestamp with time zone,
  NULL::text
FROM email_logs
WHERE resend_id IS NOT NULL

UNION ALL

SELECT 
  'Email logs without resend_id' as section,
  NULL::uuid,
  NULL::text,
  NULL::timestamp with time zone,
  COUNT(*)::bigint,
  NULL::timestamp with time zone,
  NULL::text,
  NULL::text,
  NULL::timestamp with time zone,
  NULL::boolean,
  NULL::timestamp with time zone,
  NULL::timestamp with time zone,
  NULL::text
FROM email_logs
WHERE resend_id IS NULL;
