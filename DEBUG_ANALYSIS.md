# Debug Analysis: Prompt Issues

## Issues Identified

### Issue 1: "No entries for this day" - Missing Prompts

**Root Cause:**
The `getDailyPrompt` function returns `null` when no prompt exists in `daily_prompts` table (line 595-596). This happens when:
1. The `schedule-daily-prompts` function hasn't run or failed to schedule prompts
2. All available prompts have been exhausted (according to "never repeat" logic)
3. The prompt was deleted or never created

**Evidence:**
- Query 1 will show which dates have missing prompts for the 3 groups
- If `daily_prompts` has no record for a date, `getDailyPrompt` returns `null`
- UI shows "No entries for this day" when `getDailyPrompt` returns `null`

**Fix Needed:**
1. Ensure `schedule-daily-prompts` function runs daily and successfully schedules prompts
2. Check if prompts are being filtered out incorrectly (e.g., all prompts marked as "asked")
3. Add better error handling/logging when prompts aren't scheduled

---

### Issue 2: Different Questions for Different Users (Journal on Non-Sunday)

**Root Cause:**
The Journal prompt check (lines 416-454) has a critical flaw:

```typescript
// Line 416: Journal check runs BEFORE checking existing prompts
if (isSunday(date) && date >= todayDate) {
  // Creates/returns Journal prompt
  return journalPrompt
}
// Line 457: Then checks for existing general prompts
const { data: existing } = await supabase...
```

**Problem:**
1. If today is Sunday, the Journal check runs FIRST and returns a Journal prompt
2. It doesn't check if a different prompt already exists for today
3. It creates a new `daily_prompts` record if one doesn't exist (line 437)
4. This can cause race conditions where:
   - User A calls `getDailyPrompt` → Journal check runs → Creates Journal prompt
   - User B calls `getDailyPrompt` → Journal check runs → Gets Journal prompt
   - But if User C already has a Standard prompt scheduled, they see that instead

**Additional Issue:**
The Journal check only applies to `date >= todayDate` (today or future). But if:
- Today is NOT Sunday
- A Journal prompt exists in `daily_prompts` for today (created by mistake/dev tool)
- The check at line 505 filters it out (Journal on non-Sunday with no entries)
- But if entries exist, it returns the Journal prompt anyway (line 499-500)

**Fix Needed:**
1. **CRITICAL**: Check for existing prompts BEFORE the Journal check
2. If a prompt already exists for today with entries, return it (don't override)
3. If a prompt exists without entries, check if it's Journal on non-Sunday and handle appropriately
4. Only create/return Journal prompt if:
   - It's Sunday AND today/future AND no existing prompt with entries

---

## Recommended Fixes

### Fix 1: Reorder Journal Check Logic

Move the Journal check to AFTER checking for existing prompts, but still prioritize it for scheduling:

```typescript
// 1. First check for existing prompts (preserve what people answered)
const { data: existing } = await supabase...

// 2. If existing prompt has entries, ALWAYS return it
if (existing && existing.prompt) {
  const { data: entriesForDate } = await supabase...
  if (entriesForDate && entriesForDate.length > 0) {
    return existing // Preserve original question
  }
}

// 3. THEN check for Journal (only if no existing prompt with entries)
if (isSunday(date) && date >= todayDate) {
  // Only create Journal if no existing prompt
  if (!existing || !existing.prompt) {
    // Create/return Journal prompt
  }
}
```

### Fix 2: Add Validation for Journal Prompts

Add a check to prevent Journal prompts from being returned on non-Sundays, even if they exist in the database:

```typescript
// After fetching existing prompt
if (existing && existing.prompt) {
  const prompt = existing.prompt as any
  
  // CRITICAL: Never return Journal prompts on non-Sundays (unless entries exist)
  if (prompt.category === "Journal" && !isSunday(date)) {
    const { data: entriesForDate } = await supabase...
    if (!entriesForDate || entriesForDate.length === 0) {
      // No entries - this is invalid, delete it and return null
      await supabase.from("daily_prompts").delete().eq("id", existing.id)
      return null
    }
    // Entries exist - preserve it (historical data)
    return existing
  }
}
```

### Fix 3: Ensure Consistent Prompt Retrieval

Add logging to track when prompts are created/returned to identify race conditions:

```typescript
console.log(`[getDailyPrompt] Group: ${groupId}, Date: ${date}, User: ${userId || 'general'}, Prompt: ${prompt?.id || 'none'}`)
```

---

## SQL Queries to Run

Run the queries in `debug_queries.sql` to:
1. See which dates are missing prompts for the 3 groups
2. See what prompts exist for today for the problematic group
3. Identify any Journal prompts on non-Sunday dates

---

## Next Steps

1. Run the SQL queries to gather data
2. Implement Fix 1 (reorder Journal check)
3. Implement Fix 2 (validate Journal prompts)
4. Test with the problematic groups
5. Monitor logs to ensure consistency
