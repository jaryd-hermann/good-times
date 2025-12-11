# Phase 4 Fixes: Category Filtering and Queue Priority

## Issues Fixed

### Issue 1: Wrong Category Questions Being Added
**Problem**: Family groups were receiving Friends category questions and vice versa.

**Root Cause**: The `suggest_questions_for_group()` function only filtered by category for NEW groups (no engagement). For established groups, it allowed ANY category, only filtering by depth/vulnerability.

**Fix**: Updated `suggest_questions_for_group()` to ALWAYS filter by group type category:
- Family groups → Only "Family" category questions
- Friends groups → Only "Friends" category questions
- Applied to both new groups (using global popularity) and established groups (using personalized scoring)

### Issue 2: Remembering Questions Over-Representation
**Problem**: Groups that answer memorial questions were getting too many "Remembering" category questions in their personalized queue.

**Root Cause**: Personalized suggestions were including Remembering, Birthday, Custom, and Featured questions, which should be handled separately in the scheduling logic.

**Fix**: 
1. Updated `suggest_questions_for_group()` to exclude special categories:
   - Remembering
   - Birthday
   - Custom
   - Featured
2. Added safety check in `populate_personalized_queue()` to double-verify category matches group type

## Queue Priority (As Defined)

The queue functions with this priority order:
1. **Birthday** (if applicable)
2. **Custom** (if applicable, max 1) - from `custom_questions` table
3. **Featured** (if applicable, max 2)
4. **Remembering** (if applicable, max 2 per week)
5. **Group Category Personalized** (Friends for friends groups, Family for family groups) - from `group_prompt_queue` populated by `populate_personalized_queue()`
6. **Decks** (1 per active deck per week)

**Important Note**: Currently, if the queue is empty and there are no birthday/custom/featured/remembering/deck items, the scheduler falls back to random selection. Phase 5 will integrate personalized suggestions directly into the scheduling logic so that when the queue is empty, it will call `suggest_questions_for_group()` to get personalized suggestions on-the-fly.

## Changes Made

### File: `supabase/migrations/040_create_group_profiles_and_scoring.sql`
- Updated `suggest_questions_for_group()` function:
  - Added category filter for established groups: `p.category = CASE WHEN v_group_type = 'family' THEN 'Family' ELSE 'Friends' END`
  - Added exclusion: `p.category NOT IN ('Remembering', 'Birthday', 'Custom', 'Featured')`

### File: `supabase/migrations/043_phase4_automation.sql`
- Updated `populate_personalized_queue()` function:
  - Added category safety check in WHERE clause to ensure category matches group type
  - Added `s.category` to SELECT to enable the safety check

## Testing

After running these migrations, verify:
1. Family groups only receive "Family" category questions
2. Friends groups only receive "Friends" category questions
3. No Remembering, Birthday, Custom, or Featured questions appear in personalized suggestions
4. Queue population respects category boundaries

## Next Steps

1. Run the updated migrations
2. Clear existing incorrect queue entries (if needed)
3. Re-run `populate_personalized_queue()` to verify correct category filtering
4. Test with both Family and Friends groups

