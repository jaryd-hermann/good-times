-- ============================================
-- CHECK TODAY'S DAILY PROMPT FOR GROUP
-- ============================================
-- Query to see what the daily prompt is today for the group
SELECT 
  dp.id,
  dp.date,
  dp.prompt_id,
  dp.user_id,
  p.question,
  p.category,
  p.description,
  dp.created_at as prompt_scheduled_at
FROM daily_prompts dp
JOIN prompts p ON dp.prompt_id = p.id
WHERE dp.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND dp.date = CURRENT_DATE
ORDER BY dp.user_id NULLS FIRST; -- General prompts (user_id = NULL) first

-- ============================================
-- CHECK MEMORIAL MEMBERS FOR THIS GROUP
-- ============================================
-- Verify the group has memorial members
SELECT 
  m.id,
  m.name,
  m.user_id,
  m.group_id,
  m.photo_url,
  m.created_at
FROM memorials m
WHERE m.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
ORDER BY m.created_at;

-- ============================================
-- CHECK MEMORIAL PROMPTS IN PAST 2 WEEKS
-- ============================================
-- Check if there have been any memorial (Remembering category) prompts recently
SELECT 
  dp.date,
  dp.prompt_id,
  p.question,
  p.category,
  dp.user_id,
  dp.created_at as scheduled_at
FROM daily_prompts dp
JOIN prompts p ON dp.prompt_id = p.id
WHERE dp.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND p.category = 'Remembering'
  AND dp.date >= CURRENT_DATE - INTERVAL '14 days'
  AND dp.user_id IS NULL -- Only general prompts (not user-specific)
ORDER BY dp.date DESC;

-- ============================================
-- CHECK MEMORIAL PROMPTS THIS WEEK
-- ============================================
-- Check if there's a memorial prompt scheduled this week (Monday to today)
-- This matches the logic in schedule-daily-prompts function
WITH week_start AS (
  SELECT 
    CASE 
      WHEN EXTRACT(DOW FROM CURRENT_DATE) = 0 THEN CURRENT_DATE - INTERVAL '6 days' -- Sunday -> previous Monday
      ELSE CURRENT_DATE - INTERVAL '1 day' * (EXTRACT(DOW FROM CURRENT_DATE) - 1) -- Other days -> Monday of this week
    END AS monday
)
SELECT 
  dp.date,
  dp.prompt_id,
  p.question,
  p.category,
  dp.created_at as scheduled_at
FROM daily_prompts dp
JOIN prompts p ON dp.prompt_id = p.id
CROSS JOIN week_start ws
WHERE dp.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND p.category = 'Remembering'
  AND dp.date >= ws.monday
  AND dp.date <= CURRENT_DATE
  AND dp.user_id IS NULL -- Only general prompts
ORDER BY dp.date DESC;

-- ============================================
-- CHECK QUEUE FOR MEMORIAL PROMPTS
-- ============================================
-- Check if there are any Remembering category prompts in the queue
SELECT 
  gpq.id,
  gpq.position,
  gpq.prompt_id,
  p.question,
  p.category,
  gpq.added_by,
  gpq.created_at as queued_at
FROM group_prompt_queue gpq
JOIN prompts p ON gpq.prompt_id = p.id
WHERE gpq.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND p.category = 'Remembering'
ORDER BY gpq.position ASC;

-- ============================================
-- CHECK ALL QUEUE ITEMS
-- ============================================
-- See all items in the queue (to understand queue state)
SELECT 
  gpq.id,
  gpq.position,
  gpq.prompt_id,
  p.question,
  p.category,
  gpq.added_by,
  gpq.created_at as queued_at
FROM group_prompt_queue gpq
JOIN prompts p ON gpq.prompt_id = p.id
WHERE gpq.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
ORDER BY gpq.position ASC;

-- ============================================
-- CHECK GROUP ICE-BREAKER STATUS
-- ============================================
-- Check if group is in ice-breaker period (memorial prompts are skipped during this)
SELECT 
  id,
  name,
  type,
  ice_breaker_queue_completed_date,
  CASE 
    WHEN ice_breaker_queue_completed_date IS NULL THEN 'No completion date set'
    WHEN ice_breaker_queue_completed_date > CURRENT_DATE THEN 'Still in ice-breaker period'
    ELSE 'Ice-breaker period completed'
  END as ice_breaker_status
FROM groups
WHERE id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68';

-- ============================================
-- CHECK ALL DAILY PROMPTS PAST 10 DAYS
-- ============================================
-- See all prompts from the past 10 days to understand scheduling pattern
SELECT 
  dp.date,
  dp.prompt_id,
  p.question,
  p.category,
  dp.user_id,
  CASE 
    WHEN dp.user_id IS NULL THEN 'General'
    ELSE 'User-specific'
  END as prompt_type,
  dp.created_at as scheduled_at
FROM daily_prompts dp
JOIN prompts p ON dp.prompt_id = p.id
WHERE dp.group_id = '8dd82cfd-7328-4deb-96c0-d729f7fc8e68'
  AND dp.date >= CURRENT_DATE - INTERVAL '10 days'
ORDER BY dp.date DESC, dp.user_id NULLS FIRST;

