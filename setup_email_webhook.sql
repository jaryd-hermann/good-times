-- ============================================================================
-- Email Webhook Setup Script
-- ============================================================================
-- This script sets up the welcome email trigger that sends an email when
-- a user joins their first group (either by creating a group or joining an existing one).
--
-- BEFORE RUNNING:
-- 1. Replace YOUR_PROJECT_REF below with your Supabase project reference
--    (found in your Supabase project URL: https://YOUR_PROJECT_REF.supabase.co)
-- 2. Replace YOUR_ANON_KEY below with your Supabase anon key
--    (found in Supabase Dashboard → Project Settings → API → anon/public key)
-- ============================================================================

-- Enable pg_net extension for HTTP requests (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop existing trigger and function if they exist (for updates/re-runs)
DROP TRIGGER IF EXISTS trigger_welcome_email_on_registration ON group_members;
DROP FUNCTION IF EXISTS send_welcome_email();

-- Create a function to call the send-email Edge Function
CREATE OR REPLACE FUNCTION send_welcome_email()
RETURNS TRIGGER AS $$
DECLARE
  project_url TEXT := 'https://YOUR_PROJECT_REF.supabase.co';
  anon_key TEXT := 'YOUR_ANON_KEY';
  edge_function_url TEXT;
  existing_memberships INTEGER;
BEGIN
  -- Check if this is the user's first group membership
  -- Only send welcome email on first group join (not subsequent groups)
  SELECT COUNT(*) INTO existing_memberships
  FROM group_members
  WHERE user_id = NEW.user_id
    AND id != NEW.id; -- Exclude the current insert
  
  -- Only send email if this is their first group membership
  IF existing_memberships = 0 THEN
    -- Construct Edge Function URL
    edge_function_url := project_url || '/functions/v1/send-email';
    
    -- Call the Edge Function asynchronously (fire and forget)
    -- This prevents blocking the INSERT operation
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
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on group_members INSERT
-- Triggers for ALL new group memberships (both admins creating groups and users joining)
CREATE TRIGGER trigger_welcome_email_on_registration
AFTER INSERT ON group_members
FOR EACH ROW
EXECUTE FUNCTION send_welcome_email();

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After running, verify the trigger was created:
-- SELECT * FROM pg_trigger WHERE tgname = 'trigger_welcome_email_on_registration';
--
-- Verify the function exists:
-- SELECT * FROM pg_proc WHERE proname = 'send_welcome_email';
-- ============================================================================

