# Automatic Inclusion of New Questions

## ✅ Yes, New Questions Are Automatically Included

When you add new questions to the `prompts` table and classify them, they will **automatically** be included in the personalization system without any additional work.

## Requirements for Automatic Inclusion

For a new question to be automatically included in personalized suggestions, it must meet these criteria:

### 1. **Default Status**
- `is_default = true` OR `is_default IS NULL`
- Questions with `is_default = false` are excluded (these are typically deck-specific or special questions)

### 2. **Category Matching**
- Category must match the group type:
  - **Family groups**: Only `category = 'Family'`
  - **Friends groups**: Only `category = 'Friends'`

### 3. **Not Special Categories**
- Category must NOT be:
  - `'Remembering'` (handled separately, max 2/week)
  - `'Birthday'` (handled separately on birthdays)
  - `'Featured'` (handled separately, max 2/week)
  - `'Custom'` (handled via `custom_questions` table)

### 4. **Not Training Questions**
- `is_training IS NULL` OR `is_training = false`
- Training questions (`is_training = true`) are excluded from suggestions

### 5. **Classification Data (Recommended)**
While not strictly required, having classification data improves personalization:
- `depth_level`
- `vulnerability_score`
- `topics` (array)
- `mood_tags` (array)
- `emotional_weight`
- `time_orientation`
- `focus_type`
- etc.

Questions without classification data will still be included but will use default/global metrics for scoring.

## Example: Adding a New Question

```sql
-- Insert new question
INSERT INTO prompts (
  question,
  category,
  is_default,
  depth_level,
  vulnerability_score,
  topics,
  mood_tags,
  -- ... other classification fields
)
VALUES (
  'What is a small moment from this week that made you smile?',
  'Friends',  -- or 'Family' for family groups
  true,       -- Mark as default (available for general use)
  2,          -- Light depth
  1,          -- Low vulnerability
  ARRAY['gratitude', 'reflection'],
  ARRAY['positive', 'light'],
  -- ... other classification values
);
```

This question will **immediately** be:
- ✅ Included in `suggest_questions_for_group()` results
- ✅ Scored based on group profiles
- ✅ Available for personalized queue population
- ✅ Used in on-the-fly personalized selection

## What Happens Automatically

1. **Next Profile Refresh** (daily at 12:05 AM UTC):
   - New questions are included in scoring calculations
   - Global metrics are updated if the question is asked

2. **Next Queue Population** (weekly, Sunday 11 PM UTC):
   - New questions are considered for personalized suggestions
   - Added to group queues based on fit scores

3. **Next Daily Scheduling** (daily at 12:01 AM UTC):
   - New questions are available for on-the-fly personalized selection
   - Used when queue is empty and no other priority items exist

## No Manual Steps Required

- ✅ No need to update functions
- ✅ No need to modify scheduling logic
- ✅ No need to run migrations
- ✅ Just insert the question with proper classification

The system automatically picks up new questions that meet the criteria!

