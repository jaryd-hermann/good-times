-- Migration: Update Notification Copy
-- Remove dynamic content (question text, comment text) from notifications
-- Goal: Users must open the app to see the actual content

-- Update: queue_new_comment_notification function
-- Change body from showing comment text to generic "See what they said"
CREATE OR REPLACE FUNCTION queue_new_comment_notification()
RETURNS TRIGGER AS $$
DECLARE
  commenter_name TEXT;
  entry_author_id UUID;
  entry_author_name TEXT;
  entry_group_id UUID;
  previous_commenter RECORD;
BEGIN
  BEGIN
    -- Get commenter's name with fallback (never NULL)
    SELECT COALESCE(name, 'Someone') INTO commenter_name 
    FROM users WHERE id = NEW.user_id;
    
    -- Get entry details
    SELECT user_id, group_id INTO entry_author_id, entry_group_id
    FROM entries WHERE id = NEW.entry_id;
    
    -- Get entry author's name with fallback
    SELECT COALESCE(name, 'Someone') INTO entry_author_name 
    FROM users WHERE id = entry_author_id;
    
    -- Validate we have required data
    IF entry_author_id IS NOT NULL 
       AND entry_group_id IS NOT NULL
       AND entry_author_name IS NOT NULL
       AND commenter_name IS NOT NULL 
       AND NEW.text IS NOT NULL THEN
      
      -- 1. Notify the entry author (if they didn't write the comment)
      IF entry_author_id != NEW.user_id THEN
        BEGIN
          INSERT INTO notification_queue (user_id, type, title, body, data)
          VALUES (
            entry_author_id,
            'new_comment',
            commenter_name || ' commented on your post',
            'See what they said',
            jsonb_build_object(
              'type', 'new_comment',
              'entry_id', NEW.entry_id,
              'group_id', entry_group_id,
              'commenter_id', NEW.user_id
            )
          );
        EXCEPTION WHEN OTHERS THEN
          -- Log error but don't fail the comment creation
          RAISE WARNING 'Failed to queue new_comment notification for entry author %: %', 
            entry_author_id, SQLERRM;
        END;
      END IF;
      
      -- 2. Notify all previous commenters on this entry (if they didn't write the comment)
      -- This includes users who have commented before, keeping them engaged in the thread
      -- Note: We exclude entry_author_id since they're already notified above with a different message
      FOR previous_commenter IN
        SELECT DISTINCT user_id 
        FROM comments 
        WHERE entry_id = NEW.entry_id 
          AND user_id != NEW.user_id  -- Don't notify the current commenter
          AND user_id != entry_author_id  -- Don't notify entry author again (already notified above)
      LOOP
        BEGIN
          INSERT INTO notification_queue (user_id, type, title, body, data)
          VALUES (
            previous_commenter.user_id,
            'comment_reply',
            commenter_name || ' replied to ' || entry_author_name || '''s answer',
            'See what they said',
            jsonb_build_object(
              'type', 'comment_reply',
              'entry_id', NEW.entry_id,
              'group_id', entry_group_id,
              'commenter_id', NEW.user_id
            )
          );
        EXCEPTION WHEN OTHERS THEN
          -- Log error but don't fail the comment creation
          RAISE WARNING 'Failed to queue comment_reply notification for user %: %', 
            previous_commenter.user_id, SQLERRM;
        END;
      END LOOP;
      
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If anything fails, log but don't prevent the comment creation
    RAISE WARNING 'Failed to queue comment thread notifications for comment %: %', 
      NEW.id, SQLERRM;
  END;
  
  -- Always return NEW so the comment creation succeeds regardless of notification status
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update: queue_new_entry_notification function
-- Change body from showing question text to generic "See their answer to today's question"
CREATE OR REPLACE FUNCTION queue_new_entry_notification()
RETURNS TRIGGER AS $$
DECLARE
  author_name TEXT;
  group_name TEXT;
  group_members RECORD;
BEGIN
  BEGIN
    -- Get author's name with fallback (never NULL)
    SELECT COALESCE(name, 'Someone') INTO author_name 
    FROM users WHERE id = NEW.user_id;
    
    -- Get group name with fallback
    SELECT COALESCE(name, 'your group') INTO group_name 
    FROM groups WHERE id = NEW.group_id;
    
    -- Only proceed if we have valid data
    IF author_name IS NOT NULL AND group_name IS NOT NULL THEN
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
            'See their answer to today''s question',
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

