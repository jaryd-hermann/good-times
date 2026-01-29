# Scheduler Logic Explanation and Critical Bugs Fixed

## How Question Scheduling Should Work

### Priority Order (Highest to Lowest):

1. **Birthday Questions** - User-specific prompts for birthdays (highest priority, cannot be skipped)
2. **Journal Questions** - Weekly photo journal on Sundays only
3. **Custom Questions** - User-submitted questions scheduled for specific dates
4. **Ice Breaker Questions** - Ordered questions asked first when a group starts
5. **Standard Questions** - Main question type with interest-based personalization
   - **Interest Cycle Logic**: Cycles through group's explicit interests, then null-interest "break" questions
   - **Discovery Questions**: Every 10th Standard question (after all explicit interests asked at least once)
6. **Remembering Questions** - Memorial-related questions (every 10 Standard questions, max 1 per 10 days)
7. **Deck Questions** - Currently disabled

### Standard Question Selection Logic (After Ice Breakers Complete):

1. **Check if it's the 10th Standard question** → If yes, check discovery eligibility
   - Discovery only triggers if ALL explicit interests have been asked at least once
   - Discovery uses related interests (not in group's explicit list)

2. **If not discovery, use Interest Cycle Logic**:
   - Build cycle from group's explicit + inferred interests (sorted by weight)
   - Cycle through each interest in order, then null-interest break
   - Select questions matching the current target interest
   - If no questions found for an interest, remove it from cycle

3. **Fallback** (if interest cycle fails):
   - **CRITICAL**: Must still filter by group interests!
   - Only use questions matching group's explicit interests OR null-interest questions
   - Never use questions with interests not in group's list

## Critical Bugs Found and Fixed

### Bug #1: Fallback Logic Not Filtering by Interests ❌
**Location**: Lines 1936-1950 (original code)

**Problem**: When fallback was triggered for groups with interests, it called `getAvailableStandardPrompts()` which returned ALL Standard prompts without filtering by interests. This allowed questions like "Animals & Pets" and "Food & Cooking" to be selected even though they weren't in the group's interests.

**Fix**: Modified fallback to:
- Fetch all Standard prompts
- Filter to only those matching group's explicit interests OR null-interest questions
- Explicitly reject prompts with interests not in group's list
- Added logging to track rejections

### Bug #2: Last Resort Fallback Not Filtering by Interests ❌
**Location**: Lines 1986-2000 (original code)

**Problem**: Even the "last resort" fallback (when removing last prompt restriction) wasn't filtering by interests, allowing wrong-interest questions.

**Fix**: Added interest filtering to last resort fallback as well.

### Bug #3: Discovery Questions Triggering Too Early ❌
**Location**: Lines 1120-1148 (already fixed in previous session)

**Problem**: Discovery questions could trigger before all explicit interests were asked.

**Fix**: Added pagination and stricter checks to ensure all explicit interests are asked before discovery.

### Bug #4: Back-to-Back Same Interest Questions ❌
**Location**: Lines 1409-1455 (already fixed in previous session)

**Problem**: Same interest could be asked back-to-back.

**Fix**: Added `last_interest_used` tracking to prevent back-to-back same interest.

## Expected Behavior After Fixes

1. **Groups with interests** will ONLY receive:
   - Questions matching their explicit interests
   - Null-interest "break" questions
   - Discovery questions (after all explicit interests asked) from related interests

2. **Groups without interests** will ONLY receive:
   - Null-interest questions

3. **No back-to-back** same interest questions

4. **Discovery questions** only after all explicit interests have been asked at least once

## Testing Recommendations

1. Check groups that received wrong-interest questions - they should now only get correct interests
2. Verify interest cycle is working - groups should cycle through their interests
3. Verify discovery only triggers after all explicit interests asked
4. Check logs for rejection messages when wrong-interest prompts are filtered out
