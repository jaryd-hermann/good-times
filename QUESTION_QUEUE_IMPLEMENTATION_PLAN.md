# Question Queue Implementation Plan

## Problem Analysis

### Current Issues
1. **No Initial Queue Generation**: When a new group is created, no question queue is generated for past/present/future days
2. **Weak Randomization**: `getDayIndex()` only adds `groupId.length` as offset, causing groups created close together to get similar questions
3. **Inherited Questions**: New groups see questions from other groups because `schedule-daily-prompts` checks all `daily_prompts` without proper group isolation
4. **Missing Filters**: Queue generation doesn't properly filter by:
   - Group type (Family vs Friends)
   - NSFW settings (Edgy/NSFW category)
   - Memorial settings (Remembering category)
5. **No Variety Guarantee**: No mechanism to ensure questions come from different categories in a week

### Root Cause
- `schedule-daily-prompts` function runs daily and only schedules for "today"
- No initialization function runs when a group is created
- Selection logic uses `getDayIndex()` which is deterministic but not truly random per group
- Used prompts are tracked globally, not per-group, causing cross-contamination

---

## Solution Architecture

### Phase 1: Create Group Queue Initialization Function

**New Edge Function**: `initialize-group-queue`

**Purpose**: Generate initial 15-day queue (7 days past + today + 7 days future) when group is created

**Trigger**: Called from `createGroup()` function in `lib/db.ts` after group creation

**Logic**:
1. Get group details (type, created_at)
2. Check NSFW preference (from `question_category_preferences` table)
3. Check if group has memorials
4. Determine eligible categories:
   - **Always eligible**: Fun, A Bit Deeper
   - **Group type specific**: 
     - Family groups: Family category
     - Friends groups: Friends category
   - **Conditional**:
     - Edgy/NSFW: Only if NSFW enabled
     - Remembering: Only if memorials exist
5. Get all prompts from eligible categories
6. Shuffle prompts using group-specific seed (group.id + creation timestamp)
7. Distribute prompts across 15 days ensuring:
   - At least one question from each eligible category per week
   - Variety: No category appears more than 2x in a 3-day window
   - Random order within constraints
8. Insert into `daily_prompts` table for past 7 days + today + next 7 days

---

### Phase 2: Update `schedule-daily-prompts` Function

**Changes**:
1. **Better Group Isolation**: 
   - Only check `daily_prompts` for the specific group
   - Don't use global "used prompts" list
   
2. **Improved Randomization**:
   - Replace `getDayIndex()` with proper seeded random based on `group.id + date`
   - Use crypto-secure random seeded with group ID for true uniqueness
   
3. **Category Variety Logic**:
   - Track which categories were used in last 7 days for this group
   - Prioritize categories that haven't been used recently
   - Ensure at least one question from each eligible category per week
   
