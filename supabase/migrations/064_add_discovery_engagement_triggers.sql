-- Triggers to automatically update discovery engagement when entries/reactions are created
-- This ensures engagement scores are calculated without modifying application code

-- Trigger function for entries
CREATE OR REPLACE FUNCTION trigger_update_discovery_engagement_on_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_daily_prompt_id UUID;
BEGIN
  -- Find the daily_prompt_id for this entry
  SELECT id INTO v_daily_prompt_id
  FROM daily_prompts
  WHERE group_id = NEW.group_id
    AND prompt_id = NEW.prompt_id
    AND date = NEW.date
    AND is_discovery = TRUE
  LIMIT 1;
  
  -- Update engagement if this is a discovery question
  IF v_daily_prompt_id IS NOT NULL THEN
    PERFORM update_discovery_engagement(v_daily_prompt_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for reactions
CREATE OR REPLACE FUNCTION trigger_update_discovery_engagement_on_reaction()
RETURNS TRIGGER AS $$
DECLARE
  v_daily_prompt_id UUID;
BEGIN
  -- Find the daily_prompt_id for this reaction's entry
  SELECT dp.id INTO v_daily_prompt_id
  FROM daily_prompts dp
  INNER JOIN entries e ON e.group_id = dp.group_id 
    AND e.prompt_id = dp.prompt_id 
    AND e.date = dp.date
  WHERE e.id = COALESCE(NEW.entry_id, OLD.entry_id)
    AND dp.is_discovery = TRUE
  LIMIT 1;
  
  -- Update engagement if this is a discovery question
  IF v_daily_prompt_id IS NOT NULL THEN
    PERFORM update_discovery_engagement(v_daily_prompt_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER entry_discovery_engagement_trigger
  AFTER INSERT OR UPDATE ON entries
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_discovery_engagement_on_entry();

CREATE TRIGGER reaction_discovery_engagement_trigger
  AFTER INSERT OR DELETE ON reactions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_discovery_engagement_on_reaction();
