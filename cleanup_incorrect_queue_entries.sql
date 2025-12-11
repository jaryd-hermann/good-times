-- Cleanup script to remove incorrect personalized queue entries
-- Run this after applying the Phase 4 category filtering fixes
--
-- This removes:
-- 1. Questions with wrong category for group type (Family groups with Friends questions, etc.)
-- 2. Remembering, Birthday, Featured questions (handled separately in scheduling)
-- 3. Questions that don't match the group's category

-- ============================================================================
-- STEP 1: Show what will be deleted (for review)
-- ============================================================================

-- First, let's see ALL queue entries with their categories to understand what's there
SELECT 
  'All queue entries' as review_type,
  g.name as group_name,
  g.type as group_type,
  p.category as prompt_category,
  p.question,
  gpq.position,
  gpq.created_at
FROM group_prompt_queue gpq
JOIN groups g ON g.id = gpq.group_id
JOIN prompts p ON p.id = gpq.prompt_id
ORDER BY g.name, gpq.position;

-- Preview: Wrong category questions
SELECT 
  'Wrong category' as issue_type,
  g.name as group_name,
  g.type as group_type,
  p.category as prompt_category,
  p.question,
  gpq.position,
  gpq.created_at
FROM group_prompt_queue gpq
JOIN groups g ON g.id = gpq.group_id
JOIN prompts p ON p.id = gpq.prompt_id
WHERE (
  (g.type = 'family' AND p.category = 'Friends') OR
  (g.type = 'friends' AND p.category = 'Family')
)
ORDER BY g.name, gpq.position;

-- Preview: Special category questions that shouldn't be in personalized queue
SELECT 
  'Special category' as issue_type,
  g.name as group_name,
  g.type as group_type,
  p.category as prompt_category,
  p.question,
  gpq.position,
  gpq.created_at
FROM group_prompt_queue gpq
JOIN groups g ON g.id = gpq.group_id
JOIN prompts p ON p.id = gpq.prompt_id
WHERE p.category IN ('Remembering', 'Birthday', 'Featured')
ORDER BY g.name, gpq.position;

-- Summary: Count by group type and category
SELECT 
  g.type as group_type,
  p.category as prompt_category,
  COUNT(*) as count
FROM group_prompt_queue gpq
JOIN groups g ON g.id = gpq.group_id
JOIN prompts p ON p.id = gpq.prompt_id
GROUP BY g.type, p.category
ORDER BY g.type, p.category;

-- ============================================================================
-- OPTION A: Complete reset (uncomment if you want to clear ALL personalized queue entries)
-- ============================================================================

-- WARNING: This will delete ALL entries from group_prompt_queue
-- Only use this if you want a completely fresh start
-- Uncomment the line below to execute:
-- DELETE FROM group_prompt_queue;

-- ============================================================================
-- OPTION B: Selective cleanup (recommended - only removes incorrect entries)
-- ============================================================================

-- Delete wrong category questions (Family groups with Friends questions, etc.)
DELETE FROM group_prompt_queue gpq
USING groups g, prompts p
WHERE gpq.group_id = g.id
  AND gpq.prompt_id = p.id
  AND (
    (g.type = 'family' AND p.category = 'Friends') OR
    (g.type = 'friends' AND p.category = 'Family')
  );

-- Delete special category questions (Remembering, Birthday, Featured)
-- These are handled separately in scheduling logic
DELETE FROM group_prompt_queue gpq
USING prompts p
WHERE gpq.prompt_id = p.id
  AND p.category IN ('Remembering', 'Birthday', 'Featured');

-- ============================================================================
-- STEP 3: Recalculate positions after deletions
-- ============================================================================

-- Reorder positions sequentially for each group (0, 1, 2, ...)
-- This ensures positions are continuous after deletions
UPDATE group_prompt_queue gpq
SET position = sub.new_position
FROM (
  SELECT 
    id,
    group_id,
    ROW_NUMBER() OVER (PARTITION BY group_id ORDER BY position ASC, created_at ASC) - 1 as new_position
  FROM group_prompt_queue
) sub
WHERE gpq.id = sub.id;

-- ============================================================================
-- STEP 4: Verification queries
-- ============================================================================

-- Verify no wrong category questions remain
SELECT 
  COUNT(*) as remaining_wrong_category
FROM group_prompt_queue gpq
JOIN groups g ON g.id = gpq.group_id
JOIN prompts p ON p.id = gpq.prompt_id
WHERE (
  (g.type = 'family' AND p.category = 'Friends') OR
  (g.type = 'friends' AND p.category = 'Family')
);

-- Verify no special category questions remain
SELECT 
  COUNT(*) as remaining_special_category
FROM group_prompt_queue gpq
JOIN prompts p ON p.id = gpq.prompt_id
WHERE p.category IN ('Remembering', 'Birthday', 'Featured');

-- Show remaining queue entries by group
SELECT 
  g.name as group_name,
  g.type as group_type,
  COUNT(gpq.id) as queue_count,
  array_agg(DISTINCT p.category) as categories_in_queue
FROM groups g
LEFT JOIN group_prompt_queue gpq ON gpq.group_id = g.id
LEFT JOIN prompts p ON p.id = gpq.prompt_id
WHERE gpq.id IS NOT NULL
GROUP BY g.id, g.name, g.type
ORDER BY queue_count DESC;

