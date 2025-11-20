# Prompt Selection Issue - Family Groups Only Showing Family Category

## Issue
Family groups are only seeing prompts from the "Family" category, when they should see variation from other categories (General, Fun, etc.).

## Current Logic (schedule-daily-prompts/index.ts)

For Family groups, the code:
1. **Excludes** "Edgy/NSFW" category (line 183) ✅ Correct
2. **Excludes** "Friends" category (line 184) ✅ Correct  
3. **Should include** other categories: General, Fun, Remembering (if memorials exist), etc.

## Possible Causes

1. **All prompts are categorized as "Family"** - Check the `prompts` table to see category distribution
2. **Category preferences** - Check if `question_category_preferences` table has weights that favor Family category
3. **Selection logic** - The weighted selection might be biased if Family category has higher weight

## How to Debug

Run this SQL query to check category distribution:

```sql
-- Check category distribution in prompts table
SELECT category, COUNT(*) as count 
FROM prompts 
WHERE birthday_type IS NULL 
GROUP BY category 
ORDER BY count DESC;

-- Check what categories are being selected for a specific group
SELECT 
  dp.date,
  p.category,
  p.question
FROM daily_prompts dp
JOIN prompts p ON dp.prompt_id = p.id
WHERE dp.group_id = 'YOUR_GROUP_ID'
  AND dp.user_id IS NULL
ORDER BY dp.date DESC
LIMIT 30;

-- Check category preferences for a group
SELECT category, preference, weight
FROM question_category_preferences
WHERE group_id = 'YOUR_GROUP_ID'
ORDER BY category;
```

## Expected Behavior

Family groups should see prompts from:
- ✅ General category
- ✅ Fun category  
- ✅ Family category (but not exclusively)
- ✅ Remembering category (if group has memorials)
- ❌ Friends category (excluded)
- ❌ Edgy/NSFW category (excluded)

## Solution

If all prompts are categorized as "Family", you need to:
1. Update the `prompts` table to properly categorize prompts
2. Ensure prompts have diverse categories (General, Fun, etc.)
3. Check that category preferences aren't forcing Family-only selection

If the issue is in the selection logic, we may need to add category rotation to ensure diversity.

