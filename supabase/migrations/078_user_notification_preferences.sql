-- Persist per-user notification preferences.
-- notifications_enabled: master switch for all pushes.
-- daily_question_notifications_enabled: specific switch for daily prompt pushes.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS daily_question_notifications_enabled boolean NOT NULL DEFAULT true;
