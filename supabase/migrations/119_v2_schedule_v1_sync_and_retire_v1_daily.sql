-- =============================================================================
-- Schedule the v1 -> v2 sync, and retire v1's daily prompt sender
-- =============================================================================

-- Run the v1 -> v2 sync continuously until every user has upgraded.
-- Created as jobid 67.
SELECT cron.schedule('v2-sync-from-v1', '*/15 * * * *', $$SELECT public.v2_sync_from_v1();$$);

-- Retire v1's daily prompt sender (cron job 50, send-daily-notifications).
--
-- It is not delivering anything today. It gates on the user holding an
-- ExponentPushToken and then inserts into notification_queue — but the queue is
-- now drained by the v2 worker, which targets OneSignal by external_id. No v1
-- user has an external_id, so those rows (115 in the last three days) resolve to
-- nobody and are marked processed. Turning it off removes nothing that works.
--
-- Leaving it on is the actual risk: it queues one row PER GROUP per user, so the
-- moment somebody upgrades and gets an external_id they would receive v1's
-- per-group prompts on top of v2's single daily question.
--
-- Job 14 (schedule-daily-prompts) stays ACTIVE on purpose — it populates the
-- per-group questions that users still on the v1 binary need in-app. Job 45
-- (run-daily-personalization-tasks) stays active for the same reason.
--
-- cron.job is not directly updatable by the migration role; alter_job is the
-- supported path.
SELECT cron.alter_job(50, active := false);
