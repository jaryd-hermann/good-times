-- Create views to easily see interest relationships

-- View showing all interest similarities with readable format
CREATE OR REPLACE VIEW interest_similarity_view AS
SELECT 
  isim.interest_name,
  isim.similar_interest,
  ROUND(isim.co_occurrence_score::numeric, 2) as co_occurrence_percentage,
  isim.calculated_at
FROM interest_similarities isim
ORDER BY isim.interest_name, isim.co_occurrence_score DESC;

-- View showing top 5 similar interests for each interest
CREATE OR REPLACE VIEW interest_top_similarities AS
SELECT 
  interest_name,
  ARRAY_AGG(similar_interest ORDER BY co_occurrence_score DESC) FILTER (WHERE row_num <= 5) as top_5_similar_interests,
  ARRAY_AGG(ROUND(co_occurrence_score::numeric, 2) ORDER BY co_occurrence_score DESC) FILTER (WHERE row_num <= 5) as top_5_scores
FROM (
  SELECT 
    interest_name,
    similar_interest,
    co_occurrence_score,
    ROW_NUMBER() OVER (PARTITION BY interest_name ORDER BY co_occurrence_score DESC) as row_num
  FROM interest_similarities
) ranked
WHERE row_num <= 5
GROUP BY interest_name;

-- Function to get related interests for a specific interest
CREATE OR REPLACE FUNCTION get_interest_relationships(p_interest_name TEXT)
RETURNS TABLE (
  similar_interest TEXT,
  co_occurrence_percentage DECIMAL,
  calculated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    isim.similar_interest,
    ROUND(isim.co_occurrence_score::numeric, 2),
    isim.calculated_at
  FROM interest_similarities isim
  WHERE isim.interest_name = p_interest_name
  ORDER BY isim.co_occurrence_score DESC;
END;
$$ LANGUAGE plpgsql;