4. **Respect User Weights**:
   - When selecting prompts, apply category weights from `question_category_preferences`
   - Higher weight = more likely to be selected
   - Still ensure variety (don't always pick highest weight)

---

### Phase 3: Update `createGroup()` Function

**Changes**:
1. After group creation, call `initialize-group-queue` Edge Function
2. Pass group ID, type, creator user ID
3. Handle errors gracefully (log but don't fail group creation)

---

### Phase 4: Database Schema Updates (if needed)

**Check if needed**:
- May need to add `group_id` index on `daily_prompts` for faster queries
- May need to track "last used category" per group for variety logic

---

## Implementation Details

### 1. New Edge Function: `initialize-group-queue`

**Location**: `supabase/functions/initialize-group-queue/index.ts`

**Input**:
```typescript
{
  group_id: string
  group_type: 'family' | 'friends'
  created_by: string
}
```

**Process**:
1. Get group settings (NSFW preference, category preferences)
2. Check for memorials
3. Determine eligible categories
4. Get all prompts from eligible categories
5. Generate 15-day queue with variety
6. Insert into `daily_prompts`

**Output**:
```typescript
{
  success: boolean
  prompts_scheduled: number
  dates: string[] // Array of dates scheduled
}
```

---

### 2. Queue Generation Algorithm

**Pseudocode**:
```
function generateGroupQueue(groupId, groupType, hasNSFW, hasMemorials, days = 15):
  // 1. Determine eligible categories
  eligibleCategories = ['Fun', 'A Bit Deeper']
  
  if groupType === 'family':
    eligibleCategories.add('Family')
  else if groupType === 'friends':
    eligibleCategories.add('Friends')
  
  if hasNSFW:
    eligibleCategories.add('Edgy/NSFW')
  
  if hasMemorials:
    eligibleCategories.add('Remembering')
  
  // 2. Get prompts from eligible categories
  allPrompts = getPromptsByCategories(eligibleCategories)
  
  // 3. Shuffle using group-specific seed
  shuffledPrompts = seededShuffle(allPrompts, groupId)
  
  // 4. Distribute across days ensuring variety
  queue = []
  categoryUsage = {} // Track category usage per day
  
  for each day in days:
    // Get prompts that haven't been used in last 7 days
    availablePrompts = filterUnusedPrompts(shuffledPrompts, queue, day)
    
    // Ensure category variety
    preferredCategory = getLeastUsedCategory(categoryUsage, eligibleCategories)
    
    // Select prompt from preferred category (weighted by user preferences)
    selectedPrompt = selectPrompt(availablePrompts, preferredCategory, weights)
    
    queue.add({ day, prompt: selectedPrompt })
    categoryUsage[day].add(selectedPrompt.category)
  
  return queue
```

---

### 3. Seeded Random Function

**Purpose**: Generate deterministic but unique random order per group

```typescript
function seededShuffle<T>(array: T[], seed: string): T[] {
  // Use group ID as seed for consistent randomization
  // This ensures same group always gets same order, but different groups get different orders
  const rng = createSeededRNG(seed)
  const shuffled = [...array]
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  
  return shuffled
}
```

---

### 4. Category Variety Logic

**Rules**:
- Each eligible category must appear at least once per 7-day period
- No category should appear more than 2 times in any 3-day window
- When selecting, prefer categories that haven't been used recently
- Still respect user weights (higher weight = more likely, but variety takes precedence)

---

### 5. Update `schedule-daily-prompts` Function

**Key Changes**:
1. **Group-specific used prompts**: Only check `daily_prompts` for current group
2. **Category tracking**: Track which categories were used in last 7 days for this group
3. **Variety-first selection**: Prioritize categories that haven't been used recently
4. **Better randomization**: Use seeded random based on `group.id + date` instead of `getDayIndex()`

---

## Testing Strategy

### Unit Tests
1. Test category filtering logic (Family vs Friends, NSFW, Memorials)
2. Test variety distribution (ensure each category appears in 7-day period)
3. Test seeded shuffle (same group ID = same order, different group ID = different order)

### Integration Tests
1. Create new Family group → verify only Family, Fun, A Bit Deeper categories
2. Create new Friends group with NSFW → verify Friends, Fun, A Bit Deeper, Edgy/NSFW
3. Create group with memorials → verify Remembering category included
4. Verify 15 days of prompts are created (7 past + today + 7 future)
5. Verify no duplicate prompts in 7-day window
6. Verify different groups get different question orders

### Manual Testing
1. Create a new group and check Home screen shows correct categories
2. Check History view shows past 7 days with correct categories
3. Verify questions match group type (no Family questions in Friends group)

---

## Migration Strategy

### For Existing Groups
1. Create migration script to initialize queues for existing groups
2. Run `initialize-group-queue` for each existing group
3. Only populate future dates (don't overwrite existing `daily_prompts`)

### Rollout Plan
1. Deploy Edge Function first
2. Update `createGroup()` to call initialization
3. Run migration for existing groups
4. Update `schedule-daily-prompts` function
5. Monitor for issues

---

## Files to Modify

1. **New File**: `supabase/functions/initialize-group-queue/index.ts`
2. **Modify**: `lib/db.ts` - Update `createGroup()` function
3. **Modify**: `supabase/functions/schedule-daily-prompts/index.ts` - Improve selection logic
4. **New File**: `supabase/migrations/014_initialize_group_queues.sql` - Migration for existing groups

---

## Risk Mitigation

1. **Graceful Degradation**: If queue initialization fails, group creation still succeeds (log error)
2. **Backward Compatibility**: Existing groups continue to work with current logic until migration runs
3. **Idempotency**: Queue initialization can be run multiple times safely (check if prompts exist first)
4. **Performance**: Use batch inserts for multiple `daily_prompts` entries

---

## Success Criteria

✅ New groups get unique question queues on creation  
✅ Questions match group type (no Family questions in Friends groups)  
✅ Questions respect NSFW and Memorial settings  
✅ Each group has different question order (even if created at same time)  
✅ 15 days of prompts generated (7 past + today + 7 future)  
✅ Category variety ensured (each category appears at least once per week)  
✅ Existing groups continue to work during migration  

---

## Next Steps

1. Review and approve this plan
2. Implement `initialize-group-queue` Edge Function
3. Update `createGroup()` to call initialization
4. Update `schedule-daily-prompts` with improved logic
5. Create migration for existing groups
6. Test thoroughly
7. Deploy and monitor

