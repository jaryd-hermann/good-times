# Birthday Prompts Implementation Guide

## Overview

This document outlines the implementation of birthday-specific prompts that send different questions to group members based on whose birthday it is.

## Database Changes

### Migration: `008_birthday_prompts.sql`

This migration adds:
1. **`birthday_type` column** to `prompts` table
   - Values: `NULL` (not a birthday prompt), `'your_birthday'`, `'their_birthday'`
   - Used to identify birthday-specific prompts

2. **`dynamic_variables` column** to `prompts` table
   - JSONB array of variable names (e.g., `["member_name", "memorial_name"]`)
   - Used to identify which variables should be replaced in the question text

3. **`user_id` column** to `daily_prompts` table
   - NULL = general prompt (applies to all group members)
   - user_id = user-specific prompt (e.g., birthday prompts)

4. **Updated unique constraint** on `daily_prompts`
   - Allows per-user prompts on the same date
   - A group can have one general prompt OR multiple user-specific prompts per date

## How It Works

### Birthday Detection

1. The `schedule-daily-prompts` Edge Function runs daily (via pg_cron)
2. For each group, it checks if any member has a birthday today (MM-DD match)
3. If birthdays are found:
   - Birthday person gets a "your_birthday" prompt (user-specific)
   - All other members get a "their_birthday" prompt (user-specific, personalized with birthday person's name)
4. If no birthdays:
   - Regular prompt logic applies (general prompt for all members)

### Dynamic Variables

Prompts can include dynamic variables in their question text:
- `{member_name}` or `{{member_name}}` - Replaced with the birthday person's name in "their_birthday" prompts
- `{memorial_name}` or `{{memorial_name}}` - Replaced with memorial names in "Remembering" prompts

### Prompt Selection Logic

The `getDailyPrompt()` function in `lib/db.ts`:
1. First checks for user-specific prompt (if `userId` provided)
2. Falls back to general prompt (user_id is NULL)
3. Replaces dynamic variables before returning

## Required Supabase Setup

### 1. Run Migration

Execute `supabase/migrations/008_birthday_prompts.sql` in your Supabase SQL Editor.

### 2. Update Prompts Table

You'll need to:
1. **Add birthday prompts** to the `prompts` table with:
   - `category: "Birthday"`
   - `birthday_type: "your_birthday"` or `"their_birthday"`
   - `dynamic_variables: ["member_name"]` (for "their_birthday" prompts)
   - Question text should include `{member_name}` placeholder

2. **Update existing memorial prompts** to include:
   - `dynamic_variables: ["memorial_name"]`
   - Question text should use `{memorial_name}` or `{{memorial_name}}` format

### 3. Example Birthday Prompts

**"Your Birthday" prompt:**
```sql
INSERT INTO prompts (question, category, birthday_type, dynamic_variables) VALUES
('What do you hope this year brings for you?', 'Birthday', 'your_birthday', '[]'::jsonb);
```

**"Their Birthday" prompt:**
```sql
INSERT INTO prompts (question, category, birthday_type, dynamic_variables) VALUES
('What''s your favorite memory with {member_name}?', 'Birthday', 'their_birthday', '["member_name"]'::jsonb);
```

### 4. Update Edge Functions

The Edge Functions have been updated:
- `schedule-daily-prompts/index.ts` - Handles birthday detection and prompt assignment
- `send-daily-notifications/index.ts` - Handles user-specific notifications and variable replacement

**Deploy the updated functions:**
```bash
supabase functions deploy schedule-daily-prompts
supabase functions deploy send-daily-notifications
```

## Testing

### Test Birthday Logic

1. Set a test user's birthday to today's date (MM-DD)
2. Run the `schedule-daily-prompts` function manually or wait for cron
3. Verify:
   - Birthday person has a "your_birthday" prompt in `daily_prompts` with their `user_id`
   - Other members have "their_birthday" prompts with their respective `user_id`s
   - General prompt (user_id = NULL) is NOT created for that date

### Test Dynamic Variables

1. Create a prompt with `dynamic_variables: ["member_name"]` and question text containing `{member_name}`
2. Verify the variable is replaced when the prompt is displayed/notified

## Notes

- Birthday prompts override regular prompts for that day
- Multiple birthdays on the same day: Each birthday person gets "your_birthday", others get "their_birthday" for each birthday person
- The system uses MM-DD format (ignores year) for birthday matching
- Dynamic variables support both `{variable}` and `{{variable}}` formats for flexibility

