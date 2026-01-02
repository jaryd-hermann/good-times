-- Add timezone column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';

-- Add scheduled_time column to notification_queue for time-based notifications
ALTER TABLE notification_queue
ADD COLUMN IF NOT EXISTS scheduled_time TIMESTAMPTZ;

-- Create index for efficient querying of scheduled notifications
CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled_time 
ON notification_queue(scheduled_time) 
WHERE processed = false AND scheduled_time IS NOT NULL;

COMMENT ON COLUMN users.timezone IS 'IANA timezone identifier (e.g., America/New_York, Europe/London)';
COMMENT ON COLUMN notification_queue.scheduled_time IS 'When to send this notification (for timezone-based scheduling). If NULL, send immediately.';

