# Querying Interest Similarities

After running `calculate_interest_similarities()`, you can view interest relationships using these queries:

## View All Interest Relationships

```sql
-- See all interest similarities
SELECT * FROM interest_similarity_view
ORDER BY interest_name, co_occurrence_percentage DESC;
```

## View Top Similar Interests for Each Interest

```sql
-- See top 5 similar interests for each interest
SELECT * FROM interest_top_similarities
ORDER BY interest_name;
```

## Get Related Interests for a Specific Interest

```sql
-- See what interests are related to "Music"
SELECT * FROM get_interest_relationships('Music');
```

## See What Discovery Interests Would Be Suggested for a Group

```sql
-- Replace 'your-group-id' with an actual group ID
SELECT * FROM get_related_interests('your-group-id'::UUID, 10);
```

## Manual Query Examples

### See all interests related to "Music"
```sql
SELECT 
  interest_name,
  similar_interest,
  ROUND(co_occurrence_score::numeric, 2) as percentage,
  calculated_at
FROM interest_similarities
WHERE interest_name = 'Music'
ORDER BY co_occurrence_score DESC;
```

### See which interests are most commonly co-occurring
```sql
SELECT 
  interest_name,
  similar_interest,
  ROUND(co_occurrence_score::numeric, 2) as percentage
FROM interest_similarities
WHERE co_occurrence_score >= 30  -- 30% or higher co-occurrence
ORDER BY co_occurrence_score DESC;
```

### See discovery candidates for a specific group
```sql
-- Get group's current interests (explicit + inferred)
WITH group_interests AS (
  SELECT 
    gi.group_id,
    ARRAY_AGG(i.name) FILTER (WHERE i.name IS NOT NULL) as explicit_interests,
    g.inferred_interests
  FROM group_interests gi
  INNER JOIN interests i ON i.id = gi.interest_id
  INNER JOIN groups g ON g.id = gi.group_id
  WHERE gi.group_id = 'your-group-id'::UUID
  GROUP BY gi.group_id, g.inferred_interests
),
all_group_interests AS (
  SELECT 
    group_id,
    COALESCE(explicit_interests, ARRAY[]::TEXT[]) || 
    COALESCE(inferred_interests, ARRAY[]::TEXT[]) as all_interests
  FROM group_interests
)
-- Get related interests not already in group's interests
SELECT DISTINCT
  isim.similar_interest,
  ROUND(AVG(isim.co_occurrence_score)::numeric, 2) as avg_co_occurrence
FROM interest_similarities isim
INNER JOIN all_group_interests agi ON isim.interest_name = ANY(agi.all_interests)
WHERE isim.similar_interest != ALL(agi.all_interests)
GROUP BY isim.similar_interest
ORDER BY avg_co_occurrence DESC
LIMIT 10;
```

## Check When Similarities Were Last Calculated

```sql
SELECT 
  interest_name,
  MAX(calculated_at) as last_calculated
FROM interest_similarities
GROUP BY interest_name
ORDER BY last_calculated DESC;
```
