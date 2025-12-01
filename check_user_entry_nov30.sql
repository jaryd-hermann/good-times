-- Check if user has an entry for November 30th, 2025 in the specified group
SELECT 
  id,
  group_id,
  user_id,
  prompt_id,
  date,
  text_content,
  media_urls,
  media_types,
  created_at
FROM entries
WHERE user_id = '1eefffd5-fbce-43de-a976-e3f19350d104'
  AND group_id = 'a3f39e39-5fa9-4a50-b48e-61e46478de13'
  AND date = '2025-11-30'
ORDER BY created_at DESC;

-- Also check what entries exist for this date in this group (all users)
SELECT 
  id,
  user_id,
  date,
  created_at,
  text_content IS NOT NULL as has_text,
  media_urls IS NOT NULL as has_media
FROM entries
WHERE group_id = 'a3f39e39-5fa9-4a50-b48e-61e46478de13'
  AND date = '2025-11-30'
ORDER BY created_at DESC;

