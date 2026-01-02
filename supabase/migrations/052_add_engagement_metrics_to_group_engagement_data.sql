-- Add engagement metrics columns to group_engagement_data table
-- This migration adds back the useful engagement metrics that were in the materialized view

-- Add engagement metrics columns if they don't exist
ALTER TABLE group_engagement_data ADD COLUMN IF NOT EXISTS total_prompts_asked INTEGER DEFAULT 0;
ALTER TABLE group_engagement_data ADD COLUMN IF NOT EXISTS total_entries INTEGER DEFAULT 0;
ALTER TABLE group_engagement_data ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT 0;
ALTER TABLE group_engagement_data ADD COLUMN IF NOT EXISTS avg_completion_rate FLOAT DEFAULT 0;
ALTER TABLE group_engagement_data ADD COLUMN IF NOT EXISTS avg_answer_length FLOAT DEFAULT 0;
ALTER TABLE group_engagement_data ADD COLUMN IF NOT EXISTS median_answer_length FLOAT DEFAULT 0;
ALTER TABLE group_engagement_data ADD COLUMN IF NOT EXISTS media_attachment_rate FLOAT DEFAULT 0;
ALTER TABLE group_engagement_data ADD COLUMN IF NOT EXISTS avg_hours_to_first_response FLOAT DEFAULT 0;
ALTER TABLE group_engagement_data ADD COLUMN IF NOT EXISTS avg_comments_per_entry FLOAT DEFAULT 0;
ALTER TABLE group_engagement_data ADD COLUMN IF NOT EXISTS entry_comment_rate FLOAT DEFAULT 0;
ALTER TABLE group_engagement_data ADD COLUMN IF NOT EXISTS last_engagement_date TIMESTAMPTZ;
ALTER TABLE group_engagement_data ADD COLUMN IF NOT EXISTS last_prompt_date DATE;

-- Populate engagement metrics for all existing groups
INSERT INTO group_engagement_data (
  group_id, 
  group_name, 
  group_members,
  total_prompts_asked,
  total_entries,
  member_count,
  avg_completion_rate,
  avg_answer_length,
  median_answer_length,
  media_attachment_rate,
  avg_hours_to_first_response,
  avg_comments_per_entry,
  entry_comment_rate,
  last_engagement_date,
  last_prompt_date
)
SELECT 
  g.id,
  g.name,
  (
    SELECT string_agg(u.name, ', ')
    FROM group_members gm
    JOIN users u ON gm.user_id = u.id
    WHERE gm.group_id = g.id
  ),
  COUNT(DISTINCT dp.id),
  COUNT(DISTINCT e.id),
  COUNT(DISTINCT gm.user_id),
  COUNT(DISTINCT e.id)::FLOAT / NULLIF(COUNT(DISTINCT dp.id) * COUNT(DISTINCT gm.user_id), 0),
  AVG(LENGTH(e.text_content)),
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY LENGTH(e.text_content)),
  COUNT(CASE WHEN e.media_urls IS NOT NULL AND array_length(e.media_urls, 1) > 0 THEN 1 END)::FLOAT / 
    NULLIF(COUNT(e.id), 0),
  AVG(EXTRACT(EPOCH FROM (e.created_at - dp.date))) / 3600,
  (
    SELECT AVG(comment_count)
    FROM (
      SELECT e2.id, COUNT(c.id) as comment_count
      FROM entries e2
      JOIN daily_prompts dp2 ON e2.prompt_id = dp2.prompt_id AND dp2.group_id = g.id
      LEFT JOIN comments c ON c.entry_id = e2.id
      WHERE e2.group_id = g.id
      GROUP BY e2.id
    ) entry_comments
  ),
  (
    SELECT AVG(CASE WHEN comment_count > 0 THEN 1.0 ELSE 0.0 END)
    FROM (
      SELECT e2.id, COUNT(c.id) as comment_count
      FROM entries e2
      JOIN daily_prompts dp2 ON e2.prompt_id = dp2.prompt_id AND dp2.group_id = g.id
      LEFT JOIN comments c ON c.entry_id = e2.id
      WHERE e2.group_id = g.id
      GROUP BY e2.id
    ) entry_comments
  ),
  MAX(e.created_at),
  MAX(dp.date)
FROM groups g
LEFT JOIN group_members gm ON gm.group_id = g.id
LEFT JOIN daily_prompts dp ON dp.group_id = g.id
LEFT JOIN entries e ON e.prompt_id = dp.prompt_id AND e.group_id = g.id
GROUP BY g.id, g.name
ON CONFLICT (group_id) DO UPDATE SET
  group_name = EXCLUDED.group_name,
  group_members = EXCLUDED.group_members,
  total_prompts_asked = EXCLUDED.total_prompts_asked,
  total_entries = EXCLUDED.total_entries,
  member_count = EXCLUDED.member_count,
  avg_completion_rate = EXCLUDED.avg_completion_rate,
  avg_answer_length = EXCLUDED.avg_answer_length,
  median_answer_length = EXCLUDED.median_answer_length,
  media_attachment_rate = EXCLUDED.media_attachment_rate,
  avg_hours_to_first_response = EXCLUDED.avg_hours_to_first_response,
  avg_comments_per_entry = EXCLUDED.avg_comments_per_entry,
  entry_comment_rate = EXCLUDED.entry_comment_rate,
  last_engagement_date = EXCLUDED.last_engagement_date,
  last_prompt_date = EXCLUDED.last_prompt_date;

-- Add comments for documentation
COMMENT ON COLUMN group_engagement_data.total_prompts_asked IS 'Total number of prompts asked to this group';
COMMENT ON COLUMN group_engagement_data.total_entries IS 'Total number of entries created by this group';
COMMENT ON COLUMN group_engagement_data.member_count IS 'Number of members in the group';
COMMENT ON COLUMN group_engagement_data.avg_completion_rate IS 'Average completion rate (entries / prompts * members)';
COMMENT ON COLUMN group_engagement_data.avg_answer_length IS 'Average length of text content in entries';
COMMENT ON COLUMN group_engagement_data.median_answer_length IS 'Median length of text content in entries';
COMMENT ON COLUMN group_engagement_data.media_attachment_rate IS 'Percentage of entries that include media';
COMMENT ON COLUMN group_engagement_data.avg_hours_to_first_response IS 'Average hours between prompt date and first entry creation';
COMMENT ON COLUMN group_engagement_data.avg_comments_per_entry IS 'Average number of comments per entry';
COMMENT ON COLUMN group_engagement_data.entry_comment_rate IS 'Percentage of entries that have at least one comment';
COMMENT ON COLUMN group_engagement_data.last_engagement_date IS 'Most recent entry creation timestamp';
COMMENT ON COLUMN group_engagement_data.last_prompt_date IS 'Most recent prompt date';

