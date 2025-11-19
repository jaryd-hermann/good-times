-- Migration: Setup email webhook for welcome emails
-- This webhook triggers when a user creates their first group (completes registration)
-- It sends a welcome email with their name and group name

-- Enable pg_net extension for HTTP requests (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop existing trigger and function if they exist (for updates/re-runs)
DROP TRIGGER IF EXISTS trigger_welcome_email_on_registration ON group_members;
DROP FUNCTION IF EXISTS send_welcome_email();

-- Create a function to call the send-email Edge Function
CREATE OR REPLACE FUNCTION send_welcome_email()
RETURNS TRIGGER AS $$
DECLARE
  project_url TEXT;
  anon_key TEXT;
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
    -- Get Supabase project URL and anon key from environment
    -- These should be set in your Supabase project settings
    project_url := current_setting('app.settings.supabase_url', true);
    anon_key := current_setting('app.settings.supabase_anon_key', true);
    
    -- If not set, use a placeholder (you'll need to replace these)
    -- For production, set these via: ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';
    IF project_url IS NULL OR project_url = '' THEN
      -- Fallback: construct from current database (requires manual update)
      -- You'll need to replace YOUR_PROJECT_REF with your actual project reference
      project_url := 'https://YOUR_PROJECT_REF.supabase.co';
    END IF;
    
    IF anon_key IS NULL OR anon_key = '' THEN
      -- You'll need to set this manually or use service_role_key
      -- For webhooks, anon_key is typically sufficient
      anon_key := 'YOUR_ANON_KEY';
    END IF;
    
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
-- The function checks if this is the user's first group to avoid duplicate emails
CREATE TRIGGER trigger_welcome_email_on_registration
AFTER INSERT ON group_members
FOR EACH ROW
EXECUTE FUNCTION send_welcome_email();

-- Note: After running this migration, you need to:
-- 1. Replace YOUR_PROJECT_REF with your actual Supabase project reference
-- 2. Replace YOUR_ANON_KEY with your actual Supabase anon key
-- 3. Or set them as database settings:
--    ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';
--    ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'your-anon-key';

