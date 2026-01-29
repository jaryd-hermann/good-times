-- Query to check daily prompt notifications sent in the past 2 days
-- This shows both queued notifications (notification_queue) and sent notifications (notifications)

WITH past_two_days AS (
  -- Get date range for past 2 days
  SELECT 
    CURRENT_DATE - INTERVAL '2 days' as start_date,
    CURRENT_DATE as end_date
),
daily_prompt_queue AS (
  -- Get queued daily prompt notifications from notification_queue
  SELECT 
    nq.id,
    nq.user_id,
    nq.type,
    nq.title,
    nq.body,
    nq.data,
    nq.created_at as queued_at,
    nq.scheduled_time,
    nq.processed,
    u.name as user_name,
    u.timezone as user_timezone,
    g.name as group_name,
    (nq.data->>'group_id')::uuid as group_id,
    (nq.data->>'prompt_id')::uuid as prompt_id,
    p.question as prompt_question,
    'queued' as notification_status
  FROM notification_queue nq
  LEFT JOIN users u ON u.id = nq.user_id
  LEFT JOIN groups g ON g.id = (nq.data->>'group_id')::uuid
  LEFT JOIN prompts p ON p.id = (nq.data->>'prompt_id')::uuid
  CROSS JOIN past_two_days ptd
  WHERE nq.type = 'daily_prompt'
    AND nq.created_at >= ptd.start_date
    AND nq.created_at < ptd.end_date + INTERVAL '1 day' -- Include all of today
),
daily_prompt_sent AS (
  -- Get sent daily prompt notifications from notifications table
  SELECT 
    n.id,
    n.user_id,
    n.type,
    n.title,
    n.body,
    n.data,
    n.created_at as sent_at,
    NULL::timestamptz as scheduled_time,
    NULL::boolean as processed,
    u.name as user_name,
    u.timezone as user_timezone,
    g.name as group_name,
    (n.data->>'group_id')::uuid as group_id,
    (n.data->>'prompt_id')::uuid as prompt_id,
    p.question as prompt_question,
    'sent' as notification_status
  FROM notifications n
  LEFT JOIN users u ON u.id = n.user_id
  LEFT JOIN groups g ON g.id = (n.data->>'group_id')::uuid
  LEFT JOIN prompts p ON p.id = (n.data->>'prompt_id')::uuid
  CROSS JOIN past_two_days ptd
  WHERE n.type = 'daily_prompt'
    AND n.created_at >= ptd.start_date
    AND n.created_at < ptd.end_date + INTERVAL '1 day' -- Include all of today
),
combined_notifications AS (
  SELECT * FROM daily_prompt_queue
  UNION ALL
  SELECT * FROM daily_prompt_sent
)
SELECT 
  notification_status,
  DATE(COALESCE(scheduled_time, sent_at, queued_at)) as notification_date,
  TO_CHAR(COALESCE(scheduled_time, sent_at, queued_at), 'YYYY-MM-DD HH24:MI:SS TZ') as notification_timestamp,
  user_name,
  user_timezone,
  group_name,
  prompt_question,
  title as notification_title,
  body as notification_body,
  processed,
  CASE 
    WHEN scheduled_time IS NOT NULL THEN 
      TO_CHAR(scheduled_time, 'YYYY-MM-DD HH24:MI:SS TZ') || ' (scheduled for 8 AM ' || user_timezone || ')'
    ELSE NULL
  END as scheduled_for,
  CASE 
    WHEN notification_status = 'queued' AND processed = false THEN 'Pending'
    WHEN notification_status = 'queued' AND processed = true THEN 'Processed'
    WHEN notification_status = 'sent' THEN 'Sent'
    ELSE 'Unknown'
  END as current_status
FROM combined_notifications
ORDER BY 
  notification_date DESC,
  COALESCE(scheduled_time, sent_at, queued_at) DESC,
  group_name,
  user_name;

-- Summary statistics (run separately for cleaner output)
/*
WITH past_two_days AS (
  SELECT 
    CURRENT_DATE - INTERVAL '2 days' as start_date,
    CURRENT_DATE as end_date
)
SELECT 
  'Total Queued (unprocessed)' as metric,
  COUNT(*)::text as count
FROM notification_queue
CROSS JOIN past_two_days ptd
WHERE type = 'daily_prompt'
  AND created_at >= ptd.start_date
  AND created_at < ptd.end_date + INTERVAL '1 day'
  AND processed = false

UNION ALL

SELECT 
  'Total Queued (processed)' as metric,
  COUNT(*)::text as count
FROM notification_queue
CROSS JOIN past_two_days ptd
WHERE type = 'daily_prompt'
  AND created_at >= ptd.start_date
  AND created_at < ptd.end_date + INTERVAL '1 day'
  AND processed = true

UNION ALL

SELECT 
  'Total Sent' as metric,
  COUNT(*)::text as count
FROM notifications
CROSS JOIN past_two_days ptd
WHERE type = 'daily_prompt'
  AND created_at >= ptd.start_date
  AND created_at < ptd.end_date + INTERVAL '1 day';
*/
