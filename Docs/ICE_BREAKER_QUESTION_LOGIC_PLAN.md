# Ice Breaker Question Logic Implementation Plan

## Overview
Enhance group initialization to use curated "ice breaker" questions for the first 15 days of a new group's existence. This improves onboarding by providing lighter, more accessible questions initially.

## Database Changes

### 1. Add `ice_breaker` column to `prompts` table
- **Type**: `BOOLEAN DEFAULT FALSE`
- **Purpose**: Tag questions as ice-breaker eligible
- **Migration**: `019_add_ice_breaker_column.sql`

### 2. Add `ice_breaker_queue_completed_date` column to `groups` table
- **Type**: `DATE NULL`
- **Purpose**: Track when the initial 15-day ice-breaker queue ends
- **Logic**: Set to the date AFTER the last prompt in the 15-day window
- **Migration**: `019_add_ice_breaker_column.sql`

## Edge Function Changes

### `initialize-group-queue/index.ts`

#### Detection Logic
1. Check `groups.ice_breaker_queue_completed_date`
   - If `NULL` → First initialization (use ice-breaker logic)
   - If set → Already completed (use existing normal logic)

#### First Initialization (Ice-Breaker Mode)

**Prompt Filtering:**
- `ice_breaker = TRUE`
- Category matches group type:
  - Friends groups: `category = 'Friends'`
  - Family groups: `category = 'Family'`
- Exclude dynamic variables: `dynamic_variables IS NULL OR dynamic_variables = '[]'::jsonb`
- Exclude birthday prompts: `birthday_type IS NULL`
- Exclude memorial prompts: `category != 'Remembering'`

**Fallback Logic (if < 15 ice-breaker questions):**
- Fill remaining slots with:
  - Category = FRIEND/FAMILY (based on group type)
  - Include "Fun" category
  - Exclude "Edgy/NSFW" and "A Bit Deeper"
  - Still exclude dynamic variables, birthday prompts, memorial prompts

**Full Fallback (if 0 ice-breaker questions):**
- Use all FRIEND/FAMILY + Fun questions
- Exclude "Edgy/NSFW" and "A Bit Deeper"
- Exclude dynamic variables, birthday prompts, memorial prompts

**Date Generation:**
- 15 days: 7 days past + today + 7 days future
- Users can navigate back, so past dates are included

**Birthday Handling:**
- Check for birthdays in the 15-day window
- Insert birthday prompts on their dates
- Shift remaining questions forward by 1 day for each birthday
- Example: Birthday on day 3 → Insert birthday, shift days 4-15 to 5-16 (pushing day 15 to day 16)

**Completion Date:**
- Set `ice_breaker_queue_completed_date` to the date AFTER the last prompt
- If last prompt is on day 15 (or day 16 with birthday), completion date is day 16 (or day 17)

#### Subsequent Initialization (Normal Mode)
- Use existing logic (all categories, weights, preferences, memorials, etc.)
- No changes needed

### `schedule-daily-prompts/index.ts`

#### Ice-Breaker Period Check
1. Before generating prompts, check `groups.ice_breaker_queue_completed_date`
2. If `NULL` or date is in the future:
   - Skip normal generation (ice-breaker queue still active)
   - Don't override existing prompts
3. If date is in the past:
   - Use normal logic (weights, preferences, all categories)
   - Generate prompts as usual

## Implementation Steps

1. **Create Migration** (`019_add_ice_breaker_column.sql`)
   - Add `ice_breaker` column to `prompts`
   - Add `ice_breaker_queue_completed_date` column to `groups`
   - Add index on `ice_breaker` for performance

2. **Update `initialize-group-queue/index.ts`**
   - Add ice-breaker detection logic
   - Add ice-breaker filtering logic
   - Add fallback logic
   - Handle birthday insertion/shifting
   - Set completion date

3. **Update `schedule-daily-prompts/index.ts`**
   - Check ice-breaker completion before generating
   - Skip generation if still in ice-breaker period

4. **Testing**
   - Test all scenarios (15+ questions, <15 questions, 0 questions)
   - Test birthday insertion and shifting
   - Test normal logic after completion

## Edge Cases

1. **Multiple birthdays in 15-day window**: Shift forward by number of birthdays
2. **Birthday on last day**: Extend window to accommodate shift
3. **Group settings changed during ice-breaker period**: Ignore changes until period ends
4. **Memorial created during ice-breaker period**: Only appears after period ends

## Success Criteria

- New groups get 15 ice-breaker questions (or fallback)
- Birthday prompts insert correctly and shift remaining questions
- Normal logic activates after ice-breaker period ends
- No prompts with dynamic variables in initial queue
- No memorial prompts in initial queue
- Fallback works correctly when no ice-breaker questions exist

