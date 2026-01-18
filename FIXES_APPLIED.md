# Fixes Applied for Prompt Scheduling Issues

## Issues Identified

### Issue 1: Missing Prompts ("No entries for this day")

**Root Cause:**
The `schedule-daily-prompts` function was failing to schedule prompts due to:
1. **PGRST100 Error**: When `askedPromptIds` array is large, Supabase's `.not("id", "in", Array.from(askedPromptIds))` query fails with a parsing error
2. **Silent Failures**: When queries fail, the function skips scheduling without proper error handling

**Evidence from Query Results:**
- Group "One Direction": Has prompts for Jan 10-14, missing other days
- Group "Arambrook": Only has prompts for Jan 10-11, missing many days  
- Group "Goblin Queens": Has prompts for Jan 11-13, missing other days

**Fix Applied:**
- Changed fallback Standard prompt query to fetch ALL Standard prompts first, then filter in JavaScript
- This avoids PGRST100 error when `askedPromptIds` is large
- Added enhanced logging to track why prompts aren't being selected

**Location:** `supabase/functions/schedule-daily-prompts/index.ts` lines 1136-1156

---

### Issue 2: Different Questions for Different Users (Journal on Non-Sunday)

**Root Cause:**
The Journal prompt check was running BEFORE checking for existing prompts, causing:
1. Race conditions where different users see different prompts
2. Journal prompts appearing on non-Sunday days
3. Overriding existing Standard prompts

**Fix Applied:**
- Reordered logic in `getDailyPrompt` to check existing prompts FIRST
- Only create/return Journal prompt if no valid existing prompt exists
- Added validation to delete invalid Journal prompts on non-Sunday dates
- Enhanced error handling for duplicate key race conditions

**Location:** `lib/db.ts` lines 409-512

---

## Additional Fixes Needed

### Fix 3: Other PGRST100 Vulnerabilities

The interest-based selection logic (lines 763, 796, 848, 993, 1008, 1051, 1082, 1091) also uses `.not("id", "in", excludeIds)` which could fail with large arrays. These should be updated to fetch all prompts first, then filter in JavaScript.

**Priority:** Medium (only affects groups with many interests or many asked prompts)

---

## Testing Recommendations

1. **Run Updated Query 1**: Use the updated SQL query to see ALL dates (including missing ones) for the 3 groups
2. **Check Function Logs**: Review `schedule-daily-prompts` function logs to see:
   - Which groups are failing to schedule prompts
   - Why prompts aren't being selected (exhausted vs. error)
   - PGRST100 errors
3. **Test Journal Prompt Fix**: Verify that:
   - All users see the same prompt for a given date/group
   - Journal prompts only appear on Sundays
   - Existing prompts with entries are preserved

---

## Next Steps

1. Deploy the fixes to production
2. Monitor function logs for the next few days
3. Run Query 1 again to verify prompts are being scheduled
4. If issues persist, fix the remaining PGRST100 vulnerabilities in interest-based selection

---

## SQL Queries

See `debug_queries.sql` for:
- Query 1: All dates for 3 groups (shows missing prompts)
- Query 2: Today's prompts for problematic group (shows duplicate/invalid prompts)
- Query 3: Journal prompts on non-Sunday dates
