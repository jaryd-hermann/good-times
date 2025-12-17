-- Query to check active decks and deck question scheduling for a group
-- Group ID: ce951223-3540-4007-816d-829f260a5f5d

-- 1. Get all active decks for this group
SELECT 
  gad.id,
  gad.deck_id,
  d.name as deck_name,
  d.description as deck_description,
  gad.status,
  gad.requested_by,
  u.name as requested_by_name,
  gad.activated_at,
  gad.finished_at,
  gad.created_at,
  gad.updated_at,
  -- Count total prompts in this deck
  (SELECT COUNT(*) FROM prompts p WHERE p.deck_id = gad.deck_id) as total_prompts_in_deck,
  -- Count prompts already asked for this group from this deck
  (SELECT COUNT(DISTINCT dp.prompt_id) 
   FROM daily_prompts dp 
   WHERE dp.group_id = gad.group_id 
     AND dp.deck_id = gad.deck_id 
     AND dp.user_id IS NULL) as prompts_asked_from_deck
FROM group_active_decks gad
JOIN decks d ON gad.deck_id = d.id
LEFT JOIN users u ON gad.requested_by = u.id
WHERE gad.group_id = 'ce951223-3540-4007-816d-829f260a5f5d'
ORDER BY 
  CASE gad.status 
    WHEN 'active' THEN 1
    WHEN 'voting' THEN 2
    WHEN 'finished' THEN 3
    WHEN 'rejected' THEN 4
  END,
  gad.activated_at DESC NULLS LAST;

-- 2. Check deck questions scheduled in the past 30 days
SELECT 
  dp.date,
  dp.deck_id,
  d.name as deck_name,
  p.question,
  p.deck_order,
  dp.created_at as scheduled_at
FROM daily_prompts dp
JOIN prompts p ON dp.prompt_id = p.id
LEFT JOIN decks d ON dp.deck_id = d.id
WHERE dp.group_id = 'ce951223-3540-4007-816d-829f260a5f5d'
  AND dp.deck_id IS NOT NULL
  AND dp.user_id IS NULL
  AND dp.date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY dp.date DESC;

-- 3. Check which decks have been used THIS WEEK (Monday to today)
WITH week_start AS (
  SELECT 
    CASE 
      WHEN EXTRACT(DOW FROM CURRENT_DATE) = 0 THEN CURRENT_DATE - INTERVAL '6 days' -- Sunday -> previous Monday
      ELSE CURRENT_DATE - INTERVAL '1 day' * (EXTRACT(DOW FROM CURRENT_DATE) - 1) -- Other days -> Monday of this week
    END AS monday
)
SELECT 
  dp.deck_id,
  d.name as deck_name,
  dp.date as scheduled_date,
  p.question,
  p.deck_order
FROM daily_prompts dp
JOIN prompts p ON dp.prompt_id = p.id
LEFT JOIN decks d ON dp.deck_id = d.id
CROSS JOIN week_start ws
WHERE dp.group_id = 'ce951223-3540-4007-816d-829f260a5f5d'
  AND dp.deck_id IS NOT NULL
  AND dp.user_id IS NULL
  AND dp.date >= ws.monday
  AND dp.date <= CURRENT_DATE
ORDER BY dp.date DESC;

