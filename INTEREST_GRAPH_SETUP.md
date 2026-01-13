# Interest Graph System Setup Guide

After running migrations `060`, `061`, `062`, and `063`, follow these steps:

## Step 1: Initialize Interest Similarities

Run the setup script to calculate initial interest similarities:

```sql
-- In Supabase SQL Editor or via migration
SELECT calculate_interest_similarities();
```

This populates the `interest_similarities` table with co-occurrence data based on existing group interests.

**Note:** You should run this periodically (e.g., weekly) to keep similarity data up-to-date as groups add/remove interests.

## Step 2: Set Up Engagement Tracking

The system needs to calculate engagement scores when entries and reactions are created. Two approaches:

### Option A: Database Triggers (Recommended)

Create triggers that automatically call `update_discovery_engagement()` when entries/reactions are created:

```sql
-- Trigger for entries
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

CREATE TRIGGER entry_discovery_engagement_trigger
  AFTER INSERT OR UPDATE ON entries
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_discovery_engagement_on_entry();

-- Trigger for reactions
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
  WHERE e.id = NEW.entry_id
    AND dp.is_discovery = TRUE
  LIMIT 1;
  
  -- Update engagement if this is a discovery question
  IF v_daily_prompt_id IS NOT NULL THEN
    PERFORM update_discovery_engagement(v_daily_prompt_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reaction_discovery_engagement_trigger
  AFTER INSERT OR DELETE ON reactions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_discovery_engagement_on_reaction();
```

### Option B: Application-Level Hooks

Add calls to `update_discovery_engagement()` in your application code:
- After `createEntry()` succeeds
- After `toggleReaction()` succeeds

See `lib/db.ts` modifications below.

## Step 3: Set Up Periodic Analysis (Migration 065)

Migration 065 automatically sets up two cron jobs:
1. **Daily engagement analysis** (2 AM UTC) - Promotes interests to inferred
2. **Weekly similarity recalculation** (3 AM UTC Sundays) - Updates co-occurrence data

No manual intervention needed - everything is automated!

## Step 4: Monitor (Optional)

The system is fully automated. You can optionally monitor:

1. **Check Discovery Attempts:**
   ```sql
   SELECT * FROM discovery_attempts WHERE status = 'testing' ORDER BY created_at DESC;
   ```

2. **View Inferred Interests:**
   ```sql
   SELECT id, name, inferred_interests FROM groups WHERE array_length(inferred_interests, 1) > 0;
   ```

3. **View Discovery Questions Scheduled:**
   ```sql
   SELECT dp.*, p.question 
   FROM daily_prompts dp
   INNER JOIN prompts p ON p.id = dp.prompt_id
   WHERE dp.is_discovery = TRUE
   ORDER BY dp.date DESC
   LIMIT 20;
   ```

## How It Works

1. **Discovery Scheduling:** Every 10th Standard question (excluding discovery questions) triggers discovery logic
2. **Interest Testing:** System tests 2-3 questions from a related interest
3. **Engagement Tracking:** Engagement scores are calculated based on:
   - Answered: 50% weight
   - Response length: 30% weight  
   - Reactions: 20% weight
4. **Promotion:** If average engagement ≥ 60% after 2-3 questions, interest is promoted to `inferred_interests`
5. **Integration:** Inferred interests join the explicit interest cycle and are treated like explicit interests

## Fallback Behavior

The system has robust fallbacks:
- If discovery interest has no questions → try next related interest
- If no related interests have questions → continue with standard cycle
- If engagement analysis fails → continue testing (no promotion)
- **Always ensures a question is scheduled** (never fails to ask)
