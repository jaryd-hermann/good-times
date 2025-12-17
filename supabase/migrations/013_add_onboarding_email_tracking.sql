-- Migration: Add onboarding email tracking
-- This migration creates a table to track which onboarding emails have been sent to users
-- and schedules follow-up emails in the onboarding sequence

-- Create email_logs table to track sent emails
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  resend_id TEXT,
  template_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_user_email_type ON email_logs(user_id, email_type);

-- Create onboarding_email_schedule table to track scheduled emails
CREATE TABLE IF NOT EXISTS onboarding_email_schedule (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, email_type)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_onboarding_schedule_user_id ON onboarding_email_schedule(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_schedule_scheduled_for ON onboarding_email_schedule(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_onboarding_schedule_pending ON onboarding_email_schedule(scheduled_for, sent) WHERE sent = false;

-- Function to schedule onboarding email sequence
CREATE OR REPLACE FUNCTION schedule_onboarding_emails(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_joined_at TIMESTAMPTZ;
BEGIN
  -- Get when user joined their first group
  SELECT MIN(joined_at) INTO v_joined_at
  FROM group_members
  WHERE user_id = p_user_id;
  
  -- If no join date found, use current time
  IF v_joined_at IS NULL THEN
    v_joined_at := NOW();
  END IF;
  
  -- Schedule follow-up emails (day 2-7 after joining)
  -- Day 2: 1 day after joining
  INSERT INTO onboarding_email_schedule (user_id, email_type, scheduled_for)
  VALUES (p_user_id, 'onboarding_day_2', v_joined_at + INTERVAL '1 day')
  ON CONFLICT (user_id, email_type) DO NOTHING;
  
  -- Day 3: 2 days after joining
  INSERT INTO onboarding_email_schedule (user_id, email_type, scheduled_for)
  VALUES (p_user_id, 'onboarding_day_3', v_joined_at + INTERVAL '2 days')
  ON CONFLICT (user_id, email_type) DO NOTHING;
  
  -- Day 4: 3 days after joining
  INSERT INTO onboarding_email_schedule (user_id, email_type, scheduled_for)
  VALUES (p_user_id, 'onboarding_day_4', v_joined_at + INTERVAL '3 days')
  ON CONFLICT (user_id, email_type) DO NOTHING;
  
  -- Day 5: 4 days after joining
  INSERT INTO onboarding_email_schedule (user_id, email_type, scheduled_for)
  VALUES (p_user_id, 'onboarding_day_5', v_joined_at + INTERVAL '4 days')
  ON CONFLICT (user_id, email_type) DO NOTHING;
  
  -- Day 6: 5 days after joining
  INSERT INTO onboarding_email_schedule (user_id, email_type, scheduled_for)
  VALUES (p_user_id, 'onboarding_day_6', v_joined_at + INTERVAL '5 days')
  ON CONFLICT (user_id, email_type) DO NOTHING;
  
  -- Day 7: 6 days after joining
  INSERT INTO onboarding_email_schedule (user_id, email_type, scheduled_for)
  VALUES (p_user_id, 'onboarding_day_7', v_joined_at + INTERVAL '6 days')
  ON CONFLICT (user_id, email_type) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the welcome email trigger to also schedule follow-up emails
CREATE OR REPLACE FUNCTION send_welcome_email()
RETURNS TRIGGER AS $$
DECLARE
  project_url TEXT;
  anon_key TEXT;
  edge_function_url TEXT;
  existing_memberships INTEGER;
BEGIN
  -- Check if this is the user's first group membership
  SELECT COUNT(*) INTO existing_memberships
  FROM group_members
  WHERE user_id = NEW.user_id
    AND id != NEW.id;
  
  -- Only send email if this is their first group membership
  IF existing_memberships = 0 THEN
    -- Get Supabase project URL and anon key from environment
    project_url := current_setting('app.settings.supabase_url', true);
    anon_key := current_setting('app.settings.supabase_anon_key', true);
    
    IF project_url IS NULL OR project_url = '' THEN
      project_url := 'https://ytnnsykbgohiscfgomfe.supabase.co';
    END IF;
    
    IF anon_key IS NULL OR anon_key = '' THEN
      anon_key := 'YOUR_ANON_KEY';
    END IF;
    
    edge_function_url := project_url || '/functions/v1/send-email';
    
    -- Call the Edge Function asynchronously (fire and forget)
    PERFORM
      net.http_post(
        url := edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || anon_key
        ),
        body := jsonb_build_object(
          'email_type', 'welcome',
          'user_id', NEW.user_id,
          'group_id', NEW.group_id
        )
      );
    
    -- Schedule follow-up onboarding emails
    PERFORM schedule_onboarding_emails(NEW.user_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: After running this migration, you need to:
-- 1. Set up a cron job or scheduled function to process pending emails
-- 2. The cron job should call a function that checks onboarding_email_schedule
--    for emails scheduled_for <= NOW() where sent = false
-- 3. For each pending email, call the send-email Edge Function
-- 4. Mark the email as sent in onboarding_email_schedule