-- 4. Check which active decks are DUE for questions this week (haven't been scheduled yet)
WITH week_start AS (
  SELECT 
    CASE 
      WHEN EXTRACT(DOW FROM CURRENT_DATE) = 0 THEN CURRENT_DATE - INTERVAL '6 days'
      ELSE CURRENT_DATE - INTERVAL '1 day' * (EXTRACT(DOW FROM CURRENT_DATE) - 1)
    END AS monday
),
used_decks_this_week AS (
  SELECT DISTINCT dp.deck_id
  FROM daily_prompts dp
  CROSS JOIN week_start ws
  WHERE dp.group_id = 'ce951223-3540-4007-816d-829f260a5f5d'
    AND dp.deck_id IS NOT NULL
    AND dp.user_id IS NULL
    AND dp.date >= ws.monday
    AND dp.date <= CURRENT_DATE
),
active_decks AS (
  SELECT 
    gad.deck_id,
    d.name as deck_name,
    gad.activated_at
  FROM group_active_decks gad
  JOIN decks d ON gad.deck_id = d.id
  WHERE gad.group_id = 'ce951223-3540-4007-816d-829f260a5f5d'
    AND gad.status = 'active'
)
SELECT 
  ad.deck_id,
  ad.deck_name,
  ad.activated_at,
  CASE 
    WHEN ud.deck_id IS NOT NULL THEN 'Already scheduled this week ✓'
    ELSE 'Due for scheduling this week ⚠️'
  END as status,
  -- Count available prompts (not yet asked)
  (SELECT COUNT(*) 
   FROM prompts p
   WHERE p.deck_id = ad.deck_id
     AND p.id NOT IN (
       SELECT DISTINCT dp.prompt_id 
       FROM daily_prompts dp 
       WHERE dp.group_id = 'ce951223-3540-4007-816d-829f260a5f5d'
         AND dp.user_id IS NULL
     )
  ) as available_prompts_count
FROM active_decks ad
LEFT JOIN used_decks_this_week ud ON ad.deck_id = ud.deck_id
ORDER BY 
  CASE WHEN ud.deck_id IS NOT NULL THEN 1 ELSE 0 END, -- Already scheduled first
  ad.activated_at DESC;

-- 5. Check the group_prompt_queue for any deck-related prompts
SELECT 
  gpq.id,
  gpq.position,
  gpq.prompt_id,
  p.question,
  p.deck_id,
  d.name as deck_name,
  p.deck_order,
  gpq.added_by,
  u.name as added_by_name,
  gpq.created_at as queued_at
FROM group_prompt_queue gpq
JOIN prompts p ON gpq.prompt_id = p.id
LEFT JOIN decks d ON p.deck_id = d.id
LEFT JOIN users u ON gpq.added_by = u.id
WHERE gpq.group_id = 'ce951223-3540-4007-816d-829f260a5f5d'
ORDER BY gpq.position ASC;

-- 6. Summary: Active decks count and scheduling status
WITH week_start AS (
  SELECT 
    CASE 
      WHEN EXTRACT(DOW FROM CURRENT_DATE) = 0 THEN CURRENT_DATE - INTERVAL '6 days'
      ELSE CURRENT_DATE - INTERVAL '1 day' * (EXTRACT(DOW FROM CURRENT_DATE) - 1)
    END AS monday
),
used_decks_this_week AS (
  SELECT DISTINCT dp.deck_id
  FROM daily_prompts dp
  CROSS JOIN week_start ws
  WHERE dp.group_id = 'ce951223-3540-4007-816d-829f260a5f5d'
    AND dp.deck_id IS NOT NULL
    AND dp.user_id IS NULL
    AND dp.date >= ws.monday
    AND dp.date <= CURRENT_DATE
)
SELECT 
  COUNT(*) FILTER (WHERE gad.status = 'active') as active_decks_count,
  COUNT(*) FILTER (WHERE gad.status = 'voting') as voting_decks_count,
  COUNT(*) FILTER (WHERE gad.status = 'finished') as finished_decks_count,
  COUNT(*) FILTER (WHERE gad.status = 'rejected') as rejected_decks_count,
  COUNT(*) FILTER (WHERE gad.status = 'active' AND ud.deck_id IS NULL) as decks_due_this_week,
  COUNT(*) FILTER (WHERE gad.status = 'active' AND ud.deck_id IS NOT NULL) as decks_scheduled_this_week
FROM group_active_decks gad
LEFT JOIN used_decks_this_week ud ON gad.deck_id = ud.deck_id
WHERE gad.group_id = 'ce951223-3540-4007-816d-829f260a5f5d';

