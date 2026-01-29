# Scheduler Interest Filtering Fixes - Complete Audit

## Root Cause Identified
**The scheduler was adding inferred interests to the interest cycle**, causing groups to receive questions for interests they didn't explicitly select.

## All Fixes Applied

### 1. Removed Inferred Interests from Cycle (Lines 1434-1480)
- **Before**: Inferred interests were added to `interestWeights` and included in `cycleInterests`
- **After**: Only explicit interests (from `group_interests` table) are used
- **Added**: Validation to filter out any inferred interests that might have been stored in `interest_cycle_interests` column

### 2. Fixed Discovery Logic (Lines 1103-1122)
- **Before**: Used `allGroupInterests` (explicit + inferred) for discovery check
- **After**: Only uses `explicitInterests` for discovery eligibility check
- **Note**: Discovery queries already validate that discovery interests are NOT in explicit interests

### 3. Fixed Fallback Logic (Lines 1923-1938)
- **Before**: Checked `hasInferredInterests` to determine if group has "any interests"
- **After**: Only checks `hasExplicitInterests` - inferred interests don't affect question selection

### 4. Added Interest Validation in Standard Cycle (Lines 1631-1649, 1814-1832)
- **Before**: Only checked if prompt contains `targetInterest`, didn't validate ALL prompt interests
- **After**: Validates that ALL prompt interests are in group's explicit interests
- **Protection**: Rejects prompts with ANY interests not in group's list

### 5. Fixed Last Resort Fallback Pagination (Lines 2103-2162)
- **Before**: Last resort queries didn't paginate - could miss prompts
- **After**: All last resort queries now paginate properly
- **Protection**: Still filters by explicit interests even in last resort

### 6. Fixed Discovery Query Pagination (Lines 1214-1220, 1274-1280, 1360-1366)
- **Before**: Discovery queries didn't paginate - could miss prompts
- **After**: All discovery queries now paginate with 1000-item pages
- **Protection**: Ensures we see ALL available discovery prompts

## Pagination Verification

All prompt queries are now paginated:
- ✅ Standard prompts for interest cycle (paginated)
- ✅ Null-interest prompts (paginated)
- ✅ Discovery prompts (paginated - 3 locations)
- ✅ Fallback prompts (paginated)
- ✅ Last resort prompts (paginated)
- ✅ Asked prompts for tracking (paginated)
- ✅ Remembering prompts (paginated)
- ✅ Ice breaker prompts (paginated)

## Interest Filtering Verification

All prompt selection paths validate interests:
- ✅ Standard interest cycle: Validates ALL prompt interests match explicit interests
- ✅ Discovery: Validates discovery interest NOT in explicit interests + validates prompts don't have explicit interests
- ✅ Fallback: Filters by explicit interests only
- ✅ Last resort: Filters by explicit interests only
- ✅ Null-interest prompts: Only used when appropriate (no interests or break questions)

## Safety Checks Added

1. **Cycle Validation**: Filters out inferred interests from stored `interest_cycle_interests`
2. **Prompt Validation**: Validates ALL prompt interests (not just target interest)
3. **Discovery Validation**: Double-checks discovery prompts don't have explicit interests
4. **Fallback Validation**: Even in last resort, filters by explicit interests

## Testing Recommendations

After deployment, verify:
1. Groups only get questions matching their explicit interests
2. Discovery questions don't have explicit group interests
3. Null-interest "break" questions work correctly
4. Pagination handles large prompt sets correctly
