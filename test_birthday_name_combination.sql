-- Test birthday name combination for a specific group and date
-- Group ID: 4d129d3e-b14c-4d9b-88b7-43ec67d98ca2
-- Date: 2026-02-01

-- ============================================================================
-- STEP 1: Check which members have birthdays on Feb 1 (02-01)
-- ============================================================================

SELECT 
  'Birthday members on Feb 1' as check_type,
  u.id as user_id,
  u.name,
  u.birthday,
  SUBSTRING(u.birthday::TEXT, 6) as month_day -- Extract MM-DD
FROM group_members gm
JOIN users u ON u.id = gm.user_id
WHERE gm.group_id = '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2'::UUID
  AND u.birthday IS NOT NULL
  AND SUBSTRING(u.birthday::TEXT, 6) = '02-01'  -- Feb 1
ORDER BY u.name;

-- ============================================================================
-- STEP 2: Show what the combined name would be
-- ============================================================================

SELECT 
  'Combined birthday name' as check_type,
  CASE 
    WHEN COUNT(*) = 0 THEN 'No birthdays on this date'
    WHEN COUNT(*) = 1 THEN MAX(u.name)
    ELSE string_agg(u.name, ' and ' ORDER BY u.name)
  END as combined_name,
  COUNT(*) as birthday_count
FROM group_members gm
JOIN users u ON u.id = gm.user_id
WHERE gm.group_id = '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2'::UUID
  AND u.birthday IS NOT NULL
  AND SUBSTRING(u.birthday::TEXT, 6) = '02-01';  -- Feb 1

-- ============================================================================
-- STEP 3: Show what a "their_birthday" prompt would look like with replacement
-- ============================================================================

WITH birthday_names AS (
  SELECT 
    string_agg(u.name, ' and ' ORDER BY u.name) as combined_name,
    COUNT(*) as birthday_count
  FROM group_members gm
  JOIN users u ON u.id = gm.user_id
  WHERE gm.group_id = '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2'::UUID
    AND u.birthday IS NOT NULL
    AND SUBSTRING(u.birthday::TEXT, 6) = '02-01'  -- Feb 1
),
their_birthday_prompts AS (
  SELECT 
    id,
    question,
    birthday_type
  FROM prompts
  WHERE category = 'Birthday'
    AND birthday_type = 'their_birthday'
  LIMIT 3  -- Show a few examples
)
SELECT 
  'Example prompt with replacement' as check_type,
  p.question as original_question,
  REPLACE(p.question, '{member_name}', bn.combined_name) as personalized_question,
  bn.combined_name as member_name_used,
  bn.birthday_count
FROM their_birthday_prompts p
CROSS JOIN birthday_names bn
WHERE bn.birthday_count > 0;

-- ============================================================================
-- STEP 4: Check what would be stored in prompt_name_usage
-- ============================================================================

-- First, let's see if there's already a record for this date
SELECT 
  'Existing prompt_name_usage' as check_type,
  pnu.name_used,
  pnu.date_used,
  p.question,
  p.category,
  p.birthday_type
FROM prompt_name_usage pnu
JOIN prompts p ON p.id = pnu.prompt_id
WHERE pnu.group_id = '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2'::UUID
  AND p.category = 'Birthday'
  AND p.birthday_type = 'their_birthday'
  AND pnu.date_used = '2026-02-01'::DATE
ORDER BY pnu.created_at DESC;

-- ============================================================================
-- STEP 5: Simulate what would happen if we ran getDailyPrompt logic
-- ============================================================================

-- This simulates the logic: get all birthday names and combine them
SELECT 
  'Simulated getDailyPrompt result' as check_type,
  CASE 
    WHEN COUNT(*) = 0 THEN 'them'
    WHEN COUNT(*) = 1 THEN MAX(u.name)
    ELSE string_agg(u.name, ' and ' ORDER BY u.name)
  END as member_name_value,
  COUNT(*) as birthday_count,
  array_agg(u.name ORDER BY u.name) as individual_names
FROM group_members gm
JOIN users u ON u.id = gm.user_id
WHERE gm.group_id = '4d129d3e-b14c-4d9b-88b7-43ec67d98ca2'::UUID
  AND u.birthday IS NOT NULL
  AND SUBSTRING(u.birthday::TEXT, 6) = '02-01';  -- Feb 1

