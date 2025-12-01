-- Check prompt_name_usage records for the problematic prompt and date
SELECT 
  id,
  group_id,
  prompt_id,
  variable_type,
  name_used,
  date_used,
  created_at
FROM prompt_name_usage
WHERE prompt_id = '8177e853-e52a-4161-85fb-f0641de62ead'
  AND variable_type = 'member_name'
ORDER BY date_used DESC, created_at DESC
LIMIT 10;
