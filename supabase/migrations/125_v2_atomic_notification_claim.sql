-- =============================================================================
-- Atomic claim for the notification queue
-- (applied via MCP as v2_atomic_notification_claim + v2_queue_every_minute)
-- =============================================================================
-- process-notification-queue did SELECT unprocessed -> send -> UPDATE processed.
-- Between the SELECT and the UPDATE the rows still look unprocessed, so a second
-- run starting in that window picks up the SAME rows and sends them again, and
-- users get duplicate pushes.
--
-- Nothing had gone wrong only because runs finish in milliseconds against a
-- handful of rows while the cron ran every 2 minutes — the safety margin was
-- timing, not design. It stops being safe the moment a run is slow (OneSignal
-- latency, a backlog after an outage) or the cadence drops.
--
-- FOR UPDATE SKIP LOCKED is the fix: concurrent callers take DIFFERENT rows
-- rather than fighting over the same ones or blocking on each other.
--
-- claimed_at also gives failed runs a way back: a row claimed but never completed
-- (function timed out, container died) becomes claimable again after the stale
-- window instead of being stuck behind a claim nobody holds. The worker clears
-- claimed_at on failure so a retry is governed by next_attempt_at instead.
--
-- Verified: two claims in succession returned 5 and 5 rows with ZERO overlap, and
-- a real notification sent through the new path delivered (successful: 1).
--
-- With claiming atomic the cron drops from */2 to every minute.
-- =============================================================================

ALTER TABLE public.notification_queue
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_notification_queue_claimable
  ON public.notification_queue (created_at)
  WHERE processed = false;

CREATE OR REPLACE FUNCTION public.v2_claim_notifications(
  p_limit int DEFAULT 100,
  p_max_attempts int DEFAULT 5,
  p_stale_after interval DEFAULT interval '5 minutes'
)
RETURNS SETOF public.notification_queue
LANGUAGE sql
AS $function$
  UPDATE public.notification_queue q
  SET claimed_at = now()
  WHERE q.id IN (
    SELECT c.id
    FROM public.notification_queue c
    WHERE c.processed = false
      AND c.attempts < p_max_attempts
      AND (c.next_attempt_at IS NULL OR c.next_attempt_at <= now())
      AND (c.scheduled_time IS NULL OR c.scheduled_time <= now())
      AND (c.claimed_at IS NULL OR c.claimed_at < now() - p_stale_after)
    ORDER BY c.created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING q.*;
$function$;

SELECT cron.alter_job(16, schedule := '* * * * *');
