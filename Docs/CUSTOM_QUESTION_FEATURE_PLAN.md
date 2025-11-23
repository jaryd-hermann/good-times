# Custom Question Feature - Implementation Plan

## Overview
Allow group members to ask custom questions to their group once per week, with rotation ensuring everyone gets a turn. Feature activates after group has been active for 1 week and has 3+ members.

---

## 1. Database Schema

### 1.1 New Table: `custom_questions`
```sql
CREATE TABLE custom_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL CHECK (char_length(question) <= 200), -- ~20 words max
  description TEXT,
  is_anonymous BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  date_assigned DATE NOT NULL, -- The date the user was selected
  date_asked DATE, -- The date the question was actually asked (null if skipped)
  prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL, -- Links to prompts table if created
  UNIQUE(group_id, date_assigned) -- Only one custom question opportunity per group per day
);

CREATE INDEX idx_custom_questions_group ON custom_questions(group_id);
CREATE INDEX idx_custom_questions_user ON custom_questions(user_id);
CREATE INDEX idx_custom_questions_date_assigned ON custom_questions(date_assigned);
CREATE INDEX idx_custom_questions_date_asked ON custom_questions(date_asked);
```

### 1.2 New Table: `custom_question_rotation`
```sql
CREATE TABLE custom_question_rotation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL, -- Monday of the week
  date_assigned DATE NOT NULL, -- The date they were selected
  status TEXT NOT NULL CHECK (status IN ('assigned', 'completed', 'skipped')) DEFAULT 'assigned',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id, week_start_date) -- One assignment per user per week per group
);

CREATE INDEX idx_rotation_group_week ON custom_question_rotation(group_id, week_start_date);
CREATE INDEX idx_rotation_user ON custom_question_rotation(user_id);
```

### 1.3 New Table: `group_activity_tracking`
```sql
CREATE TABLE group_activity_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  first_member_joined_at TIMESTAMPTZ, -- First non-admin member join date
  first_entry_date DATE, -- Date of first entry in group
  is_eligible_for_custom_questions BOOLEAN DEFAULT false,
  eligible_since TIMESTAMPTZ, -- When eligibility was achieved
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id)
);

CREATE INDEX idx_activity_group ON group_activity_tracking(group_id);
```

