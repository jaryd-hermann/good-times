-- 129: turn off the last v1 push senders.
--
-- A birthday-card push went out to a real user on 2026-08-06 for a feature v2
-- does not have. These crons survived the earlier v1 cleanup because they push
-- DIRECTLY to Expo (https://exp.host/--/api/v2/push/send) using push_tokens,
-- rather than inserting into notification_queue — so every audit that looked at
-- the queue showed nothing and they stayed invisible.
--
-- v2 still has birthdays; they are a different mechanism entirely. Cron 57
-- (v2-emit-birthdays -> v2_emit_birthday_messages) posts an in-thread system
-- message, which is untouched here. What is retired is the v1 birthday CARD
-- flow and the v1 custom-question flow, neither of which exists in v2.
--
-- Left ACTIVE on purpose: schedule-daily-prompts and the personalization jobs.
-- They send no pushes (verified: no exp.host or onesignal call in any of them)
-- and only maintain v1 tables. v2 reads `prompts` as a question bank but never
-- group_prompt_queue, so retiring them is a separate cleanup, not a push fix.
--
-- Already applied to production via cron.alter_job on 2026-08-06; this file
-- exists so a rebuilt database does not silently resurrect them.

DO $$
DECLARE
  v_job text;
  -- Every remaining v1 job that can reach a device.
  v_retired text[] := ARRAY[
    -- birthday cards: create -> publish -> three separate push senders
    'create-birthday-cards',
    'publish-birthday-cards',
    'send-birthday-card-notifications',
    'send-birthday-card-reminders',
    'send-birthday-card-ready-notification',
    -- custom questions: eligibility -> assignment -> two daily push sends
    'check-custom-question-eligibility',
    'assign-custom-question-opportunity',
    'process-skipped-custom-questions',
    'send-custom-question-notifications-8am',
    'send-custom-question-notifications-4pm'
  ];
BEGIN
  FOREACH v_job IN ARRAY v_retired LOOP
    -- Guarded: a fresh database may never have created these jobs at all, and
    -- alter_job on a missing name would abort the whole migration.
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = v_job) THEN
      PERFORM cron.alter_job(jobid, active := false)
      FROM cron.job WHERE jobname = v_job;
    END IF;
  END LOOP;
END $$;
