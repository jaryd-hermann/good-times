-- Debug query to understand why deck questions aren't being scheduled
-- Group ID: ce951223-3540-4007-816d-829f260a5f5d

-- 1. Check if there are prompts available in the active decks
WITH active_decks AS (
  SELECT deck_id
  FROM group_active_decks
  WHERE group_id = 'ce951223-3540-4007-816d-829f260a5f5d'
    AND status = 'active'
)
SELECT 
  ad.deck_id,
  d.name as deck_name,
  COUNT(p.id) as total_prompts_in_deck,
  COUNT(CASE WHEN p.id NOT IN (
    SELECT DISTINCT dp.prompt_id 
    FROM daily_prompts dp 
    WHERE dp.group_id = 'ce951223-3540-4007-816d-829f260a5f5d'
      AND dp.user_id IS NULL
  ) THEN 1 END) as available_prompts,
  COUNT(CASE WHEN p.id IN (
    SELECT DISTINCT dp.prompt_id 
    FROM daily_prompts dp 
    WHERE dp.group_id = 'ce951223-3540-4007-816d-829f260a5f5d'
      AND dp.user_id IS NULL
  ) THEN 1 END) as already_asked_prompts
FROM active_decks ad
JOIN decks d ON ad.deck_id = d.id
LEFT JOIN prompts p ON p.deck_id = ad.deck_id
GROUP BY ad.deck_id, d.name
ORDER BY d.name;

-- 2. Check if there are queued items that might be blocking deck questions
SELECT 
  gpq.id,
  gpq.position,
  gpq.prompt_id,
  p.question,
  p.category,
  p.deck_id,
  d.name as deck_name,
  gpq.created_at as queued_at
FROM group_prompt_queue gpq
JOIN prompts p ON gpq.prompt_id = p.id
LEFT JOIN decks d ON p.deck_id = d.id
WHERE gpq.group_id = 'ce951223-3540-4007-816d-829f260a5f5d'
ORDER BY gpq.position ASC
LIMIT 10;

-- 3. Check today's prompt to see what was scheduled instead
SELECT 
  dp.date,
  dp.prompt_id,
  p.question,
  p.category,
  p.deck_id,
  d.name as deck_name,
  dp.user_id,
  CASE 
    WHEN dp.user_id IS NOT NULL THEN 'User-specific (birthday?)'
    WHEN p.deck_id IS NOT NULL THEN 'Deck question'
    WHEN p.category = 'Featured' THEN 'Featured'
    WHEN p.category = 'Custom' THEN 'Custom'
    ELSE 'Regular'
  END as prompt_type
FROM daily_prompts dp
JOIN prompts p ON dp.prompt_id = p.id
LEFT JOIN decks d ON p.deck_id = d.id
WHERE dp.group_id = 'ce951223-3540-4007-816d-829f260a5f5d'
  AND dp.date = CURRENT_DATE
ORDER BY dp.user_id NULLS FIRST;

-- 4. Check prompts scheduled this week to see what's blocking
WITH week_start AS (
  SELECT 
    CASE 
      WHEN EXTRACT(DOW FROM CURRENT_DATE) = 0 THEN CURRENT_DATE - INTERVAL '6 days'
      ELSE CURRENT_DATE - INTERVAL '1 day' * (EXTRACT(DOW FROM CURRENT_DATE) - 1)
    END AS monday
)
SELECT 
  dp.date,
  dp.prompt_id,
  p.question,
  p.category,
  p.deck_id,
  d.name as deck_name,
  CASE 
    WHEN dp.user_id IS NOT NULL THEN 'User-specific (birthday?)'
    WHEN p.deck_id IS NOT NULL THEN 'Deck question'
    WHEN p.category = 'Featured' THEN 'Featured'
    WHEN p.category = 'Custom' THEN 'Custom'
    ELSE 'Regular'
  END as prompt_type
FROM daily_prompts dp
JOIN prompts p ON dp.prompt_id = p.id
LEFT JOIN decks d ON p.deck_id = d.id
CROSS JOIN week_start ws
WHERE dp.group_id = 'ce951223-3540-4007-816d-829f260a5f5d'
  AND dp.date >= ws.monday
  AND dp.date <= CURRENT_DATE
ORDER BY dp.date DESC;

-- 5. Check if group is in ice-breaker period (which might block deck questions)
SELECT 
  id,
  name,
  ice_breaker_queue_completed_date,
  CASE 
    WHEN ice_breaker_queue_completed_date IS NULL THEN 'No completion date set'
    WHEN ice_breaker_queue_completed_date > CURRENT_DATE THEN 'Still in ice-breaker period ⚠️'
    ELSE 'Ice-breaker period completed ✓'
  END as ice_breaker_status
FROM groups
WHERE id = 'ce951223-3540-4007-816d-829f260a5f5d';

-- 6. Check if there are any prompts in the active decks at all
SELECT 
  d.id as deck_id,
  d.name as deck_name,
  COUNT(p.id) as prompt_count,
  MIN(p.deck_order) as min_deck_order,
  MAX(p.deck_order) as max_deck_order
FROM group_active_decks gad
JOIN decks d ON gad.deck_id = d.id
LEFT JOIN prompts p ON p.deck_id = gad.deck_id
WHERE gad.group_id = 'ce951223-3540-4007-816d-829f260a5f5d'
  AND gad.status = 'active'
GROUP BY d.id, d.name
ORDER BY d.name;

