-- Migration: Fix Notification Triggers to be Defensive and Non-Blocking
-- This ensures that notification failures never prevent core operations (joins, entries, comments) from succeeding

-- Fix: queue_member_joined_notification function
-- Makes it defensive against NULL values and exceptions
CREATE OR REPLACE FUNCTION queue_member_joined_notification()
RETURNS TRIGGER AS $$
DECLARE
  new_member_name TEXT;
  group_name TEXT;
  group_members RECORD;
BEGIN
  BEGIN
    -- Get new member's name with fallback (never NULL)
    SELECT COALESCE(name, 'Someone') INTO new_member_name 
    FROM users WHERE id = NEW.user_id;
    
    -- Get group name with fallback (should never be NULL, but be safe)
    SELECT COALESCE(name, 'the group') INTO group_name 
    FROM groups WHERE id = NEW.group_id;
    
    -- Only proceed if we have valid data (defensive check)
    IF new_member_name IS NOT NULL AND group_name IS NOT NULL THEN
      -- Queue notifications for all existing members (except the new member)
      FOR group_members IN
        SELECT user_id FROM group_members 
        WHERE group_id = NEW.group_id AND user_id != NEW.user_id
      LOOP
        BEGIN
          INSERT INTO notification_queue (user_id, type, title, body, data)
          VALUES (
            group_members.user_id,
            'member_joined',
            new_member_name || ' joined ' || group_name,
            new_member_name || ' joined your group',
            jsonb_build_object(
              'type', 'member_joined',
              'group_id', NEW.group_id,
              'member_id', NEW.user_id
            )
          );
        EXCEPTION WHEN OTHERS THEN
          -- Log error but don't fail the join
          RAISE WARNING 'Failed to queue member_joined notification for user %: %', 
            group_members.user_id, SQLERRM;
        END;
      END LOOP;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If anything fails, log but don't prevent the join
    RAISE WARNING 'Failed to queue member_joined notifications for group %: %', 
      NEW.group_id, SQLERRM;
  END;
  
  -- Always return NEW so the join succeeds regardless of notification status
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix: queue_new_entry_notification function
-- Makes it defensive against NULL values and exceptions
CREATE OR REPLACE FUNCTION queue_new_entry_notification()
RETURNS TRIGGER AS $$
DECLARE
  author_name TEXT;
  group_name TEXT;
  prompt_question TEXT;
  group_members RECORD;
BEGIN
  BEGIN
    -- Get author's name with fallback (never NULL)
    SELECT COALESCE(name, 'Someone') INTO author_name 
    FROM users WHERE id = NEW.user_id;
    
    -- Get group name with fallback
    SELECT COALESCE(name, 'your group') INTO group_name 
    FROM groups WHERE id = NEW.group_id;
    
    -- Get prompt question with fallback
    SELECT COALESCE(question, 'A new post') INTO prompt_question 
    FROM prompts WHERE id = NEW.prompt_id;
    
    -- Only proceed if we have valid data
    IF author_name IS NOT NULL AND group_name IS NOT NULL AND prompt_question IS NOT NULL THEN
      -- Queue notifications for all group members (except the author)
      FOR group_members IN
        SELECT user_id FROM group_members 
        WHERE group_id = NEW.group_id AND user_id != NEW.user_id
      LOOP
        BEGIN
          INSERT INTO notification_queue (user_id, type, title, body, data)
          VALUES (
            group_members.user_id,
            'new_entry',
            author_name || ' shared in ' || group_name,
            prompt_question,
            jsonb_build_object(
              'type', 'new_entry',
              'group_id', NEW.group_id,
              'entry_id', NEW.id
            )
          );
        EXCEPTION WHEN OTHERS THEN
          -- Log error but don't fail the entry creation
          RAISE WARNING 'Failed to queue new_entry notification for user %: %', 
            group_members.user_id, SQLERRM;
        END;
      END LOOP;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If anything fails, log but don't prevent the entry creation
    RAISE WARNING 'Failed to queue new_entry notifications for entry %: %', 
      NEW.id, SQLERRM;
  END;
  
  -- Always return NEW so the entry creation succeeds regardless of notification status
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix: queue_new_comment_notification function
-- Makes it defensive against NULL values and exceptions
CREATE OR REPLACE FUNCTION queue_new_comment_notification()
RETURNS TRIGGER AS $$
DECLARE
  commenter_name TEXT;
  entry_author_id UUID;
  entry_group_id UUID;
BEGIN
  BEGIN
    -- Get commenter's name with fallback (never NULL)
    SELECT COALESCE(name, 'Someone') INTO commenter_name 
    FROM users WHERE id = NEW.user_id;
    
    -- Get entry details
    SELECT user_id, group_id INTO entry_author_id, entry_group_id
    FROM entries WHERE id = NEW.entry_id;
    
    -- Only notify the entry author (not the commenter) and if we have valid data
    IF entry_author_id IS NOT NULL 
       AND entry_author_id != NEW.user_id 
       AND commenter_name IS NOT NULL 
       AND NEW.text IS NOT NULL THEN
      BEGIN
        INSERT INTO notification_queue (user_id, type, title, body, data)
        VALUES (
          entry_author_id,
          'new_comment',
          commenter_name || ' commented on your post',
          NEW.text,
          jsonb_build_object(
            'type', 'new_comment',
            'entry_id', NEW.entry_id,
            'group_id', entry_group_id,
            'commenter_id', NEW.user_id
          )
        );
      EXCEPTION WHEN OTHERS THEN
        -- Log error but don't fail the comment creation
        RAISE WARNING 'Failed to queue new_comment notification for user %: %', 
          entry_author_id, SQLERRM;
      END;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If anything fails, log but don't prevent the comment creation
    RAISE WARNING 'Failed to queue new_comment notification for comment %: %', 
      NEW.id, SQLERRM;
  END;
  
  -- Always return NEW so the comment creation succeeds regardless of notification status
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: The triggers themselves don't need to be recreated, only the functions
-- The triggers will automatically use the updated functions

