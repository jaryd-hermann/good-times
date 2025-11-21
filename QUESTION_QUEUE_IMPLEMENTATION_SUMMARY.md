# Question Queue Implementation Summary

## ✅ Implementation Complete

All components of the question queue system have been implemented with preference support.

---

## Files Created/Modified

### New Edge Functions
1. **`supabase/functions/initialize-group-queue/index.ts`**
   - Generates initial 15-day queue (7 past + today + 7 future) when group is created
   - Honors group type, NSFW settings, memorial settings
   - Respects category preferences (weights and disabled categories)
   - Uses seeded randomization for unique per-group ordering
   - Ensures category variety (each category appears at least once per week)

2. **`supabase/functions/update-group-queue/index.ts`**
   - Updates future prompts when preferences change
   - Deletes future prompts that don't match new preferences
   - Regenerates next 7 days with updated preferences
   - Maintains variety and respects weights

### Modified Files
1. **`lib/db.ts`**
   - `createGroup()`: Now calls `initialize-group-queue` after group creation
   - `updateQuestionCategoryPreference()`: Now calls `update-group-queue` after preference update
   - Both calls are non-blocking (graceful degradation if Edge Functions fail)

2. **`supabase/functions/schedule-daily-prompts/index.ts`**
   - Improved category filtering: Only selects from eligible categories
   - Better preference handling: Respects weights and disabled categories
   - Group-specific used prompts: No cross-contamination between groups

### Migration
1. **`supabase/migrations/014_initialize_group_queues.sql`**
   - Creates helper function to identify groups needing initialization
   - Creates view `groups_needing_queue_init` for easy identification
   - Note: Actual initialization must be done via Edge Function calls (not SQL)

---

## How It Works

### 1. New Group Creation
When a group is created:
1. Group is created in database
2. Group member is added
3. `initialize-group-queue` Edge Function is called automatically
4. Function generates 15 days of prompts:
   - Filters by group type (Family vs Friends)
   - Checks NSFW preference (includes/excludes Edgy/NSFW)
   - Checks memorials (includes/excludes Remembering)
   - Respects any category preferences already set
   - Ensures variety across categories
   - Uses seeded randomization for unique ordering

### 2. Preference Changes
When preferences are updated:
1. Preference is saved to database
2. `update-group-queue` Edge Function is called automatically
3. Function:
   - Deletes all future prompts (from tomorrow onwards)
   - Regenerates next 7 days with new preferences
   - Maintains variety and respects weights
   - Keeps today and past prompts unchanged

### 3. Daily Scheduling
The `schedule-daily-prompts` cron job:
1. Checks if prompt already exists for today
2. If not, selects from eligible categories only
3. Respects preferences (weights and disabled categories)
4. Uses group-specific used prompts (no cross-contamination)

---

## Category Eligibility Rules

### Always Eligible
- **Fun**: Available to all groups
- **A Bit Deeper**: Available to all groups

### Group Type Specific
- **Family**: Only for Family groups
- **Friends**: Only for Friends groups

### Conditional
- **Edgy/NSFW**: Only if NSFW enabled (Friends groups only)
- **Remembering**: Only if group has memorials

### User Preferences Override
- Categories can be disabled via `question_category_preferences` (preference = "none")
- Categories can have weights adjusted (more = 1.5x, less = 0.5x, default = 1.0x)

---

## Seeded Randomization

Each group gets a unique question order using:
- **Seed**: `group_id + created_at`
- **Result**: Same group always gets same order (deterministic)
- **Benefit**: Different groups get different orders (unique)

This ensures:
- Groups created at the same time get different questions
- Same group always sees questions in the same order
- No cross-contamination between groups

---

## Category Variety

The system ensures:
- Each eligible category appears at least once per 7-day period
- No category appears more than 2 times in any 3-day window
- When selecting, prefers categories that haven't been used recently
- Still respects user weights (higher weight = more likely, but variety takes precedence)

---

## Error Handling

### Graceful Degradation
- If `initialize-group-queue` fails, group creation still succeeds
- If `update-group-queue` fails, preference update still succeeds
- Errors are logged but don't block user actions

### Idempotency
- `initialize-group-queue` checks if queue already exists before creating
- Safe to call multiple times
- Won't duplicate prompts

---

## Testing Checklist

### New Group Creation
- [ ] Create Family group → Verify only Family, Fun, A Bit Deeper categories
- [ ] Create Friends group → Verify only Friends, Fun, A Bit Deeper categories
- [ ] Create Friends group with NSFW → Verify Edgy/NSFW included
- [ ] Create group with memorials → Verify Remembering category included
- [ ] Verify 15 days of prompts created (7 past + today + 7 future)
- [ ] Verify different groups get different question orders

### Preference Changes
- [ ] Disable a category → Verify future prompts don't include it
- [ ] Enable a category → Verify future prompts include it
- [ ] Change weight to "more" → Verify category appears more frequently
- [ ] Change weight to "less" → Verify category appears less frequently
- [ ] Verify today and past prompts unchanged

### Daily Scheduling
- [ ] Verify prompts match group type (no Family in Friends groups)
- [ ] Verify prompts respect NSFW setting
- [ ] Verify prompts respect memorial setting
- [ ] Verify prompts respect disabled categories
- [ ] Verify prompts respect category weights

---

## Deployment Steps

1. **Deploy Edge Functions**:
   ```bash
   supabase functions deploy initialize-group-queue
   supabase functions deploy update-group-queue
   ```

2. **Run Migration**:
   ```bash
   # Apply migration
   supabase migration up
   
   # Check which groups need initialization
   SELECT * FROM groups_needing_queue_init;
   ```

3. **Initialize Existing Groups** (if needed):
   - Create a script to call `initialize-group-queue` for each group in `groups_needing_queue_init`
   - Or manually call via Supabase dashboard → Edge Functions → Invoke

4. **Verify**:
   - Create a test group and verify queue is generated
   - Update preferences and verify queue updates
   - Check daily scheduling works correctly

---

## Notes

- **Birthday Prompts**: Birthday prompts are handled separately and not included in the queue
- **User-Specific Prompts**: The queue only generates general prompts (`user_id = null`)
- **Past Prompts**: When initializing, past 7 days are populated for history view
- **Future Prompts**: Next 7 days are pre-generated for consistency

---

## Future Enhancements

- Consider adding a manual "Regenerate Queue" button in group settings
- Add analytics to track category distribution
- Consider allowing users to manually reorder prompts
- Add option to exclude specific prompts (not just categories)