### 1.4 Update `users` table
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_seen_custom_question_onboarding BOOLEAN DEFAULT false;
```

### 1.5 Update `prompts` table
```sql
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT false;
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS custom_question_id UUID REFERENCES custom_questions(id) ON DELETE SET NULL;
```

### 1.6 Update `daily_prompts` table
```sql
-- Already supports custom prompts via prompt_id reference
-- No schema changes needed, but we'll use custom_question_id to link back
```

---

## 2. Edge Functions / Cron Jobs

### 2.1 New Edge Function: `check-custom-question-eligibility`
**Purpose**: Runs daily to check if groups become eligible and track activity
**Schedule**: Daily at 1 AM UTC
**Logic**:
- Check all groups for:
  - First non-admin member join date (from `group_members` where `role != 'admin'`, ordered by `joined_at`)
  - First entry date (from `entries`, ordered by `created_at`)
  - Member count (must be >= 3)
- Update `group_activity_tracking` table
- Set `is_eligible_for_custom_questions = true` if:
  - Group has 3+ members
  - 7 days have passed since first non-admin member joined
  - `eligible_since` timestamp when eligibility achieved

### 2.2 New Edge Function: `assign-custom-question-opportunity`
**Purpose**: Runs every Monday at 12:01 AM UTC to assign custom question opportunities for the week
**Schedule**: Weekly on Monday
**Logic**:
- For each eligible group (`is_eligible_for_custom_questions = true`):
  - Get all members (excluding admin for rotation, but admin can still be selected)
  - Get rotation history for current week
  - Select a random member who:
    - Has NOT been assigned this week (check `custom_question_rotation` for current week)
    - Has NOT been assigned today across ANY group (prevent same-day conflicts)
    - Prioritize members who have never been assigned (check `custom_question_rotation` history)
  - If all members have been assigned, reset rotation (start fresh)
  - Pick a random day of the week (Mon-Sun) for this member
  - Insert into `custom_question_rotation` with `status = 'assigned'`
  - Insert into `custom_questions` with `date_assigned = selected_day`, `date_asked = NULL`
  - Send initial notification at 8 AM user's local time

### 2.3 New Edge Function: `send-custom-question-notifications`
**Purpose**: Send initial and reminder notifications for custom questions
**Schedule**: 
- Initial: Daily at 8 AM user's local time (via timezone-aware scheduling)
- Reminder: Daily at 4 PM user's local time (only if question not created)
**Logic**:
- Query `custom_questions` where:
  - `date_assigned = today`
  - `date_asked IS NULL` (not yet created)
  - `created_at` is within last 24 hours (for initial) or 6+ hours old (for reminder)
- Get user's timezone (from user profile or default to America/New_York)
- Send push notification with appropriate message
- For reminder: Only send if question not created and 6+ hours have passed since assignment

### 2.4 Update Edge Function: `schedule-daily-prompts`
**Purpose**: Check for custom questions before scheduling regular prompts
**Modifications**:
- Before checking birthdays or regular queue:
  - Check if there's a `custom_question` with `date_asked = today` for this group
  - If yes, use that custom question's `prompt_id` for today's prompt
  - Skip regular prompt scheduling for today
- Handle birthday override:
  - If birthday exists, schedule custom question for next available day (after all birthdays)
  - Update `custom_questions.date_asked` to the new date

### 2.5 New Edge Function: `process-skipped-custom-questions`
**Purpose**: Handle skipped questions and reassign if needed
**Schedule**: Daily at 11:59 PM UTC (end of day)
**Logic**:
- Find `custom_questions` where:
  - `date_assigned = today`
  - `date_asked IS NULL` (not created)
- Update `custom_question_rotation` status to `'skipped'`
- If same week, try to reassign to another member (if any haven't been assigned)
- Otherwise, mark as skipped and rotation continues next week

---

## 3. UI Components

### 3.1 Custom Question Banner Component (`components/CustomQuestionBanner.tsx`)
**Purpose**: Alert-style banner shown on home screen for selected user
**Props**:
- `opportunityDate: string` - The date they were assigned
- `onPress: () => void` - Navigate to custom question flow
**Styling**:
- Banner/alert style (similar to notification banner)
- Positioned above daily prompt card or EntryCards
- Clickable, with clear CTA text
- Theme-aware (light/dark mode)

### 3.2 Custom Question Onboarding Screen (`app/(main)/custom-question-onboarding.tsx`)
**Purpose**: One-time onboarding explaining the feature
**Style**: Similar to `welcome-2.tsx` (ImageBackground, LinearGradient, same layout)
**Content**:
- Title: "Ask Your Group Anything"
- Body text explaining:
  - You can ask custom questions once per week
  - Your question will be asked to everyone the next day
  - You can choose to be anonymous
- Button: "Got it" → Navigate to add-custom-question screen
- Mark `users.has_seen_custom_question_onboarding = true` after viewing

### 3.3 Add Custom Question Screen (`app/(main)/add-custom-question.tsx`)
**Purpose**: Main screen for creating custom question
**Components**:
- Text input for question (with 20-word limit counter)
- Text input for optional description
- Toggle switch: "Show my name" (default: ON) / "Keep anonymous" (default: OFF)
- Post button (red CTA)
- Character/word counter for question field
**Validation**:
- Question required, max 20 words
- Description optional
**Navigation**:
- Back button to home
- On success: Show success modal → Navigate to home

### 3.4 Success Modal (`app/(main)/modals/custom-question-success.tsx`)
**Purpose**: Confirmation after posting custom question
**Content**:
- Title: "Your question will be asked soon!"
- Body: "Your custom question will be asked to everyone in the group tomorrow."
- Button: "Back to Home" → Navigate to `/(main)/home`

### 3.5 Update Home Screen (`app/(main)/home.tsx`)
**Modifications**:
- Add query to check if current user has custom question opportunity today
- Render `CustomQuestionBanner` above prompt card if:
  - User has opportunity for `selectedDate === getTodayDate()`
  - Only show on "Today" date, not historical dates
- Position banner above prompt card or EntryCards (if user already answered)

### 3.6 Update Daily Prompt Display (`app/(main)/home.tsx` & `components/EntryCard.tsx`)
**Modifications**:
- Check if `dailyPrompt.prompt.is_custom === true`
- If custom and `is_anonymous === false`:
  - Show banner: "Brett has a question for you" with avatar
  - Display avatar + name above question text
- If custom and `is_anonymous === true`:
  - Show banner: "Custom question! Someone in your group asked everyone this:" with icon
  - Display icon above question text
- Style the tag/banner to distinguish from regular prompts

### 3.7 Dev Mode Setting (`app/(main)/settings.tsx`)
**Purpose**: Force custom question opportunity for testing
**Implementation**:
- Only visible when `__DEV__ === true`
- Toggle: "Force Custom Question Opportunity"
- When enabled:
  - Override eligibility checks
  - Show banner on home screen
  - Allow access to custom question flow
  - Store in AsyncStorage: `dev_force_custom_question: true`

---

## 4. App Logic / Database Functions

### 4.1 New Functions in `lib/db.ts`

#### `checkCustomQuestionEligibility(groupId: string): Promise<boolean>`
- Check if group is eligible:
  - Has 3+ members
  - 7+ days since first non-admin member joined
- Return boolean

#### `getCustomQuestionOpportunity(userId: string, groupId: string, date: string): Promise<CustomQuestion | null>`
- Check if user has custom question opportunity for given date
- Query `custom_questions` where:
  - `user_id = userId`
  - `group_id = groupId`
  - `date_assigned = date`
  - `date_asked IS NULL`
- Return opportunity or null

#### `createCustomQuestion(data: { groupId, userId, question, description, isAnonymous }): Promise<CustomQuestion>`
- Validate question (20 words max)
- Create entry in `custom_questions` table
- Create entry in `prompts` table with `is_custom = true`
- Link `prompts.custom_question_id` to `custom_questions.id`
- Update `custom_question_rotation` status to `'completed'`
- Update `custom_questions.date_asked` to tomorrow (or next available day after birthdays)
- Insert custom question prompt into `group_prompt_queue` at position 0
- Return created custom question

#### `hasSeenCustomQuestionOnboarding(userId: string): Promise<boolean>`
- Check `users.has_seen_custom_question_onboarding` for user
- Return boolean

#### `markCustomQuestionOnboardingSeen(userId: string): Promise<void>`
- Update `users.has_seen_custom_question_onboarding = true`

#### `getCustomQuestionForDate(groupId: string, date: string): Promise<CustomQuestion | null>`
- Get custom question that was asked on given date
- Query `custom_questions` where `date_asked = date` and `group_id = groupId`
- Join with `prompts` to get question details
- Return custom question with creator info (if not anonymous)

#### `getGroupActivityTracking(groupId: string): Promise<GroupActivityTracking | null>`
- Get activity tracking record for group
- Return eligibility status and dates

---

## 5. Notification System

### 5.1 Notification Types
**Initial Notification** (8 AM local time):
- Title: "You've been selected!"
- Body: "You've been selected to ask a custom question to your group. Tap to create yours."
- Data: `{ type: 'custom_question_opportunity', groupId, date }`
- Action: Deep link to `/(main)/add-custom-question?groupId={groupId}&date={date}`

**Reminder Notification** (4 PM local time):
- Title: "Don't forget!"
- Body: "You have X hours left to ask your custom question. Tap to create yours."
- Data: Same as initial
- Action: Same deep link

### 5.2 Update `send-daily-notifications` Edge Function
- Add logic to send custom question notifications
- Use timezone-aware scheduling (similar to existing 9 AM logic)
- Query `custom_questions` for today's assignments
- Send notifications at 8 AM and 4 PM user's local time

---

## 6. Integration Points

### 6.1 Home Screen Integration
**File**: `app/(main)/home.tsx`
**Changes**:
- Add query: `useQuery(['customQuestionOpportunity', currentGroupId, getTodayDate(), userId], ...)`
- Conditionally render `CustomQuestionBanner` above prompt card
- Only show on `selectedDate === getTodayDate()`
- Handle navigation to custom question flow

### 6.2 Daily Prompt Integration
**File**: `lib/db.ts` - `getDailyPrompt()`
**Changes**:
- Check if prompt is custom (`prompt.is_custom === true`)
- If custom, join with `custom_questions` to get creator info
- Return custom question metadata (creator, anonymous status)

### 6.3 Queue Integration
**File**: `supabase/functions/schedule-daily-prompts/index.ts`
**Changes**:
- Before scheduling regular prompt, check for custom question scheduled for today
- If custom question exists and `date_asked = today`, use that prompt
- Handle birthday override: reschedule custom question to next available day

### 6.4 Entry Composer Integration
**File**: `app/(main)/modals/entry-composer.tsx`
**Changes**:
- No changes needed - custom questions work like regular prompts
- Users can answer custom questions just like regular prompts

---

## 7. Edge Cases & Error Handling

### 7.1 Same-Day Conflict Prevention
- When assigning opportunities, check if user already has opportunity in another group today
- If conflict exists, skip assignment for this week
- Log conflict for monitoring

### 7.2 Member Leaves Group
- If member leaves during 24-hour window:
  - Mark opportunity as skipped
  - Rotation continues normally
  - No reassignment needed

### 7.3 Group Drops Below 3 Members
- Feature continues to work (no stop condition)
- Rotation continues with remaining members
- New members can be added to rotation once they join

### 7.4 Multiple Birthdays Back-to-Back
- Custom question scheduled after ALL birthdays
- Check consecutive days for birthdays
- Schedule custom question on first non-birthday day

### 7.5 User in Multiple Groups
- Each group has independent rotation
- User can be selected in multiple groups (different weeks)
- Same-day conflict prevention ensures no overlap

### 7.6 Timezone Handling
- Store user timezone preference (or default to America/New_York)
- Calculate 8 AM and 4 PM in user's local time
- Convert to UTC for notification scheduling

---

## 8. Risks & Mitigation

### 8.1 Risk: Notification Timing Issues
**Mitigation**:
- Use timezone-aware scheduling
- Test across multiple timezones
- Fallback to UTC if timezone unavailable

### 8.2 Risk: Race Conditions in Assignment
**Mitigation**:
- Use database transactions for assignment
- Unique constraints prevent duplicate assignments
- Check for conflicts before assignment

### 8.3 Risk: Queue Override Logic Complexity
**Mitigation**:
- Clear documentation of priority: Custom Question > Birthday > Regular Queue
- Extensive testing of birthday override scenarios
- Log all scheduling decisions for debugging

### 8.4 Risk: Rotation Fairness
**Mitigation**:
- Track rotation history in `custom_question_rotation` table
- Prioritize members who haven't been assigned
- Reset rotation after all members have had a turn
- Monitor rotation distribution

### 8.5 Risk: Performance with Large Groups
**Mitigation**:
- Index all relevant columns
- Limit queries to current week
- Cache rotation history
- Batch operations where possible

### 8.6 Risk: User Confusion About Feature
**Mitigation**:
- Clear onboarding explanation
- Prominent banner on home screen
- Helpful notification messages
- Success modal confirms understanding

### 8.7 Risk: Custom Questions Breaking Queue Logic
**Mitigation**:
- Insert at position 0 (highest priority)
- Clear documentation of queue behavior
- Test with various queue states
- Handle edge cases (empty queue, etc.)

---

## 9. Testing Checklist

### 9.1 Eligibility Testing
- [ ] Group with 2 members cannot access feature
- [ ] Group with 3 members after 7 days can access feature
- [ ] Group becomes eligible exactly 7 days after first non-admin member joined
- [ ] Feature continues working if group drops below 3 members

### 9.2 Rotation Testing
- [ ] All members get a turn before rotation resets
- [ ] Skipped questions don't block rotation
- [ ] Rotation is independent per group
- [ ] Same-day conflicts are prevented

### 9.3 Notification Testing
- [ ] Initial notification sent at 8 AM user's local time
- [ ] Reminder notification sent at 4 PM if question not created
- [ ] No reminder if question already created
- [ ] Notifications work across timezones

### 9.4 Queue Integration Testing
- [ ] Custom question appears next day (no birthdays)
- [ ] Custom question delayed if birthday exists
- [ ] Custom question appears after multiple birthdays
- [ ] Regular queue continues after custom question

### 9.5 UI Testing
- [ ] Banner appears only for selected user on "Today"
- [ ] Banner doesn't appear on historical dates
- [ ] Onboarding shows only once per user
- [ ] Custom question displays with creator info (if not anonymous)
- [ ] Custom question displays with anonymous branding (if anonymous)
- [ ] 20-word limit enforced
- [ ] Success modal works correctly

### 9.6 Dev Mode Testing
- [ ] Dev toggle only visible in development
- [ ] Dev toggle overrides all eligibility checks
- [ ] Dev toggle allows testing full flow

---

## 10. Implementation Order

### Phase 1: Database & Core Logic
1. Create database migrations (tables, indexes, columns)
2. Create `lib/db.ts` functions for custom questions
3. Create edge function for eligibility checking
4. Create edge function for assignment logic

### Phase 2: Notifications
5. Create edge function for custom question notifications
6. Update notification scheduling system
7. Test notification delivery

### Phase 3: Queue Integration
8. Update `schedule-daily-prompts` to handle custom questions
9. Test queue override logic
10. Test birthday override scenarios

### Phase 4: UI Components
11. Create `CustomQuestionBanner` component
12. Create onboarding screen
13. Create add-custom-question screen
14. Create success modal
15. Update home screen to show banner
16. Update prompt display to show custom question branding

### Phase 5: Dev Mode
17. Add dev mode toggle to settings
18. Implement dev mode override logic

### Phase 6: Testing & Refinement
19. End-to-end testing
20. Edge case testing
21. Performance testing
22. User acceptance testing

---

## 11. Files to Create/Modify

### New Files:
- `supabase/migrations/018_add_custom_questions.sql`
- `supabase/functions/check-custom-question-eligibility/index.ts`
- `supabase/functions/assign-custom-question-opportunity/index.ts`
- `supabase/functions/send-custom-question-notifications/index.ts`
- `supabase/functions/process-skipped-custom-questions/index.ts`
- `components/CustomQuestionBanner.tsx`
- `app/(main)/custom-question-onboarding.tsx`
- `app/(main)/add-custom-question.tsx`
- `app/(main)/modals/custom-question-success.tsx`
- `lib/types.ts` (add CustomQuestion, CustomQuestionRotation, GroupActivityTracking types)

### Modified Files:
- `lib/db.ts` (add custom question functions)
- `app/(main)/home.tsx` (add banner, custom question detection)
- `app/(main)/settings.tsx` (add dev mode toggle)
- `supabase/functions/schedule-daily-prompts/index.ts` (handle custom questions)
- `supabase/functions/send-daily-notifications/index.ts` (add custom question notifications)
- `components/EntryCard.tsx` (show custom question branding)
- `supabase/migrations/002_add_cron_jobs.sql` (add new cron jobs)

---

## 12. Success Criteria

- [ ] Groups become eligible exactly 7 days after first non-admin member joins
- [ ] One member per group per week gets custom question opportunity
- [ ] Rotation ensures all members get a turn before resetting
- [ ] Notifications sent at correct times (8 AM initial, 4 PM reminder)
- [ ] Custom questions appear next day (or after birthdays)
- [ ] Queue continues normally after custom question
- [ ] Anonymous and named questions display correctly
- [ ] Onboarding shows only once per user
- [ ] Dev mode allows testing without waiting
- [ ] No same-day conflicts across groups
- [ ] Feature works correctly with multiple groups per user

---

## 13. Open Questions / Future Enhancements

1. **Question Moderation**: Should admins be able to review/approve custom questions before they're asked?
2. **Question History**: Should users be able to see past custom questions they've asked?
3. **Question Analytics**: Track which custom questions get the most responses?
4. **Question Editing**: Allow editing within 24-hour window (currently not allowed)?
5. **Question Deletion**: Allow deletion before it's asked?
6. **Multiple Questions**: Allow multiple custom questions per week if group is very active?

---

## 14. Estimated Timeline

- **Database & Core Logic**: 2-3 days
- **Notifications**: 1-2 days
- **Queue Integration**: 2-3 days
- **UI Components**: 3-4 days
- **Dev Mode**: 0.5 days
- **Testing & Refinement**: 2-3 days
- **Total**: ~11-16 days

---

This plan provides a comprehensive roadmap for implementing the custom question feature. Each component is designed to integrate seamlessly with the existing codebase while maintaining data integrity and user experience.

