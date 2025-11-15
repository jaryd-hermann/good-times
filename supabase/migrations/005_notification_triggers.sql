-- Notification queue table for processing notifications asynchronously
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to queue notification when member joins group
CREATE OR REPLACE FUNCTION queue_member_joined_notification()
RETURNS TRIGGER AS $$
DECLARE
  new_member_name TEXT;
  group_name TEXT;
  group_members RECORD;
BEGIN
  -- Get new member's name
  SELECT name INTO new_member_name FROM users WHERE id = NEW.user_id;
  
  -- Get group name
  SELECT name INTO group_name FROM groups WHERE id = NEW.group_id;
  
  -- Queue notifications for all existing members (except the new member)
  FOR group_members IN
    SELECT user_id FROM group_members 
    WHERE group_id = NEW.group_id AND user_id != NEW.user_id
  LOOP
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
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for member join
DROP TRIGGER IF EXISTS on_member_joined ON group_members;
CREATE TRIGGER on_member_joined
AFTER INSERT ON group_members
FOR EACH ROW
EXECUTE FUNCTION queue_member_joined_notification();

-- Function to queue notification when entry is created
CREATE OR REPLACE FUNCTION queue_new_entry_notification()
RETURNS TRIGGER AS $$
DECLARE
  author_name TEXT;
  group_name TEXT;
  prompt_question TEXT;
  group_members RECORD;
BEGIN
  -- Get author's name
  SELECT name INTO author_name FROM users WHERE id = NEW.user_id;
  
  -- Get group name
  SELECT name INTO group_name FROM groups WHERE id = NEW.group_id;
  
  -- Get prompt question
  SELECT question INTO prompt_question FROM prompts WHERE id = NEW.prompt_id;
  
  -- Queue notifications for all group members (except the author)
  FOR group_members IN
    SELECT user_id FROM group_members 
    WHERE group_id = NEW.group_id AND user_id != NEW.user_id
  LOOP
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
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for new entry
DROP TRIGGER IF EXISTS on_new_entry ON entries;
CREATE TRIGGER on_new_entry
AFTER INSERT ON entries
FOR EACH ROW
EXECUTE FUNCTION queue_new_entry_notification();

-- Function to queue notification when comment is created
CREATE OR REPLACE FUNCTION queue_new_comment_notification()
RETURNS TRIGGER AS $$
DECLARE
  commenter_name TEXT;
  entry_author_id UUID;
  entry_group_id UUID;
BEGIN
  -- Get commenter's name
  SELECT name INTO commenter_name FROM users WHERE id = NEW.user_id;
  
  -- Get entry details
  SELECT user_id, group_id INTO entry_author_id, entry_group_id
  FROM entries WHERE id = NEW.entry_id;
  
  -- Only notify the entry author (not the commenter)
  IF entry_author_id != NEW.user_id THEN
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
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for new comment
DROP TRIGGER IF EXISTS on_new_comment ON comments;
CREATE TRIGGER on_new_comment
AFTER INSERT ON comments
FOR EACH ROW
EXECUTE FUNCTION queue_new_comment_notification();
