-- Function to calculate interest similarities based on co-occurrence
-- This analyzes which interests frequently appear together in groups
CREATE OR REPLACE FUNCTION calculate_interest_similarities()
RETURNS void AS $$
DECLARE
  interest_record RECORD;
  similar_record RECORD;
  total_groups_with_interest INTEGER;
  groups_with_both INTEGER;
  co_occurrence_percentage DECIMAL;
BEGIN
  -- Clear existing similarities
  DELETE FROM interest_similarities;
  
  -- For each interest, find other interests that co-occur
  FOR interest_record IN 
    SELECT DISTINCT i.name as interest_name
    FROM interests i
    INNER JOIN group_interests gi ON gi.interest_id = i.id
  LOOP
    -- Count total groups that have this interest
    SELECT COUNT(DISTINCT gi.group_id) INTO total_groups_with_interest
    FROM group_interests gi
    INNER JOIN interests i ON i.id = gi.interest_id
    WHERE i.name = interest_record.interest_name;
    
    -- Only process if at least 2 groups have this interest (need co-occurrence)
    IF total_groups_with_interest >= 2 THEN
      -- Find other interests that appear in groups with this interest
      FOR similar_record IN
        SELECT DISTINCT i2.name as similar_interest_name
        FROM group_interests gi1
        INNER JOIN interests i1 ON i1.id = gi1.interest_id
        INNER JOIN group_interests gi2 ON gi2.group_id = gi1.group_id AND gi2.interest_id != gi1.interest_id
        INNER JOIN interests i2 ON i2.id = gi2.interest_id
        WHERE i1.name = interest_record.interest_name
          AND i2.name != interest_record.interest_name
      LOOP
        -- Count groups that have BOTH interests
        SELECT COUNT(DISTINCT gi1.group_id) INTO groups_with_both
        FROM group_interests gi1
        INNER JOIN interests i1 ON i1.id = gi1.interest_id
        INNER JOIN group_interests gi2 ON gi2.group_id = gi1.group_id
        INNER JOIN interests i2 ON i2.id = gi2.interest_id
        WHERE i1.name = interest_record.interest_name
          AND i2.name = similar_record.similar_interest_name;
        
        -- Calculate co-occurrence percentage
        co_occurrence_percentage := (groups_with_both::DECIMAL / total_groups_with_interest::DECIMAL) * 100;
        
        -- Only store if co-occurrence is at least 10% (threshold to avoid noise)
        IF co_occurrence_percentage >= 10 THEN
          INSERT INTO interest_similarities (interest_name, similar_interest, co_occurrence_score, calculated_at)
          VALUES (interest_record.interest_name, similar_record.similar_interest_name, co_occurrence_percentage, NOW())
          ON CONFLICT (interest_name, similar_interest) 
          DO UPDATE SET 
            co_occurrence_score = EXCLUDED.co_occurrence_score,
            calculated_at = NOW();
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to get related interests for a given set of interests
-- Returns top N similar interests that are NOT already in the group's explicit or inferred interests
CREATE OR REPLACE FUNCTION get_related_interests(
  p_group_id UUID,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  interest_name TEXT,
  co_occurrence_score DECIMAL
) AS $$
DECLARE
  group_explicit_interests TEXT[];
  group_inferred_interests TEXT[];
  group_all_interests TEXT[];
BEGIN
  -- Get group's explicit interests
  SELECT ARRAY_AGG(i.name) INTO group_explicit_interests
  FROM group_interests gi
  INNER JOIN interests i ON i.id = gi.interest_id
  WHERE gi.group_id = p_group_id;
  
  -- Get group's inferred interests
  SELECT inferred_interests INTO group_inferred_interests
  FROM groups
  WHERE id = p_group_id;
  
  -- Combine explicit and inferred (handle nulls)
  group_all_interests := COALESCE(group_explicit_interests, ARRAY[]::TEXT[]) || 
                         COALESCE(group_inferred_interests, ARRAY[]::TEXT[]);
  
  -- Return top similar interests that are NOT already in the group's interests
  RETURN QUERY
  SELECT DISTINCT isim.similar_interest as interest_name, isim.co_occurrence_score
  FROM interest_similarities isim
  WHERE isim.interest_name = ANY(group_all_interests)
    AND isim.similar_interest != ALL(group_all_interests)
  ORDER BY isim.co_occurrence_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
