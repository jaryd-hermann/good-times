-- Create onboarding_email_schedule table to track scheduled onboarding emails
CREATE TABLE IF NOT EXISTS onboarding_email_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL CHECK (email_type IN (
    'welcome',
    'onboarding_day_2',
    'onboarding_day_3',
    'onboarding_day_4',
    'onboarding_day_5',
    'onboarding_day_6',
    'onboarding_day_7'
  )),
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, email_type)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_onboarding_email_schedule_user ON onboarding_email_schedule(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_email_schedule_scheduled ON onboarding_email_schedule(scheduled_for) WHERE sent = FALSE;
CREATE INDEX IF NOT EXISTS idx_onboarding_email_schedule_sent ON onboarding_email_schedule(sent, scheduled_for);

-- Create email_logs table to track sent emails
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  error_message TEXT,
  resend_id TEXT -- Resend API email ID for tracking
);

-- Create index for email logs
CREATE INDEX IF NOT EXISTS idx_email_logs_user ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at);

-- Function to schedule onboarding emails for a new user
CREATE OR REPLACE FUNCTION schedule_onboarding_emails(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_created_at TIMESTAMPTZ;
  welcome_time TIMESTAMPTZ;
  day2_time TIMESTAMPTZ;
  day3_time TIMESTAMPTZ;
  day4_time TIMESTAMPTZ;
  day5_time TIMESTAMPTZ;
  day6_time TIMESTAMPTZ;
  day7_time TIMESTAMPTZ;
BEGIN
  -- Get user creation time
  SELECT created_at INTO user_created_at
  FROM auth.users
  WHERE id = p_user_id;
  
  IF user_created_at IS NULL THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;
  
  -- Schedule welcome email immediately (or very soon)
  welcome_time := user_created_at + INTERVAL '5 minutes';
  
  -- Schedule follow-up emails: day 2-7 after user creation
  day2_time := user_created_at + INTERVAL '1 day';
  day3_time := user_created_at + INTERVAL '2 days';
  day4_time := user_created_at + INTERVAL '3 days';
  day5_time := user_created_at + INTERVAL '4 days';
  day6_time := user_created_at + INTERVAL '5 days';
  day7_time := user_created_at + INTERVAL '6 days';
  
  -- Insert email schedule entries (using ON CONFLICT to prevent duplicates)
  INSERT INTO onboarding_email_schedule (user_id, email_type, scheduled_for)
  VALUES
    (p_user_id, 'welcome', welcome_time),
    (p_user_id, 'onboarding_day_2', day2_time),
    (p_user_id, 'onboarding_day_3', day3_time),
    (p_user_id, 'onboarding_day_4', day4_time),
    (p_user_id, 'onboarding_day_5', day5_time),
    (p_user_id, 'onboarding_day_6', day6_time),
    (p_user_id, 'onboarding_day_7', day7_time)
  ON CONFLICT (user_id, email_type) DO NOTHING;
END;
$$;

-- Trigger function that fires when a user joins a group
-- This schedules the welcome email series
CREATE OR REPLACE FUNCTION trigger_welcome_email_on_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only schedule emails for new group members (not updates)
  IF TG_OP = 'INSERT' THEN
    -- Schedule onboarding emails for the new user
    -- Only schedule if this is their first group (to avoid duplicate schedules)
    IF NOT EXISTS (
      SELECT 1 FROM group_members 
      WHERE user_id = NEW.user_id 
      AND id != NEW.id
    ) THEN
      PERFORM schedule_onboarding_emails(NEW.user_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on group_members table
DROP TRIGGER IF EXISTS trigger_welcome_email_on_registration ON group_members;
CREATE TRIGGER trigger_welcome_email_on_registration
  AFTER INSERT ON group_members
  FOR EACH ROW
  EXECUTE FUNCTION trigger_welcome_email_on_registration();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON onboarding_email_schedule TO authenticated;
GRANT SELECT, INSERT ON email_logs TO authenticated;

COMMENT ON TABLE onboarding_email_schedule IS 'Tracks scheduled onboarding emails for new users';
COMMENT ON TABLE email_logs IS 'Logs of all emails sent through the system';
COMMENT ON FUNCTION schedule_onboarding_emails IS 'Schedules the 7-day onboarding email series for a new user';
